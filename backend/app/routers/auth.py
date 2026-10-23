import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models import DEFAULT_SETTINGS, User, utcnow
from app.schemas import AuthConfig, GoogleLoginRequest, LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

settings = get_settings()


def verify_google_credential(credential: str) -> dict:
    """Check a Google ID token (signature, expiry, audience). Isolated so tests can replace it."""
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    return id_token.verify_oauth2_token(credential, google_requests.Request(), settings.google_client_id)


@router.get("/config", response_model=AuthConfig)
def auth_config():
    """Tells the sign-in page which optional login methods are switched on."""
    return AuthConfig(google_client_id=settings.google_client_id)


@router.post("/google", response_model=TokenResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Google sign-in is not enabled")
    try:
        info = verify_google_credential(payload.credential)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google sign-in failed. Please try again.")
    email = (info.get("email") or "").lower()
    if not email or not info.get("email_verified", False):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your Google email address is not verified")
    user = db.query(User).filter(func.lower(User.email) == email).first()
    if user is None:
        user = User(
            email=email, full_name=(info.get("name") or email.split("@")[0])[:120],
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # Google users never use a password
            role="student", settings=dict(DEFAULT_SETTINGS),
        )
        db.add(user)
    elif not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    user.last_login_at = utcnow()
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))



@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        email=email, full_name=payload.full_name, hashed_password=hash_password(payload.password),
        role="student", settings=dict(DEFAULT_SETTINGS), last_login_at=utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    user.last_login_at = utcnow()
    db.commit()
    return TokenResponse(access_token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
