"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Difficulty = Literal["easy", "medium", "hard"]
QuestionType = Literal["mcq", "true_false", "fill_blank", "coding", "numerical"]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth & users ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    bio: str
    university: str
    settings: dict[str, Any]
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class GoogleLoginRequest(BaseModel):
    credential: str = Field(min_length=20)


class AuthConfig(BaseModel):
    google_client_id: str = ""


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    bio: str | None = Field(default=None, max_length=1000)
    university: str | None = Field(default=None, max_length=160)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class SettingsUpdate(BaseModel):
    theme: Literal["light", "dark", "system"] | None = None
    default_difficulty: Difficulty | None = None
    professor_style: Literal["balanced", "socratic", "concise"] | None = None
    daily_goal_minutes: int | None = Field(default=None, ge=5, le=600)
    stream_responses: bool | None = None
    show_citations: bool | None = None


# ---------- Documents ----------
class DocumentOut(ORMModel):
    id: int
    title: str
    filename: str
    file_type: str
    subject: str
    size_bytes: int
    page_count: int
    chunk_count: int
    status: str
    error: str
    uploaded_by: int | None
    created_at: datetime


class Citation(BaseModel):
    index: int
    document_id: int
    document_name: str
    page: int
    text: str
    score: float


# ---------- Chat ----------
class ConversationCreate(BaseModel):
    mode: Literal["chat", "professor"] = "chat"
    title: str | None = Field(default=None, max_length=200)


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    pinned: bool | None = None


class ConversationOut(ORMModel):
    id: int
    title: str
    mode: str
    topic: str
    pinned: bool
    created_at: datetime
    updated_at: datetime


class MessageOut(ORMModel):
    id: int
    role: str
    content: str
    citations: list[dict[str, Any]]
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class StreamRequest(BaseModel):
    action: Literal["send", "regenerate", "edit", "continue"] = "send"
    content: str | None = Field(default=None, max_length=8000)
    message_id: int | None = None


# ---------- Quiz ----------
class QuizGenerateRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    difficulty: Difficulty = "medium"
    types: list[QuestionType] = Field(default_factory=lambda: ["mcq", "true_false", "fill_blank"])
    count: int = Field(default=6, ge=1, le=20)


class QuizOut(ORMModel):
    id: int
    topic: str
    difficulty: str
    questions: list[dict[str, Any]]
    created_at: datetime


class QuizSummary(ORMModel):
    id: int
    topic: str
    difficulty: str
    created_at: datetime
    question_count: int = 0
    best_score: float | None = None


class QuizSubmit(BaseModel):
    answers: dict[str, str]
    duration_seconds: int = Field(default=0, ge=0, le=86400)


class QuizAttemptOut(ORMModel):
    id: int
    quiz_id: int
    score: float
    total: int
    results: list[dict[str, Any]]
    duration_seconds: int
    created_at: datetime


# ---------- Viva ----------
class VivaStart(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    difficulty: Difficulty = "medium"
    max_questions: int = Field(default=5, ge=2, le=12)


class VivaAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)


class VivaOut(ORMModel):
    id: int
    topic: str
    difficulty: str
    max_questions: int
    status: str
    transcript: list[dict[str, Any]]
    final_score: float | None
    final_feedback: str
    created_at: datetime


# ---------- Flashcards ----------
class DeckGenerate(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    count: int = Field(default=10, ge=3, le=30)


class FlashcardOut(ORMModel):
    id: int
    deck_id: int
    front: str
    back: str
    source: str
    ease: float
    interval_days: int
    repetitions: int
    due_date: date


class DeckOut(ORMModel):
    id: int
    topic: str
    created_at: datetime
    card_count: int = 0
    due_count: int = 0


class ReviewRequest(BaseModel):
    rating: int = Field(ge=0, le=3)  # 0 again, 1 hard, 2 good, 3 easy


# ---------- Bookmarks ----------
class BookmarkCreate(BaseModel):
    kind: Literal["message", "document", "topic", "guide"] = "message"
    title: str = Field(min_length=1, max_length=255)
    content: str = ""
    ref_id: int | None = None
    conversation_id: int | None = None


class BookmarkOut(ORMModel):
    id: int
    kind: str
    title: str
    content: str
    ref_id: int | None
    conversation_id: int | None
    created_at: datetime


# ---------- Study guides & visuals ----------
GuideKind = Literal["summary", "revision_notes", "formula_sheet", "mind_map", "cheat_sheet", "expected_questions"]
VisualKind = Literal[
    "flowchart", "mindmap", "architecture", "sequence", "state", "decision_tree", "concept_map", "er",
    "network", "binary_tree", "heap", "graph", "queue", "stack", "linked_list",
]


class GuideGenerate(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    kind: GuideKind = "summary"


class GuideOut(ORMModel):
    id: int
    topic: str
    kind: str
    content: str
    citations: list[dict[str, Any]]
    created_at: datetime


class VisualRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    kind: VisualKind = "flowchart"


class VisualOut(BaseModel):
    kind: str
    topic: str
    title: str
    mermaid: str


# ---------- Progress ----------
class Heartbeat(BaseModel):
    seconds: int = Field(default=30, ge=1, le=120)


# ---------- Admin ----------
class AdminUserUpdate(BaseModel):
    role: Literal["student", "admin"] | None = None
    is_active: bool | None = None


class RagTestRequest(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    top_k: int = Field(default=5, ge=1, le=20)
