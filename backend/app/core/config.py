"""Application settings loaded from environment variables / .env file."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    app_name: str = "OSTutor AI"
    environment: str = "development"

    # Security
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Storage
    database_url: str = f"sqlite:///{BASE_DIR / 'data' / 'ostutor.db'}"
    upload_dir: Path = BASE_DIR / "data" / "uploads"
    chroma_dir: Path = BASE_DIR / "data" / "chroma"
    max_upload_mb: int = 50

    # Network
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    rate_limit_per_minute: int = 240

    # Seed admin (created on first start if missing)
    admin_email: str = "admin@ostutor.ai"
    admin_password: str = "ChangeMe123!"
    admin_name: str = "Course Administrator"

    # LLM (any OpenAI-compatible endpoint)
    llm_api_key: str = Field(default="", validation_alias=AliasChoices("LLM_API_KEY", "OPENAI_API_KEY"))
    llm_base_url: str = Field(
        default="https://api.openai.com/v1", validation_alias=AliasChoices("LLM_BASE_URL", "OPENAI_BASE_URL")
    )
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.4
    llm_timeout_seconds: int = 90

    # RAG
    embedding_backend: str = "auto"  # auto | sentence-transformers | hash
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_size: int = 900
    chunk_overlap: int = 150
    retrieval_top_k: int = 5
    min_similarity: float = 0.12
    offline_stream_delay: float = 0.012

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    Path(BASE_DIR / "data").mkdir(parents=True, exist_ok=True)
    return settings
