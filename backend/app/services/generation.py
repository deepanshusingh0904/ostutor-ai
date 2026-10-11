"""LLM-or-offline generators for quizzes, flashcards, study guides, viva and visuals."""
from __future__ import annotations

import logging
import random
import re
from typing import Any

from app.rag.retriever import RetrievedChunk, format_context, retrieve
from app.services import offline, prompts, visuals
from app.services.llm import get_llm
from app.services.textutils import keywords

logger = logging.getLogger("ostutor.generation")
VALID_TYPES = {"mcq", "true_false", "fill_blank", "coding", "numerical"}


class NoContextError(RuntimeError):
    """Raised when no approved material matches the topic."""


def get_chunks(topic: str, top_k: int = 8) -> list[RetrievedChunk]:
    chunks = retrieve(topic, top_k=top_k)
    if not chunks:
        raise NoContextError(
            f"No faculty-approved material matches '{topic}'. Try different wording or ask your instructor to upload notes."
        )
    return chunks


def citations_for(chunks: list[RetrievedChunk]) -> list[dict]:
    return [
        {"index": c.index, "document_id": c.document_id, "document_name": c.document_name, "page": c.page,
         "text": c.text[:700], "score": c.score}
        for c in chunks
    ]


# ---------------------------------------------------------------- quiz
def _normalise_question(raw: dict[str, Any]) -> dict | None:
    qtype = str(raw.get("type", "")).lower().replace("-", "_").replace(" ", "_")
    if qtype not in VALID_TYPES or not raw.get("question") or raw.get("answer") in (None, ""):
        return None
    q: dict[str, Any] = {"type": qtype, "question": str(raw["question"]).strip(), "answer": str(raw["answer"]).strip(),
                         "explanation": str(raw.get("explanation", "")).strip(), "source": str(raw.get("source", ""))}
    if qtype == "mcq":
        options = [str(o).strip() for o in raw.get("options", []) if str(o).strip()]
        if len(options) < 2:
            return None
        match = next((o for o in options if o.lower() == q["answer"].lower()), None)
        if match is None and re.fullmatch(r"[A-Da-d]", q["answer"]):
            idx = ord(q["answer"].upper()) - 65
            match = options[idx] if idx < len(options) else None
        if match is None:
            return None
        q["options"], q["answer"] = options, match
    elif qtype == "true_false":
        q["answer"] = "True" if q["answer"].lower().startswith("t") else "False"
    elif qtype == "numerical":
        try:
            float(q["answer"])
        except ValueError:
            return None
        q["tolerance"] = float(raw.get("tolerance", 0.01) or 0.01)
    elif qtype == "coding":
        q["keywords"] = [str(k).lower() for k in raw.get("keywords", [])] or keywords(q["answer"], 5)
    return q


def generate_quiz_questions(topic: str, difficulty: str, types: list[str], count: int) -> tuple[list[dict], list[dict]]:
    only_numerical = set(types) == {"numerical"}
    try:
        chunks = get_chunks(topic)
    except NoContextError:
        if not only_numerical:
            raise
        chunks = []
    questions: list[dict] = []
    llm = get_llm()
    if llm.configured and chunks:
        try:
            data = llm.complete_json([
                {"role": "system", "content": prompts.QUIZ_PROMPT.format(
                    difficulty=difficulty, topic=topic, count=count, types=", ".join(types),
                    context=format_context(chunks))},
                {"role": "user", "content": "Generate the quiz now."},
            ])
            raw = data.get("questions", data) if isinstance(data, dict) else data
            questions = [q for q in (_normalise_question(r) for r in raw if isinstance(r, dict)) if q][:count]
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM quiz generation failed, using offline engine: %s", exc)
    if len(questions) < min(count, 3):
        questions = offline.make_quiz(topic, chunks, difficulty, types, count, random.Random())
    for i, q in enumerate(questions, 1):
        q["id"] = f"q{i}"
        q["topic"] = topic
        q["difficulty"] = difficulty
    return questions, citations_for(chunks)


def public_question(q: dict) -> dict:
    hidden = {"answer", "explanation", "keywords", "tolerance"}
    return {k: v for k, v in q.items() if k not in hidden}


def grade_answer(q: dict, given: str | None) -> tuple[float, bool]:
    given = (given or "").strip()
    if not given:
        return 0.0, False
    qtype, answer = q["type"], str(q["answer"])
    if qtype in {"mcq", "true_false"}:
        ok = given.lower() == answer.lower()
        return (1.0 if ok else 0.0), ok
    if qtype == "fill_blank":
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())  # noqa: E731
        ok = norm(given) == norm(answer) or norm(answer) in norm(given) and len(norm(given)) <= len(norm(answer)) + 3
        return (1.0 if ok else 0.0), ok
    if qtype == "numerical":
        nums = re.findall(r"-?\d+(?:\.\d+)?", given.replace(",", ""))
        target, tol = float(answer), max(float(q.get("tolerance", 0.01)), 1e-9)
        ok = any(abs(float(n) - target) <= max(tol, abs(target) * 0.005) for n in nums)
        return (1.0 if ok else 0.0), ok
    if qtype == "coding":
        kws = q.get("keywords") or []
        if not kws:
            return 0.0, False
        text = given.lower()
        coverage = sum(1 for k in kws if k.lower() in text) / len(kws)
        return round(coverage, 2), coverage >= 0.6
    return 0.0, False


# ---------------------------------------------------------------- flashcards
def generate_cards(topic: str, count: int) -> list[dict]:
    chunks = get_chunks(topic, 10)
    llm = get_llm()
    if llm.configured:
        try:
            data = llm.complete_json([
                {"role": "system", "content": prompts.FLASHCARD_PROMPT.format(count=count, topic=topic, context=format_context(chunks))},
                {"role": "user", "content": "Create the flashcards."},
            ])
            raw = data.get("cards", data) if isinstance(data, dict) else data
            cards = [{"front": str(c["front"]), "back": str(c["back"])} for c in raw if isinstance(c, dict) and c.get("front") and c.get("back")]
            if cards:
                return cards[:count]
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM flashcards failed, using offline engine: %s", exc)
    cards = offline.make_flashcards(topic, chunks, count)
    if not cards:
        raise NoContextError("The approved material for this topic is too short to build flashcards.")
    return cards


# ---------------------------------------------------------------- study guides
def generate_guide(topic: str, kind: str) -> tuple[str, list[dict]]:
    chunks = get_chunks(topic, 8)
    llm = get_llm()
    if llm.configured:
        try:
            text = llm.complete([
                {"role": "system", "content": prompts.GUIDE_SYSTEM.format(
                    instruction=prompts.GUIDE_PROMPTS[kind], topic=topic, context=format_context(chunks))},
                {"role": "user", "content": f"Create the {kind.replace('_', ' ')} for {topic}."},
            ], temperature=0.3)
            if text.strip():
                return text.strip(), citations_for(chunks)
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM study guide failed, using offline engine: %s", exc)
    return offline.make_guide(topic, kind, chunks), citations_for(chunks)


# ---------------------------------------------------------------- viva
def next_viva_question(topic: str, difficulty: str, asked: list[str]) -> dict:
    chunks = get_chunks(topic, 8)
    llm = get_llm()
    if llm.configured:
        try:
            data = llm.complete_json([
                {"role": "system", "content": prompts.VIVA_QUESTION_PROMPT.format(
                    topic=topic, difficulty=difficulty, asked=asked or "none", context=format_context(chunks))},
                {"role": "user", "content": "Ask the next question."},
            ])
            if isinstance(data, dict) and data.get("question") and data.get("reference_answer"):
                return {"question": str(data["question"]), "reference_answer": str(data["reference_answer"])}
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM viva question failed, using offline engine: %s", exc)
    return offline.viva_question(topic, chunks, asked, difficulty)


def evaluate_viva(question: str, reference: str, answer: str) -> dict:
    llm = get_llm()
    if llm.configured:
        try:
            data = llm.complete_json([
                {"role": "user", "content": prompts.VIVA_EVAL_PROMPT.format(question=question, reference=reference, answer=answer)}
            ], temperature=0.2)
            if isinstance(data, dict) and "score" in data:
                return {"score": max(0.0, min(10.0, float(data["score"]))), "feedback": str(data.get("feedback", "")),
                        "missing": [str(m) for m in data.get("missing", [])]}
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM viva grading failed, using offline engine: %s", exc)
    return offline.viva_evaluate(question, reference, answer)


def viva_final_report(topic: str, score: float, results: list[dict]) -> str:
    llm = get_llm()
    if llm.configured:
        try:
            brief = [{"question": r["question"], "score": r["score"]} for r in results]
            text = llm.complete([{"role": "user", "content": prompts.VIVA_FINAL_PROMPT.format(score=f"{score:.1f}", topic=topic, results=brief)}])
            if text.strip():
                return text.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM viva report failed, using offline engine: %s", exc)
    return offline.viva_report(topic, score, results)


# ---------------------------------------------------------------- visuals
def generate_visual(topic: str, kind: str) -> tuple[str, str]:
    template_kinds = set(visuals.TEMPLATES)
    try:
        chunks = retrieve(topic, top_k=6)
    except Exception:  # noqa: BLE001
        chunks = []
    contexts = [c.text for c in chunks]
    llm = get_llm()
    if llm.configured and (kind not in template_kinds or chunks):
        try:
            code = llm.complete([
                {"role": "user", "content": prompts.VISUAL_PROMPT.format(
                    kind=kind.replace("_", " "), topic=topic, visual_guide=prompts.VISUAL_GUIDE, context=format_context(chunks))}
            ], temperature=0.2)
            code = re.sub(r"^```(?:mermaid)?\s*|\s*```$", "", code.strip(), flags=re.IGNORECASE).strip()
            if code:
                return f"{kind.replace('_', ' ').title()}: {topic}", code
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM visual failed, using templates: %s", exc)
    return visuals.generate_visual(topic, kind, contexts)
