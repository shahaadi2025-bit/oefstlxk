# WindDesk 1.0: Release notes

WindDesk helps a UK power-buying desk answer two questions before the day-ahead buy: *which wind forecast did we actually have at the decision cutoff, and how much can we trust it?* It uses Elexon BMRS data for decisions made in January 2026 (delivery 2 January to 1 February).

## What you get
- **A landing page** that explains the approach in minutes: an interactive "when does your desk decide?" timeline, live accuracy figures, and a 3D wind scene.
- **Decision day:** the forecast available at the cutoff for any delivery day, with a P10–P90 range, a one-click CSV export, and a cover calculator that sizes the extra energy to buy at 80, 90, 95 or 99% confidence.
- **Month view:** all 31 delivery days at a glance; open any day in one click.
- **Accuracy:** average error, bias, 9-in-10 error range, error by hour, by wind level and by how far ahead the forecast was made, benchmarked against a naive guess.
- **Revisions:** how the forecast for a single hour changed from run to run, with the cutoff marked.
- **Data quality:** coverage and gaps are always visible.

## Reliability, security and privacy
- All traffic is HTTPS. The site makes no calls to third-party services, loads no external scripts, fonts or trackers, and sets no cookies.
- Strict browser security policies are enforced on every page; the 3D scene runs under a narrowly scoped exception.
- Inputs are validated and limited, the service is rate-limited, and error messages never reveal internal details.

## Performance and accessibility
- The 3D visuals load only when needed, so the dashboard opens fast. On a throttled mobile profile (Slow 4G, 4x slower CPU) the first paint arrived in under a second.
- Works on desktop, tablet and phone. Fully usable by keyboard with visible focus and a skip link. Automated accessibility scans found no issues on the landing page or any dashboard view. Animations stop for visitors who prefer reduced motion.

## What was tested
Complete user journeys (landing, dashboard, every tab, deep links, CSV export, error and loading states) on desktop, tablet and phone sizes in a clean browser session; keyboard-only navigation; reduced-motion mode; failure behaviour when the data service is unavailable; and security, header and dependency checks (no known vulnerabilities).

## Known limitations
- Data covers decisions made in January 2026 only.
- The decision cutoff is an assumption (default 09:00 UTC the day before delivery) and can be adjusted in the dashboard to match your real gate closure.
- The cover calculator is illustrative: it assumes flat demand and is not trading advice.
- Elexon describes its wind forecast as a peak-generation forecast and its outturn as an average, so part of any bias can come from the definitions rather than the weather.
- The glass-effect buttons are fully visible in Chromium-based browsers (Chrome, Edge) and appear flatter in Safari and Firefox; everything remains fully usable.
- After a long idle period, the first load may take a few extra seconds.

Contains BMRS data © Elexon Limited copyright and database right.
