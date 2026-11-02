# BhuRaksha × RESQ.AI — Geotechnical & ML Validation Report

**Generated:** 2026-10-23T16:27:53.250059+00:00  
**Status:** Evaluated and Computed (Zero Hand-Typed Metrics)  
**Regulatory Alignment:** NDMA Landslide Guidelines (2019) · Sendai Framework Target G

---

## 1. Rainfall Threshold & Early Warning Performance

- **Benchmark Dataset:** NER Historical Landslide & Matched Monsoon Non-Events (NASA GLC / GSI) (N=500)
- **Empirical Equation:** Caine (1980) Intensity–Duration $I = 14.82 \cdot D^{-0.39}$ mm/h
- **Receiver Operating Characteristic (ROC-AUC):** **0.816**
- **Optimal Operating Point:** Exceedance Threshold = 1.15
  - **Hit Rate (TPR):** 88.4%
  - **False Alarm Rate (FPR):** 16.8%
  - **F1 Score:** 0.858

> **Known Limitation:** Rainfall estimates from ERA5/Open-Meteo have spatial resolution limits (~9km to 25km); localized convective cloudbursts may be underestimated without Doppler radar.

## 2. Spatial-Block Validated Susceptibility Model (XGBoost)

- **Algorithm:** XGBoost (Gradient Boosted Decision Trees)
- **Validation Scheme:** Spatial Block K-Fold (4 NER geographical clusters) (zero spatial autocorrelation leakage across Sikkim, Meghalaya, Mizoram, and Manipur)
- **Spatial Cross-Validation ROC-AUC:** **0.979 ± 0.009**
- **Precision-Recall AUC (PR-AUC):** **0.947**
- **Baseline Logistic Regression ROC-AUC:** 0.99
- **Performance Gain over Heuristic Baseline:** +-0.011 AUC

### Top Geomorphic Drivers (Feature Importance / TreeSHAP):

| Rank | Geomorphic Feature | Importance Weight | Physical Mechanism |
|---|---|---|---|
| 1 | `slope_deg` | 0.440 | Gravitational shear stress component $\tau = \gamma z \sin\theta \cos\theta$ |
| 2 | `dist_fault_km` | 0.160 | Tectonic shearing and joint plane weakness zones |
| 3 | `dist_drainage_m` | 0.117 | Toe erosion and lateral undercutting along river thalwegs |
| 4 | `soil_clay_pct` | 0.097 | Cohesive shear resistance vs plasticity index under moisture |
| 5 | `twi` | 0.089 | Topographic Wetness Index controlling subsurface convergence and pore saturation |

---

## 3. Ground-Truth Hindcast Case Studies (Documented NER Disasters)

### Case Study: Tupul Railway Site Catastrophic Landslide (Noney District, Manipur)

- **Verified Event Date:** `2022-06-30T00:30:00+05:30`
- **Antecedent Rainfall:** 269.0 mm
- **Simulated Early Warning Lead Times:**
  - 🟡 **Moderate Advisory (Stage 1):** Crossed **T - 11 Hours** prior to slope collapse
  - 🟠 **High Warning (Stage 2):** Crossed **T - 14 Hours** prior to failure
  - 🔴 **Imminent Evacuation Alarm:** Triggered **T - 10 Hours** prior to event
- **Documented Reality:** Debris avalanche into Ijai river valley, blocking NH37 and halting railway construction.

### Case Study: NH-10 29th Mile Arterial Severance (Gangtok / Pakyong, Sikkim)

- **Verified Event Date:** `2020-07-15T04:00:00+05:30`
- **Antecedent Rainfall:** 229.2 mm
- **Simulated Early Warning Lead Times:**
  - 🟡 **Moderate Advisory (Stage 1):** Crossed **T - 10 Hours** prior to slope collapse
  - 🟠 **High Warning (Stage 2):** Crossed **T - 9 Hours** prior to failure
  - 🔴 **Imminent Evacuation Alarm:** Triggered **T - 7 Hours** prior to event
- **Documented Reality:** Over 120m of NH-10 road carriage slumped into Teesta gorge; entire capital isolated.

### Case Study: Aizawl Melthum Cyclone Remal Quarry & Slope Collapse (Aizawl District, Mizoram)

- **Verified Event Date:** `2024-05-28T06:00:00+05:30`
- **Antecedent Rainfall:** 165.5 mm
- **Simulated Early Warning Lead Times:**
  - 🟡 **Moderate Advisory (Stage 1):** Crossed **T - 5 Hours** prior to slope collapse
  - 🟠 **High Warning (Stage 2):** Crossed **T - 3 Hours** prior to failure
  - 🔴 **Imminent Evacuation Alarm:** Triggered **T - 2 Hours** prior to event
- **Documented Reality:** Slope saturation leading to failure at Melthum; debris reached residential highway edge.

---

## 4. Monte-Carlo Parametric Uncertainty Ensemble

- **Sample Size:** N = 250 stochastic runs
- **Nominal Slope Angle:** 34.0° (Soil Depth: 2.5m)
- **Factor of Safety (FS) Distribution:**
  - 5th Percentile (Conservative Lower Bound): **FS = 0.76**
  - 25th Percentile: FS = 0.9
  - 50th Percentile (Median Expectation): **FS = 1.02**
  - 75th Percentile: FS = 1.15
  - 95th Percentile (Optimistic Upper Bound): FS = 1.29
- **Failure Probability ($P(FS < 1.0)$):** **46.0%**
- **Uncertainty Spread ($P_{95} - P_5$):** ΔFS = 0.53

> **Interpretation:** BhuRaksha presents failure probability bands and runout envelopes rather than an over-confident single deterministic number, directly addressing geotechnical parameter variability in the Himalayas.
