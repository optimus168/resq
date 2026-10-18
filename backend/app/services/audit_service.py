import asyncio
import hashlib
import json
from backend.app.db.database import db
from backend.app.core.security import now_iso

_audit_lock = asyncio.Lock()

async def record_audit(action: str, actor: str, data: dict, incident_id: str = None) -> dict:
    """Append-only, SHA-256 hash-chained immutable audit log."""
    async with _audit_lock:
        last = await db.fetch_one("SELECT seq, hash FROM audit_ledger ORDER BY seq DESC LIMIT 1")
        seq = (last["seq"] + 1) if last else 1
        prev_hash = last["hash"] if last else "GENESIS"
        
        rec_meta = {
            "seq": seq,
            "ts": now_iso(),
            "action": action,
            "actor": actor,
            "incident_id": incident_id,
            "data": data,
            "prev_hash": prev_hash
        }
        
        serialized = json.dumps(rec_meta, sort_keys=True, default=str)
        curr_hash = hashlib.sha256((prev_hash + serialized).encode("utf-8")).hexdigest()
        
        await db.execute(
            """
            INSERT INTO audit_ledger (seq, ts, action, actor, incident_id, data, prev_hash, hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (seq, rec_meta["ts"], action, actor, incident_id, json.dumps(data), prev_hash, curr_hash)
        )
        
        return {**rec_meta, "hash": curr_hash}

async def verify_audit_chain() -> dict:
    """Verifies every block in the audit ledger against its previous cryptographic hash."""
    rows = await db.fetch_all("SELECT seq, ts, action, actor, incident_id, data, prev_hash, hash FROM audit_ledger ORDER BY seq ASC")
    prev_expected = "GENESIS"
    
    for r in rows:
        data_dict = json.loads(r["data"]) if isinstance(r["data"], str) else r["data"]
        rec_meta = {
            "seq": r["seq"],
            "ts": r["ts"],
            "action": r["action"],
            "actor": r["actor"],
            "incident_id": r["incident_id"],
            "data": data_dict,
            "prev_hash": r["prev_hash"]
        }
        
        if r["prev_hash"] != prev_expected:
            return {"intact": False, "broken_at_seq": r["seq"], "reason": "Previous hash mismatch"}
            
        expected_hash = hashlib.sha256((prev_expected + json.dumps(rec_meta, sort_keys=True, default=str)).encode("utf-8")).hexdigest()
        if r["hash"] != expected_hash:
            return {"intact": False, "broken_at_seq": r["seq"], "reason": "Hash signature mismatch"}
            
        prev_expected = r["hash"]
        
    return {"intact": True, "total_records": len(rows)}
