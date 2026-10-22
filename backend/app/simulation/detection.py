"""
Physically-grounded landslide detection + runout for the NER digital twin.

Differences from the legacy demo pipeline (`twin.run_simulation`):

* Infiltration is capacity-limited by the regional saturated conductivity, so a
  cloudburst cannot infiltrate 85 mm/h into a clay-rich profile.
* Existing (pre-event) unstable cells are reported separately and are not
  silently released as fresh debris.
* Failures are clustered into discrete landslide *detections* with area, volume,
  timing, confidence and affected assets -- what an operations room actually needs.
* Debris travel uses a Voellmy energy balance along the D8 flow path
  (Coulomb mu + turbulent xi), not a potential-energy proxy, and records arrival
  time, peak speed and deposition depth per cell.
* Rainfall is evaluated against a regional Caine-type intensity-duration envelope
  with antecedent-moisture adjustment.

Everything remains deterministic for a given configuration hash and is labelled
as screening-level output.
"""

from __future__ import annotations

import math
from collections import deque
from typing import Optional

import numpy as np

from backend.app.geospatial.terrain import AOIS, load_terrain, latlon_to_cell
from backend.app.hydro_geotech.infinite_slope import factor_of_safety, soil_depth, twi_weight
from backend.app.simulation.regional import (
    LEVELS,
    REGIONAL_PROFILES,
    detection_confidence,
    evaluate_rainfall,
    haversine_m,
    profile_for,
)
from backend.app.simulation.twin import (
    config_hash,
    bell_hyetograph,
    compute_exposure,
    _densify_coords,
)

DISCLAIMER = (
    "Screening-level physical scenario simulation. Landslide 'detections' are model "
    "candidates, not confirmed field observations, and are not a certified warning service."
)

GRAV = 9.81
MIN_DETECTION_AREA_HA = 0.25
MAX_SOURCES_PER_CLUSTER = 24
MAX_STEPS = 320

SCENARIOS: dict[str, dict] = {
    "dry_baseline": {
        "label": "Dry baseline (no monsoon forcing)",
        "hyetograph": [0.5] * 6 + [0.0] * 18,
        "m0_offset": -0.25,
    },
    "heavy_24h": {
        "label": "24 h heavy monsoon rain (~220 mm)",
        "hyetograph": bell_hyetograph(24, 220.0, 8.0, 4.2),
        "m0_offset": 0.0,
    },
    "deluge_48h": {
        "label": "Multi-day monsoon deluge (~380 mm in 24 h)",
        "hyetograph": bell_hyetograph(24, 380.0, 9.0, 5.0),
        "m0_offset": 0.10,
    },
    "cloudburst": {
        "label": "Cloudburst spike (~160 mm in 3 h on saturated ground)",
        "hyetograph": [1.0, 1.0, 2.0, 4.0, 8.0, 12.0, 48.0, 65.0, 47.0, 18.0, 8.0, 4.0]
        + [2.0, 1.0, 1.0] + [0.0] * 9,
        "m0_offset": 0.18,
    },
}

# Aliases retained so existing incident presets keep working.
SCENARIOS["burst_3h_saturated"] = {
    "label": "Intense 3 h cloudburst on saturated ground",
    "hyetograph": SCENARIOS["cloudburst"]["hyetograph"],
    "m0_offset": 0.18,
}
SCENARIOS["escalation"] = {
    "label": "Escalation: extreme monsoon (~380 mm)",
    "hyetograph": SCENARIOS["deluge_48h"]["hyetograph"],
    "m0_offset": 0.10,
}

PARAM_KEY_MAP = {
    "c_soil": "c_soil_kpa",
    "c_root": "c_root_kpa",
    "phi": "phi_deg",
    "gamma": "gamma_kn_m3",
    "z_base": "z_base_m",
    "m0": "m0_monsoon",
    "mu": "mu",
    "xi": "xi_m_s2",
    "reach_angle": "reach_angle_deg",
    "porosity": "porosity",
    "infil_frac": "infil_frac",
    "drainage": "drainage",
}

PARAM_RANGES = {
    "c_soil": (1.0, 15.0),
    "c_root": (0.0, 10.0),
    "phi": (25.0, 42.0),
    "gamma": (16.0, 22.0),
    "z_base": (0.5, 4.0),
    "m0": (0.05, 0.95),
    "mu": (0.08, 0.45),
    "xi": (150.0, 1200.0),
    "reach_angle": (8.0, 26.0),
    "porosity": (0.25, 0.50),
    "infil_frac": (0.20, 1.0),
    "drainage": (0.0, 0.20),
}


def default_params(aoi: str, scenario: str = "heavy_24h", overrides: Optional[dict] = None) -> dict:
    """Regional defaults + scenario antecedent offset + operator overrides."""
    prof = profile_for(aoi)
    scen = SCENARIOS.get(scenario, SCENARIOS["heavy_24h"])
    params = {
        "c_soil": prof.c_soil_kpa,
        "c_root": prof.c_root_kpa,
        "phi": prof.phi_deg,
        "gamma": prof.gamma_kn_m3,
        "z_base": prof.z_base_m,
        "m0": round(min(0.95, max(0.05, prof.m0_monsoon + scen["m0_offset"])), 2),
        "mu": prof.mu,
        "xi": prof.xi_m_s2,
        "reach_angle": prof.reach_angle_deg,
        "porosity": prof.porosity,
        "infil_frac": prof.infil_frac,
        "drainage": prof.drainage,
    }
    for k, v in (overrides or {}).items():
        if k not in PARAM_RANGES:
            continue
        try:
            val = float(v)
        except (TypeError, ValueError):
            continue
        lo, hi = PARAM_RANGES[k]
        params[k] = round(float(np.clip(val, lo, hi)), 4)
    return params


# ---------------------------------------------------------------------------
# Runout routing
# ---------------------------------------------------------------------------

def voellmy_runout(
    terrain: dict,
    sources: np.ndarray,
    release_depth: np.ndarray,
    tfail: np.ndarray,
    params: dict,
    max_sources: int = MAX_SOURCES_PER_CLUSTER,
    max_steps: int = MAX_STEPS,
) -> dict:
    """
    Route released debris downslope with a Voellmy energy balance.

    Per D8 step of length L and bed slope theta:
        dv/dt = g (sin(theta) - mu cos(theta)) - g v^2 / xi
    integrated over the step. Deposition occurs when the flow falls below the
    reach angle (Fahrboeschung) or loses all momentum on a low-gradient bench.
    """
    if len(sources) == 0:
        return {
            "arrival": np.full(terrain["dem"].shape, np.inf, dtype=np.float32),
            "speed": np.zeros(terrain["dem"].shape, dtype=np.float32),
            "deposit": np.zeros(terrain["dem"].shape, dtype=np.float32),
            "trail": np.zeros(terrain["dem"].shape, dtype=bool),
            "travel": np.zeros(terrain["dem"].shape, dtype=np.float32),
            "mass": {"released_m3": 0.0, "deposited_m3": 0.0, "outflow_m3": 0.0},
            "released_volume_m3": 0.0,
        }

    grid = terrain["dem"].shape
    n = terrain["dem"].size
    dem = terrain["dem"].ravel().tolist()
    recv = terrain["recv"].tolist()
    side = grid[1]
    cs = float(terrain["cs"])

    rng = np.random.default_rng(int(params.get("seed", 4217)) + int(sources[0]) % 9973)
    src = np.asarray(sources, dtype=np.int64).ravel()
    scale = 1.0
    if len(src) > max_sources:
        # Deterministic, depth-weighted sample keeps big releases represented.
        src = rng.choice(src, max_sources, replace=False)
        scale = len(sources) / max_sources

    arrival = np.full(n, np.inf, dtype=np.float64)
    speed = np.zeros(n, dtype=np.float64)
    deposit = np.zeros(n, dtype=np.float64)
    travel = np.zeros(n, dtype=np.float64)
    trail = np.zeros(n, dtype=bool)

    mu = float(params["mu"])
    xi = max(50.0, float(params["xi"]))
    tan_reach = math.tan(math.radians(float(params["reach_angle"])))

    released = 0.0
    outflow = 0.0

    for s in src:
        s = int(s)
        vol = cs * cs * float(release_depth[s]) * scale
        if vol <= 0.0:
            continue
        released += vol
        rem = vol
        h0 = float(dem[s])
        cur = s
        path_len = 0.0
        v = 0.0
        t0 = float(tfail[s]) if np.isfinite(tfail[s]) else 0.0

        for step in range(max_steps):
            nxt = int(recv[cur])
            if nxt < 0:
                deposit[cur] += rem
                rem = 0.0
                break

            r0, c0 = divmod(cur, side)
            r1, c1 = divmod(nxt, side)
            if r1 in (0, side - 1) or c1 in (0, side - 1):
                outflow += rem
                rem = 0.0
                break

            run = cs * math.hypot(r1 - r0, c1 - c0)
            drop = float(dem[cur]) - float(dem[nxt])
            sin_t = max(-1.0, min(1.0, drop / max(run, 1e-6)))
            cos_t = math.sqrt(max(0.0, 1.0 - sin_t * sin_t))

            acc = GRAV * (sin_t - mu * cos_t) - (GRAV / xi) * v * v
            v2 = max(0.0, v * v + 2.0 * acc * run)
            v = math.sqrt(v2)
            path_len += run
            cur = nxt

            travel[cur] = max(travel[cur], path_len)
            speed[cur] = max(speed[cur], v)
            trail[cur] = True
            arrival[cur] = min(arrival[cur], t0 + path_len / max(v, 0.6) / 3600.0)

            # Momentum stop, but require at least a short travel distance.
            if step > 3 and v < 0.45:
                deposit[cur] += rem
                rem = 0.0
                break
            # Fahrboeschung angle-of-reach termination
            if step > 2 and path_len > 0 and (h0 - float(dem[cur])) / path_len < tan_reach:
                deposit[cur] += rem
                rem = 0.0
                break
            # Gentle bench sheds a fraction of the load and continues
            if step > 1 and sin_t < 0.08:
                shed = rem * 0.25
                deposit[cur] += shed
                rem -= shed
        else:
            deposit[cur] += rem
            rem = 0.0

        if rem > 0:
            deposit[cur] += rem

    deposited = float(deposit.sum())
    mass = {
        "released_m3": round(released, 1),
        "deposited_m3": round(deposited, 1),
        "outflow_m3": round(outflow, 1),
        "conservation_error_pct": round(
            abs(released - (deposited + outflow)) / max(released, 1.0) * 100.0, 3
        ),
    }

    return {
        "arrival": arrival.reshape(grid).astype(np.float32),
        "speed": speed.reshape(grid).astype(np.float32),
        "deposit": (deposit / (cs * cs)).reshape(grid).astype(np.float32),
        "trail": trail.reshape(grid),
        "travel": travel.reshape(grid).astype(np.float32),
        "mass": mass,
        "released_volume_m3": round(released, 1),
    }


# ---------------------------------------------------------------------------
# Clustering & asset attribution
# ---------------------------------------------------------------------------

def _correlated_field(rng: np.random.Generator, shape: tuple[int, int], cells: int = 22, sigma: float = 0.45) -> np.ndarray:
    """
    Spatially correlated multiplicative field for regolith strength.

    A uniform cohesion value makes every 35-degree cell fail at the same rainfall
    total; real hillslopes fail where colluvium is thick, weathered or cut. This
    field creates those weak patches at ~300-500 m scale.
    """
    coarse = rng.normal(0.0, 1.0, (cells, cells))
    reps = int(math.ceil(max(shape) / cells))
    up = np.kron(coarse, np.ones((reps, reps)))[: shape[0], : shape[1]]
    up = _box3(_box3(up))
    std = float(up.std()) or 1.0
    up = (up - float(up.mean())) / std
    return np.exp(sigma * np.clip(up, -2.5, 2.5))


def _road_cut_mask(terrain: dict, aoi: dict) -> np.ndarray:
    """Cells within ~1 cell of a mapped road (road cuts undercut the slope)."""
    grid = terrain["dem"].shape
    mask = np.zeros(grid, dtype=bool)
    step = 0.00018
    for road in aoi.get("roads", []):
        coords = road.get("coords", [])
        for (x0, y0), (x1, y1) in zip(coords[:-1], coords[1:]):
            k = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
            for i in range(k + 1):
                lon = x0 + (x1 - x0) * i / k
                lat = y0 + (y1 - y0) * i / k
                cell = latlon_to_cell(terrain, lat, lon)
                if cell is not None:
                    mask[cell[0], cell[1]] = True
    return _dilate(mask)


def _box3(arr: np.ndarray) -> np.ndarray:
    """3x3 box smoothing for spatially correlated soil properties."""
    p = np.pad(arr, 1, mode="edge")
    h, w = arr.shape
    total = np.zeros_like(arr, dtype=np.float64)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            total += p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
    return (total / 9.0).astype(arr.dtype)


def _components(mask: np.ndarray) -> list[np.ndarray]:
    """8-connected components of a boolean grid (no SciPy dependency)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    flat = mask.ravel()
    out: list[np.ndarray] = []
    for start in np.flatnonzero(flat):
        if seen.flat[start]:
            continue
        q = deque([int(start)])
        seen.flat[start] = True
        cells = []
        while q:
            idx = q.popleft()
            cells.append(idx)
            r, c = divmod(idx, w)
            for dr in (-1, 0, 1):
                rr = r + dr
                if rr < 0 or rr >= h:
                    continue
                base = rr * w
                for dc in (-1, 0, 1):
                    cc = c + dc
                    if cc < 0 or cc >= w:
                        continue
                    j = base + cc
                    if flat[j] and not seen.flat[j]:
                        seen.flat[j] = True
                        q.append(j)
        out.append(np.asarray(cells, dtype=np.int64))
    return out


def _cell_lonlat(terrain: dict, r: int, c: int) -> tuple[float, float]:
    b = terrain["bounds"]
    ny, nx = terrain["dem"].shape
    lon = b["west"] + (c + 0.5) / nx * (b["east"] - b["west"])
    lat = b["north"] - (r + 0.5) / ny * (b["north"] - b["south"])
    return round(lon, 6), round(lat, 6)


def _dilate(mask: np.ndarray) -> np.ndarray:
    p = np.pad(mask, 1, constant_values=False)
    h, w = mask.shape
    out = np.zeros_like(mask, dtype=bool)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
    return out


def _asset_hits(
    terrain: dict,
    aoi: dict,
    arrival: np.ndarray,
    centroid: tuple[float, float],
) -> tuple[list[dict], float]:
    """Assets inside the modelled arrival footprint + nearest asset distance."""
    hits: list[dict] = []
    nearest_name, nearest_dist, nearest_kind = None, float("inf"), None
    hit_buf = _dilate(np.isfinite(arrival))
    ny, nx = arrival.shape

    def check(kind: str, asset: dict):
        nonlocal nearest_name, nearest_dist, nearest_kind
        lat, lon = float(asset["lat"]), float(asset["lon"])
        cell = latlon_to_cell(terrain, lat, lon)
        if cell is not None and hit_buf[cell[0], cell[1]]:
            hits.append(
                {
                    "kind": kind,
                    "id": asset.get("id"),
                    "name": asset.get("name"),
                    "time_to_impact_h": round(float(arrival[cell[0], cell[1]]), 2)
                    if np.isfinite(arrival[cell[0], cell[1]])
                    else None,
                }
            )
        d = haversine_m(centroid[1], centroid[0], lat, lon)
        if d < nearest_dist:
            nearest_name, nearest_dist, nearest_kind = asset.get("name"), d, kind

    for kind in ("villages", "hospitals", "shelters"):
        for a in aoi.get(kind, []):
            check(kind[:-1], a)

    # Road impact points are already densified by the exposure routine; here we
    # only check the vertices to keep per-detection attribution cheap.
    for road in aoi.get("roads", []):
        coords = road.get("coords", [])
        sampled = _densify_coords(coords, step=0.0004) if len(coords) >= 2 else coords
        tmin = None
        for lon, lat in sampled:
            cell = latlon_to_cell(terrain, lat, lon)
            if cell is None:
                continue
            if np.isfinite(arrival[cell[0], cell[1]]):
                t = float(arrival[cell[0], cell[1]])
                tmin = t if tmin is None else min(tmin, t)
        if tmin is not None:
            hits.append(
                {
                    "kind": "road",
                    "id": road.get("id"),
                    "name": road.get("name"),
                    "time_to_impact_h": round(tmin, 2),
                }
            )

    return hits, round(nearest_dist, 0) if nearest_name else None


def _nearest_label(
    terrain: dict, aoi: dict, centroid: tuple[float, float]
) -> tuple[Optional[str], Optional[str]]:
    best = (None, None, float("inf"))
    for kind in ("villages", "hospitals", "shelters"):
        for a in aoi.get(kind, []):
            d = haversine_m(centroid[1], centroid[0], a["lat"], a["lon"])
            if d < best[2]:
                best = (a.get("name"), kind[:-2] if kind.endswith("s") else kind, d)
    return best[0], best[1]


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_detection(
    aoi_id: str = None,
    scenario: str = "heavy_24h",
    hyetograph: Optional[list[float]] = None,
    rain_multiplier: float = 1.0,
    overrides: Optional[dict] = None,
    blocked_roads: tuple = (),
    aoi: str = None,
) -> dict:
    """
    Run the detection pipeline and return a summary plus dense fields.

    The summary is JSON-serialisable; `fields` holds the NumPy arrays used for
    PNG layer rendering and is kept out of API responses.
    """
    aoi_id = aoi_id or aoi
    if not aoi_id:
        raise ValueError("AOI is required")
    if aoi_id not in AOIS:
        raise ValueError(f"Unknown AOI: {aoi_id}")
    if aoi_id not in REGIONAL_PROFILES:
        raise ValueError(f"AOI '{aoi_id}' has no NER regional calibration")

    prof = profile_for(aoi_id)
    aoi = AOIS[aoi_id]
    terrain = load_terrain(aoi_id)
    grid = terrain["dem"].shape
    cs = float(terrain["cs"])

    params = default_params(aoi_id, scenario, overrides)
    scen = SCENARIOS.get(scenario, SCENARIOS["heavy_24h"])

    if hyetograph:
        if len(hyetograph) > 48:
            raise ValueError("Hyetograph must contain at most 48 hourly values")
        base = [max(0.0, min(250.0, float(x))) for x in hyetograph]
    else:
        base = list(scen["hyetograph"])
    hyeto = [round(x * max(0.0, min(4.0, rain_multiplier)), 2) for x in base]
    hours = len(hyeto)

    cfg = {
        "aoi": aoi_id,
        "scenario": scenario,
        "profile": prof.aoi,
        "params": params,
        "hyetograph": hyeto,
        "rain_multiplier": rain_multiplier,
        "blocked_roads": sorted(blocked_roads),
    }
    run_hash = config_hash(cfg, terrain["checksum"])

    rng = np.random.default_rng(4217 + sum(ord(ch) for ch in aoi_id))
    slope = terrain["slope"]
    z = soil_depth(slope, params["z_base"])

    # Heterogeneous but deterministic cohesion; rock outcrops are strongly
    # reinforced so near-vertical cliffs are not reported as soil landslides.
    hetero = np.clip(rng.normal(1.0, 0.05, grid), 0.72, 1.28)
    c_total = (params["c_soil"] * hetero + params["c_root"]) * _correlated_field(rng, grid)
    c_total = c_total + np.where(slope > 42.0, 80.0, 0.0)
    c_total = _box3(c_total)
    road_cuts = _road_cut_mask(terrain, aoi)
    c_total = np.where(road_cuts, c_total * 0.62, c_total)

    w_twi = twi_weight(terrain["twi"])
    m = np.clip(params["m0"] * np.clip(w_twi, 0.6, 1.4), 0.0, 1.0)

    k_sat_mm_h = prof.k_sat_m_s * 3600.0 * 1000.0  # mm/h capacity
    infil_capacity = max(1.0, k_sat_mm_h * params["infil_frac"])
    porosity = max(0.2, params["porosity"])
    drainage = params["drainage"]

    fs_initial = factor_of_safety(slope, z, m, c_total, params["phi"], params["gamma"])
    # Static screening background: cells already below limit equilibrium before
    # the storm. Reported separately and never counted as new detections.
    pre_existing = fs_initial < 1.0
    pre_existing_at_start = pre_existing.copy()
    fail_hour = np.full(grid, -1, dtype=np.int16)

    sat_frames = np.empty((hours + 1,) + grid, dtype=np.float32)
    fs_frames = np.empty((hours + 1,) + grid, dtype=np.float32)
    sat_frames[0] = m
    fs_frames[0] = fs_initial

    timeline: list[dict] = []
    rain_cum = 0.0
    significant_so_far = 0

    # ---- transient infiltration & factor of safety -------------------------
    for hr in range(hours + 1):
        if hr > 0:
            rain_mm = hyeto[hr - 1]
            rain_cum += rain_mm
            infiltrated_mm = min(rain_mm * params["infil_frac"], infil_capacity)
            dm = (infiltrated_mm / 1000.0) * w_twi / (porosity * z)
            m = np.clip(m * (1.0 - drainage) + dm, 0.0, 1.0)
            fs = factor_of_safety(slope, z, m, c_total, params["phi"], params["gamma"])
            newly = (fs < 1.0) & (fail_hour < 0) & ~pre_existing
            fail_hour[newly] = hr
        else:
            rain_mm = 0.0
            fs = fs_initial

        sat_frames[hr] = m
        fs_frames[hr] = fs

        rain = evaluate_rainfall(prof, hyeto, hr, params["m0"])
        new_cells = int((fail_hour == hr).sum()) if hr > 0 else 0
        timeline.append(
            {
                "hour": hr,
                "rain_mm": round(rain_mm, 2),
                "cum_rain_mm": round(rain_cum, 1),
                "rainfall_level": rain["level"],
                "rainfall_ratio": rain["peak_ratio"],
                "governing_duration_h": rain["governing_duration_h"],
                "threshold_mm": rain["effective_threshold_mm"],
                "mean_saturation": round(float(m.mean()), 3),
                "new_failed_cells": new_cells,
                "failed_cells": int(((fail_hour >= 0) & (fail_hour <= hr)).sum()) if hr > 0 else 0,
            }
        )

    # ---- cluster fresh failures into discrete detections -------------------
    fresh_mask = fail_hour >= 0
    comps = _components(fresh_mask) if fresh_mask.any() else []

    detections: list[dict] = []
    arrival = np.full(grid, np.inf, dtype=np.float64)
    speed = np.zeros(grid, dtype=np.float64)
    deposit = np.zeros(grid, dtype=np.float64)
    trail = np.zeros(grid, dtype=bool)
    travel = np.zeros(grid, dtype=np.float64)
    total_released = 0.0
    total_deposited = 0.0
    total_outflow = 0.0

    for comp in comps:
        area_ha = len(comp) * cs * cs / 10000.0
        if area_ha < MIN_DETECTION_AREA_HA:
            continue

        rows, cols = np.unravel_index(comp, grid)
        h_fail = int(fail_hour.ravel()[comp].min())
        fs_at_fail = fs_frames[min(h_fail, hours)]
        fs_vals = fs_at_fail.ravel()[comp]
        min_fs = float(np.min(fs_vals))
        mean_slope = float(np.mean(slope.ravel()[comp]))
        depth_vals = z.ravel()[comp]
        volume = float(len(comp) * cs * cs * float(np.mean(depth_vals)))

        # Volume-weighted centroid gives a stable marker position.
        w = depth_vals / max(float(depth_vals.sum()), 1e-6)
        r_c = int(round(float(np.sum(rows * w))))
        c_c = int(round(float(np.sum(cols * w))))
        lon, lat = _cell_lonlat(terrain, r_c, c_c)

        pre_frac = float(pre_existing_at_start.ravel()[comp].mean())
        rel = voellmy_runout(
            terrain,
            comp,
            release_depth=z.ravel(),
            tfail=fail_hour.ravel().astype(np.float32),
            params=params,
        )
        arrival = np.minimum(arrival, rel["arrival"])
        speed = np.maximum(speed, rel["speed"])
        deposit += rel["deposit"]
        trail |= rel["trail"]
        travel = np.maximum(travel, rel["travel"])
        total_released += rel["mass"]["released_m3"]
        total_deposited += rel["mass"]["deposited_m3"]
        total_outflow += rel["mass"]["outflow_m3"]

        hits, nearest_dist = _asset_hits(terrain, aoi, rel["arrival"], (lon, lat))
        nearest_name, nearest_kind = _nearest_label(terrain, aoi, (lon, lat))
        rain_at_fail = timeline[min(h_fail, hours)]["rainfall_ratio"]
        conf, conf_label = detection_confidence(rain_at_fail, area_ha, mean_slope, min_fs)

        detections.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "id": f"ls-{aoi_id}-{len(detections) + 1:03d}",
                    "aoi": aoi_id,
                    "state": prof.state,
                    "detection_hour": h_fail,
                    "area_ha": round(area_ha, 2),
                    "volume_m3": round(volume, 0),
                    "min_fs": round(min_fs, 3),
                    "mean_slope_deg": round(mean_slope, 1),
                    "mean_depth_m": round(float(np.mean(depth_vals)), 2),
                    "runout_area_ha": round(float((rel["arrival"] < np.inf).sum()) * cs * cs / 10000.0, 2),
                    "runout_distance_m": round(float(np.max(rel["travel"])), 0),
                    "max_speed_kmh": round(float(np.max(rel["speed"])) * 3.6, 1),
                    "max_deposit_m": round(float(np.max(rel["deposit"])), 2),
                    "confidence": conf,
                    "confidence_label": conf_label,
                    "confidence_basis": "expert heuristic (rainfall ratio, slope, area, FS margin)",
                    "assets": hits,
                    "nearest_asset": nearest_name,
                    "nearest_asset_kind": nearest_kind,
                    "nearest_asset_distance_m": nearest_dist,
                    "pre_existing_fraction": round(pre_frac, 2),
                    "onset": (
                        "PRE_EXISTING_LIMIT_EQUILIBRIUM"
                        if pre_frac > 0.6
                        else "RAIN_TRIGGERED"
                    ),
                    "status": "MODELLED_CANDIDATE",
                },
            }
        )

    # Sort by severity so the operations list leads with the important ones.
    detections.sort(
        key=lambda d: (
            -(d["properties"]["confidence"] * d["properties"]["area_ha"]),
            d["properties"]["detection_hour"],
        )
    )

    # ---- exposure and attribution -----------------------------------------
    exposure = compute_exposure(terrain, aoi, arrival, blocked_roads)

    # ---- per-hour timeline enrichment -------------------------------------
    village_impacts = {v["id"]: v.get("time_to_impact_h") for v in exposure["villages"]}
    road_impacts = {r["id"]: r.get("time_to_impact_h") for r in exposure["roads"]}

    for row in timeline:
        hr = row["hour"]
        in_foot = arrival <= hr
        row["footprint_cells"] = int(in_foot.sum())
        row["footprint_area_km2"] = round(float(in_foot.sum()) * cs * cs / 1e6, 3)
        row["max_speed_kmh"] = round(float(speed[in_foot].max()) * 3.6, 1) if in_foot.any() else 0.0
        row["max_depth_m"] = round(float(deposit[in_foot].max()), 2) if in_foot.any() else 0.0
        row["exposed_population_est"] = int(
            sum(
                v["pop"]
                for v in aoi["villages"]
                if village_impacts.get(v["id"]) is not None
                and village_impacts[v["id"]] <= hr
            )
        )
        row["roads_blocked"] = [
            r["name"]
            for r in exposure["roads"]
            if road_impacts.get(r["id"]) is not None and road_impacts[r["id"]] <= hr
        ]
        significant = [
            d
            for d in detections
            if d["properties"]["detection_hour"] <= hr and d["properties"]["area_ha"] >= 1.0
        ]
        significant_so_far = len(significant)
        model_level = "NORMAL"
        if significant_so_far:
            model_level = "WARNING"
        if significant_so_far >= 3:
            model_level = "SEVERE"
        row["model_level"] = model_level
        row["hazard_level"] = LEVELS[
            max(LEVELS.index(row["rainfall_level"]), LEVELS.index(model_level))
        ]
        row["significant_detections"] = significant_so_far

    # Cohesion uncertainty band: rebuild the FS field at +/-25% strength using
    # the final saturation state (cheap deterministic sensitivity check).
    uncertainty = {}
    for label, factor in (("low_cohesion", 0.75), ("high_cohesion", 1.25)):
        fs_b = factor_of_safety(
            slope, z, m, c_total * factor, params["phi"], params["gamma"]
        )
        uncertainty[label] = int(((fs_b < 1.0) & ~pre_existing).sum())

    rain_assessment = evaluate_rainfall(prof, hyeto, hours, params["m0"])
    significant_total = sum(1 for d in detections if d["properties"]["area_ha"] >= 1.0)
    total_area = sum(d["properties"]["area_ha"] for d in detections)

    summary = {
        "run_id": None,  # filled by the API layer
        "created_at": None,
        "aoi": aoi_id,
        "aoi_name": aoi["name"],
        "state": prof.state,
        "scenario": scenario,
        "scenario_label": scen["label"],
        "config_hash": run_hash,
        "disclaimer": DISCLAIMER,
        "simulated": True,
        "model": "Transient infiltration + infinite-slope FS + Voellmy D8 runout (NER calibration v2.0)",
        "params": params,
        "regional": {
            "profile": prof.to_dict(),
            "rainfall": rain_assessment,
            "antecedent_m0": params["m0"],
            "infiltration_capacity_mm_h": round(infil_capacity, 1),
        },
        "hyetograph": hyeto,
        "rain_total_mm": round(sum(hyeto), 1),
        "hours": list(range(hours + 1)),
        "max_hour": hours,
        "bounds": terrain["bounds"],
        "grid": list(grid),
        "cell_size_m": round(cs, 1),
        "cell_area_m2": round(cs * cs, 1),
        "timeline": timeline,
        "detections": {"type": "FeatureCollection", "features": detections},
        "detection_count": len(detections),
        "significant_detection_count": significant_total,
        "detected_area_ha": round(total_area, 2),
        "run_kind": "detection",
        # --- compatibility keys used by the incident orchestrator ---
        "failed_cells": int(((fail_hour >= 0)).sum()),
        "failed_area_km2": round(float(((fail_hour >= 0)).sum()) * cs * cs / 1e6, 3),
        "footprint_cells": int((arrival < np.inf).sum()),
        "footprint_area_km2": round(float((arrival < np.inf).sum()) * cs * cs / 1e6, 3),
        "first_failure_hour": int(fail_hour[fail_hour >= 0].min()) if (fail_hour >= 0).any() else None,
        "uncertainty_failed_cells": uncertainty,
        "pre_existing_unstable_cells": int(pre_existing.sum()),
        "pre_existing_unstable_area_ha": round(float(pre_existing.sum()) * cs * cs / 10000.0, 2),
        "mass_balance": {
            "released_m3": round(total_released, 1),
            "deposited_m3": round(total_deposited, 1),
            "outflow_m3": round(total_outflow, 1),
            "conservation_error_pct": round(
                abs(total_released - (total_deposited + total_outflow)) / max(total_released, 1.0) * 100.0,
                3,
            ),
        },
        "exposure": exposure,
        "provenance": {
            "run_kind": "detection",
            "dem": terrain["source"],
            "dem_checksum": terrain["checksum"],
            "regional_source": prof.threshold_source,
            "params_are_assumptions": True,
            "detections_are_model_candidates": True,
        },
        "layers": {
            "hazard": {"label": "Stability + runout", "encoding": "RGBA PNG"},
            "depth": {"label": "Deposition depth (m)", "encoding": "RGBA PNG"},
            "velocity": {"label": "Flow speed (m/s)", "encoding": "RGBA PNG", "scale_max": 40.0},
            "fs": {"label": "Factor of safety", "encoding": "RGBA PNG"},
        },
    }

    fields = {
        "sat": sat_frames,
        "fs": fs_frames,
        "fail_hour": fail_hour,
        "arrival": arrival.astype(np.float32),
        "speed": speed.astype(np.float32),
        "deposit": deposit.astype(np.float32),
        "trail": trail,
        "hours": hours,
    }
    return {"summary": summary, "fields": fields}
