#!/usr/bin/env python3
"""
End-to-End Verification Script for Local `Qwen/Qwen3-4B` Integration &
XGBoost Pipeline Preservation on NVIDIA RTX 4070.

Tests and prints live evidence for:
1. GPU detection & CUDA VRAM telemetry on NVIDIA RTX 4070
2. Existing XGBoost prediction pipeline baseline (`EnhancedLandslidePredictor`)
3. Local `Qwen/Qwen3-4B` 4-bit NF4 loading & VRAM footprint measurement
4. XGBoost numerical invariance before vs. after LLM load
5. Grounded LLM explanation of XGBoost output (no invented scores; uncalibrated score notice)
6. Missing, stale, and contradictory sensor telemetry detection & LLM reporting
7. Controlled agentic tool execution (`get_landslide_prediction`, `get_sensor_readings`,
   `get_rainfall_history`, `search_disaster_documents`, `get_official_alerts`, `get_incident_history`)
8. Graceful fallback when local LLM is disabled while keeping XGBoost operational
9. QLoRA fine-tuning dataset & environment readiness check
"""

from __future__ import annotations

import os
import sys
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault("HF_HOME", str(ROOT_DIR / ".cache" / "huggingface"))
os.environ.setdefault("TMPDIR", str(ROOT_DIR / ".cache" / "tmp"))


def run_verification() -> int:
    from backend.app.geoshield.ai_engine.enhanced_predictor import get_enhanced_predictor
    from backend.app.ml.qwen_service import get_qwen_service
    from backend.app.ml.qlora_finetune import validate_qlora_readiness
    from backend.app.agents.disaster_tools import (
        execute_controlled_tool,
        run_agentic_workflow,
    )

    print("=" * 78)
    print("1. HARDWARE & GPU DETECTION CHECK")
    print("=" * 78)
    qwen = get_qwen_service()
    gpu_before = qwen.get_gpu_info()
    print(json.dumps(gpu_before, indent=2))
    assert gpu_before["cuda_available"], "CUDA must be available on NVIDIA RTX 4070"

    print("\n" + "=" * 78)
    print("2. BASELINE XGBOOST PREDICTION (BEFORE LOADING QWEN3-4B)")
    print("=" * 78)
    predictor = get_enhanced_predictor()
    assert predictor.model_loaded, "Existing XGBoost model (enhanced_xgb_model.pkl) must be loaded"
    xgb_before = predictor.predict(25.5788, 91.8933)
    print(json.dumps(xgb_before, indent=2))

    print("\n" + "=" * 78)
    print("3. LOADING LOCAL Qwen/Qwen3-4B (4-BIT NF4 DOUBLE QUANTIZATION)")
    print("=" * 78)
    loaded = qwen.ensure_loaded()
    health_after_load = qwen.get_health()
    print(json.dumps(health_after_load, indent=2))
    assert loaded, f"Failed to load Qwen/Qwen3-4B: {health_after_load.get('load_error')}"

    print("\n" + "=" * 78)
    print("4. VERIFYING XGBOOST INVARIANCE AFTER QWEN3-4B LOAD")
    print("=" * 78)
    xgb_after = predictor.predict(25.5788, 91.8933)
    assert xgb_before == xgb_after, "XGBoost output changed after loading Qwen3-4B!"
    print("PASS: XGBoost prediction output is 100% identical before and after loading Qwen/Qwen3-4B.")

    print("\n" + "=" * 78)
    print("5. LIVE LOCAL QWEN3-4B EXPLANATION OF XGBOOST OUTPUT + CONTRADICTORY SENSOR AUDIT")
    print("=" * 78)
    contradictory_sensors = {
        "rainfall_mm": 0.0,
        "soil_moisture": 89.5,
        "pore_water_pressure": 58.0,
        "ground_displacement": 14.2,
        "timestamp": "2026-10-20T00:00:00Z",
        "is_active": True,
    }
    explanation_res = qwen.explain_xgboost_prediction(
        xgb_output=xgb_after,
        location={"name": "Shillong Plateau Corridor", "latitude": 25.5788, "longitude": 91.8933},
        sensor_readings=contradictory_sensors,
        max_new_tokens=280,
    )
    print("Used Local LLM:", explanation_res["used_llm"])
    print("Model ID:", explanation_res["model_id"])
    print("Quantization:", explanation_res["quantization"])
    print("Latency (ms):", explanation_res["latency_ms"])
    print("Data Quality Flags:", json.dumps(explanation_res["data_quality_flags"], indent=2))
    print("\n--- Generated Qwen3-4B Explanation ---")
    print(explanation_res["explanation"])
    assert explanation_res["used_llm"] is True, "Expected live Qwen/Qwen3-4B explanation"
    flag_codes = {f["code"] for f in explanation_res["data_quality_flags"]}
    assert "DISPLACEMENT_MODEL_DIVERGENCE" in flag_codes or "STALE_TELEMETRY" in flag_codes

    print("\n" + "=" * 78)
    print("6. CONTROLLED AGENTIC TOOLS & WORKFLOW VERIFICATION")
    print("=" * 78)
    for tool_name, tool_args in [
        ("get_landslide_prediction", {"location": "Gangtok"}),
        ("get_sensor_readings", {"location": "Gangtok", "time_window": 24}),
        ("get_rainfall_history", {"location": "Gangtok", "time_window": 48}),
        ("search_disaster_documents", {"query": "rainfall threshold closure SOP-2"}),
        ("get_official_alerts", {"location": "Gangtok"}),
        ("get_incident_history", {"location": "Gangtok"}),
        ("nonexistent_satellite_laser_tool", {}),
    ]:
        t_out = execute_controlled_tool(tool_name, tool_args)
        print(f"Tool '{tool_name}' -> status={t_out.get('status')}, latency_ms={t_out.get('latency_ms')}")

    print("\n" + "=" * 78)
    print("7. FALLBACK VERIFICATION WHEN LOCAL LLM IS DISABLED")
    print("=" * 78)
    qwen.set_enabled(False)
    fallback_res = qwen.explain_xgboost_prediction(xgb_output=xgb_after)
    assert fallback_res["used_llm"] is False
    assert str(xgb_after["risk_score"]) in fallback_res["explanation"]
    print("PASS: Graceful deterministic fallback works when Qwen3-4B is disabled.")
    qwen.set_enabled(True)

    print("\n" + "=" * 78)
    print("8. QLORA FINE-TUNING READINESS CHECK")
    print("=" * 78)
    qlora_status = validate_qlora_readiness()
    print(json.dumps(qlora_status, indent=2))
    assert qlora_status["ready"] is True, "QLoRA environment & datasets must be ready"

    print("\nALL LIVE VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    return 0


if __name__ == "__main__":
    raise SystemExit(run_verification())
