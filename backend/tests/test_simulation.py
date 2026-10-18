import math
import numpy as np
import pytest
from backend.app.hydro_geotech.infinite_slope import (
    factor_of_safety,
    GAMMA_W
)
from backend.app.simulation.twin import (
    run_simulation,
    runout,
    config_hash
)
from backend.app.ml.risk_engine import assess_risk, rain_threshold_ratio
from backend.app.geospatial.terrain import load_terrain

def test_closed_form_dry():
    """VAL-01: Analytical infinite-slope FS under completely dry conditions (m=0)."""
    slope_deg = np.array([30.0])
    z = np.array([2.0])
    m = np.array([0.0])
    c_total = np.array([6.0])
    phi_deg = 35.0
    gamma = 19.0
    
    fs = factor_of_safety(slope_deg, z, m, c_total, phi_deg, gamma)
    
    # Analytical solution:
    b = math.radians(30.0)
    expected = (6.0 / (gamma * 2.0 * math.sin(b) * math.cos(b))) + (math.tan(math.radians(phi_deg)) / math.tan(b))
    np.testing.assert_allclose(fs[0], expected, rtol=1e-6)

def test_closed_form_saturated():
    """VAL-02: Analytical infinite-slope FS under fully saturated conditions (m=1)."""
    slope_deg = np.array([28.0])
    z = np.array([2.5])
    m = np.array([1.0])
    c_total = np.array([4.0])
    phi_deg = 32.0
    gamma = 19.0
    
    fs = factor_of_safety(slope_deg, z, m, c_total, phi_deg, gamma)
    
    b = math.radians(28.0)
    expected = (4.0 / (gamma * 2.5 * math.sin(b) * math.cos(b))) + (1.0 - (GAMMA_W / gamma)) * (math.tan(math.radians(phi_deg)) / math.tan(b))
    np.testing.assert_allclose(fs[0], expected, rtol=1e-6)

def test_fs_monotonicity_moisture():
    """VAL-03: Factor of safety must monotonically decrease as saturation m increases."""
    slope = np.array([32.0])
    z = np.array([2.0])
    c = np.array([5.0])
    phi = 33.0
    gamma = 19.0
    
    m_values = np.linspace(0.0, 1.0, 20)
    fs_values = [factor_of_safety(slope, z, np.array([m]), c, phi, gamma)[0] for m in m_values]
    
    for i in range(len(fs_values) - 1):
        assert fs_values[i] > fs_values[i + 1], f"FS not strictly decreasing: {fs_values[i]} <= {fs_values[i+1]}"

def test_flat_terrain_stable():
    """VAL-04: Flat or near-flat terrain must never fail."""
    slope = np.array([0.5, 1.0, 2.0])
    z = np.array([2.0, 2.0, 2.0])
    m = np.array([1.0, 1.0, 1.0])
    c = np.array([5.0, 5.0, 5.0])
    
    fs = factor_of_safety(slope, z, m, c, 30.0, 19.0)
    assert np.all(fs > 2.0)

def test_mass_conservation():
    """VAL-05: Debris runout deposited + outflow volume equals released volume."""
    terrain = load_terrain("gangtok")
    # Simulate a single source cell with 2.0m depth
    src = np.array([5000])
    tfail = np.zeros(terrain["dem"].size)
    depth = np.full(terrain["dem"].size, 2.0)
    
    deposit, arrival, mass = runout(
        terrain,
        src,
        tfail,
        depth,
        reach_angle=14.0,
        seed=42
    )
    
    released = mass["released_m3"]
    deposited = mass["deposited_m3"]
    outflow = mass["outflow_m3"]
    
    assert abs(released - (deposited + outflow)) < 1.0, f"Mass mismatch: {released} vs {deposited + outflow}"

def test_runout_reach_monotonicity():
    """VAL-06: A smaller reach angle corresponds to lower friction and farther runout."""
    terrain = load_terrain("gangtok")
    src = np.array([10000])
    tfail = np.zeros(terrain["dem"].size)
    depth = np.full(terrain["dem"].size, 2.0)
    
    _, arr_high_friction, _ = runout(terrain, src, tfail, depth, reach_angle=22.0, seed=42)
    _, arr_low_friction, _ = runout(terrain, src, tfail, depth, reach_angle=10.0, seed=42)
    
    cells_high_friction = np.isfinite(arr_high_friction).sum()
    cells_low_friction = np.isfinite(arr_low_friction).sum()
    
    assert cells_low_friction >= cells_high_friction

def test_simulation_determinism():
    """VAL-07: Same configuration and seed yields identical footprint and config hash."""
    res1 = run_simulation("gangtok", scenario="heavy_24h", rain_multiplier=1.0, include_frames=False)
    res2 = run_simulation("gangtok", scenario="heavy_24h", rain_multiplier=1.0, include_frames=False)
    
    assert res1["config_hash"] == res2["config_hash"]
    assert res1["failed_cells"] == res2["failed_cells"]
    assert res1["footprint_cells"] == res2["footprint_cells"]
    assert res1["exposure"]["villages_exposed"] == res2["exposure"]["villages_exposed"]

def test_risk_engine_monotonicity():
    terrain = load_terrain("gangtok")
    sim_low = {"grid": [256, 256], "failed_cells": 10}
    sim_high = {"grid": [256, 256], "failed_cells": 1500}
    sensors_low = [{"pore_pressure_ratio": 0.25}]
    sensors_high = [{"pore_pressure_ratio": 0.92}]
    weather = {"mode": "live", "quality_flags": []}
    
    r_low = assess_risk(terrain, sim_low, [1.0]*24, sensors_low, weather)
    r_high = assess_risk(terrain, sim_high, [25.0]*24, sensors_high, weather)
    
    assert r_high["score"] > r_low["score"]
    assert r_high["category"] in ("HIGH", "IMMINENT")
