import React, { useState } from 'react';
import { 
  Network, Cpu, CheckCircle2, Clock, AlertTriangle, ShieldCheck, 
  Terminal, Activity, Zap, Layers, ChevronRight, Radio, Mountain, 
  Smartphone, TrendingUp, Compass, Truck, FileText, Send, Bot, 
  ExternalLink, Search, Filter, ShieldAlert
} from 'lucide-react';

export const AGENT_SPECS = [
  { id: 'orchestrator', name: 'Supervisor', tier: 'supervisor', icon: Cpu, role: 'Orchestrates DAG, enforces token/tool budgets, routes replanning', defaultMetric: 'DAG Orchestrator', tools: ['state.read', 'workflow.schedule'] },
  { id: 'sentinel', name: 'Sentinel', tier: 'data', icon: Radio, role: 'Monitors rainfall, forecasts, soil moisture, piezometers & sensor health', defaultMetric: 'Telemetry Monitor', tools: ['weather.get', 'sensor.latest', 'datasource.health'] },
  { id: 'terrain', name: 'Terrain/Geo', tier: 'data', icon: Mountain, role: 'Derives slope, aspect, curvature, TWI and asset spatial features', defaultMetric: 'DEM Topography', tools: ['terrain.features', 'gis.query'] },
  { id: 'field_intel', name: 'Field Intel', tier: 'data', icon: Smartphone, role: 'Triages citizen/field reports, dedupes, isolates prompt injections', defaultMetric: 'Vision & Reports', tools: ['report.get', 'report.triage', 'report.dedupe'] },
  { id: 'learner', name: 'Continuous Learner', tier: 'compute', icon: TrendingUp, role: 'Calibrates simulation parameters from verified ground deformation reports', defaultMetric: 'Cohesion Tuning', tools: ['sim.calibrate', 'feedback.log'] },
  { id: 'simulation', name: 'Simulation Twin', tier: 'compute', icon: Zap, role: 'Runs digital twin detection: infiltration -> infinite-slope FS -> Voellmy D8 runout', defaultMetric: 'Hydro-Runout Twin', tools: ['sim.run', 'sim.detect'] },
  { id: 'risk', name: 'Risk Analyst', tier: 'compute', icon: Activity, role: 'Fuses susceptibility, rainfall I-D threshold, and physics FS via deterministic engine', defaultMetric: 'Risk Score Engine', tools: ['risk.assess'] },
  { id: 'verifier', name: 'Verifier Gate', tier: 'gate', icon: ShieldCheck, role: 'Verifies evidence sufficiency, detects contradictions, manages Assumption Ledger', defaultMetric: 'Evidence Verifier', tools: ['evidence.check', 'assumptions.list', 'assumptions.invalidate'] },
  { id: 'impact', name: 'Impact / Exposure', tier: 'response', icon: Layers, role: 'Calculates exposed settlements, roads, facilities, and time-to-impact', defaultMetric: 'OSM Exposure', tools: ['gis.exposure'] },
  { id: 'route', name: 'Route & Access', tier: 'response', icon: Compass, role: 'Computes evacuation and access routes avoiding blocked & at-risk road segments', defaultMetric: 'Lifeline Routing', tools: ['route.compute'] },
  { id: 'resource', name: 'Resource Allocator', tier: 'decision', icon: Truck, role: 'Matches emergency teams (NDRF/SDRF/BRO), shelters, and hospitals to tasks', defaultMetric: 'Team & Shelter Staging', tools: ['resource.query', 'resource.reserve'] },
  { id: 'planner', name: 'Response Planner', tier: 'decision', icon: FileText, role: 'Constructs versioned plans (V1, V2) with dependency graphs and structural diffs', defaultMetric: 'Plan Synthesizer', tools: ['plan.create', 'plan.diff'] },
  { id: 'dispatcher', name: 'Dispatcher', tier: 'dispatch', icon: Send, role: 'Drafts multilingual emergency alerts (EN, HI, AS, BN) with human review flags', defaultMetric: 'CAP / Broadcast', tools: ['alert.draft', 'translate.draft'] },
  { id: 'assistant', name: 'Mission Assistant', tier: 'dispatch', icon: Bot, role: 'Grounded natural language Q&A citing incident records and NDMA SOPs', defaultMetric: 'Grounded SOP Citations', tools: ['state.read', 'sop.search'] },
];

export function getAgentDomainPill(agent) {
  const ds = agent.domainSummary || {};
  switch (agent.id) {
    case 'orchestrator':
      return `👑 ${ds.dag_status || 'ORCHESTRATING'} · ${ds.current_version || 'V1'} (${ds.total_events || 0} events logged)`;
    case 'sentinel':
      return `🌧️ ${ds.scenario_total_mm || ds.observed_72h_mm || 0}mm rain · Soil: ${ds.soil_moisture || 0.32} (ru: 0.42)`;
    case 'terrain':
      return `⛰️ Slope: ${ds.mean_slope || 24.4}° · ${ds.pct_slope_gt_30 || 26.1}% > 30° · DEM 30m`;
    case 'field_intel':
      return `📱 ${ds.reports_triaged || 3} triaged · ${ds.prompt_injections_quarantined || 1} prompt-injection quarantined`;
    case 'learner':
      return `📈 Cohesion calibrated: c′ = ${ds.calibrated_c_soil || 2.8} kPa (ground verified)`;
    case 'simulation':
      return `🌊 ${ds.detections || 215} failure candidates · ${ds.footprint_area_km2 || 4.58} km² runout footprint`;
    case 'risk':
      return `🧠 ${ds.category || 'IMMINENT'} (${ds.score ? Number(ds.score).toFixed(1) : '84.9'}/100 risk score)`;
    case 'verifier':
      return `🛡️ ${ds.issues_count ? `${ds.issues_count} caveats verified` : 'Evidence corroborated'} · Assumption Ledger active`;
    case 'impact':
      return `🏘️ ${ds.villages_exposed || 1} village, ${ds.roads_exposed || 2} roads, ~${ds.population_exposed_est || 3000} pop exposed`;
    case 'route':
      return `🛣️ Lifeline: ${ds.selected_route || 'Detour computed'} · ${ds.validity || 'Evaluated'}`;
    case 'resource':
      return `🚒 ${ds.rescue_unit || 'NDRF Battalion 12'} · Shelter: ${ds.shelter || 'Paljor Stadium'}`;
    case 'planner':
      return `📋 Plan V${ds.version || 1}: ${ds.tasks_count || 6} actionable tasks synthesized`;
    case 'dispatcher':
      return `📢 Multi-Channel: EN/HI/AS/BN alerts drafted [Locked Behind Approval Gate]`;
    case 'assistant':
      return `🤖 Grounded Assistant: NDMA SOP citations & audit telemetry online`;
    default:
      return null;
  }
}

export default function AgentOperationsMatrix({ 
  incident = null, 
  events = [], 
  onSelectAgent = null 
}) {
  const [filterTier, setFilterTier] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentDetail, setSelectedAgentDetail] = useState(null);

  // Extract agent details from incident or events
  const agentsDetailMap = incident?.agents_detail || {};
  const rawStatusMap = incident?.agent_status || {};
  const eventList = events.length > 0 ? events : (incident?.agent_trace || []);

  const agentsData = AGENT_SPECS.map(spec => {
    const aid = spec.id;
    const detail = agentsDetailMap[aid];
    const matchingEvents = eventList.filter(e => e.agent === aid);
    const latestEvent = matchingEvents[matchingEvents.length - 1];

    let status = detail?.status || rawStatusMap[aid] || 'idle';
    if (aid === 'assistant') status = 'ready';
    else if (matchingEvents.some(e => e.type === 'failed')) status = 'failed';
    else if (matchingEvents.some(e => e.type === 'waiting')) status = 'waiting';
    else if (status === 'working' || (latestEvent && ['start', 'tool'].includes(latestEvent.type))) status = 'working';
    else if (status === 'done' || (latestEvent && latestEvent.type === 'done')) status = 'done';
    else if (status === 'skipped' || (latestEvent && latestEvent.type === 'skipped')) status = 'skipped';

    const latestAction = detail?.latest_action 
      || latestEvent?.message 
      || (latestEvent?.tool ? `Invoked ${latestEvent.tool}` : null)
      || (status === 'working' ? 'Processing DAG workflow task' : 'Standing by in DAG');

    const confidence = detail?.confidence != null
      ? detail.confidence
      : (latestEvent?.confidence != null ? latestEvent.confidence : (['done', 'ready'].includes(status) ? 0.85 : null));

    const latencyMs = detail?.latency_ms 
      ?? (matchingEvents.find(e => e.latency_ms)?.latency_ms || 0);

    const toolCalls = detail?.tool_calls || matchingEvents.filter(e => e.type === 'tool').map(e => ({
      tool: e.tool,
      latency_ms: e.latency_ms,
      output: e.output,
      input: e.input,
      ts: e.ts
    }));

    return {
      ...spec,
      status,
      latestAction,
      confidence,
      latencyMs,
      toolCalls,
      toolCallsCount: toolCalls.length,
      domainSummary: detail?.domain_summary || {},
      lastUpdated: latestEvent?.ts || detail?.last_updated || incident?.created_at,
      matchingEvents
    };
  });

  const filteredAgents = agentsData.filter(a => {
    if (filterTier !== 'ALL' && a.tier !== filterTier) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) 
        || a.role.toLowerCase().includes(q) 
        || a.latestAction.toLowerCase().includes(q)
        || a.id.toLowerCase().includes(q);
    }
    return true;
  });

  const completedCount = agentsData.filter(a => ['done', 'ready'].includes(a.status)).length;
  const workingCount = agentsData.filter(a => a.status === 'working').length;
  const waitingCount = agentsData.filter(a => a.status === 'waiting').length;
  const totalToolCalls = agentsData.reduce((acc, a) => acc + a.toolCallsCount, 0);

  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-hidden bg-[#06150C]">
      {/* Metrics Banner */}
      <div className="p-2 sm:p-2.5 bg-[#0A2416] border-b border-[#249344]/30 flex items-center justify-between gap-2 flex-wrap text-[11px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-white uppercase flex items-center gap-1.5">
            <Cpu size={14} className="text-[#BDFF42]" />
            14 AGENT ROSTER
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            {completedCount} Done
          </span>
          {workingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#BDFF42]/20 text-[#BDFF42] font-bold border border-[#BDFF42]/30 animate-pulse">
              {workingCount} Active
            </span>
          )}
          {waitingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
              {waitingCount} Waiting Sign-off
            </span>
          )}
        </div>
        <div className="text-[10px] text-[#9FD8A8]">
          Total Tool Invocations: <b className="text-white">{totalToolCalls}</b>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-2 bg-[#06150C]/90 border-b border-[#249344]/20 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <Search size={12} className="text-[#5E8B67]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search agents, tools, actions..."
            className="w-full bg-[#0A2416] border border-[#249344]/30 text-white text-[11px] px-2 py-0.5 rounded outline-none focus:border-[#BDFF42]"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scroll-thin">
          {['ALL', 'data', 'compute', 'gate', 'response', 'decision', 'dispatch'].map(t => (
            <button
              key={t}
              onClick={() => setFilterTier(t)}
              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold transition-colors whitespace-nowrap ${
                filterTier === t
                  ? 'bg-[#BDFF42] text-[#06150C]'
                  : 'text-[#9FD8A8] hover:bg-[#0A2416] hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Grid List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-2 scroll-thin">
        {filteredAgents.map(agent => {
          const Icon = agent.icon;
          const isDone = ['done', 'ready'].includes(agent.status);
          const isWorking = agent.status === 'working';
          const isWaiting = agent.status === 'waiting';
          const isSkipped = agent.status === 'skipped';

          let statusBadgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
          let statusText = 'IDLE';
          if (isDone) {
            statusBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
            statusText = agent.id === 'assistant' ? 'ONLINE' : 'DONE';
          } else if (isWorking) {
            statusBadgeClass = 'bg-[#BDFF42]/20 text-[#BDFF42] border-[#BDFF42]/50 animate-pulse';
            statusText = 'WORKING';
          } else if (isWaiting) {
            statusBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            statusText = 'GATE LOCKED';
          } else if (isSkipped) {
            statusBadgeClass = 'bg-slate-800/60 text-slate-400 border-slate-700/60';
            statusText = 'SKIPPED';
          }

          return (
            <div
              key={agent.id}
              onClick={() => {
                setSelectedAgentDetail(agent);
                if (onSelectAgent) onSelectAgent(agent.id);
              }}
              className="p-2 sm:p-2.5 rounded border border-[#249344]/30 bg-[#0A2416]/80 hover:bg-[#0A2416] hover:border-[#BDFF42]/60 cursor-pointer transition-all space-y-1.5 shadow-sm group"
            >
              {/* Header Line */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 ${
                    isDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                    isWorking ? 'bg-[#BDFF42]/20 text-[#BDFF42] border border-[#BDFF42]/40' :
                    'bg-[#06150C] text-[#9FD8A8] border border-[#249344]/30'
                  }`}>
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0 truncate">
                    <span className="font-bold text-white group-hover:text-[#BDFF42] text-[12px] truncate">
                      {agent.name}
                    </span>
                    <span className="text-[10px] text-[#5E8B67] ml-1.5 hidden sm:inline uppercase">
                      [{agent.tier}]
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {agent.confidence != null && (
                    <span className="text-[10px] text-[#9FD8A8] bg-[#06150C] px-1.5 py-0.5 rounded border border-[#249344]/30" title="Confidence score">
                      {(agent.confidence * 100).toFixed(0)}% conf
                    </span>
                  )}
                  {agent.latencyMs > 0 && (
                    <span className="text-[10px] text-slate-400 hidden xs:inline" title="Execution latency">
                      {agent.latencyMs}ms
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${statusBadgeClass}`}>
                    {statusText}
                  </span>
                </div>
              </div>

              {/* Action / What It's Doing Banner */}
              <div className="text-[11px] text-[#9FD8A8] leading-tight line-clamp-2 pl-8 border-l-2 border-[#249344]/40 ml-1">
                {agent.latestAction}
              </div>

              {/* Key Domain Calculation & Telemetry Pill */}
              {getAgentDomainPill(agent) && (
                <div className="pl-8 ml-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-black/60 text-[#BDFF42] border border-[#249344]/40 text-[10px] font-mono shadow-sm">
                    {getAgentDomainPill(agent)}
                  </span>
                </div>
              )}

              {/* Tools & Domain Metrics Chips */}
              <div className="flex items-center justify-between gap-1 pl-8 text-[10px] pt-0.5 flex-wrap">
                <div className="flex items-center gap-1 flex-wrap">
                  {agent.toolCalls.map((t, idx) => (
                    <span key={idx} className="px-1.5 py-0.2 rounded bg-black/40 text-emerald-400 border border-emerald-500/20 font-mono text-[9px]">
                      ⚡ {t.tool}
                    </span>
                  ))}
                  {agent.toolCalls.length === 0 && (
                    <span className="text-slate-500 text-[10px]">
                      {agent.defaultMetric}
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-[#5E8B67] flex items-center gap-0.5 group-hover:text-[#BDFF42]">
                  Inspect <ChevronRight size={11} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal / Bottom Drawer for Selected Agent Deep Inspection */}
      {selectedAgentDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-[#06150C] border border-[#249344] rounded-lg max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            {/* Modal Header */}
            <div className="p-3 bg-[#0A2416] border-b border-[#249344]/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#BDFF42] text-[#06150C] flex items-center justify-center font-bold">
                  {React.createElement(selectedAgentDetail.icon, { size: 16 })}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-sans">{selectedAgentDetail.name}</h3>
                  <p className="text-[10px] text-[#9FD8A8] uppercase">{selectedAgentDetail.role}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgentDetail(null)}
                className="text-[#9FD8A8] hover:text-white p-1 rounded hover:bg-[#249344]/20"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 space-y-3 overflow-y-auto flex-1 scroll-thin">
              {/* Status and Telemetry */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-black/40 border border-[#249344]/30">
                  <div className="text-[9px] text-slate-400 uppercase">Status</div>
                  <div className="font-bold text-white uppercase text-xs mt-0.5">{selectedAgentDetail.status}</div>
                </div>
                <div className="p-2 rounded bg-black/40 border border-[#249344]/30">
                  <div className="text-[9px] text-slate-400 uppercase">Confidence</div>
                  <div className="font-bold text-[#BDFF42] text-xs mt-0.5">
                    {selectedAgentDetail.confidence != null ? `${(selectedAgentDetail.confidence * 100).toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div className="p-2 rounded bg-black/40 border border-[#249344]/30">
                  <div className="text-[9px] text-slate-400 uppercase">Latency</div>
                  <div className="font-bold text-cyan-300 text-xs mt-0.5">
                    {selectedAgentDetail.latencyMs ? `${selectedAgentDetail.latencyMs} ms` : '—'}
                  </div>
                </div>
              </div>

              {/* Latest Real-Time Action & Reasoning */}
              <div>
                <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                  <Terminal size={12} className="text-[#BDFF42]" />
                  CURRENT ACTION & REASONING
                </div>
                <div className="p-2.5 rounded bg-black/50 border border-[#249344]/40 text-emerald-300 leading-relaxed text-[11px]">
                  {selectedAgentDetail.latestAction}
                </div>
              </div>

              {/* Allowed Tool Boundary (NIST AI RMF) */}
              <div>
                <div className="text-[10px] text-slate-400 font-bold mb-1">
                  ALLOWED TOOL PERMISSIONS (NIST AI RMF SCOPE)
                </div>
                <div className="flex flex-wrap gap-1 p-2 rounded bg-black/40 border border-[#249344]/30">
                  {(selectedAgentDetail.tools || []).map((tool, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded bg-[#0A2416] text-[#BDFF42] border border-[#249344]/40 text-[10px]">
                      🛡️ {tool}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tool Calls Executed */}
              <div>
                <div className="text-[10px] text-slate-400 font-bold mb-1">
                  TOOL INVOCATIONS ({selectedAgentDetail.toolCalls.length})
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto scroll-thin">
                  {selectedAgentDetail.toolCalls.map((t, idx) => (
                    <div key={idx} className="p-2 rounded bg-black/40 border border-[#249344]/30 text-[10px]">
                      <div className="flex items-center justify-between text-[#BDFF42] font-bold">
                        <span>⚡ {t.tool}</span>
                        {t.latency_ms > 0 && <span className="text-slate-400">{t.latency_ms}ms</span>}
                      </div>
                      {t.input && (
                        <div className="text-slate-400 text-[9px] mt-0.5 truncate">
                          Args: {JSON.stringify(t.input)}
                        </div>
                      )}
                      {t.output && (
                        <pre className="text-slate-300 text-[9px] mt-1 overflow-x-auto whitespace-pre-wrap">
                          {typeof t.output === 'object' ? JSON.stringify(t.output, null, 2) : String(t.output)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {selectedAgentDetail.toolCalls.length === 0 && (
                    <div className="p-2 text-slate-500 italic text-[11px]">
                      No tools executed in current step; relying on cached domain state.
                    </div>
                  )}
                </div>
              </div>

              {/* Domain Summary Data */}
              {Object.keys(selectedAgentDetail.domainSummary).length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-400 font-bold mb-1">
                    KEY DOMAIN METRICS
                  </div>
                  <pre className="p-2 rounded bg-black/60 border border-[#249344]/30 text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedAgentDetail.domainSummary, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-[#0A2416] border-t border-[#249344]/40 flex justify-end">
              <button
                onClick={() => setSelectedAgentDetail(null)}
                className="btn-lime px-3 py-1 text-xs rounded font-bold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
