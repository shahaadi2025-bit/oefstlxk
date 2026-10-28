"""Elexon BMRS Insights client.

Verified API contract (public, no key), https://data.elexon.co.uk/bmrs/api/v1:
  FUELHH/stream  : settlementDateFrom/To (yyyy-MM-dd, inclusive) + fuelType=WIND -> half-hourly MW
  WINDFOR/stream : publishDateTimeFrom/To only -> hourly forecasts (startTime, publishTime, generation),
                   ~8 runs a day, each ~66h ahead, incl. some hours before publishTime.
Decisions are made on D-1, so "decisions in January 2026" means delivery days 2 Jan - 1 Feb 2026.
Data order: committed snapshot in DATA_DIR if present, else live fetch. DEMO_MODE=1 -> synthetic data.
"""
import hashlib
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone

import httpx
import numpy as np
import pandas as pd

log = logging.getLogger("elexon")
BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
CACHE = os.environ.get("CACHE_DIR", "/tmp/wind_cache")
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))
START = datetime(2026, 1, 2, tzinfo=timezone.utc)  # first delivery day (decision on 1 Jan)
END = datetime(2026, 2, 2, tzinfo=timezone.utc)  # exclusive; last delivery day is 1 Feb (decision on 31 Jan)
ACTUALS_FROM = START - timedelta(days=2)  # extra days only used for the 48h naive benchmark
RUNS = [(2, 30), (4, 30), (7, 30), (9, 30), (11, 30), (15, 30), (18, 30), (22, 30)]  # observed WINDFOR publish times


def _get(url, params, retries=4):
    last = None
    for i in range(retries):
        try:
            r = httpx.get(url, params=params, timeout=120)
            if r.status_code == 429 or r.status_code >= 500:
                raise httpx.HTTPStatusError(f"HTTP {r.status_code}", request=r.request, response=r)
            if r.status_code >= 400:
                raise RuntimeError(f"Elexon rejected {url} {params}: HTTP {r.status_code} {r.text[:200]}")
            j = r.json()
            return j.get("data", []) if isinstance(j, dict) else j
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"Elexon request failed after {retries} attempts: {last}")


def _cached(dataset, params):
    os.makedirs(CACHE, exist_ok=True)
    path = f"{CACHE}/{hashlib.md5(f'{dataset}{sorted(params.items())}'.encode()).hexdigest()}.json"
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    data = _get(f"{BASE}/{dataset}/stream", params)
    with open(path, "w") as f:
        json.dump(data, f)
    return data


def fetch_raw():
    """Live fetch. Returns (half-hourly actuals, hourly forecast vintages) as DataFrames."""
    act, d, last = [], ACTUALS_FROM.date(), (END - timedelta(days=1)).date()
    while d <= last:
        e = min(d + timedelta(days=6), last)
        act += _cached("FUELHH", {"settlementDateFrom": d.isoformat(), "settlementDateTo": e.isoformat(),
                                  "fuelType": "WIND"})
        d = e + timedelta(days=1)
    fc, a = [], START - timedelta(days=3)  # horizon is ~66h, so 3 days before the first delivery day is enough
    while a < END:
        b = min(a + timedelta(days=7), END)
        fc += _cached("WINDFOR", {"publishDateTimeFrom": a.strftime("%Y-%m-%dT%H:%M:%SZ"),
                                  "publishDateTimeTo": b.strftime("%Y-%m-%dT%H:%M:%SZ")})
        a = b
    return _clean_raw(pd.DataFrame(act), pd.DataFrame(fc))


def _clean_raw(A, F):
    for name, df, need in (("FUELHH", A, {"startTime", "generation"}),
                           ("WINDFOR", F, {"startTime", "publishTime", "generation"})):
        if df.empty:
            raise RuntimeError(f"{name}: Elexon returned no rows")
        if not need <= set(df.columns):
            raise RuntimeError(f"{name}: unexpected columns {list(df.columns)}")
    if "fuelType" in A:
        A = A[A.fuelType == "WIND"]
    A = A[["startTime", "generation"] + (["publishTime"] if "publishTime" in A else [])].copy()
    A["startTime"] = pd.to_datetime(A.startTime, utc=True)
    if "publishTime" in A:  # keep the latest publication per half-hour
        A["publishTime"] = pd.to_datetime(A.publishTime, utc=True)
        A = A.sort_values("publishTime").drop(columns="publishTime")
    A = A.drop_duplicates("startTime", keep="last")
    F = F[["startTime", "publishTime", "generation"]].copy()
    F["startTime"] = pd.to_datetime(F.startTime, utc=True)
    F["publishTime"] = pd.to_datetime(F.publishTime, utc=True)
    F = F[(F.startTime >= START) & (F.startTime < END) & (F.startTime >= F.publishTime)]  # drop already-past hours
    F = F.drop_duplicates(["startTime", "publishTime"], keep="last")
    A = A.sort_values("startTime").reset_index(drop=True)
    return A, F.sort_values(["startTime", "publishTime"]).reset_index(drop=True)


def finalize(A_half, F):
    """WINDFOR is hourly and FUELHH half-hourly: compare on hours (actual = mean of the two half-hours)."""
    h = A_half.assign(hour=A_half.startTime.dt.floor("h"))
    g = h.groupby("hour").generation.agg(["mean", "count"]).reset_index()
    A = g[g["count"] == 2].rename(columns={"hour": "startTime", "mean": "actual"})[["startTime", "actual"]]
    A = A[(A.startTime >= ACTUALS_FROM) & (A.startTime < END)].reset_index(drop=True)
    F = F.rename(columns={"generation": "forecast"})[["startTime", "publishTime", "forecast"]]
    return A, F.reset_index(drop=True)


def save_snapshot(A, F):
    os.makedirs(DATA_DIR, exist_ok=True)
    A.to_csv(os.path.join(DATA_DIR, "actuals.csv.gz"), index=False)
    F.to_csv(os.path.join(DATA_DIR, "forecasts.csv.gz"), index=False)


def load_snapshot():
    pa, pf = os.path.join(DATA_DIR, "actuals.csv.gz"), os.path.join(DATA_DIR, "forecasts.csv.gz")
    if not (os.path.exists(pa) and os.path.exists(pf)):
        return None
    A, F = pd.read_csv(pa), pd.read_csv(pf)
    for df, cols in ((A, ["startTime"]), (F, ["startTime", "publishTime"])):
        for c in cols:
            df[c] = pd.to_datetime(df[c], utc=True)
    return finalize(A, F)


def load_demo():
    rng = np.random.default_rng(7)
    idx = pd.date_range(ACTUALS_FROM, END, freq="1h", inclusive="left")
    n = np.arange(len(idx))
    act = np.clip(7000 + 4000 * np.sin(n / 110) + 1500 * np.sin(n / 18) + rng.normal(0, 300, len(idx)), 200, 14500)
    A = pd.DataFrame({"startTime": idx, "actual": act})
    rows = []
    for t, a in zip(idx[idx >= START], act[idx >= START]):
        for day in range(-3, 1):
            for hh, mm in RUNS:
                p = t.floor("D") + pd.Timedelta(days=day, hours=hh, minutes=mm)
                h = (t - p).total_seconds() / 3600
                if 0 < h <= 66:
                    rows.append((t, p, max(0.0, a + rng.normal(0, 150 + 25 * h))))
    return A, pd.DataFrame(rows, columns=["startTime", "publishTime", "forecast"])


def load():
    """Returns ((actual_hourly, forecast_vintages), source) where source is demo | snapshot | live."""
    if os.environ.get("DEMO_MODE") == "1":
        return load_demo(), "demo"
    snap = load_snapshot()
    if snap is not None:
        return snap, "snapshot"
    return finalize(*fetch_raw()), "live"

