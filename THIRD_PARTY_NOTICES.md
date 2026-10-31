# Third-party notices

- **ThreeUI "Sylva" hero** (`@designcodeio/threeui` 1.2.0): MIT License, Copyright (c) 2026 Meng To.
  Used files, verified by SHA-256 against the supplied integration brief: `frontend/public/landing-pages/inner-green-assets/*`
  (three.min.js, card-ethos.jpg, card-ecostove.jpg, lexend-latin.woff2) are byte-identical to the package;
  `frontend/src/vendor/threeui/pageRecipes.js` is unmodified; `LandingPages.js` and `pageTypography.js` carry two small marked `WindDesk:` edits (the iframe's accessible title says WindDesk instead of the demo brand; the iframe's initial blank document is not customised, which would otherwise trip the strict CSP);
  `frontend/public/landing-pages/inner-green-3d.html` is the canonical HTML with only visible copy replaced
  (reproducible with `python scripts/build_sylva_html.py`, which refuses to run unless the canonical file's hash matches).
  Licence texts: `frontend/src/vendor/threeui/LICENSE`, `FONT-LICENSES.md`, `THIRD_PARTY_NOTICES.md`.
- **Three.js** (bundled runtime in the scene, and the `three` npm package used by the hero): MIT License.
- **Lexend** font: SIL Open Font License 1.1 (text in `frontend/src/vendor/threeui/FONT-LICENSES.md`).
- **Space Grotesk, Inter** via `@fontsource-variable/*`: SIL Open Font License 1.1.
- **Elexon BMRS data**: Contains BMRS data © Elexon Limited copyright and database right.
