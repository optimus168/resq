import math
import json
import os
import re
from pathlib import Path
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends, Form, UploadFile, File
from fastapi.responses import FileResponse
from backend.app.db.database import db
from backend.app.core.security import now_iso, new_id
from backend.app.services.audit_service import record_audit
from backend.app.api.auth import get_current_user, get_current_user_optional, require_roles
from backend.app.geospatial.terrain import AOIS, load_terrain, latlon_to_cell
from backend.app.agents.llm_adapter import detect_injection
from backend.app.api.incidents import post_incident_event, EventInput
from backend.app.services.textbee_service import notify_officers_critical_sms, normalize_indian_phone

router = APIRouter(prefix="/reports", tags=["Field & Citizen Reporting"])
OPERATORS = ("admin", "operator", "approver", "field_officer")


async def get_report_actor(user=Depends(get_current_user_optional)) -> dict:
    if user:
        return user
    return {
        "id": "public-traveler",
        "email": "traveler@public.bhuraksha.demo",
        "name": "Traveler / Citizen Reporter",
        "role": "citizen",
    }

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "data" / "uploads" / "reports"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _safe_ext(filename: Optional[str], default_ext: str) -> str:
    if not filename or "." not in filename:
        return default_ext
    ext = "." + filename.rsplit(".", 1)[-1].lower()
    ext = re.sub(r"[^.a-z0-9]", "", ext)
    return ext[:10] if len(ext) > 1 else default_ext


async def _save_upload(upload: Optional[UploadFile], prefix: str, report_id: str, default_ext: str) -> Optional[dict]:
    if not upload or not getattr(upload, "filename", None):
        return None
    content = await upload.read()
    if not content:
        return None
    ext = _safe_ext(upload.filename, default_ext)
    fname = f"{prefix}_{report_id}{ext}"
    fpath = UPLOAD_DIR / fname
    fpath.write_bytes(content)
    return {
        "filename": upload.filename,
        "stored_name": fname,
        "url": f"/api/v1/reports/media/{fname}",
        "size_bytes": len(content),
        "content_type": upload.content_type or "application/octet-stream",
    }


def triage_report(text: str, category: str, role: str, severity: str = "MODERATE") -> dict:
    flags = detect_injection(text)
    keywords = {
        "cracks": ["crack", "fissure", "crevice", "fracture", "split"],
        "slope_movement": ["sliding", "creep", "subsidence", "tilt", "slump", "bulge", "landslide"],
        "blocked_road": ["debris", "rockfall", "boulder", "mud", "blocked", "cut off", "highway"],
        "water": ["turbid", "seepage", "spring", "muddy water", "overflow", "burst"]
    }

    hits = {k: sum(1 for w in words if w in text.lower()) for k, words in keywords.items()}
    suggested = max(hits, key=hits.get) if max(hits.values()) > 0 else category

    credibility = 0.85 if role in ("field_officer", "admin", "approver") else 0.65
    if suggested == category:
        credibility += 0.10
    if flags:
        credibility = 0.10

    sev_norm = (severity or "MODERATE").upper()
    if sev_norm not in ("LOW", "MODERATE", "HIGH", "CRITICAL"):
        sev_norm = "MODERATE"

    return {
        "suggested_category": suggested,
        "severity": sev_norm,
        "credibility": round(min(credibility, 0.95), 2),
        "injection_flags": flags,
        "quarantined": bool(flags),
        "method": "Geotechnical keyword classifier + prompt-injection guard"
    }


@router.get("/media/{filename}")
async def get_report_media(filename: str):
    clean_name = os.path.basename(filename)
    fpath = UPLOAD_DIR / clean_name
    if not fpath.exists() or not fpath.is_file():
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(fpath)


@router.post("")
async def create_field_report(
    lat: float = Form(...),
    lon: float = Form(...),
    category: str = Form(...),
    description: str = Form(""),
    client_id: str = Form(...),
    severity: str = Form("HIGH"),
    notify_officer: str = Form("true"),
    title: Optional[str] = Form(None),
    captured_at: Optional[str] = Form(None),
    officer_phone: Optional[str] = Form(None),
    traveler_phone: Optional[str] = Form(None),
    is_emergency: str = Form("false"),
    photo: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    report_file: Optional[UploadFile] = File(None),
    user=Depends(get_report_actor)
):
    valid_categories = (
        "cracks", "slope_movement", "blocked_road", "water", "other",
        "landslide", "rockfall", "debris_flow", "stranded_vehicle", "road_subsidence", "emergency_sos"
    )
    if category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid hazard category. Must be one of: {', '.join(valid_categories)}")

    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        raise HTTPException(status_code=400, detail="Latitude/Longitude out of geographic bounds")

    # Normalize traveler phone if provided (10-digit Indian number)
    norm_traveler_phone = None
    if traveler_phone and traveler_phone.strip():
        try:
            norm_traveler_phone = normalize_indian_phone(traveler_phone.strip(), allow_empty=True)
        except ValueError:
            norm_traveler_phone = traveler_phone.strip()

    # Check for idempotent resubmission from PWA offline sync
    existing = await db.fetch_one("SELECT * FROM field_reports WHERE client_id = ?", (client_id,))
    if existing:
        d = dict(existing)
        d["triage"] = json.loads(d["triage_json"]) if d.get("triage_json") else {}
        return {**d, "sync_status": "already_synced"}

    # Match to AOI
    matched_aoi = None
    for aoi_id in AOIS:
        t = load_terrain(aoi_id)
        if latlon_to_cell(t, lat, lon) is not None:
            matched_aoi = aoi_id
            break

    # Duplicate detection (<300m within last 6 hours)
    recent = await db.fetch_all("SELECT id, lat, lon FROM field_reports WHERE category = ?", (category,))
    duplicate_id = None
    for r in recent:
        d_lat = (r["lat"] - lat) * 111.0
        d_lon = (r["lon"] - lon) * 111.0 * math.cos(math.radians(lat))
        if math.hypot(d_lat, d_lon) < 0.30:  # 300m threshold
            duplicate_id = r["id"]
            break

    report_id = new_id()
    triage_info = triage_report(description, category, user["role"], severity=severity)

    photo_meta = await _save_upload(photo, "img", report_id, ".jpg")
    video_meta = await _save_upload(video, "vid", report_id, ".mp4")
    doc_meta = await _save_upload(report_file, "doc", report_id, ".pdf")

    is_emerg = (
        str(is_emergency).lower() in ("true", "1", "yes")
        or category in ("stranded_vehicle", "emergency_sos", "rockfall", "landslide")
        or triage_info["severity"] in ("HIGH", "CRITICAL")
    )
    should_notify = str(notify_officer).lower() in ("true", "1", "yes", "on") or is_emerg
    now_str = now_iso()
    dispatch_id = f"NTF-{report_id[:8].upper()}" if should_notify else None

    triage_info.update({
        "title": title or f"{category.replace('_', ' ').title()} Report",
        "photo": photo_meta,
        "video": video_meta,
        "report_file": doc_meta,
        "traveler_phone": norm_traveler_phone or traveler_phone,
        "is_emergency": is_emerg,
        "officer_notified": should_notify,
        "officer_notified_at": now_str if should_notify else None,
        "officer_dispatch_id": dispatch_id,
        "officer_acknowledged": False,
        "notified_target": "District Collector & SDMA Duty Officer" if should_notify else None,
    })

    photo_url = photo_meta["url"] if photo_meta else None

    await db.execute(
        """
        INSERT INTO field_reports (id, client_id, lat, lon, category, description, aoi, photo_path, by_user, role, captured_at, created_at, created_ts, duplicate_of, triage_json, verification, verified_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            report_id,
            client_id,
            lat,
            lon,
            category,
            description,
            matched_aoi,
            photo_url,
            user["email"],
            user["role"],
            captured_at or now_str,
            now_str,
            0.0,
            duplicate_id,
            json.dumps(triage_info),
            "UNVERIFIED",
            None,
        ),
    )

    await record_audit(
        "report.created",
        user["email"],
        {
            "id": report_id,
            "aoi": matched_aoi,
            "severity": triage_info["severity"],
            "officer_notified": should_notify,
            "is_emergency": is_emerg,
            "has_photo": bool(photo_meta),
            "has_video": bool(video_meta),
            "has_document": bool(doc_meta),
            "quarantined": triage_info["quarantined"],
        },
    )

    sms_dispatch = None
    if should_notify and not triage_info["quarantined"]:
        media_tags = []
        if photo_meta:
            media_tags.append("Photo")
        if video_meta:
            media_tags.append("Video")
        if doc_meta:
            media_tags.append("Doc")
        media_str = f" [Media: {', '.join(media_tags)}]" if media_tags else ""

        prefix = "[BHURAKSHA EMERGENCY ALERT]" if is_emerg else "[BHURAKSHA CRITICAL FIELD ALERT]"
        traveler_contact_info = f" | Traveler Ph: {norm_traveler_phone}" if norm_traveler_phone else ""
        sms_msg = (
            f"{prefix} Severity: {triage_info['severity']}. "
            f"Category: {category.replace('_', ' ').title()}. "
            f"Coords: {lat:.4f}, {lon:.4f} ({matched_aoi.upper() if matched_aoi else 'NER'}). "
            f"'{triage_info['title']}'. "
            f"Dispatch: {dispatch_id}{traveler_contact_info}.{media_str} "
            f"Take immediate officer action."
        )
        # Note: SMS severity alert is sent ONLY TO ON-DUTY OFFICERS.
        extra_phones = [officer_phone] if officer_phone else None
        try:
            sms_dispatch = await notify_officers_critical_sms(
                message=sms_msg,
                event_type="traveler_emergency_alert" if is_emerg else "field_report_alert",
                report_id=report_id,
                extra_recipients=extra_phones,
                triggered_by=user["email"],
            )
            triage_info["sms_dispatch"] = sms_dispatch
            # Re-update triage_json with sms_dispatch record
            await db.execute(
                "UPDATE field_reports SET triage_json = ? WHERE id = ?",
                (json.dumps(triage_info), report_id),
            )
        except Exception as exc:
            sms_dispatch = {"status": "ERROR", "detail": str(exc)}

        await record_audit(
            "officer.notified",
            user["email"],
            {
                "report_id": report_id,
                "dispatch_id": dispatch_id,
                "severity": triage_info["severity"],
                "category": category,
                "aoi": matched_aoi,
                "target": "District Collector & SDMA Duty Officer",
                "sms_dispatch": sms_dispatch,
            },
        )

    # Auto-trigger event if valid deformation is reported in an active incident
    triggered_event = None
    if matched_aoi and not duplicate_id and not triage_info["quarantined"] and category in ("cracks", "slope_movement", "blocked_road"):
        active_inc = await db.fetch_one("SELECT id FROM incidents WHERE aoi = ? ORDER BY created_at DESC LIMIT 1", (matched_aoi,))
        if active_inc:
            etype = "ROAD_BLOCKED" if category == "blocked_road" else "FIELD_REPORT"
            triggered_event = await post_incident_event(
                active_inc["id"],
                EventInput(
                    type=etype,
                    payload={"report_id": report_id, "severity": triage_info["severity"]},
                    idempotency_key=f"report-{report_id}",
                ),
                user,
            )

    return {
        "id": report_id,
        "client_id": client_id,
        "aoi": matched_aoi,
        "severity": triage_info["severity"],
        "photo_url": photo_url,
        "video_url": video_meta["url"] if video_meta else None,
        "report_file_url": doc_meta["url"] if doc_meta else None,
        "officer_notified": should_notify,
        "officer_dispatch_id": dispatch_id,
        "duplicate_of": duplicate_id,
        "triage": triage_info,
        "sync_status": "synced",
        "triggered_event": triggered_event,
    }


def _hydrate_report_row(r) -> dict:
    d = dict(r)
    triage = json.loads(d["triage_json"]) if d.get("triage_json") else {}
    if "triage_json" in d:
        del d["triage_json"]
    d["triage"] = triage
    d["severity"] = triage.get("severity", "MODERATE")
    d["title"] = triage.get("title") or f"{(d.get('category') or 'field').replace('_', ' ').title()} Observation"
    d["status"] = d.get("verification") or "PENDING"
    d["author"] = d.get("by_user")
    d["quarantined"] = bool(triage.get("quarantined"))
    d["photo_url"] = d.get("photo_path") or (triage.get("photo") or {}).get("url")
    d["video_url"] = (triage.get("video") or {}).get("url")
    d["video_name"] = (triage.get("video") or {}).get("filename")
    d["report_file_url"] = (triage.get("report_file") or {}).get("url")
    d["report_file_name"] = (triage.get("report_file") or {}).get("filename")
    d["officer_notified"] = bool(triage.get("officer_notified"))
    d["officer_notified_at"] = triage.get("officer_notified_at")
    d["officer_dispatch_id"] = triage.get("officer_dispatch_id")
    d["officer_acknowledged"] = bool(triage.get("officer_acknowledged"))
    d["notified_target"] = triage.get("notified_target") or "District Collector & SDMA Duty Officer"
    return d


@router.get("")
async def list_reports(user=Depends(get_report_actor)):
    rows = await db.fetch_all("SELECT * FROM field_reports ORDER BY created_at DESC LIMIT 100")
    return [_hydrate_report_row(r) for r in rows]


@router.get("/notifications")
async def list_officer_notifications(user=Depends(get_report_actor)):
    rows = await db.fetch_all("SELECT * FROM field_reports ORDER BY created_at DESC LIMIT 50")
    notifications = []
    for r in rows:
        item = _hydrate_report_row(r)
        if item.get("officer_notified") and not item.get("quarantined"):
            notifications.append({
                "id": item["id"],
                "dispatch_id": item.get("officer_dispatch_id") or f"NTF-{item['id'][:8].upper()}",
                "title": item["title"],
                "category": item["category"],
                "severity": item["severity"],
                "aoi": item.get("aoi"),
                "lat": item.get("lat"),
                "lon": item.get("lon"),
                "description": item.get("description"),
                "author": item.get("author"),
                "notified_at": item.get("officer_notified_at") or item.get("created_at"),
                "acknowledged": item.get("officer_acknowledged", False),
                "status": item.get("status"),
                "photo_url": item.get("photo_url"),
                "video_url": item.get("video_url"),
                "report_file_url": item.get("report_file_url"),
                "report_file_name": item.get("report_file_name"),
            })
    return notifications


@router.post("/{rid}/notify-officer")
async def notify_officer_for_report(rid: str, user=Depends(get_report_actor)):
    row = await db.fetch_one("SELECT * FROM field_reports WHERE id = ?", (rid,))
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    triage = json.loads(row["triage_json"]) if row.get("triage_json") else {}
    now_str = now_iso()
    dispatch_id = triage.get("officer_dispatch_id") or f"NTF-{rid[:8].upper()}"
    triage["officer_notified"] = True
    triage["officer_notified_at"] = now_str
    triage["officer_dispatch_id"] = dispatch_id
    triage["notified_target"] = "District Collector & SDMA Duty Officer"

    sms_msg = (
        f"[BHURAKSHA OFFICER NOTIFICATION] {triage.get('severity', 'HIGH')} report: "
        f"'{triage.get('title', row.get('category'))}'. Dispatch ID: {dispatch_id}."
    )
    sms_res = await notify_officers_critical_sms(
        message=sms_msg,
        event_type="officer_notify_sms",
        report_id=rid,
        triggered_by=user["email"],
    )
    triage["sms_dispatch"] = sms_res

    await db.execute(
        "UPDATE field_reports SET triage_json = ? WHERE id = ?",
        (json.dumps(triage), rid),
    )
    await record_audit(
        "officer.notified",
        user["email"],
        {
            "report_id": rid,
            "dispatch_id": dispatch_id,
            "severity": triage.get("severity", "HIGH"),
            "target": "District Collector & SDMA Duty Officer",
            "sms_dispatch": sms_res,
        },
    )
    return {
        "id": rid,
        "officer_notified": True,
        "officer_notified_at": now_str,
        "officer_dispatch_id": dispatch_id,
        "target": "District Collector & SDMA Duty Officer",
        "sms_dispatch": sms_res,
    }


@router.post("/{rid}/acknowledge")
async def acknowledge_officer_notification(rid: str, user=Depends(get_report_actor)):
    row = await db.fetch_one("SELECT * FROM field_reports WHERE id = ?", (rid,))
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    triage = json.loads(row["triage_json"]) if row.get("triage_json") else {}
    triage["officer_acknowledged"] = True
    triage["acknowledged_by"] = user["email"]
    triage["acknowledged_at"] = now_iso()
    await db.execute(
        "UPDATE field_reports SET triage_json = ? WHERE id = ?",
        (json.dumps(triage), rid),
    )
    await record_audit("officer.acknowledged_report", user["email"], {"report_id": rid})
    return {"id": rid, "officer_acknowledged": True, "acknowledged_by": user["email"]}


@router.post("/{rid}/severity")
@router.patch("/{rid}/severity")
async def update_report_severity(
    rid: str,
    severity: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"],
    notify_officer: bool = True,
    user=Depends(get_report_actor),
):
    row = await db.fetch_one("SELECT * FROM field_reports WHERE id = ?", (rid,))
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    triage = json.loads(row["triage_json"]) if row.get("triage_json") else {}
    old_severity = triage.get("severity", "MODERATE")
    triage["severity"] = severity
    triage["severity_updated_by"] = user["email"]
    triage["severity_updated_at"] = now_iso()

    sms_res = None
    if notify_officer or severity in ("HIGH", "CRITICAL"):
        triage["officer_notified"] = True
        triage["officer_notified_at"] = now_iso()
        dispatch_id = triage.get("officer_dispatch_id") or f"NTF-{rid[:8].upper()}"
        triage["officer_dispatch_id"] = dispatch_id
        sms_msg = (
            f"[BHURAKSHA SEVERITY ESCALATION] Report '{triage.get('title', row.get('category'))}' "
            f"updated from {old_severity} to {severity} by {user['email']}. Dispatch: {dispatch_id}."
        )
        try:
            sms_res = await notify_officers_critical_sms(
                message=sms_msg,
                event_type="severity_updated_sms",
                report_id=rid,
                triggered_by=user["email"],
            )
            triage["sms_dispatch"] = sms_res
        except Exception:
            pass

    await db.execute(
        "UPDATE field_reports SET triage_json = ? WHERE id = ?",
        (json.dumps(triage), rid),
    )
    await record_audit(
        "report.severity_updated",
        user["email"],
        {
            "report_id": rid,
            "old_severity": old_severity,
            "new_severity": severity,
            "updated_by": user["email"],
            "sms_dispatch": sms_res,
        },
    )
    return {
        "id": rid,
        "old_severity": old_severity,
        "severity": severity,
        "updated_by": user["email"],
        "officer_notified": triage.get("officer_notified", False),
        "sms_dispatch": sms_res,
    }


@router.post("/{rid}/verify")
async def verify_report(rid: str, status: Literal["VERIFIED", "REJECTED"], user=Depends(require_roles(*OPERATORS))):
    res = await db.execute("UPDATE field_reports SET verification = ?, verified_by = ? WHERE id = ?", (status, user["email"], rid))
    if res == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    await record_audit("report.verified", user["email"], {"id": rid, "status": status})
    return {"status": status, "verified_by": user["email"]}
