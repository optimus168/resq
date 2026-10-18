# Landslide Digital Twin: Numerical Simulation Specification

**Model Status:** Screening-level scenario simulation — not a validated engineering hazard assessment.  
**Execution Environment:** Deterministic, seedable, Numba/NumPy accelerated on backend; bit-for-bit mirrored in client-side Web Worker.

---

## 1. Mathematical Formulation

### 1.1 Hydrology & Infiltration (Bucket Diffusion with Topographic Focusing)
Infiltration is modeled as a time-stepped unsaturated storage bucket per cell driven by the hourly hyetograph $R(t)$ (in mm/h) and antecedent saturation $m_0$:

$$\Delta m(t) = \frac{R(t) \cdot f_{\text{infil}}}{1000 \cdot n_{\text{soil}} \cdot z(\beta)} \cdot w_{\text{TWI}}$$

$$m(t) = \mathrm{clip}\left( m(t-1) \cdot (1 - d_{\text{drain}}) + \Delta m(t), \; 0, \; 1 \right)$$

Where:
- $m(t) \in [0, 1]$ is the dimensionless saturation fraction (ratio of water table height to soil depth, $h_w / z$).
- $f_{\text{infil}}$ is the infiltration coefficient ($0.65$ default).
- $n_{\text{soil}}$ is effective soil porosity ($0.40$ default).
- $d_{\text{drain}}$ is the base drainage rate ($0.03 \text{ h}^{-1}$).
- $z(\beta)$ is the slope-dependent soil mantle thickness:
  $$z(\beta) = \mathrm{clip}\left( z_{\text{base}} \cdot \left(1.4 - \frac{\beta}{60^\circ}\right), \; 0.4\text{ m}, \; 4.0\text{ m} \right)$$
- $w_{\text{TWI}}$ is the topographic convergence weighting derived from Beven & Kirkby's Topographic Wetness Index:
  $$\mathrm{TWI} = \ln\left(\frac{A \cdot \Delta x}{\tan \beta}\right), \quad w_{\text{TWI}} = \mathrm{clip}\left(\frac{\mathrm{TWI}}{\overline{\mathrm{TWI}}}, \; 0.4, \; 2.0\right)$$

---

### 1.2 Slope Stability (Infinite-Slope Factor of Safety)
The Factor of Safety ($FS$) represents the ratio of available shear strength to mobilized shear stress along a potential failure surface parallel to the slope face:

$$FS = \frac{c_{\text{total}}}{\gamma \cdot z \cdot \sin \beta \cdot \cos \beta} + \left(1 - m \cdot \frac{\gamma_w}{\gamma}\right) \cdot \frac{\tan \phi'}{\tan \beta}$$

Where:
- $c_{\text{total}} = c'_{\text{soil}} + c_{\text{root}}$ is total effective cohesion (soil cohesion plus root reinforcement, with outcrop boost for $\beta > 55^\circ$).
- $\phi'$ is the effective internal friction angle ($33^\circ$ default).
- $\gamma$ is soil unit weight ($19.0 \text{ kN/m}^3$).
- $\gamma_w$ is unit weight of water ($9.81 \text{ kN/m}^3$).
- $\beta$ is local slope inclination angle (clamped to $\beta \ge 0.5^\circ$ to prevent division by zero).
- $z$ is vertical soil depth.
- $m$ is saturation fraction.

**Failure Criterion:**
A cell is flagged as unstable at the earliest hour $t$ where:
$$FS(t) < 1.0$$
The time of failure $t_{\text{fail}}$ is recorded on the grid.

---

### 1.3 Debris Runout Dynamics (D8 Steepest Descent with Angle-of-Reach Stopping)
For all failed source cells ($FS < 1$), a mass-conserving flow routing algorithm tracks the downstream debris propagation:

1. **Released Volume:**
   $$V_{\text{source}} = (\Delta x)^2 \cdot z$$
2. **Steepest-Descent Routing (D8):**
   Debris routes down the steepest slope receiver cell until the stopping threshold is met.
3. **Angle-of-Reach (Fahrböschung / Energy Line):**
   Flow terminates when the apparent travel angle from the source crown ($h_0$) drops below the reach angle $\theta_{\text{reach}}$ ($14^\circ$ default):
   $$\frac{h_0 - h_{\text{current}}}{L} < \tan \theta_{\text{reach}}$$
   Where $L$ is cumulative planimetric path length $\sum \Delta L$.
4. **Mass Deposition & Conservation:**
   When local slope flattens below $10^\circ$, $30\%$ of remaining volume is deposited per cell:
   $$\Delta V_{\text{deposit}} = 0.30 \cdot V_{\text{remaining}}$$
   Total mass balance satisfies:
   $$V_{\text{released}} = V_{\text{deposited}} + V_{\text{outflow}} \pm 10^{-6}$$
5. **Front Arrival Time:**
   Debris velocity is approximated via kinematic energy conversion:
   $$v(L) = \max\left(2.0, \; 0.5 \cdot \sqrt{2 g \cdot \max(h_0 - h, 1.0)}\right) \text{ m/s}$$
   $$t_{\text{arrival}} = t_{\text{fail}} + \frac{L}{v \cdot 3600} \text{ hours}$$

---

## 2. Client / Server Parity Guarantee

To enable smooth 60fps slider interaction in the UI while maintaining strict scientific validity, the exact Factor of Safety equation is implemented in two environments:
1. **Python backend:** `backend/simulation/twin.py`
2. **JavaScript client:** `apps/web/src/workers/fsWorker.js`

**Parity Test Assertion:**
Both engines receive identical float arrays of slope, depth, moisture, cohesion, friction angle, and unit weight. The maximum absolute difference must satisfy:
$$\max |FS_{\text{python}} - FS_{\text{js}}| < 1.0 \times 10^{-6}$$

---

## 3. Mandatory Validation Criteria

| Test Identifier | Physical Assertion | Mathematical Expectation | Verification Command |
|---|---|---|---|
| `VAL-01` | Closed-form dry stability | $\lim_{m \to 0} FS = \frac{c}{\gamma z \sin\beta\cos\beta} + \frac{\tan\phi'}{\tan\beta}$ | `pytest tests/test_simulation.py -k test_closed_form_dry` |
| `VAL-02` | Closed-form fully saturated | $\lim_{m \to 1} FS = \frac{c}{\gamma z \sin\beta\cos\beta} + \left(1 - \frac{\gamma_w}{\gamma}\right) \frac{\tan\phi'}{\tan\beta}$ | `pytest tests/test_simulation.py -k test_closed_form_saturated` |
| `VAL-03` | Monotonicity with moisture | $\frac{\partial FS}{\partial m} = - \frac{\gamma_w}{\gamma} \cdot \frac{\tan\phi'}{\tan\beta} < 0$ | `pytest tests/test_simulation.py -k test_fs_monotonicity_moisture` |
| `VAL-04` | Flat terrain stability | As $\beta \to 0^\circ$, $FS \gg 1.0$ (never fails) | `pytest tests/test_simulation.py -k test_flat_terrain_stable` |
| `VAL-05` | Mass conservation | $V_{\text{released}} = V_{\text{deposited}} + V_{\text{outflow}}$ | `pytest tests/test_simulation.py -k test_mass_conservation` |
| `VAL-06` | Runout reach monotonicity | $\frac{\partial L_{\text{max}}}{\partial \theta_{\text{reach}}} < 0$ (smaller angle travels further) | `pytest tests/test_simulation.py -k test_runout_reach_monotonicity` |
| `VAL-07` | Deterministic reproducibility | Same config + seed produces identical hash | `pytest tests/test_simulation.py -k test_simulation_determinism` |
