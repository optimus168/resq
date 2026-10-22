# Feature Traceability Matrix — National Landslide Framework × BhuRaksha

**Mission Directive:** AI-Based Early Warning and Landslide Risk Monitoring System in NER  
**Team:** RESQ · **Product:** BhuRaksha · **Domain:** Agentic AI

---

| Operational Mandate Requirement | Reference Baseline | BhuRaksha Implemented Component | Agent / Service Owner | Implementation Path / Proof | Status |
|---|---|---|---|---|---|
| **a. Collect & analyse rainfall patterns** | Open-Meteo & IMD (TerraGuard, SlideSense) | Real-time Open-Meteo adapter + 72h historical rainfall + antecedent hyetograph | Sentinel Agent (`tool_weather`) | `backend/integrations/weather.py`, `tests/test_weather.py` | **IMPLEMENTED** |
| **a. Soil moisture & geotechnical sensors** | Mock JSON generator (GeoShield) | Simulated piezometer ($r_u$) & tilt sensor telemetry with physical anomaly injection | Sentinel Agent (`tool_sensors`) | `backend/integrations/sensors.py`, `tests/test_sensors.py` | **IMPLEMENTED (SIMULATED)** |
| **a. Satellite imagery & terrain DEM** | 2D tile images (TerraGuard) | AWS Terrarium / Copernicus DEM (256x256 grid, ~30m resolution), slope, aspect, TWI, curvature | Terrain/Geo Agent (`load_terrain`, `derive`) | `backend/geospatial/terrain.py`, `tests/test_terrain.py` | **IMPLEMENTED** |
| **a. Historical landslide records** | Static CSV catalog (LandShield) | Open inventory events mapped to AOIs (Gangtok, Shillong, Aizawl, Tupul) with citations | Risk Analyst Agent | `backend/data/historical.py`, `docs/data-provenance.md` | **IMPLEMENTED** |
| **b. AI/ML risk zones & prediction** | Tabular Random Forest (TerraGuard) | Multi-criteria deterministic risk engine fusing static susceptibility, Caine I–D threshold, & physics FS | Risk Analyst Agent (`tool_risk`) | `backend/ml/risk_engine.py`, `tests/test_risk.py` | **IMPLEMENTED** |
| **b. 3D Digital Twin Simulation** | None (Described-only in literature) | Physics-based numerical simulation: hydrology bucket → infinite-slope FS → D8 angle-of-reach runout | Simulation Agent (`run_simulation`) | `backend/simulation/twin.py`, `tests/test_simulation.py` | **IMPLEMENTED (SCREENING)** |
| **c. Real-time alerts to authorities** | Mock SMS (TerraGuard, GeoShield) | Audited alert lifecycle (Draft → Pending Approval → Approved → Dispatched) with simulated delivery | Dispatcher Agent (`alert_service`) | `backend/services/alerts.py`, `tests/test_alerts.py` | **IMPLEMENTED** |
| **c. Multilingual alert generation** | English only or static dictionaries | English, Hindi, Assamese, Bengali localized drafts with human review flag and glossary preservation | Dispatcher Agent (`translate.draft`) | `backend/services/translation.py`, `tests/test_i18n.py` | **IMPLEMENTED** |
| **d. GIS mapping of roads & villages** | Leaflet 2D points (TerraGuard) | Real terrain 3D map (MapLibre / deck.gl) with OSM roads, settlements, shelters, and hospitals | Frontend Map Component | `apps/web/src/components/map/`, `tests/test_exposure.py` | **IMPLEMENTED** |
| **d. Asset exposure & time-to-impact** | None in reference repos | PostGIS spatial intersection of runout footprint buffer with roads & villages; calculates arrival time $t_{impact}$ | Impact/Exposure Agent (`exposure`) | `backend/geospatial/exposure.py`, `tests/test_exposure.py` | **IMPLEMENTED** |
| **e. Geo-tagged citizen/field uploads** | Form upload without security (TerraGuard) | PWA field report with GPS, category, photo upload, duplicate detection, and prompt-injection quarantine | Field Intel Agent (`triage`) | `backend/services/reports.py`, `tests/test_reports.py` | **IMPLEMENTED** |
| **f. Interactive dashboards** | Standard React dashboards | Command Center with 3D twin, React Flow agent graph, live trace feed, and Plan diff panel | Frontend UI (`apps/web/`) | `apps/web/src/pages/MissionControl.tsx`, Playwright E2E | **IMPLEMENTED** |
| **g. Cloud architecture & offline sync** | Single server, fails offline | Service worker PWA offline queue + backend deterministic cached datapacks (zero external dependencies) | PWA & Offline Engine | `apps/web/public/sw.js`, `tests/test_offline.py` | **IMPLEMENTED** |
| **h. Autonomous Agentic Coordination** | Single-shot script or basic chatbot | 14-agent supervisor graph, typed state checkpointer, Redis event bus, selective replanning on events | Orchestrator Agent (`Runner`) | `backend/agents/`, `tests/test_agents.py` | **IMPLEMENTED** |
| **i. Human-in-the-Loop Governance** | None (dangerous auto-action or static UI) | Backend-enforced cryptographic gate: Collector/Admin role required, version-bound approvals, no double approval | Approvals Service (`decide`) | `backend/services/approvals.py`, `tests/test_approvals.py` | **IMPLEMENTED** |
| **j. Auditability & Explainability** | None or plain print logs | SHA-256 hash-chained tamper-evident audit ledger + cited evidence Q&A assistant | Audit Service & Assistant Agent | `backend/core/audit.py`, `tests/test_audit.py` | **IMPLEMENTED** |
