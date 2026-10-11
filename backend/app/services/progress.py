"""Learning-progress tracking: study time, streaks, topic strength and dashboard aggregation."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    Bookmark, Conversation, Document, Flashcard, FlashcardDeck, Quiz, QuizAttempt, StudyLog, TopicProgress, User,
    VivaSession, utcnow,
)

MIN_STREAK_SECONDS = 60
WEAK_BELOW = 0.6
STRONG_AT_LEAST = 0.75


def add_study_time(db: Session, user_id: int, seconds: int) -> StudyLog:
    today = date.today()
    log = db.query(StudyLog).filter_by(user_id=user_id, day=today).first()
    if log is None:
        log = StudyLog(user_id=user_id, day=today, seconds=0)
        db.add(log)
    log.seconds += seconds
    db.commit()
    return log


def _topic_row(db: Session, user_id: int, topic: str) -> TopicProgress:
    topic = " ".join(topic.split())[:200] or "General"
    row = (
        db.query(TopicProgress)
        .filter(TopicProgress.user_id == user_id, func.lower(TopicProgress.topic) == topic.lower())
        .first()
    )
    if row is None:
        row = TopicProgress(user_id=user_id, topic=topic, correct=0, total=0, interactions=0)
        db.add(row)
    return row


def touch_topic(db: Session, user_id: int, topic: str) -> None:
    if not topic.strip():
        return
    row = _topic_row(db, user_id, topic)
    row.interactions += 1
    row.last_studied = utcnow()
    db.commit()


def record_topic_result(db: Session, user_id: int, topic: str, correct: float, total: float) -> None:
    row = _topic_row(db, user_id, topic)
    row.correct += correct
    row.total += total
    row.interactions += 1
    row.last_studied = utcnow()
    db.commit()


def compute_streak(study_days: set[date], today: date | None = None) -> int:
    today = today or date.today()
    cursor = today if today in study_days else today - timedelta(days=1)
    streak = 0
    while cursor in study_days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _topic_stats(rows: list[TopicProgress]) -> list[dict]:
    stats = []
    for r in rows:
        if r.total <= 0:
            continue
        stats.append({
            "topic": r.topic, "accuracy": round(100 * r.correct / r.total), "attempts": round(r.total),
            "last_studied": r.last_studied.isoformat(),
        })
    return stats


def dashboard(db: Session, user: User) -> dict:
    today = date.today()
    logs = db.query(StudyLog).filter(StudyLog.user_id == user.id).all()
    by_day = {log.day: log.seconds for log in logs}
    study_days = {d for d, s in by_day.items() if s >= MIN_STREAK_SECONDS}
    week = []
    for offset in range(6, -1, -1):
        d = today - timedelta(days=offset)
        week.append({"date": d.isoformat(), "label": d.strftime("%a"), "minutes": round(by_day.get(d, 0) / 60, 1)})

    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == user.id).order_by(QuizAttempt.id.desc()).all()
    total_points = sum(a.score for a in attempts)
    total_qs = sum(a.total for a in attempts)
    quiz_accuracy = round(100 * total_points / total_qs) if total_qs else None

    topics = _topic_stats(db.query(TopicProgress).filter(TopicProgress.user_id == user.id).all())
    weak = sorted([t for t in topics if t["accuracy"] < WEAK_BELOW * 100], key=lambda t: t["accuracy"])[:5]
    strong = sorted([t for t in topics if t["accuracy"] >= STRONG_AT_LEAST * 100], key=lambda t: -t["accuracy"])[:5]

    viva_scores = [v.final_score for v in db.query(VivaSession).filter(
        VivaSession.user_id == user.id, VivaSession.status == "completed").all() if v.final_score is not None]
    recent_attempts = []
    for a in attempts[:8][::-1]:
        quiz = db.get(Quiz, a.quiz_id)
        recent_attempts.append({
            "id": a.id, "topic": quiz.topic if quiz else "Quiz",
            "percent": round(100 * a.score / a.total) if a.total else 0, "date": a.created_at.isoformat(),
        })
    chats = db.query(Conversation).filter(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc()).limit(5).all()
    marks = db.query(Bookmark).filter(Bookmark.user_id == user.id).order_by(Bookmark.id.desc()).limit(5).all()
    due = (
        db.query(func.count(Flashcard.id)).join(FlashcardDeck, Flashcard.deck_id == FlashcardDeck.id)
        .filter(FlashcardDeck.user_id == user.id, Flashcard.due_date <= today).scalar() or 0
    )
    goal = int((user.settings or {}).get("daily_goal_minutes", 30))
    return {
        "streak": compute_streak(study_days, today),
        "today_minutes": round(by_day.get(today, 0) / 60, 1),
        "total_minutes": round(sum(by_day.values()) / 60),
        "daily_goal_minutes": goal,
        "week": week,
        "quiz_accuracy": quiz_accuracy,
        "quizzes_taken": len(attempts),
        "viva_average": round(sum(viva_scores) / len(viva_scores), 1) if viva_scores else None,
        "vivas_completed": len(viva_scores),
        "flashcards_due": due,
        "weak_topics": weak,
        "strong_topics": strong,
        "topics": sorted(topics, key=lambda t: t["topic"].lower()),
        "recent_attempts": recent_attempts,
        "recent_chats": [{"id": c.id, "title": c.title, "mode": c.mode, "updated_at": c.updated_at.isoformat()} for c in chats],
        "recent_bookmarks": [{"id": b.id, "title": b.title, "kind": b.kind, "conversation_id": b.conversation_id} for b in marks],
        "documents_available": db.query(func.count(Document.id)).filter(Document.status == "ready").scalar() or 0,
        "generated_at": datetime.utcnow().isoformat(),
    }
