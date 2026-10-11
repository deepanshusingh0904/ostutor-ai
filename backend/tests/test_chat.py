import json


def read_stream(response):
    events = []
    for line in response.iter_lines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


def send(client, headers, cid, **body):
    with client.stream("POST", f"/api/chat/conversations/{cid}/stream", headers=headers, json=body) as r:
        assert r.status_code == 200
        return read_stream(r)


def test_conversation_crud(client, student_headers):
    conv = client.post("/api/chat/conversations", headers=student_headers, json={"mode": "chat"}).json()
    renamed = client.patch(f"/api/chat/conversations/{conv['id']}", headers=student_headers, json={"title": "Renamed", "pinned": True}).json()
    assert renamed["title"] == "Renamed" and renamed["pinned"]
    assert any(c["id"] == conv["id"] for c in client.get("/api/chat/conversations?q=Renam", headers=student_headers).json())
    assert client.delete(f"/api/chat/conversations/{conv['id']}", headers=student_headers).status_code == 204
    assert client.get(f"/api/chat/conversations/{conv['id']}", headers=student_headers).status_code == 404


def test_conversations_are_private(client, student_headers, admin_headers):
    conv = client.post("/api/chat/conversations", headers=student_headers, json={"mode": "chat"}).json()
    assert client.get(f"/api/chat/conversations/{conv['id']}", headers=admin_headers).status_code == 404


def test_chat_answer_has_citations(client, student_headers, indexed_document):
    conv = client.post("/api/chat/conversations", headers=student_headers, json={"mode": "chat"}).json()
    events = send(client, student_headers, conv["id"], action="send", content="What is a context switch?")
    kinds = [e["type"] for e in events]
    assert kinds[0] == "meta" and "citations" in kinds and kinds[-1] == "done"
    citations = next(e for e in events if e["type"] == "citations")["citations"]
    assert citations and {"document_name", "page", "text", "score"} <= set(citations[0])
    text = "".join(e["content"] for e in events if e["type"] == "token")
    assert "context switch" in text.lower()
    detail = client.get(f"/api/chat/conversations/{conv['id']}", headers=student_headers).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant"]
    assert detail["title"].startswith("What is a context switch")


def test_regenerate_edit_continue(client, student_headers, indexed_document):
    conv = client.post("/api/chat/conversations", headers=student_headers, json={"mode": "chat"}).json()
    cid = conv["id"]
    send(client, student_headers, cid, action="send", content="Explain round robin scheduling")
    send(client, student_headers, cid, action="regenerate")
    msgs = client.get(f"/api/chat/conversations/{cid}", headers=student_headers).json()["messages"]
    assert len(msgs) == 2
    before = msgs[1]["content"]
    send(client, student_headers, cid, action="continue")
    after = client.get(f"/api/chat/conversations/{cid}", headers=student_headers).json()["messages"][1]["content"]
    assert len(after) > len(before)
    send(client, student_headers, cid, action="edit", message_id=msgs[0]["id"], content="Explain priority scheduling and starvation")
    msgs = client.get(f"/api/chat/conversations/{cid}", headers=student_headers).json()["messages"]
    assert len(msgs) == 2 and "priority" in msgs[0]["content"]


def test_out_of_scope_question_is_not_hallucinated(client, student_headers, indexed_document):
    conv = client.post("/api/chat/conversations", headers=student_headers, json={"mode": "chat"}).json()
    events = send(client, student_headers, conv["id"], action="send", content="zxqv plorbnax wibble")
    text = "".join(e["content"] for e in events if e["type"] == "token")
    assert "couldn't find" in text.lower()


def test_professor_teaches_progressively(client, student_headers, indexed_document):
    conv = client.post("/api/chat/conversations", headers=student_headers, json={"mode": "professor"}).json()
    cid = conv["id"]
    first = "".join(e.get("content", "") for e in send(client, student_headers, cid, action="send", content="Teach me about deadlock") if e["type"] == "token")
    assert "Definition" in first and "Your turn" in first and "Analogy" not in first
    second = "".join(e.get("content", "") for e in send(
        client, student_headers, cid, action="send",
        content="A deadlock is when processes wait forever for resources held by each other") if e["type"] == "token")
    assert "Feedback" in second and "Detailed explanation" in second
    third = "".join(e.get("content", "") for e in send(client, student_headers, cid, action="send", content="Okay, the example makes sense, a circular wait") if e["type"] == "token")
    assert "```mermaid" in third


def test_stop_keeps_partial_reply(client, student_headers, indexed_document):
    """Closing the stream early (the Stop button) must still save what was generated so far."""
    conv = client.post("/api/chat/conversations", headers=student_headers, json={"mode": "chat"}).json()
    seen = []
    with client.stream("POST", f"/api/chat/conversations/{conv['id']}/stream", headers=student_headers,
                       json={"action": "send", "content": "Explain thrashing and the working set"}) as r:
        for line in r.iter_lines():
            if line.startswith("data: "):
                event = json.loads(line[6:])
                seen.append(event["type"])
                if event["type"] == "token":
                    break  # client disconnects mid-answer
    msgs = client.get(f"/api/chat/conversations/{conv['id']}", headers=student_headers).json()["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[1]["content"].strip()
