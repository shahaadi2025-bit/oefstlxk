import time

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    import os
    os.environ["DEMO_MODE"] = "1"
    import main
    with TestClient(main.app) as c:
        for _ in range(100):
            if c.get("/api/health").json()["status"] == "ready":
                break
            time.sleep(0.2)
        yield c


def test_health_ready_demo(client):
    h = client.get("/api/health").json()
    assert h["status"] == "ready" and h["demo_data"] is True


def test_series_ok_and_empty_range_422(client):
    assert len(client.get("/api/series?start=2026-01-02&end=2026-01-04").json()["points"]) > 0
    assert client.get("/api/series?start=2025-01-01&end=2025-01-02").status_code == 422


def test_decision_shape(client):
    r = client.get("/api/decision?date=2026-01-15").json()
    assert len(r["rows"]) == 24 and {"t", "forecast", "published", "lo", "hi", "actual"} <= set(r["rows"][0])


def test_decision_validation(client):
    assert client.get("/api/decision?date=nonsense").status_code == 422
    assert client.get("/api/decision?date=2026-03-01").status_code == 422
    assert client.get("/api/decision?date=2026-01-15&cutoff_hour=30").status_code == 422


def test_csv_export(client):
    r = client.get("/api/decision.csv?date=2026-01-15")
    assert r.headers["content-type"].startswith("text/csv") and len(r.text.strip().splitlines()) == 25


def test_procurement(client):
    r = client.get("/api/procurement?date=2026-01-15&demand_mw=20000&confidence=0.95").json()
    assert r["buffer_mw"] >= 0 and r["with_buffer_mwh"] >= r["base_mwh"]
    assert client.get("/api/procurement?demand_mw=-5").status_code == 422


def test_accuracy_and_horizon(client):
    a = client.get("/api/accuracy").json()
    assert a["summary"]["n"] > 600 and a["by_wind_level"] and a["baseline"]
    assert client.get("/api/horizon").json()["by_horizon"]


def test_revisions(client):
    r = client.get("/api/revisions?target=2026-01-15T12:00:00Z").json()
    assert r["revisions"] and r["actual"] is not None
    assert client.get("/api/revisions?target=bad").status_code == 422
    assert client.get("/api/revisions?target=2030-01-01T00:00:00Z").status_code == 404


def test_quality(client):
    q = client.get("/api/quality").json()
    assert q["expected_hours"] == 744 and q["missing_actuals"] == 0


def test_503_while_loading():
    import main
    saved = dict(main.STATE)
    main.STATE.update(status="loading", error=None)
    try:
        assert TestClient(main.app).get("/api/accuracy").status_code == 503
    finally:
        main.STATE.update(saved)


def test_csv_filename_uses_validated_date(client):
    r = client.get("/api/decision.csv", params={"date": "15 Jan 2026"})
    assert r.status_code == 200 and r.headers["content-disposition"] == 'attachment; filename="decision_2026-01-15.csv"'


def test_security_headers_present(client):
    h = client.get("/api/health").headers
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY"
    assert "default-src 'self'" in h["content-security-policy"] and h["cache-control"] == "no-store"


def test_first_request_loads_data_when_idle(client):
    import main
    saved = dict(main.STATE)
    main.STATE.update(status="idle", error=None, A=None, F=None)
    try:
        assert client.get("/api/health").json()["status"] == "ready"
    finally:
        main.STATE.update(saved)
