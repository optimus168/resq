from fastapi import APIRouter, Depends
from backend.app.db.database import db
from backend.app.services.audit_service import verify_audit_chain
from backend.app.api.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit & Governance"])

@router.get("")
async def get_audit_trail(limit: int = 100, user=Depends(get_current_user)):
    rows = await db.fetch_all("SELECT seq, ts, action, actor, incident_id, data, prev_hash, hash FROM audit_ledger ORDER BY seq DESC LIMIT ?", (limit,))
    return rows

@router.get("/verify")
async def verify_audit(user=Depends(get_current_user)):
    """Validates the tamper-evident cryptographic hash chain of the entire audit ledger."""
    return await verify_audit_chain()
