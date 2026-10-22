<USER_REQUEST>
# RESQ.AI × BhuRaksha — Homepage rebuild, terrain-accurate overlays, and production hardening

> Paste this to the coding agent working in `~/RESQ`. Keep all existing tests and `make verify` green. Apply the master-prompt rules: truthfulness, SIMULATED labelling, no fabricated live statistics, backend-enforced human approval, screening-level honesty. Work in phases P0 → P5 and prove every exit gate with real command output, screenshots and measurements. **Do not claim a fix works until the automated alignment tests in Section 3 pass.**

## 0. Evidence from the team (read first)

Two reference captures were provided (save them to `docs/reference/` before starting):

1. **Our current homepage (screenshot, 3706×1946):** the hero shows a **flat world map** (Esri imagery, camera "Z2.8 · P25°"), the HUD reads `IMAGERY TILES 47/48 · TERRAIN DEM 0/49 · ERROR COUNT 1`, the tour bar shows AOI chips (Gangtok, Shillong, Aizawl, Tupul/Noney, Wayanad, Joshimath) with a progress bar near the start, and a status chip reads `IMMINENT (112 mm / 24h)`. There is **no 3D terrain visible at all** — the DEM source never loaded, the camera never left the world view, and the first impression is "just a world map".
2. **Reference build (video, 8.9 s, Gangtok–NH10):** from the very first frame it shows **real 3D mountains** with labels such as "Central Referral Hospital, Tadong" and shelter markers sitting **exactly on the terrain surface**; markers stay locked to features while the camera slowly moves. Weaknesses: very dark grading with a heavy black gradient over the lower half, random vertical "rain" lines, a text-heavy left column.

**Team verdicts:** (a) our homepage is "not at all interesting" and must show beautiful, stunning 3D terrain immediately; (b) in our app, **simulation plots appear to sit inside the mountains** (not accurate), whereas the reference's plots are accurate on top of the 3D surface. Needs a lot of improvement before production.

Observations to resolve (each must be addressed explicitly in your report):
- First paint must be the **3D terrain of a hero AOI, never a world map**.
- Terrain DEM tiles were **0/49** while imagery was 47/48 → terrain source/zoom/URL/`minzoom` bug; the camera is stuck in a state where DEM is never requested.
- `IMAGERY … ERROR COUNT: 1` shows on the production page — dev-style HUD should not dominate production.
- The `IMMINENT (112 mm / 24h)` chip appears **without a SIMULATED/SCENARIO label** — misleading on a public landing page. Must be labelled (e.g. `SCENARIO · SIMULATED FORCING · NOT A LIVE ALERT`).
- Hero copy claims "real Copernicus DEM terrain with Voellmy shallow-water physics". **Copy must match what is actually rendered and simulated.** If the display terrain is AWS Terrain Tiles (SRTM/Mapzen mix) while the simulation uses a different DEM, say so — and see Section 3: this mismatch is a prime suspect for plots "inside the mountains".
- Tiny low-contrast mono text (9–10 px) throughout the hero and HUD fails accessibility.

## 1. Goals

1. A **stunning, cinematic, 3D-terrain-first hero** that loads progressively like Google Earth *without ever showing a flat world map as the main view*.
2. **Pixel-accurate overlays** (villages, roads, shelters, hospitals, sensors, debris/runout, agent pins) that sit on the terrain surface and stay locked to it at every pitch, bearing and zoom.
3. A **production-ready** page: fast, accessible, resilient, secure, honest, branded.

## 2. Hero redesign (what "stunning" means here)

### 2.1 First paint and loading strategy
- **Instant poster:** ship a pre-rendered 3D-terrain poster of the hero AOI (2560×1440 AVIF/WebP + 1080×1920 mobile cut, captured from the real scene at golden-hour lighting). It is the LCP element and is visible immediately.
- **Live map takes over only when ready:** mount MapLibre in the background, start directly at the **hero-AOI 3D camera** (pitch 68–74°, bearing −20°, zoom ≈ 12.4–12.8), gate the cross-fade on "imagery + DEM tiles for the viewport loaded" (real tile events, or a 4 s timeout → keep poster + retry). Never reveal an unloaded map.
- **Optional intro (≤ 3.5 s, skippable, once per session via `sessionStorage`):** a short Earth→NER→AOI descent that **warms the AOI tiles first** (prefetch) and always ends on the AOI. Tiles still stream coarse→fine as the camera descends (the Google-Earth feel), but the user is never left on the world view. If the descent is slower than 3.5 s or any step stalls, jump to the AOI.
- **Fix the DEM bug:** terrain must be set and DEM tiles requested from the first frame at AOI zoom. Check `raster-dem` `minzoom/maxzoom/tileSize/encoding`, the Terrarium URL template (`{z}/{x}/{y}`), that `setTerrain` is called after the source is registered, and that a second DEM source is used for hillshade. The HUD must show DEM loading progress > 0 within 1 s of start.

### 2.2 Visual direction
- **Lighting and grading:** realistic sun direction from the real local time (SunCalc) with golden-hour bias; hillshade tuned for depth (not black); lift shadows; slightly desaturated satellite with a green/teal grade matching the Infothon palette (`#06150C`, `#BDFF42`, amber `#FFA31A`); atmospheric haze/fog by distance; subtle drifting cloud-shadow/mist layer. **Remove the heavy black gradient**; use only a soft left scrim behind the text and a thin bottom bar. The terrain should fill the whole viewport and look bright and detailed.
- **Weather:** replace random vertical lines with a depth-varied, angled rain canvas (cheap, GPU-friendly), enabled only when the live forecast or the selected scenario has precipitation; otherwise show light mist. Respect reduced motion.
- **Camera:** slow orbit with eased motion, gentle mouse parallax, and an **AOI tour** (the existing chip bar is a good idea): cinematic `flyTo` between AOIs every ~12–15 s, pause on hover/focus, keyboard operable. Chips show state/district; the bottom-right status shows coords, elevation range and relief for the current AOI.
- **Overlays on the terrain (all accurate, all labelled SIMULATED where applicable):**
  - villages/shelters/hospitals as crisp markers with leader lines and compact labels (collision-aware, no clutter);
  - roads draped on terrain with status colours and an animated "flow" line for the active evacuation route; blocked segments turn red with a dashed pattern;
  - simulated sensors as pulsing nodes (SIMULATED badge);
  - risk heat from the **real slope grid**;
  - the debris/runout animation **draped on the terrain** (see Section 3), with an animated front;
  - 2–3 agent annotation pins ("Sentinel: rainfall spike", "Verifier: cracks confirmed") with leader lines.
- **Composition:** top nav (How it works · Agents · Simulation · Validation · Sign in), left glass panel with a shorter headline and one-sentence value statement, primary CTA `Open Mission Control`, secondary `Simulation Lab`, tertiary `File a field report`. Truthful trust chips: `Decision-support prototype · simulated data where marked · not an official warning service`.
- **Tile HUD:** keep the real tile-streaming counters but make them **subtle in production** (small pill that shows `Streaming terrain… 94%` and fades after idle). Full HUD with error counts only under `?debug=tiles`. Errors never show as a red "1" on the public page; failed tiles retry silently with backoff.
- **Typography and spacing:** condensed display font for headlines, readable UI font for body, mono only for data; **minimum 12 px for any text**; 8-pt spacing grid; consistent icon set; motion via a single library (e.g. Framer Motion or GSAP ScrollTrigger) with smooth scroll; ultra-wide (3706×1946) and 4K layouts must scale text and panels sensibly.
- **Scroll story (single persistent map):** keep **one** MapLibre instance as a sticky background; chapters (*Problem → Watching → Predicting → Simulating → Coordinating → Human gate → Replanning → Trust & validation → Try it*) move the camera and swap overlays. Below the hero: agent constellation, live mini-Lab, validation teaser (only real metrics or clearly marked), data & credits, footer.

### 2.3 Honest content rules
- Every number on the page is real (from backend/eval runs), cited, or labelled `TARGET` / `ILLUSTRATIVE` / `SIMULATED`.
- Scenario chips: `SCENARIO (SIMULATED): 112 mm / 24 h forcing`. No fake live counters, logos or endorsements.
- Copy about DEMs/physics must match the implementation (see Section 3 decision on the single DEM).
- Respectful handling of real disasters (e.g. Tupul/Noney 2022, Wayanad/Chooralmala 2024, Joshimath): no casualty imagery, factual captions with citations; AOIs outside the NER are labelled as generality demos, with the NER as primary.

## 3. Terrain-accurate overlays (fix "plots inside the mountains")

### 3.1 Diagnose by measurement, not guesswork
Create `scripts/diagnose_alignment.mjs` (Playwright) and `docs/alignment-diagnosis.md`. For each AOI and ≥ 12 control points (hospital, shelter, village centroids, road vertices, runout footprint corners, sensor nodes) record: lon/lat, **rendered terrain elevation** (`map.queryTerrainElevation`, includes exaggeration), **simulation DEM elevation** at the same lon/lat, **marker/overlay anchor height**, and screen position at pitch 0 vs pitch 70 and exaggeration 0.01 vs current. Test and report on each hypothesis:
- **H1 Two different DEMs:** display uses AWS Terrain Tiles (SRTM/Mapzen mix, ~z13–14) while the simulation uses another DEM (e.g. Copernicus GLO-30 or a different tile zoom/resampling). Differences of tens of metres and horizontal shifts put overlays above or *below* the displayed surface.
- **H2 Exaggeration mismatch:** display terrain exaggeration (1.3–1.6) vs overlays computed at 1.0.
- **H3 Separate renderers:** a standalone Three.js mesh/scene (own heightmap, own scale) layered over or beside the MapLibre terrain, so the two never share a surface.
- **H4 CRS/orientation:** linear-lat mapping vs Web-Mercator rows, flipped rows, half-cell offsets, bounds computed from the wrong tile corner.
- **H5 Non-terrain-aware 3D:** extruded blocks/columns with base height 0 or sim-DEM height, not the rendered terrain height; custom/interleaved layers that render beneath terrain.
- **H6 Resampling:** sim grid downsampled/aggregated (e.g. 512→256 mean) so cell centres no longer match tile pixel centres.
State which hypotheses are confirmed with numbers (e.g. "RMS vertical offset 38 m; horizontal offset 1.4 cells").

### 3.2 Fix strategy (single source of truth)
1. **One DEM for display and simulation.** Preferred: build **Terrarium-encoded terrain tiles from the same DEM file the simulation uses** (Copernicus GLO-30 clip) for each AOI footprint via `make terrain-tiles AOI=<name>`, serve them locally (static/PMTiles/MBTiles) as the `raster-dem` source, and keep AWS Terrain Tiles only as the fallback outside AOI footprints. Alternative: drive the simulation from the *same* Terrarium tiles that render. Either way, display DEM = simulation DEM, at the same zoom and resampling. Record the chosen DEM and its licence/attribution in `docs/twin-data-provenance.md` and make the on-page copy match.
2. **One renderer for the surface.** All geospatial overlays live in the **same MapLibre scene** as the terrain. Retire the separate Three.js terrain mesh for anything that must align. (Keep Three.js only for non-geospatial effects.)
3. **Drape, don't float.** Points → MapLibre markers/`circle` layers (elevation-aware under terrain). Lines and polygons → GeoJSON `line`/`fill` layers draped on terrain. **Simulation fields (saturation, failure, debris depth, arrival time) → georeferenced raster/image sources on the same Mercator grid as the DEM tiles**, draped by MapLibre. Compute image corner coordinates from the exact tile bounds (Mercator), with correct row order and half-cell conventions; document the convention in `docs/georeferencing.md`.
4. **Vertical objects, if any** (debris height, extruded markers): derive base height from the *rendered* terrain (`queryTerrainElevation` or the same terrain tile texture sampled in a shader) × the active exaggeration, then add the feature height × exaggeration. Never use a different elevation source. If a library layer cannot follow terrain, don't use it.
5. **Hillshaded debris:** render debris depth as a coloured, semi-transparent draped raster with a hillshade-aware blend plus an animated front; optional faux-relief via a normal-map-style shading from the debris depth gradient.
6. **Constants in one module** (`terrainConfig`): exaggeration, tile zoom, DEM source, bounds, grid size, convention flags — used by both map and simulation exporters.

### 3.3 Automated alignment tests (must pass)
- **Elevation consistency:** for all control points, `|queryTerrainElevation(lon,lat)/exaggeration − simDEM(lon,lat)| ≤ 5 m` when both come from the same DEM (report the actual max/RMS).
- **Horizontal georeferencing:** project each control point to screen at pitch 0; the plotted overlay anchor must be within **1 DEM pixel** (≈ 10–15 m at z13–14) of the expected tile pixel; image-source corners round-trip within 1e-6° to the tile bounds.
- **Parallax test (the decisive one):** at pitch 0, change exaggeration from 0.01 to the production value; draped markers/overlays must not move in screen space (≤ 1 px). At pitch 70, rotate bearing across 360°; a marker's ground-projected lon/lat must stay constant (≤ 1 px of reprojected drift).
- **No-sinking test:** for every plotted overlay anchor, `anchorHeight ≥ renderedTerrainHeight − 0.5 m` (nothing under the surface); extruded features start at the rendered surface.
- **Visual spot checks:** annotated screenshots at pitch 45/60/72 and three bearings for each AOI with crosshairs at the control points; a reviewer-readable `docs/alignment-report.md` (images + numbers).
- **Simulation overlay registration:** a synthetic raster with a known pattern (grid lines at known lon/lat) rendered through the same pipeline must land on the expected terrain features (Playwright pixel test).

## 4. Production hardening checklist

- **Performance:** LCP < 2.5 s (poster), CLS ≈ 0, INP good; hero ≥ 50 fps on a discrete/Apple GPU and ≥ 30 fps on integrated (report real numbers); cap pixel ratio at 2; cap `maxPitch` and tile cache; pause rendering when hidden/off-screen; dynamic-import MapLibre/deck/three; route-split (current bundle ≈ 700 kB); `preconnect`/`dns-prefetch` for tile hosts; long-cache + immutable headers for local tiles/assets; compress poster/video (AVIF/WebP, WebM/MP4).
- **Resilience:** WebGL-unavailable and context-loss fallback (poster/video + all text/CTAs), offline tile pack (service worker or local PMTiles) for the hero AOI, retry/backoff on tile errors, visible-but-quiet degraded state, error boundaries, 404 page, loading skeletons. No blank hero ever.
- **Accessibility (WCAG 2.2 AA):** skip link, landmarks, keyboard-operable tour chips and chapters, `aria-live` for streaming status, ≥ 12 px text, sufficient contrast (checked), focus states, reduced-motion path (no orbit, no flash, static poster), captions/text equivalents for animation, no flashing, colour-blind-safe risk encoding (text + pattern + colour).
- **Security and privacy:** no secrets in the repo (a previous chat leaked an `EMERGENT_LLM_KEY` and `JWT_SECRET` — treat them as compromised, rotate, load from environment, add a secret-scan step in CI); production build must **hide demo credentials** on the login page (show only when `VITE_DEMO_MODE=true`); security headers/CSP allowing only required tile/API hosts; no third-party hotlinked images (host the login image locally with licence recorded); cookie flags; rate limits; no analytics/tracking without consent.
- **SEO/branding:** title, meta description, canonical, Open Graph/Twitter card (1200×630 from the hero poster), favicon set, web manifest, `robots.txt`.
- **Licences and attribution:** correct, visible attribution for imagery, terrain, OSM, weather; **verify Esri World Imagery terms** (account/key requirements, caching/offline limits) and use the tile-source abstraction with fallbacks (EOX Sentinel-2 cloudless, own Sentinel-2 tiles, NASA GIBS) so the page works without Esri; record decisions in `docs/homepage-data.md`.
- **Cross-browser/device:** Chrome, Edge, Firefox, Safari (verify sky/fog/globe/terrain support and degrade gracefully), iOS/Android mid-range, 1366×768, 1080p, 1440p, 4K and ultra-wide (3706×1946).
- **Observability:** client error logging (privacy-safe), tile error rate metric, web-vitals reporting to the backend, health endpoint, build/version stamp in the footer.
- **Code quality:** lint/typecheck/tests in CI, no dead dev UI in production, environment-based flags (`debug=tiles`, demo mode), README section for the homepage and tile pack.

## 5. Phased plan and exit gates

### P0 — Audit and diagnosis (no new features)
Save the screenshot and video to `docs/reference/`. Reproduce the "world map only / DEM 0/49" state and capture the network waterfall. Run `diagnose_alignment.mjs` for all AOIs and publish `docs/alignment-diagnosis.md` with measured offsets per hypothesis. Audit contrast/size/perf of the current page. Decide DEM strategy and tile-source strategy.
**Gate:** reproducible failure evidence; confirmed root cause(s) with numbers; written fix plan.

### P1 — Terrain single source of truth
Implement 3.2 (same DEM for display and simulation, terrain-tile builder, `terrainConfig`, georeferencing doc, draped overlays, retire misaligned Three.js surface where applicable).
**Gate:** all 3.3 tests pass for every AOI; `docs/alignment-report.md` with annotated screenshots and max/RMS numbers.

### P2 — Hero rebuild
Implement 2.1–2.2: poster-first, 3D AOI start, DEM fix, optional short intro, AOI tour, lighting/grading, weather, overlays, subtle HUD, composition and typography.
**Gate:** screenshots at 1440p, 4K, ultra-wide, tablet, phone; a screen recording showing 3D terrain from the first frame, coarse→fine streaming, and overlays locked to terrain through a full orbit; tile waterfall showing DEM + imagery streaming.

### P3 — Scroll story and sections
Single persistent map, chapters, agent constellation, mini-Lab (uses the aligned overlay pipeline), validation teaser, credits.
**Gate:** recorded walk-through by scroll and keyboard; zero dead CTAs; axe-core clean.

### P4 — Production hardening
Implement Section 4. Build offline tile pack/PMTiles, security headers, SEO assets, demo-mode gating, CI secret scan, bundle splitting, cross-browser checks.
**Gate:** Lighthouse (performance/accessibility/best practices/SEO) real numbers; bundle-size before/after; offline run; Safari/Firefox evidence; 5-minute memory-growth check.

### P5 — Collateral and final audit
4K stills (day, rain, dusk, runout), 20–30 s hero loop with credits burned in, mobile cut, before/after comparison document, final requirement matrix (requirement → implementation → proof → PASS/PARTIAL/FAIL), known issues list.
**Gate:** `make verify` green; assets saved; honest report.

## 6. Acceptance checklist (all must be demonstrably true)

- [ ] First paint is 3D terrain (poster) and the live map shows 3D mountains within the loading budget; the world map is never the resting view.
- [ ] DEM tiles load from the first frame; HUD shows real DEM progress.
- [ ] Display DEM equals simulation DEM (or provably equivalent); on-page copy matches.
- [ ] All overlays are draped or terrain-anchored; alignment, parallax and no-sinking tests pass for every AOI.
- [ ] Simulation runout/debris appears **on** the terrain, not inside it, at every pitch/bearing.
- [ ] Scenario/status chips are labelled SIMULATED/SCENARIO; no unlabelled `IMMINENT` on the landing page.
- [ ] No text under 12 px; accessibility and reduced-motion paths verified.
- [ ] Production build hides demo credentials; no secrets or hotlinked assets; attribution correct; tile-source terms verified.
- [ ] Performance, resilience and cross-browser evidence recorded.

## 7. Report format
At the end of every phase: files changed; commands run with real output (including failures); tests added/run with pass/fail counts; gate checklist PASS/FAIL; known defects, assumptions, simulated components, `NOT IMPLEMENTED` items; plan for the next phase. Cut breadth before honesty: keep labels, credits, real counters and tests.

**Begin with P0 now. Show the reproduced failure, the alignment diagnosis numbers and your DEM/tile-source decision before building anything new.**
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-19T08:53:54Z.
</ADDITIONAL_METADATA>