import math
import json
import hashlib
from typing import Optional
import numpy as np

from backend.app.geospatial.terrain import AOIS, load_terrain, latlon_to_cell, b64
from backend.app.hydro_geotech.infinite_slope import (
    factor_of_safety,
    soil_depth,
    twi_weight,
    hydro_step
)

DISCLAIMER = "Screening-level scenario simulation — not a validated hazard assessment."

DEFAULTS = {
    "c_soil": 4.0,       # Soil effective cohesion (kPa)
    "c_root": 2.0,       # Vegetation root reinforcement (kPa)
    "phi": 33.0,         # Internal friction angle (deg)
    "gamma": 19.0,       # Soil unit weight (kN/m^3)
    "z_base": 2.0,       # Baseline soil mantle depth (m)
    "porosity": 0.40,    # Effective porosity
    "infil_frac": 0.65,  # Infiltration fraction
    "drainage": 0.03,    # Hourly base drainage rate
    "m0": 0.30,          # Initial saturation fraction
    "reach_angle": 14.0, # Fahrböschung angle of reach (deg)
    "seed": 42
}

PARAM_RANGES = {
    "c_soil": [1.0, 15.0],
    "c_root": [0.0, 10.0],
    "phi": [25.0, 40.0],
    "gamma": [16.0, 22.0],
    "z_base": [0.5, 4.0],
    "m0": [0.0, 1.0],
    "reach_angle": [8.0, 25.0],
    "infil_frac": [0.20, 1.0],
    "drainage": [0.0, 0.20]
}

def bell_hyetograph(hours: int, total_mm: float, peak_at: float, width: float) -> list[float]:
    t = np.arange(hours)
    w = np.exp(-0.5 * ((t - peak_at) / width) ** 2)
    return list(np.round(w / w.sum() * total_mm, 2))

SCENARIOS = {
    "dry_baseline": {
        "label": "Dry Baseline (Low Infiltration)",
        "hyetograph": [0.3] * 24,
        "m0": 0.15
    },
    "heavy_24h": {
        "label": "24h Heavy Monsoon Rain (~220 mm)",
        "hyetograph": bell_hyetograph(24, 220.0, 12.0, 4.0),
        "m0": 0.35
    },
    "burst_3h_saturated": {
        "label": "Intense 3h Cloudburst on Saturated Ground",
        "hyetograph": [2.0] * 6 + [45.0, 55.0, 40.0] + [3.0] * 15,
        "m0": 0.70
    },
    "escalation": {
        "label": "Escalation: Extreme Monsoon (~380 mm)",
        "hyetograph": bell_hyetograph(24, 380.0, 10.0, 4.0),
        "m0": 0.50
    }
}

def runout(
    terrain: dict,
    sources_flat: np.ndarray,
    tfail_flat: np.ndarray,
    depth_flat: np.ndarray,
    reach_angle: float,
    seed: int,
    max_sources: int = 1500
) -> tuple[np.ndarray, np.ndarray, dict]:
    """
    D8 steepest-descent debris runout with Fahrböschung angle-of-reach stopping rule
    and mass-conserving deposition.
    """
    dem = terrain["dem"].ravel()
    recv = terrain["recv"]
    cs = terrain["cs"]
    n = dem.size
    side = terrain["dem"].shape[0]
    
    rng = np.random.default_rng(seed)
    src = sources_flat
    scale = 1.0
    if len(src) > max_sources:
        src = rng.choice(src, max_sources, replace=False)
        scale = len(sources_flat) / max_sources
        
    deposit = np.zeros(n, dtype=np.float64)
    arrival = np.full(n, np.inf, dtype=np.float64)
    tan_reach = math.tan(math.radians(reach_angle))
    
    released_vol = 0.0
    outflow_vol = 0.0
    
    for s in src:
        vol = (cs * cs) * depth_flat[s] * scale
        released_vol += vol
        h0 = dem[s]
        L = 0.0
        cur = s
        rem_vol = vol
        t0 = tfail_flat[s]
        steps = 0
        
        while True:
            # Velocity proxy via potential energy conversion
            drop = max(h0 - dem[cur], 1.0)
            v = max(2.0, math.sqrt(2.0 * 9.81 * drop) * 0.5)
            arrival[cur] = min(arrival[cur], t0 + L / (v * 3600.0))
            
            nxt = recv[cur]
            if nxt < 0:
                deposit[cur] += rem_vol
                break
                
            r0, c0 = cur // side, cur % side
            r1, c1 = nxt // side, nxt % side
            
            # Boundary outflow
            if r1 in (0, side - 1) or c1 in (0, side - 1):
                outflow_vol += rem_vol
                break
                
            step_len = cs * math.hypot(r1 - r0, c1 - c0)
            L += step_len
            steps += 1
            
            # Slope deceleration check
            local_slope = (dem[cur] - dem[nxt]) / step_len
            if local_slope < math.tan(math.radians(10.0)):
                d_vol = rem_vol * 0.30
                deposit[cur] += d_vol
                rem_vol -= d_vol
                
            cur = nxt
            
            # Angle of reach termination
            if (steps > 2 and (h0 - dem[cur]) / L < tan_reach) or steps > 400:
                arrival[cur] = min(arrival[cur], t0 + L / 7200.0)
                deposit[cur] += rem_vol
                break
                
    mass_balance = {
        "released_m3": round(released_vol, 1),
        "deposited_m3": round(float(deposit.sum()), 1),
        "outflow_m3": round(outflow_vol, 1)
    }
    return deposit, arrival, mass_balance

def _min_filter3(arr: np.ndarray) -> np.ndarray:
    pad = np.pad(arr, 1, constant_values=np.inf)
    h, w = arr.shape
    return np.min([pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] for dy in (-1, 0, 1) for dx in (-1, 0, 1)], axis=0)

def _densify_coords(coords: list, step: float = 0.0004) -> list:
    pts = []
    for (x0, y0), (x1, y1) in zip(coords[:-1], coords[1:]):
        k = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        pts += [(x0 + (x1 - x0) * i / k, y0 + (y1 - y0) * i / k) for i in range(k)]
    pts.append(tuple(coords[-1]))
    return pts

def compute_exposure(
    terrain: dict,
    aoi: dict,
    arrival_hr: np.ndarray,
    extra_blocked: tuple = ()
) -> dict:
    arr_buf = _min_filter3(arrival_hr)
    villages = []
    roads = []
    facilities = []
    pop_exposed = 0
    
    for v in aoi["villages"]:
        cell = latlon_to_cell(terrain, v["lat"], v["lon"])
        hit = cell is not None and np.isfinite(arr_buf[cell])
        if hit:
            pop_exposed += v["pop"]
        villages.append({
            **v,
            "exposed": bool(hit),
            "time_to_impact_h": round(float(arr_buf[cell]), 2) if hit else None
        })
        
    for r in aoi["roads"]:
        hits = []
        for lon, lat in _densify_coords(r["coords"]):
            cell = latlon_to_cell(terrain, lat, lon)
            if cell is not None and np.isfinite(arr_buf[cell]):
                hits.append({"lon": lon, "lat": lat, "t": float(arr_buf[cell])})
                
        is_blocked = bool(hits) or r["id"] in extra_blocked
        roads.append({
            "id": r["id"],
            "name": r["name"],
            "kind": r["kind"],
            "exposed": is_blocked,
            "blocked_by_event": r["id"] in extra_blocked,
            "impact_points": hits[:40],
            "time_to_impact_h": round(min(h["t"] for h in hits), 2) if hits else None
        })
        
    for kind in ("shelters", "hospitals"):
        for f in aoi[kind]:
            cell = latlon_to_cell(terrain, f["lat"], f["lon"])
            hit = cell is not None and np.isfinite(arr_buf[cell])
            facilities.append({
                **f,
                "kind": kind[:-1],
                "exposed": bool(hit)
            })
            
    return {
        "villages": villages,
        "roads": roads,
        "facilities": facilities,
        "population_exposed_est": pop_exposed,
        "villages_exposed": sum(1 for v in villages if v["exposed"]),
        "roads_exposed": sum(1 for r in roads if r["exposed"]),
        "simulated": True,
        "note": "Population figures are SIMULATED estimates."
    }

def config_hash(cfg: dict, checksum: str) -> str:
    serialized = json.dumps(cfg, sort_keys=True) + checksum
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:16]

def run_simulation(
    aoi_id: str,
    scenario: str = "heavy_24h",
    overrides: Optional[dict] = None,
    rain_multiplier: float = 1.0,
    blocked_roads: tuple = (),
    include_frames: bool = True
) -> dict:
    terrain = load_terrain(aoi_id)
    aoi = AOIS[aoi_id]
    
    p = {**DEFAULTS, "m0": SCENARIOS[scenario]["m0"], **(overrides or {})}
    for k, (lo, hi) in PARAM_RANGES.items():
        if k in p:
            p[k] = float(np.clip(p[k], lo, hi))
            
    base_hyeto = p.pop("hyetograph", None) or SCENARIOS[scenario]["hyetograph"]
    hyeto = [round(x * rain_multiplier, 2) for x in base_hyeto]
    
    cfg = {
        "aoi": aoi_id,
        "scenario": scenario,
        "params": p,
        "hyetograph": hyeto
    }
    
    rng = np.random.default_rng(int(p["seed"]))
    slope = terrain["slope"]
    z = soil_depth(slope, p["z_base"])
    
    # Mild heterogenous cohesion perturbation + rock outcrop boost
    hetero = rng.normal(1.0, 0.08, slope.shape).clip(0.75, 1.25)
    c_total = (p["c_soil"] * hetero + p["c_root"]) + np.where(slope > 55.0, 40.0, 0.0)
    
    w_twi = twi_weight(terrain["twi"])
    m = np.full(slope.shape, p["m0"]) * np.clip(w_twi, 0.6, 1.4)
    m = np.clip(m, 0.0, 1.0)
    
    tfail = np.full(slope.shape, np.inf)
    frames_m = []
    frames_fs = []
    
    initial_fs = factor_of_safety(slope, z, m, c_total, p["phi"], p["gamma"])
    initial_unstable = initial_fs < 1.0
    
    timeline = []
    for hr, rain in enumerate([0.0] + hyeto):
        if hr > 0:
            m = hydro_step(m, rain, w_twi, z, p)
            
        fs = factor_of_safety(slope, z, m, c_total, p["phi"], p["gamma"])
        new_failures = (fs < 1.0) & ~np.isfinite(tfail) & ~initial_unstable
        tfail[new_failures] = hr
        
        frames_m.append(m.copy())
        frames_fs.append(fs.copy())
        timeline.append({
            "hour": hr,
            "rain_mm": rain,
            "cum_rain_mm": round(float(sum(([0.0] + hyeto)[:hr + 1])), 1),
            "failed_cells": int(np.isfinite(tfail).sum()),
            "mean_saturation": round(float(m.mean()), 3)
        })
        
    failed = np.isfinite(tfail)
    src = np.flatnonzero(failed.ravel())
    
    deposit, arrival, mass = runout(
        terrain,
        src,
        tfail.ravel(),
        z.ravel(),
        p["reach_angle"],
        int(p["seed"])
    )
    
    arrival_hr = arrival.reshape(slope.shape)
    depth = (deposit / (terrain["cs"] ** 2)).reshape(slope.shape)
    
    footprint = np.isfinite(arrival_hr)
    exp = compute_exposure(terrain, aoi, arrival_hr, blocked_roads)
    
    # Cohesion uncertainty bounds (+/- 25%)
    band = {}
    for lbl, factor in (("low_cohesion", 0.75), ("high_cohesion", 1.25)):
        fs_b = factor_of_safety(slope, z, m, c_total * factor, p["phi"], p["gamma"])
        band[lbl] = int(((fs_b < 1.0) & ~initial_unstable).sum())
        
    for row in timeline:
        row["footprint_cells"] = int((arrival_hr <= row["hour"]).sum())
        
    res = {
        "config": cfg,
        "config_hash": config_hash(cfg, terrain["checksum"]),
        "disclaimer": DISCLAIMER,
        "simulated": True,
        "grid": list(slope.shape),
        "bounds": terrain["bounds"],
        "cell_size_m": round(terrain["cs"], 1),
        "failed_cells": int(failed.sum()),
        "failed_area_km2": round(float(failed.sum() * (terrain["cs"] ** 2) / 1e6), 3),
        "footprint_cells": int(footprint.sum()),
        "footprint_area_km2": round(float(footprint.sum() * (terrain["cs"] ** 2) / 1e6), 3),
        "first_failure_hour": int(tfail[failed].min()) if failed.any() else None,
        "mass_balance": mass,
        "uncertainty_failed_cells": band,
        "timeline": timeline,
        "exposure": exp,
        "provenance": {
            "dem": terrain["source"],
            "dem_checksum": terrain["checksum"],
            "model": "Coupled Infiltration-Diffusion + Infinite-Slope FS + D8 Angle-of-Reach Runout v1.0",
            "params_are_assumptions": True
        }
    }
    
    if include_frames:
        frames = []
        for hr, (mm, fsf) in enumerate(zip(frames_m, frames_fs)):
            # Byte packing for compact WebSocket/HTTP transport:
            # 0..100: saturation percentage
            # 120: marginal stability (1.0 <= FS < 1.3)
            # 150: failed cell (FS < 1.0)
            # 200..255: debris deposition front
            code = (np.clip(mm, 0.0, 1.0) * 100.0).astype(np.uint8)
            code = np.where((fsf < 1.3) & (fsf >= 1.0), 120, code)
            code = np.where(tfail <= hr, 150, code)
            deb = (arrival_hr <= hr) & (tfail > hr)
            code = np.where(deb, (200 + np.clip(depth, 0.0, 5.0) * 10.0).astype(np.uint8), code)
            frames.append(b64(code.astype(np.uint8)))
        res["frames"] = frames
        
    return res
