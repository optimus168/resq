import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.db.database import db
from backend.app.db.seed import seed_users
from backend.app.agents.orchestrator import AGENTS, AGENT_TOOLS

@pytest.mark.asyncio
async def test_agent_registry():
    assert len(AGENTS) == 14
    expected_agents = {
        "orchestrator", "sentinel", "terrain", "field_intel", "learner",
        "simulation", "risk", "verifier", "impact", "route", "resource",
        "planner", "dispatcher", "assistant"
    }
    actual_agents = {a["id"] for a in AGENTS}
    assert expected_agents == actual_agents
    
    # Assert tool allowlist boundaries
    assert "sim.run" in AGENT_TOOLS["simulation"]
    assert "sim.run" not in AGENT_TOOLS["dispatcher"]
    assert "alert.draft" in AGENT_TOOLS["dispatcher"]
    assert "alert.draft" not in AGENT_TOOLS["sentinel"]

@pytest.mark.asyncio
async def test_full_incident_and_human_approval_gate():
    await db.init()
    await seed_users()
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login as operator to trigger incident
        op_login = await ac.post("/api/v1/auth/login", json={"email": "operator@bhuraksha.demo", "password": "Operate@RESQ26"})
        op_token = op_login.json()["token"]
        
        # 2. Login as approver (District Collector)
        app_login = await ac.post("/api/v1/auth/login", json={"email": "collector@bhuraksha.demo", "password": "Approve@RESQ26"})
        app_token = app_login.json()["token"]
        
        # 3. Create incident
        inc_res = await ac.post("/api/v1/incidents", json={"aoi": "gangtok", "scenario": "heavy_24h"}, headers={"Authorization": f"Bearer {op_token}"})
        assert inc_res.status_code == 200
        iid = inc_res.json()["id"]
        
        # Wait briefly for background execution to generate Plan V1
        for _ in range(25):
            await asyncio.sleep(0.3)
            get_res = await ac.get(f"/api/v1/incidents/{iid}", headers={"Authorization": f"Bearer {op_token}"})
            inc_data = get_res.json()
            if inc_data.get("current_version", 0) >= 1 and inc_data["status"] == "PENDING_APPROVAL":
                break
                
        assert inc_data["current_version"] == 1
        assert inc_data["status"] == "PENDING_APPROVAL"
        assert len(inc_data["plans"]) == 1
        plan_v1 = inc_data["plans"][0]
        assert len(plan_v1["tasks"]) > 0
        
        # 4. Operator attempts to approve -> 403 Forbidden
        denied_res = await ac.post(
            f"/api/v1/incidents/{iid}/plans/1/decision",
            json={"decision": "approve", "notes": "Operator trying to sign off"},
            headers={"Authorization": f"Bearer {op_token}"}
        )
        assert denied_res.status_code == 403
        
        # 5. Approver (Collector) approves Plan V1 -> 200 OK
        approved_res = await ac.post(
            f"/api/v1/incidents/{iid}/plans/1/decision",
            json={"decision": "approve", "notes": "Approved by District Collector"},
            headers={"Authorization": f"Bearer {app_token}"}
        )
        assert approved_res.status_code == 200
        assert approved_res.json()["status"] == "EXECUTING"
        
        # 6. Double approval attempt -> 409 Conflict
        double_res = await ac.post(
            f"/api/v1/incidents/{iid}/plans/1/decision",
            json={"decision": "approve", "notes": "Trying to approve twice"},
            headers={"Authorization": f"Bearer {app_token}"}
        )
        assert double_res.status_code == 409

@pytest.mark.asyncio
async def test_ask_mission_control_citations():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login = await ac.post("/api/v1/auth/login", json={"email": "operator@bhuraksha.demo", "password": "Operate@RESQ26"})
        token = login.json()["token"]
        
        res = await ac.post(
            "/api/v1/chat",
            json={"question": "What is the pre-monsoon road closure protocol?"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data["citations"]) > 0
        assert any(c.startswith("SOP-") for c in data["citations"])
        assert "SOP-1" in data["answer"] or "SOP-2" in data["answer"]
