"""Tailor the ThreeUI "Sylva / living-green" hero copy to WindDesk.

Input : scripts/threeui/inner-green-3d.canonical.html (SHA-256 verified below, MIT, from @designcodeio/threeui 1.2.0)
Output: frontend/public/landing-pages/inner-green-3d.html

Only visible copy, aria labels and the page title/description are replaced. Structure, CSS, scene code,
motion and assets are untouched. Every replacement must match exactly once or the script stops.
    python scripts/build_sylva_html.py
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts/threeui/inner-green-3d.canonical.html"
OUT = ROOT / "frontend/public/landing-pages/inner-green-3d.html"
CANONICAL_SHA256 = "69c3694bd63f44ef9f007ebe4dac57a83e4402e0cdf6b54dd10b96dd4f05e197"

# (canonical text, WindDesk text). Numbers are facts about this project's data window, not invented figures.
REPLACEMENTS = [
    ("<title>Sylva — Into the living world</title>", "<title>WindDesk — Read the wind before you buy</title>"),
    ('aria-label="Sylva — home"', 'aria-label="WindDesk — home"'),
    ("<span>Grove</span>", "<span>Overview</span>"),
    ("<span>Habitats</span>", "<span>Accuracy</span>"),
    ("<span>Journal</span>", "<span>Method</span>"),
    ("<span>Enter</span>", "<span>Dashboard</span>"),
    ('aria-hidden="true">SYLVA</div>', 'aria-hidden="true">WIND</div>'),
    ('<p class="label">Our Ethos</p>', '<p class="label">Our method</p>'),
    ("<h2>Let the wild lead.</h2>", "<h2>Only what you knew.</h2>"),
    ('aria-label="Read about Sylva"', 'aria-label="Read about the WindDesk method"'),
    ('<i style="--d:260ms">Step into</i>', '<i style="--d:260ms">Read the wind</i>'),
    ('<i style="--d:360ms">the living world</i>', '<i style="--d:360ms">before you buy</i>'),
    ("We restore wild places through patient design, native planting, and a deeper kind of stewardship.",
     "See the forecast your desk had at the cutoff, how wrong it has been, and how much cover that implies."),
    ('<span class="lbl">Explore the work</span>', '<span class="lbl">Open dashboard</span>'),
    ('aria-label="Play the film"', 'aria-label="See how it works"'),
    ("<dt>Canopy restored</dt><dd>282 ha</dd>", "<dt>Delivery days</dt><dd>31 days</dd>"),
    ("<dt>Native species</dt><dd>43 mapped</dd>", "<dt>Hours evaluated</dt><dd>744 hours</dd>"),
    ('<p class="label">Field Note 07</p>', '<p class="label">Method note</p>'),
    ("<h2>After the Rain</h2>", "<h2>No look-ahead</h2>"),
    ('aria-label="Open field note: After the Rain"', 'aria-label="Open method note: No look-ahead"'),
    ('href="#">Discover<span class="track">', 'href="#">How it works<span class="track">'),
]
META = ('<meta name="description" content="Wind forecast evaluation for UK day-ahead power buying: the forecast available at the cutoff, '
        'how accurate it has been, and the cover it implies.">')

raw = SRC.read_bytes()
if hashlib.sha256(raw).hexdigest() != CANONICAL_SHA256:
    sys.exit("canonical source hash mismatch: refusing to continue")
html = raw.decode("utf-8")
for old, new in REPLACEMENTS:
    if html.count(old) != 1:
        sys.exit(f"expected exactly one match for: {old[:70]!r} (found {html.count(old)})")
    html = html.replace(old, new)
html, n = re.subn(r'<meta name="description" content="[^"]*">', META, html)
if n != 1:
    sys.exit("meta description not found exactly once")
OUT.write_text(html, encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)}: {len(REPLACEMENTS) + 1} replacements, {len(html.encode())} bytes")
