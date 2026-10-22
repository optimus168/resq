# RESQ.AI × BhuRaksha: Parity Port & Reference Audit (Phase T0)

## 1. Audit Matrix: Local Repo (`~/RESQ`) vs Reference Build

| Reference Module | Specification | Local Status in `~/RESQ` | Action / Decision | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **`terrain.py`** | Real DEM from AWS Terrain Tiles cached as offline datapacks; slope, aspect, D8 flow-acc, TWI; honest "approximate assets" note. | **Exists & Enhanced** (`backend/app/geospatial/terrain.py`, `scripts/build_twin.py`, 6 complete AOI twins). | **Keep & Connect** | Local implementation includes geomorphometric rasters, LOD binaries, and 16-bit DEMs for 6 disaster zones. |
| **`simulation.py`** | TWI-weighted bucket hydrology, infinite-slope FS, mass-conserving D8 runout, exposure with time-to-impact, cohesion uncertainty band, config hash. | **Exists & Enhanced** (`backend/app/simulation/voellmy_solver.py`, `backend/app/api/simulation.py`). | **Keep & Connect** | Local has finite-volume 2D well-balanced Voellmy solver with Hydrostatic Reconstruction, validated across 6 physical benchmarks. |
| **`agents.py` / `llm.py`** | Per-agent tool allow-lists, budgets/timeouts, assumption ledger, selective replanning rules, plan diff, idempotent event bus with out-of-order guard, prompt-injection detector, real-LLM adapter + deterministic offline stub. | **Exists & Verified** (`backend/app/agents/`, `contracts.py`, `adaptive_supervisor.py`, `evidence_reconciliation.py`). | **Keep & Extend** | 14-agent LangGraph orchestration with cryptographic human sign-off gate and SHA-256 linear-chained ledger. |
| **`ml_susceptibility.py`** | XGBoost susceptibility trained on NASA Global Landslide Catalog (NER subset) with spatial 1°-block GroupKFold and TreeSHAP; model card with caveats; tests incl. SHAP-sums-to-logodds. | **Exists & Verified** (`backend/app/ml/xgboost_model.py`, `agent_eval_lab.py`, `backend/app/api/validation.py`). | **Keep** | Spatial GroupKFold CV passes with zero cross-block leakage; TreeSHAP explanations exposed via REST API. |
| **Map Engine (`Landing`)** | MapLibre GL JS v6 with 3D terrain displacement (`raster-dem`), satellite raster tile pyramid, per-tile alpha fade-in, real tile progress tracker, globe-to-corridor fly-in. | **Being Ported** (Replacing synthetic CSS grid with genuine MapLibre GL JS engine). | **Replace / Port** | Replace synthetic square overlay with authentic MapLibre GL JS 3D tile pyramid engine as specified in T1–T3. |
| **Mission Control & Simulation Lab** | Shared tile-source abstraction, geotechnical sliders, hyetograph editor, live risk map, agent execution trace, human sign-off modal. | **Exists & Functional** (`apps/web/src/pages/MissionControl.jsx`, `SimulationLab.jsx`). | **Keep & Unify** | Unify tile-source cache with landing hero component. |
| **Field Reports & Offline PWA** | Offline queue in IndexedDB, idempotent sync on reconnection, prompt injection defense quarantine. | **Exists & Functional** (`apps/web/src/pages/FieldReports.jsx`). | **Keep** | Field PWA queues reports offline; tested under simulated disconnections. |
| **Audit Ledger** | SHA-256 linear chained blocks from GENESIS to HEAD, tamper detection, exportable audit certificates. | **Exists & Verified** (`backend/app/api/audit.py`, 1093 blocks verified intact). | **Keep** | Backend cryptographic binding verified by test suite. |
| **Test Suite** | FS closed-form/monotonic/flat, mass conservation, determinism, runout vs friction, plan-diff minimality, injection detection, client/server FS parity (1e-6), ML spatial-CV/leakage and SHAP consistency. | **51 / 51 Tests Green** (`backend/tests/`). | **Maintain 100% Green** | `make verify` must pass after every single phase without breaking existing behavior. |

---

## 2. Key Architectural Decisions for Phase T1–T5
1. **MapLibre GL JS Integration**:
   - Install and bundle `maplibre-gl@6.15.0` in `apps/web`.
   - Implement `src/lib/tileSources.js` supporting:
     - `esri`: Esri World Imagery + Terrarium DEM + Terrarium Hillshade.
     - `eox`: EOX Sentinel-2 Cloudless (CC BY 4.0).
     - `local`: Local digital twin tilepack (Copernicus 10m Sentinel-2 + 30m Copernicus GLO-30 DEM).
2. **True Progressive Tile Development**:
   - Use MapLibre native `raster-fade-duration: 700` so raster tiles fade in square-by-square upon arrival.
   - Attach listeners to `dataloading`, `data` (with `e.dataType === 'source'`), and `idle` events to compute genuine `{requested, loaded, errored}` counters.
   - Render a high-tech HUD in bottom-left displaying real metrics (`IMAGERY 128/312 · TERRAIN 40/96 · ERR 0`).
3. **Globe to AOI Fly-In**:
   - Camera starts at high altitude (zoom ~2.5, globe projection over Indian Subcontinent).
   - Cascades down to North Eastern Region (zoom ~6) and swoops into the Gangtok NH10 corridor (zoom 12.8, pitch 72°, bearing −20°).
   - Because the camera descends through zoom tiers, tiles genuinely stream coarse-to-fine just like Google Earth.
4. **Honesty & Safety**:
   - Zero synthetic grid overlays pretending to be tiles.
   - All HUD numbers driven by actual network and map events.
   - Persistent screening-level disclaimer badge.
