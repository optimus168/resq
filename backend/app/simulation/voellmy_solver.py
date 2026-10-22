"""
BhuRaksha Voellmy Depth-Averaged Debris Flow Solver (Phase S2)
Physically based 2D shallow-water equations with Voellmy rheology (Coulomb friction μ + turbulent drag ξ).
Well-balanced hydrostatic reconstruction, Kurganov-Petrova / HLL central-upwind numerical flux,
positivity-preserving, CFL-adaptive time stepping.

Also provides:
- Transient pore-pressure infiltration diffusion (TRIGRS/Iverson style)
- Dynamic infinite-slope Factor of Safety FS(t)
- Analytic verification test cases (Lake-at-rest, 1D Ritter dam-break, Steady uniform flow)
"""

import math
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any
import numpy as np

GRAV = 9.81  # Gravitational acceleration (m/s^2)
RHO_DEBRIS = 1900.0  # Bulk debris density (kg/m^3)
GAMMA_W = 9.81  # Unit weight of water (kN/m^3)
GAMMA_S = 19.5  # Saturated soil unit weight (kN/m^3)
H_EPS = 1e-4  # Minimum wet-bed water depth threshold (m)

@dataclass
class VoellmyParams:
    mu: float = 0.22  # Coulomb basal friction coefficient (tan phi_b)
    xi: float = 500.0  # Turbulent drag coefficient (m/s^2)
    rho: float = 1900.0  # Bulk density (kg/m^3)
    k_act: float = 1.0  # Earth pressure coefficient (active/passive ratio)
    cfl: float = 0.35  # Courant-Friedrichs-Lewy stability number
    dry_depth: float = 1e-4  # Dry/wet depth threshold (m)

@dataclass
class HydroParams:
    k_sat: float = 5e-5  # Hydraulic conductivity (m/s)
    diffusivity: float = 1.5e-4  # Pressure diffusivity D0 (m^2/s)
    porosity: float = 0.38  # Effective porosity
    c_soil: float = 4.5  # Effective soil cohesion (kPa)
    c_root: float = 2.5  # Vegetation root reinforcement (kPa)
    phi_deg: float = 33.0  # Friction angle (deg)
    gamma_s: float = 19.5  # Bulk unit weight (kN/m^3)
    z_base: float = 2.0  # Baseline regolith thickness (m)

class Voellmy2DSolver:
    """
    2D Depth-Averaged Finite Volume Debris Flow Solver.
    Solves:
      d(h)/dt + d(hu)/dx + d(hv)/dy = 0
      d(hu)/dt + d(hu^2 + 0.5*g*h^2)/dx + d(huv)/dy = -g*h*db/dx - S_fx
      d(hv)/dt + d(huv)/dx + d(hv^2 + 0.5*g*h^2)/dy = -g*h*db/dy - S_fy
    with Voellmy friction:
      S_f = (g * mu * cos(theta) + g / xi * U^2) * u / U
    """

    def __init__(self, dem: np.ndarray, cell_size_m: float, params: Optional[VoellmyParams] = None):
        self.dem = dem.astype(np.float64)
        self.ny, self.nx = dem.shape
        self.dx = float(cell_size_m)
        self.params = params or VoellmyParams()

        # Topographic gradients
        self.dzdy, self.dzdx = np.gradient(self.dem, self.dx)
        self.slope_rad = np.arctan(np.hypot(self.dzdx, self.dzdy))
        self.cos_slope = np.cos(self.slope_rad)

        # State variables: depth h (m), discharge qx = h*u, qy = h*v (m^2/s)
        self.h = np.zeros((self.ny, self.nx), dtype=np.float64)
        self.qx = np.zeros((self.ny, self.nx), dtype=np.float64)
        self.qy = np.zeros((self.ny, self.nx), dtype=np.float64)

        # Diagnostics & Tracking
        self.t = 0.0
        self.step_count = 0
        self.max_depth = np.zeros((self.ny, self.nx), dtype=np.float64)
        self.max_velocity = np.zeros((self.ny, self.nx), dtype=np.float64)
        self.arrival_time = np.full((self.ny, self.nx), np.inf, dtype=np.float64)
        self.initial_volume = 0.0
        self.outflow_volume = 0.0

    def set_initial_depth(self, h_init: np.ndarray):
        """Sets initial fluid depth and computes initial released mass."""
        self.h = np.maximum(h_init.astype(np.float64), 0.0)
        self.qx.fill(0.0)
        self.qy.fill(0.0)
        self.max_depth = np.copy(self.h)
        self.initial_volume = float(np.sum(self.h) * (self.dx ** 2))

    def get_velocity(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Returns (u, v, speed U) with dry-bed desingularization."""
        h_wet = np.maximum(self.h, self.params.dry_depth)
        is_wet = self.h > self.params.dry_depth
        u = np.where(is_wet, self.qx / h_wet, 0.0)
        v = np.where(is_wet, self.qy / h_wet, 0.0)
        speed = np.sqrt(u**2 + v**2)
        return u, v, speed

    def compute_timestep(self, max_dt: float = 0.5) -> float:
        """Calculates adaptive CFL-stable timestep."""
        u, v, speed = self.get_velocity()
        c = np.sqrt(GRAV * np.maximum(self.h, 0.0))
        wave_speed = np.maximum(np.abs(u) + c, np.abs(v) + c)
        max_wave = float(np.max(wave_speed))
        if max_wave < 1e-4:
            return max_dt
        cfl_dt = self.params.cfl * self.dx / max_wave
        return max(1e-4, min(max_dt, cfl_dt))

    def step(self, dt: Optional[float] = None) -> float:
        """Executes one finite-volume time step with Kurganov-Petrova central-upwind flux."""
        if dt is None:
            dt = self.compute_timestep()

        ny, nx = self.ny, self.nx
        dx = self.dx
        g = GRAV
        dry = self.params.dry_depth

        u, v, speed = self.get_velocity()

        # Update arrival time for cells newly inundated > 0.05m
        newly_wetted = (self.h > 0.05) & (self.arrival_time == np.inf)
        self.arrival_time[newly_wetted] = self.t

        # Tracking max fields
        np.maximum(self.max_depth, self.h, out=self.max_depth)
        np.maximum(self.max_velocity, speed, out=self.max_velocity)

        # Reconstructed water surface eta = h + b
        eta = self.h + self.dem

        # --- X-Fluxes (Central-Upwind Kurganov-Petrova) ---
        fx_h = np.zeros((ny, nx + 1), dtype=np.float64)
        fx_qx = np.zeros((ny, nx + 1), dtype=np.float64)
        fx_qy = np.zeros((ny, nx + 1), dtype=np.float64)

        # Internal interfaces x = 1 .. nx-1
        h_L = self.h[:, :-1]
        h_R = self.h[:, 1:]
        u_L = u[:, :-1]
        u_R = u[:, 1:]
        v_L = v[:, :-1]
        v_R = v[:, 1:]

        # Hydrostatic reconstruction for well-balanced bed slope handling
        b_L = self.dem[:, :-1]
        b_R = self.dem[:, 1:]
        b_edge = np.maximum(b_L, b_R)
        h_L_edge = np.maximum(0.0, eta[:, :-1] - b_edge)
        h_R_edge = np.maximum(0.0, eta[:, 1:] - b_edge)

        cL = np.sqrt(g * h_L_edge)
        cR = np.sqrt(g * h_R_edge)
        a_plus = np.maximum(0.0, np.maximum(u_L + cL, u_R + cR))
        a_minus = np.maximum(0.0, np.maximum(-(u_L - cL), -(u_R - cR)))
        denom = a_plus + a_minus
        denom_nz = np.where(denom > 1e-6, denom, 1.0)

        # Flux components
        F_h_L = h_L_edge * u_L
        F_h_R = h_R_edge * u_R
        F_qx_L = h_L_edge * (u_L**2) + 0.5 * g * (h_L_edge**2)
        F_qx_R = h_R_edge * (u_R**2) + 0.5 * g * (h_R_edge**2)
        F_qy_L = h_L_edge * u_L * v_L
        F_qy_R = h_R_edge * u_R * v_R

        valid = denom > 1e-6
        fx_h[:, 1:-1] = np.where(valid, (a_plus * F_h_L + a_minus * F_h_R - a_plus * a_minus * (h_R_edge - h_L_edge)) / denom_nz, 0.0)
        fx_qx[:, 1:-1] = np.where(valid, (a_plus * F_qx_L + a_minus * F_qx_R - a_plus * a_minus * (h_R_edge * u_R - h_L_edge * u_L)) / denom_nz, 0.0)
        fx_qy[:, 1:-1] = np.where(valid, (a_plus * F_qy_L + a_minus * F_qy_R - a_plus * a_minus * (h_R_edge * v_R - h_L_edge * v_L)) / denom_nz, 0.0)

        # --- Y-Fluxes ---
        fy_h = np.zeros((ny + 1, nx), dtype=np.float64)
        fy_qx = np.zeros((ny + 1, nx), dtype=np.float64)
        fy_qy = np.zeros((ny + 1, nx), dtype=np.float64)

        h_B = self.h[:-1, :]
        h_T = self.h[1:, :]
        u_B = u[:-1, :]
        u_T = u[1:, :]
        v_B = v[:-1, :]
        v_T = v[1:, :]

        b_B = self.dem[:-1, :]
        b_T = self.dem[1:, :]
        b_y_edge = np.maximum(b_B, b_T)
        h_B_edge = np.maximum(0.0, eta[:-1, :] - b_y_edge)
        h_T_edge = np.maximum(0.0, eta[1:, :] - b_y_edge)

        cB = np.sqrt(g * h_B_edge)
        cT = np.sqrt(g * h_T_edge)
        b_plus = np.maximum(0.0, np.maximum(v_B + cB, v_T + cT))
        b_minus = np.maximum(0.0, np.maximum(-(v_B - cB), -(v_T - cT)))
        denom_y = b_plus + b_minus
        denom_y_nz = np.where(denom_y > 1e-6, denom_y, 1.0)

        F_hy_B = h_B_edge * v_B
        F_hy_T = h_T_edge * v_T
        F_qxy_B = h_B_edge * u_B * v_B
        F_qxy_T = h_T_edge * u_T * v_T
        F_qyy_B = h_B_edge * (v_B**2) + 0.5 * g * (h_B_edge**2)
        F_qyy_T = h_T_edge * (v_T**2) + 0.5 * g * (h_T_edge**2)

        valid_y = denom_y > 1e-6
        fy_h[1:-1, :] = np.where(valid_y, (b_plus * F_hy_B + b_minus * F_hy_T - b_plus * b_minus * (h_T_edge - h_B_edge)) / denom_y_nz, 0.0)
        fy_qx[1:-1, :] = np.where(valid_y, (b_plus * F_qxy_B + b_minus * F_qxy_T - b_plus * b_minus * (h_T_edge * u_T - h_B_edge * u_B)) / denom_y_nz, 0.0)
        fy_qy[1:-1, :] = np.where(valid_y, (b_plus * F_qyy_B + b_minus * F_qyy_T - b_plus * b_minus * (h_T_edge * v_T - h_B_edge * v_B)) / denom_y_nz, 0.0)

        # Depth update (conservative)
        dh = -(dt / dx) * ((fx_h[:, 1:] - fx_h[:, :-1]) + (fy_h[1:, :] - fy_h[:-1, :]))
        h_new = np.maximum(0.0, self.h + dh)

        # Bed slope source term (well-balanced with hydrostatic reconstruction)
        s_bed_x = -g * 0.5 * (self.h + h_new) * self.dzdx
        s_bed_y = -g * 0.5 * (self.h + h_new) * self.dzdy

        # Voellmy Resistance Force: S_f = g * (mu * cos_theta + U^2 / xi) * (u / U)
        mu = self.params.mu
        xi = self.params.xi
        wet_mask = h_new > dry
        u_mid = np.where(wet_mask, self.qx / np.maximum(self.h, dry), 0.0)
        v_mid = np.where(wet_mask, self.qy / np.maximum(self.h, dry), 0.0)
        u_mag = np.sqrt(u_mid**2 + v_mid**2)

        # Coulomb + Turbulent Voellmy acceleration
        u_mag_safe = np.maximum(u_mag, 1e-6)
        sf_mag = np.where(u_mag > 1e-4, g * (mu * self.cos_slope + (u_mag**2) / xi), 0.0)
        unit_u = np.where(u_mag > 1e-4, u_mid / u_mag_safe, 0.0)
        unit_v = np.where(u_mag > 1e-4, v_mid / u_mag_safe, 0.0)

        # Discharge update with semi-implicit friction damping
        dqx = -(dt / dx) * ((fx_qx[:, 1:] - fx_qx[:, :-1]) + (fy_qx[1:, :] - fy_qx[:-1, :])) + dt * s_bed_x
        dqy = -(dt / dx) * ((fx_qy[:, 1:] - fx_qy[:, :-1]) + (fy_qy[1:, :] - fy_qy[:-1, :])) + dt * s_bed_y

        qx_tent = np.where(wet_mask, self.qx + dqx - dt * sf_mag * unit_u * h_new, 0.0)
        qy_tent = np.where(wet_mask, self.qy + dqy - dt * sf_mag * unit_v * h_new, 0.0)

        # Stopping rule: only applies when Coulomb friction mu > 0 and total driving force (bed slope + free surface gradient) is overcome
        dhdy, dhdx = np.gradient(h_new, dx)
        driving_force = np.hypot(-g * h_new * (self.dzdx + dhdx), -g * h_new * (self.dzdy + dhdy))
        coulomb_stop = (mu > 0.0) & (u_mag < 0.02) & (driving_force <= g * mu * self.cos_slope * h_new)
        self.qx = np.where(coulomb_stop, 0.0, qx_tent)
        self.qy = np.where(coulomb_stop, 0.0, qy_tent)
        self.h = h_new

        self.t += dt
        self.step_count += 1
        return dt

    def mass_conservation_error(self) -> float:
        """Computes relative mass conservation error: |V(t) - V(0)| / V(0)."""
        if self.initial_volume <= 0.0:
            return 0.0
        current_vol = float(np.sum(self.h) * (self.dx ** 2))
        return abs(current_vol - self.initial_volume) / self.initial_volume

    def impact_pressure(self) -> np.ndarray:
        """Returns dynamic impact pressure proxy p = rho * U^2 (kPa)."""
        _, _, speed = self.get_velocity()
        return (RHO_DEBRIS * (speed ** 2)) / 1000.0


# ---------------------------------------------------------------------------
# TRANSIENT HYDROLOGY & FACTOR OF SAFETY
# ---------------------------------------------------------------------------

def calculate_transient_hydrology(
    slope_deg: np.ndarray,
    curvature: np.ndarray,
    twi: np.ndarray,
    hyetograph_mm: list[float],
    params: Optional[HydroParams] = None,
    antecedent_m0: float = 0.35
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Transient infiltration and pore-pressure head calculation (Iverson-style).
    Returns (m_final, psi_final, regolith_depth_z).
    """
    p = params or HydroParams()
    # Spatially varying regolith depth: deeper in concave valleys, thinner on steep slopes
    z = np.clip(p.z_base * (1.4 - slope_deg / 60.0) * (1.0 - 0.25 * np.clip(curvature, -1.0, 1.0)), 0.5, 4.0)

    # Topographic wetness index convergence weight
    mean_twi = float(np.mean(twi))
    w_twi = np.clip(twi / max(1e-3, mean_twi), 0.4, 2.2)

    m = np.full_like(slope_deg, float(antecedent_m0))
    cos_b = np.cos(np.radians(slope_deg))

    drainage_hourly = 0.025
    infil_frac = 0.70

    for rain_mm in hyetograph_mm:
        # Infiltration capacity limited by k_sat
        max_infil_mm = (p.k_sat * 3600.0) * 1000.0
        actual_rain = min(rain_mm * infil_frac, max_infil_mm)
        # Wetting front saturation increment
        dm = (actual_rain / 1000.0) * w_twi / (p.porosity * z)
        m = np.clip(m * (1.0 - drainage_hourly) + dm, 0.0, 1.0)

    # Pore pressure head psi at failure plane z: psi = m * z * cos^2(beta)
    psi = m * z * (cos_b ** 2)
    return m, psi, z

def calculate_factor_of_safety(
    slope_deg: np.ndarray,
    z: np.ndarray,
    psi: np.ndarray,
    params: Optional[HydroParams] = None
) -> np.ndarray:
    """
    Dynamic infinite-slope factor of safety:
    FS = (c_total + (gamma_s * z - gamma_w * psi) * cos^2(beta) * tan(phi)) / (gamma_s * z * sin(beta) * cos(beta))
    """
    p = params or HydroParams()
    beta = np.radians(np.maximum(slope_deg, 0.5))
    sin_b = np.sin(beta)
    cos_b = np.cos(beta)
    tan_b = np.tan(beta)
    tan_phi = math.tan(math.radians(p.phi_deg))

    c_total = p.c_soil + p.c_root
    gamma_s = p.gamma_s
    gamma_w = GAMMA_W

    effective_normal = np.maximum(0.0, (gamma_s * z - gamma_w * psi) * (cos_b ** 2))
    shear_strength = c_total + effective_normal * tan_phi
    shear_stress = np.maximum(1e-3, gamma_s * z * sin_b * cos_b)

    return shear_strength / shear_stress


# ---------------------------------------------------------------------------
# ANALYTICAL VERIFICATION FIXTURES
# ---------------------------------------------------------------------------

def run_lake_at_rest_benchmark(n: int = 64, steps: int = 150) -> Dict[str, Any]:
    """
    Verifies well-balanced hydrostatic reconstruction:
    On an undulating bed with a flat lake surface, fluid must remain strictly at rest.
    """
    yy, xx = np.mgrid[0:n, 0:n]
    # Undulating Gaussian mountain bed
    b = 5.0 + 3.0 * np.sin(xx * 0.15) * np.cos(yy * 0.15)
    eta_0 = 10.0  # Constant water surface
    h0 = np.maximum(0.0, eta_0 - b)

    solver = Voellmy2DSolver(dem=b, cell_size_m=5.0)
    solver.set_initial_depth(h0)

    for _ in range(steps):
        solver.step(dt=0.04)

    _, _, speed = solver.get_velocity()
    max_speed = float(np.max(speed))
    depth_drift = float(np.max(np.abs(solver.h - h0)))

    return {
        "test": "Lake-at-rest (Well-Balanced Hydrostatic Reconstruction)",
        "passed": max_speed < 1e-5 and depth_drift < 1e-4,
        "max_velocity_drift_m_s": max_speed,
        "depth_drift_m": depth_drift,
        "steps_run": steps
    }

def run_ritter_dam_break_benchmark(n: int = 128, t_end: float = 2.0) -> Dict[str, Any]:
    """
    Verifies 1D frictionless dam break against the Ritter analytic solution:
    Analytic tip position: x_tip = x0 + 2 * t * sqrt(g * h0)
    Analytic profile: h(x, t) = 1/(9g) * (2*sqrt(g*h0) - (x - x0)/t)^2
    """
    dx = 1.0
    x0 = 40.0
    h_left = 4.0
    dem = np.zeros((3, n), dtype=np.float64)  # Flat bed
    h_init = np.zeros((3, n), dtype=np.float64)
    h_init[:, :int(x0 / dx)] = h_left

    params = VoellmyParams(mu=0.0, xi=1e8, cfl=0.30)  # Frictionless
    solver = Voellmy2DSolver(dem=dem, cell_size_m=dx, params=params)
    solver.set_initial_depth(h_init)

    t = 0.0
    while t < t_end:
        dt = solver.compute_timestep()
        solver.step(dt)
        t += dt

    # Check 1D slice along middle row
    h_num = solver.h[1, :]
    x = np.arange(n) * dx
    c0 = math.sqrt(GRAV * h_left)
    x_tip_analytic = x0 + 2.0 * t * c0

    # Find numerical tip (first cell where h > 0.01)
    wet_indices = np.where(h_num > 0.01)[0]
    x_tip_num = float(x[wet_indices[-1]]) if len(wet_indices) > 0 else 0.0

    tip_rel_error = abs(x_tip_num - x_tip_analytic) / x_tip_analytic

    return {
        "test": "1D Ritter Dam Break vs Analytic Solution",
        "passed": tip_rel_error < 0.08,
        "analytic_tip_m": round(x_tip_analytic, 2),
        "numerical_tip_m": round(x_tip_num, 2),
        "relative_tip_error": round(tip_rel_error, 4),
        "mass_conservation_error": solver.mass_conservation_error()
    }

def run_steady_voellmy_inclined_benchmark() -> Dict[str, Any]:
    """
    Verifies steady uniform flow on an inclined plane against the Voellmy formula:
    At steady state: U = sqrt(xi * h * (sin(theta) - mu * cos(theta)))
    """
    theta_deg = 30.0
    theta_rad = math.radians(theta_deg)
    mu = 0.20
    xi = 600.0
    h0 = 1.2
    dx = 5.0
    n = 64

    # Linear incline bed b(x) = -x * tan(theta)
    xx, _ = np.meshgrid(np.arange(n) * dx, np.arange(n) * dx)
    dem = 500.0 - xx * math.tan(theta_rad)

    u_analytic = math.sqrt(xi * (math.sin(theta_rad) - mu * math.cos(theta_rad)))

    params = VoellmyParams(mu=mu, xi=xi, cfl=0.35)
    solver = Voellmy2DSolver(dem=dem, cell_size_m=dx, params=params)
    solver.set_initial_depth(np.full((n, n), h0))

    # Run to steady equilibrium
    for _ in range(120):
        solver.step(dt=0.05)

    _, _, speed = solver.get_velocity()
    mid_u = float(np.mean(speed[20:44, 20:44]))
    rel_error = abs(mid_u - u_analytic) / u_analytic

    return {
        "test": "Steady Uniform Flow on Inclined Plane (Voellmy Relation)",
        "passed": rel_error < 0.06,
        "analytic_velocity_m_s": round(u_analytic, 2),
        "numerical_velocity_m_s": round(mid_u, 2),
        "relative_error": round(rel_error, 4)
    }
