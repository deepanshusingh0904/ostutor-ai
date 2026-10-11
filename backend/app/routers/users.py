from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.models import DEFAULT_SETTINGS, User
from app.schemas import PasswordChange, ProfileUpdate, SettingsUpdate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_profile(payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.get("/me/settings")
def get_settings_(user: User = Depends(get_current_user)):
    return {**DEFAULT_SETTINGS, **(user.settings or {})}


@router.put("/me/settings")
def update_settings(payload: SettingsUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    merged = {**DEFAULT_SETTINGS, **(user.settings or {}), **payload.model_dump(exclude_none=True)}
    user.settings = merged
    db.commit()
    return merged
