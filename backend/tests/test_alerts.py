import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.db.database import db
from backend.app.db.seed import seed_users
from backend.app.core.security import new_id, now_iso
import json

@pytest.mark.asyncio
async def test_alert_lifecycle_and_transition_guard():
    await db.init()
    await seed_users()
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        op_login = await ac.post("/api/v1/auth/login", json={"email": "operator@bhuraksha.demo", "password": "Operate@RESQ26"})
        token = op_login.json()["token"]
        
        # Create test alert in DISPATCHED state
        aid = new_id()
        alert_data = {
            "id": aid,
            "incident_id": "test-inc-1",
            "aoi": "gangtok",
            "plan_version": 1,
            "severity": "HIGH",
            "status": "DISPATCHED",
            "channels_json": json.dumps(["SMS", "IVR"]),
            "audience_json": json.dumps(["Gangtok"]),
            "messages_json": json.dumps({"en": "Test warning"}),
            "translation_source": "template",
            "needs_human_review": 0,
            "history_json": json.dumps([{"ts": now_iso(), "to": "DISPATCHED", "by": "system"}]),
            "receipts_json": json.dumps([]),
            "created_at": now_iso()
        }
        await db.execute(
            """
            INSERT INTO alerts (id, incident_id, aoi, plan_version, severity, status, channels_json, audience_json, messages_json, translation_source, needs_human_review, history_json, receipts_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (alert_data["id"], alert_data["incident_id"], alert_data["aoi"], alert_data["plan_version"],
             alert_data["severity"], alert_data["status"], alert_data["channels_json"], alert_data["audience_json"],
             alert_data["messages_json"], alert_data["translation_source"], alert_data["needs_human_review"],
             alert_data["history_json"], alert_data["receipts_json"], alert_data["created_at"])
        )
        
        # 1. List alerts
        list_res = await ac.get("/api/v1/alerts", headers={"Authorization": f"Bearer {token}"})
        assert list_res.status_code == 200
        alerts = list_res.json()
        assert any(a["id"] == aid for a in alerts)
        
        # 2. Legal transition: DISPATCHED -> ACKNOWLEDGED
        t1 = await ac.post(f"/api/v1/alerts/{aid}/transition?to_status=ACKNOWLEDGED", headers={"Authorization": f"Bearer {token}"})
        assert t1.status_code == 200
        assert t1.json()["status"] == "ACKNOWLEDGED"
        
        # 3. Legal transition: ACKNOWLEDGED -> RESOLVED
        t2 = await ac.post(f"/api/v1/alerts/{aid}/transition?to_status=RESOLVED", headers={"Authorization": f"Bearer {token}"})
        assert t2.status_code == 200
        assert t2.json()["status"] == "RESOLVED"
        
        # 4. Illegal transition: RESOLVED -> PENDING_APPROVAL -> 409 Conflict
        t3 = await ac.post(f"/api/v1/alerts/{aid}/transition?to_status=PENDING_APPROVAL", headers={"Authorization": f"Bearer {token}"})
        assert t3.status_code == 409
        assert "illegal" in t3.json()["detail"].lower()
