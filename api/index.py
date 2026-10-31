"""Vercel entrypoint: exposes the FastAPI app from backend/ as a serverless function."""
import os
import sys
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from main import app as _app  # noqa: E402


class VercelPathShim:
    """Vercel can hand a rewritten function its destination path (/api/index) instead of the original URL.
    vercel.json forwards the original path as ?p=..., which is restored here. Normal paths pass through untouched."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path", "").rstrip("/") in ("/api/index", "/api/index.py"):
            qs = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
            p = next((v for k, v in qs if k == "p"), None)
            if p is not None:
                rest = [(k, v) for k, v in qs if k != "p"]
                path = "/api/" + p.lstrip("/")
                scope = dict(scope, path=path, raw_path=path.encode(), query_string=urlencode(rest).encode())
        await self.app(scope, receive, send)


app = VercelPathShim(_app)
