"""Offline teaching engine.

Used automatically when no LLM API key is configured (or when the LLM call fails). Everything it produces is derived
from retrieved, faculty-approved passages, so answers stay grounded and cited.
"""
from __future__ import annotations

import random
import re
import zlib
from typing import Protocol

from app.services import numericals, visuals
from app.services.prompts import STAGE_GROUPS
from app.services.textutils import (
    STOPWORDS, clean_label, content_stems, extract_definitions, keywords, split_sentences, stem, title_case, tokens,
)


class ChunkLike(Protocol):
    index: int
    document_name: str
    page: int
    text: str
    score: float


ANALOGIES: list[tuple[tuple[str, ...], str]] = [
    (("process",), "A process is like a chef cooking one recipe in a kitchen: the recipe is the program, and the chef, "
                   "ingredients and half-finished dish are the running process."),
    (("thread",), "Threads are like several cooks sharing one kitchen and one pantry: they work in parallel, but they "
                  "must coordinate when they reach for the same ingredient."),
    (("deadlock",), "Deadlock is four cars meeting at a crossing, each waiting for the car on its right to move first."),
    (("semaphore", "mutex", "synchron"), "A mutex is a single bathroom key: whoever holds the key is inside, everyone else waits "
                                         "in line. A semaphore is a key ring with several identical keys."),
    (("scheduling", "scheduler"), "The CPU scheduler is a receptionist deciding which waiting visitor the doctor sees next."),
    (("paging", "page", "virtual memory"), "Paging is a library that stores a huge book collection in a warehouse and keeps "
                                           "only the pages you are reading on your desk."),
    (("cache", "tlb"), "A cache is the sticky note on your monitor: quicker than opening the filing cabinet, but small."),
    (("file system", "file"), "A file system is a library catalogue that tells you which shelf holds each book."),
    (("interrupt",), "An interrupt is a doorbell: you pause what you are doing, answer the door, then go back to work."),
    (("kernel", "operating system"), "The operating system is a city's government: it allocates resources, enforces rules "
                                     "and keeps programs from trampling each other."),
    (("stack",), "A stack is a pile of plates: you only add or remove the plate on top."),
    (("queue",), "A queue is a line at a ticket counter: first to arrive is first to be served."),
]

GENERIC_ANALOGY = "Think of {topic} as a well-organised workshop: each part has a clear job, and the whole system only works when the parts cooperate."

CODING_LIBRARY: list[tuple[tuple[str, ...], str, list[str], str]] = [
    (("semaphore", "producer", "consumer", "synchron", "mutex"),
     "Write pseudocode or code for the producer-consumer problem using semaphores.",
     ["semaphore", "empty", "full", "mutex", "wait", "signal"],
     "Use empty (initial N), full (initial 0) and mutex (initial 1). Producer: wait(empty), wait(mutex), add item, "
     "signal(mutex), signal(full). Consumer mirrors it with full and empty."),
    (("fcfs", "scheduling", "scheduler", "cpu"),
     "Write a function that returns the average waiting time of processes under FCFS scheduling given their burst times.",
     ["burst", "waiting", "loop", "sum", "average"],
     "Keep a running clock; each process waits for the sum of the bursts before it; return total waiting / n."),
    (("lru", "page replacement", "cache", "replacement"),
     "Implement an LRU cache with get and put operations.",
     ["capacity", "evict", "get", "put", "order", "dict"],
     "Use an ordered dictionary: move a key to the end on access and evict the first key when capacity is exceeded."),
    (("deadlock",),
     "Write a function that detects a deadlock by finding a cycle in a wait-for graph.",
     ["graph", "visited", "cycle", "dfs", "stack"],
     "Run a depth-first search keeping a recursion stack; reaching a node already on the stack means a cycle (deadlock)."),
    (("stack",),
     "Implement a stack class with push, pop and peek.",
     ["push", "pop", "peek", "list", "empty"],
     "Back it with a list: push appends, pop removes the last element, peek reads it; guard against an empty stack."),
    (("queue",),
     "Implement a queue with enqueue and dequeue.",
     ["enqueue", "dequeue", "front", "rear", "empty"],
     "Use a deque or two indices; enqueue at the rear, dequeue from the front, guard against an empty queue."),
]


# ---------------------------------------------------------------- fact pool
def fact_pool(query: str, chunks: list[ChunkLike], limit: int = 12) -> list[dict]:
    q = content_stems(query)
    pool: list[dict] = []
    order = 0
    for chunk in chunks:
        for sentence in split_sentences(chunk.text):
            s = content_stems(sentence)
            score = len(q & s) + chunk.score * 2 - order * 0.001
            if extract_definitions([sentence]):
                score += 0.6
            pool.append({"sentence": sentence, "idx": chunk.index, "score": score})
            order += 1
    pool.sort(key=lambda p: -p["score"])
    seen: set[str] = set()
    result = []
    for item in pool:
        key = item["sentence"][:70].lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= limit:
            break
    return result


def _cite(item: dict) -> str:
    return f"[{item['idx']}]"


def _topic_label(topic: str) -> str:
    return topic.strip().rstrip("?.! ") or "this topic"


def _analogy(topic: str) -> str:
    lowered = topic.lower()
    for needles, text in ANALOGIES:
        if any(n in lowered for n in needles):
            return text
    return GENERIC_ANALOGY.format(topic=topic)


def _numerical_for(topic: str, difficulty: str = "medium") -> numericals.Numerical:
    return numericals.generate(topic, difficulty, random.Random(zlib.crc32(topic.lower().encode())))


def no_context_message(topic: str, available_docs: list[str]) -> str:
    docs = ", ".join(f"*{d}*" for d in available_docs[:5]) if available_docs else "none yet"
    return (
        f"I couldn't find anything about **{_topic_label(topic)}** in the faculty-approved material, so I won't guess.\n\n"
        f"- Try rephrasing with the terms your lecture notes use.\n"
        f"- Available documents: {docs}.\n"
        "- If a topic is missing, ask your instructor to upload the notes for it."
    )


# ---------------------------------------------------------------- professor
def _stage_markdown(stage: str, topic: str, pool: list[dict], chunks: list[ChunkLike]) -> str:
    label = _topic_label(topic)
    contexts = [c.text for c in chunks]
    top = pool[0] if pool else None
    if stage == "Definition":
        defs = [p for p in pool if extract_definitions([p["sentence"]])]
        item = defs[0] if defs else top
        return f"### Definition\n{item['sentence']} {_cite(item)}" if item else ""
    if stage == "Simple explanation":
        items = pool[1:3] or pool[:1]
        terms = ", ".join(f"**{title_case(k)}**" for k in keywords(" ".join(contexts), 4))
        body = " ".join(f"{p['sentence']} {_cite(p)}" for p in items)
        return f"### Simple explanation\nIn plain words: {body}\n\nKeep these words in mind: {terms}."
    if stage == "Detailed explanation":
        items = pool[2:7] or pool
        bullets = "\n".join(f"- {p['sentence']} {_cite(p)}" for p in items)
        return f"### Detailed explanation\n{bullets}"
    if stage == "Real-life example":
        example = next((p for p in pool if re.search(r"\b(for example|for instance|e\.g\.|such as|consider)\b", p["sentence"], re.I)), None)
        if example:
            return f"### Real-life example\n{example['sentence']} {_cite(example)}"
        return f"### Real-life example\nWhenever you open several apps on your laptop at once, {label} is part of what keeps them running smoothly side by side."
    if stage == "Analogy":
        return f"### Analogy\n{_analogy(topic)}"
    if stage == "Visualization":
        code = visuals.mindmap_from_context(label, [p["sentence"] for p in pool[:8]] or contexts)
        return f"### Visualization\nA concept map of the key ideas:\n```mermaid\n{code}\n```"
    if stage == "Flowchart":
        code = visuals.flowchart_from_context(label, contexts, ranked=[p["sentence"] for p in pool[:5]])
        return f"### Flowchart\n```mermaid\n{code}\n```"
    if stage == "Diagram":
        kind, title, code = visuals.auto_visuals(label, contexts)[0]
        return f"### Diagram: {title}\n```mermaid\n{code}\n```"
    if stage == "Numerical":
        n = _numerical_for(topic)
        return (f"### Numerical\n**Problem.** {n.question}\n\nTry it yourself first. Worked solution for checking afterwards:\n\n"
                f"> {n.explanation}")
    if stage == "Quiz":
        qs = make_quiz(topic, chunks, "easy", ["mcq", "true_false"], 2, random.Random(zlib.crc32(topic.encode())))
        lines = []
        for i, q in enumerate(qs, 1):
            opts = "".join(f"\n   - {chr(65 + j)}. {o}" for j, o in enumerate(q.get("options", [])))
            lines.append(f"{i}. {q['question']}{opts}")
        return "### Quick quiz\n" + "\n".join(lines)
    if stage == "Interview questions":
        return (f"### Interview questions\n1. Explain {label} to a teammate in under a minute.\n"
                f"2. What are the trade-offs or limitations of {label}?\n3. Describe a situation where getting {label} wrong causes a bug.")
    if stage == "Summary":
        bullets = "\n".join(f"- {p['sentence']} {_cite(p)}" for p in pool[:4])
        return f"### Summary\n{bullets}"
    if stage == "Recommended next topic":
        terms = [t for t in keywords(" ".join(contexts), 10) if t not in label.lower()]
        nxt = title_case(terms[0]) if terms else "a related topic"
        return f"### Recommended next topic\nI suggest **{nxt}** next - it builds directly on what you just learned."
    return ""


def check_question(group_index: int, topic: str) -> str:
    label = _topic_label(topic)
    questions = [
        f"Before we go on: in your own words, what is {label}, and why does it matter?",
        f"Can you think of one example of your own where {label} shows up?",
        f"Looking at the flowchart, which step seems least clear to you, and why?",
        "Give the numerical a go - what answer do you get?",
        "Can you answer the quiz questions above, then pick one interview question and answer it briefly?",
        f"Would you like to move to the next topic, or should I run a quiz or viva on {label} first?",
    ]
    return questions[min(group_index, len(questions) - 1)]


def evaluate_previous(group_index: int, topic: str, answer: str, chunks: list[ChunkLike]) -> str:
    """Brief feedback on the student's reply to the previous check question."""
    if group_index == 3:  # numerical turn
        expected = _numerical_for(topic).answer
        numbers = re.findall(r"-?\d+(?:\.\d+)?", answer)
        try:
            ok = any(abs(float(n) - float(expected)) <= max(0.02, 0.01 * abs(float(expected))) for n in numbers)
        except ValueError:
            ok = False
        if ok:
            return f"**Feedback:** Correct - {expected} is the right answer. Nicely done."
        return f"**Feedback:** Not quite. The expected answer is {expected}; compare your steps with the worked solution above."
    pool = fact_pool(topic, chunks, 6)
    key_terms = {w for p in pool[:3] for w in keywords(p["sentence"], 6)}
    answer_stems = content_stems(answer)
    hits = [w for w in key_terms if stem(w) in answer_stems]
    coverage = len(hits) / max(1, len(key_terms))
    if len(answer.split()) < 4:
        return "**Feedback:** That's a very short reply - try a full sentence so I can see your reasoning."
    if coverage >= 0.35:
        return f"**Feedback:** Good - you captured key ideas ({', '.join(hits[:4])})."
    missing = ", ".join(sorted(key_terms)[:4])
    return f"**Feedback:** You're on the right track, but the material also stresses: {missing}. Let's build on that."


def is_answer_to_check(previous_assistant: str | None, user_message: str) -> bool:
    if not previous_assistant or "?" not in previous_assistant.strip()[-300:]:
        return False
    text = user_message.strip()
    if len(text.split()) > 60:
        return False
    return not re.match(r"^(what|explain|teach|define|how|why|tell me|describe|can you teach)\b", text, re.I)


def professor_reply(topic: str, chunks: list[ChunkLike], group_index: int, feedback: str | None = None) -> str:
    group_index = min(group_index, len(STAGE_GROUPS) - 1)
    pool = fact_pool(topic, chunks)
    parts = []
    if feedback:
        parts.append(feedback)
    elif group_index == 0:
        parts.append(f"Let's learn **{_topic_label(topic)}** together, step by step.")
    for stage in STAGE_GROUPS[group_index]:
        block = _stage_markdown(stage, topic, pool, chunks)
        if block:
            parts.append(block)
    parts.append(f"---\n**Your turn:** {check_question(group_index, topic)}")
    return "\n\n".join(parts)


# ---------------------------------------------------------------- chat
def chat_answer(query: str, chunks: list[ChunkLike]) -> str:
    pool = fact_pool(query, chunks, 6)
    if not pool:
        return no_context_message(query, [])
    lead = pool[0]
    lines = [f"Here is what the approved course material says about **{_topic_label(query)}**:", "", f"{lead['sentence']} {_cite(lead)}", ""]
    if len(pool) > 1:
        lines.append("**Key points**")
        lines.extend(f"- {p['sentence']} {_cite(p)}" for p in pool[1:5])
    if re.search(r"\b(diagram|flowchart|visuali[sz]e|draw|mind ?map|illustrate)\b", query, re.I):
        _, title, code = visuals.auto_visuals(_topic_label(query), [c.text for c in chunks])[0]
        lines += ["", f"**{title}**", "```mermaid", code, "```"]
    lines += ["", "_Want me to teach this step by step? Switch to **AI Professor** mode._"]
    return "\n".join(lines)


def definitions_for(topic: str, chunks: list[ChunkLike]) -> list[tuple[str, str]]:
    """Definitions ordered by relevance to the topic."""
    q = content_stems(topic)
    defs = extract_definitions([c.text for c in chunks])
    return sorted(defs, key=lambda d: -(2 * len(q & content_stems(d[0])) + len(q & content_stems(d[1]))))


# ---------------------------------------------------------------- quiz
def _target_word(sentence: str, exclude: set[str]) -> str | None:
    candidates = [t for t in re.findall(r"[A-Za-z][A-Za-z\-]{5,}", sentence) if t.lower() not in STOPWORDS and t.lower() not in exclude]
    return max(candidates, key=len) if candidates else None


def make_quiz(topic: str, chunks: list[ChunkLike], difficulty: str, types: list[str], count: int,
              rng: random.Random | None = None) -> list[dict]:
    rng = rng or random.Random()
    pool = fact_pool(topic, chunks, 40)
    exclude = set(tokens(topic))
    if difficulty == "easy":
        pool.sort(key=lambda p: len(p["sentence"]))
    elif difficulty == "hard":
        pool.sort(key=lambda p: -len(p["sentence"]))
    prepared = []
    for p in pool:
        word = _target_word(p["sentence"], exclude)
        if word and 40 <= len(p["sentence"]) <= 320:
            prepared.append({**p, "word": word})
    distractor_words = list({p["word"].lower(): p["word"] for p in prepared}.values())
    questions: list[dict] = []
    used: set[int] = set()
    type_cycle = types or ["mcq"]
    attempts = 0
    while len(questions) < count and attempts < count * 6:
        attempts += 1
        qtype = type_cycle[len(questions) % len(type_cycle)]
        if qtype == "numerical":
            n = numericals.generate(topic, difficulty, rng)
            questions.append({"type": "numerical", "question": n.question, "answer": n.answer, "tolerance": n.tolerance,
                              "explanation": n.explanation, "source": "Generated numerical"})
            continue
        if qtype == "coding":
            lowered = topic.lower()
            match = next((c for c in CODING_LIBRARY if any(k in lowered for k in c[0])), None)
            if match:
                _, q, kws, ref = match
            else:
                kws = keywords(" ".join(c.text for c in chunks), 5)
                q = f"Write a short program or pseudocode that demonstrates the main idea of {_topic_label(topic)}."
                ref = f"A good answer should mention: {', '.join(kws)}."
            if any(x["question"] == q for x in questions):
                type_cycle = [t for t in type_cycle if t != "coding"] or ["mcq"]
                continue
            questions.append({"type": "coding", "question": q, "answer": ref, "keywords": kws, "explanation": ref,
                              "source": "Course material"})
            continue
        candidates = [i for i in range(len(prepared)) if i not in used]
        if not candidates:
            break
        i = candidates[0]
        used.add(i)
        item = prepared[i]
        sentence, word = item["sentence"], item["word"]
        blanked = re.sub(re.escape(word), "____", sentence, count=1, flags=re.IGNORECASE)
        source = f"[{item['idx']}]"
        others = [w for w in distractor_words if w.lower() != word.lower()]
        rng.shuffle(others)
        if qtype == "fill_blank":
            questions.append({"type": "fill_blank", "question": f"Fill in the blank: {blanked}", "answer": word,
                              "explanation": sentence, "source": source})
        elif qtype == "true_false":
            if others and len(questions) % 2 == 1:
                false_sentence = re.sub(re.escape(word), others[0], sentence, count=1, flags=re.IGNORECASE)
                questions.append({"type": "true_false", "question": f"True or false: {false_sentence}", "answer": "False",
                                  "explanation": f"The original statement is: {sentence}", "source": source})
            else:
                questions.append({"type": "true_false", "question": f"True or false: {sentence}", "answer": "True",
                                  "explanation": sentence, "source": source})
        else:  # mcq
            options = [word, *others[:3]]
            if len(options) < 4:
                options += [w for w in ("Scheduler", "Buffer", "Register", "Interrupt") if w.lower() not in {o.lower() for o in options}][: 4 - len(options)]
            rng.shuffle(options)
            questions.append({"type": "mcq", "question": f"Which term completes this statement? {blanked}", "options": options,
                              "answer": word, "explanation": sentence, "source": source})
    return questions


# ---------------------------------------------------------------- flashcards
def make_flashcards(topic: str, chunks: list[ChunkLike], count: int) -> list[dict]:
    cards: list[dict] = []
    seen: set[str] = set()
    for term, sentence in definitions_for(topic, chunks):
        cards.append({"front": f"What is {term}?", "back": sentence})
        seen.add(sentence)
        if len(cards) >= count:
            return cards
    for item in fact_pool(topic, chunks, count * 3):
        if item["sentence"] in seen:
            continue
        word = _target_word(item["sentence"], set(tokens(topic)))
        if not word:
            continue
        front = re.sub(re.escape(word), "____", item["sentence"], count=1, flags=re.IGNORECASE)
        cards.append({"front": f"Complete: {front}", "back": word, "source": f"[{item['idx']}]"})
        if len(cards) >= count:
            break
    return cards


# ---------------------------------------------------------------- study guides
def make_guide(topic: str, kind: str, chunks: list[ChunkLike]) -> str:
    label = _topic_label(topic)
    pool = fact_pool(topic, chunks, 14)
    contexts = [c.text for c in chunks]
    defs = extract_definitions(contexts)
    if not pool:
        return no_context_message(topic, [])
    if kind == "summary":
        body = "\n".join(f"- {p['sentence']} {_cite(p)}" for p in pool[:7])
        return f"# Summary: {label}\n\n{body}\n\n**Key terms:** " + ", ".join(title_case(k) for k in keywords(" ".join(contexts), 6))
    if kind == "revision_notes":
        lines = [f"# Revision notes: {label}", ""]
        for term, sentence in defs[:6]:
            lines.append(f"- **{term}** - {sentence}")
        for p in pool[:5]:
            lines.append(f"- {p['sentence']} {_cite(p)}")
        return "\n".join(lines)
    if kind == "formula_sheet":
        formulas = [s for c in contexts for s in re.split(r"\n+", c) if re.search(r"[=<>]|\bO\([^)]*\)", s) and 6 < len(s) < 160]
        lines = [f"# Formula sheet: {label}", ""]
        if formulas:
            lines += [f"- `{f.strip()}`" for f in dict.fromkeys(formulas)][:12]
        else:
            lines.append("The approved material has no explicit formulas for this topic. Key rules instead:")
            lines += [f"- {p['sentence']} {_cite(p)}" for p in pool[:5]]
        return "\n".join(lines)
    if kind == "mind_map":
        code = visuals.mindmap_from_context(label, contexts)
        return f"# Mind map: {label}\n\n```mermaid\n{code}\n```\n\nEach branch is a key term from the approved material."
    if kind == "cheat_sheet":
        rows = "\n".join(f"| {t} | {s[:140]} |" for t, s in defs[:8]) or "\n".join(f"| {title_case(k)} | see notes |" for k in keywords(" ".join(contexts), 6))
        pitfalls = "\n".join(f"- {p['sentence']}" for p in pool[:3])
        return f"# Cheat sheet: {label}\n\n| Term | Meaning |\n|---|---|\n{rows}\n\n**Remember**\n{pitfalls}"
    if kind == "expected_questions":
        qs = [f"Define {t}." for t, _ in defs[:4]]
        qs += [f"Explain {title_case(k)} with an example." for k in keywords(" ".join(contexts), 4)]
        qs += [f"Compare and contrast two ideas from {label}.", f"Why does {label} matter in a real system?"]
        body = "\n".join(f"{i}. {q}" for i, q in enumerate(qs[:10], 1))
        return f"# Expected questions: {label}\n\n{body}"
    return "\n".join(f"- {p['sentence']}" for p in pool[:6])


# ---------------------------------------------------------------- viva
def viva_question(topic: str, chunks: list[ChunkLike], asked: list[str], difficulty: str) -> dict:
    defs = definitions_for(topic, chunks)
    for term, sentence in defs:
        question = f"What is {term}? Explain it in your own words."
        if question not in asked:
            return {"question": question, "reference_answer": sentence}
    for item in fact_pool(topic, chunks, 20):
        word = _target_word(item["sentence"], set())
        key = word or clean_label(item["sentence"], 4)
        question = f"Explain the role of {title_case(key)} in {_topic_label(topic)}."
        if question not in asked:
            return {"question": question, "reference_answer": item["sentence"]}
    return {"question": f"Summarise the most important ideas of {_topic_label(topic)}.", "reference_answer": " ".join(c.text for c in chunks[:1])}


def viva_evaluate(question: str, reference: str, answer: str) -> dict:
    ref_terms = {stem(w) for w in keywords(reference, 8)}
    ans = content_stems(answer)
    hits = {t for t in ref_terms if t in ans}
    coverage = len(hits) / max(1, len(ref_terms))
    words = len(answer.split())
    score = min(10.0, round(10 * min(1.0, coverage * 1.6), 1))
    if words < 5:
        score = min(score, 3.0)
    missing = [t for t in sorted(ref_terms - hits)][:4]
    if score >= 8:
        feedback = "Excellent answer - you covered the key ideas precisely."
    elif score >= 5:
        feedback = "Good start. You have the core idea" + (f", but also mention: {', '.join(missing)}." if missing else ".")
    else:
        feedback = "This needs more depth" + (f". Revise these ideas: {', '.join(missing)}." if missing else ".")
    return {"score": score, "feedback": feedback, "missing": missing}


def viva_report(topic: str, score: float, results: list[dict]) -> str:
    best = max(results, key=lambda r: r["score"]) if results else None
    worst = min(results, key=lambda r: r["score"]) if results else None
    verdict = "outstanding" if score >= 8 else "solid" if score >= 6 else "developing" if score >= 4 else "weak"
    parts = [f"Overall viva performance on {_topic_label(topic)} was {verdict} ({score:.1f}/10)."]
    if best:
        parts.append(f"Strongest answer: \"{best['question']}\".")
    if worst and worst is not best:
        parts.append(f"Revisit: \"{worst['question']}\".")
    return " ".join(parts)
