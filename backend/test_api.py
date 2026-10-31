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


def test_scene_path_gets_framing_csp_but_app_stays_strict(client):
    scene = client.get("/landing-pages/inner-green-3d.html").headers
    assert scene["x-frame-options"] == "SAMEORIGIN" and "frame-ancestors 'self'" in scene["content-security-policy"]
    assert "script-src 'self' 'unsafe-inline'" in scene["content-security-policy"]
    app = client.get("/api/health").headers
    assert app["x-frame-options"] == "DENY"
    csp = app["content-security-policy"]
    assert "script-src 'self';" in csp and "unsafe-inline" not in csp.split("style-src-attr")[0]


def test_health_does_not_leak_internals(client):
    h = client.get("/api/health").json()
    assert set(h) == {"status", "error", "demo_data"}


def test_error_state_is_generic(client):
    import main
    saved = dict(main.STATE)
    main.STATE.update(status="error", error=main.GENERIC_UNAVAILABLE)
    try:
        r = client.get("/api/accuracy")
        assert r.status_code == 503 and r.json()["detail"] == main.GENERIC_UNAVAILABLE
        assert "Traceback" not in r.text and "elexon" not in r.text.lower()
    finally:
        main.STATE.update(saved)


def test_unhandled_exception_is_sanitised(client, monkeypatch):
    import analysis
    import main
    def boom(_):
        raise RuntimeError("secret internal detail /srv/app")

    monkeypatch.setattr(analysis, "metrics", boom)
    r = client.get("/api/accuracy")
    assert r.status_code == 500 and r.json() == {"detail": "Internal server error"}
    assert r.headers["x-frame-options"] == "DENY"  # headers still applied on errors
    main.STATE.get("status")


def test_api_docs_hidden_by_default(client):
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_full_security_header_set(client):
    h = client.get("/api/health").headers
    for k in ["strict-transport-security", "x-content-type-options", "referrer-policy", "permissions-policy",
              "cross-origin-opener-policy", "cross-origin-resource-policy", "x-frame-options",
              "content-security-policy"]:
        assert k in h, k
    csp = h["content-security-policy"]
    assert "unsafe-eval" not in csp and "*" not in csp and "script-src 'self';" in csp and "object-src 'none'" in csp


def test_cache_policy(client):
    assert client.get("/api/health").headers["cache-control"] == "no-store"
    assert "max-age=300" in client.get("/api/accuracy").headers["cache-control"]
    assert client.get("/api/decision?date=bad").headers["cache-control"] == "no-store"
    import security
    assert security.cache_for("/assets/index-abc.js", 200) == security.IMMUTABLE


def test_rate_limit_returns_429_with_retry_after(client, monkeypatch):
    import main
    monkeypatch.setattr(main, "RATE_LIMIT", 3)
    main._hits.clear()
    codes = [client.get("/api/health").status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200] and codes[3:] == [429, 429]
    r = client.get("/api/health")
    assert r.headers["retry-after"] == "30" and "x-content-type-options" in r.headers
    main._hits.clear()


def test_input_length_limits(client):
    assert client.get("/api/decision?date=" + "x" * 500).status_code == 422
    assert client.get("/api/revisions?target=" + "x" * 500).status_code == 422


def test_no_cors_headers_for_foreign_origin(client):
    r = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers
    pre = client.options(
        "/api/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in pre.headers


def test_demo_mode_refused_in_production(monkeypatch):
    import main
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("DEMO_MODE", "1")
    saved = dict(main.STATE)
    try:
        main.load_sync()
        assert main.STATE["status"] == "error" and main.STATE["A"] is saved["A"]
    finally:
        main.STATE.update(saved)


def test_vercel_json_matches_server_policy():
    import json
    import pathlib

    import security
    cfg = json.loads((pathlib.Path(__file__).resolve().parent.parent / "vercel.json").read_text())
    by_source = {h["source"]: {x["key"]: x["value"] for x in h["headers"]} for h in cfg["headers"]}
    scene = next(v for k, v in by_source.items() if k.startswith("/landing-pages/(.*)") or k == "/landing-pages/(.*)")
    default = next(v for k, v in by_source.items() if k.startswith("/((?!landing-pages/)"))
    assert default["Content-Security-Policy"] == security.STRICT_CSP
    assert scene["Content-Security-Policy"] == security.SCENE_CSP
    for k, v in security.COMMON_HEADERS.items():
        assert default[k] == v and scene[k] == v


def test_vercel_path_shim_recovers_original_api_path(client):
    import pathlib
    import sys

    from fastapi.testclient import TestClient

    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "api"))
    import index as vercel_entry

    c = TestClient(vercel_entry.app)
    # Vercel handing us the rewrite destination: /api/index?p=<original path>&<original query>
    r = c.get("/api/index", params={"p": "decision", "date": "2026-01-15"})
    assert r.status_code == 200 and len(r.json()["rows"]) == 24
    csv = c.get("/api/index", params={"p": "decision.csv", "date": "2026-01-15"})
    assert csv.headers["content-type"].startswith("text/csv")
    # Original path preserved: untouched
    assert c.get("/api/health").json()["status"] == "ready"
    assert c.get("/api/index", params={"p": "nope"}).status_code == 404
