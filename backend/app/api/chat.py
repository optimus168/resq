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
    {"id": "SOP-5", "title": "Public Warning Authorization", "text": "Emergency broadcast advisories must be CAP 1.2 compliant, concise, specify helpline 1070/112, and require explicit written authorization from the District Collector / Authorized Approver."}
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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None

@router.post("")
async def ask_mission_control(body: ChatInput, user=Depends(get_current_user)):
    flags = detect_injection(body.question)
    if flags:
        return {
            "answer": "QUARANTINED: Prompt-injection pattern detected in query. Query blocked before reaching Main Officer Assistant LLM.",
            "citations": ["NDMA-SOP-5"],
            "injection_flags": flags,
            "quarantined": True,
            "simulated": False,
        }

    from backend.app.agents.officer_assistant import get_officer_assistant
    assistant = get_officer_assistant()
    res = await assistant.assist_officer(
        question=body.question,
        incident_id=body.incident_id,
        lat=body.latitude,
        lon=body.longitude,
        location_name=body.location_name,
    )

    matched_sops = search_sops(body.question)
    citations = list(dict.fromkeys((res.get("citations") or []) + [s["id"] for s in matched_sops]))

    answer = res.get("answer", "")
    if matched_sops and not any(s["id"] in answer for s in matched_sops):
        sop_summary = "; ".join(f"{s['id']}: {s['title']}" for s in matched_sops)
        answer = f"{answer}\n\n**Referenced Protocols:** {sop_summary}."

    return {
        "answer": answer,
        "citations": citations,
        "agent_id": res.get("agent_id"),
        "agent_role": res.get("agent_role"),
        "llm_used": res.get("llm_used", False),
        "model_id": res.get("model_id"),
        "qlora_adapter_loaded": res.get("qlora_adapter_loaded", False),
        "tools_executed": res.get("tools_executed", []),
        "telemetry_summary": res.get("telemetry_summary"),
        "injection_flags": flags,
        "quarantined": False,
        "simulated": False
    }
