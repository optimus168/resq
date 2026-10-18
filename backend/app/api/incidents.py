import json
import uuid
import asyncio
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.app.geospatial.terrain import AOIS
from backend.app.simulation.twin import SCENARIOS
from backend.app.db.database import db
from backend.app.core.security import now_iso, new_id
from backend.app.services.audit_service import record_audit
from backend.app.api.auth import get_current_user, require_roles
from backend.app.agents.orchestrator import (
    AGENTS,
    EDGES,
    REPLAN_RULES,
    BUDGET,
    run_incident_workflow,
    process_external_event
)

router = APIRouter(prefix="/incidents", tags=["Incidents & Multi-Agent Orchestration"])
OPERATORS = ("admin", "operator", "approver")

class IncidentCreateInput(BaseModel):
    aoi: str
    scenario: str = "heavy_24h"

class EventInput(BaseModel):
    type: Literal["RAIN_ESCALATION", "ROAD_BLOCKED", "FIELD_REPORT", "SENSOR_ANOMALY", "RESOURCE_FAILURE", "API_OUTAGE", "RESTORE"]
    payload: dict = {}
    idempotency_key: Optional[str] = None
    occurred_at: Optional[str] = None

class PlanDecisionInput(BaseModel):
    decision: Literal["approve", "reject", "request_changes"]
    notes: str = ""

@router.get("/agents/registry")
async def get_agent_registry():
    return {
        "agents": AGENTS,
        "edges": EDGES,
        "replan_rules": {k: {"invalidates": v[0], "reruns": v[1]} for k, v in REPLAN_RULES.items()},
        "budget": BUDGET,
        "simulated": True
    }

@router.post("")
async def create_incident(body: IncidentCreateInput, user=Depends(require_roles(*OPERATORS))):
    if body.aoi not in AOIS or body.scenario not in SCENARIOS:
        raise HTTPException(status_code=400, detail="Invalid AOI or Scenario")
        
    iid = new_id()
    scenario_cfg = {
        "scenario": body.scenario,
        "rain_multiplier": 1.0,
        "blocked_roads": [],
        "failed_resources": [],
        "sensor_anomaly": False,
        "api_outage": False
    }
    
    incident_doc = {
        "id": iid,
        "aoi": body.aoi,
        "aoi_name": AOIS[body.aoi]["name"],
        "status": "RUNNING",
        "trigger": "OPERATOR_DISPATCH",
        "scenario_json": json.dumps(scenario_cfg),
        "sim_overrides_json": json.dumps({}),
        "plans_json": json.dumps([]),
        "current_version": 0,
        "assumptions_json": json.dumps([]),
        "agent_status_json": json.dumps({a["id"]: "idle" for a in AGENTS}),
        "busy": 1,
        "correlation_id": uuid.uuid4().hex,
        "created_by": user["email"],
        "created_at": now_iso()
    }
    
    await db.execute(
        """
        INSERT INTO incidents (id, aoi, aoi_name, status, trigger, scenario_json, sim_overrides_json, plans_json, current_version, assumptions_json, agent_status_json, busy, correlation_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (iid, incident_doc["aoi"], incident_doc["aoi_name"], incident_doc["status"], incident_doc["trigger"],
         incident_doc["scenario_json"], incident_doc["sim_overrides_json"], incident_doc["plans_json"],
         incident_doc["current_version"], incident_doc["assumptions_json"], incident_doc["agent_status_json"],
         incident_doc["busy"], incident_doc["correlation_id"], incident_doc["created_by"], incident_doc["created_at"])
    )
    
    await record_audit("incident.created", user["email"], {"aoi": body.aoi, "scenario": body.scenario}, iid)
    asyncio.create_task(run_incident_workflow(incident_doc))
    return {"id": iid, "status": "RUNNING"}

@router.get("")
async def list_incidents(user=Depends(get_current_user)):
    rows = await db.fetch_all("SELECT id, aoi, aoi_name, status, current_version, created_at FROM incidents ORDER BY created_at DESC LIMIT 50")
    return rows

@router.get("/{iid}")
async def get_incident(iid: str, user=Depends(get_current_user)):
    row = await db.fetch_one("SELECT * FROM incidents WHERE id = ?", (iid,))
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    out = dict(row)
    for k in ("scenario_json", "sim_overrides_json", "plans_json", "assumptions_json", "agent_status_json"):
        clean_key = k.replace("_json", "")
        if k in out and out[k]:
            out[clean_key] = json.loads(out[k])
            del out[k]
            
    if "state_json" in out and out["state_json"]:
        try:
            st = json.loads(out["state_json"])
            out.update(st)
        except Exception:
            pass
        del out["state_json"]
    return out

@router.get("/{iid}/events")
async def get_incident_events(iid: str, after: int = 0, user=Depends(get_current_user)):
    rows = await db.fetch_all(
        "SELECT seq, ts, agent, type, plan_version, payload_json FROM agent_events WHERE incident_id = ? AND seq > ? ORDER BY seq ASC LIMIT 500",
        (iid, after)
    )
    res = []
    for r in rows:
        d = dict(r)
        payload = json.loads(d["payload_json"]) if d["payload_json"] else {}
        del d["payload_json"]
        res.append({**d, **payload})
    return res

@router.post("/{iid}/events")
async def post_incident_event(iid: str, body: EventInput, user=Depends(require_roles(*OPERATORS))):
    row = await db.fetch_one("SELECT id FROM incidents WHERE id = ?", (iid,))
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    key = body.idempotency_key or uuid.uuid4().hex
    occurred = body.occurred_at or now_iso()
    event_id = new_id()
    
    # Idempotent event bus check
    existing = await db.fetch_one("SELECT event_id FROM bus_events WHERE idempotency_key = ?", (key,))
    if existing:
        return {"status": "duplicate_ignored", "idempotency_key": key}
        
    await db.execute(
        """
        INSERT INTO bus_events (event_id, incident_id, type, occurred_at, published_at, payload_json, source, idempotency_key, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (event_id, iid, body.type, occurred, now_iso(), json.dumps(body.payload), user["email"], key, "ACCEPTED")
    )
    
    await db.execute("UPDATE incidents SET busy = 1 WHERE id = ?", (iid,))
    env = {
        "event_id": event_id,
        "type": body.type,
        "payload": body.payload,
        "source": user["email"]
    }
    asyncio.create_task(process_external_event(iid, env))
    return {"status": "accepted", "event_id": event_id, "idempotency_key": key}

@router.post("/{iid}/plans/{version}/decision")
async def plan_approval_gate(iid: str, version: int, body: PlanDecisionInput, user=Depends(require_roles("approver", "admin"))):
    """Cryptographically enforced Human Approval Gate. Approver/Admin required. Version-bound."""
    inc = await db.fetch_one("SELECT current_version, plans_json FROM incidents WHERE id = ?", (iid,))
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
        
    if version != inc["current_version"]:
        await record_audit("approval.stale_rejected", user["email"], {"version": version, "current": inc["current_version"]}, iid)
        raise HTTPException(
            status_code=409,
            detail=f"Stale plan version V{version}; Current is V{inc['current_version']}. Approvals are strictly version-bound."
        )
        
    plans = json.loads(inc["plans_json"])
    plan_idx = version - 1
    if plan_idx < 0 or plan_idx >= len(plans):
        raise HTTPException(status_code=404, detail="Plan version not found")
        
    target_plan = plans[plan_idx]
    if target_plan["status"] != "PENDING_APPROVAL":
        raise HTTPException(status_code=409, detail=f"Plan V{version} is already {target_plan['status']} (Not pending approval)")
        
    new_status = {"approve": "APPROVED", "reject": "REJECTED", "request_changes": "CHANGES_REQUESTED"}[body.decision]
    approval_entry = {
        "by": user["email"],
        "role": user["role"],
        "decision": body.decision,
        "notes": body.notes[:500],
        "ts": now_iso(),
        "version": version
    }
    target_plan["status"] = new_status
    target_plan["approvals"].append(approval_entry)
    
    if body.decision == "approve":
        target_plan["status"] = "EXECUTING"
        inc_status = "EXECUTING"
        # Release alerts bound to this version
        await db.execute(
            """
            UPDATE alerts SET status = 'DISPATCHED' WHERE incident_id = ? AND plan_version = ? AND status = 'PENDING_APPROVAL'
            """,
            (iid, version)
        )
    else:
        inc_status = new_status
        
    await db.execute(
        "UPDATE incidents SET plans_json = ?, status = ? WHERE id = ?",
        (json.dumps(plans), inc_status, iid)
    )
    await record_audit(f"plan.{body.decision}", user["email"], approval_entry, iid)
    return {"status": target_plan["status"], "version": version}
