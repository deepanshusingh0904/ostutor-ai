from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Bookmark, Conversation, Message, StudyGuide, User
from app.rag.retriever import retrieve
from app.services.generation import citations_for

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def search(q: str = Query(min_length=2, max_length=300), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    like = f"%{q.strip()}%"
    passages = citations_for(retrieve(q, top_k=6, min_score=0.05))
    convs = (
        db.query(Conversation).filter(Conversation.user_id == user.id)
        .filter(Conversation.title.ilike(like) | Conversation.id.in_(
            db.query(Message.conversation_id).filter(Message.content.ilike(like))))
        .order_by(Conversation.updated_at.desc()).limit(10).all()
    )
    marks = db.query(Bookmark).filter(Bookmark.user_id == user.id).filter(
        Bookmark.title.ilike(like) | Bookmark.content.ilike(like)).limit(10).all()
    guides = db.query(StudyGuide).filter(StudyGuide.user_id == user.id).filter(
        StudyGuide.topic.ilike(like) | StudyGuide.content.ilike(like)).limit(10).all()
    return {
        "query": q,
        "passages": passages,
        "conversations": [{"id": c.id, "title": c.title, "mode": c.mode, "updated_at": c.updated_at.isoformat()} for c in convs],
        "bookmarks": [{"id": b.id, "title": b.title, "kind": b.kind, "conversation_id": b.conversation_id} for b in marks],
        "guides": [{"id": g.id, "topic": g.topic, "kind": g.kind} for g in guides],
    }
