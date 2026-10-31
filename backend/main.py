import logging
import os
import threading
import time
from collections import deque
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

import analysis
import elexon
import security

log = logging.getLogger("app")
STATE = {"status": "idle", "error": None, "A": None, "F": None, "demo": False}
GENERIC_UNAVAILABLE = "The data service is temporarily unavailable. Please try again shortly."
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_MIN", "240"))  # per client IP, per instance
_hits: dict[str, deque] = {}


def _is_production() -> bool:
    return os.environ.get("VERCEL_ENV") == "production" or os.environ.get("APP_ENV") == "production"


def load_sync():
    STATE.update(status="loading", error=None)
    try:
        if _is_production() and os.environ.get("DEMO_MODE") == "1":
            raise RuntimeError("DEMO_MODE must not be enabled in production")
        (A, F), source = elexon.load()
        STATE.update(A=A, F=F, demo=source == "demo", status="ready")
    except Exception:  # details go to the server log only, never to the client
        log.exception("data load failed")
        STATE.update(status="error", error=GENERIC_UNAVAILABLE)


_LOCK = threading.Lock()


def ensure_loaded():
    """Load data once. Used by the startup thread and, on serverless hosts, by the first request."""
    if STATE["status"] == "idle":
        with _LOCK:
            if STATE["status"] == "idle":
                load_sync()


@asynccontextmanager
async def lifespan(_):
    threading.Thread(target=ensure_loaded, daemon=True).start()
    yield


_docs = os.environ.get("ENABLE_DOCS") == "1"
app = FastAPI(
    title="WindDesk API",
    lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _docs else None,
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
if os.environ.get("ALLOWED_HOSTS"):
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[h.strip() for h in os.environ["ALLOWED_HOSTS"].split(",")])


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:  # the entry added by the nearest trusted proxy is the last one
        return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _allow(request: Request) -> bool:
    now = time.monotonic()
    q = _hits.setdefault(_client_ip(request), deque())
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        return False
    q.append(now)
    if len(_hits) > 5000:  # bound memory
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > 60]:
            _hits.pop(k, None)
    return True


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and not _allow(request):
        resp = JSONResponse({"detail": "Too many requests"}, status_code=429, headers={"Retry-After": "30"})
    else:
        try:
            resp = await call_next(request)
        except Exception:
            log.exception("unhandled error on %s", path)
            resp = JSONResponse({"detail": "Internal server error"}, status_code=500)
    for k, v in security.headers_for(path).items():
        resp.headers[k] = v
    cache = security.cache_for(path, resp.status_code)
    if cache:
        resp.headers["Cache-Control"] = cache
    elif "cache-control" not in resp.headers and not path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-cache"
    return resp


def data():
    ensure_loaded()
    if STATE["status"] != "ready":
        raise HTTPException(503, GENERIC_UNAVAILABLE if STATE["status"] == "error" else "Data is still loading")
    return STATE["A"], STATE["F"], STATE["demo"]


def _parse(s):
    try:
        return pd.Timestamp(s, tz="UTC").normalize()
    except Exception:
        raise HTTPException(422, "Invalid date, use YYYY-MM-DD")


def _day(s):
    d = _parse(s)
    if not (pd.Timestamp(elexon.START) <= d < pd.Timestamp(elexon.END)):
        raise HTTPException(422, "Delivery day must be 2026-01-02 to 2026-02-01 (decisions made in January 2026)")
    return d


def _ts(s):
    return s.dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _clean(df):
    return df.astype(object).where(df.notna(), None)


CUT = Query(9, ge=0, le=23, description="Decision cutoff hour (UTC) on D-1")
DATE_Q = Query("2026-01-15", max_length=32)


@app.get("/api/health")
def health():
    ensure_loaded()
    return {"status": STATE["status"], "error": STATE["error"], "demo_data": STATE["demo"]}


@app.get("/api/series")
def series(start: str = Query("2026-01-02", max_length=32), end: str = Query("2026-01-09", max_length=32),
           cutoff_hour: int = CUT):
    A, F, demo = data()
    s, e = _day(start), _parse(end)
    d = analysis.joined(A, F, cutoff_hour)
    d = d[(d.startTime >= s) & (d.startTime < e)]
    if d.empty:
        raise HTTPException(404, "No data in range")
    out = d.assign(t=_ts(d.startTime), published=_ts(d.publishTime))
    return {"demo_data": demo, "points": out[["t", "actual", "forecast", "published"]].round(1).to_dict("records")}


def _decision(date, cutoff_hour):
    A, F, demo = data()
    day = _day(date)
    d, e, fallback = analysis.decision_day(A, F, day, cutoff_hour)
    if d.empty:
        raise HTTPException(404, "No forecast was available at the cutoff for that day")
    return d, e, fallback, demo


@app.get("/api/decision")
def decision(date: str = DATE_Q, cutoff_hour: int = CUT):
    d, e, fallback, demo = _decision(date, cutoff_hour)
    out = d.assign(t=_ts(d.startTime), published=_ts(d.publishTime))
    rows = _clean(out[["t", "forecast", "published", "lo", "hi", "actual"]].round(1)).to_dict("records")
    return {"demo_data": demo, "cutoff_hour": cutoff_hour, "rows": rows, "band_uses_all_history": fallback,
            "error_p10": float(e.quantile(.1)), "error_p90": float(e.quantile(.9))}


@app.get("/api/decision.csv")
def decision_csv(date: str = DATE_Q, cutoff_hour: int = CUT):
    d, _, _, _ = _decision(date, cutoff_hour)
    day = _day(date).strftime("%Y-%m-%d")  # validated, so safe to put in a header
    out = d.assign(target_time_utc=_ts(d.startTime), forecast_published_utc=_ts(d.publishTime))
    cols = ["target_time_utc", "forecast", "forecast_published_utc", "lo", "hi"]
    renamed = out[cols].rename(columns={"forecast": "forecast_mw", "lo": "p10_mw", "hi": "p90_mw"})
    csv = renamed.round(1).to_csv(index=False)
    return Response(csv, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="decision_{day}.csv"'})


@app.get("/api/procurement")
def procurement(date: str = DATE_Q, cutoff_hour: int = CUT, demand_mw: float = Query(25000, ge=0, le=100000),
                confidence: float = Query(0.95, ge=0.5, le=0.999)):
    d, e, fallback, demo = _decision(date, cutoff_hour)
    return {"demo_data": demo, "confidence": confidence, "band_uses_all_history": fallback,
            **analysis.procurement(d, e, demand_mw, confidence)}


@app.get("/api/accuracy")
def accuracy(cutoff_hour: int = CUT):
    A, F, demo = data()
    d = analysis.joined(A, F, cutoff_hour)
    if d.empty:
        raise HTTPException(404, "No overlapping forecasts and actuals")
    return {"demo_data": demo, "cutoff_hour": cutoff_hour, "summary": analysis.metrics(d),
            "by_hour": analysis.by_hour(d), "by_wind_level": analysis.by_wind_level(d),
            "baseline": analysis.persistence_baseline(A, d)}


@app.get("/api/horizon")
def horizon():
    A, F, demo = data()
    return {"demo_data": demo, "by_horizon": analysis.by_horizon(A, F)}


@app.get("/api/revisions")
def revisions(target: str = Query(max_length=40), cutoff_hour: int = CUT):
    A, F, demo = data()
    try:
        t = pd.Timestamp(target)
        t = t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
    except Exception:
        raise HTTPException(422, "Invalid target, use ISO format e.g. 2026-01-15T12:00:00Z")
    f = F[F.startTime == t].sort_values("publishTime")
    if f.empty:
        raise HTTPException(404, "No forecasts for that target time")
    act = A[A.startTime == t].actual
    cutoff = t.floor("D") - pd.Timedelta(days=1) + pd.Timedelta(hours=cutoff_hour)
    return {"demo_data": demo, "target": t.isoformat(), "cutoff": cutoff.isoformat(),
            "actual": float(act.iloc[0]) if len(act) else None,
            "revisions": [{"published": p.strftime("%Y-%m-%d %H:%M"), "forecast": round(float(v), 1),
                           "before_cutoff": bool(p <= cutoff)} for p, v in zip(f.publishTime, f.forecast)]}


@app.get("/api/quality")
def quality(cutoff_hour: int = CUT):
    A, F, demo = data()
    s, e = pd.Timestamp(elexon.START), pd.Timestamp(elexon.END)
    return {"demo_data": demo, **analysis.quality(A, F, s, e, cutoff_hour)}


if os.path.isdir("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
