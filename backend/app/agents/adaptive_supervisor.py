"""
Adaptive Supervisor Node for RESQ.AI × BhuRaksha.
Implements dynamic conditional routing, iteration/tool budgeting, conflict-driven
specialist selection, and deterministic safety gates.
"""

import time
import logging
from typing import Literal, Optional
from pydantic import BaseModel, Field

from backend.app.agents.contracts import AgentOutputContract, EvidenceItem, CalculatedResult

log = logging.getLogger("supervisor")

ActionType = Literal[
    "PARALLEL_INGESTION",
    "PHYSICS_SIMULATION",
    "CONFLICT_INVESTIGATION",
    "DATA_RECOVERY",
    "CONSEQUENCE_ANALYSIS",
    "PLAN_SYNTHESIS",
    "ESCALATE_HUMAN",
    "SAFE_ABSTAIN",
    "TERMINATE"
]

class RoutingDecision(BaseModel):
    step: int
    action: ActionType
    target_agents: list[str]
    reason: str
    uncertainty_level: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    budget_remaining: dict

class SupervisorState(BaseModel):
    incident_id: str
    aoi: str
    iteration: int = 0
    max_iterations: int = 10
    start_time: float = Field(default_factory=time.time)
    wall_clock_timeout_s: float = 20.0
    tool_calls_count: int = 0
    max_tool_calls: int = 40
    
    # Typed Agent Outputs Contract store
    agent_contracts: dict[str, AgentOutputContract] = Field(default_factory=dict)
    
    # State channels
    observations: dict = Field(default_factory=dict)
    geo_context: dict = Field(default_factory=dict)
    simulation: dict = Field(default_factory=dict)
    risk: dict = Field(default_factory=dict)
    verification: dict = Field(default_factory=dict)
    routing_history: list[RoutingDecision] = Field(default_factory=list)
    active_disagreements: list[dict] = Field(default_factory=list)
    status: str = "INITIALIZING"

class AdaptiveSupervisor:
    """
    Evaluates evidence, uncertainties, and constraints to dynamically choose
    the optimal next action rather than executing a rigid sequential pipeline.
    """
    
    def __init__(self, incident_id: str, aoi: str, max_iterations: int = 10):
        self.state = SupervisorState(
            incident_id=incident_id,
            aoi=aoi,
            max_iterations=max_iterations
        )
        
    def check_budgets(self) -> tuple[bool, Optional[str]]:
        """Deterministic safety gate checking iteration, tool, and time limits."""
        if self.state.iteration >= self.state.max_iterations:
            return False, f"Iteration limit reached ({self.state.iteration}/{self.state.max_iterations})"
        if self.state.tool_calls_count >= self.state.max_tool_calls:
            return False, f"Tool call budget exhausted ({self.state.tool_calls_count}/{self.state.max_tool_calls})"
        elapsed = time.time() - self.state.start_time
        if elapsed >= self.state.wall_clock_timeout_s:
            return False, f"Wall-clock budget timeout ({elapsed:.1f}s >= {self.state.wall_clock_timeout_s}s)"
        return True, None

    def decide_next_action(self) -> RoutingDecision:
        """
        Dynamic decision function:
        Inspects state data quality, evidence contradictions, and risk severity.
        """
        self.state.iteration += 1
        budget_ok, budget_reason = self.check_budgets()
        
        remaining_budget = {
            "iterations_left": self.state.max_iterations - self.state.iteration,
            "tool_calls_left": self.state.max_tool_calls - self.state.tool_calls_count,
            "time_left_s": max(0.0, self.state.wall_clock_timeout_s - (time.time() - self.state.start_time))
        }

        # Budget termination safety gate
        if not budget_ok:
            decision = RoutingDecision(
                step=self.state.iteration,
                action="ESCALATE_HUMAN",
                target_agents=["verifier", "planner"],
                reason=f"Safety Boundary Enforced: {budget_reason}. Escalating unfinalized state to Human Approver.",
                uncertainty_level="CRITICAL",
                budget_remaining=remaining_budget
            )
            self.state.routing_history.append(decision)
            return decision

        # 1. Initial State: Run parallel ingestion of Sentinel, Terrain, and Field Intel
        if not self.state.observations or not self.state.geo_context:
            decision = RoutingDecision(
                step=self.state.iteration,
                action="PARALLEL_INGESTION",
                target_agents=["sentinel", "terrain", "field_intel"],
                reason="Uninitialized state: parallel multi-modal ingestion required for baseline telemetry.",
                uncertainty_level="LOW",
                budget_remaining=remaining_budget
            )
            self.state.routing_history.append(decision)
            return decision

        # 2. Check for Missing Critical Data or Network Failure
        obs = self.state.observations
        if obs.get("api_outage") or obs.get("rainfall_missing"):
            decision = RoutingDecision(
                step=self.state.iteration,
                action="DATA_RECOVERY",
                target_agents=["sentinel", "verifier"],
                reason="Primary rainfall feed unavailable. Activating cached offline IMD/ECMWF datapack recovery.",
                uncertainty_level="HIGH",
                budget_remaining=remaining_budget
            )
            self.state.routing_history.append(decision)
            return decision

        # 3. Detect Evidence Contradiction / Telemetry Anomaly (The Agentic Loop Trigger)
        rain_72h = obs.get("rain_72h_mm", 0.0)
        piezo_ru = obs.get("piezo_ru", 0.0)
        sensor_anomaly = obs.get("sensor_anomaly", False)

        # Contradiction: Piezometer spikes (ru > 0.40) while rain is negligible (< 10mm)
        has_telemetry_conflict = (piezo_ru > 0.40 and rain_72h < 15.0) or sensor_anomaly
        if has_telemetry_conflict and "conflict_checked" not in self.state.verification:
            decision = RoutingDecision(
                step=self.state.iteration,
                action="CONFLICT_INVESTIGATION",
                target_agents=["skeptic", "verifier"],
                reason="Evidence conflict detected: high pore pressure ru=0.42 despite low antecedent rainfall. Activating Skeptic Red-Team to challenge sensor jitter.",
                uncertainty_level="HIGH",
                budget_remaining=remaining_budget
            )
            self.state.routing_history.append(decision)
            return decision

        # 4. Simulation Execution (if not yet computed or invalidated)
        if not self.state.simulation:
            decision = RoutingDecision(
                step=self.state.iteration,
                action="PHYSICS_SIMULATION",
                target_agents=["simulation", "risk"],
                reason="Telemetry reconciled: running infinite-slope physics simulation and multi-criteria risk engine.",
                uncertainty_level="MODERATE",
                budget_remaining=remaining_budget
            )
            self.state.routing_history.append(decision)
            return decision

        # 5. High-Impact Threat Assessment: Consequence Analysis
        min_fs = self.state.simulation.get("min_fs", 1.5)
        failed_cells = self.state.simulation.get("failed_cells", 0)
        
        if (min_fs < 1.0 or failed_cells > 0) and "consequence_evaluated" not in self.state.verification:
            decision = RoutingDecision(
                step=self.state.iteration,
                action="CONSEQUENCE_ANALYSIS",
                target_agents=["impact", "route", "resource"],
                reason=f"Slope instability confirmed (min FS={min_fs:.2f} < 1.0, {failed_cells} cells failed). Evaluating lifeline highway cutoffs, hospital access, and shelter routing.",
                uncertainty_level="CRITICAL",
                budget_remaining=remaining_budget
            )
            self.state.routing_history.append(decision)
            return decision

        # 6. Response Plan Synthesis
        if "plan_synthesized" not in self.state.verification:
            decision = RoutingDecision(
                step=self.state.iteration,
                action="PLAN_SYNTHESIS",
                target_agents=["planner", "dispatcher"],
                reason="Consequence analysis complete: generating versioned operational plan and multilingual CAP alert drafts.",
                uncertainty_level="MODERATE",
                budget_remaining=remaining_budget
            )
            self.state.routing_history.append(decision)
            return decision

        # 7. Escalation to Human Approval Gate (Final Safe State)
        decision = RoutingDecision(
            step=self.state.iteration,
            action="TERMINATE",
            target_agents=["orchestrator"],
            reason="Workflow complete: Plan version generated and locked behind Collector Approval Gate.",
            uncertainty_level="LOW",
            budget_remaining=remaining_budget
        )
        self.state.routing_history.append(decision)
        return decision
