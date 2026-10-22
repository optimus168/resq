"""
Typed Agent Output Contracts for RESQ.AI × BhuRaksha.
Enforces strict separation between directly observed evidence, deterministic
physics calculations, model predictions, LLM advisory interpretations, and unknowns.
"""

from typing import Optional, Any, Literal
from pydantic import BaseModel, Field

AgentStatus = Literal["complete", "partial", "failed", "abstained"]
FreshnessStatus = Literal["fresh", "stale", "unknown", "unavailable"]

class EvidenceItem(BaseModel):
    id: str
    source: str
    source_type: Literal["sensor", "dem", "weather", "citizen_report", "inventory", "sar"]
    timestamp: str
    value: Any
    unit: Optional[str] = None
    freshness: FreshnessStatus = "fresh"
    is_simulated: bool = True

class CalculatedResult(BaseModel):
    metric: str
    value: float
    unit: Optional[str] = None
    method: str
    is_authoritative_deterministic: bool = True

class ModelPrediction(BaseModel):
    model_name: str
    target: str
    score: float
    uncertainty_std: Optional[float] = None
    shap_top_features: list[dict] = []

class AgentOutputContract(BaseModel):
    agent_id: str
    version: str = "2.0.0"
    incident_id: str
    execution_id: str
    status: AgentStatus = "complete"
    
    # 1. Observed raw evidence (directly sourced/measured)
    observed_evidence: list[EvidenceItem] = Field(default_factory=list)
    
    # 2. Authoritative deterministic calculations (closed-form physics)
    calculated_results: list[CalculatedResult] = Field(default_factory=list)
    
    # 3. Learned model inferences (XGBoost, etc.)
    model_predictions: list[ModelPrediction] = Field(default_factory=list)
    
    # 4. LLM reasoning and advisory synthesis
    interpretation: str = ""
    
    # 5. Unknowns, assumptions, and data quality limits
    uncertainties: list[str] = Field(default_factory=list)
    missing_inputs: list[str] = Field(default_factory=list)
    
    # 6. Actionable recommendations & governance
    next_action: str = "continue"
    requires_human_review: bool = False
    execution_ms: float = 0.0
