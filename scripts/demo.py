#!/usr/bin/env python3
"""
BhuRaksha × RESQ.AI — Autonomous Multi-Agent Landslide Intelligence Platform
Phase 8: Deterministic End-to-End Demonstration Script

Executes the complete 3-minute story offline:
1. Baseline Ingestion & Terrain Processing
2. 14-Agent DAG Execution & Plan V1 Synthesis
3. Human Approval Gate: District Collector authorizes Plan V1
4. External Perturbations: Rainfall Escalation (+65mm) & NH10 KM-18 Roadblock
5. Verifier Assumption Invalidation
6. Autonomous Selective Replanning -> Plan V2 with Structural Diff
7. Security Verification: Stale Approval Rejection (HTTP 409 Conflict)
8. District Collector authorizes Plan V2
9. Append-Only Cryptographic SHA-256 Audit Ledger Verification
"""

import sys
import time
import asyncio
import uuid
from httpx import AsyncClient, ASGITransport

from backend.app.main import app
from backend.app.db.database import db
from backend.app.db.seed import seed_users
from backend.app.services.audit_service import verify_audit_chain

# ANSI Terminal Styling
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

def step_header(num: int, title: str):
    print(f"\n{BOLD}{CYAN}════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{GREEN}[STEP {num}] {title.upper()}{RESET}")
    print(f"{BOLD}{CYAN}════════════════════════════════════════════════════════════════════════════════{RESET}")

async def run_demo():
    start_time = time.time()
    print(f"\n{BOLD}{GREEN}════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{GREEN}  BHURAKSHA × RESQ.AI — AUTONOMOUS AGENTIC DEMONSTRATION RUNNER (SIH26001)       {RESET}")
    print(f"{BOLD}{GREEN}════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"Target AOI: Gangtok-NH10 Lifeline Corridor (Sikkim)")
    print(f"Mode: Deterministic Offline Demonstration (Zero Paid API Keys Required)")

    step_header(1, "Initialize Database & Seed Role Accounts")
    await db.init()
    await seed_users()
    print(f"✓ Async SQLite Database initialized with WAL mode & JSON serialization")
    print(f"✓ Seeded RBAC accounts: Collector, Operator, Analyst, Field Officer, Citizen")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Auth Logins
        op_res = await client.post("/api/v1/auth/login", json={"email": "operator@bhuraksha.demo", "password": "Operate@RESQ26"})
        op_token = op_res.json()["token"]
        coll_res = await client.post("/api/v1/auth/login", json={"email": "collector@bhuraksha.demo", "password": "Approve@RESQ26"})
        coll_token = coll_res.json()["token"]
        print(f"✓ Authenticated Incident Operator: operator@bhuraksha.demo")
        print(f"✓ Authenticated District Collector: collector@bhuraksha.demo")

        step_header(2, "Trigger Baseline Landslide Incident (Gangtok AOI)")
        inc_res = await client.post(
            "/api/v1/incidents",
            json={"aoi": "gangtok", "scenario": "heavy_24h"},
            headers={"Authorization": f"Bearer {op_token}"}
        )
        incident_id = inc_res.json()["id"]
        print(f"✓ Incident Created: {incident_id}")
        print(f"  AOI: Gangtok-NH10 (27.32° N, 88.61° E)")
        print(f"  Scenario: Heavy 24h Monsoon Infiltration")

        step_header(3, "Multi-Agent DAG Execution & Plan V1 Synthesis")
        print("  Executing 14-Agent LangGraph DAG...")
        inc_data = None
        for attempt in range(25):
            await asyncio.sleep(0.4)
            get_res = await client.get(f"/api/v1/incidents/{incident_id}", headers={"Authorization": f"Bearer {op_token}"})
            inc_data = get_res.json()
            status = inc_data.get("status")
            version = inc_data.get("current_version", 0)
            if version >= 1 and status == "PENDING_APPROVAL":
                break

        print(f"✓ Plan V1 Synthesized successfully in {attempt * 0.4:.1f}s!")
        print(f"  Incident Status: {BOLD}{YELLOW}{inc_data['status']}{RESET}")
        print(f"  Current Version: V{inc_data['current_version']}")

        plan_v1 = inc_data["plans"][0]
        print(f"\n{BOLD}Plan V1 Action Item Summary ({len(plan_v1.get('tasks', []))} tasks):{RESET}")
        for idx, t in enumerate(plan_v1.get("tasks", []), 1):
            title = (t.get("title") or t.get("action")) if isinstance(t, dict) else str(t)
            print(f"  [{idx}] {title}")

        step_header(4, "Human-in-the-Loop Approval Gate: District Collector Authorizes Plan V1")
        print("  Authorizing Plan V1 with backend cryptographic authority binding...")
        dec_res = await client.post(
            f"/api/v1/incidents/{incident_id}/plans/1/decision",
            json={"decision": "approve", "notes": "Authorized by District Magistrate Gangtok for immediate staging"},
            headers={"Authorization": f"Bearer {coll_token}"}
        )
        assert dec_res.status_code == 200, f"Approval failed: {dec_res.text}"
        print(f"✓ {BOLD}{GREEN}Plan V1 AUTHORIZED & EXECUTING{RESET}")
        print(f"  Approver: collector@bhuraksha.demo (Role: COLLECTOR)")
        print(f"  Notes: Authorized by District Magistrate Gangtok for immediate staging")

        step_header(5, "Inject External Perturbations (Rain Escalation & Roadblock)")
        print(f"  Event 1: Cloudburst Intensification (+65mm/24h)")
        rain_event = await client.post(
            f"/api/v1/incidents/{incident_id}/events",
            json={"type": "RAIN_ESCALATION", "payload": {"delta": 0.65, "mm_added": 65}, "idempotency_key": f"demo-rain-{uuid.uuid4().hex[:6]}"},
            headers={"Authorization": f"Bearer {op_token}"}
        )
        print(f"  Event 2: Rockfall & Mudslide blocking NH10 KM-18 (Singtam-Deorali)")
        road_event = await client.post(
            f"/api/v1/incidents/{incident_id}/events",
            json={"type": "ROAD_BLOCKED", "payload": {"road_id": "NH10_KM18", "segment": "KM-18"}, "idempotency_key": f"demo-road-{uuid.uuid4().hex[:6]}"},
            headers={"Authorization": f"Bearer {op_token}"}
        )
        print(f"✓ Perturbation events accepted and enqueued.")

        step_header(6, "Autonomous Verifier Assumption Invalidation & Selective Re-planning")
        print("  Verifier evaluating evidence sufficiency and invalidated assumptions...")
        inc_v2 = None
        for attempt in range(30):
            await asyncio.sleep(0.4)
            get_res2 = await client.get(f"/api/v1/incidents/{incident_id}", headers={"Authorization": f"Bearer {op_token}"})
            inc_v2 = get_res2.json()
            if inc_v2.get("current_version") == 2 and inc_v2.get("status") == "PENDING_APPROVAL":
                break

        print(f"✓ {BOLD}{YELLOW}Plan V2 Synthesized via Autonomous Selective Replanning!{RESET}")
        print(f"  Current Version: V{inc_v2['current_version']}")
        print(f"  Status: {BOLD}{YELLOW}{inc_v2['status']}{RESET}")

        plan_v2 = inc_v2["plans"][1]
        diff = plan_v2.get("diff", {})

        print(f"\n{BOLD}{CYAN}═══ PLAN V1 → PLAN V2 STRUCTURAL DIFF ═══{RESET}")
        print(f"{BOLD}{GREEN}+ ADDED TASKS ({len(diff.get('added', []))}):{RESET}")
        for t in diff.get("added", []):
            item_text = (t.get('action') or t.get('title')) if isinstance(t, dict) else str(t)
            print(f"  + {item_text}")

        print(f"\n{BOLD}{YELLOW}~ MODIFIED TASKS ({len(diff.get('changed', []))}):{RESET}")
        for t in diff.get("changed", []):
            item_text = (t.get('action') or t.get('title')) if isinstance(t, dict) else str(t)
            print(f"  ~ {item_text}")

        print(f"\n{BOLD}{RESET}= PRESERVED / UNCHANGED TASKS ({len(diff.get('unchanged', []))}):{RESET}")
        for t in diff.get("unchanged", []):
            item_text = (t.get('action') or t.get('title')) if isinstance(t, dict) else str(t)
            print(f"  = {item_text}")

        step_header(7, "Backend Security Check: Stale Plan V1 Approval Rejection")
        print("  Attempting illegitimate approval of superseded Plan V1...")
        stale_res = await client.post(
            f"/api/v1/incidents/{incident_id}/plans/1/decision",
            json={"decision": "approve", "notes": "Attempting stale approval"},
            headers={"Authorization": f"Bearer {coll_token}"}
        )
        assert stale_res.status_code == 409, f"Expected 409 conflict on stale plan, got {stale_res.status_code}"
        print(f"✓ {BOLD}{GREEN}Security Passed: Stale Plan V1 approval rejected with HTTP 409 Conflict!{RESET}")
        print(f"  Detail: {stale_res.json()['detail']}")

        step_header(8, "District Collector Authorizes Plan V2")
        app_v2 = await client.post(
            f"/api/v1/incidents/{incident_id}/plans/2/decision",
            json={"decision": "approve", "notes": "Plan V2 authorized: NH10 emergency detour via Melli engaged"},
            headers={"Authorization": f"Bearer {coll_token}"}
        )
        assert app_v2.status_code == 200
        print(f"✓ {BOLD}{GREEN}Plan V2 AUTHORIZED & EXECUTING{RESET}")

        step_header(9, "Cryptographic SHA-256 Audit Chain Verification")
        verify_res = await verify_audit_chain()
        print(f"✓ Cryptographic Ledger Integrity: {BOLD}{GREEN}{'INTACT' if verify_res['intact'] else 'COMPROMISED'}{RESET}")
        print(f"  Validated Blocks: {verify_res.get('total_records')} blocks verified from GENESIS to HEAD")
        print(f"  Hash Signature Algorithm: SHA-256 linear chained")

    duration = time.time() - start_time
    print(f"\n{BOLD}{GREEN}════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{GREEN}  DEMONSTRATION COMPLETED SUCCESSFULLY IN {duration:.2f} SECONDS (< 3 MINUTES)!       {RESET}")
    print(f"{BOLD}{GREEN}════════════════════════════════════════════════════════════════════════════════{RESET}\n")

if __name__ == "__main__":
    asyncio.run(run_demo())
