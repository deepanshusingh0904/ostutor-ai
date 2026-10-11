"""Pure-ASGI middleware: request context, security headers and rate limiting.

Implemented as raw ASGI (not BaseHTTPMiddleware) so streaming responses and client disconnects behave correctly.
"""
from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict, deque

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("ostutor.http")


class RequestContextMiddleware:
    """Adds a request id, timing and security headers, and writes an access-log line."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = Headers(scope=scope).get("x-request-id") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        status = {"code": 0}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
                headers = MutableHeaders(scope=message)
                headers["X-Request-ID"] = request_id
                headers["X-Process-Time-ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("X-Frame-Options", "DENY")
                headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            logger.info("%s %s -> %s (%.0f ms) [%s]", scope["method"], scope["path"], status["code"],
                        (time.perf_counter() - started) * 1000, request_id)


class RateLimitMiddleware:
    """Sliding-window limiter per client IP (in-memory). Use a gateway or Redis for multi-process deployments."""

    def __init__(self, app: ASGIApp, per_minute: int = 240) -> None:
        self.app = app
        self.per_minute = per_minute
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self.per_minute <= 0 or scope["method"] == "OPTIONS" or scope["path"] in {"/api/health", "/"}:
            await self.app(scope, receive, send)
            return
        client = (scope.get("client") or ("unknown", 0))[0]
        now = time.monotonic()
        window = self.hits[client]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self.per_minute:
            response = JSONResponse({"detail": "Too many requests. Please slow down."}, status_code=429, headers={"Retry-After": "30"})
            await response(scope, receive, send)
            return
        window.append(now)
        await self.app(scope, receive, send)
