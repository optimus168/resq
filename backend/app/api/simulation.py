import json
import asyncio
from collections import OrderedDict
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel, Field

from backend.app.geospatial.terrain import AOIS, load_terrain
from backend.app.simulation.twin import (
    run_simulation,
    SCENARIOS as LEGACY_SCENARIOS,
    DEFAULTS,
    PARAM_RANGES as LEGACY_PARAM_RANGES,
    DISCLAIMER as LEGACY_DISCLAIMER,
)
from backend.app.simulation.detection import (
    run_detection,
    default_params,
    SCENARIOS,
    DISCLAIMER,
)
from backend.app.simulation.regional import REGIONAL_PROFILES
from backend.app.simulation.render import LAYERS, render_layer, render_legend
from backend.app.simulation.runs import store
from backend.app.db.database import db
from backend.app.core.security import now_iso, new_id
from backend.app.services.audit_service import record_audit
from backend.app.api.auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/simulations", tags=["Landslide Simulation"])

# Backwards-compatible routes used by the original frontend client.
compat_router = APIRouter(prefix="/simulation", tags=["Landslide Simulation"])

# Bounded run-id cache keyed by config hash so repeated identical requests are free.
_HASH_CACHE: "OrderedDict[str, str]" = OrderedDict()
_HASH_CACHE_MAX = 12


class SimInput(BaseModel):
    aoi: str
    scenario: str = "heavy_24h"
    rain_multiplier: float = Field(1.0, ge=0.0, le=4.0)
    overrides: dict = {}
    hyetograph: Optional[list[float]] = None


class DetectionInput(BaseModel):
    aoi: str
    scenario: str = "heavy_24h"
    rain_multiplier: float = Field(1.0, ge=0.0, le=4.0)
    overrides: dict = {}
    hyetograph: Optional[list[float]] = None
    blocked_roads: list[str] = []
    use_observed_sample: bool = False
    antecedent_m0: Optional[float] = Field(None, ge=0.0, le=1.0)


@router.get("/scenarios")
async def list_scenarios():
    return {
        "scenarios": [{"id": k, **v} for k, v in SCENARIOS.items()],
        "regional_scenarios": [
            {
                "aoi": aoi,
                "label": p.state,
                "defaults": default_params(aoi),
                "rainfall_thresholds_mm": p.thresholds(),
                "regolith": p.regolith,
            }
            for aoi, p in REGIONAL_PROFILES.items()
        ],
        "legacy_scenarios": [{"id": k, **v} for k, v in LEGACY_SCENARIOS.items()],
        "defaults": DEFAULTS,
        "ranges": legacy_ranges(),
        "legend": render_legend(),
        "disclaimer": DISCLAIMER,
        "simulated": True,
    }


def legacy_ranges() -> dict:
    return {
        **LEGACY_PARAM_RANGES,
        "mu": [0.08, 0.45],
        "xi": [150.0, 1200.0],
        "porosity": [0.25, 0.5],
    }


def _cache_get(hash_value: str) -> Optional[dict]:
    run_id = _HASH_CACHE.get(hash_value)
    if not run_id:
        return None
    loaded = store.load(run_id)
    if not loaded:
        _HASH_CACHE.pop(hash_value, None)
        return None
    _HASH_CACHE.move_to_end(hash_value)
    return {"summary": loaded[0], "cached": True}


def _cache_put(hash_value: str, run_id: str) -> None:
    _HASH_CACHE[hash_value] = run_id
    _HASH_CACHE.move_to_end(hash_value)
    while len(_HASH_CACHE) > _HASH_CACHE_MAX:
        _HASH_CACHE.popitem(last=False)


async def _execute_detection(body: DetectionInput, actor: str) -> dict:
    if body.aoi not in REGIONAL_PROFILES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"AOI '{body.aoi}' has no North-Eastern Region calibration profile. "
                f"Available: {', '.join(sorted(REGIONAL_PROFILES))}"
            ),
        )
    if body.scenario == "observed_event":
        body.use_observed_sample = True
        body.scenario = "heavy_24h"

    if body.scenario not in SCENARIOS and not body.hyetograph and not body.use_observed_sample:
        raise HTTPException(status_code=400, detail="Unknown scenario ID")
    if body.hyetograph and (
        len(body.hyetograph) > 48 or any((not isinstance(x, (int, float))) or x < 0 or x > 250 for x in body.hyetograph)
    ):
        raise HTTPException(
            status_code=400,
            detail="Custom hyetograph must be <=48 hourly values between 0-250 mm/h",
        )

    ov = {k: float(v) for k, v in body.overrides.items() if k in default_params(body.aoi)}
    hyeto = body.hyetograph
    sample_meta = None

    if body.use_observed_sample and not hyeto:
        from backend.app.integrations.weather_samples import sample_for

        sample = await asyncio.to_thread(sample_for, body.aoi)
        if sample and sample.get("observed") and len(sample.get("hours") or []) == 48:
            hyeto = sample["hours"]
            if sample.get("antecedent_soil_moisture") is not None:
                ov["m0"] = round(min(0.9, max(0.1, sample["antecedent_soil_moisture"] + 0.10)), 2)
            sample_meta = {
                "id": sample["id"],
                "label": sample["label"],
                "event_date": sample["event_date"],
                "source": sample["source"],
                "total_mm": sample["total_mm"],
                "peak_hourly_mm": sample["peak_hourly_mm"],
                "note": sample["note"],
            }

    if body.antecedent_m0 is not None:
        ov["m0"] = float(body.antecedent_m0)

    payload = {
        "aoi_id": body.aoi,
        "scenario": body.scenario,
        "hyetograph": hyeto,
        "rain_multiplier": body.rain_multiplier,
        "overrides": ov,
        "blocked_roads": tuple(body.blocked_roads),
    }

    # Config hash is computed inside the simulator; do a cheap pre-check to skip
    # recomputation for identical requests.
    from backend.app.simulation.twin import config_hash

    prof = REGIONAL_PROFILES[body.aoi]
    params = default_params(body.aoi, body.scenario, ov)
    terrain = await asyncio.to_thread(load_terrain, body.aoi)
    pre_hash = config_hash(
        {
            "aoi": body.aoi,
            "scenario": body.scenario,
            "params": params,
            "hyetograph": hyeto,
            "rain_multiplier": body.rain_multiplier,
            "blocked_roads": sorted(body.blocked_roads),
            "profile": prof.aoi,
        },
        terrain["checksum"],
    )
    cached = _cache_get(pre_hash)
    if cached:
        return cached

    try:
        result = await asyncio.to_thread(run_detection, **payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    summary = result["summary"]
    run_id = new_id()
    summary["run_id"] = run_id
    summary["created_at"] = now_iso()
    summary["created_by"] = actor
    summary["layer_url_template"] = (
        f"/api/v1/simulations/{run_id}/layer/{{layer}}/{{hour}}.png"
    )
    if sample_meta:
        summary["observed_sample"] = sample_meta
    fields = result["fields"]

    await asyncio.to_thread(store.save, summary, fields, run_id)

    await db.execute(
        "INSERT INTO sim_runs (id, incident_id, config_hash, summary_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (run_id, None, summary["config_hash"], json.dumps(summary, default=float), now_iso()),
    )
    await record_audit(
        "sim.detect",
        actor,
        {
            "run_id": run_id,
            "hash": summary["config_hash"],
            "aoi": body.aoi,
            "detections": summary["detection_count"],
        },
    )

    _cache_put(pre_hash, run_id)
    return {"summary": summary, "cached": False}


@router.get("/samples")
async def list_observed_samples():
    """Observed rainfall samples for documented landslide benchmarks (ERA5 archive)."""
    from backend.app.integrations.weather_samples import SAMPLES, sample_for

    out = []
    for aoi, meta in SAMPLES.items():
        sample = await asyncio.to_thread(sample_for, aoi)
        if not sample:
            continue
        out.append(
            {
                "aoi": aoi,
                "id": sample["id"],
                "label": sample["label"],
                "event_date": sample["event_date"],
                "note": sample["note"],
                "source": sample["source"],
                "observed": bool(sample.get("observed")),
                "total_mm": sample["total_mm"],
                "peak_hourly_mm": sample["peak_hourly_mm"],
                "antecedent_soil_moisture": sample.get("antecedent_soil_moisture"),
                "suggested_scenario": meta["scenario"],
                "hours": sample["hours"],
            }
        )
    return {"samples": out, "source": "Open-Meteo ERA5 archive", "observed": True}


@router.post("/detect")
async def detect_landslides(body: DetectionInput, user=Depends(get_current_user_optional)):
    """
    Run the NER-calibrated detection pipeline.

    Returns timeline, discrete detections, exposure and a capability URL for
    rendering overlay layers as PNGs.
    """
    actor = user["email"] if user else "public-simulation"
    return await _execute_detection(body, actor)


@compat_router.post("/run")
async def compat_run(body: DetectionInput, user=Depends(get_current_user_optional)):
    actor = user["email"] if user else "public-simulation"
    return await _execute_detection(body, actor)


@compat_router.get("/{run_id}/timeline")
async def compat_timeline(run_id: str):
    loaded = await asyncio.to_thread(store.load, run_id)
    if not loaded:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    summary = loaded[0]
    return {
        "run_id": run_id,
        "aoi": summary.get("aoi"),
        "timeline": summary.get("timeline", []),
        "config_hash": summary.get("config_hash"),
        "disclaimer": summary.get("disclaimer"),
    }


@router.get("/{run_id}/layer/{layer}/{hour}.png")
async def get_layer_png(run_id: str, layer: str, hour: int):
    if layer not in LAYERS:
        raise HTTPException(status_code=404, detail=f"Unknown layer. Choose: {', '.join(LAYERS)}")
    loaded = await asyncio.to_thread(store.load, run_id)
    if not loaded:
        raise HTTPException(status_code=404, detail="Simulation run not found or expired")
    summary, fields = loaded
    max_hour = int(fields["hours"])
    if hour < 0 or hour > max_hour:
        raise HTTPException(status_code=400, detail=f"Hour must be between 0 and {max_hour}")

    png = await asyncio.to_thread(render_layer, fields, layer, hour)

    # HTTP headers must be latin-1: DEM provenance strings contain en/em dashes.
    provenance = str(summary.get("provenance", {}).get("dem", "unknown"))
    provenance = provenance.encode("ascii", "replace").decode("ascii")

    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=86400, immutable",
            "X-Simulation-Run": run_id,
            "X-Simulation-Hour": str(hour),
            "X-Simulation-Layer": layer,
            "X-Data-Provenance": provenance[:180],
        },
    )


@router.get("/{run_id}/detections.geojson")
async def get_detections(run_id: str):
    loaded = await asyncio.to_thread(store.load, run_id)
    if not loaded:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    summary = loaded[0]
    return summary.get("detections", {"type": "FeatureCollection", "features": []})


@router.get("/{run_id}/summary")
async def get_detection_summary(run_id: str):
    loaded = await asyncio.to_thread(store.load, run_id)
    if not loaded:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return loaded[0]


# ---------------------------------------------------------------------------
# Legacy run endpoints (kept for existing integrations / notebooks)
# ---------------------------------------------------------------------------

@router.post("")
async def create_simulation(body: SimInput, user=Depends(get_current_user)):
    if body.aoi not in AOIS or body.scenario not in LEGACY_SCENARIOS:
        raise HTTPException(status_code=400, detail="Unknown AOI or Scenario ID")

    ov = {k: float(v) for k, v in body.overrides.items() if k in LEGACY_PARAM_RANGES}
    if body.hyetograph:
        if len(body.hyetograph) > 72 or any(x < 0 or x > 250 for x in body.hyetograph):
            raise HTTPException(status_code=400, detail="Custom hyetograph must be <=72 hourly values between 0-250 mm/h")
        ov["hyetograph"] = body.hyetograph

    res = await asyncio.to_thread(
        run_simulation,
        body.aoi,
        body.scenario,
        ov,
        body.rain_multiplier
    )

    run_id = new_id()
    frames = res.pop("frames", [])

    await db.execute(
        "INSERT INTO sim_frames (run_id, frames_json) VALUES (?, ?)",
        (run_id, json.dumps(frames))
    )

    doc = {
        "id": run_id,
        "created_at": now_iso(),
        "created_by": user["email"],
        **res
    }

    await db.execute(
        "INSERT INTO sim_runs (id, incident_id, config_hash, summary_json, created_at) VALUES (?, ?, ?, ?, ?)",
        (run_id, None, res["config_hash"], json.dumps(doc, default=float), now_iso())
    )

    await record_audit("sim.run", user["email"], {"run_id": run_id, "hash": res["config_hash"]})
    return doc


@router.get("/{run_id}")
async def get_simulation(run_id: str):
    row = await db.fetch_one("SELECT summary_json FROM sim_runs WHERE id = ?", (run_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return json.loads(row["summary_json"])


@router.get("/{run_id}/frames")
async def get_simulation_frames(run_id: str):
    row = await db.fetch_one("SELECT frames_json FROM sim_frames WHERE run_id = ?", (run_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Simulation frames not found")
    return {"run_id": run_id, "frames": json.loads(row["frames_json"])}
