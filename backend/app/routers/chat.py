import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.models import Conversation, Message, User
from app.schemas import (
    ConversationCreate, ConversationDetail, ConversationOut, ConversationUpdate, StreamRequest,
)
from app.services.chat_service import stream_reply

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger("ostutor.chat")


def _owned(db: Session, conversation_id: int, user: User) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(404, "Conversation not found")
    return conv


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    q: str | None = Query(default=None, max_length=200),
    mode: str | None = Query(default=None, pattern="^(chat|professor)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Conversation).filter(Conversation.user_id == user.id)
    if mode:
        query = query.filter(Conversation.mode == mode)
    if q and q.strip():
        like = f"%{q.strip()}%"
        matching = db.query(Message.conversation_id).filter(Message.content.ilike(like))
        query = query.filter(or_(Conversation.title.ilike(like), Conversation.id.in_(matching)))
    return query.order_by(Conversation.pinned.desc(), Conversation.updated_at.desc()).limit(200).all()


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(payload: ConversationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = Conversation(user_id=user.id, mode=payload.mode, title=payload.title or "New conversation")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _owned(db, conversation_id, user)


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
def update_conversation(conversation_id: int, payload: ConversationUpdate, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    conv = _owned(db, conversation_id, user)
    data = payload.model_dump(exclude_none=True)
    if "title" in data:
        data["title"] = data["title"].strip()
    for key, value in data.items():
        setattr(conv, key, value)
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = _owned(db, conversation_id, user)
    db.delete(conv)
    db.commit()


@router.post("/conversations/{conversation_id}/stream")
def stream_conversation(conversation_id: int, payload: StreamRequest, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    _owned(db, conversation_id, user)
    user_id = user.id

    def event_source():
        with SessionLocal() as session:
            try:
                current_user = session.get(User, user_id)
                conv = session.get(Conversation, conversation_id)
                for event in stream_reply(session, current_user, conv, payload):
                    yield f"data: {json.dumps(event)}\n\n"
            except Exception as exc:  # noqa: BLE001
                logger.exception("Streaming failed")
                yield f"data: {json.dumps({'type': 'error', 'message': 'Something went wrong while generating the reply.'})}\n\n"
                session.rollback()
                del exc

    return StreamingResponse(
        event_source(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
