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
async def test_native_langgraph_execution():
    from backend.app.agents.orchestrator import compile_langgraph_workflow
    graph = compile_langgraph_workflow()
    initial_state = {
        "incident_id": "lg-test-01",
        "aoi": "gangtok",
        "scenario": {"name": "heavy_24h"},
        "agent_trace": []
    }
    result = await graph.ainvoke(initial_state)
    assert result is not None
    assert "agent_trace" in result
    executed_agents = [t["agent"] for t in result["agent_trace"]]
    assert "sentinel" in executed_agents
    assert "simulation" in executed_agents
    assert "verifier" in executed_agents
    assert "dispatcher" in executed_agents

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

@pytest.mark.asyncio
async def test_each_agent_execution_and_telemetry():
    await db.init()
    await seed_users()
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        op_login = await ac.post("/api/v1/auth/login", json={"email": "operator@bhuraksha.demo", "password": "Operate@RESQ26"})
        op_token = op_login.json()["token"]
        
        inc_res = await ac.post("/api/v1/incidents", json={"aoi": "gangtok", "scenario": "heavy_24h"}, headers={"Authorization": f"Bearer {op_token}"})
        assert inc_res.status_code == 200
        iid = inc_res.json()["id"]
        
        # Wait for 14-agent pipeline
        for _ in range(40):
            await asyncio.sleep(0.3)
            get_res = await ac.get(f"/api/v1/incidents/{iid}", headers={"Authorization": f"Bearer {op_token}"})
            inc_data = get_res.json()
            status_map = inc_data.get("agent_status", {})
            if inc_data.get("current_version", 0) >= 1 and status_map.get("dispatcher") == "done":
                break
                
        # 1. Verify get_incident contains full agent telemetry
        assert "agent_trace" in inc_data
        assert len(inc_data["agent_trace"]) > 10
        assert "agents_detail" in inc_data
        assert "agents" in inc_data
        assert len(inc_data["agents"]) == 14
        
        # 2. Check dedicated agents endpoint
        agents_res = await ac.get(f"/api/v1/incidents/{iid}/agents", headers={"Authorization": f"Bearer {op_token}"})
        assert agents_res.status_code == 200
        agents_payload = agents_res.json()
        assert agents_payload["total_events"] > 10
        assert agents_payload["total_tool_calls"] > 5
        
        agents_by_id = {a["id"]: a for a in agents_payload["agents"]}
        
        # Verify each core agent executed correctly
        assert agents_by_id["sentinel"]["status"] == "done"
        assert len(agents_by_id["sentinel"]["tool_calls"]) >= 2
        assert agents_by_id["sentinel"]["domain_summary"]["scenario_total_mm"] > 0
        
        assert agents_by_id["terrain"]["status"] == "done"
        assert agents_by_id["terrain"]["domain_summary"]["pct_slope_gt_30"] is not None
        
        assert agents_by_id["simulation"]["status"] == "done"
        assert agents_by_id["simulation"]["domain_summary"]["run_id"] is not None
        
        assert agents_by_id["risk"]["status"] == "done"
        assert agents_by_id["risk"]["domain_summary"]["category"] in ("LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL", "IMMINENT")
        
        assert agents_by_id["verifier"]["status"] == "done"
        assert agents_by_id["verifier"]["domain_summary"]["note"] is not None
        
        assert agents_by_id["impact"]["status"] == "done"
        assert agents_by_id["impact"]["domain_summary"]["villages_exposed"] is not None
        
        assert agents_by_id["route"]["status"] == "done"
        assert agents_by_id["route"]["domain_summary"]["selected_route"] is not None
        
        assert agents_by_id["resource"]["status"] == "done"
        assert agents_by_id["resource"]["domain_summary"]["rescue_unit"] is not None
        
        assert agents_by_id["planner"]["status"] == "done"
        assert agents_by_id["planner"]["domain_summary"]["tasks_count"] > 0
        
        assert agents_by_id["dispatcher"]["status"] == "done"
        assert "SMS" in agents_by_id["dispatcher"]["domain_summary"]["channels"]
        
        assert agents_by_id["field_intel"]["status"] == "done"
        assert agents_by_id["field_intel"]["domain_summary"]["reports_triaged"] > 0
        assert agents_by_id["field_intel"]["domain_summary"]["prompt_injections_quarantined"] >= 1

        assert agents_by_id["learner"]["status"] == "done"
        assert agents_by_id["learner"]["domain_summary"]["calibrated_c_soil"] is not None

        assert agents_by_id["orchestrator"]["status"] in ("waiting", "done")
        assert agents_by_id["orchestrator"]["domain_summary"]["current_version"] is not None

        assert agents_by_id["assistant"]["status"] == "ready"
        assert agents_by_id["assistant"]["domain_summary"]["assistant_status"] == "ONLINE_READY"

