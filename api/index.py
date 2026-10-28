"""Vercel entrypoint: exposes the FastAPI app from backend/ as a serverless function."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from main import app  # noqa: E402,F401
