"""OpenAI-compatible LLM client with streaming and JSON helpers."""
from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterator
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger("ostutor.llm")


class LLMUnavailable(RuntimeError):
    pass


def extract_json(text: str) -> Any:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start, end = text.find(opener), text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise ValueError("Model did not return valid JSON")


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None

    @property
    def configured(self) -> bool:
        return bool(self.settings.llm_api_key)

    def _get_client(self):
        if not self.configured:
            raise LLMUnavailable("No LLM API key configured")
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(
                api_key=self.settings.llm_api_key,
                base_url=self.settings.llm_base_url,
                timeout=self.settings.llm_timeout_seconds,
            )
        return self._client

    def stream(self, messages: list[dict[str, str]], temperature: float | None = None,
               max_tokens: int | None = None) -> Iterator[str]:
        client = self._get_client()
        response = client.chat.completions.create(
            model=self.settings.llm_model,
            messages=messages,
            temperature=self.settings.llm_temperature if temperature is None else temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        for event in response:
            if not event.choices:
                continue
            delta = event.choices[0].delta.content
            if delta:
                yield delta

    def complete(self, messages: list[dict[str, str]], temperature: float | None = None,
                 max_tokens: int | None = None, json_mode: bool = False) -> str:
        client = self._get_client()
        kwargs: dict[str, Any] = dict(
            model=self.settings.llm_model,
            messages=messages,
            temperature=self.settings.llm_temperature if temperature is None else temperature,
            max_tokens=max_tokens,
        )
        if json_mode:
            try:
                resp = client.chat.completions.create(response_format={"type": "json_object"}, **kwargs)
                return resp.choices[0].message.content or ""
            except Exception as exc:  # noqa: BLE001 - some compatible servers reject response_format
                logger.info("json_mode unsupported, retrying without it: %s", exc)
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""

    def complete_json(self, messages: list[dict[str, str]], temperature: float = 0.3) -> Any:
        return extract_json(self.complete(messages, temperature=temperature, json_mode=True))


_llm: LLMService | None = None


def get_llm() -> LLMService:
    global _llm
    if _llm is None:
        _llm = LLMService()
    return _llm
