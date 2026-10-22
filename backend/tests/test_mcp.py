import json
import pytest
from backend.app.mcp.server import process_mcp_message, handle_tool_call

def test_mcp_tools_list():
    msg = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/list",
        "params": {}
    }
    resp = process_mcp_message(msg)
    assert resp["jsonrpc"] == "2.0"
    tools = resp["result"]["tools"]
    tool_names = [t["name"] for t in tools]
    assert "risk_assess" in tool_names
    assert "sim_run" in tool_names
    assert "alert_dispatch" in tool_names

def test_mcp_tool_execution_read_only():
    msg = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {
            "name": "risk_assess",
            "arguments": {"aoi": "gangtok", "accumulated_rain_mm": 85.0}
        }
    }
    resp = process_mcp_message(msg)
    content = json.loads(resp["result"]["content"][0]["text"])
    assert "risk_score" in content
    assert "hazard_category" in content
    assert content["hazard_category"] in ["HIGH", "IMMINENT", "MODERATE"]

def test_mcp_human_approval_gate_enforcement():
    # Attempting to dispatch an alert over MCP without human approval must return APPROVAL_REQUIRED
    msg = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "alert_dispatch",
            "arguments": {"incident_id": "inc-01", "plan_version": 1, "severity": "IMMINENT"}
        }
    }
    resp = process_mcp_message(msg)
    content = json.loads(resp["result"]["content"][0]["text"])
    assert content["status"] == "APPROVAL_REQUIRED"
    assert content["requires_human_approval"] is True
    assert "District Collector" in content["detail"]
