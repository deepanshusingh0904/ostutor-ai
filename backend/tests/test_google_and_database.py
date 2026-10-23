from app.core.config import normalize_database_url


def test_database_urls_from_hosts_are_made_sqlalchemy_ready():
    assert normalize_database_url("postgres://u:p@h/db").startswith("postgresql+psycopg2://u:p@h/db")
    assert normalize_database_url("postgresql://u:p@h/db?sslmode=require") == "postgresql+psycopg2://u:p@h/db?sslmode=require"
    assert normalize_database_url("sqlite:///x.db") == "sqlite:///x.db"


def test_local_chroma_is_used_without_a_cloud_key(client):
    from app.rag.vectorstore import VectorStore

    assert VectorStore().backend == "local"




# ---------- Google sign-in ----------
def test_google_sign_in_is_off_by_default(client):
    assert client.get("/api/auth/config").json() == {"google_client_id": ""}
    assert client.post("/api/auth/google", json={"credential": "x" * 30}).status_code == 404


def test_google_sign_in_creates_and_reuses_accounts(client, monkeypatch):
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router.settings, "google_client_id", "client-id.apps.googleusercontent.com")
    monkeypatch.setattr(auth_router, "verify_google_credential",
                        lambda credential: {"email": "New.Student@Example.com", "email_verified": True, "name": "New Student"})
    assert client.get("/api/auth/config").json()["google_client_id"].startswith("client-id")
    first = client.post("/api/auth/google", json={"credential": "g" * 30})
    assert first.status_code == 200, first.text
    assert first.json()["user"]["email"] == "new.student@example.com" and first.json()["user"]["role"] == "student"
    second = client.post("/api/auth/google", json={"credential": "g" * 30})
    assert second.json()["user"]["id"] == first.json()["user"]["id"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {first.json()['access_token']}"})
    assert me.status_code == 200


def test_google_sign_in_rejects_bad_tokens(client, monkeypatch):
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router.settings, "google_client_id", "client-id")

    def invalid(credential):
        raise ValueError("bad token")

    monkeypatch.setattr(auth_router, "verify_google_credential", invalid)
    assert client.post("/api/auth/google", json={"credential": "g" * 30}).status_code == 401
    monkeypatch.setattr(auth_router, "verify_google_credential", lambda c: {"email": "x@example.com", "email_verified": False})
    assert client.post("/api/auth/google", json={"credential": "g" * 30}).status_code == 401



def test_bundled_course_docs_are_indexed_once_and_healed(client, admin_headers, tmp_path, monkeypatch):
    from app.core.config import get_settings
    from app.core.database import SessionLocal
    from app.models import Document
    from app.rag.vectorstore import get_vector_store
    from app.services import bootstrap

    folder = tmp_path / "course_docs"
    folder.mkdir()
    (folder / "Deadlock-Notes.md").write_text(
        "# Deadlock\n\nA deadlock is a situation where a set of processes are blocked because each process holds a "
        "resource and waits for another resource held by a different process. The four necessary conditions are "
        "mutual exclusion, hold and wait, no preemption and circular wait.\n", encoding="utf-8")
    settings = get_settings()
    monkeypatch.setattr(settings, "course_docs_dir", folder)
    monkeypatch.setattr(settings, "auto_ingest_course_docs", True)

    assert bootstrap.seed_course_docs() == 1
    assert bootstrap.seed_course_docs() == 0  # second start-up changes nothing
    with SessionLocal() as db:
        docs = db.query(Document).filter(Document.filename == "Deadlock-Notes.md").all()
        assert len(docs) == 1 and docs[0].status == "ready" and docs[0].chunk_count >= 1
        doc_id = docs[0].id

    store = get_vector_store()
    store.delete_document(doc_id)  # simulate a wiped vector store with a surviving database
    assert not store.has_document(doc_id)
    assert bootstrap.heal_index() >= 1
    assert store.has_document(doc_id)

    r = client.delete(f"/api/documents/{doc_id}", headers=admin_headers)
