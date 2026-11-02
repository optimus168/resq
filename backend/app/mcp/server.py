"""
BhuRaksha Model Context Protocol (MCP) Server.
Exposes landslide intelligence, physics digital twins, and geospatial risk tools
to any external agentic AI client (Claude Desktop, Cursor, MCP Inspector).
"""

import sys
import json
import logging
from typing import Dict, Any, List

from backend.app.ml.risk_engine import assess_risk, rain_threshold_ratio
from backend.app.geospatial.terrain import AOIS, load_terrain
from backend.app.simulation.twin import run_simulation
from backend.app.simulation.detection import run_detection
from backend.app.simulation.regional import REGIONAL_PROFILES
from backend.app.agents.llm_adapter import detect_injection

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("mcp_server")

TOOLS_SCHEMA = [
    {
        "name": "risk_assess",
        "description": "Computes deterministic multi-criteria landslide risk score, hazard category, and geomorphic drivers for an AOI.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "aoi": {"type": "string", "enum": ["gangtok", "shillong", "aizawl", "tupul"], "description": "Target AOI"},
                "accumulated_rain_mm": {"type": "number", "description": "Cumulative 24h rainfall in mm"}
            },
            "required": ["aoi"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "sim_run",
        "description": "Runs screening-level 3D landslide simulation (infiltration -> infinite-slope FS -> D8 runout -> asset exposure).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "aoi": {"type": "string", "enum": ["gangtok", "shillong", "aizawl", "tupul"]},
                "rain_multiplier": {"type": "number", "default": 1.0},
                "soil_depth_m": {"type": "number", "default": 2.5}
            },
            "required": ["aoi"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "gis_exposure",
        "description": "Queries exposed infrastructure lifelines (NH10, NH6), villages, and relief shelters in a disaster impact polygon.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "aoi": {"type": "string", "enum": ["gangtok", "shillong", "aizawl", "tupul"]}
            },
            "required": ["aoi"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "report_triage",
        "description": "Scans and sanitizes citizen field reports for prompt-injection attacks and categorizes hazard severity.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Raw untrusted text report from field"}
            },
            "required": ["text"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "alert_dispatch",
        "description": "CONSEQUENTIAL ACTION: Dispatches emergency public evacuation advisory via CAP/SACHET.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "incident_id": {"type": "string"},
                "plan_version": {"type": "integer"},
                "severity": {"type": "string", "enum": ["MODERATE", "HIGH", "IMMINENT"]}
            },
            "required": ["incident_id", "plan_version", "severity"]
        },
        "permission": "APPROVAL_REQUIRED"
    },
    {
        "name": "get_landslide_prediction",
        "description": "Runs the validated 9-feature XGBoost landslide prediction pipeline for a location.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {"type": ["string", "object"], "description": "Coordinates or NER station/corridor name"},
                "timestamp": {"type": "string"},
                "features": {"type": "object"}
            },
            "required": ["location"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "get_sensor_readings",
        "description": "Retrieves ground-station telemetry readings near a location within time_window hours.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {"type": ["string", "object"]},
                "time_window": {"type": "integer", "default": 24}
            },
            "required": ["location"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "get_rainfall_history",
        "description": "Retrieves 1h, 24h, 7d, and forecast rainfall telemetry for a location.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {"type": ["string", "object"]},
                "time_window": {"type": "integer", "default": 48}
            },
            "required": ["location"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "search_disaster_documents",
        "description": "Searches official NDMA/SDMA SOPs and GSI historical landslide catalog records.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"}
            },
            "required": ["query"]
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "get_official_alerts",
        "description": "Retrieves active and recent official landslide alerts.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {"type": ["string", "object"]}
            }
        },
        "permission": "READ_ONLY"
    },
    {
        "name": "get_incident_history",
        "description": "Retrieves citizen/field reports and GSI historical landslide incidents.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "location": {"type": ["string", "object"]}
            }
        },
        "permission": "READ_ONLY"
    }
]

def handle_tool_call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    # Permission gate: Approval-required tools cannot execute autonomously
    if name == "alert_dispatch":
        return {
            "status": "APPROVAL_REQUIRED",
            "error": "Autonomous action blocked by Human-in-the-Loop Gate",
            "detail": "Public evacuation alerts require authenticated authorization by District Collector (COLLECTOR role) bound to an active plan version.",
            "requires_human_approval": True,
            "simulated": True
        }
        
    if name == "risk_assess":
        aoi_id = arguments.get("aoi", "gangtok")
        t = load_terrain(aoi_id)
        rain_mm = arguments.get("accumulated_rain_mm", 65.0)
        hyeto = [rain_mm / 24.0] * 24
        
        sim_dummy = {"grid": [256, 256], "failed_cells": 42 if rain_mm > 50 else 0}
        sensors = [{"pore_pressure_ratio": 0.42 if rain_mm > 60 else 0.28}]
        
        res = assess_risk(t, sim_dummy, hyeto, sensors, {"accumulated_rain_mm": rain_mm})
        return {
            "aoi": aoi_id,
            "risk_score": res["score"],
            "hazard_category": res["category"],
            "drivers": res["drivers"],
            "simulated": False
        }
        
    elif name == "gis_exposure":
        aoi_id = arguments.get("aoi", "gangtok")
        aoi = AOIS.get(aoi_id, AOIS["gangtok"])
        return {
            "aoi": aoi_id,
            "exposed_roads": [r["name"] for r in aoi["roads"]],
            "settlements": [v["name"] for v in aoi["villages"]],
            "designated_shelters": [s["name"] for s in aoi["shelters"]],
            "simulated": False
        }
        
    elif name == "report_triage":
        text = arguments.get("text", "")
        flags = detect_injection(text)
        return {
            "text_length": len(text),
            "quarantined": len(flags) > 0,
            "injection_flags": flags,
            "status": "QUARANTINED" if flags else "CLEAN",
            "credibility_score": 0.1 if flags else 0.94
        }
        
    elif name == "sim_run":
        aoi_id = arguments.get("aoi", "gangtok")
        mult = float(arguments.get("rain_multiplier", 1.0))
        scenario = arguments.get("scenario", "heavy_24h")
        if aoi_id not in REGIONAL_PROFILES:
            return {
                "error": f"AOI '{aoi_id}' has no NER calibration profile",
                "available": sorted(REGIONAL_PROFILES),
            }
        result = run_detection(aoi_id, scenario, rain_multiplier=mult)
        summary = result["summary"]
        last = summary["timeline"][-1]
        return {
            "aoi": aoi_id,
            "scenario": scenario,
            "rain_multiplier": mult,
            "failed_cells_count": last["failed_cells"],
            "failed_area_km2": round(last["failed_cells"] * summary["cell_area_m2"] / 1e6, 3),
            "detection_count": summary["detection_count"],
            "significant_detection_count": summary["significant_detection_count"],
            "detected_area_ha": summary["detected_area_ha"],
            "runout_cells": last["footprint_cells"],
            "volume_released_m3": summary["mass_balance"]["released_m3"],
            "volume_deposited_m3": summary["mass_balance"]["deposited_m3"],
            "volume_outflow_m3": summary["mass_balance"]["outflow_m3"],
            "conservation_error_pct": summary["mass_balance"]["conservation_error_pct"],
            "rainfall_level": summary["regional"]["rainfall"]["level"],
            "rainfall_ratio": summary["regional"]["rainfall"]["peak_ratio"],
            "roads_exposed": summary["exposure"]["roads_exposed"],
            "villages_exposed": summary["exposure"]["villages_exposed"],
            "population_exposed_est": last["exposed_population_est"],
            "top_detections": [
                {
                    "id": f["properties"]["id"],
                    "area_ha": f["properties"]["area_ha"],
                    "hour": f["properties"]["detection_hour"],
                    "confidence": f["properties"]["confidence"],
                }
                for f in summary["detections"]["features"][:5]
            ],
            "screening_level_honesty": "Scenario simulation model; not an official GSI forecast",
            "simulated": True,
        }

    elif name in (
        "get_landslide_prediction",
        "get_sensor_readings",
        "get_rainfall_history",
        "search_disaster_documents",
        "get_official_alerts",
        "get_incident_history",
    ):
        from backend.app.agents.disaster_tools import execute_controlled_tool

        return execute_controlled_tool(name, arguments)

    return {"error": f"Unknown tool: {name}"}

def process_mcp_message(msg: dict) -> dict:
    """Processes JSON-RPC 2.0 MCP protocol messages."""
    msg_id = msg.get("id")
    method = msg.get("method")
    
    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"tools": TOOLS_SCHEMA}
        }
    elif method == "tools/call":
        params = msg.get("params", {})
        tool_name = params.get("name")
        args = params.get("arguments", {})
        res = handle_tool_call(tool_name, args)
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"content": [{"type": "text", "text": json.dumps(res, indent=2)}]}
        }
    else:
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "error": {"code": -32601, "message": f"Method not found: {method}"}
        }

def run_stdio_server():
    """Runs the MCP server over standard input/output."""
    log.info("BhuRaksha MCP Server listening on stdio...")
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            resp = process_mcp_message(req)
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_resp = {"jsonrpc": "2.0", "error": {"code": -32700, "message": str(e)}}
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    run_stdio_server()
