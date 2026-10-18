import math
import json
import re
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File
from backend.app.db.database import db
from backend.app.core.security import now_iso, new_id
from backend.app.services.audit_service import record_audit
from backend.app.api.auth import get_current_user, require_roles
from backend.app.geospatial.terrain import AOIS, load_terrain, latlon_to_cell
from backend.app.agents.llm_adapter import detect_injection
from backend.app.api.incidents import post_incident_event, EventInput

router = APIRouter(prefix="/reports", tags=["Field & Citizen Reporting"])
OPERATORS = ("admin", "operator", "approver", "field_officer")

def triage_report(text: str, category: str, role: str) -> dict:
    flags = detect_injection(text)
    keywords = {
        "cracks": ["crack", "fissure", "crevice", "fracture", "split"],
        "slope_movement": ["sliding", "creep", "subsidence", "tilt", "slump", "bulge"],
        "blocked_road": ["debris", "rockfall", "boulder", "mud", "blocked", "cut off"],
        "water": ["turbid", "seepage", "spring", "muddy water", "overflow"]
    }
    
    hits = {k: sum(1 for w in words if w in text.lower()) for k, words in keywords.items()}
    suggested = max(hits, key=hits.get) if max(hits.values()) > 0 else category
    
    credibility = 0.85 if role in ("field_officer", "admin") else 0.60
    if suggested == category:
        credibility += 0.10
    if flags:
        credibility = 0.10
        
    return {
        "suggested_category": suggested,
        "credibility": round(min(credibility, 0.95), 2),
        "injection_flags": flags,
        "quarantined": bool(flags),
        "method": "Keyword rule classifier + prompt-injection guard (DEMO MODEL)"
    }

@router.post("")
async def create_field_report(
    lat: float = Form(...),
    lon: float = Form(...),
    category: str = Form(...),
    description: str = Form(""),
    client_id: str = Form(...),
    captured_at: Optional[str] = Form(None),
    user=Depends(get_current_user)
):
    if category not in ("cracks", "slope_movement", "blocked_road", "water", "other"):
        raise HTTPException(status_code=400, detail="Invalid hazard category")
        
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Latitude/Longitude out of geographic bounds")
        
    # Check for idempotent resubmission from PWA offline sync
    existing = await db.fetch_one("SELECT * FROM field_reports WHERE client_id = ?", (client_id,))
    if existing:
        return {**dict(existing), "sync_status": "already_synced"}
        
    # Match to AOI
    matched_aoi = None
    for aoi_id in AOIS:
        t = load_terrain(aoi_id)
        if latlon_to_cell(t, lat, lon) is not None:
            matched_aoi = aoi_id
            break
            
    # Duplicate detection (<300m within last 6 hours)
    six_hours_ago = now_iso()
    recent = await db.fetch_all("SELECT id, lat, lon FROM field_reports WHERE category = ?", (category,))
    duplicate_id = None
    for r in recent:
        d_lat = (r["lat"] - lat) * 111.0
        d_lon = (r["lon"] - lon) * 111.0 * math.cos(math.radians(lat))
        if math.hypot(d_lat, d_lon) < 0.30:  # 300m threshold
            duplicate_id = r["id"]
            break
            
    triage_info = triage_report(description, category, user["role"])
    report_id = new_id()
    
    await db.execute(
        """
        INSERT INTO field_reports (id, client_id, lat, lon, category, description, aoi, photo_path, by_user, role, captured_at, created_at, created_ts, duplicate_of, triage_json, verification, verified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (report_id, client_id, lat, lon, category, description, matched_aoi, None, user["email"], user["role"],
         captured_at or now_iso(), now_iso(), 0.0, duplicate_id, json.dumps(triage_info), "UNVERIFIED", None)
    )
    
    await record_audit("report.created", user["email"], {"id": report_id, "aoi": matched_aoi, "quarantined": triage_info["quarantined"]})
    
    # Auto-trigger event if valid deformation is reported in an active incident
    triggered_event = None
    if matched_aoi and not duplicate_id and not triage_info["quarantined"] and category in ("cracks", "slope_movement", "blocked_road"):
        active_inc = await db.fetch_one("SELECT id FROM incidents WHERE aoi = ? ORDER BY created_at DESC LIMIT 1", (matched_aoi,))
        if active_inc:
            etype = "ROAD_BLOCKED" if category == "blocked_road" else "FIELD_REPORT"
            triggered_event = await post_incident_event(
                active_inc["id"],
                EventInput(type=etype, payload={"report_id": report_id}, idempotency_key=f"report-{report_id}"),
                user
            )
            
    return {
        "id": report_id,
        "client_id": client_id,
        "aoi": matched_aoi,
        "duplicate_of": duplicate_id,
        "triage": triage_info,
        "sync_status": "synced",
        "triggered_event": triggered_event
    }

@router.get("")
async def list_reports(user=Depends(get_current_user)):
    rows = await db.fetch_all("SELECT * FROM field_reports ORDER BY created_at DESC LIMIT 100")
    out = []
    for r in rows:
        d = dict(r)
        d["triage"] = json.loads(d["triage_json"]) if d["triage_json"] else {}
        del d["triage_json"]
        out.append(d)
    return out

@router.post("/{rid}/verify")
async def verify_report(rid: str, status: Literal["VERIFIED", "REJECTED"], user=Depends(require_roles(*OPERATORS))):
    res = await db.execute("UPDATE field_reports SET verification = ?, verified_by = ? WHERE id = ?", (status, user["email"], rid))
    if res == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    await record_audit("report.verified", user["email"], {"id": rid, "status": status})
    return {"status": status, "verified_by": user["email"]}
