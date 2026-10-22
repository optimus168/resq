import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, Mountain, AlertTriangle, Layers, Activity, Clock, 
  User, CheckCircle2, Sliders, MessageSquare, Smartphone, Lock, 
  Terminal, Sparkles, RefreshCw, Volume2, Award, ShieldAlert, Cpu
} from 'lucide-react';

import { api } from '../api';
import DigitalTwin3D from './DigitalTwin3D';
import AgentGraph from './AgentGraph';
import TraceFeed from './TraceFeed';
import PlanGate from './PlanGate';
import ScenarioDirector from './ScenarioDirector';
import AskMissionControl from './AskMissionControl';
import AuditLedger from './AuditLedger';
import SkepticDebate from './SkepticDebate';
import ValidationPage from './ValidationPage';
import RedTeamPanel from './RedTeamPanel';
import WhatIfCopilot from './WhatIfCopilot';
import EvidenceGraph from './EvidenceGraph';
import ResponsibleAIPage from './ResponsibleAIPage';
import FieldReporting from './FieldReporting';
import AdaptiveSupervisorTrace from './AdaptiveSupervisorTrace';
import { SimulatedBadge, RiskBadge, RoleBadge } from './Badges';

export default function MissionControl() {
  // Application State
  const [activeAOI, setActiveAOI] = useState('gangtok');
  const [aoiCatalog, setAoiCatalog] = useState([]);
  const [demGrid, setDemGrid] = useState(null);
  const [incident, setIncident] = useState(null);
  const [weather, setWeather] = useState(null);
  const [reports, setReports] = useState([]);
  const [auditRecords, setAuditRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('agents'); // 'agents', 'traces', 'debate', 'whatif', 'redteam', 'evidence', 'assistant', 'field', 'audit'
  const [currentRole, setCurrentRole] = useState('collector');
  const [isAutoDemoRunning, setIsAutoDemoRunning] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showResponsibleAI, setShowResponsibleAI] = useState(false);
  const [liveClock, setLiveClock] = useState('');
  const [activeAgents, setActiveAgents] = useState(['orchestrator', 'sentinel', 'terrain_geo', 'risk_analyst']);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveClock(now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial Load: Login default operator and load AOI
  const initSession = useCallback(async () => {
    try {
      // Login as collector by default to test human approval gate
      await api.login('collector@bhuraksha.demo', 'Approve@RESQ26');
      
      const aois = await api.getAOIs();
      setAoiCatalog(aois);

      const grid = await api.getDEMGrid(activeAOI, 48);
      setDemGrid(grid);

      // Start baseline incident
      const inc = await api.createIncident(activeAOI, 'baseline');
      setIncident(inc);

      // Load initial reports & audit
      const reps = await api.getReports(activeAOI);
      setReports(reps);

      const audits = await api.getAuditLedger(30);
      setAuditRecords(audits);
    } catch (err) {
      console.warn("Init fallback:", err);
    }
  }, [activeAOI]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Periodic Polling for Incident State
  useEffect(() => {
    if (!incident?.id) return;
    const interval = setInterval(async () => {
      try {
        const updated = await api.getIncident(incident.id);
        setIncident(updated);
      } catch (e) {
        // quiet poll
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [incident?.id]);

  // Role Switcher Handler
  const handleRoleSwitch = async (newRole) => {
    setCurrentRole(newRole);
    const creds = {
      collector: { email: 'collector@bhuraksha.demo', pass: 'Approve@RESQ26' },
      operator: { email: 'operator@bhuraksha.demo', pass: 'Operate@RESQ26' },
      analyst: { email: 'analyst@bhuraksha.demo', pass: 'Analyze@RESQ26' },
      field: { email: 'field@bhuraksha.demo', pass: 'Field@RESQ26' },
      citizen: { email: 'citizen@bhuraksha.demo', pass: 'Citizen@RESQ26' }
    }[newRole];
    if (creds) {
      try {
        await api.login(creds.email, creds.pass);
      } catch (err) {
        console.error("Role login failed:", err);
      }
    }
  };

  // Plan Decisions
  const handleApprovePlan = async (version, notes) => {
    if (!incident?.id) return;
    await api.decidePlan(incident.id, version, 'approve', notes);
    const updated = await api.getIncident(incident.id);
    setIncident(updated);
    const audits = await api.getAuditLedger(30);
    setAuditRecords(audits);
  };

  const handleRejectPlan = async (version, notes) => {
    if (!incident?.id) return;
    await api.decidePlan(incident.id, version, 'reject', notes);
    const updated = await api.getIncident(incident.id);
    setIncident(updated);
  };

  // Trigger External Perturbation Event
  const handleTriggerEvent = async (eventType, payload) => {
    if (!incident?.id) return;
    setActiveAgents(['verifier', 'risk_analyst', 'simulation', 'response_planner']);
    await api.triggerEvent(incident.id, eventType, payload);
    
    // Refresh incident state
    setTimeout(async () => {
      const updated = await api.getIncident(incident.id);
      setIncident(updated);
      setActiveAgents([]);
      const audits = await api.getAuditLedger(30);
      setAuditRecords(audits);
    }, 1500);
  };

  // Reset to Baseline
  const handleResetBaseline = async () => {
    const inc = await api.createIncident(activeAOI, 'baseline');
    setIncident(inc);
    setActiveAgents(['orchestrator', 'sentinel', 'terrain_geo']);
    setTimeout(() => setActiveAgents([]), 1200);
  };

  // 3-Minute Auto Demo Flow (Wow Moments 1, 2, 3 in sequence)
  const handleRunAutoDemo = async () => {
    if (isAutoDemoRunning || !incident?.id) return;
    setIsAutoDemoRunning(true);

    try {
      // 1. Reset
      await handleResetBaseline();
      await new Promise(r => setTimeout(r, 2000));

      // 2. Escalate Rain
      await handleTriggerEvent('RAIN_ESCALATION', { delta: 0.6, mm_added: 65 });
      await new Promise(r => setTimeout(r, 2500));

      // 3. Collector Approves Plan V1
      await handleApprovePlan(1, "Collector Authorized baseline precautionary plan");
      await new Promise(r => setTimeout(r, 2000));

      // 4. Trigger Road Blockage on NH10 KM-18
      await handleTriggerEvent('ROAD_BLOCKED', { road_id: 'NH10_KM18', segment: 'Singtam-Deorali' });
      await new Promise(r => setTimeout(r, 2500));

      // 5. Invalidate and Generate Plan V2 (with structural diff)
      const updated = await api.getIncident(incident.id);
      setIncident(updated);
      setActiveTab('agents');
    } catch (err) {
      console.error("Auto demo error:", err);
    } finally {
      setIsAutoDemoRunning(false);
    }
  };

  // RAG Query Handler
  const handleAssistantQuery = async (queryText) => {
    return api.askMissionControl(queryText, incident?.id || '');
  };

  // Field Report Handler
  const handleSubmitReport = async (formData) => {
    const res = await api.submitReport(formData);
    const updatedReps = await api.getReports(activeAOI);
    setReports(updatedReps);
    return res;
  };

  const handleVerifyReport = async (reportId, status) => {
    await api.verifyReport(reportId, status, 'Verified by field inspection unit');
    const updatedReps = await api.getReports(activeAOI);
    setReports(updatedReps);
  };

  // Full-page Modal Overlays
  if (showValidation) {
    return <ValidationPage onBack={() => setShowValidation(false)} />;
  }

  if (showResponsibleAI) {
    return <ResponsibleAIPage onBack={() => setShowResponsibleAI(false)} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#06150C] text-white overflow-hidden select-none">
      {/* Top Mission Control Bar */}
      <header className="h-14 bg-[#0A2416] border-b border-[#249344]/50 px-4 flex items-center justify-between gap-4 z-30 shadow-md">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#BDFF42] text-[#06150C] flex items-center justify-center font-bold text-sm shadow-lg shadow-lime-500/20">
            RQ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-sm font-sans text-white">
                BHURAKSHA <span className="text-[#BDFF42]">×</span> RESQ.AI
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#249344]/30 text-[#BDFF42] border border-[#249344]/50">
                NER-OPERATIONAL
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#9FD8A8]">
              AGENTIC AI LANDSLIDE INTELLIGENCE & RESPONSE PLATFORM
            </div>
          </div>
        </div>

        {/* Center Indicators & Navigation Buttons */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
          {/* AOI Selector */}
          <div className="flex items-center gap-2 bg-[#06150C] px-3 py-1.5 rounded-md border border-[#249344]/40">
            <Mountain className="w-3.5 h-3.5 text-[#BDFF42]" />
            <select
              value={activeAOI}
              onChange={(e) => setActiveAOI(e.target.value)}
              className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="gangtok" className="bg-[#0A2416]">Gangtok-NH10 Corridor (Sikkim)</option>
              <option value="shillong" className="bg-[#0A2416]">Shillong Bypass (Meghalaya)</option>
              <option value="aizawl" className="bg-[#0A2416]">Aizawl Ridge (Mizoram)</option>
              <option value="tupul" className="bg-[#0A2416]">Tupul / Noney (Manipur)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-[#BDFF42]" />
            <span>{liveClock}</span>
          </div>

          <SimulatedBadge />

          {/* Differentiator Navigation Buttons */}
          <button
            onClick={() => setShowValidation(true)}
            className="px-2.5 py-1.5 rounded bg-[#0A2416] border border-[#BDFF42] text-[#BDFF42] hover:bg-[#BDFF42] hover:text-[#06150C] transition-all font-bold flex items-center gap-1.5 shadow"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Model Validation</span>
          </button>

          <button
            onClick={() => setShowResponsibleAI(true)}
            className="px-2.5 py-1.5 rounded bg-[#0A2416] border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 transition-all font-bold flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Responsible AI & Impact</span>
          </button>
        </div>

        {/* Right Action & RBAC Switcher */}
        <div className="flex items-center gap-3">
          {/* Role Selector */}
          <div className="flex items-center gap-1.5 bg-[#06150C] px-2.5 py-1 rounded-md border border-[#249344]/40 text-xs font-mono">
            <User className="w-3.5 h-3.5 text-[#FFA31A]" />
            <select
              value={currentRole}
              onChange={(e) => handleRoleSwitch(e.target.value)}
              className="bg-transparent text-[#9FD8A8] focus:outline-none cursor-pointer"
            >
              <option value="collector" className="bg-[#0A2416]">Collector (Approver)</option>
              <option value="operator" className="bg-[#0A2416]">Incident Operator</option>
              <option value="analyst" className="bg-[#0A2416]">Geotech Analyst</option>
              <option value="field" className="bg-[#0A2416]">Field Officer</option>
              <option value="citizen" className="bg-[#0A2416]">Citizen / Reporter</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Mission Control Layout Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Telemetry & Scenario Panel */}
        <aside className="w-80 bg-[#06150C] border-r border-[#249344]/30 flex flex-col overflow-y-auto p-3 space-y-3 z-20">
          {/* AOI Overview Card */}
          <div className="p-3 bg-[#0A2416] rounded-lg border border-[#249344]/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase font-sans">
                {activeAOI.toUpperCase()} CORRIDOR
              </span>
              <RiskBadge level={incident?.status === 'PENDING_APPROVAL' ? 'HIGH' : 'MODERATE'} score={0.76} />
            </div>
            <div className="text-[11px] text-slate-400 font-mono space-y-1">
              <div>DEM: Real 30m Copernicus GLO-30 / AWS (64×64)</div>
              <div>Coordinates: 27.324° N, 88.611° E</div>
              <div>Primary Lifeline: NH-10 Strategic Arterial</div>
            </div>
          </div>

          {/* Live Sensor & Rainfall Telemetry */}
          <div className="p-3 bg-[#0A2416] rounded-lg border border-[#249344]/40 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-[#BDFF42] font-bold font-sans">
              <span>ENVIRONMENTAL FEEDS</span>
              <span className="text-[10px] text-slate-400">72H HORIZON</span>
            </div>

            {/* Hyetograph preview */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Cumulative Rain:</span>
                <span className="text-cyan-400 font-bold">114.5 mm / 72h</span>
              </div>
              <div className="w-full bg-[#06150C] h-2 rounded overflow-hidden border border-[#249344]/30">
                <div className="bg-cyan-400 h-full w-[65%]"></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Piezometer (ru):</span>
                <span className="text-[#FFA31A] font-bold">0.42 (High Pore Press)</span>
              </div>
              <div className="w-full bg-[#06150C] h-2 rounded overflow-hidden border border-[#249344]/30">
                <div className="bg-[#FFA31A] h-full w-[74%]"></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Borehole Inclinometer:</span>
                <span className="text-emerald-400 font-bold">3.2 mm/hr tilt</span>
              </div>
              <div className="w-full bg-[#06150C] h-2 rounded overflow-hidden border border-[#249344]/30">
                <div className="bg-emerald-500 h-full w-[28%]"></div>
              </div>
            </div>
          </div>

          {/* Scenario Director Controller */}
          <ScenarioDirector
            incidentId={incident?.id}
            onTriggerEvent={handleTriggerEvent}
            onReset={handleResetBaseline}
            onRunAutoDemo={handleRunAutoDemo}
            isAutoDemoRunning={isAutoDemoRunning}
            onApproveV1={() => handleApprovePlan(1, "Collector Authorized Precautionary Plan V1")}
            onOpenRedTeam={() => setActiveTab('redteam')}
          />
        </aside>

        {/* Center: Digital Twin & Bottom Plan Gate */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* 3D Digital Twin Viewer */}
          <div className="flex-1 p-3 overflow-hidden">
            <DigitalTwin3D
              demGrid={demGrid}
              simulationResult={incident?.simulation}
              aoi={activeAOI}
              weather={weather}
            />
          </div>

          {/* Bottom Panel: Human Approval Gate & Plan Diff */}
          <div className="px-3 pb-3 max-h-72">
            <PlanGate
              incident={incident}
              currentRole={currentRole}
              onApprove={handleApprovePlan}
              onReject={handleRejectPlan}
            />
          </div>
        </main>

        {/* Right Stage: Agent Graph, Traces, Debate, What-If, Red-Team, Evidence, SOP, Field, Audit */}
        <aside className="w-[420px] bg-[#06150C] border-l border-[#249344]/30 flex flex-col overflow-hidden z-20">
          {/* Navigation Tabs Header */}
          <div className="bg-[#0A2416] border-b border-[#249344]/40 px-2 py-1.5 flex flex-wrap items-center gap-1 text-[11px] font-mono">
            {[
              { id: 'agents', label: 'Agents' },
              { id: 'supervisor', label: 'Adaptive' },
              { id: 'traces', label: 'Traces' },
              { id: 'debate', label: 'Debate' },
              { id: 'whatif', label: 'What-If' },
              { id: 'redteam', label: 'Red-Team' },
              { id: 'evidence', label: 'Evidence' },
              { id: 'assistant', label: 'Ask SOP' },
              { id: 'field', label: 'Field' },
              { id: 'audit', label: 'Audit' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 rounded transition-all font-semibold ${
                  activeTab === tab.id 
                    ? 'bg-[#BDFF42] text-[#06150C] shadow' 
                    : 'text-[#9FD8A8] hover:bg-[#249344]/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Tab View Body */}
          <div className="flex-1 p-2.5 overflow-hidden">
            {activeTab === 'agents' && (
              <AgentGraph
                activeAgents={activeAgents}
                incidentState={incident}
              />
            )}

            {activeTab === 'supervisor' && (
              <AdaptiveSupervisorTrace
                incidentId={incident?.id}
              />
            )}

            {activeTab === 'traces' && (
              <TraceFeed
                traces={incident?.agent_trace || []}
              />
            )}

            {activeTab === 'debate' && (
              <SkepticDebate
                incidentId={incident?.id}
              />
            )}

            {activeTab === 'whatif' && (
              <WhatIfCopilot
                incidentId={incident?.id}
              />
            )}

            {activeTab === 'redteam' && (
              <RedTeamPanel
                activeAOI={activeAOI}
              />
            )}

            {activeTab === 'evidence' && (
              <EvidenceGraph
                incidentId={incident?.id}
              />
            )}

            {activeTab === 'assistant' && (
              <AskMissionControl
                incidentId={incident?.id}
                onSendQuery={handleAssistantQuery}
              />
            )}

            {activeTab === 'field' && (
              <FieldReporting
                reports={reports}
                onSubmitReport={handleSubmitReport}
                onVerifyReport={handleVerifyReport}
                currentRole={currentRole}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLedger
                records={auditRecords}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
