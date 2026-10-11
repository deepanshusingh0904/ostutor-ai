"""Study guides and visual learning endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import StudyGuide, User
from app.schemas import GuideGenerate, GuideOut, VisualOut, VisualRequest
from app.services import progress
from app.services.generation import NoContextError, generate_guide, generate_visual

router = APIRouter(prefix="/api", tags=["study"])


@router.post("/study-guides", response_model=GuideOut, status_code=status.HTTP_201_CREATED)
def create_guide(payload: GuideGenerate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        content, citations = generate_guide(payload.topic.strip(), payload.kind)
    except NoContextError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    guide = StudyGuide(user_id=user.id, topic=payload.topic.strip(), kind=payload.kind, content=content, citations=citations)
    db.add(guide)
    db.commit()
    db.refresh(guide)
    progress.touch_topic(db, user.id, guide.topic)
    return guide


@router.get("/study-guides", response_model=list[GuideOut])
def list_guides(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(StudyGuide).filter(StudyGuide.user_id == user.id).order_by(StudyGuide.id.desc()).limit(100).all()


@router.get("/study-guides/{guide_id}", response_model=GuideOut)
def get_guide(guide_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    guide = db.get(StudyGuide, guide_id)
    if guide is None or guide.user_id != user.id:
        raise HTTPException(404, "Study guide not found")
    return guide


@router.delete("/study-guides/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guide(guide_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    guide = db.get(StudyGuide, guide_id)
    if guide is None or guide.user_id != user.id:
        raise HTTPException(404, "Study guide not found")
    db.delete(guide)
    db.commit()


@router.post("/visuals", response_model=VisualOut)
def create_visual(payload: VisualRequest, _: User = Depends(get_current_user)):
    title, code = generate_visual(payload.topic.strip(), payload.kind)
    return VisualOut(kind=payload.kind, topic=payload.topic.strip(), title=title, mermaid=code)
