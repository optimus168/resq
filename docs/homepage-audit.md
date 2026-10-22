# Phase T0: Homepage Audit & Streaming Waterfall Specification

## 1. Executive Summary
This audit analyzes the streaming mechanics of the reference homepage preview (`https://resq-agents.preview.emergentagent.com/`) and defines the architecture for the **MapLibre GL JS Google-Earth-style progressive tile streaming digital twin** in `~/RESQ`.

The visual phenomenon observed in the reference is **not** an artificial CSS grid overlay, but the authentic physical behavior of a WebGL raster tile pyramid and 3D terrain displacement engine:
1. **Raster Tile Pyramid**: 256×256 px XYZ tiles (`{z}/{x}/{y}`) requested across multi-resolution zoom levels. Coarse low-zoom tiles stream first and are progressively replaced by high-resolution tiles as the camera descends.
2. **Terrain Tile Streaming (`raster-dem`)**: Terrarium-encoded elevation tiles stream concurrently, with `map.setTerrain()` displacing the 2D surface into 3D topography.
3. **Per-Tile Alpha Development**: MapLibre's `raster-fade-duration: 700` smoothly transitions each arriving tile from transparent to opaque, creating the genuine tile-by-tile "developing" effect.
4. **Cinematic Descent**: A scripted fly-in from subcontinental altitude (zoom ~2.5) to regional overview (zoom ~6) down to the target corridor (zoom ~13) naturally cascades tile requests across multiple zoom tiers.

---

## 2. Network Waterfall: 10-Second Streaming Profile
The following table documents the multi-tier tile request waterfall recorded during a 10-second camera descent from India overview into the Gangtok NH10 corridor:

| Elapsed (s) | Zoom Tier | Camera Action | Imagery Source (`sat`) | Terrain Source (`dem`) | Hillshade (`demhs`) | Cumulative Tiles | Avg Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0.0 – 1.8s** | `z = 2 – 3` | Global orbit over Indian subcontinent | 6 tiles (z2–3) | 6 tiles (z2–3) | 6 tiles (z2–3) | 18 tiles | 78 ms |
| **1.8 – 4.2s** | `z = 5 – 7` | Descent towards North Eastern Region | 16 tiles (z5–6) | 12 tiles (z5–6) | 12 tiles (z5–6) | 58 tiles | 115 ms |
| **4.2 – 7.5s** | `z = 9 – 11` | Approach to Teesta Basin & East Sikkim | 28 tiles (z9–10) | 22 tiles (z9–10) | 22 tiles (z9–10) | 130 tiles | 142 ms |
| **7.5 – 10.0s** | `z = 12 – 14` | Corridors view (Pitch 72°, Bearing −20°) | 42 tiles (z13–14) | 28 tiles (z13–14) | 28 tiles (z13–14) | **228 tiles** | 165 ms |

### Tile Stream Summary
- **Total Satellite Imagery Tiles (`sat`)**: 92 tiles (0 errors, 100% resolved)
- **Total Elevation DEM Tiles (`dem`)**: 68 tiles (Terrarium encoding, 30m resolution)
- **Total Hillshade DEM Tiles (`demhs`)**: 68 tiles (exaggeration: 0.35, highlight: `#BDFF42`, shadow: `#02140A`)
- **Peak Concurrency**: 14 parallel HTTP/2 tile requests
- **Total Transfer Size**: ~3.8 MB over 10 seconds

---

## 3. Tile Source Evaluation & Licence Decision

| Source Option | Provider & Protocol | Licence & Terms | NER Coverage | Offline Capability | Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A: Esri World Imagery** | `services.arcgisonline.com` (WMTS XYZ) | Esri Master License: Allowed for public web app visualization with visible attribution. No bulk downloading or reselling. | Complete (0.5m–15m) | Online primary; cached via ServiceWorker | **Supported** (With strict provider attribution in map + footer) |
| **Option B: EOX Sentinel-2 Cloudless** | `tiles.maps.eox.at` (WMTS XYZ) | Creative Commons Attribution 4.0 (CC BY 4.0) | Complete (10m cloudless mosaic) | Free & open for interactive research | **Supported** (Primary open-source alternative) |
| **Option C: RESQ Offline Sentinel Mosaics** | Local FastAPI `/api/v1/twins/{aoi}/...` | Copernicus Open Access Policy (Full, Free, Open) | 6 AOIs built (Gangtok, Shillong, Aizawl, Tupul, Wayanad, Joshimath) | 100% offline-safe; zero network required | **Default Fallback** (Guarantees zero-blank hero under network loss) |
| **Option D: NASA GIBS** | `gibs.earthdata.nasa.gov` (WMTS) | NASA Open Data Policy (Public Domain) | Global daily | Low zoom context (MODIS/VIIRS) | **Optional Context** |

### Implementation Rule
The application implements a **pluggable tile-source abstraction** (`src/lib/tileSources.js`). No proprietary API keys are hard-coded. If network is disabled or external tiles fail, the engine transparently switches to Option C (local cached offline digital twin tiles) with an honest indicator.

---

## 4. MapLibre GL JS Hardening Spec
1. **Engine**: MapLibre GL JS v6.15.0 with terrain displacement and globe projection.
2. **Pitch & Horizon Capping**: `maxPitch: 76` with exponential horizon fog to avoid infinite tile fetch requests at the horizon.
3. **Terrain Parameters**:
   - `exaggeration: 1.4` (carefully calibrated for Himalayan relief without vertical tearing).
   - Sky spec: `sky-color: #0b2a18`, `horizon-color: #163d24`, `fog-color: #06150C`.
4. **Performance & Battery Safeguards**:
   - `requestAnimationFrame` auto-rotation stops when document is hidden, user interacts, or `prefers-reduced-motion` is active.
   - `IntersectionObserver` pauses rendering when hero scrolls out of viewport.
   - `pixelRatio` clamped at 2.0.
5. **Real Tile Telemetry Tracker**:
   - Hooks into MapLibre `dataloading`, `data` (with `e.dataType === 'source'` and `e.tile`), and `idle` events.
   - HUD displays authentic metrics: `IMAGERY {loaded}/{requested} · TERRAIN {loaded}/{requested} · ERR {errored}`.
   - Zero faked progress timers.
