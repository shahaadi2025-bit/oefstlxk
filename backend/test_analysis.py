import numpy as np
import pandas as pd
import pytest

import analysis
import elexon

UTC = "UTC"


def ts(s):
    return pd.Timestamp(s, tz=UTC)


@pytest.fixture(scope="module")
def demo():
    return elexon.load_demo()


def test_cutoff_excludes_late_forecasts():
    t = ts("2026-01-10 12:00")
    F = pd.DataFrame({"startTime": [t, t], "publishTime": [ts("2026-01-09 08:00"), ts("2026-01-09 10:00")],
                      "forecast": [100.0, 999.0]})
    assert analysis.at_cutoff(F, 9).forecast.iloc[0] == 100.0


def test_cutoff_picks_latest_before_cutoff():
    t = ts("2026-01-10 12:00")
    F = pd.DataFrame({"startTime": [t] * 3, "publishTime": [ts("2026-01-08 01:00"), ts("2026-01-09 08:00"),
                                                            ts("2026-01-09 09:00")], "forecast": [1.0, 2.0, 3.0]})
    assert analysis.at_cutoff(F, 9).forecast.iloc[0] == 3.0


def test_no_forecast_before_cutoff_drops_target():
    t = ts("2026-01-10 12:00")
    F = pd.DataFrame({"startTime": [t], "publishTime": [ts("2026-01-09 20:00")], "forecast": [5.0]})
    assert analysis.at_cutoff(F, 9).empty


def test_metrics_values():
    df = pd.DataFrame({"actual": [100.0, 200.0], "forecast": [110.0, 180.0]})
    m = analysis.metrics(df)
    assert m["mae"] == 15 and m["bias"] == -5 and m["rmse"] == pytest.approx(np.sqrt(250))


def test_metrics_empty():
    assert analysis.metrics(pd.DataFrame({"actual": [], "forecast": []})) == {}


def test_persistence_and_skill(demo):
    A, F = demo
    J = analysis.joined(A, F, 9)
    b = analysis.persistence_baseline(A, J)
    assert b["n"] > 0 and b["skill_score"] < 1


def test_by_wind_level_bins(demo):
    A, F = demo
    out = analysis.by_wind_level(analysis.joined(A, F, 9))
    assert 2 <= len(out) <= 4 and all(o["n"] > 0 for o in out)


def test_decision_day_has_48_periods_and_band(demo):
    A, F = demo
    d, e, fallback = analysis.decision_day(A, F, ts("2026-01-15"), 9)
    assert len(d) == 24 and (d.hi >= d.lo).all() and not fallback


def test_decision_day_early_uses_fallback(demo):
    A, F = demo
    _, _, fallback = analysis.decision_day(A, F, ts("2026-01-02"), 9)
    assert fallback


def test_procurement_buffer_never_negative_and_monotonic(demo):
    A, F = demo
    d, e, _ = analysis.decision_day(A, F, ts("2026-01-15"), 9)
    lo = analysis.procurement(d, e, 20000, 0.8)
    hi = analysis.procurement(d, e, 20000, 0.99)
    assert lo["buffer_mw"] >= 0 and hi["buffer_mw"] >= lo["buffer_mw"]
    assert hi["extra_mwh"] >= lo["extra_mwh"] >= 0
    assert hi["with_buffer_mwh"] == pytest.approx(hi["base_mwh"] + hi["extra_mwh"])


def test_quality_detects_missing(demo):
    A, F = demo
    drop = A.startTime.isin([ts("2026-01-05 03:00"), ts("2026-01-05 04:00")])
    q = analysis.quality(A[~drop], F, elexon.START, elexon.END, 9)
    assert q["expected_hours"] == 744 and q["missing_actuals"] == 2 and len(q["missing_examples"]) == 2


def test_demo_runs_match_observed_schedule(demo):
    _, F = demo
    assert set(zip(F.publishTime.dt.hour, F.publishTime.dt.minute)) <= set(elexon.RUNS)
    assert ((F.startTime - F.publishTime) > pd.Timedelta(0)).all()


def test_finalize_averages_half_hours_and_drops_incomplete_hours():
    half = pd.DataFrame({"startTime": [ts("2026-01-05 00:00"), ts("2026-01-05 00:30"), ts("2026-01-05 01:00")],
                         "generation": [100.0, 200.0, 300.0]})
    F = pd.DataFrame({"startTime": [ts("2026-01-05 00:00")], "publishTime": [ts("2026-01-04 07:30")],
                      "generation": [150.0]})
    A, _ = elexon.finalize(half, F)
    assert len(A) == 1 and A.actual.iloc[0] == 150.0
