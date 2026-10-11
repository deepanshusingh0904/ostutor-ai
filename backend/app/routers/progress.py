from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.schemas import Heartbeat
from app.services import progress

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return progress.dashboard(db, user)


@router.post("/heartbeat")
def heartbeat(payload: Heartbeat, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = progress.add_study_time(db, user.id, payload.seconds)
    return {"today_seconds": log.seconds}
