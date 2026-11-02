"""
Automated Pytest Suite for Local `Qwen/Qwen3-4B` Integration,
XGBoost Pipeline Preservation, Sensor Anomaly Auditing, Controlled Agentic Tools,
FastAPI Routes, and QLoRA Fine-Tuning Readiness.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.geoshield.ai_engine.enhanced_predictor import get_enhanced_predictor
from backend.app.ml.xgboost_model import model_instance as susceptibility_xgb
from backend.app.ml.qwen_service import (
    audit_sensor_and_prediction_context,
    get_qwen_service,
)
from backend.app.ml.qlora_finetune import validate_qlora_readiness
from backend.app.agents.disaster_tools import (
    CONTROLLED_TOOLS,
    execute_controlled_tool,
    run_agentic_workflow,
)
from backend.app.mcp.server import handle_tool_call


def test_1_xgboost_pipeline_preserved_and_deterministic():
    """Verify existing XGBoost models, feature ordering, and outputs remain 100% intact."""
    predictor = get_enhanced_predictor()
    assert predictor.model_loaded is True
    assert predictor.feature_names == [
        "latitude",
        "longitude",
        "slope",
        "aspect",
        "elevation",
        "rainfall_7day",
        "ndvi",
        "soil_moisture",
        "distance_to_road",
    ]

    res1 = predictor.predict(25.5788, 91.8933)
    res2 = predictor.predict(25.5788, 91.8933)
    assert res1 == res2
    assert res1["source"] in ("xgboost", "xgboost_model")
    assert 0.0 <= res1["risk_score"] <= 100.0
    assert res1["risk_level"] in ("low", "moderate", "high", "critical")
    assert "feature_importance" in res1
    assert "terrain_data" in res1

    # Also verify secondary spatial-CV XGBoost model remains intact
    shap_res = susceptibility_xgb.explain_sample_shap({"slope_deg": 35.0, "twi": 9.2, "soil_clay_pct": 28.0})
    assert "predicted_susceptibility" in shap_res
    assert "shap_values" in shap_res


def test_2_gpu_and_qwen_4bit_nf4_model_loading():
    """Verify NVIDIA RTX 4070 CUDA detection and 4-bit NF4 local Qwen/Qwen3-4B loading."""
    qwen = get_qwen_service()
    qwen.set_enabled(True)
    gpu = qwen.get_gpu_info()
    assert gpu["cuda_available"] is True
    assert "4070" in (gpu.get("device_name") or "")

    assert qwen.ensure_loaded() is True
    health = qwen.get_health()
    assert health["loaded"] is True
    assert health["model_id"] == "Qwen/Qwen3-4B"
    assert "4bit_nf4" in health["quantization"]
    assert health["external_paid_api_used"] is False
    assert health["xgboost_pipeline_preserved"] is True


def test_3_local_qwen_generation_and_xgboost_explanation():
    """Verify local Qwen/Qwen3-4B explains XGBoost predictions without altering numerical scores."""
    predictor = get_enhanced_predictor()
    xgb_before = predictor.predict(27.3314, 88.6138)

    qwen = get_qwen_service()
    qwen.set_enabled(True)
    interp = qwen.explain_xgboost_prediction(
        xgb_output=xgb_before,
        location={"name": "Gangtok NH10", "latitude": 27.3314, "longitude": 88.6138},
        max_new_tokens=220,
    )

    xgb_after = predictor.predict(27.3314, 88.6138)
    assert xgb_before == xgb_after
    assert interp["used_llm"] is True
    assert interp["model_id"] == "Qwen/Qwen3-4B"
    assert len(interp["explanation"]) > 40
    assert "uncalibrated" in interp["calibration_notice"].lower()
    assert interp["safety_policy"]["deterministic_xgboost_preserved"] is True


def test_4_sensor_missing_stale_and_contradictory_audit():
    """Verify missing, stale, offline, and contradictory sensor telemetry are flagged."""
    xgb_sample = {
        "risk_score": 12.4,
        "risk_level": "low",
        "confidence": 0.124,
        "source": "xgboost",
        "terrain_data": {"slope": 28.0, "elevation": 1400.0, "rainfall_7day": 2.0, "soil_moisture": 0.35},
    }

    # Case A: Missing telemetry
    flags_missing = audit_sensor_and_prediction_context(xgb_sample, sensor_readings=None)
    assert any(f["code"] == "MISSING_LIVE_TELEMETRY" for f in flags_missing)

    # Case B: Contradictory pore pressure, contradictory soil moisture, displacement divergence, offline & stale
    contradictory = {
        "rainfall_mm": 0.0,
        "soil_moisture": 91.0,
        "pore_water_pressure": 55.0,
        "ground_displacement": 16.5,
        "is_active": False,
        "timestamp": "2025-01-01T00:00:00Z",
    }
    flags_anom = audit_sensor_and_prediction_context(xgb_sample, sensor_readings=contradictory)
    codes = {f["code"] for f in flags_anom}
    assert "CONTRADICTORY_PORE_PRESSURE" in codes
    assert "CONTRADICTORY_SOIL_MOISTURE" in codes
    assert "DISPLACEMENT_MODEL_DIVERGENCE" in codes
    assert "STATION_OFFLINE" in codes
    assert "STALE_TELEMETRY" in codes


def test_5_controlled_agentic_tools_and_mcp_integration():
    """Verify all 6 controlled tools, input validation, unavailable-tool reporting, and MCP wiring."""
    expected_tools = {
        "get_landslide_prediction",
        "get_sensor_readings",
        "get_rainfall_history",
        "search_disaster_documents",
        "get_official_alerts",
        "get_incident_history",
    }
    assert expected_tools.issubset(set(CONTROLLED_TOOLS.keys()))

    pred_tool = execute_controlled_tool("get_landslide_prediction", {"location": "Gangtok"})
    assert pred_tool["status"] == "ok"
    assert "risk_score" in pred_tool["prediction"]

    sensor_tool = execute_controlled_tool("get_sensor_readings", {"location": "Gangtok", "time_window": 24})
    assert sensor_tool["status"] in ("ok", "no_stations_available")

    rain_tool = execute_controlled_tool("get_rainfall_history", {"location": "Aizawl", "time_window": 48})
    assert rain_tool["status"] in ("ok", "no_stations_available")

    doc_tool = execute_controlled_tool("search_disaster_documents", {"query": "evacuation runout SOP-4"})
    assert doc_tool["status"] == "ok"
    assert len(doc_tool["official_sops"]) >= 1

    alert_tool = execute_controlled_tool("get_official_alerts", {"location": "Gangtok"})
    assert alert_tool["status"] == "ok"

    inc_tool = execute_controlled_tool("get_incident_history", {"location": "Gangtok"})
    assert inc_tool["status"] == "ok"

    # Unavailable tool must report limitation clearly
    unavail = execute_controlled_tool("predict_earthquake_exact_time", {})
    assert unavail["status"] == "unavailable"
    assert "not available" in unavail["error"]

    # Out-of-bounds coordinates must fail validation cleanly
    invalid_loc = execute_controlled_tool(
        "get_landslide_prediction",
        {"location": {"latitude": 85.0, "longitude": 10.0}},
    )
    assert invalid_loc["status"] == "error"

    # Verify MCP server integration
    mcp_res = handle_tool_call("get_landslide_prediction", {"location": "Shillong"})
    assert mcp_res["status"] == "ok"
    assert "risk_score" in mcp_res["prediction"]


def test_6_fallback_when_llm_disabled_and_earthquake_safety():
    """Verify disabling the LLM keeps XGBoost prediction and deterministic explanations working."""
    qwen = get_qwen_service()
    qwen.set_enabled(False)
    try:
        wf = run_agentic_workflow(
            query="Will an earthquake hit Gangtok and what is the current landslide risk?",
            location="Gangtok",
            include_llm_synthesis=True,
        )
        assert wf["used_llm"] is False
        assert "risk_score" in wf["xgboost_prediction"]
        assert wf["earthquake_disclaimer"] is not None
        assert "neither the llm" in wf["earthquake_disclaimer"].lower()
        assert "predict earthquakes" in wf["earthquake_disclaimer"].lower()
    finally:
        qwen.set_enabled(True)


def test_7_fastapi_llm_and_predict_endpoints():
    """Verify FastAPI endpoints for health, toggle, tool-call, explain-prediction, and /api/predict."""
    with TestClient(app) as client:
        # 1. Health endpoint
        r_health = client.get("/api/v1/llm/health")
        assert r_health.status_code == 200
        h_data = r_health.json()
        assert h_data["model_id"] == "Qwen/Qwen3-4B"
        assert h_data["xgboost_predictor"]["model_loaded"] is True

        # 2. Fast non-blocking /api/predict (default explain_with_llm=False)
        r_pred = client.post("/api/predict", json={"latitude": 25.5788, "longitude": 91.8933})
        assert r_pred.status_code == 200
        p_data = r_pred.json()
        assert "risk_assessment" in p_data
        assert "llm_interpretation" not in p_data

        # 3. Direct /api/ml/predict baseline
        r_ml_pred = client.post("/api/ml/predict", json={"latitude": 25.5788, "longitude": 91.8933})
        assert r_ml_pred.status_code == 200
        ml_pred_data = r_ml_pred.json()

        # 4. Toggle LLM off -> test /api/v1/llm/explain-prediction deterministic fallback -> Toggle LLM back on
        client.post("/api/v1/llm/toggle", json={"enabled": False})
        r_exp_off = client.post(
            "/api/v1/llm/explain-prediction",
            json={"latitude": 25.5788, "longitude": 91.8933},
        )
        assert r_exp_off.status_code == 200
        exp_off_data = r_exp_off.json()
        assert exp_off_data["llm_interpretation"]["used_llm"] is False
        assert exp_off_data["xgboost_prediction"]["risk_score"] == ml_pred_data["risk_score"]

        # Also verify /api/predict with explain_with_llm=True preserves exact risk_score
        r_pred_with_llm = client.post(
            "/api/predict",
            json={"latitude": 25.5788, "longitude": 91.8933, "explain_with_llm": True},
        )
        assert r_pred_with_llm.status_code == 200
        p_llm_data = r_pred_with_llm.json()
        assert p_llm_data["risk_assessment"]["risk_score"] == p_data["risk_assessment"]["risk_score"]
        assert "llm_interpretation" in p_llm_data

        client.post("/api/v1/llm/toggle", json={"enabled": True})


def test_8_qlora_finetuning_workflow_readiness():
    """Verify QLoRA fine-tuning datasets, PEFT/TRL packages, and separate adapter paths are valid."""
    status = validate_qlora_readiness()
    assert status["ready"] is True
    assert status["train_dataset"]["valid"] is True
    assert status["train_dataset"]["count"] >= 5
    assert status["val_dataset"]["valid"] is True
    assert status["val_dataset"]["count"] >= 2
    assert status["adapter_saved_separately"] is True


def test_9_officer_assistant_main_agent_and_earthquake_tool():
    """Verify the Main Officer Assistant Agent and Earthquake + Landslide tools."""
    eq_tool = execute_controlled_tool("get_earthquake_activity", {"location": "Gangtok", "radius_km": 350.0})
    assert eq_tool["status"] == "ok"
    assert "coseismic_landslide_trigger_status" in eq_tool

    with TestClient(app) as client:
        r_status = client.get("/api/v1/llm/officer-assistant/status")
        assert r_status.status_code == 200
        st = r_status.json()
        assert st["is_main_agent"] is True
        assert "landslides" in st["domains"]
        assert "earthquakes" in st["domains"]

        # Test Officer Assistant briefing endpoint
        client.post("/api/v1/llm/toggle", json={"enabled": False})
        r_brief = client.post(
            "/api/v1/llm/officer-assistant",
            json={"question": "Brief me on Gangtok landslide risk and earthquake activity"},
        )
        assert r_brief.status_code == 200
        b_data = r_brief.json()
        assert b_data["ok"] is True
        assert "get_landslide_prediction" in b_data["tools_executed"]
        assert "get_earthquake_activity" in b_data["tools_executed"]
        assert b_data["safety"]["xgboost_preserved"] is True
        assert b_data["safety"]["human_officer_gate_required"] is True
        client.post("/api/v1/llm/toggle", json={"enabled": True})


def test_10_field_report_upload_images_video_severity_and_officer_notify():
    """Verify uploading field reports with image, video, document, severity, officer notification, and officer severity editing."""
    import os
    import time

    with TestClient(app) as client:
        r_login = client.post(
            "/api/v1/auth/login",
            json={"email": "collector@bhuraksha.demo", "password": "Approve@RESQ26"},
        )
        token = r_login.json().get("access_token", "") if r_login.status_code == 200 else ""
        headers = {"Authorization": f"Bearer {token}"} if token else {}

        files = {
            "photo": ("crack_evidence.jpg", b"\xff\xd8\xff\xe0fakejpegcontent", "image/jpeg"),
            "video": ("slope_video.mp4", b"\x00\x00\x00\x18ftypmp42fakevideo", "video/mp4"),
            "report_file": ("geotech_inspection.pdf", b"%PDF-1.4 fake inspection report", "application/pdf"),
        }
        data = {
            "title": "NH10 KM-18 Retaining Wall Crack",
            "lat": "27.3135",
            "lon": "88.6015",
            "category": "cracks",
            "severity": "HIGH",
            "notify_officer": "true",
            "description": "12cm wide tension crack along road shoulder with muddy seepage.",
            "client_id": f"test-upload-{os.getpid()}-{int(time.time() * 1000)}",
        }
        r_up = client.post("/api/v1/reports", data=data, files=files, headers=headers)
        assert r_up.status_code == 200
        up = r_up.json()
        rid = up["id"]
        assert up["severity"] == "HIGH"
        assert up["officer_notified"] is True
        assert up["photo_url"] is not None
        assert up["video_url"] is not None
        assert up["report_file_url"] is not None

        # Verify Officer can edit severity directly
        r_sev = client.post(
            f"/api/v1/reports/{rid}/severity",
            params={"severity": "CRITICAL"},
            headers=headers,
        )
        assert r_sev.status_code == 200
        sev_data = r_sev.json()
        assert sev_data["old_severity"] == "HIGH"
        assert sev_data["severity"] == "CRITICAL"

        # Verify Officer Notifications list includes this report with updated CRITICAL severity
        r_ntf = client.get("/api/v1/reports/notifications", headers=headers)
        assert r_ntf.status_code == 200
        ntfs = r_ntf.json()
        matched = [n for n in ntfs if n["id"] == rid]
        assert len(matched) == 1
        assert matched[0]["severity"] == "CRITICAL"
        assert matched[0]["photo_url"] == up["photo_url"]
        assert matched[0]["video_url"] == up["video_url"]
        assert matched[0]["report_file_url"] == up["report_file_url"]

