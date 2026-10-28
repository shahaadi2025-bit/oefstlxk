"""Run on a machine with internet to confirm the Elexon contract this app relies on:
    python scripts/probe_elexon.py"""
import httpx

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
CALLS = {
    "FUELHH": {"settlementDateFrom": "2026-01-05", "settlementDateTo": "2026-01-05", "fuelType": "WIND"},
    "WINDFOR": {"publishDateTimeFrom": "2026-01-05T00:00:00Z", "publishDateTimeTo": "2026-01-05T12:00:00Z"},
}
for ds, params in CALLS.items():
    r = httpx.get(f"{BASE}/{ds}/stream", params=params, timeout=120)
    body = r.json() if r.status_code == 200 else None
    rows = body.get("data", []) if isinstance(body, dict) else (body or [])
    print(f"{ds}: HTTP {r.status_code}, rows={len(rows)}")
    if rows:
        print("  keys:", list(rows[0].keys()))
        print("  first:", rows[0])
