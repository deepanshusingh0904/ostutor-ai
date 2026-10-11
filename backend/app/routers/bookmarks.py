from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Bookmark, User
from app.schemas import BookmarkCreate, BookmarkOut

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


@router.get("", response_model=list[BookmarkOut])
def list_bookmarks(q: str | None = Query(default=None, max_length=200), kind: str | None = None,
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Bookmark).filter(Bookmark.user_id == user.id)
    if kind:
        query = query.filter(Bookmark.kind == kind)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(Bookmark.title.ilike(like) | Bookmark.content.ilike(like))
    return query.order_by(Bookmark.id.desc()).limit(200).all()


@router.post("", response_model=BookmarkOut, status_code=status.HTTP_201_CREATED)
def create_bookmark(payload: BookmarkCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.ref_id is not None:
        existing = db.query(Bookmark).filter_by(user_id=user.id, kind=payload.kind, ref_id=payload.ref_id).first()
        if existing:
            return existing
    bookmark = Bookmark(user_id=user.id, **payload.model_dump())
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(bookmark_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bookmark = db.get(Bookmark, bookmark_id)
    if bookmark is None or bookmark.user_id != user.id:
        raise HTTPException(404, "Bookmark not found")
    db.delete(bookmark)
    db.commit()
