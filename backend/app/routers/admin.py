from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models import (
    Conversation, Document, Message, Quiz, QuizAttempt, StudyLog, User, VivaSession, utcnow,
)
from app.rag.embeddings import get_embedder
from app.rag.retriever import retrieve
from app.rag.vectorstore import get_vector_store
from app.schemas import AdminUserUpdate, RagTestRequest, UserOut
from app.services.generation import citations_for
from app.services.llm import get_llm

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def stats(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    week_ago = (utcnow() - timedelta(days=7)).date()
    active = db.query(func.count(func.distinct(StudyLog.user_id))).filter(StudyLog.day >= week_ago).scalar() or 0
    store = get_vector_store()
    return {
        "users": db.query(func.count(User.id)).scalar(),
        "admins": db.query(func.count(User.id)).filter(User.role == "admin").scalar(),
        "active_users_7d": active,
        "documents": db.query(func.count(Document.id)).scalar(),
        "documents_ready": db.query(func.count(Document.id)).filter(Document.status == "ready").scalar(),
        "documents_failed": db.query(func.count(Document.id)).filter(Document.status == "failed").scalar(),
        "chunks": store.count(),
        "conversations": db.query(func.count(Conversation.id)).scalar(),
        "messages": db.query(func.count(Message.id)).scalar(),
        "quizzes": db.query(func.count(Quiz.id)).scalar(),
        "quiz_attempts": db.query(func.count(QuizAttempt.id)).scalar(),
        "vivas": db.query(func.count(VivaSession.id)).scalar(),
        "llm_configured": get_llm().configured,
        "llm_model": get_llm().settings.llm_model if get_llm().configured else None,
        "embedding_model": get_embedder().name,
        "vector_collection": store.collection_name,
    }


@router.get("/users", response_model=list[UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.id).all()


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: AdminUserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if user.id == admin.id and (payload.role == "student" or payload.is_active is False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot demote or deactivate your own account")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account")
    db.delete(user)
    db.commit()


@router.post("/rag/test")
def rag_test(payload: RagTestRequest, _: User = Depends(require_admin)):
    chunks = retrieve(payload.query, top_k=payload.top_k, min_score=0.0)
    return {"query": payload.query, "results": citations_for(chunks)}
