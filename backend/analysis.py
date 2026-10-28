"""Pure analysis functions (no I/O) so they are easy to test."""
import numpy as np
import pandas as pd

PERIOD_H = 1.0  # forecasts and evaluation are hourly


def at_cutoff(F, cutoff_hour=9):
    """Latest forecast per target time published at/before cutoff_hour UTC on D-1."""
    F = F.copy()
    F["cutoff"] = (F.startTime.dt.floor("D") - pd.Timedelta(days=1)) + pd.Timedelta(hours=cutoff_hour)
    ok = F[F.publishTime <= F.cutoff].sort_values("publishTime")
    return ok.groupby("startTime", as_index=False).last()[["startTime", "publishTime", "forecast"]]


def joined(A, F, cutoff_hour=9):
    return A.merge(at_cutoff(F, cutoff_hour), on="startTime", how="inner")


def metrics(df):
    if df.empty:
        return {}
    e = df.forecast - df.actual
    nz = df.actual > 0
    return {
        "n": int(len(df)), "mae": float(e.abs().mean()), "rmse": float(np.sqrt((e**2).mean())),
        "bias": float(e.mean()), "mape": float((e[nz].abs() / df.actual[nz]).mean() * 100),
        "p90_abs_error": float(e.abs().quantile(.9)), "p99_abs_error": float(e.abs().quantile(.99)),
        "mean_actual": float(df.actual.mean()),
    }


def by_hour(df):
    d = df.assign(hour=df.startTime.dt.hour, ae=(df.forecast - df.actual).abs())
    return d.groupby("hour").ae.mean().round(1).reset_index().rename(columns={"ae": "mae"}).to_dict("records")


def by_horizon(A, F):
    d = F.merge(A, on="startTime")
    d["horizon_h"] = ((d.startTime - d.publishTime).dt.total_seconds() // 3600).astype(int)
    d = d[(d.horizon_h >= 0) & (d.horizon_h <= 72)]
    d["ae"] = (d.forecast - d.actual).abs()
    return d.groupby("horizon_h").ae.mean().round(1).reset_index().rename(columns={"ae": "mae"}).to_dict("records")


def by_wind_level(df, bins=4):
    """Error by forecast wind level (forecast is known at decision time, actual is not)."""
    if len(df) < bins * 5:
        return []
    d = df.assign(err=df.forecast - df.actual)
    d["bin"] = pd.qcut(d.forecast, bins, duplicates="drop")
    out = []
    for iv, g in d.groupby("bin", observed=True):
        out.append({"level": f"{max(iv.left, 0):,.0f}-{iv.right:,.0f} MW", "n": int(len(g)),
                    "mae": round(float(g.err.abs().mean()), 1), "bias": round(float(g.err.mean()), 1)})
    return out


def persistence_baseline(A, df):
    """Naive benchmark: actual wind 48h earlier (always known on D-1). skill = 1 - MAE_forecast / MAE_naive."""
    s = A.set_index("startTime").actual
    p = s.reindex(pd.DatetimeIndex(df.startTime - pd.Timedelta(hours=48))).to_numpy()
    d = df.assign(persist=p).dropna(subset=["persist"])
    if d.empty:
        return {}
    mf = float((d.forecast - d.actual).abs().mean())
    mp = float((d.persist - d.actual).abs().mean())
    return {"n": int(len(d)), "forecast_mae": mf, "persistence_mae": mp, "skill_score": 1 - mf / mp}


def history_errors(J, before=None, min_n=96):
    """Forecast errors (forecast - actual) known before 'before'; falls back to all history if too few."""
    d = J if before is None else J[J.startTime < before]
    fallback = len(d) < min_n
    if fallback:
        d = J
    return (d.forecast - d.actual), fallback


def decision_day(A, F, day, cutoff_hour, J=None):
    """48 half-hours of delivery day 'day' with the forecast available at cutoff and a P10-P90 band."""
    Fc = at_cutoff(F, cutoff_hour)
    d = Fc[(Fc.startTime >= day) & (Fc.startTime < day + pd.Timedelta(days=1))]
    d = d.merge(A, on="startTime", how="left").sort_values("startTime").reset_index(drop=True)
    if J is None:
        J = joined(A, F, cutoff_hour)
    e, fallback = history_errors(J, before=day)
    if len(e) >= 10 and not d.empty:
        d["lo"] = np.clip(d.forecast - e.quantile(.9), 0, None)
        d["hi"] = d.forecast - e.quantile(.1)
    else:
        d["lo"] = np.nan
        d["hi"] = np.nan
    return d, e, fallback


def procurement(day_df, e, demand_mw, confidence):
    """Extra MWh to buy so a wind shortfall (over-forecast) at the given confidence is covered."""
    buf = max(0.0, float(e.quantile(confidence)))
    f = day_df.forecast.to_numpy()
    base = np.clip(demand_mw - f, 0, None)
    safe = np.clip(demand_mw - np.clip(f - buf, 0, None), 0, None)
    return {"buffer_mw": buf, "base_mwh": float(base.sum() * PERIOD_H),
            "with_buffer_mwh": float(safe.sum() * PERIOD_H),
            "extra_mwh": float((safe - base).sum() * PERIOD_H),
            "avg_forecast_mw": float(f.mean()), "periods": int(len(f))}


def quality(A, F, start, end, cutoff_hour):
    """Coverage checks for the evaluation window [start, end) at hourly resolution."""
    Fc = at_cutoff(F, cutoff_hour)
    expected = pd.date_range(start, end, freq="1h", inclusive="left")
    Aw = A[(A.startTime >= start) & (A.startTime < end)]
    missing = sorted(set(expected) - set(Aw.startTime))
    return {
        "expected_hours": int(len(expected)), "actual_hours": int(len(Aw)), "missing_actuals": len(missing),
        "missing_examples": [t.strftime("%Y-%m-%d %H:%M") for t in missing[:20]],
        "zero_or_negative_actuals": int((Aw.actual <= 0).sum()),
        "forecast_rows": int(len(F)), "targets_with_forecast_at_cutoff": int(len(Fc)),
        "targets_without_forecast_at_cutoff": int(len(expected) - len(Fc)),
        "avg_forecasts_per_target": round(float(len(F) / max(F.startTime.nunique(), 1)), 1),
        "forecast_publish_min": F.publishTime.min().strftime("%Y-%m-%d %H:%M"),
        "forecast_publish_max": F.publishTime.max().strftime("%Y-%m-%d %H:%M"),
    }
