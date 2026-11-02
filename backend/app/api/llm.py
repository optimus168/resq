"""
FastAPI Router for Local `Qwen/Qwen3-4B` LLM Service, XGBoost Explanation,
and Controlled Agentic Tool Workflows.

Architecture:
User / Sensor Data
    -> Existing data validation and feature engineering
    -> Existing XGBoost prediction pipeline (`EnhancedLandslidePredictor`)
    -> Structured prediction result
    -> Local `Qwen/Qwen3-4B` (4-bit NF4 bitsandbytes on RTX 4070)
    -> Grounded explanation, sensor audit, and NDMA SOP recommendations
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.agents.disaster_tools import (
    CONTROLLED_TOOLS,
    execute_controlled_tool,
    get_official_alerts,
    get_sensor_readings,
    resolve_location_input,
    run_agentic_workflow,
    search_disaster_documents,
)
from backend.app.geoshield.ai_engine.enhanced_predictor import get_enhanced_predictor
from backend.app.ml.qwen_service import get_qwen_service

router = APIRouter(prefix="/llm", tags=["Local Qwen3-4B & XGBoost Interpreter"])


class ExplainPredictionRequest(BaseModel):
    latitude: float = Field(..., ge=5.0, le=38.0, description="Latitude in India / NER region")
    longitude: float = Field(..., ge=68.0, le=100.0, description="Longitude in India / NER region")
    slope: Optional[float] = Field(None, ge=0.0, le=90.0)
    aspect: Optional[float] = Field(None, ge=0.0, le=360.0)
    elevation: Optional[float] = Field(None, ge=0.0, le=6000.0)
    rainfall_24hr: Optional[float] = Field(None, ge=0.0, le=1000.0)
    rainfall_7day: Optional[float] = Field(None, ge=0.0, le=2500.0)
    soil_moisture: Optional[float] = Field(
        None, ge=0.0, le=100.0, description="Soil moisture fraction (0-1) or percentage (0-100)"
    )
    ndvi: Optional[float] = Field(None, ge=-1.0, le=1.0)
    distance_to_road: Optional[float] = Field(None, ge=0.0, le=50000.0)
    sensor_readings: Optional[Dict[str, Any]] = Field(
        None, description="Optional live telemetry packet to audit against XGBoost prediction"
    )
    field_reports: Optional[List[Dict[str, Any]]] = Field(
        None, description="Optional field/citizen reports"
    )
    max_new_tokens: Optional[int] = Field(None, ge=32, le=1024)


class AgentQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    location: Optional[Union[str, Dict[str, Any]]] = None
    features: Optional[Dict[str, Any]] = None
    requested_tools: Optional[List[str]] = None
    include_llm_synthesis: bool = True


class ControlledToolRequest(BaseModel):
    tool_name: str = Field(..., description="Registered controlled tool name")
    arguments: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: float = Field(10.0, ge=1.0, le=60.0)


class ToggleLLMRequest(BaseModel):
    enabled: bool


@router.get("/health")
async def llm_health_check() -> Dict[str, Any]:
    """
    Runtime health check for local `Qwen/Qwen3-4B`, GPU VRAM metrics,
    quantization config, and XGBoost pipeline status.
    """
    qwen = get_qwen_service()
    xgb = get_enhanced_predictor()
    health = qwen.get_health()
    health["xgboost_predictor"] = {
        "model_loaded": xgb.model_loaded,
        "model_type": "xgboost" if xgb.model_loaded else "rule_based_fallback",
        "feature_cols": xgb.feature_names,
    }
    health["controlled_tools"] = list(CONTROLLED_TOOLS.keys())
    return health


@router.post("/toggle")
async def toggle_local_llm(req: ToggleLLMRequest) -> Dict[str, Any]:
    """
    Enable or disable local `Qwen/Qwen3-4B` at runtime while keeping the
    deterministic XGBoost prediction pipeline 100% functional.
    """
    qwen = get_qwen_service()
    return qwen.set_enabled(req.enabled)


@router.post("/explain-prediction")
async def explain_xgboost_prediction_endpoint(req: ExplainPredictionRequest) -> Dict[str, Any]:
    """
    1. Runs the existing validated 9-feature XGBoost prediction pipeline (`EnhancedLandslidePredictor.predict`).
    2. Retrieves nearest sensor station readings, official alerts, and SOPs if not explicitly supplied.
    3. Audits telemetry for missing, stale, or contradictory values.
    4. Uses local `Qwen/Qwen3-4B` (or deterministic fallback if disabled) to explain the exact XGBoost output.
    """
    provided_features: Dict[str, Any] = {}
    for key in (
        "slope",
        "aspect",
        "elevation",
        "rainfall_24hr",
        "rainfall_7day",
        "ndvi",
        "distance_to_road",
    ):
        val = getattr(req, key)
        if val is not None:
            provided_features[key] = float(val)

    if req.soil_moisture is not None:
        sm = float(req.soil_moisture)
        provided_features["soil_moisture"] = sm / 100.0 if sm > 1.0 else sm

    predictor = get_enhanced_predictor()
    xgb_output = predictor.predict(
        req.latitude,
        req.longitude,
        provided_features if provided_features else None,
    )

    sensor_packet = req.sensor_readings
    if sensor_packet is None:
        sensor_tool_out = get_sensor_readings(
            {"latitude": req.latitude, "longitude": req.longitude},
            time_window=24,
        )
        sensor_packet = sensor_tool_out.get("latest_reading")

    alerts_out = get_official_alerts({"latitude": req.latitude, "longitude": req.longitude})
    sop_out = search_disaster_documents(
        f"landslide {xgb_output.get('risk_level', 'low')} rainfall slope escalation SOP"
    )

    qwen = get_qwen_service()
    llm_interp = await asyncio.to_thread(
        qwen.explain_xgboost_prediction,
        xgb_output=xgb_output,
        location={"latitude": req.latitude, "longitude": req.longitude},
        sensor_readings=sensor_packet,
        field_reports=req.field_reports,
        official_alerts=alerts_out.get("alerts", [])[:3],
        sops=sop_out.get("official_sops", [])[:3],
        max_new_tokens=req.max_new_tokens,
    )

    return {
        "location": {"latitude": req.latitude, "longitude": req.longitude},
        "xgboost_prediction": xgb_output,
        "llm_interpretation": llm_interp,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/agent-query")
async def agentic_query_endpoint(req: AgentQueryRequest) -> Dict[str, Any]:
    """
    Execute a controlled agentic workflow:
    selects & validates backend tools (`get_landslide_prediction`, `get_sensor_readings`,
    `get_rainfall_history`, `search_disaster_documents`, `get_official_alerts`, `get_incident_history`),
    and synthesizes a grounded decision-support response with local `Qwen/Qwen3-4B`.
    """
    try:
        return await asyncio.to_thread(
            run_agentic_workflow,
            query=req.query,
            location=req.location,
            features=req.features,
            requested_tools=req.requested_tools,
            include_llm_synthesis=req.include_llm_synthesis,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/tool-call")
async def call_controlled_tool_endpoint(req: ControlledToolRequest) -> Dict[str, Any]:
    """
    Directly invoke a controlled disaster-response tool with backend validation and timeout enforcement.
    """
    return await asyncio.to_thread(
        execute_controlled_tool,
        tool_name=req.tool_name,
        arguments=req.arguments,
        timeout_seconds=req.timeout_seconds,
    )


class OfficerAssistantRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1500)
    incident_id: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    location_name: Optional[str] = None
    max_new_tokens: int = Field(default=320, ge=64, le=1024)


class CreatePlanRequest(BaseModel):
    aoi: str = Field(default="gangtok", description="gangtok | aizawl | wayanad | shillong | tupul")
    scenario: str = Field(default="heavy_24h")
    custom_directive: str = Field(default="")


class DecideHighImpactTaskRequest(BaseModel):
    task_id: str = Field(...)
    decision: str = Field(..., description="APPROVED | REJECTED")
    notes: Optional[str] = Field(default="")


@router.get("/officer-assistant/status")
async def officer_assistant_status_endpoint() -> Dict[str, Any]:
    """
    Return the status of the Main Officer Assistant Agent and its connected fine-tuned local Qwen3-4B LLM.
    """
    from backend.app.agents.officer_assistant import get_officer_assistant

    agent = get_officer_assistant()
    return await asyncio.to_thread(agent.status)


@router.get("/officer-assistant/dashboard")
async def officer_assistant_dashboard_endpoint() -> Dict[str, Any]:
    """
    Return comprehensive live state for the `/agent` Autonomous Agent Dashboard:
    - Ongoing processes & progress
    - Active failures, slope deformation & seismic anomalies
    - Auto-executed low/medium tasks
    - High-impact human approval queue
    - Multi-hazard response plans
    """
    from backend.app.agents.officer_assistant import get_officer_assistant

    agent = get_officer_assistant()
    return await agent.get_autonomous_dashboard_state()


@router.post("/officer-assistant/create-plan")
async def officer_assistant_create_plan_endpoint(req: CreatePlanRequest) -> Dict[str, Any]:
    """
    Autonomously synthesize a multi-hazard response plan (Landslide + Earthquake) for an AOI:
    - Runs deterministic XGBoost prediction + seismic check
    - Auto-executes all low/medium-impact preparation tasks
    - Queues high-impact evacuation / road closure / CAP broadcast for Human Officer approval
    """
    from backend.app.agents.officer_assistant import get_officer_assistant

    agent = get_officer_assistant()
    return await agent.create_autonomous_plan(
        aoi=req.aoi,
        scenario=req.scenario,
        custom_directive=req.custom_directive,
    )


@router.post("/officer-assistant/approve-task")
async def officer_assistant_approve_task_endpoint(req: DecideHighImpactTaskRequest) -> Dict[str, Any]:
    """
    Human Officer approval gate for High-Impact Tasks and Response Plans (APPROVED | REJECTED).
    """
    from backend.app.agents.officer_assistant import get_officer_assistant

    agent = get_officer_assistant()
    try:
        return await agent.decide_high_impact_task(
            task_id=req.task_id,
            decision=req.decision,
            notes=req.notes or "",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/officer-assistant")
async def officer_assistant_briefing_endpoint(req: OfficerAssistantRequest) -> Dict[str, Any]:
    """
    Consult the Main Officer Assistant Agent (connected to local Qwen/Qwen3-4B fine-tuned for
    landslides and earthquakes) to assist the Human Officer with verified multi-hazard briefings.
    """
    from backend.app.agents.officer_assistant import get_officer_assistant

    agent = get_officer_assistant()
    return await agent.assist_officer(
        question=req.question,
        incident_id=req.incident_id,
        lat=req.latitude,
        lon=req.longitude,
        location_name=req.location_name,
        max_new_tokens=req.max_new_tokens,
    )
