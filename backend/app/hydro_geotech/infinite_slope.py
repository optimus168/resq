import math
import numpy as np

GAMMA_W = 9.81  # Unit weight of water (kN/m^3)

def factor_of_safety(
    slope_deg: np.ndarray,
    z: np.ndarray,
    m: np.ndarray,
    c_total: np.ndarray,
    phi_deg: float,
    gamma: float
) -> np.ndarray:
    """
    Infinite-Slope Factor of Safety (closed-form):
    FS = c_total / (gamma * z * sin(beta) * cos(beta)) + (1 - m * gamma_w / gamma) * tan(phi') / tan(beta)
    
    Pure mathematical function. Mirrored bit-for-bit in client-side Web Worker (fsWorker.js).
    """
    # Guard against division by zero on flat slopes
    b = np.radians(np.maximum(slope_deg, 0.5))
    sin_b = np.sin(b)
    cos_b = np.cos(b)
    tan_b = np.tan(b)
    tan_phi = math.tan(math.radians(phi_deg))
    
    cohesion_term = c_total / (gamma * z * sin_b * cos_b)
    friction_term = (1.0 - m * (GAMMA_W / gamma)) * (tan_phi / tan_b)
    
    return cohesion_term + friction_term

def soil_depth(slope_deg: np.ndarray, z_base: float) -> np.ndarray:
    """Calculates slope-dependent regolith thickness."""
    return np.clip(z_base * (1.4 - slope_deg / 60.0), 0.4, 4.0)

def twi_weight(twi: np.ndarray) -> np.ndarray:
    """Topographic wetness index convergence factor."""
    mean_twi = float(np.mean(twi))
    if mean_twi <= 0:
        return np.ones_like(twi)
    return np.clip(twi / mean_twi, 0.4, 2.0)

def hydro_step(
    m: np.ndarray,
    rain_mm: float,
    w_twi: np.ndarray,
    z: np.ndarray,
    params: dict
) -> np.ndarray:
    """One hourly hydrological infiltration step updating saturation fraction m in [0, 1]."""
    infil_frac = params.get("infil_frac", 0.65)
    porosity = params.get("porosity", 0.40)
    drainage = params.get("drainage", 0.03)
    
    dm = (rain_mm * infil_frac / 1000.0) * w_twi / (porosity * z)
    new_m = m * (1.0 - drainage) + dm
    return np.clip(new_m, 0.0, 1.0)
