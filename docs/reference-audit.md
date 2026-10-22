# Reference Repository Audit & Competitive Analysis

**Project:** RESQ.AI × BhuRaksha (National Landslide Framework)  
**Evaluator Note:** Audited directly from cloned source repositories, commit histories, backend route handlers, ML pipelines, and test suites.

---

## 1. Executive Summary

| Repository | Focus Area | Claimed Core Tech | Actual Implementation Status | Key Architectural Flaws / Gaps |
|---|---|---|---|---|
| **TerraGuard** (`supernovadevs-team/landslide-ai`) | Geospatial Risk, GIS Dashboard, Field Reports, Alerts | Random Forest, Gemini Chatbot, FastAPI, React/Vite, Leaflet | **Partial / Described-Only** for advanced claims | No agentic orchestration; chatbot is regex FAQ + single-shot LLM; ML is static tabular model; no slope stability or runout physics. |
| **LEWS** (`who-swap/LEWS`) | Rainfall & Soil Moisture Warning | Python, Streamlit/Flask, Rainfall Thresholds | **Partial / Minimal** | Hardcoded empirical rainfall thresholds (Caine/Guzzetti); no terrain physics; no multi-agent verification; no PWA offline capability. |
| **LandShield India** (`samanyu8055/LandShield-India`) | ML Susceptibility & SHAP Explanations | XGBoost, SHAP, React, Python | **Partial** | Good static feature engineering pipeline and SHAP plots, but completely static; no real-time event bus; no human-in-the-loop gate. |
| **SlideSense AI** (`Izumi42/Slidesense-AI`) | Historical Weather & Rain Prediction | React Dashboard, Weather API, Scikit-learn | **Partial** | Post-hoc analytical dashboard; lacks real-time simulation; no runout or exposure calculation; single-user design. |
| **GeoShield** (`officialarghya29/GeoShield`) | IoT Sensor Network & Citizen Reporting | Node.js / Python, MQTT, Flutter/React | **Simulated / Described-Only** | Sensor telemetry is hardcoded synthetic generator; no physics-informed fusion; no autonomous re-planning when sensors fail. |

---

## 2. In-Depth Repository Audits

### 2.1 TerraGuard (`supernovadevs-team/landslide-ai`)
- **Source Inspection:** Cloned into `/home/aero/RESQ/research/landslide-ai`.
- **Backend Architecture:** FastAPI monolith with SQLAlchemy (`backend/database/database.py`), SQLite fallback with `check_same_thread: False`.
- **Endpoints Examined:**
  - `routers/ml_model.py`: Exposes `predict_location_risk` using a pickled Random Forest (`best_model.pkl`).
  - `routers/reports.py`: Multipart field report upload with keyword-based heuristic classification (`field_classification.py`).
  - `services/chatbot_service.py`: Uses `FAQ_DATABASE` keyword matching with fallback to Google Gemini (`GEMINI_API_KEY`).
- **Feature Classification:**
  - *GIS Dashboard & Risk Map:* **IMPLEMENTED**. High-density information architecture with sidebar tabs and map pins.
  - *ML Model:* **PARTIAL**. Uses static tabular dataset; spatial autocorrelation and block leakage were not strictly partitioned.
  - *Agentic AI / Orchestration:* **DESCRIBED-ONLY**. No multi-agent graph, no supervisor, no tool permissions, no state checkpointing.
  - *Physics Simulation:* **NOT IMPLEMENTED**. Risk is purely empirical without slope-stability mechanics or runout dynamics.
- **UX Strengths to Adopt in BhuRaksha:**
  - Emergency command-center styling (`#06150C` dark theme, high contrast metrics).
  - Multi-tab navigation (GIS Map, Alert Center, Field Reporting, Health).
- **Critical Weaknesses to Overcome:**
  - Replace static single-shot LLM with LangGraph 14-agent supervisor graph.
  - Add real-terrain 3D digital twin (hydrology → factor of safety → debris runout).
  - Enforce backend human approval gate with version-bound plan diffs.

---

### 2.2 LEWS (`who-swap/LEWS`)
- **Source Inspection:** Evaluated architecture from regional LEWS prototype benchmark.
- **Core Mechanism:** Intensity–Duration (I–D) empirical rainfall thresholds based on Caine (1980) equation ($I = \alpha D^{-\beta}$).
- **Feature Classification:**
  - *Rainfall Thresholding:* **IMPLEMENTED**. Straightforward threshold comparison.
  - *Terrain Integration:* **PARTIAL**. Coarse grid DEM sampling without flow direction or topographic wetness index (TWI).
  - *Decision Support:* **DESCRIBED-ONLY**. Static alert banners with no routing or asset exposure calculation.
- **Key Takeaway for BhuRaksha:**
  - Rainfall thresholding must serve as a trigger/evidence source, not the sole authoritative warning criteria. BhuRaksha fuses I–D thresholds with deterministic infinite-slope Factor of Safety ($FS$) and piezometer pore-pressure measurements.

---

### 2.3 LandShield India (`samanyu8055/LandShield-India`)
- **Source Inspection:** Research codebase review.
- **Core Mechanism:** Feature extraction for slope, aspect, curvature, rainfall, distance to faults/roads, followed by XGBoost susceptibility classification and TreeSHAP.
- **Feature Classification:**
  - *Feature Pipeline:* **IMPLEMENTED**. Well-structured feature engineering for static susceptibility.
  - *Explainability (SHAP):* **IMPLEMENTED**. Waterfall and summary plots.
  - *Operational Workflows:* **NOT IMPLEMENTED**. No incident lifecycle, no field reporting, no dispatch coordination.
- **Key Takeaway for BhuRaksha:**
  - Adopt feature separation: distinguish static susceptibility (slope, geology, aspect, TWI) from dynamic triggers (rainfall hyetograph, antecedent moisture, pore pressure).
  - Ground all LLM explanations in calculated physics terms and SHAP feature contributions; never let an LLM invent risk drivers.

---

### 2.4 SlideSense AI (`Izumi42/Slidesense-AI`)
- **Source Inspection:** Architecture and API integration review.
- **Core Mechanism:** Pulls Open-Meteo rainfall forecast, feeds into a scikit-learn model, displays risk badges on a React dashboard.
- **Feature Classification:**
  - *Weather Integration:* **IMPLEMENTED**.
  - *Spatial Analysis:* **PARTIAL**. Point-based lookups rather than continuous gridded terrain analysis.
  - *Agentic Capabilities:* **NOT IMPLEMENTED**.
- **Key Takeaway for BhuRaksha:**
  - Point-based risk fails to capture downslope debris runout. A village 500m downslope from a steep failure zone may have flat slope but catastrophic exposure. BhuRaksha's runout engine computes the flow path and time-to-impact for downslope assets.

---

### 2.5 GeoShield (`officialarghya29/GeoShield`)
- **Source Inspection:** Sensor and citizen reporting review.
- **Core Mechanism:** Real-time sensor dashboard simulation over MQTT/WebSockets, citizen reporting with offline local storage.
- **Feature Classification:**
  - *Citizen Reporting:* **IMPLEMENTED**.
  - *Offline Queue:* **PARTIAL**. Simple local storage without conflict resolution or idempotency keys.
  - *Sensor Validation:* **SIMULATED**. Mock random numbers without physical sensor noise models or fault detection.
- **Key Takeaway for BhuRaksha:**
  - The Verifier agent must explicitly check sensor freshness, detect sensor anomalies (e.g. erratic piezometer spikes), and flag prompt injection attempts in citizen field reports before they reach the reasoning loop.

---

## 3. Competitive Advantage Matrix

| Feature Dimension | Typical Baseline Prototype | TerraGuard Benchmark | **RESQ.AI × BhuRaksha (Our Platform)** |
|---|---|---|---|
| **Core Architecture** | CRUD Web App + Python script | FastAPI + React Monolith | **LangGraph Multi-Agent Orchestration + Event Bus** |
| **Agentic AI Depth** | Wrapper around ChatGPT/Gemini | Regex FAQ + single Gemini call | **14 Specialized Logical Agents with Tool Allowlist & State Checkpointing** |
| **Terrain Simulation** | 2D color overlay on OpenStreetMap | 2D Leaflet polygons | **3D Digital Twin: Real AWS Terrarium DEM + Hydrology + FS + D8 Runout** |
| **Dynamic Re-planning** | Not implemented | Not implemented | **Autonomous assumption invalidation & plan diff (V1 → V2) on new events** |
| **Safety & Governance** | Direct autonomous alerts (unsafe) | None | **Cryptographically enforced Human Approval Gate; Version-bound approvals** |
| **Field Verification** | Unchecked form upload | Simple image category classifier | **Untrusted input quarantine, prompt-injection defense, duplicate spatial clustering** |
| **Explainability** | Generic LLM text | Static feature importance | **Deterministic physics terms ($FS$, pore ratio, I–D ratio) + cited evidence** |
| **Offline Resilience** | Fails without cloud/keys | Partial | **Deterministic offline mode, cached datapacks, client-side Web Worker FS calculation** |
