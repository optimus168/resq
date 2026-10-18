import json
from fastapi import APIRouter, HTTPException, Depends
from backend.app.db.database import db
from backend.app.core.security import now_iso
from backend.app.services.audit_service import record_audit
from backend.app.api.auth import get_current_user, require_roles

router = APIRouter(prefix="/alerts", tags=["Alert Center"])
OPERATORS = ("admin", "operator", "approver")

TRANSITIONS = {
    "DRAFT": ["PENDING_APPROVAL", "CANCELLED"],
    "PENDING_APPROVAL": ["CANCELLED"],
    "APPROVED": ["DISPATCHED", "CANCELLED"],
    "DISPATCHED": ["ACKNOWLEDGED", "CANCELLED"],
    "ACKNOWLEDGED": ["RESOLVED"],
    "RESOLVED": [],
    "CANCELLED": []
}

@router.get("")
async def list_alerts(user=Depends(get_current_user)):
    rows = await db.fetch_all("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100")
    res = []
    for r in rows:
        d = dict(r)
        d["channels"] = json.loads(d["channels_json"])
        d["audience"] = json.loads(d["audience_json"])
        d["messages"] = json.loads(d["messages_json"])
        d["history"] = json.loads(d["history_json"])
        d["receipts"] = json.loads(d["receipts_json"])
        del d["channels_json"], d["audience_json"], d["messages_json"], d["history_json"], d["receipts_json"]
        res.append(d)
    return res

@router.post("/{aid}/transition")
async def transition_alert(aid: str, to_status: str, user=Depends(require_roles(*OPERATORS))):
    row = await db.fetch_one("SELECT * FROM alerts WHERE id = ?", (aid,))
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    cur_status = row["status"]
    allowed = TRANSITIONS.get(cur_status, [])
    if to_status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Illegal alert state transition: {cur_status} -> {to_status}. Approval occurs strictly via the Plan Human Approval Gate."
        )
        
    history = json.loads(row["history_json"])
    history.append({"ts": now_iso(), "to": to_status, "by": user["email"]})
    
    await db.execute(
        "UPDATE alerts SET status = ?, history_json = ? WHERE id = ?",
        (to_status, json.dumps(history), aid)
    )
    await record_audit("alert.transition", user["email"], {"id": aid, "from": cur_status, "to": to_status}, row["incident_id"])
    return {"id": aid, "status": to_status}
