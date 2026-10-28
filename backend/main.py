import logging
import os
import threading
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

import analysis
import elexon

log = logging.getLogger("app")
STATE = {"status": "idle", "error": None, "A": None, "F": None, "demo": False, "source": None}


def load_sync():
    STATE.update(status="loading", error=None)
    try:
        (A, F), source = elexon.load()
        STATE.update(A=A, F=F, demo=source == "demo", source=source, status="ready")
    except Exception as e:  # surfaced to the UI via /api/health
        log.exception("data load failed")
        STATE.update(status="error", error=str(e))


@asynccontextmanager
async def lifespan(_):
    threading.Thread(target=load_sync, daemon=True).start()
    yield


app = FastAPI(title="Wind Forecast Evaluator", lifespan=lifespan)


@app.middleware("http")
async def security_headers(request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
    if request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


def data():
    if STATE["status"] != "ready":
        raise HTTPException(503, f"Data {STATE['status']}" + (f": {STATE['error']}" if STATE["error"] else ""))
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


@app.get("/api/health")
def health():
    return {"status": STATE["status"], "error": STATE["error"], "demo_data": STATE["demo"], "source": STATE["source"]}


@app.get("/api/series")
def series(start: str = "2026-01-02", end: str = "2026-01-09", cutoff_hour: int = CUT):
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
def decision(date: str = "2026-01-15", cutoff_hour: int = CUT):
    d, e, fallback, demo = _decision(date, cutoff_hour)
    out = d.assign(t=_ts(d.startTime), published=_ts(d.publishTime))
    rows = _clean(out[["t", "forecast", "published", "lo", "hi", "actual"]].round(1)).to_dict("records")
    return {"demo_data": demo, "cutoff_hour": cutoff_hour, "rows": rows, "band_uses_all_history": fallback,
            "error_p10": float(e.quantile(.1)), "error_p90": float(e.quantile(.9))}


@app.get("/api/decision.csv")
def decision_csv(date: str = "2026-01-15", cutoff_hour: int = CUT):
    d, _, _, _ = _decision(date, cutoff_hour)
    day = _day(date).strftime("%Y-%m-%d")  # validated, so safe to put in a header
    out = d.assign(target_time_utc=_ts(d.startTime), forecast_published_utc=_ts(d.publishTime))
    cols = ["target_time_utc", "forecast", "forecast_published_utc", "lo", "hi"]
    renamed = out[cols].rename(columns={"forecast": "forecast_mw", "lo": "p10_mw", "hi": "p90_mw"})
    csv = renamed.round(1).to_csv(index=False)
    return Response(csv, media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="decision_{day}.csv"'})


@app.get("/api/procurement")
def procurement(date: str = "2026-01-15", cutoff_hour: int = CUT, demand_mw: float = Query(25000, ge=0, le=100000),
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
def revisions(target: str, cutoff_hour: int = CUT):
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
