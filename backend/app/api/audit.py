import json
from fastapi import APIRouter, Depends
from backend.app.db.database import db
from backend.app.services.audit_service import verify_audit_chain
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit & Governance"])

def parse_row(r):
    d = dict(r)
    if "data" in d and isinstance(d["data"], str):
        try:
            d["payload"] = json.loads(d["data"])
        except Exception:
            d["payload"] = d["data"]
    d["current_hash"] = d.get("hash")
    d["id"] = d.get("seq")
    return d

@router.get("")
@router.get("/ledger")
async def get_audit_trail(limit: int = 100, user=Depends(get_current_user)):
    rows = await db.fetch_all("SELECT seq, ts, action, actor, incident_id, data, prev_hash, hash FROM audit_ledger ORDER BY seq DESC LIMIT ?", (limit,))
    records = [parse_row(r) for r in rows]
    return {"records": records, "total": len(records)}

@router.get("/verify")
async def verify_audit(user=Depends(get_current_user)):
    """Validates the tamper-evident cryptographic hash chain of the entire audit ledger."""
    return await verify_audit_chain()
