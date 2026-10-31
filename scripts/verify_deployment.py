"""Post-deployment verification for a live WindDesk URL (standard library only).

    python scripts/verify_deployment.py https://your-app.vercel.app
    python scripts/verify_deployment.py http://localhost:8000 --allow-demo     # local run against synthetic data

Checks security headers, scene-path policy, caching, that the served page references only assets that exist (no stale
build), the integrity of the third-party scene assets, API behaviour and error handling. Exit code 1 if anything fails.
"""
import hashlib
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "backend"))
import security  # noqa: E402

ASSET_SHA256 = {
    "/landing-pages/inner-green-assets/three.min.js": "8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271",
    "/landing-pages/inner-green-assets/card-ecostove.jpg": "70ce084084902bc502f00c366405b661ecdff90dee95d363b36a6e146829e433",
    "/landing-pages/inner-green-assets/card-ethos.jpg": "337627390f499b3ae272cec9e2f83c817694a82f42e1aa10a7b26a2c7d679dff",
    "/landing-pages/inner-green-assets/lexend-latin.woff2": "1ec8f6ee2750554b4bc59ff0b507d316a82a7ba37e0e5bebc41d3bd9b9faad46",
}
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail and not ok else ""))


def get(url, headers=None, method="GET"):
    req = urllib.request.Request(url, headers={"User-Agent": "winddesk-verify", **(headers or {})}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


def main(base, allow_demo):
    base = base.rstrip("/")
    https = base.startswith("https://")
    print(f"Verifying {base}\n")

    print("Pages and headers")
    status, h, body = get(base + "/")
    html = body.decode("utf-8", "replace")
    check("home page loads", status == 200 and "text/html" in h.get("content-type", ""), f"status {status}")
    check("strict CSP, exactly as designed", h.get("content-security-policy") == security.STRICT_CSP, h.get("content-security-policy", "missing"))
    csp = h.get("content-security-policy", "")
    check("CSP has no unsafe-eval, no wildcard, no inline scripts", "unsafe-eval" not in csp and "*" not in csp and "script-src 'self';" in csp)
    for k, v in security.COMMON_HEADERS.items():
        if k == "Strict-Transport-Security" and not https:
            continue
        check(f"header {k}", h.get(k.lower()) == v, h.get(k.lower(), "missing"))
    check("header X-Frame-Options DENY", h.get("x-frame-options") == "DENY", h.get("x-frame-options", "missing"))
    check("HTML is revalidated, not cached forever", "immutable" not in h.get("cache-control", ""), h.get("cache-control", "missing"))
    check("page title is set", "<title>WindDesk" in html)

    print("\nNo stale build (every referenced file exists, content-hashed assets cached)")
    refs = sorted(set(re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)))
    check("page references built assets", len(refs) >= 2, f"found {len(refs)}")
    for ref in refs:
        s, hh, _ = get(base + ref)
        check(f"{ref} -> 200, immutable", s == 200 and "immutable" in hh.get("cache-control", ""), f"{s} {hh.get('cache-control', '')}")

    print("\n3D scene path (the only relaxed policy)")
    s, hh, _ = get(base + "/landing-pages/inner-green-3d.html")
    check("scene page loads", s == 200, str(s))
    check("scene uses its own CSP", hh.get("content-security-policy") == security.SCENE_CSP)
    check("scene frameable only by this site", hh.get("x-frame-options") == "SAMEORIGIN" and "frame-ancestors 'self'" in hh.get("content-security-policy", ""))
    for path, want in ASSET_SHA256.items():
        s, hh, data = get(base + path)
        check(f"{path.rsplit('/', 1)[1]} unmodified (SHA-256)", s == 200 and hashlib.sha256(data).hexdigest() == want)
    check("scene assets cached", "max-age" in get(base + "/landing-pages/inner-green-assets/three.min.js")[1].get("cache-control", ""))

    print("\nAPI behaviour")
    health = {}
    for _ in range(30):
        s, hh, data = get(base + "/api/health")
        health = json.loads(data) if s == 200 else {}
        if health.get("status") == "ready":
            break
        time.sleep(2)
    check("data service ready", health.get("status") == "ready", json.dumps(health))
    check("health response exposes no internals", set(health) == {"status", "error", "demo_data"})
    check("serving real data, not the synthetic demo", allow_demo or health.get("demo_data") is False)
    check("health is never cached", get(base + "/api/health")[1].get("cache-control") == "no-store")
    s, hh, data = get(base + "/api/accuracy")
    acc = json.loads(data) if s == 200 else {}
    check("accuracy endpoint returns the full window", acc.get("summary", {}).get("n", 0) >= 700)
    check("API responses are cacheable", "max-age=300" in hh.get("cache-control", ""))
    s, _, data = get(base + "/api/decision?date=2026-01-15")
    check("decision day has 24 hourly rows", s == 200 and len(json.loads(data).get("rows", [])) == 24)
    s, hh, data = get(base + "/api/decision.csv?date=2026-01-15")
    check("CSV export works", s == 200 and "text/csv" in hh.get("content-type", "") and "decision_2026-01-15.csv" in hh.get("content-disposition", ""))

    print("\nHardening")
    check("invalid date rejected (422)", get(base + "/api/decision?date=nonsense")[0] == 422)
    check("oversized input rejected (422)", get(base + "/api/decision?date=" + "x" * 400)[0] == 422)
    check("out-of-range hour rejected (422)", get(base + "/api/accuracy?cutoff_hour=99")[0] == 422)
    s, _, data = get(base + "/api/does-not-exist")
    check("unknown route is a clean 404", s == 404 and b"Traceback" not in data and b"/srv" not in data)
    check("API docs not public", get(base + "/docs")[0] == 404 and get(base + "/openapi.json")[0] == 404)
    s, hh, _ = get(base + "/api/health", {"Origin": "https://evil.example"})
    check("no CORS access for foreign origins", "access-control-allow-origin" not in hh)
    check("write methods rejected", get(base + "/api/health", method="DELETE")[0] in (404, 405))

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed")
    return passed == len(results)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    sys.exit(0 if main(args[0], "--allow-demo" in sys.argv) else 1)
