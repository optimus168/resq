import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Sparkles, AlertTriangle, ArrowRight, HelpCircle, 
  CheckCircle2, Flame, Sliders, Layers, RefreshCw 
} from 'lucide-react';
import { api } from '../api';

export default function SkepticDebate({ incidentId }) {
  const [debates, setDebates] = useState([]);
  const [evidenceGraph, setEvidenceGraph] = useState(null);
  const [whatifQuery, setWhatifQuery] = useState("What if rainfall increases by 50% for 6 hours?");
  const [whatifResult, setWhatifResult] = useState(null);
  const [isLoadingWhatif, setIsLoadingWhatif] = useState(false);

  useEffect(() => {
    if (!incidentId) return;
    api.getDebate(incidentId).then(d => setDebates(d.debates || [])).catch(() => {});
    api.getEvidenceGraph(incidentId).then(g => setEvidenceGraph(g)).catch(() => {});
  }, [incidentId]);

  const handleRunWhatif = async () => {
    if (!incidentId || isLoadingWhatif) return;
    setIsLoadingWhatif(true);
    try {
      const res = await api.runWhatIf(incidentId, {
        query: whatifQuery,
        rain_multiplier: 1.5,
        blocked_roads: ["NH10_KM18"]
      });
      setWhatifResult(res);
    } catch (e) {
      console.warn("Whatif error:", e);
    } finally {
      setIsLoadingWhatif(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A2416] rounded-lg border border-[#249344]/40 overflow-hidden shadow-xl font-mono text-xs">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#06150C] border-b border-[#249344]/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-[#FFA31A]" />
          <span className="font-bold text-white tracking-wider uppercase font-sans">
            SKEPTIC RED-TEAM & WHAT-IF COPILOT
          </span>
        </div>
        <span className="text-[10px] text-[#FFA31A] bg-amber-950/60 px-2 py-0.5 rounded border border-[#FFA31A]/40">
          ADVERSARIAL VERIFICATION
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* What-If Copilot Section */}
        <div className="p-3 bg-black/40 rounded-lg border border-[#249344]/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#BDFF42] font-sans flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              WHAT-IF SCENARIO COPILOT
            </span>
            <span className="text-[10px] text-slate-400">Sandbox Scenario Twin</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={whatifQuery}
              onChange={(e) => setWhatifQuery(e.target.value)}
              placeholder="e.g. What if rainfall doubles for 6 hours?"
              className="flex-1 px-3 py-1.5 rounded bg-[#06150C] border border-[#249344]/40 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-[#BDFF42]"
            />
            <button
              onClick={handleRunWhatif}
              disabled={isLoadingWhatif}
              className="px-3 py-1.5 rounded bg-[#BDFF42] text-[#06150C] font-bold text-xs hover:bg-lime-300 disabled:opacity-40 transition-colors shadow"
            >
              {isLoadingWhatif ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>

          {whatifResult && (
            <div className="p-2.5 rounded bg-[#06150C] border border-cyan-500/40 text-[11px] space-y-1.5">
              <div className="text-cyan-400 font-bold font-sans">
                DELTA SIMULATION COMPARISON (BASELINE vs WHAT-IF +50%):
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>Failed Cells: <span className="text-rose-400 font-bold">{whatifResult.simulation_delta.failed_cells_whatif}</span> (Δ +{whatifResult.simulation_delta.delta_failed_cells})</div>
                <div>Runout Volume: <span className="text-amber-400 font-bold">{whatifResult.simulation_delta.volume_released_m3?.toLocaleString()} m³</span></div>
              </div>
              <div className="text-[#9FD8A8] pt-1 border-t border-[#249344]/20">
                💡 Re-planning Advisory: {whatifResult.recommended_action}
              </div>
            </div>
          )}
        </div>

        {/* Structured Skeptic vs Verifier Debate Stream */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-[#FFA31A] font-sans flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-[#FFA31A]" />
            STRUCTURED ADVERSARIAL DEBATE (SKEPTIC ⚔️ VERIFIER)
          </div>

          {debates.map((d, i) => (
            <div key={i} className="p-3 rounded-lg bg-black/40 border border-[#FFA31A]/30 space-y-2">
              <div className="text-white font-sans font-semibold text-xs flex items-center justify-between">
                <span>[CLAIM] {d.claim}</span>
                <span className="text-[10px] text-slate-400 font-mono">Stage {i + 1}</span>
              </div>

              <div className="p-2 rounded bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-300 space-y-1">
                <div className="font-bold text-rose-400 uppercase text-[10px]">⚠️ Skeptic Challenge:</div>
                <div>{d.challenge}</div>
              </div>

              <div className="p-2 rounded bg-[#06150C] border border-[#249344]/30 text-[11px] text-[#9FD8A8] space-y-1">
                <div className="font-bold text-[#BDFF42] uppercase text-[10px]">🔍 Evidence Audited:</div>
                <div>{d.evidence_checked}</div>
              </div>

              <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/40 text-[11px] text-emerald-300 space-y-1">
                <div className="font-bold text-emerald-400 uppercase text-[10px]">🛡️ Verifier Arbitration:</div>
                <div>{d.resolution}</div>
                <div className="text-[10px] text-[#BDFF42] mt-0.5">Impact: {d.confidence_impact}</div>
              </div>
            </div>
          ))}
        </div>

        {/* "Why This Alert?" Evidence Provenance Lineage */}
        {evidenceGraph && (
          <div className="p-3 bg-black/40 rounded-lg border border-[#249344]/30 space-y-2">
            <div className="text-xs font-bold text-[#BDFF42] font-sans flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              "WHY THIS ALERT?" EVIDENCE PROVENANCE LINEAGE
            </div>
            <div className="space-y-2 text-[11px]">
              {evidenceGraph.lineage?.map((st, idx) => (
                <div key={idx} className="p-2 rounded bg-[#06150C] border border-[#249344]/20 space-y-1">
                  <div className="text-white font-semibold">{st.stage}</div>
                  <div className="text-slate-400 pl-2 text-[10px] space-y-0.5">
                    {st.sources?.map((s, si) => (
                      <div key={si}>• {s.name} ({s.freshness})</div>
                    ))}
                    {st.tools?.map((t, ti) => (
                      <div key={ti}>• {t.name} [{t.type}] → {t.output}</div>
                    ))}
                    {st.agents?.map((a, ai) => (
                      <div key={ai}>• {a.agent}: {a.conclusion}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
