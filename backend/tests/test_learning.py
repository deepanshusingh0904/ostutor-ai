import pytest

from app.routers.flashcards import schedule
from app.models import Flashcard
from app.services import numericals, offline, visuals
from app.services.generation import grade_answer
from app.services.progress import compute_streak
from datetime import date, timedelta


def test_quiz_generate_submit_and_progress(client, student_headers, indexed_document):
    r = client.post("/api/quizzes", headers=student_headers, json={
        "topic": "CPU scheduling", "difficulty": "medium", "types": ["mcq", "true_false", "fill_blank", "numerical", "coding"], "count": 6})
    assert r.status_code == 201, r.text
    quiz = r.json()
    assert len(quiz["questions"]) >= 4
    assert all("answer" not in q for q in quiz["questions"])
    detail = client.get(f"/api/quizzes/{quiz['id']}", headers=student_headers).json()
    assert detail["id"] == quiz["id"]
    sub = client.post(f"/api/quizzes/{quiz['id']}/submit", headers=student_headers, json={"answers": {}, "duration_seconds": 90})
    assert sub.status_code == 200
    assert sub.json()["score"] == 0 and all("answer" in x for x in sub.json()["results"])
    dash = client.get("/api/progress/dashboard", headers=student_headers).json()
    assert dash["quizzes_taken"] >= 1 and dash["quiz_accuracy"] == 0
    assert any(t["topic"].lower() == "cpu scheduling" for t in dash["weak_topics"])


def test_quiz_without_material_is_rejected(client, student_headers, indexed_document):
    r = client.post("/api/quizzes", headers=student_headers, json={"topic": "zxqv plorbnax", "types": ["mcq"], "count": 3})
    assert r.status_code == 422


def test_grading_rules():
    assert grade_answer({"type": "mcq", "answer": "Mutex"}, "mutex") == (1.0, True)
    assert grade_answer({"type": "true_false", "answer": "False"}, "True") == (0.0, False)
    assert grade_answer({"type": "fill_blank", "answer": "starvation"}, " Starvation ")[1]
    assert grade_answer({"type": "numerical", "answer": "5.25", "tolerance": 0.01}, "about 5.25 ms")[1]
    assert not grade_answer({"type": "numerical", "answer": "5.25", "tolerance": 0.01}, "6")[1]
    pts, ok = grade_answer({"type": "coding", "answer": "x", "keywords": ["semaphore", "mutex", "wait", "signal"]}, "use a semaphore and mutex with wait and signal")
    assert ok and pts == 1.0


def test_numerical_generators_are_consistent():
    import random
    for name, gen in numericals.GENERATORS.items():
        n = gen(random.Random(7), "medium")
        float(n.answer)
        assert n.question and n.explanation, name


def test_viva_flow(client, student_headers, indexed_document):
    start = client.post("/api/viva", headers=student_headers, json={"topic": "deadlock", "max_questions": 2})
    assert start.status_code == 201
    viva = start.json()
    assert "reference_answer" not in viva["transcript"][0]
    after = client.post(f"/api/viva/{viva['id']}/answer", headers=student_headers, json={
        "answer": "Deadlock is when processes are blocked, each holding a resource and waiting for another held by a process."}).json()
    assert after["transcript"][0]["score"] > 3 and len(after["transcript"]) == 2
    done = client.post(f"/api/viva/{viva['id']}/answer", headers=student_headers, json={"answer": "no idea"}).json()
    assert done["status"] == "completed" and done["final_score"] is not None and done["final_feedback"]
    assert client.post(f"/api/viva/{viva['id']}/answer", headers=student_headers, json={"answer": "again"}).status_code == 400


def test_flashcards_and_spaced_repetition(client, student_headers, indexed_document):
    deck = client.post("/api/flashcards/decks", headers=student_headers, json={"topic": "memory management paging", "count": 6}).json()
    assert deck["card_count"] >= 3 and deck["due_count"] == deck["card_count"]
    cards = client.get(f"/api/flashcards/decks/{deck['id']}/cards", headers=student_headers).json()
    reviewed = client.post(f"/api/flashcards/cards/{cards[0]['id']}/review", headers=student_headers, json={"rating": 2}).json()
    assert reviewed["interval_days"] == 1 and reviewed["repetitions"] == 1
    due = client.get(f"/api/flashcards/decks/{deck['id']}/cards?due_only=true", headers=student_headers).json()
    assert len(due) == len(cards) - 1


def test_schedule_again_resets():
    card = Flashcard(front="a", back="b", ease=2.5, interval_days=6, repetitions=3, due_date=date.today())
    schedule(card, 0)
    assert card.interval_days == 0 and card.repetitions == 0 and card.ease < 2.5
    schedule(card, 3)
    assert card.due_date >= date.today()


@pytest.mark.parametrize("kind", ["summary", "revision_notes", "formula_sheet", "mind_map", "cheat_sheet", "expected_questions"])
def test_study_guides(client, student_headers, indexed_document, kind):
    r = client.post("/api/study-guides", headers=student_headers, json={"topic": "memory management", "kind": kind})
    assert r.status_code == 201, r.text
    assert len(r.json()["content"]) > 40


def test_visual_generation(client, student_headers):
    for kind in visuals.KINDS:
        r = client.post("/api/visuals", headers=student_headers, json={"topic": "binary tree", "kind": kind})
        assert r.status_code == 200 and r.json()["mermaid"].strip()


def test_bookmarks_and_search(client, student_headers, indexed_document):
    b = client.post("/api/bookmarks", headers=student_headers, json={"kind": "topic", "title": "Banker algorithm", "content": "Safe state check"}).json()
    assert client.get("/api/bookmarks?q=Banker", headers=student_headers).json()[0]["id"] == b["id"]
    found = client.get("/api/search?q=banker", headers=student_headers).json()
    assert found["bookmarks"] and found["passages"]
    assert client.delete(f"/api/bookmarks/{b['id']}", headers=student_headers).status_code == 204


def test_heartbeat_and_streak(client, student_headers):
    assert client.post("/api/progress/heartbeat", headers=student_headers, json={"seconds": 90}).json()["today_seconds"] >= 90
    assert client.get("/api/progress/dashboard", headers=student_headers).json()["streak"] >= 1
    today = date.today()
    assert compute_streak({today, today - timedelta(days=1), today - timedelta(days=3)}, today) == 2
    assert compute_streak({today - timedelta(days=1)}, today) == 1
    assert compute_streak({today - timedelta(days=2)}, today) == 0


def test_offline_professor_covers_all_stages():
    class C:
        def __init__(self, i, t):
            self.index, self.document_name, self.page, self.text, self.score = i, "Doc", 1, t, 0.8
    chunks = [C(1, "A process is a program in execution. A thread is the basic unit of CPU utilization. For example, a browser uses many threads. Threads share memory.")]
    from app.services.prompts import STAGE_GROUPS
    seen = ""
    for i in range(len(STAGE_GROUPS)):
        seen += offline.professor_reply("process", chunks, i)
    for stage in ["Definition", "Analogy", "Flowchart", "Numerical", "Quick quiz", "Interview questions", "Summary", "Recommended next topic"]:
        assert stage in seen


def test_admin_endpoints(client, admin_headers, student_headers, indexed_document):
    stats = client.get("/api/admin/stats", headers=admin_headers).json()
    assert stats["users"] >= 2 and stats["chunks"] > 0 and stats["llm_configured"] is False
    users = client.get("/api/admin/users", headers=admin_headers).json()
    student = next(u for u in users if u["email"] == "student@example.com")
    assert client.patch(f"/api/admin/users/{student['id']}", headers=admin_headers, json={"is_active": False}).json()["is_active"] is False
    assert client.get("/api/auth/me", headers=student_headers).status_code == 401
    client.patch(f"/api/admin/users/{student['id']}", headers=admin_headers, json={"is_active": True})
    admin = next(u for u in users if u["role"] == "admin")
    assert client.patch(f"/api/admin/users/{admin['id']}", headers=admin_headers, json={"role": "student"}).status_code == 400
    rag = client.post("/api/admin/rag/test", headers=admin_headers, json={"query": "page replacement"}).json()
    assert rag["results"]


def test_short_label_and_flowchart_labels_are_clean():
    from app.services.textutils import short_label
    from app.services.visuals import flowchart_from_context

    label = short_label("The buffer is shared, so access to it must be protected.")
    assert label == "The buffer is shared"
    assert not short_label("The producer waits on the empty semaphore and then to").endswith(" to")
    code = flowchart_from_context("Deadlock", [], ranked=["A deadlock is a situation in which processes are blocked forever."])
    assert code.startswith("flowchart TD") and '"' in code
