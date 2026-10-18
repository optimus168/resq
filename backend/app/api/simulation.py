import json
import asyncio
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.app.geospatial.terrain import AOIS
from backend.app.simulation.twin import (
    run_simulation,
    SCENARIOS,
    DEFAULTS,
    PARAM_RANGES,
    DISCLAIMER
)
from backend.app.db.database import db
from backend.app.core.security import now_iso, new_id
from backend.app.services.audit_service import record_audit
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/simulations", tags=["Landslide Simulation"])

class SimInput(BaseModel):
    aoi: str
    scenario: str = "heavy_24h"
    rain_multiplier: float = Field(1.0, ge=0.0, le=4.0)
    overrides: dict = {}
    hyetograph: Optional[list[float]] = None

@router.get("/scenarios")
async def list_scenarios():
    return {
        "scenarios": [{"id": k, **v} for k, v in SCENARIOS.items()],
        "defaults": DEFAULTS,
        "ranges": PARAM_RANGES,
        "disclaimer": DISCLAIMER,
        "simulated": True
    }

@router.post("")
async def create_simulation(body: SimInput, user=Depends(get_current_user)):
    if body.aoi not in AOIS or body.scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail="Unknown AOI or Scenario ID")
        
    ov = {k: float(v) for k, v in body.overrides.items() if k in PARAM_RANGES}
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
    
    # Store frames and run summary in DB
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
