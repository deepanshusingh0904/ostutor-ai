"""Chat orchestration: retrieval, prompt building, streaming (LLM or offline) and persistence."""
from __future__ import annotations

import logging
import time
from collections.abc import Iterator

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Conversation, Document, Message, User, utcnow
from app.rag.retriever import RetrievedChunk, format_context, retrieve
from app.schemas import StreamRequest
from app.services import offline, progress, prompts
from app.services.generation import citations_for
from app.services.llm import get_llm
from app.services.textutils import extract_topic

logger = logging.getLogger("ostutor.chat")
HISTORY_LIMIT = 12


class ChatError(ValueError):
    pass


def _last(messages: list[Message], role: str) -> Message | None:
    return next((m for m in reversed(messages) if m.role == role), None)


def lesson_turn(messages: list[Message]) -> tuple[int, bool, str]:
    """Return (turn index within the current topic, latest message answers a check question, topic query)."""
    turn, answered, topic = 0, False, ""
    previous_assistant: str | None = None
    for m in messages:
        if m.role == "user":
            answered = offline.is_answer_to_check(previous_assistant, m.content)
            if not answered:
                turn, topic = 0, m.content.strip()
        else:
            turn += 1
            previous_assistant = m.content
            continue
        previous_assistant = previous_assistant if answered else None
    return turn, answered, topic


def _turn_plan(turn: int) -> str:
    if turn >= len(prompts.STAGE_GROUPS):
        return ("The full lesson is complete. Answer follow-up questions briefly, then recommend the next topic or "
                "offer a quiz or viva.")
    stages = ", ".join(prompts.STAGE_GROUPS[turn])
    return f"Teach these stages now: {stages}. Earlier turns already covered the preceding stages."


def build_system_prompt(conv: Conversation, user: User, chunks: list[RetrievedChunk], turn: int) -> str:
    style = prompts.STYLE_NOTES.get((user.settings or {}).get("professor_style", "balanced"), prompts.STYLE_NOTES["balanced"])
    context = format_context(chunks) if chunks else prompts.NO_CONTEXT_NOTE
    if conv.mode == "professor":
        return prompts.PROFESSOR_SYSTEM.format(
            style=style, visual_guide=prompts.VISUAL_GUIDE, turn_plan=_turn_plan(turn), context=context)
    return prompts.CHAT_SYSTEM.format(style=style, visual_guide=prompts.VISUAL_GUIDE, context=context)


def _sse(event: dict) -> dict:
    return event


def _offline_stream(text: str) -> Iterator[str]:
    delay = get_settings().offline_stream_delay
    parts = text.split(" ")
    for i in range(0, len(parts), 3):
        piece = " ".join(parts[i : i + 3])
        yield piece + (" " if i + 3 < len(parts) else "")
        if delay:
            time.sleep(delay)


def _prepare(db: Session, conv: Conversation, req: StreamRequest) -> Message:
    """Apply the requested action to the stored history. Returns the target message (assistant for continue)."""
    messages = list(conv.messages)
    if req.action == "send":
        if not req.content or not req.content.strip():
            raise ChatError("Message cannot be empty")
        msg = Message(conversation_id=conv.id, role="user", content=req.content.strip())
        db.add(msg)
        if conv.title == "New conversation":
            conv.title = req.content.strip().replace("\n", " ")[:60]
        db.commit()
        return msg
    if req.action == "edit":
        target = next((m for m in messages if m.id == req.message_id and m.role == "user"), None)
        if target is None or not req.content or not req.content.strip():
            raise ChatError("Choose one of your messages and provide new text")
        for m in messages:
            if m.id > target.id:
                db.delete(m)
        target.content = req.content.strip()
        db.commit()
        return target
    if req.action == "regenerate":
        last_user = _last(messages, "user")
        if last_user is None:
            raise ChatError("Nothing to regenerate")
        for m in messages:
            if m.id > last_user.id:
                db.delete(m)
        db.commit()
        return last_user
    if req.action == "continue":
        last = messages[-1] if messages else None
        if last is None or last.role != "assistant":
            raise ChatError("There is no reply to continue")
        return last
    raise ChatError("Unknown action")


def stream_reply(db: Session, user: User, conv: Conversation, req: StreamRequest) -> Iterator[dict]:
    try:
        target = _prepare(db, conv, req)
    except ChatError as exc:
        yield {"type": "error", "message": str(exc)}
        return
    db.refresh(conv)
    messages = list(conv.messages)
    continuing = req.action == "continue"
    turn, answered, topic_query = lesson_turn([m for m in messages if continuing is False or m.id <= target.id])
    last_user = _last(messages, "user")
    assert last_user is not None
    user_text = last_user.content

    if conv.mode == "professor":
        if topic_query and (not answered or not conv.topic):
            conv.topic = extract_topic(topic_query)[:200]
        retrieval_query = f"{conv.topic} {user_text}" if answered else user_text
        topic = conv.topic or user_text
    else:
        retrieval_query, topic = user_text, user_text
    if continuing:
        retrieval_query = f"{conv.topic or user_text}"

    try:
        chunks = retrieve(retrieval_query)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Retrieval failed")
        yield {"type": "error", "message": f"Retrieval failed: {exc}"}
        return
    citations = citations_for(chunks)
    yield {"type": "meta", "conversation_id": conv.id, "user_message_id": last_user.id, "title": conv.title}
    yield {"type": "citations", "citations": citations}

    produced: list[str] = []
    saved: dict = {"done": False}

    def persist() -> Message:
        saved["done"] = True
        full = "".join(produced)
        if continuing:
            target.content = target.content.rstrip() + ("\n\n" if not full.startswith(("\n", " ")) else "") + full
            target.citations = target.citations or citations
            assistant = target
        else:
            assistant = Message(conversation_id=conv.id, role="assistant", content=full, citations=citations)
            db.add(assistant)
        conv.updated_at = utcnow()
        db.commit()
        db.refresh(assistant)
        if conv.mode == "professor" or topic:
            progress.touch_topic(db, user.id, (conv.topic or topic)[:80])
        saved["msg"] = assistant
        return assistant

    try:
        llm = get_llm()
        used_llm = False
        if llm.configured:
            system = build_system_prompt(conv, user, chunks, turn)
            chat = [{"role": "system", "content": system}]
            for m in messages[-HISTORY_LIMIT:]:
                chat.append({"role": m.role, "content": m.content})
            if continuing:
                chat.append({"role": "user", "content": "Continue exactly where you stopped. Do not repeat earlier text."})
            try:
                for token in llm.stream(chat):
                    used_llm = True
                    produced.append(token)
                    yield {"type": "token", "content": token}
            except Exception as exc:  # noqa: BLE001
                logger.warning("LLM stream failed: %s", exc)
                if used_llm:
                    note = "\n\n_(The connection was interrupted. Use Continue to resume.)_"
                    produced.append(note)
                    yield {"type": "token", "content": note}
        if not used_llm:
            text = _offline_text(db, conv, topic, user_text, chunks, turn, answered, messages, continuing)
            for token in _offline_stream(text):
                produced.append(token)
                yield {"type": "token", "content": token}

    finally:
        # Runs on normal completion AND when the client presses Stop (generator closed), so partial replies are kept.
        if not saved["done"] and produced:
            persist()

    assistant = saved.get("msg") or persist()
    yield {"type": "done", "message_id": assistant.id, "content": assistant.content, "title": conv.title}


def _offline_text(db: Session, conv: Conversation, topic: str, user_text: str, chunks: list[RetrievedChunk],
                  turn: int, answered: bool, messages: list[Message], continuing: bool) -> str:
    if not chunks:
        docs = [d.title for d in db.query(Document).filter(Document.status == "ready").limit(5).all()]
        return offline.no_context_message(topic, docs)
    if continuing:
        last_ai = next((m for m in reversed(messages) if m.role == "assistant"), None)
        done_blocks = (last_ai.content or "").count("### Going deeper") if last_ai else 0
        start = 4 + done_blocks * 5
        pool = offline.fact_pool(conv.topic or user_text, chunks, 60)[start:start + 5]
        if not pool:
            return "That covers everything the approved material says about this. Ask me a follow-up or try a quiz!"
        bullets = "\n".join(f"- {p['sentence']} [{p['idx']}]" for p in pool)
        return f"### Going deeper\n{bullets}"
    if conv.mode == "professor":
        if turn >= len(prompts.STAGE_GROUPS):
            return ("We've covered the whole lesson - well done! You can test yourself with a **Quiz** or a **Viva**, "
                    "or tell me the next topic you'd like to learn.")
        feedback = offline.evaluate_previous(turn - 1, conv.topic or topic, user_text, chunks) if answered and turn > 0 else None
        return offline.professor_reply(conv.topic or topic, chunks, turn, feedback)
    return offline.chat_answer(user_text, chunks)
