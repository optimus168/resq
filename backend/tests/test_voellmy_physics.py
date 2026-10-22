import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import math
import numpy as np
import pytest

from backend.app.simulation.voellmy_solver import (
    Voellmy2DSolver,
    VoellmyParams,
    calculate_transient_hydrology,
    calculate_factor_of_safety,
    run_lake_at_rest_benchmark,
    run_ritter_dam_break_benchmark,
    run_steady_voellmy_inclined_benchmark
)

def test_lake_at_rest_well_balanced():
    """Verify that fluid over undulating topography stays strictly at rest."""
    res = run_lake_at_rest_benchmark(n=48, steps=80)
    assert res["passed"] is True
    assert res["max_velocity_drift_m_s"] < 1e-5
    assert res["depth_drift_m"] < 1e-4

def test_ritter_dam_break_analytic_convergence():
    """Verify 1D frictionless dam break matches Ritter analytic front within tolerance."""
    res = run_ritter_dam_break_benchmark(n=128, t_end=2.0)
    assert res["passed"] is True
    assert res["relative_tip_error"] < 0.08
    assert res["mass_conservation_error"] < 1e-5

def test_steady_voellmy_inclined_plane():
    """Verify steady-state uniform flow matches the Voellmy formula u = sqrt(xi*(sinθ - μ*cosθ))."""
    res = run_steady_voellmy_inclined_benchmark()
    assert res["passed"] is True
    assert res["relative_error"] < 0.06

def test_hydrology_monotonicity_and_drainage():
    """Verify higher rainfall strictly increases saturation and zero rain drains antecedent moisture."""
    slope = np.array([12.0, 30.0, 45.0])
    curv = np.zeros(3)
    twi = np.array([6.0, 8.0, 10.0])

    # Zero rainfall
    m_drain, psi_drain, _ = calculate_transient_hydrology(slope, curv, twi, [0.0] * 10, antecedent_m0=0.45)
    assert np.all(m_drain < 0.45)
    assert np.all(psi_drain < 0.45 * 4.0)

    # Monotonicity with rainfall
    m_low, _, _ = calculate_transient_hydrology(slope, curv, twi, [10.0] * 6, antecedent_m0=0.25)
    m_high, _, _ = calculate_transient_hydrology(slope, curv, twi, [40.0] * 6, antecedent_m0=0.25)
    assert np.all(m_high > m_low)

def test_stability_flat_ground_and_saturation():
    """Verify flat slopes never fail and saturation monotonically reduces Factor of Safety."""
    slopes = np.array([0.5, 20.0, 35.0, 50.0])
    z = np.full(4, 2.0)
    psi_dry = np.zeros(4)
    psi_sat = z * np.cos(np.radians(slopes)) ** 2

    fs_dry = calculate_factor_of_safety(slopes, z, psi_dry)
    fs_sat = calculate_factor_of_safety(slopes, z, psi_sat)

    # Flat ground
    assert fs_sat[0] > 5.0
    # Saturation reduction
    assert np.all(fs_dry > fs_sat)
    # Steep saturated failure
    assert fs_sat[-1] < 1.0

def test_friction_reach_monotonicity_and_positivity():
    """Verify higher Coulomb friction μ monotonically shortens debris reach without negative depths."""
    dem = np.zeros((5, 60), dtype=np.float64)
    for i in range(60):
        dem[:, i] = 100.0 - i * 1.5  # Sloped ramp

    h_src = np.zeros((5, 60), dtype=np.float64)
    h_src[:, :4] = 2.5

    reaches = []
    for mu in [0.15, 0.35]:
        s = Voellmy2DSolver(dem=dem, cell_size_m=5.0, params=VoellmyParams(mu=mu, xi=500.0))
        s.set_initial_depth(h_src)
        for _ in range(50):
            s.step(0.06)
        # Positivity
        assert np.all(s.h >= 0.0)
        wet = np.where(s.h[2, :] > 0.02)[0]
        reaches.append(wet[-1] if len(wet) > 0 else 0)

    assert reaches[0] > reaches[1], "Lower friction must reach further"
