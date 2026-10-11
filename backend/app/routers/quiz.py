from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Quiz, QuizAttempt, User
from app.schemas import QuizAttemptOut, QuizGenerateRequest, QuizOut, QuizSubmit, QuizSummary
from app.services import progress
from app.services.generation import NoContextError, generate_quiz_questions, grade_answer, public_question

router = APIRouter(prefix="/api/quizzes", tags=["quiz"])


def _public(quiz: Quiz) -> QuizOut:
    return QuizOut(id=quiz.id, topic=quiz.topic, difficulty=quiz.difficulty,
                   questions=[public_question(q) for q in quiz.questions], created_at=quiz.created_at)


def _owned(db: Session, quiz_id: int, user: User) -> Quiz:
    quiz = db.get(Quiz, quiz_id)
    if quiz is None or quiz.user_id != user.id:
        raise HTTPException(404, "Quiz not found")
    return quiz


@router.post("", response_model=QuizOut, status_code=status.HTTP_201_CREATED)
def generate(payload: QuizGenerateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        questions, _ = generate_quiz_questions(payload.topic.strip(), payload.difficulty, list(payload.types), payload.count)
    except NoContextError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    if not questions:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Not enough approved material to build a quiz on this topic.")
    quiz = Quiz(user_id=user.id, topic=payload.topic.strip(), difficulty=payload.difficulty, questions=questions)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return _public(quiz)


@router.get("", response_model=list[QuizSummary])
def list_quizzes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quizzes = db.query(Quiz).filter(Quiz.user_id == user.id).order_by(Quiz.id.desc()).limit(50).all()
    out = []
    for q in quizzes:
        pcts = [100 * a.score / a.total for a in q.attempts if a.total]
        out.append(QuizSummary(id=q.id, topic=q.topic, difficulty=q.difficulty, created_at=q.created_at,
                               question_count=len(q.questions), best_score=round(max(pcts)) if pcts else None))
    return out


@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _public(_owned(db, quiz_id, user))


@router.post("/{quiz_id}/submit", response_model=QuizAttemptOut)
def submit(quiz_id: int, payload: QuizSubmit, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = _owned(db, quiz_id, user)
    results, score = [], 0.0
    for q in quiz.questions:
        given = payload.answers.get(q["id"], "")
        points, correct = grade_answer(q, given)
        score += points
        results.append({
            "id": q["id"], "type": q["type"], "question": q["question"], "given": given, "correct": correct,
            "points": points, "answer": q["answer"], "explanation": q.get("explanation", ""),
            "options": q.get("options"),
        })
    attempt = QuizAttempt(
        quiz_id=quiz.id, user_id=user.id, answers=payload.answers, results=results, score=round(score, 2),
        total=len(quiz.questions), duration_seconds=payload.duration_seconds,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    progress.record_topic_result(db, user.id, quiz.topic, attempt.score, attempt.total)
    if payload.duration_seconds:
        progress.add_study_time(db, user.id, min(payload.duration_seconds, 3600))
    return attempt


@router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptOut])
def attempts(quiz_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = _owned(db, quiz_id, user)
    return sorted(quiz.attempts, key=lambda a: a.id, reverse=True)


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, quiz_id, user))
    db.commit()
