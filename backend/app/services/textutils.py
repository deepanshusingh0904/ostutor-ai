"""Lightweight NLP helpers used by the offline teaching engine and generators."""
from __future__ import annotations

import re
from collections import Counter

STOPWORDS = set(
    """a an the of in on at to for from by with and or but if then else is are was were be been being this that these
    those it its as into over under about between among within without also can could should would may might will shall
    do does did done not no nor so than too very such each other more most some any all both either neither which who
    whom whose what when where why how i you he she we they them his her our their your my me us there here has have had
    one two use used using called known given called etc eg ie""".split()
)
_PRONOUN_START = {"it", "this", "that", "these", "those", "there", "which", "they", "he", "she", "we", "you", "what"}
_TOKEN = re.compile(r"[A-Za-z][A-Za-z0-9_\-]{1,}")
_DEF = re.compile(
    r"^(?:an?|the)?\s*(?P<term>[A-Za-z][\w\- /]{1,45}?)\s+(?:is|are|refers to|is defined as|means|can be defined as)\s+(?P<rest>.{15,})$",
    re.IGNORECASE,
)


def split_sentences(text: str) -> list[str]:
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"[\*_`]{1,3}", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])", text)
    return [p.strip() for p in parts if len(p.strip()) > 25]


def tokens(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN.findall(text)]


def stem(word: str) -> str:
    for suffix in ("ingly", "ations", "ation", "ing", "edly", "ies", "es", "ed", "ly", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 4:
            return word[: -len(suffix)]
    return word


def content_stems(text: str) -> set[str]:
    return {stem(t) for t in tokens(text) if t not in STOPWORDS and len(t) > 2}


def keywords(text: str, n: int = 8) -> list[str]:
    counts: Counter[str] = Counter(t for t in tokens(text) if t not in STOPWORDS and len(t) > 3)
    return [w for w, _ in counts.most_common(n)]


def rank_sentences(query: str, texts: list[str], limit: int = 8) -> list[str]:
    q = content_stems(query)
    scored: list[tuple[float, int, str]] = []
    order = 0
    for text in texts:
        for sentence in split_sentences(text):
            s = content_stems(sentence)
            overlap = len(q & s)
            bonus = 0.5 if _DEF.match(sentence) else 0
            scored.append((overlap + bonus - 0.001 * order, order, sentence))
            order += 1
    scored.sort(key=lambda t: (-t[0], t[1]))
    seen: set[str] = set()
    out: list[str] = []
    for _, _, sentence in scored:
        key = sentence[:80].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(sentence)
        if len(out) >= limit:
            break
    return out


def extract_definitions(texts: list[str]) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    seen: set[str] = set()
    for text in texts:
        for sentence in split_sentences(text):
            m = _DEF.match(sentence)
            if not m:
                continue
            term = m.group("term").strip(" -/")
            first = term.split()[0].lower() if term.split() else ""
            if first in _PRONOUN_START or len(term.split()) > 5 or term.lower() in seen:
                continue
            seen.add(term.lower())
            found.append((term, sentence))
    return found


def clean_label(text: str, max_words: int = 6) -> str:
    """Make text safe for Mermaid node labels."""
    text = re.sub(r"[^A-Za-z0-9 ,.+=*/%\-]", " ", text)
    words = text.split()
    label = " ".join(words[:max_words])
    return label if label else "Concept"


def title_case(text: str) -> str:
    return " ".join(w.capitalize() if w.islower() else w for w in text.split())


_LEAD = re.compile(
    r"^\s*(?:please\s+)?(?:can|could|would)?\s*(?:you\s+)?(?:please\s+)?"
    r"(?:teach|explain|tell|describe|define|show|help|walk|give|learn|understand|summari[sz]e|discuss|what(?:'s| is| are)|"
    r"who|how does|how do|why does|why do|why)\b\s*(?:me|us)?\s*(?:through|about|how|what|the|a|an|of|to)?\s*(?:is|are|about)?\s*",
    re.IGNORECASE,
)


def extract_topic(text: str) -> str:
    """Strip instruction wording ("teach me about ...") so retrieval focuses on the subject itself."""
    cleaned = text.strip().rstrip("?.! ")
    for _ in range(2):
        stripped = _LEAD.sub("", cleaned, count=1).strip()
        if not stripped or stripped == cleaned:
            break
        cleaned = stripped
    return cleaned or text.strip()


_TRAILING = {"to", "the", "of", "and", "a", "an", "in", "so", "that", "or", "for", "with", "by", "on", "as", "is", "are", "which", "it", "its"}


def short_label(sentence: str, max_words: int = 9) -> str:
    """Compress a sentence into a readable node label: first clause, bounded length, no dangling function words."""
    text = re.sub(r"\s+", " ", sentence).strip().rstrip(".")
    clause = re.split(r"[,;:]| which | so | because | where ", text, maxsplit=1)[0].strip()
    if len(clause.split()) < 3:
        clause = text
    words = clause.split()[:max_words]
    while words and words[-1].lower().strip(",.") in _TRAILING:
        words.pop()
    return clean_label(" ".join(words), max_words)
