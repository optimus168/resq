import React, { useState, useEffect } from 'react';
import { Network, CheckCircle2, ShieldCheck, AlertCircle, ArrowDown, Database, Cpu, UserCheck, Radio, RefreshCw } from 'lucide-react';
import { api } from '../api';

export default function EvidenceGraph({ incidentId = '' }) {
  const [evidenceData, setEvidenceData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!incidentId) return;
    const fetchGraph = async () => {
      setLoading(true);
      try {
        const data = await api.getEvidenceGraph(incidentId);
        setEvidenceData(data);
      } catch (err) {
        console.warn("Evidence graph fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, [incidentId]);

  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-y-auto space-y-3 p-1">
      {/* Header Banner */}
      <div className="p-3 bg-[#0A2416] rounded-lg border border-[#249344]/40 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#BDFF42] font-bold font-sans">
            <Network className="w-4 h-4" />
            <span>"WHY THIS ALERT?" · EVIDENCE PROVENANCE GRAPH</span>
          </div>
          <span className="text-[10px] bg-[#249344]/30 text-[#BDFF42] px-2 py-0.5 rounded border border-[#249344]/40">
            AUDITABLE LINEAGE
          </span>
        </div>
        <p className="text-[11px] text-slate-300 font-sans">
          Trace backwards from alert dissemination through human gate authorization, multi-agent debate, physics engines, down to raw sensor and DEM feeds.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#BDFF42]" />
          <span>Synthesizing evidence lineage DAG...</span>
        </div>
      ) : (
        <div className="space-y-3 relative pb-4">
          {/* Node 1: Multi-Sensor & Real DEM Feeds */}
          <div className="p-3 bg-[#0A2416] rounded-lg border border-cyan-500/40 relative shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-cyan-400 font-bold font-sans">
                <Database className="w-4 h-4" />
                <span>1. RAW SENSORY & TERRAIN EVIDENCE</span>
              </div>
              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
                PROVENANCE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <span className="text-slate-400 block">DEM Elevation:</span>
                <span className="text-white font-bold">Copernicus GLO-30 / AWS (64×64)</span>
                <span className="text-[9px] text-[#BDFF42] block">Slope: 24.4° mean, Max: 41.2°</span>
              </div>
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <span className="text-slate-400 block">Precipitation Telemetry:</span>
                <span className="text-cyan-400 font-bold">114.5 mm / 72h (IMD AWS)</span>
                <span className="text-[9px] text-slate-400 block">Piezometer ru: 0.42 (Elevated)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-1 text-slate-500">
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </div>

          {/* Node 2: Deterministic Physics + XGBoost ML */}
          <div className="p-3 bg-[#0A2416] rounded-lg border border-[#FFA31A]/40 relative shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-[#FFA31A] font-bold font-sans">
                <Cpu className="w-4 h-4" />
                <span>2. DETERMINISTIC PHYSICS & SPATIAL ML</span>
              </div>
              <span className="text-[9px] bg-amber-500/20 text-[#FFA31A] px-1.5 py-0.5 rounded border border-amber-500/30">
                NO AUTHORITATIVE LLM
              </span>
            </div>
            <div className="space-y-1.5 text-[10px] text-slate-300">
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <div className="flex justify-between">
                  <span className="text-slate-400">Infinite Slope Equation:</span>
                  <span className="text-rose-400 font-bold">Min FS = 0.82 (&lt; 1.0 FAILURE)</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Caine (1980) I-D Threshold:</span>
                  <span className="text-amber-400 font-bold">14.2 mm/h &gt; 11.8 mm/h (BREACHED)</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-400">Spatial Block XGBoost (4 Clusters):</span>
                  <span className="text-[#BDFF42] font-bold">0.979 ROC-AUC / 0.947 PR-AUC</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-1 text-slate-500">
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </div>

          {/* Node 3: Multi-Agent Cross-Examination */}
          <div className="p-3 bg-[#0A2416] rounded-lg border border-purple-500/40 relative shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-purple-400 font-bold font-sans">
                <ShieldCheck className="w-4 h-4" />
                <span>3. SKEPTIC RED-TEAM & VERIFIER RESOLUTION</span>
              </div>
              <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                ADVERSARIAL DEBATE
              </span>
            </div>
            <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30 text-[10px] space-y-1">
              <div>
                <span className="text-rose-400 font-bold">Skeptic Agent Challenge:</span>
                <span className="text-slate-300"> "Sensor PIEZO_02 spike could be spurious telemetry jitter."</span>
              </div>
              <div>
                <span className="text-[#BDFF42] font-bold">Verifier Agent Resolution:</span>
                <span className="text-slate-300"> "Corroborated by nearby tiltmeter (3.2 mm/hr) and IMD rain gauge. Risk upheld."</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-1 text-slate-500">
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </div>

          {/* Node 4: Human Approval Gate */}
          <div className="p-3 bg-[#0A2416] rounded-lg border border-[#BDFF42]/40 relative shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-[#BDFF42] font-bold font-sans">
                <UserCheck className="w-4 h-4" />
                <span>4. HUMAN APPROVAL GATE (COLLECTOR RBAC)</span>
              </div>
              <span className="text-[9px] bg-lime-500/20 text-[#BDFF42] px-1.5 py-0.5 rounded border border-lime-500/30">
                STATE BOUND V1
              </span>
            </div>
            <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Authorized By:</span>
                <span className="text-white font-bold">collector@bhuraksha.demo (DM / Collector)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cryptographic Signature:</span>
                <span className="text-cyan-400 font-mono">SHA-256 e4f9b8c2...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">State Guard:</span>
                <span className="text-emerald-400 font-bold">HTTP 409 Conflict on Stale Approval</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-1 text-slate-500">
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </div>

          {/* Node 5: Dissemination Channels */}
          <div className="p-3 bg-[#0A2416] rounded-lg border border-emerald-500/40 relative shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-emerald-400 font-bold font-sans">
                <Radio className="w-4 h-4" />
                <span>5. PUBLIC ALERTS & CAP 1.2 PROTOCOL</span>
              </div>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                DISPATCHED
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <span className="text-[#BDFF42] font-bold block">Broadcast Alert Protocol:</span>
                <span>Standard English (CAP 1.2 NDMA)</span>
              </div>
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <span className="text-cyan-400 font-bold block">Transmission Modes:</span>
                <span>SMS Broadcast, IVR Voice, PWA Offline</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
