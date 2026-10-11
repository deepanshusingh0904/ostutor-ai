import os
import shutil
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="ostutor-tests-"))
os.environ.update(
    DATABASE_URL=f"sqlite:///{_TMP / 'test.db'}",
    UPLOAD_DIR=str(_TMP / "uploads"),
    CHROMA_DIR=str(_TMP / "chroma"),
    EMBEDDING_BACKEND="hash",
    LLM_API_KEY="",
    OFFLINE_STREAM_DELAY="0",
    RATE_LIMIT_PER_MINUTE="0",
    ADMIN_EMAIL="admin@ostutor.ai",
    ADMIN_PASSWORD="AdminPass123!",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

SAMPLE = Path(__file__).resolve().parents[1] / "sample_docs" / "operating_systems_basics.md"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
    shutil.rmtree(_TMP, ignore_errors=True)


@pytest.fixture(scope="session")
def admin_headers(client):
    r = client.post("/api/auth/login", json={"email": "admin@ostutor.ai", "password": "AdminPass123!"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def student_headers(client):
    r = client.post("/api/auth/register", json={"email": "student@example.com", "password": "StudentPass1", "full_name": "Test Student"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def indexed_document(client, admin_headers):
    with SAMPLE.open("rb") as f:
        r = client.post("/api/documents", headers=admin_headers, files={"file": (SAMPLE.name, f, "text/markdown")},
                        data={"title": "Operating Systems Basics", "subject": "OS"})
    assert r.status_code == 201, r.text
    doc = client.get(f"/api/documents/{r.json()['id']}", headers=admin_headers).json()
    assert doc["status"] == "ready", doc
    return doc
