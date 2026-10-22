# Phased Implementation Plan & Verification Matrix

**Project:** RESQ.AI × BhuRaksha (NER Operational Deployment)  
**Execution Strategy:** Phase-by-phase strict verification. Phase $N+1$ cannot begin until Phase $N$ exit gate passes with executed command output.

---

## Phase Overview & Exit Gates

| Phase | Title | Core Deliverable | Exit Gate Verification Command | Status |
|---|---|---|---|---|
| **Phase 0** | **Audit, Probes & Decisions** | 5 repo audits, real data probes, mathematical physics model, architecture specs | `cat probe_results.json && test -f docs/architecture.md` | **PASS (Completed)** |
| **Phase 1** | **Platform Foundation** | Database models, migrations, auth (JWT, argon2/bcrypt), RBAC, hash-chained audit, API shell | `pytest tests/test_auth.py tests/test_audit.py` | **NEXT** |
| **Phase 2** | **Data & Geospatial Layer** | Terrarium DEM loader, D8 terrain derivatives (slope, aspect, TWI), OSM asset geometries, sensor simulator | `pytest tests/test_terrain.py tests/test_weather.py` | Queued |
| **Phase 3** | **Risk Intelligence** | Deterministic risk engine, Caine I–D threshold, physics FS fusion, SHAP driver explanations | `pytest tests/test_risk.py` | Queued |
| **Phase 4** | **Landslide Simulation Engine** | Digital twin: hydrology → infinite-slope FS → D8 angle-of-reach runout → PostGIS asset exposure | `pytest tests/test_simulation.py` | Queued |
| **Phase 5** | **Mission Control UI & 3D Twin** | MapLibre 3D terrain, deck.gl simulation particle drape, scrubber timeline, agent activity shell | Playwright E2E smoke test | Queued |
| **Phase 6** | **Agent Platform (Main Attraction)** | 14 LangGraph agents, assumption ledger, selective replanning (V1 → V2 diff), human approval gate | `pytest tests/test_agents.py tests/test_replanning.py` | Queued |
| **Phase 7** | **Field Intel & Alert Lifecycle** | PWA offline queue, prompt-injection defense, 4-language alert drafts, cited SOP assistant | `pytest tests/test_reports.py tests/test_alerts.py` | Queued |
| **Phase 8** | **Scenario Director & Demo Mode** | One-click deterministic story: Rain escalation → V1 → Approved → Road blocked → V2 diff → Re-approved | `make demo` or `pytest tests/test_scenarios.py` | Queued |
| **Phase 9** | **Hardening & Security** | RBAC permission denial, injection stress tests, audit integrity check, failure recovery | `pytest tests/test_security.py` | Queued |
| **Phase 10** | **Pitch Assets & Final Audit** | Final auditor report, clean-clone setup verification, Executive presentation deck | Independent verification suite | Queued |
