import re
import json
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from backend.app.db.database import db
from backend.app.api.auth import get_current_user
from backend.app.agents.llm_adapter import detect_injection

router = APIRouter(prefix="/chat", tags=["Ask Mission Control Assistant"])

SOPS = [
    {"id": "SOP-1", "title": "Pre-monsoon Vulnerability Profiling", "text": "Identify active shear planes, pre-position earth movers along primary corridors (NH10/NH6/NH37), verify emergency shelter generators and potable water supplies before monsoon onset."},
    {"id": "SOP-2", "title": "Rainfall Threshold Watch & Pre-emptive Closure", "text": "When 24h precipitation exceeds regional intensity-duration threshold, escalate monitoring to Level-3, pre-emptively close highway sectors below unstable slopes, and place SDRF/NDRF on immediate standby."},
    {"id": "SOP-3", "title": "Ground Signs Escalation Protocol", "text": "Observation of fresh tension cracks, bulging road asphalt, tilting utility poles, or sudden muddy spring discharge requires immediate site cordon, geotech verification, and downstream evacuation staging."},
    {"id": "SOP-4", "title": "Runout-Path Evacuation & Safe Staging", "text": "Evacuate populations strictly out of the predicted runout footprint and secondary alluvial fans; never route evacuees across at-risk slope segments; stage shelters on high ridge shoulders."},
    {"id": "SOP-5", "title": "Public Warning Authorization", "text": "Emergency broadcast advisories must be multilingual, concise, specify helpline 1070/112, and require explicit written authorization from the District Collector / Authorized Approver."}
]

def search_sops(query: str, limit: int = 3) -> list[dict]:
    query_tokens = set(re.findall(r"[a-z]{3,}", query.lower()))
    scored = []
    for s in SOPS:
        doc_tokens = set(re.findall(r"[a-z]{3,}", (s["title"] + " " + s["text"]).lower()))
        score = len(query_tokens & doc_tokens)
        if score > 0:
            scored.append((score, s))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:limit]]

class ChatInput(BaseModel):
    question: str = Field(..., max_length=1000)
    incident_id: Optional[str] = None

@router.post("")
async def ask_mission_control(body: ChatInput, user=Depends(get_current_user)):
    flags = detect_injection(body.question)
    inc = None
    if body.incident_id:
        inc = await db.fetch_one("SELECT * FROM incidents WHERE id = ?", (body.incident_id,))
        
    matched_sops = search_sops(body.question)
    
    # Grounding context from DB
    facts = []
    if inc:
        status = inc["status"]
        facts.append(f"Incident {inc['id']} in {inc['aoi_name']} has status {status} [incident:state].")
        if inc.get("plans_json"):
            plans = json.loads(inc["plans_json"])
            if plans:
                current_plan = plans[-1]
                facts.append(f"Current Plan V{current_plan['version']} is {current_plan['status']} [incident:plan].")
                tasks = [t["title"] for t in current_plan.get("tasks", [])]
                facts.append(f"Proposed actions: {'; '.join(tasks[:3])} [incident:tasks].")
                
    for s in matched_sops:
        facts.append(f"{s['title']}: {s['text']} [{s['id']}].")
        
    if not facts:
        answer = "UNSUPPORTED: not in current records or SOP guidelines."
    else:
        answer = " ".join(facts)
        
    return {
        "answer": answer,
        "citations": [s["id"] for s in matched_sops] + (["incident:state", "incident:plan"] if inc else []),
        "injection_flags": flags,
        "quarantined": bool(flags),
        "simulated": True
    }
