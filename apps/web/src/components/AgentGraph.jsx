import React, { useState } from 'react';
import { 
  Network, Cpu, CheckCircle2, Clock, AlertTriangle, ShieldCheck, 
  Terminal, ChevronRight, Activity, Zap, Layers 
} from 'lucide-react';

const AGENT_NODES = [
  { id: 'orchestrator', label: 'Orchestrator', tier: 'supervisor', x: 280, y: 30, icon: '👑', role: 'Supervisor & DAG Planner' },
  { id: 'sentinel', label: 'Sentinel', tier: 'data', x: 80, y: 110, icon: '📡', role: 'Telemetry & Rainfall Monitor' },
  { id: 'terrain_geo', label: 'Terrain Geo', tier: 'data', x: 280, y: 110, icon: '⛰️', role: 'AWS DEM & D8 Topography' },
  { id: 'field_intel', label: 'Field Intel', tier: 'data', x: 480, y: 110, icon: '📱', role: 'Citizen Reports & Vision Triage' },
  
  { id: 'risk_analyst', label: 'Risk Analyst', tier: 'compute', x: 160, y: 190, icon: '🧠', role: 'Deterministic Risk Fusion & FS' },
  { id: 'simulation', label: 'Simulation Twin', tier: 'compute', x: 400, y: 190, icon: '🌊', role: 'Coupled Hydro-Runout Engine' },
  
  { id: 'verifier', label: 'Verifier Gate', tier: 'gate', x: 280, y: 270, icon: '🛡️', role: 'Assumption Ledger & Replan Guard' },
  
  { id: 'impact_exposure', label: 'Exposure Agent', tier: 'response', x: 120, y: 350, icon: '🏘️', role: 'OSM Asset & Population Counts' },
  { id: 'infrastructure', label: 'Infrastructure', tier: 'response', x: 440, y: 350, icon: '🛣️', role: 'Road Network & Rerouting' },
  
  { id: 'response_planner', label: 'Response Planner', tier: 'decision', x: 280, y: 430, icon: '📋', role: 'NDMA SOP Action Plan Generator' },
  
  { id: 'alert_comm', label: 'Alert Comm', tier: 'dispatch', x: 120, y: 510, icon: '📢', role: 'Multilingual Warning Drafts' },
  { id: 'dispatcher', label: 'Dispatcher', tier: 'dispatch', x: 440, y: 510, icon: '🚀', role: 'CAP/SACHET Multi-Channel Delivery' },
  
  { id: 'audit_compliance', label: 'Audit Ledger', tier: 'ledger', x: 200, y: 590, icon: '🔒', role: 'SHA-256 Cryptographic Chain' },
  { id: 'continuous_learner', label: 'Learner', tier: 'ledger', x: 360, y: 590, icon: '📈', role: 'Threshold Calibration & Tuning' },
];

const AGENT_EDGES = [
  ['orchestrator', 'sentinel'],
  ['orchestrator', 'terrain_geo'],
  ['orchestrator', 'field_intel'],
  ['sentinel', 'risk_analyst'],
  ['terrain_geo', 'risk_analyst'],
  ['terrain_geo', 'simulation'],
  ['risk_analyst', 'simulation'],
  ['risk_analyst', 'verifier'],
  ['simulation', 'verifier'],
  ['field_intel', 'verifier'],
  ['verifier', 'impact_exposure'],
  ['verifier', 'infrastructure'],
  ['impact_exposure', 'response_planner'],
  ['infrastructure', 'response_planner'],
  ['response_planner', 'alert_comm'],
  ['response_planner', 'dispatcher'],
  ['response_planner', 'audit_compliance'],
  ['dispatcher', 'continuous_learner']
];

export default function AgentGraph({ activeAgents = [], incidentState = null, onSelectAgent }) {
  const [selectedAgent, setSelectedAgent] = useState('verifier');

  // Determine node status
  const getNodeStatus = (id) => {
    if (activeAgents.includes(id)) return 'running';
    if (incidentState?.agent_trace?.some(t => t.agent === id)) return 'completed';
    return 'idle';
  };

  const selectedData = AGENT_NODES.find(n => n.id === selectedAgent);
  const agentTraces = incidentState?.agent_trace?.filter(t => t.agent === selectedAgent) || [];

  return (
    <div className="flex flex-col h-full bg-[#0A2416] rounded-lg border border-[#249344]/40 overflow-hidden shadow-xl">
      {/* Panel Header */}
      <div className="px-4 py-2.5 bg-[#06150C] border-b border-[#249344]/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[#BDFF42]" />
          <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            14-AGENT LANGGRAPH DAG
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed
          </span>
          <span className="flex items-center gap-1 text-[#BDFF42]">
            <span className="w-2 h-2 rounded-full bg-[#BDFF42] animate-ping"></span> Active
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* SVG Graph View */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-grid-pattern">
          <svg className="w-[560px] h-[640px] drop-shadow-md select-none">
            <defs>
              <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#249344" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#BDFF42" stopOpacity="0.8" />
              </linearGradient>
              <filter id="neonGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
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
                    opacity={isSrcActive ? 0.9 : 0.4}
                  />
                  {isSrcActive && (
                    <circle r="2" fill="#BDFF42">
                      <animateMotion
                        path={`M${srcNode.x},${srcNode.y + 15} L${dstNode.x},${dstNode.y - 15}`}
                        dur="3s"
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
                glowFilter = 'url(#neonGlow)';
              } else if (status === 'completed') {
                strokeColor = '#10B981';
                fillColor = '#0A2416';
              }

              if (isSelected) {
                strokeColor = '#BDFF42';
                fillColor = '#164228';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer transition-transform hover:scale-105"
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
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 2 : 1.2}
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
                      status === 'completed' ? '#10B981' : '#16572a'
                    }
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Agent Inspector Drawer */}
        <div className="w-full md:w-72 bg-[#06150C]/90 border-t md:border-t-0 md:border-l border-[#249344]/30 p-3.5 flex flex-col font-mono text-xs overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-[#249344]/30 pb-2 mb-3">
            <span className="text-xl">{selectedData?.icon}</span>
            <div>
              <div className="text-sm font-bold text-white font-sans">{selectedData?.label}</div>
              <div className="text-[10px] text-[#9FD8A8] uppercase tracking-wider">{selectedData?.role}</div>
            </div>
          </div>

          <div className="space-y-3 flex-1">
            <div>
              <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1 font-bold">
                <Terminal className="w-3 h-3 text-[#BDFF42]" />
                EXECUTION STATE
              </div>
              <div className="p-2 rounded bg-black/40 border border-[#249344]/30 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-bold uppercase ${
                    getNodeStatus(selectedAgent) === 'running' ? 'text-[#BDFF42]' :
                    getNodeStatus(selectedAgent) === 'completed' ? 'text-emerald-400' : 'text-slate-500'
                  }`}>
                    {getNodeStatus(selectedAgent)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latency:</span>
                  <span className="text-white">
                    {agentTraces[0]?.latency_ms ? `${agentTraces[0].latency_ms} ms` : '18ms (stub)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Confidence:</span>
                  <span className="text-[#BDFF42]">0.96 / 1.00</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 mb-1 font-bold">
                ALLOWED TOOLS & SCOPE
              </div>
              <div className="p-2 rounded bg-black/40 border border-[#249344]/30 text-[11px] text-[#9FD8A8] space-y-1">
                <div>• infinite_slope.assess</div>
                <div>• weather.get_precip</div>
                <div>• assumption.invalidate</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-400 mb-1 font-bold">
                LATEST OUTPUT RECORD
              </div>
              <pre className="p-2 rounded bg-black/60 border border-[#249344]/30 text-[10px] text-slate-300 max-h-40 overflow-auto whitespace-pre-wrap">
                {agentTraces.length > 0
                  ? JSON.stringify(agentTraces[0].output || agentTraces[0], null, 2)
                  : `{\n  "agent": "${selectedAgent}",\n  "status": "READY",\n  "verified": true\n}`
                }
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
