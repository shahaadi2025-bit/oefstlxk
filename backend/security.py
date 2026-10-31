"""Security and caching policy, shared by the API server (main.py) and the static hosting config (vercel.json).
A test keeps the two in sync."""

# Strict by default: no inline scripts, no eval, no remote origins.
# Inline style *attributes* only (React and Recharts set them).
STRICT_CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; "
    "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; "
    "base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
)

# Only for the self-hosted 3D scene under /landing-pages/ (single-file HTML with inline scripts),
# framed by our own page.
SCENE_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
)

PERMISSIONS_POLICY = (
    "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), "
    "magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()"
)
HSTS = "max-age=63072000; includeSubDomains"

COMMON_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Strict-Transport-Security": HSTS,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}

SCENE_PREFIX = "/landing-pages/"
IMMUTABLE = "public, max-age=31536000, immutable"  # content-hashed files under /assets/
SCENE_ASSETS = "public, max-age=604800"  # fixed names under /landing-pages/inner-green-assets/
API_CACHE = "public, max-age=300, stale-while-revalidate=600"  # data is a fixed snapshot


def headers_for(path: str) -> dict:
    scene = path.startswith(SCENE_PREFIX)
    return {
        **COMMON_HEADERS,
        "X-Frame-Options": "SAMEORIGIN" if scene else "DENY",
        "Content-Security-Policy": SCENE_CSP if scene else STRICT_CSP,
    }


def cache_for(path: str, status: int) -> str | None:
    if path == "/api/health" or (path.startswith("/api/") and status != 200):
        return "no-store"
    if path.startswith("/api/"):
        return API_CACHE
    if path.startswith("/assets/"):
        return IMMUTABLE
    if path.startswith(SCENE_PREFIX + "inner-green-assets/"):
        return SCENE_ASSETS
    return None
