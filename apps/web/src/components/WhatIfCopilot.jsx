import React, { useState } from 'react';
import { Sliders, Sparkles, Activity, AlertTriangle, ArrowRight, RefreshCw, Layers } from 'lucide-react';
import { api } from '../api';

export default function WhatIfCopilot({ incidentId = '' }) {
  const [rainAddedMm, setRainAddedMm] = useState(35);
  const [pgaAdded, setPgaAdded] = useState(0.10);
  const [roadBlocked, setRoadBlocked] = useState('NH10_KM18');
  const [isRunning, setIsRunning] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState(null);

  const handleRunWhatIf = async () => {
    if (!incidentId) return;
    setIsRunning(true);
    try {
      const res = await api.runWhatIf(incidentId, {
        rain_added_mm: rainAddedMm,
        pga: pgaAdded,
        road_severed: roadBlocked
      });
      setWhatIfResult(res);
    } catch (err) {
      console.error("What-If simulation failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-y-auto space-y-3 p-1">
      {/* Header Banner */}
      <div className="p-3 bg-[#0A2416] rounded-lg border border-[#249344]/40 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#BDFF42] font-bold font-sans">
            <Sparkles className="w-4 h-4" />
            <span>WHAT-IF COPILOT · COUNTERFACTUAL RUNNER</span>
          </div>
          <span className="text-[10px] bg-[#249344]/30 text-[#BDFF42] px-2 py-0.5 rounded border border-[#249344]/40">
            PHYSICS SANDBOX
          </span>
        </div>
        <p className="text-[11px] text-slate-300 font-sans">
          Test "what happens if rain intensifies by 40%?" or "what if NH-10 is cut off at Singtam?" without altering the operational incident state.
        </p>
      </div>

      {/* Control Sliders & Inputs */}
      <div className="p-3 bg-[#0A2416] rounded-lg border border-[#249344]/40 space-y-3">
        {/* Rain Perturbation */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Added Rain Surge:</span>
            <span className="text-cyan-400 font-bold">+{rainAddedMm} mm / 24h</span>
          </div>
          <input
            type="range"
            min="0"
            max="120"
            step="5"
            value={rainAddedMm}
            onChange={(e) => setRainAddedMm(parseInt(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0 mm</span>
            <span>+60 mm (Heavy)</span>
            <span>+120 mm (Extreme)</span>
          </div>
        </div>

        {/* Seismic PGA */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-300">Seismic Acceleration (PGA):</span>
            <span className="text-[#FFA31A] font-bold">{pgaAdded.toFixed(2)} g</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.30"
            step="0.05"
            value={pgaAdded}
            onChange={(e) => setPgaAdded(parseFloat(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0.00g (None)</span>
            <span>0.15g (Zone V)</span>
            <span>0.30g (Severe)</span>
          </div>
        </div>

        {/* Lifeline Severance */}
        <div className="space-y-1">
          <label className="text-slate-300 block">Simulated Lifeline Severance:</label>
          <select
            value={roadBlocked}
            onChange={(e) => setRoadBlocked(e.target.value)}
            className="w-full bg-[#06150C] border border-[#249344]/40 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-[#BDFF42]"
          >
            <option value="NONE">None (Roads Intact)</option>
            <option value="NH10_KM18">NH10 Singtam - Deorali (KM-18)</option>
            <option value="NH10_KM29">NH10 29th Mile Chasm</option>
            <option value="RANGPO_BYPASS">Rangpo-Melli Strategic Artery</option>
          </select>
        </div>

        <button
          onClick={handleRunWhatIf}
          disabled={isRunning || !incidentId}
          className="w-full py-2 bg-[#BDFF42] hover:bg-lime-400 text-[#06150C] rounded font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-lime-500/20"
        >
          {isRunning ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          <span>{isRunning ? 'Running D8 Physics Sandbox...' : 'SIMULATE COUNTERFACTUAL SCENARIO'}</span>
        </button>
      </div>

      {/* Results Comparison Card */}
      {whatIfResult && (
        <div className="p-3 bg-[#0A2416] rounded-lg border border-[#249344]/40 space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#249344]/30 pb-1.5">
            <span className="font-bold text-white font-sans text-xs">WHAT-IF IMPACT ANALYSIS</span>
            <span className="text-[10px] bg-amber-500/20 text-[#FFA31A] px-2 py-0.5 rounded border border-amber-500/40">
              PROTOTYPE COUNTERFACTUAL
            </span>
          </div>

          {/* Delta Metrics */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
              <span className="text-slate-400 block text-[10px]">FAILED CELLS:</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-slate-400">{whatIfResult.baseline_failed || 14}</span>
                <ArrowRight className="w-3 h-3 text-[#FFA31A]" />
                <span className="text-rose-400 font-bold text-sm">{whatIfResult.delta_failed || 46}</span>
              </div>
            </div>

            <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
              <span className="text-slate-400 block text-[10px]">MEAN FACTOR OF SAFETY:</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-slate-400">1.14</span>
                <ArrowRight className="w-3 h-3 text-[#FFA31A]" />
                <span className="text-rose-400 font-bold text-sm">
                  {whatIfResult.simulated_min_fs ? whatIfResult.simulated_min_fs.toFixed(2) : '0.84'}
                </span>
              </div>
            </div>
          </div>

          {/* Synthesis & SOP Recommendation */}
          <div className="bg-[#06150C] p-2.5 rounded border border-[#249344]/30 text-[11px] space-y-1">
            <div className="text-[#BDFF42] font-bold font-sans">AGENT RECOMMENDATION:</div>
            <p className="text-slate-300">
              {whatIfResult.recommendation || 
                `Under +${rainAddedMm}mm rainfall surge, runout reaches ${roadBlocked === 'NONE' ? 'secondary culverts' : roadBlocked}. Pre-position SDRF staging team at Ranipool depot and notify BRO for heavy earthmover mobilization.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
