import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.db.database import db
from backend.app.db.seed import seed_users
from backend.app.agents.adaptive_supervisor import AdaptiveSupervisor
from backend.app.agents.evidence_reconciliation import EvidenceReconciliationAgent, ReconciliationIssue
from backend.app.geospatial.network_resilience import lifeline_engine
from backend.app.ml.agent_eval_lab import run_evaluation_lab

@pytest.mark.asyncio
async def test_adaptive_supervisor_dynamic_routing_and_budget_guards():
    """Verify AdaptiveSupervisor dynamically routes based on state and enforces budget limits."""
    sup = AdaptiveSupervisor(incident_id="test-inc-01", aoi="gangtok", max_iterations=4)
    
    # Step 1: Uninitialized -> PARALLEL_INGESTION
    d1 = sup.decide_next_action()
    assert d1.action == "PARALLEL_INGESTION"
    assert "sentinel" in d1.target_agents
    
    # Populate observations with conflict (ru=0.45, rain=4mm)
    sup.state.observations = {"rain_72h_mm": 4.0, "piezo_ru": 0.45}
    sup.state.geo_context = {"mean_slope": 26.0}
    
    # Step 2: Conflict detected -> CONFLICT_INVESTIGATION
    d2 = sup.decide_next_action()
    assert d2.action == "CONFLICT_INVESTIGATION"
    assert "skeptic" in d2.target_agents
    assert "ru=0.42" in d2.reason or "pore pressure" in d2.reason.lower()
    
    # Reconciled
    sup.state.verification["conflict_checked"] = True
    
    # Step 3: Simulation
    d3 = sup.decide_next_action()
    assert d3.action == "PHYSICS_SIMULATION"
    sup.state.simulation = {"min_fs": 0.78, "failed_cells": 42}
    
    # Step 4: Iteration limit reached -> Safety boundary terminates with ESCALATE_HUMAN
    d4 = sup.decide_next_action()
    assert d4.action == "ESCALATE_HUMAN"
    assert "Safety Boundary Enforced" in d4.reason
    assert d4.uncertainty_level == "CRITICAL"

@pytest.mark.asyncio
async def test_evidence_reconciliation_active_loop():
    """Verify EvidenceReconciliationAgent filters false alarms and corroborates genuine creep."""
    recon = EvidenceReconciliationAgent()
    
    # Case A: False alarm (piezo spike, dry rain, zero tilt)
    obs_false = {"rain_72h_mm": 5.0, "piezo_ru": 0.45, "inclinometer_tilt_mm_hr": 0.1}
    issues_false = recon.analyze_contradictions(obs_false, {"mean_slope": 28.0})
    assert len(issues_false) > 0
    outcome_false = await recon.execute_targeted_investigation(issues_false[0], obs_false, {"mean_slope": 28.0})
    assert outcome_false.status == "DISPROVED_FALSE_ALARM"
    assert "TRANSIENT JITTER" in outcome_false.explanation
    
    # Case B: Corroborated shear (low rain, piezo spike, tilt=3.8mm/hr + cracks)
    obs_real = {"rain_72h_mm": 18.0, "piezo_ru": 0.42, "inclinometer_tilt_mm_hr": 3.8, "crack_reports_count": 2}
    issues_real = recon.analyze_contradictions(obs_real, {"mean_slope": 34.0})
    assert len(issues_real) > 0
    outcome_real = await recon.execute_targeted_investigation(issues_real[0], obs_real, {"mean_slope": 34.0})
    assert outcome_real.status == "CORROBORATED"
    assert outcome_real.confidence_adjusted >= 0.85

def test_himalayan_lifeline_cascade_simulator():
    """Verify network graph identifies isolated populations and detour paths."""
    # Baseline: all roads open
    base = lifeline_engine.compute_cascade([])
    assert base.isolated_population == 0
    assert base.hospital_accessible is True
    assert base.consequence_priority == "LOW"
    
    # Sever NH10 KM-18
    disrupted = lifeline_engine.compute_cascade(["NH10_KM18"])
    assert len(disrupted.detour_routes) > 0
    assert any("MELLI" in d["route"] for d in disrupted.detour_routes)
    
    # Sever Tadong & Ranipool arteries -> hospital inaccessible from valley
    severe = lifeline_engine.compute_cascade(["NH10_RANIPOOL_TADONG", "SICHEY_BYPASS"])
    assert severe.hospital_accessible is False
    assert severe.consequence_priority == "CRITICAL"
    assert len(severe.actionable_recommendations) > 0

def test_agentic_eval_lab_benchmark_superiority():
    """Verify Adaptive Supervisor outperforms Conventional Rules and Single LLM in benchmark."""
    results = run_evaluation_lab()
    
    cfg_rules = results["Config A (Conventional Rules)"]
    cfg_single = results["Config B (Single LLM Agent)"]
    cfg_adaptive = results["Config D (Adaptive Supervisor)"]
    
    # Adaptive supervisor achieves higher accuracy than rules and single LLM
    assert cfg_adaptive.decision_accuracy_pct > cfg_rules.decision_accuracy_pct
    assert cfg_adaptive.decision_accuracy_pct > cfg_single.decision_accuracy_pct
    
    # Adaptive supervisor achieves 0% false alarms vs conventional rules
    assert cfg_adaptive.false_alarm_rate_pct < cfg_rules.false_alarm_rate_pct
    
    # Adaptive supervisor maintains high tool efficiency
    assert cfg_adaptive.tool_efficiency_ratio >= 0.75

@pytest.mark.asyncio
async def test_cascade_and_supervisor_trace_api():
    """Verify API endpoints for cascade analysis and supervisor routing trace."""
    await db.init()
    await seed_users()
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Operator login
        op_login = await client.post("/api/v1/auth/login", json={"email": "operator@bhuraksha.demo", "password": "Operate@RESQ26"})
        token = op_login.json()["token"]
        
        # Create incident
        inc_res = await client.post("/api/v1/incidents", json={"aoi": "gangtok", "scenario": "heavy_24h"}, headers={"Authorization": f"Bearer {token}"})
        iid = inc_res.json()["id"]
        
        # Test cascade analysis endpoint
        cascade_res = await client.post(
            f"/api/v1/incidents/{iid}/cascade-analysis",
            json={"blocked_roads": ["NH10_KM18"]},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert cascade_res.status_code == 200
        data = cascade_res.json()
        assert "detour_routes" in data
        assert data["incident_id"] == iid
        
        # Test supervisor trace endpoint
        trace_res = await client.get(f"/api/v1/incidents/{iid}/supervisor-trace", headers={"Authorization": f"Bearer {token}"})
        assert trace_res.status_code == 200
        tdata = trace_res.json()
        assert "routing_decisions" in tdata
        assert len(tdata["routing_decisions"]) >= 3
        assert "budget_enforced" in tdata
        
        # Test benchmark API endpoint
        bench_res = await client.get("/api/v1/incidents/evaluation/benchmark", headers={"Authorization": f"Bearer {token}"})
        assert bench_res.status_code == 200
        bdata = bench_res.json()
        assert "Config D (Adaptive Supervisor)" in bdata["configurations"]
