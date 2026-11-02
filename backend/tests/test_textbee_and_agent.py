"""
Test suite for TextBee.dev SMS Gateway, Officer Profile +91 Phone Normalization,
Immediate Field Report Officer Notifications, and the Autonomous AGENT Dashboard.
"""

from __future__ import annotations

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.main import app
from backend.app.services.textbee_service import (
    normalize_indian_phone,
    extract_10_digit_phone,
    get_textbee_config,
    save_textbee_config,
)


def test_indian_phone_normalization():
    """Verify 10-digit Indian mobile number normalization and +91 country code prefixing."""
    # 10 digits without prefix -> prefixes +91
    assert normalize_indian_phone("9876543210") == "+919876543210"
    # With +91 already -> kept as +91XXXXXXXXXX
    assert normalize_indian_phone("+919876543210") == "+919876543210"
    # With leading 0 -> normalized to +91XXXXXXXXXX
    assert normalize_indian_phone("09876543210") == "+919876543210"
    # With 91 prefix without plus -> normalized to +91XXXXXXXXXX
    assert normalize_indian_phone("919876543210") == "+919876543210"
    # With whitespace and hyphens
    assert normalize_indian_phone("+91 98765-43210") == "+919876543210"
    # Extract 10-digit
    assert extract_10_digit_phone("+919876543210") == "9876543210"
    assert extract_10_digit_phone("9876543210") == "9876543210"

    # Invalid cases
    with pytest.raises(ValueError):
        normalize_indian_phone("12345")  # too short
    with pytest.raises(ValueError):
        normalize_indian_phone("9876543210123")  # too long
    with pytest.raises(ValueError):
        normalize_indian_phone("abcdefghij")  # non-numeric


def test_textbee_sms_status_and_config_endpoints():
    """Verify TextBee status and configuration endpoints."""
    client = TestClient(app)
    # Status endpoint
    resp = client.get("/api/v1/sms/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["gateway"] == "textbee.dev"
    assert data["country_code"] == "+91"
    assert "send_sms_endpoint" in data
    assert "send_bulk_sms_endpoint" in data

    # Update config endpoint with a 10-digit officer phone
    cfg_resp = client.post(
        "/api/v1/sms/config",
        json={
            "textbee_api_key": "test_textbee_key_resq_1234",
            "officer_phone": "9876543210",
        },
    )
    assert cfg_resp.status_code == 200
    cfg_data = cfg_resp.json()
    assert cfg_data["configured"] is True
    assert "+919876543210" in cfg_data["officer_recipients"]


def test_profile_phone_update_endpoint():
    """Verify Officer Profile GET and POST endpoints with +91 10-digit number."""
    client = TestClient(app)
    # Profile update
    up_resp = client.post(
        "/api/v1/auth/profile",
        json={
            "name": "District Collector (Test Officer)",
            "phone": "9812345678",
            "sms_enabled": True,
        },
    )
    assert up_resp.status_code == 200
    prof = up_resp.json()
    assert prof["phone"] == "+919812345678"
    assert prof["phone_10digit"] == "9812345678"
    assert prof["country_code"] == "+91"

    # Profile read
    get_resp = client.get("/api/v1/auth/profile")
    assert get_resp.status_code == 200
    pdata = get_resp.json()
    assert pdata["phone"] == "+919812345678"


def test_field_report_triggers_officer_sms_notification():
    """Verify that uploading a field report triggers immediate officer notification and TextBee SMS dispatch record."""
    client = TestClient(app)
    import time
    cid = f"test-rep-{int(time.time() * 1000)}"

    form_data = {
        "title": "Tadong Slope Tension Crack Test",
        "lat": "27.3135",
        "lon": "88.6015",
        "category": "cracks",
        "severity": "CRITICAL",
        "notify_officer": "true",
        "officer_phone": "9876501234",
        "description": "5cm lateral displacement observed across retaining wall.",
        "client_id": cid,
    }
    resp = client.post("/api/v1/reports", data=form_data)
    assert resp.status_code == 200
    data = resp.json()
    assert data["officer_notified"] is True
    assert data["officer_dispatch_id"] is not None
    assert data["triage"]["severity"] == "CRITICAL"
    assert "sms_dispatch" in data["triage"]
    assert data["triage"]["sms_dispatch"]["sms_id"].startswith("SMS-")


def test_agent_dashboard_and_autonomous_plan_endpoints():
    """Verify /api/v1/llm/officer-assistant/dashboard and plan synthesis endpoints."""
    client = TestClient(app)
    # Dashboard state
    dash_resp = client.get("/api/v1/llm/officer-assistant/dashboard")
    assert dash_resp.status_code == 200
    dash = dash_resp.json()
    assert "ongoing_processes" in dash
    assert len(dash["ongoing_processes"]) >= 5
    assert "autonomous_control" in dash
    assert dash["autonomous_control"]["enabled"] is True
    assert "corridor_telemetry" in dash
    assert "high_impact_approvals" in dash

    # Create autonomous plan
    plan_resp = client.post(
        "/api/v1/llm/officer-assistant/create-plan",
        json={
            "aoi": "gangtok",
            "scenario": "heavy_24h",
            "custom_directive": "Test emergency staging",
        },
    )
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()
    assert plan_data["ok"] is True
    assert "plan_id" in plan_data
    assert "high_impact_gate" in plan_data

    # Approve high impact task
    task_id = plan_data["high_impact_gate"]["id"]
    appr_resp = client.post(
        "/api/v1/llm/officer-assistant/approve-task",
        json={
            "task_id": task_id,
            "decision": "APPROVED",
            "notes": "Approved by Human Duty Officer via test suite",
        },
    )
    assert appr_resp.status_code == 200
    appr_data = appr_resp.json()
    assert appr_data["status"] == "APPROVED"


def test_officer_assistant_llm_query_endpoint():
    """Verify that arbitrary officer queries execute via officer-assistant with deterministic XGBoost & citations."""
    client = TestClient(app)
    resp = client.post(
        "/api/v1/llm/officer-assistant",
        json={"question": "Assess current landslide hazard for Gangtok NH10 corridor"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "answer" in data
    assert len(data["answer"]) > 0
    assert "citations" in data
    assert "tools_executed" in data
    assert "get_landslide_prediction" in data["tools_executed"]


def test_officer_assistant_conversational_queries():
    """Verify that conversational queries like 'how are you?' return natural polite answers instead of irrelevant Gangtok hazard reports."""
    client = TestClient(app)

    # Test "how are you?"
    resp1 = client.post(
        "/api/v1/llm/officer-assistant",
        json={"question": "how are you?"},
    )
    assert resp1.status_code == 200
    d1 = resp1.json()
    assert d1["ok"] is True
    assert "operating" in d1["answer"].lower() or "readiness" in d1["answer"].lower()
    # Must NOT dump unrequested Gangtok hazard debris-flow briefing
    assert "Main Officer Assistant Briefing — Gangtok" not in d1["answer"]
    assert d1["tools_executed"] == []

    # Test "who are you?"
    resp2 = client.post(
        "/api/v1/llm/officer-assistant",
        json={"question": "who are you?"},
    )
    assert resp2.status_code == 200
    d2 = resp2.json()
    assert d2["ok"] is True
    assert "Main Autonomous Disaster Assistant" in d2["answer"] or "Chief-of-Staff" in d2["answer"]

    # Test "hello"
    resp3 = client.post(
        "/api/v1/llm/officer-assistant",
        json={"question": "hello"},
    )
    assert resp3.status_code == 200
    d3 = resp3.json()
    assert d3["ok"] is True
    assert "Namaste Officer" in d3["answer"] or "service" in d3["answer"].lower()

    # Test conceptual question: "What is a piezometer?"
    resp4 = client.post(
        "/api/v1/llm/officer-assistant",
        json={"question": "What is a piezometer and how is it used in slope stability?"},
    )
    assert resp4.status_code == 200
    d4 = resp4.json()
    assert d4["ok"] is True
    assert "piezometer" in d4["answer"].lower()
    assert "pressure" in d4["answer"].lower()
    # Must NOT run location tools or dump Gangtok briefing
    assert d4["tools_executed"] == []
    assert "Main Officer Assistant Briefing — Gangtok" not in d4["answer"]


