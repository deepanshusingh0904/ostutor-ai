def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_login_me(client):
    payload = {"email": "new.user@example.com", "password": "Secret1234", "full_name": "New User"}
    r = client.post("/api/auth/register", json=payload)
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "student"
    assert client.post("/api/auth/register", json=payload).status_code == 409
    login = client.post("/api/auth/login", json={"email": payload["email"], "password": payload["password"]})
    token = login.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == payload["email"]


def test_bad_credentials_and_validation(client):
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever1"}).status_code == 401
    assert client.post("/api/auth/register", json={"email": "bad", "password": "x", "full_name": "A"}).status_code == 422
    assert client.get("/api/auth/me").status_code == 401


def test_student_cannot_use_admin_routes(client, student_headers):
    assert client.get("/api/admin/stats", headers=student_headers).status_code == 403
    assert client.post("/api/documents", headers=student_headers, files={"file": ("a.txt", b"hello", "text/plain")}).status_code == 403


def test_profile_and_settings(client, student_headers):
    r = client.put("/api/users/me", headers=student_headers, json={"bio": "Studying systems", "university": "Test University"})
    assert r.json()["bio"] == "Studying systems"
    s = client.put("/api/users/me/settings", headers=student_headers, json={"theme": "dark", "daily_goal_minutes": 45})
    assert s.json()["theme"] == "dark" and s.json()["daily_goal_minutes"] == 45
    bad = client.put("/api/users/me/password", headers=student_headers, json={"current_password": "nope", "new_password": "AnotherPass1"})
    assert bad.status_code == 400


def test_security_headers_and_request_id(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-request-id"]


def test_rate_limit_blocks_bursts():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.middleware import RateLimitMiddleware

    mini = FastAPI()
    mini.add_middleware(RateLimitMiddleware, per_minute=3)

    @mini.get("/ping")
    def ping():
        return {"ok": True}

    c = TestClient(mini)
    codes = [c.get("/ping").status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[3] == 429
