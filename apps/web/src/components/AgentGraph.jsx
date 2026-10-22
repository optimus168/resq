import React, { useState } from 'react';
import { 
  Network, Cpu, CheckCircle2, Clock, AlertTriangle, ShieldCheck, 
  Terminal, ChevronRight, Activity, Zap, Layers, Radio, Mountain,
  Smartphone, TrendingUp, Compass, Truck, FileText, Send, Bot
} from 'lucide-react';

const AGENT_NODES = [
  { id: 'orchestrator', label: 'Supervisor', tier: 'supervisor', x: 280, y: 35, icon: '👑', role: 'DAG Orchestrator & Replanner' },
  { id: 'sentinel', label: 'Sentinel', tier: 'data', x: 80, y: 115, icon: '📡', role: 'Telemetry & Rainfall Monitor' },
  { id: 'terrain', label: 'Terrain Geo', tier: 'data', x: 280, y: 115, icon: '⛰️', role: 'AWS DEM & D8 Topography' },
  { id: 'field_intel', label: 'Field Intel', tier: 'data', x: 480, y: 115, icon: '📱', role: 'Citizen Reports & Injection Triage' },
  
  { id: 'risk', label: 'Risk Analyst', tier: 'compute', x: 80, y: 205, icon: '🧠', role: 'Susceptibility & Physics Fusion' },
  { id: 'simulation', label: 'Simulation Twin', tier: 'compute', x: 280, y: 205, icon: '🌊', role: 'Coupled Hydro-Runout Engine' },
  { id: 'learner', label: 'Learner', tier: 'compute', x: 480, y: 205, icon: '📈', role: 'Dynamic Cohesion Calibration' },
  
  { id: 'verifier', label: 'Verifier Gate', tier: 'gate', x: 280, y: 295, icon: '🛡️', role: 'Evidence & Assumption Ledger' },
  
  { id: 'impact', label: 'Impact / Exposure', tier: 'response', x: 140, y: 385, icon: '🏘️', role: 'Asset, Road & Population Exposure' },
  { id: 'route', label: 'Route & Access', tier: 'response', x: 420, y: 385, icon: '🛣️', role: 'Lifeline Detour & Clearance' },
  
  { id: 'resource', label: 'Resource Allocator', tier: 'decision', x: 280, y: 465, icon: '🚒', role: 'NDRF Teams & Shelter Staging' },
  
  { id: 'planner', label: 'Response Planner', tier: 'decision', x: 280, y: 545, icon: '📋', role: 'Versioned SOP Action Generator' },
  
  { id: 'dispatcher', label: 'Dispatcher', tier: 'dispatch', x: 140, y: 625, icon: '📢', role: 'Multilingual Warning Broadcast' },
  { id: 'assistant', label: 'Mission Assistant', tier: 'dispatch', x: 420, y: 625, icon: '🤖', role: 'Grounded SOP Citations & Q&A' },
];

const AGENT_EDGES = [
  ['orchestrator', 'sentinel'],
  ['orchestrator', 'terrain'],
  ['orchestrator', 'field_intel'],
  ['sentinel', 'simulation'],
  ['terrain', 'simulation'],
  ['field_intel', 'learner'],
  ['learner', 'simulation'],
  ['simulation', 'risk'],
  ['risk', 'verifier'],
  ['verifier', 'impact'],
  ['verifier', 'route'],
  ['impact', 'resource'],
  ['route', 'resource'],
  ['resource', 'planner'],
  ['planner', 'dispatcher'],
  ['dispatcher', 'orchestrator'],
  ['planner', 'assistant']
];

const AGENT_TOOLS_MAP = {
  orchestrator: ['state.read', 'workflow.schedule', 'replan.route'],
  sentinel: ['weather.get', 'sensor.latest', 'datasource.health'],
  terrain: ['terrain.features', 'gis.query', 'aws_dem.fetch'],
  field_intel: ['report.get', 'report.triage', 'report.dedupe'],
  learner: ['sim.calibrate', 'feedback.log', 'threshold.tune'],
  simulation: ['sim.run', 'sim.detect', 'voellmy.shallow_water'],
  risk: ['risk.assess', 'factor_of_safety.calc', 'twi.compute'],
  verifier: ['evidence.check', 'assumptions.list', 'assumptions.invalidate'],
  impact: ['gis.exposure', 'osm.buildings_query', 'population.density'],
  route: ['route.compute', 'himalayan_lifeline.cascade', 'detour.find'],
  resource: ['resource.query', 'resource.reserve', 'team.match'],
  planner: ['plan.create', 'plan.diff', 'ndma_sop.synthesize'],
  dispatcher: ['alert.draft', 'translate.draft', 'multilingual.dispatch'],
  assistant: ['state.read', 'sop.search', 'citations.extract'],
};

const AGENT_ALIASES = {
  terrain: ['terrain', 'terrain_geo'],
  risk: ['risk', 'risk_analyst'],
  impact: ['impact', 'impact_exposure'],
  route: ['route', 'infrastructure'],
  planner: ['planner', 'response_planner'],
  dispatcher: ['dispatcher', 'alert_comm', 'alert'],
  learner: ['learner', 'continuous_learner'],
  resource: ['resource', 'resource_allocator'],
  assistant: ['assistant', 'ask', 'chat'],
  orchestrator: ['orchestrator', 'supervisor']
};

export default function AgentGraph({ 
  activeAgents = [], 
  incidentState = null, 
  status = null, 
  events = [], 
  incident = null,
  onSelectAgent = null,
  height = null
}) {
  const [selectedAgent, setSelectedAgent] = useState('sentinel');
  const [showDrawer, setShowDrawer] = useState(true);

  const activeInc = incidentState || incident || null;
  const statusMap = status || activeInc?.agent_status || {};
  const agentsDetailMap = activeInc?.agents_detail || {};
  const eventList = events.length > 0 ? events : (activeInc?.agent_trace || []);

  const getAgentDetail = (id) => {
    // 1. Direct from agents_detail map
    if (agentsDetailMap[id]) return agentsDetailMap[id];
    // 2. Search by alias
    const aliases = AGENT_ALIASES[id] || [id];
    for (const al of aliases) {
      if (agentsDetailMap[al]) return agentsDetailMap[al];
    }
    // 3. Search in agents array
    if (Array.isArray(activeInc?.agents)) {
      const found = activeInc.agents.find(a => aliases.includes(a.id));
      if (found) return found;
    }
    return null;
  };

  const getNodeStatus = (id) => {
    const detail = getAgentDetail(id);
    if (detail?.status) {
      if (detail.status === 'working') return 'running';
      if (['done', 'completed', 'ready'].includes(detail.status)) return 'completed';
      if (detail.status === 'waiting') return 'waiting';
      if (detail.status === 'skipped') return 'skipped';
      return detail.status;
    }

    const aliases = AGENT_ALIASES[id] || [id];
    for (const al of aliases) {
      if (statusMap[al]) {
        const s = statusMap[al];
        if (s === 'working') return 'running';
        if (['done', 'completed', 'ready'].includes(s)) return 'completed';
        if (s === 'waiting') return 'waiting';
        if (s === 'skipped') return 'skipped';
        return s;
      }
    }

    if (activeAgents.some(a => aliases.includes(a.toLowerCase()))) return 'running';

    const matchingEvts = eventList.filter(e => aliases.includes(e.agent?.toLowerCase()));
    if (matchingEvts.length > 0) {
      const last = matchingEvts[matchingEvts.length - 1];
      if (last.type === 'start') return 'running';
      if (last.type === 'done') return 'completed';
      if (last.type === 'waiting') return 'waiting';
      if (last.type === 'skipped') return 'skipped';
      return 'completed';
    }

    if (id === 'assistant') return 'completed';
    return 'idle';
  };

  const selectedData = AGENT_NODES.find(n => n.id === selectedAgent) || AGENT_NODES[0];
  const selectedDetail = getAgentDetail(selectedAgent);
  const selectedAliases = AGENT_ALIASES[selectedAgent] || [selectedAgent];
  const agentEvents = eventList.filter(t => selectedAliases.includes(t.agent?.toLowerCase()));
  const latestEvent = agentEvents[agentEvents.length - 1];

  const currentAction = selectedDetail?.latest_action 
    || latestEvent?.message 
    || (latestEvent?.tool ? `Invoked tool: ${latestEvent.tool}` : null)
    || (getNodeStatus(selectedAgent) === 'running' ? 'Active DAG execution in progress' : 'Standing by in DAG workflow');

  const currentConfidence = selectedDetail?.confidence != null
    ? selectedDetail.confidence
    : (latestEvent?.confidence != null ? latestEvent.confidence : (getNodeStatus(selectedAgent) === 'completed' ? 0.85 : null));

  const currentLatency = selectedDetail?.latency_ms 
    ?? (agentEvents.find(e => e.latency_ms)?.latency_ms || 0);

  const toolCalls = selectedDetail?.tool_calls || agentEvents.filter(e => e.type === 'tool').map(e => ({
    tool: e.tool,
    latency_ms: e.latency_ms,
    output: e.output,
    input: e.input,
    ts: e.ts
  }));

  const domainSummary = selectedDetail?.domain_summary || {};

  return (
    <div 
      className="flex flex-col h-full bg-[#0A2416] rounded-lg border border-[#249344]/40 overflow-hidden shadow-xl"
      style={height ? { height: `${height}px` } : {}}
    >
      {/* Panel Header */}
      <div className="px-3.5 py-2 bg-[#06150C] border-b border-[#249344]/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[#BDFF42]" />
          <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            14-AGENT LANGGRAPH DAG
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Done
          </span>
          <span className="flex items-center gap-1 text-[#BDFF42]">
            <span className="w-2 h-2 rounded-full bg-[#BDFF42] animate-ping"></span> Active
          </span>
          <button
            onClick={() => setShowDrawer(!showDrawer)}
            className="text-[#9FD8A8] hover:text-white ml-2 text-[10px] underline md:hidden"
          >
            {showDrawer ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* SVG Graph View */}
        <div className="flex-1 overflow-auto p-3 flex items-center justify-center relative bg-grid-pattern min-h-[220px]">
          <svg viewBox="0 0 560 670" className="w-full max-w-[560px] h-auto aspect-[560/670] drop-shadow-md select-none">
            <defs>
              <linearGradient id="edgeGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#249344" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#BDFF42" stopOpacity="0.9" />
              </linearGradient>
              <filter id="neonGlowActive">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Connecting Edges */}
            {AGENT_EDGES.map(([src, dst], idx) => {
              const srcNode = AGENT_NODES.find(n => n.id === src);
              const dstNode = AGENT_NODES.find(n => n.id === dst);
              if (!srcNode || !dstNode) return null;
              
              const isSrcActive = getNodeStatus(src) === 'completed' || getNodeStatus(src) === 'running';

              return (
                <g key={`edge-${idx}`}>
                  <line
                    x1={srcNode.x}
                    y1={srcNode.y + 15}
                    x2={dstNode.x}
                    y2={dstNode.y - 15}
                    stroke={isSrcActive ? '#249344' : '#16572a'}
                    strokeWidth={isSrcActive ? 1.75 : 1}
                    strokeDasharray={isSrcActive ? 'none' : '4 3'}
                    opacity={isSrcActive ? 0.95 : 0.35}
                  />
                  {isSrcActive && (
                    <circle r="2.2" fill="#BDFF42">
                      <animateMotion
                        path={`M${srcNode.x},${srcNode.y + 15} L${dstNode.x},${dstNode.y - 15}`}
                        dur="2.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Agent Nodes */}
            {AGENT_NODES.map((node) => {
              const status = getNodeStatus(node.id);
              const isSelected = selectedAgent === node.id;

              let strokeColor = '#249344';
              let fillColor = '#06150C';
              let glowFilter = '';

              if (status === 'running') {
                strokeColor = '#BDFF42';
                fillColor = '#0f3320';
                glowFilter = 'url(#neonGlowActive)';
              } else if (status === 'completed') {
                strokeColor = '#10B981';
                fillColor = '#0A2416';
              } else if (status === 'waiting') {
                strokeColor = '#FFA31A';
                fillColor = '#241a06';
              } else if (status === 'skipped') {
                strokeColor = '#475569';
                fillColor = '#0b111e';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-transform duration-150 hover:scale-105"
                  onClick={() => {
                    setSelectedAgent(node.id);
                    if (onSelectAgent) onSelectAgent(node.id);
                  }}
                >
                  <rect
                    x="-55"
                    y="-16"
                    width="110"
                    height="32"
                    rx="6"
                    fill={fillColor}
                    stroke={isSelected ? '#BDFF42' : strokeColor}
                    strokeWidth={isSelected ? 2.2 : 1.2}
                    filter={glowFilter}
                  />
                  <text
                    x="-45"
                    y="4"
                    fontSize="11"
                    className="select-none"
                  >
                    {node.icon}
                  </text>
                  <text
                    x="-24"
                    y="4"
                    fill={isSelected ? '#BDFF42' : '#FFFFFF'}
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="Inter, sans-serif"
                    className="select-none"
                  >
                    {node.label}
                  </text>

                  {/* Status Indicator Dot */}
                  <circle
                    cx="45"
                    cy="0"
                    r="3.5"
                    fill={
                      status === 'running' ? '#BDFF42' :
                      status === 'completed' ? '#10B981' :
                      status === 'waiting' ? '#FFA31A' :
                      status === 'skipped' ? '#64748B' : '#16572a'
                    }
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Agent Inspector Drawer */}
        {showDrawer && (
          <div className="w-full md:w-80 bg-[#06150C]/95 border-t md:border-t-0 md:border-l border-[#249344]/30 p-3 flex flex-col font-mono text-xs overflow-y-auto shrink-0 scroll-thin">
            <div className="flex items-center gap-2 border-b border-[#249344]/30 pb-2 mb-2.5">
              <span className="text-xl">{selectedData?.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white font-sans truncate">{selectedData?.label}</div>
                <div className="text-[10px] text-[#9FD8A8] uppercase tracking-wider truncate">{selectedData?.role}</div>
              </div>
            </div>

            <div className="space-y-2.5 flex-1">
              {/* Telemetry Matrix */}
              <div className="p-2 rounded bg-black/40 border border-[#249344]/30 space-y-1 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${
                    getNodeStatus(selectedAgent) === 'running' ? 'bg-[#BDFF42]/20 text-[#BDFF42]' :
                    getNodeStatus(selectedAgent) === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    getNodeStatus(selectedAgent) === 'waiting' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {getNodeStatus(selectedAgent)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Latency:</span>
                  <span className="text-white font-mono">
                    {currentLatency ? `${currentLatency} ms` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Confidence:</span>
                  <span className="text-[#BDFF42] font-mono">
                    {currentConfidence != null ? `${(currentConfidence * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* What It's Doing / Action */}
              <div>
                <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1 font-bold uppercase">
                  <Terminal className="w-3 h-3 text-[#BDFF42]" />
                  What It Is Doing
                </div>
                <div className="p-2 rounded bg-black/50 border border-[#249344]/30 text-emerald-300 text-[11px] leading-relaxed">
                  {currentAction}
                </div>
              </div>

              {/* Domain Specific Metrics */}
              {Object.keys(domainSummary).length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase">
                    Domain Metrics
                  </div>
                  <pre className="p-2 rounded bg-black/60 border border-[#249344]/30 text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(domainSummary, null, 2)}
                  </pre>
                </div>
              )}

              {/* Allowed Tools */}
              <div>
                <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase">
                  Allowed Tools & Invocations
                </div>
                <div className="p-2 rounded bg-black/40 border border-[#249344]/30 text-[11px] text-[#9FD8A8] space-y-1 font-mono">
                  {(AGENT_TOOLS_MAP[selectedAgent] || ['tool.invoke']).map((t, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="text-[#BDFF42]">•</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Latest Tool Calls & Output */}
              <div>
                <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase">
                  Tool Invocations ({toolCalls.length})
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto scroll-thin">
                  {toolCalls.map((t, idx) => (
                    <div key={idx} className="p-1.5 rounded bg-black/60 border border-[#249344]/30 text-[10px]">
                      <div className="flex justify-between text-[#BDFF42]">
                        <span>⚡ {t.tool}</span>
                        {t.latency_ms > 0 && <span className="text-slate-400">{t.latency_ms}ms</span>}
                      </div>
                      {t.output && (
                        <pre className="text-slate-300 text-[9px] mt-0.5 overflow-x-auto">
                          {typeof t.output === 'object' ? JSON.stringify(t.output, null, 2) : String(t.output)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {toolCalls.length === 0 && (
                    <div className="p-1.5 text-slate-500 italic text-[10px]">
                      No tool calls recorded in current pass.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
