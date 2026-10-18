# BhuRaksha × RESQ.AI — Autonomous Multi-Agent Landslide Intelligence Platform

**Smart India Hackathon 2026 Problem Statement:** [SIH26001] AI-Based Early Warning and Landslide Risk Monitoring System in India's North Eastern Region (NER)  
**Team:** RESQ · **Track:** Agentic AI (Infothon 7.0)  
**Prototype Status:** Decision-support and operational intelligence prototype (screening-level scenario model, not an official certified early warning service).

---

## 🌟 The Three "Wow Moments"

1. **Agents at Work, Visibly (14-Agent LangGraph DAG):**  
   An interactive, visible multi-agent DAG where every logical specialist agent (Supervisor, Sentinel, Terrain Geo, Risk Analyst, Simulation Twin, Verifier, Field Intel, Exposure, Infrastructure, Response Planner, Alert Comm, Dispatcher, Audit, Learner) lights up, reports execution latency, active tool calls, confidence scores, and structured evidence.

2. **3D Landslide Digital Twin Simulation:**  
   Real-terrain physics simulation across 4 North Eastern Region AOIs (Gangtok-NH10 Corridor, Shillong Bypass, Aizawl Ridge, Tupul/Noney). The digital twin dynamically simulates:
   $$\text{Rainfall Infiltration} \longrightarrow \text{Unsaturated Bucket Hydrology} \longrightarrow \text{Infinite-Slope Factor of Safety } (FS < 1.0) \longrightarrow \text{D8 Runout Debris Flow} \longrightarrow \text{OSM Highway \& Settlement Exposure}$$

3. **Autonomous Re-planning with a Backend-Enforced Human Gate:**  
   When the District Collector authorizes Plan V1, an external perturbation is injected (e.g., cloudburst escalation $+65\text{mm}$, or rockfall blocking NH10 KM-18). The **Verifier Agent** invalidates ground stability and route assumptions, triggering autonomous selective replanning. **Plan V2** is generated with a live structural diff ($\color{green}\text{+Added}$, $\color{orange}\sim\text{Changed}$, $\color{gray}=\text{Preserved}$), and backend RBAC strictly blocks stale approvals with HTTP 409 Conflict.

---

## 🛡️ Core Rules & Integrity Principles

1. **Deterministic Physics First:** LLMs never invent probabilities, Factor of Safety values, or runout extents. All authoritative geotechnical metrics are computed by closed-form physics engines (`backend/app/hydro_geotech/infinite_slope.py`) and empirical Caine intensity-duration thresholds.
2. **Visible Simulation Labeling:** All synthetic assets, simulated telemetry, and scenario runouts carry visible `SIMULATED / DEMO` badges and `simulated: true` JSON payload flags.
3. **Backend-Enforced Human Approval Gate:** Consequential actions (public evacuation orders, relief mobilization) require authenticated approval by an authorized role (`collector`), cryptographically bound to an immutable plan version.
4. **Append-Only SHA-256 Audit Chain:** Every system decision, agent trace, field report, and approval is written to a linear, tamper-evident cryptographic audit ledger verifiable from `GENESIS` to `HEAD`.
5. **Prompt-Injection Defense:** Untrusted field reports and citizen text inputs are sanitized and quarantined by a multi-pattern regex detector before reaching the LLM context.
6. **100% Offline Deterministic Operation:** Operates cleanly with zero paid API keys using local cached DEM tiles, Open-Meteo fallbacks, and deterministic LLM adapters.

---

## 🚀 Quickstart & Clean-Clone Execution

### Prerequisites
- Python 3.12+
- Node.js v20+ & npm

### Automated Commands (Makefile)

```bash
# 1. Run full automated test suite (27/27 tests passed)
make test

# 2. Build the production React + Three.js + Tailwind web application
make build

# 3. Run the complete deterministic end-to-end demonstration (< 5 seconds)
make demo

# 4. Launch the platform (FastAPI on :8000, Web Console on :3000)
make up
```

---

## 🗺️ Areas of Interest (AOIs) Implemented

| AOI Key | Region / State | Coordinates | Terrain Elevation | Strategic Lifeline |
|---|---|---|---|---|
| `gangtok` | Gangtok, Sikkim | 27.324° N, 88.611° E | 1,420 m – 1,850 m | NH-10 Highway Corridor (Lifeline to Siliguri) |
| `shillong` | East Khasi Hills, Meghalaya | 25.578° N, 91.893° E | 1,450 m – 1,720 m | Shillong Bypass & Umiam Corridor |
| `aizawl` | Aizawl, Mizoram | 23.727° N, 92.717° E | 850 m – 1,180 m | NH-54 Ridge Route |
| `tupul` | Tupul / Noney, Manipur | 24.708° N, 93.633° E | 480 m – 920 m | Jiribam-Imphal Railway Infrastructure |

---

## 🧪 Test Suite & Verification Matrix

The test suite covers 27 rigorous verification cases (`backend/tests/`):
- `test_auth.py` (6 tests): Health endpoint, valid JWT login, invalid password rejection, SHA-256 audit ledger hash chain integrity, RBAC role-denial enforcement, brute-force rate-limiting lockout.
- `test_terrain.py` (6 tests): Analytic plane slope derivation, flat terrain zero slope, lat/lon to grid cell projection, weather fallback handling, sensor anomaly simulation, AOI catalogue API endpoints.
- `test_simulation.py` (8 tests): Closed-form dry Factor of Safety, saturated FS, moisture monotonicity, flat terrain stability, mass conservation ($V_{\text{released}} = V_{\text{deposited}} + V_{\text{outflow}}$), runout reach monotonicity, simulation determinism, multi-criteria risk fusion.
- `test_agents.py` (3 tests): 14-agent registry and DAG integrity, full incident pipeline with version-bound Human Gate, Ask Mission Control grounded citations (`[incident:risk]`, `[NDMA-SOP]`).
- `test_replanning.py` (2 tests): Prompt-injection detector quarantine, dynamic replanning Plan V1 $\to$ Plan V2 with structural diff and stale approval HTTP 409 rejection.
- `test_reports.py` (1 test): PWA offline re-sync idempotence, spatial clustering, prompt injection defense, and officer verification.
- `test_alerts.py` (1 test): Alert lifecycle state machine with legal and illegal transition guards.

```bash
PYTHONPATH=. .venv/bin/pytest -v backend/tests/
# Result: 27 passed in 21.95s
```

---

## 👥 Role Accounts (Demo Credentials)

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Collector (Approver)** | `collector@bhuraksha.demo` | `Approve@RESQ26` | Human Approval Gate authorization, alert dispatch |
| **Incident Operator** | `operator@bhuraksha.demo` | `Operate@RESQ26` | Start incidents, trigger perturbations, run scenarios |
| **Geotech Analyst** | `analyst@bhuraksha.demo` | `Analyze@RESQ26` | Terrain & sensor telemetry inspection, model calibrations |
| **Field Officer** | `field@bhuraksha.demo` | `Field@RESQ26` | Verify citizen field reports, ground observations |
| **Citizen / Reporter** | `citizen@bhuraksha.demo` | `Citizen@RESQ26` | Submit geo-tagged observations via PWA |

---

## 🏛️ Regulatory & Academic Grounding
- **NDMA National Landslide Risk Management Strategy (Guidelines 2019)**: SOP-1 (Early warning dissemination), SOP-2 (Resource pre-positioning), SOP-4 (Post-event damage assessment).
- **Sendai Framework for Disaster Risk Reduction (2015–2030)**: Priority 1 (Understanding disaster risk) and Priority 4 (Enhancing disaster preparedness for effective response).
- **UN Sustainable Development Goals**: SDG 11 (Sustainable Cities and Communities) & SDG 13 (Climate Action).
