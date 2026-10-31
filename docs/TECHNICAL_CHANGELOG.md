# Technical changelog (production hardening)

## Backend
- `backend/security.py` (new): single source of truth for CSP (strict + 3D-scene variant), HSTS, Permissions-Policy, COOP/CORP, nosniff, referrer and cache policy.
- `backend/main.py`: one guard middleware (rate limit per client IP, sanitised 500s, security and cache headers on every response incl. errors); gzip; optional `ALLOWED_HOSTS`; `/docs` and `/openapi.json` disabled unless `ENABLE_DOCS=1`; generic user-facing data errors (details logged server-side only); refuses `DEMO_MODE` when `VERCEL_ENV`/`APP_ENV` is `production`; `max_length` on string inputs; `/api/health` no longer exposes `source`.
- Tests: 27 -> 38 (error sanitising, 429 + Retry-After, header set, cache policy, CORS, docs hidden, input limits, production demo refusal, `vercel.json` kept in sync with `security.py`).

## Frontend
- Error text is never raw: network failures and server errors are replaced with fixed messages.
- `useApi` rewritten to derive loading state (no state set inside effects) while keeping previous data on screen during refetch.
- Accessibility: skip link, `<main>` landmarks, one `h1` per view, panel titles as `h2`, contrast raised on small text, iframe title, visible focus. axe-core (WCAG 2.0/2.1 A/AA + best practices): 0 violations on the landing page and every dashboard view.
- Tablet layout: tab bar moves to its own row at <= 1000 px.
- Page metadata: title, description, theme-color, Open Graph, SVG favicon, `robots.txt`, `noscript` message.
- Fonts reduced to Latin and Latin-Extended subsets (4 files, was 10+); unused dependency `tw-animate-css` removed.
- Third-party scene: two marked edits to vendored files (accessible title; skip customising the blank initial iframe document, which tripped the strict CSP). Console is clean.
- ESLint added (`npm run lint`); TypeScript pinned to 5.9 (required by typescript-eslint); `build.chunkSizeWarningLimit` set for the lazy three.js chunk.
- Loading panel copy made client-appropriate.

## Hosting config
- `vercel.json` headers generated from `security.py`: strict policy everywhere except `/landing-pages/*`; immutable cache for `/assets/*`; one-week cache for scene assets.
- `scripts/verify_deployment.py` (new): 37 checks against any URL.
- `.env.example` documents every variable; none is secret.

## Commands run (all green)
    cd backend  && ruff check . && pytest -q && pip-audit -r requirements.txt && pip-audit -r ../requirements.txt
    cd frontend && npm run lint && npm run typecheck && npm test && npm run build && npm audit
    python scripts/verify_deployment.py http://localhost:8140 --allow-demo      # 37/37 (local, synthetic data)
Browser QA (headless Chromium, production build, strict CSP active): all routes and tabs, deep links, CSV export, scene mount and click-through, keyboard order and skip link, reduced motion, tablet and phone viewports, Slow-4G/4x-CPU load, data-service-down state (user sees only a generic message), axe-core scans.

## Deployment steps
1. Commit and push. In Vercel, no environment variables are required (do not set `DEMO_MODE`).
2. `vercel deploy --prod --yes`
3. `python scripts/verify_deployment.py https://<production-url>` (must end `N/N checks passed`).
4. Open the URL in a private window and click through landing, dashboard tabs, Month wheel, CSV export.
5. Optionally confirm headers in browser dev tools (Network, select the page, Response Headers) or a header scanner.
6. Rollback: promote the previous deployment in the Vercel dashboard.

## Known limitations / not verified here
- Production deployment and live-URL verification are performed by the account owner (steps 2-4).
- Tested in headless Chromium only; Safari, Firefox and physical devices are untested.
- Rate-limit counters are per server instance; use platform firewall rules for global limits.
- `style-src-attr 'unsafe-inline'` remains (inline style attributes from React/Recharts); scripts are never inline outside the scene path.
