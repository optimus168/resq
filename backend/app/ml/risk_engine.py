import numpy as np

def rain_threshold_ratio(hyetograph: list[float]) -> float:
    """
    Caine (1980) global empirical Intensity-Duration threshold:
    I = 14.82 * D^(-0.39)  (in mm/h)
    Returns maximum exceedance ratio across 1h, 3h, 6h, 12h, 24h durations.
    """
    arr = np.array(hyetograph, dtype=float)
    if len(arr) == 0:
        return 0.0
        
    max_ratio = 0.0
    for d in (1, 3, 6, 12, 24):
        if len(arr) >= d:
            mean_intensity = np.convolve(arr, np.ones(d) / d, mode="valid").max()
            crit_intensity = 14.82 * (d ** -0.39)
            ratio = mean_intensity / crit_intensity
            max_ratio = max(max_ratio, ratio)
            
    return round(float(max_ratio), 2)

def assess_risk(
    terrain: dict,
    sim_result: dict,
    hyetograph: list[float],
    sensors: list[dict],
    weather: dict,
    quarantined_reports_count: int = 0
) -> dict:
    """
    Deterministic risk fusion engine.
    Fuses static terrain susceptibility, dynamic rainfall threshold, physics FS, and piezometer pore pressure.
    """
    slope = terrain["slope"]
    susc_sigmoid = 1.0 / (1.0 + np.exp(-(0.18 * (slope - 30.0))))
    susc_index = float((susc_sigmoid > 0.5).mean())
    
    trig_ratio = rain_threshold_ratio(hyetograph)
    grid_cells = sim_result["grid"][0] * sim_result["grid"][1]
    fail_frac = sim_result["failed_cells"] / grid_cells if grid_cells > 0 else 0.0
    
    sensor_max = max((s["pore_pressure_ratio"] for s in sensors), default=0.3)
    
    # Deterministic weighted components
    contributions = {
        "Terrain Susceptibility (slope/aspect/TWI)": 0.25 * min(susc_index / 0.35, 1.0),
        "Rainfall I-D Threshold Exceedance": 0.30 * min(trig_ratio / 2.0, 1.0),
        "Physics Factor of Safety (FS < 1.0)": 0.30 * min(fail_frac / 0.02, 1.0),
        "Piezometer Pore-Pressure Ratio (r_u)": 0.15 * min(max(sensor_max - 0.30, 0.0) / 0.50, 1.0)
    }
    
    score = round(100.0 * sum(contributions.values()), 1)
    
    if score >= 75.0:
        category = "IMMINENT"
    elif score >= 50.0:
        category = "HIGH"
    elif score >= 25.0:
        category = "MODERATE"
    else:
        category = "LOW"
        
    # Confidence tracked strictly separate from severity
    confidence = 0.85
    if weather.get("mode") != "live":
        confidence -= 0.20
    if quarantined_reports_count > 0:
        confidence -= 0.05
    confidence = round(max(confidence, 0.30), 2)
    
    return {
        "score": score,
        "category": category,
        "confidence": confidence,
        "drivers": [
            {"factor": k, "contribution": round(v * 100.0, 1)}
            for k, v in sorted(contributions.items(), key=lambda item: -item[1])
        ],
        "rain_threshold_ratio": trig_ratio,
        "threshold_ref": "Caine (1980) I = 14.82 * D^(-0.39) (Global baseline)",
        "failed_fraction": round(fail_frac, 4),
        "model_version": "RiskEngine v1.0 (Physics-Informed Deterministic Fusion)",
        "data_quality": weather.get("quality_flags", []),
        "simulated": True
    }
