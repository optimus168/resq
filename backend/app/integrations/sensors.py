import numpy as np

def simulate_sensors(aoi_id: str, rain_multiplier: float = 1.0, anomaly: bool = False, seed: int = 11) -> list[dict]:
    """Generates synthetic pore pressure ratio (r_u) and tilt velocity telemetry. Explicitly SIMULATED."""
    rng = np.random.default_rng(seed + len(aoi_id))
    base_ru = 0.35 + 0.12 * (rain_multiplier - 1.0)
    
    stations = []
    for k in range(3):
        ru = float(np.clip(base_ru + rng.normal(0, 0.04), 0.0, 1.0))
        tilt = float(abs(rng.normal(0.25, 0.08)))
        is_fault = False
        
        # Injected anomaly on PZ-2 if triggered
        if anomaly and k == 1:
            ru = 0.94
            tilt = 3.4
            is_fault = True
            
        stations.append({
            "id": f"PZ-{aoi_id[:3].upper()}-{k + 1}",
            "type": "vibrating_wire_piezometer",
            "pore_pressure_ratio": round(ru, 3),
            "tilt_deg_per_day": round(tilt, 2),
            "anomaly": is_fault,
            "simulated": True,
            "note": "SIMULATED TELEMETRY: Demonstrator hardware proxy with noise"
        })
        
    return stations
