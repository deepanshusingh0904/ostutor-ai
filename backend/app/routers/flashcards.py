from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Flashcard, FlashcardDeck, User
from app.schemas import DeckGenerate, DeckOut, FlashcardOut, ReviewRequest
from app.services.generation import NoContextError, generate_cards

router = APIRouter(prefix="/api/flashcards", tags=["flashcards"])


def _deck_out(deck: FlashcardDeck) -> DeckOut:
    today = date.today()
    return DeckOut(id=deck.id, topic=deck.topic, created_at=deck.created_at, card_count=len(deck.cards),
                   due_count=sum(1 for c in deck.cards if c.due_date <= today))


def _owned(db: Session, deck_id: int, user: User) -> FlashcardDeck:
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None or deck.user_id != user.id:
        raise HTTPException(404, "Deck not found")
    return deck


def schedule(card: Flashcard, rating: int, today: date | None = None) -> None:
    """Simplified SM-2 spaced repetition. rating: 0 again, 1 hard, 2 good, 3 easy."""
    today = today or date.today()
    if rating == 0:
        card.repetitions, card.interval_days = 0, 0
        card.ease = max(1.3, card.ease - 0.2)
    else:
        card.repetitions += 1
        if rating == 1:
            card.interval_days = max(1, round(max(card.interval_days, 1) * 1.2))
            card.ease = max(1.3, card.ease - 0.15)
        else:
            if card.repetitions == 1:
                card.interval_days = 1 if rating == 2 else 2
            elif card.repetitions == 2:
                card.interval_days = 3 if rating == 2 else 4
            else:
                factor = card.ease * (1.3 if rating == 3 else 1.0)
                card.interval_days = max(1, round(card.interval_days * factor))
            if rating == 3:
                card.ease += 0.15
    card.due_date = today + timedelta(days=card.interval_days)


@router.get("/decks", response_model=list[DeckOut])
def list_decks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    decks = db.query(FlashcardDeck).filter(FlashcardDeck.user_id == user.id).order_by(FlashcardDeck.id.desc()).all()
    return [_deck_out(d) for d in decks]


@router.post("/decks", response_model=DeckOut, status_code=status.HTTP_201_CREATED)
def create_deck(payload: DeckGenerate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        cards = generate_cards(payload.topic.strip(), payload.count)
    except NoContextError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    deck = FlashcardDeck(user_id=user.id, topic=payload.topic.strip())
    deck.cards = [Flashcard(front=c["front"], back=c["back"], source=c.get("source", "")) for c in cards]
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return _deck_out(deck)


@router.get("/decks/{deck_id}/cards", response_model=list[FlashcardOut])
def deck_cards(deck_id: int, due_only: bool = Query(default=False), user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    deck = _owned(db, deck_id, user)
    today = date.today()
    return [c for c in deck.cards if not due_only or c.due_date <= today]


@router.post("/cards/{card_id}/review", response_model=FlashcardOut)
def review(card_id: int, payload: ReviewRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None or card.deck.user_id != user.id:
        raise HTTPException(404, "Card not found")
    schedule(card, payload.rating)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, deck_id, user))
    db.commit()
