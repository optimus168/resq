# Smart India Hackathon 2026 — Pitch & PPT Content Document

**Problem Statement ID:** SIH26001  
**Problem Statement Title:** AI-Based Early Warning and Landslide Risk Monitoring System in NER  
**Organization / Ministry:** Ministry of Development of North Eastern Region (MDoNER)  
**Team Name:** RESQ  
**Product Name:** RESQ.AI × BhuRaksha  
**Domain / Track:** Agentic AI (Disaster Management)  
**Target Audience:** SIH Evaluation Panel, Screening LLM Evaluator, and Senior Disaster Officials

---

## Slide 1: Title Slide
- **Title:** RESQ.AI × BhuRaksha
- **Subtitle:** Agentic AI Landslide Intelligence, 3D Digital Twin Simulation & Autonomous Response-Coordination Platform for India's North Eastern Region
- **Problem Statement ID:** SIH26001 | **Category:** Software / Disaster Management
- **Ministry:** Ministry of Development of North Eastern Region (MDoNER)
- **Domain:** **Agentic AI**
- **Team RESQ:** Team Lead & Senior Full-Stack/ML Engineers
- **Core Motto:** *Detect. Simulate. Verify. Coordinate. Protect.*

---

## Slide 2: Problem Statement & Pain Points (Ground Reality in NER)
- **Geographic Vulnerability:** The North Eastern Region (NER) is globally among the most landslide-prone zones due to young Himalayan fold mountains, fragile schists/shales, active tectonics (Seismic Zone V), and extreme precipitation (>2,000–11,000 mm/year).
- **Core Operational Failures Today:**
  - **Blind Spots & Delayed Response:** Monitoring is predominantly reactive, relying on manual voice reports after lifelines (NH10, NH6, NH37) are already severed.
  - **No Downslope Physics (The Runout Blindspot):** Traditional models provide only a point-based static susceptibility score. They fail to simulate downslope debris flow path, runout distance, and time-to-impact for valley settlements.
  - **Static Decision Support:** Existing systems send isolated alerts but cannot dynamically re-route emergency convoys or re-plan when an evacuation route is suddenly blocked.
  - **Unverified Field Noise:** Citizen uploads and ground calls overwhelm emergency operations centres (EOC) with duplicates, false rumors, or prompt-injected inputs.

---

## Slide 3: Proposed Solution — Multi-Agent Orchestration & 3D Digital Twin
- **BhuRaksha Paradigm Shift:** Moving from a passive warning dashboard to an **Agentic AI Decision-Support Platform** with closed-loop autonomous coordination:
  - **1. LangGraph Multi-Agent Orchestration:** 14 specialized, role-bounded agents (Sentinel, Terrain, Field Intel, Simulation, Risk Analyst, Verifier, Impact, Route, Resource, Planner, Dispatcher, Learner, Assistant, Supervisor) collaborate over a shared typed state.
  - **2. 3D Landslide Digital Twin:** Real-terrain numerical simulation on AWS Terrarium/Copernicus 30m DEM executing coupled physics:
    $$\text{Hourly Rain } R(t) \to \text{Pore Saturation } m(t) \to \text{Infinite Slope } FS < 1.0 \to \text{D8 Angle-of-Reach Runout} \to \text{Asset Exposure}$$
  - **3. Autonomous Re-Planning with Human Gate:** When an unpredicted event occurs (e.g. key highway blocked or sudden rainfall spike), the Verifier invalidates affected assumptions, re-runs minimum affected agents, and generates **Plan V2** with an instant visual diff and fresh approval request.
  - **4. Cryptographic Human Gate & Tamper-Proof Audit:** Consequential actions (public SMS alerts, evacuation orders) strictly require District Collector sign-off; all actions are logged in an append-only SHA-256 hash-chained ledger.

---

## Slide 4: Technical Architecture & Innovation Stack
- **Frontend & 3D Visualization:**
  - Next.js 14 / React 18, TypeScript strict, Tailwind CSS, shadcn/ui.
  - MapLibre GL JS with 3D `raster-dem` terrain + deck.gl layer for animated debris particles and asset footprints.
  - Web Worker client-side port of Factor of Safety ($FS$) equations for instant 60fps parameter slider exploration.
  - React Flow interactive live agent execution graph with real-time tool trace feed.
- **Backend & Scientific Core:**
  - Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic.
  - NumPy / Numba accelerated numerical slope-stability and D8 flow routing engine.
  - LangGraph stateful supervisor with PostgreSQL / SQLite checkpointer.
  - Redis Streams event bus for asynchronous, idempotent event handling.
- **Geospatial & Data Layer:**
  - PostGIS geometry indexing, OSM vector infrastructure extracts (roads, settlements, shelters, hospitals).
  - Open-Meteo real-time 72h historical rainfall and 24h forecast ingestion.
  - Offline-first PWA with IndexedDB queue and background synchronization for zero-connectivity field reporting.

---

## Slide 5: Key Differentiators & Competitive Edge (Why BhuRaksha Wins)
1. **Agentic vs Static:** Other teams build simple ML prediction scripts or LLM wrappers. BhuRaksha implements a self-verifying, tool-using, multi-agent coordination loop with stateful replanning.
2. **Physics Grounding (Zero Hallucinated Numbers):** LLMs coordinate and summarize, but **never compute authoritative numbers**. Probabilities, Factor of Safety ($FS$), runout extents, and asset exposure counts come strictly from deterministic, unit-tested scientific code.
3. **Safety by Design (The Human Gate):** Public alerts and resource dispatches can never be autonomously triggered by an AI model. Backend authorization enforces version-bound District Collector approvals ($V_1$ approval cannot execute $V_2$).
4. **Field Resilience (Offline by Default):** Complete system runs offline with cached 30m DEM datapacks and procedural fallback. Citizen PWA records geo-tagged photos in airplane mode and idempotently syncs upon re-connection.
5. **Multilingual Inclusivity:** Native drafts in English, Hindi, Assamese, and Bengali adhering to NDMA/CAP standards with mandatory human-review safety flags.

---

## Slide 6: Feasibility, Impact & Rollout Roadmap
- **Social & Economic Impact:**
  - Direct protection for 45+ million citizens across 8 North Eastern states.
  - Pre-emptive closure of critical highways (NH10, NH6, NH37) saves civilian lives and prevents stranded supply convoys.
  - Reduces disaster relief expenditure by optimizing resource allocation and shelter staging.
- **Alignment with National & Global Frameworks:**
  - Sendai Framework for Disaster Risk Reduction (Target G: Early Warning Systems).
  - National Disaster Management Authority (NDMA) Landslide Guidelines.
  - UN Sustainable Development Goals (SDG 11: Sustainable Cities & Communities, SDG 13: Climate Action).
- **Phased Deployment Roadmap:**
  - **Phase 1 (Hackathon MVP):** 4 Critical AOIs (Gangtok, Shillong, Aizawl, Tupul), 14 agents, digital twin, offline demo mode.
  - **Phase 2 (Field Pilot - 6 Months):** Integration with State Disaster Management Authorities (SSDMA, SDMA Meghalaya), deployment of physical IoT piezometer arrays.
  - **Phase 3 (Regional Expansion - 18 Months):** Rollout across all 8 NER states, automated CAP/SACHET alert gateway integration.
  - **Phase 4 (National Scaling):** Expansion to Western Ghats and Himalayan states (Uttarakhand, Himachal Pradesh, Jammu & Kashmir).

---

## 10 Consideration Analysis (For Judge Q&A Defense)

### 1. Pain Points & Root Causes
- Current systems alert about *susceptibility* (where it might slide eventually), but disaster responders need *dynamic impact* (which road will be cut in 3 hours, which village needs evacuation, and which alternate route is safe).

### 2. Feasibility of Execution
- System requires zero paid API keys to operate; uses open Copernicus/AWS Terrarium DEM and Open-Meteo feeds. Demonstrable locally within 3 minutes via deterministic demo mode.

### 3. Impact & Relevance
- Over 80% of landslides in India occur in the NER and Western Ghats. Immediate adoption potential by MDoNER, NDMA, and Border Roads Organisation (BRO).

### 4. Scope of Innovation
- First platform to combine real-terrain 3D numerical runout modeling with an autonomous agentic re-planning loop and cryptographically verified audit trail.

### 5. Clarity of Problem Statement
- Solves all 7 official deliverables of SIH26001: rainfall monitoring, GIS heatmaps, ML prediction, citizen photo upload, multilingual alerts, offline sync, and dashboard.

### 6. Evaluator's Perspective
- Evaluators fear hallucinating LLMs. BhuRaksha guarantees that LLMs never calculate physics or risk scores; they only orchestrate validated tools.

### 7. Team Fit & Execution
- Multi-disciplinary synergy: Full-Stack Engineer, Geospatial Data Scientist, Agentic AI Systems Architect, and UI/UX Designer.

### 8. AI-Buildability Split (20/80)
- The 20% AI: Natural language coordination, situational briefings, multilingual translation, and report triage.
- The 80% Engineering: Numerical slope stability, D8 runout routing, PostGIS spatial indexing, cryptographic audit hashing, and idempotent state synchronization.

### 9. Data Availability & Fallback Strategy
- Primary: Real-time Open-Meteo and AWS Terrarium tiles.
- Fallback: Pre-packaged offline `.npz` DEM datapacks and procedural synthetic elevation generators ensuring 100% demo uptime under severe network blackout.

### 10. Tough Judge Questions & Direct Answers
- *Q: What if the LLM hallucinates an evacuation route or risk score?*  
  **A:** Impossible by architectural design. The route is computed deterministically via graph routing avoiding blocked cells. Risk is calculated via closed-form infinite-slope $FS$ and empirical I–D curves. The LLM only receives structured evidence and cannot alter numerical results.
- *Q: Why not use a single agent instead of 14 agents?*  
  **A:** Single agents suffer from context poisoning and prompt injection vulnerability. In BhuRaksha, the Field Intel agent handles untrusted citizen reports in an isolated sandbox, quarantining prompt injections before the Verifier or Planner ever sees the data.
- *Q: How does the system handle internet loss in remote hilly regions?*  
  **A:** Citizen reports are stored in IndexedDB on the PWA and automatically synchronized upon reconnecting. For district EOCs, the entire platform runs on a local cached datapack without requiring cloud connectivity.
