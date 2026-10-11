from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User, VivaSession
from app.schemas import VivaAnswer, VivaOut, VivaStart
from app.services import progress
from app.services.generation import NoContextError, evaluate_viva, next_viva_question, viva_final_report

router = APIRouter(prefix="/api/viva", tags=["viva"])


def _public(session: VivaSession) -> VivaOut:
    transcript = []
    for turn in session.transcript:
        item = dict(turn)
        if item.get("answer") is None:
            item.pop("reference_answer", None)
        transcript.append(item)
    return VivaOut(
        id=session.id, topic=session.topic, difficulty=session.difficulty, max_questions=session.max_questions,
        status=session.status, transcript=transcript, final_score=session.final_score,
        final_feedback=session.final_feedback, created_at=session.created_at,
    )


def _owned(db: Session, viva_id: int, user: User) -> VivaSession:
    session = db.get(VivaSession, viva_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(404, "Viva session not found")
    return session


@router.post("", response_model=VivaOut, status_code=status.HTTP_201_CREATED)
def start(payload: VivaStart, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        first = next_viva_question(payload.topic.strip(), payload.difficulty, [])
    except NoContextError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    session = VivaSession(
        user_id=user.id, topic=payload.topic.strip(), difficulty=payload.difficulty, max_questions=payload.max_questions,
        transcript=[{"question": first["question"], "reference_answer": first["reference_answer"], "answer": None}],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _public(session)


@router.get("", response_model=list[VivaOut])
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(VivaSession).filter(VivaSession.user_id == user.id).order_by(VivaSession.id.desc()).limit(30).all()
    return [_public(s) for s in sessions]


@router.get("/{viva_id}", response_model=VivaOut)
def get_session(viva_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _public(_owned(db, viva_id, user))


@router.post("/{viva_id}/answer", response_model=VivaOut)
def answer(viva_id: int, payload: VivaAnswer, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = _owned(db, viva_id, user)
    if session.status != "active":
        raise HTTPException(400, "This viva has already finished")
    transcript = [dict(t) for t in session.transcript]
    pending = next((t for t in reversed(transcript) if t.get("answer") is None), None)
    if pending is None:
        raise HTTPException(400, "There is no open question")
    evaluation = evaluate_viva(pending["question"], pending["reference_answer"], payload.answer.strip())
    pending.update(answer=payload.answer.strip(), score=evaluation["score"], feedback=evaluation["feedback"],
                   missing=evaluation.get("missing", []))
    answered = [t for t in transcript if t.get("answer") is not None]
    progress.record_topic_result(db, user.id, session.topic, evaluation["score"] / 10, 1)
    if len(answered) >= session.max_questions:
        final = round(sum(t["score"] for t in answered) / len(answered), 1)
        session.final_score = final
        session.final_feedback = viva_final_report(session.topic, final, answered)
        session.status = "completed"
        progress.add_study_time(db, user.id, 60 * len(answered))
    else:
        try:
            nxt = next_viva_question(session.topic, session.difficulty, [t["question"] for t in transcript])
        except NoContextError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
        transcript.append({"question": nxt["question"], "reference_answer": nxt["reference_answer"], "answer": None})
    session.transcript = transcript
    db.commit()
    db.refresh(session)
    return _public(session)
