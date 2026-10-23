"""Text cleaning utilities applied before chunking."""
from __future__ import annotations

import re
import unicodedata
from collections import Counter

from app.rag.loaders import PageText

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0e-\x1f\x7f]")
# Slide decks exported from PowerPoint carry the Wingdings bullet as a letter ("qFor ...", "q Textbook").
_BULLET_GLYPH = re.compile(r"^[ \t]*[qØ§](?:[ \t]+(?=\S)|(?=[A-Z]))", re.MULTILINE)
_FOOTER_LINE = re.compile(r"^\s*(?:\d{1,3}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|(?:module|unit|lecture)\s*\d+)\s*$", re.IGNORECASE)


def join_wrapped_lines(text: str) -> str:
    """Re-flow hard-wrapped lines (typical for PDF extraction)."""
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # de-hyphenate
    lines = text.split("\n")
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            out.append("")
            continue
        if out and out[-1] and not re.search(r"[.!?:;]$", out[-1]) and re.match(r"^[a-z(]", stripped):
            out[-1] = f"{out[-1]} {stripped}"
        else:
            out.append(stripped)
    return "\n".join(out)


def clean_text(text: str, reflow: bool = False) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = _CONTROL.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if reflow:
        text = join_wrapped_lines(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def strip_repeated_lines(pages: list[PageText]) -> list[PageText]:
    """Remove running headers/footers that repeat on most pages."""
    if len(pages) < 4:
        return pages
    counter: Counter[str] = Counter()
    for page in pages:
        seen = {line.strip() for line in page.text.split("\n") if 0 < len(line.strip()) < 80}
        counter.update(seen)
    threshold = max(3, int(len(pages) * 0.6))
    repeated = {line for line, n in counter.items() if n >= threshold}
    if not repeated:
        return pages
    cleaned = []
    for page in pages:
        kept = [line for line in page.text.split("\n") if line.strip() not in repeated]
        cleaned.append(PageText(page.page, "\n".join(kept)))
    return cleaned


def strip_page_footers(pages: list[PageText]) -> list[PageText]:
    """Drop slide numbers, dates and 'Module 3' labels that sit at the bottom of a page."""
    cleaned = []
    for page in pages:
        lines = page.text.rstrip().split("\n")
        removed = 0
        while lines and removed < 4 and _FOOTER_LINE.match(lines[-1]):
            lines.pop()
            removed += 1
        cleaned.append(PageText(page.page, "\n".join(lines)))
    return cleaned


def clean_pages(pages: list[PageText], file_type: str) -> list[PageText]:
    reflow = file_type in {"pdf"}
    if file_type in {"pdf", "pptx"}:
        pages = [PageText(p.page, _BULLET_GLYPH.sub("• ", p.text)) for p in pages]
        pages = strip_page_footers(pages)
    pages = strip_repeated_lines(pages)
    cleaned = [PageText(p.page, clean_text(p.text, reflow=reflow)) for p in pages]
    return [p for p in cleaned if p.text]
