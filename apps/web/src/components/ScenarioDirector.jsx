import React, { useState } from 'react';
import { 
  Sliders, CloudRain, AlertOctagon, FileSpreadsheet, Activity, 
  WifiOff, Play, RotateCcw, Check, Sparkles, FastForward 
} from 'lucide-react';

export default function ScenarioDirector({ 
  onTriggerEvent, 
  onReset, 
  onRunAutoDemo,
  isAutoDemoRunning = false,
  incidentId = ''
}) {
  const [activeAction, setActiveAction] = useState(null);

  const handleAction = async (name, fn) => {
    setActiveAction(name);
    try {
      await fn();
    } finally {
      setTimeout(() => setActiveAction(null), 1200);
    }
  };

  return (
    <div className="bg-[#0A2416] rounded-lg border border-[#249344]/40 p-3.5 shadow-xl space-y-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#249344]/30 pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#BDFF42]" />
          <span className="text-xs font-bold text-white tracking-wider uppercase font-sans">
            SCENARIO DIRECTOR · DEMO CONTROLLER
          </span>
        </div>
        <span className="text-[10px] text-[#FFA31A] font-semibold px-2 py-0.5 rounded bg-[#FFA31A]/20 border border-[#FFA31A]/40">
          OFFLINE DETERMINISTIC
        </span>
      </div>

      {/* Auto-Demo Hero Button */}
      <div>
        <button
          onClick={onRunAutoDemo}
          disabled={isAutoDemoRunning}
          className={`w-full py-2.5 px-4 rounded-md font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
            isAutoDemoRunning 
              ? 'bg-[#FFA31A] text-black animate-pulse' 
              : 'bg-gradient-to-r from-[#BDFF42] to-emerald-400 text-[#06150C] hover:brightness-110 shadow-lime-500/20'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isAutoDemoRunning ? 'AUTO-DEMO IN PROGRESS (3-MIN STORY)...' : 'RUN ONE-CLICK AUTO DEMO (FULL STORY)'}</span>
        </button>
      </div>

      {/* Manual Perturbation Triggers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {/* Reset */}
        <button
          onClick={() => handleAction('reset', onReset)}
          className="p-2 rounded bg-[#06150C] border border-[#249344]/40 text-[#9FD8A8] hover:text-white hover:border-[#BDFF42] flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${activeAction === 'reset' ? 'animate-spin' : ''}`} />
          <span>Reset Baseline</span>
        </button>

        {/* Rain Escalation */}
        <button
          onClick={() => handleAction('rain', () => onTriggerEvent('RAIN_ESCALATION', { delta: 0.6, mm_added: 65 }))}
          className="p-2 rounded bg-[#06150C] border border-[#249344]/40 text-cyan-300 hover:text-white hover:border-cyan-400 flex items-center gap-1.5 transition-colors"
        >
          <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
          <span>Escalate Rain (+65mm)</span>
        </button>

        {/* Block Road */}
        <button
          onClick={() => handleAction('road', () => onTriggerEvent('ROAD_BLOCKED', { road_id: 'NH10_KM18', segment: 'KM-18 Singtam-Deorali' }))}
          className="p-2 rounded bg-[#06150C] border border-[#249344]/40 text-amber-300 hover:text-white hover:border-amber-400 flex items-center gap-1.5 transition-colors"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
          <span>Block NH10 KM-18</span>
        </button>

        {/* Crack Report */}
        <button
          onClick={() => handleAction('report', () => onTriggerEvent('NEW_REPORT', { category: 'cracks', width_cm: 15, loc: 'Deorali slope' }))}
          className="p-2 rounded bg-[#06150C] border border-[#249344]/40 text-purple-300 hover:text-white hover:border-purple-400 flex items-center gap-1.5 transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
          <span>Inject Crack Report</span>
        </button>

        {/* Piezometer Anomaly */}
        <button
          onClick={() => handleAction('sensor', () => onTriggerEvent('SENSOR_ANOMALY', { sensor_id: 'PIEZO_DEORALI_02', ru_spike: 0.48 }))}
          className="p-2 rounded bg-[#06150C] border border-[#249344]/40 text-rose-300 hover:text-white hover:border-rose-400 flex items-center gap-1.5 transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-rose-400" />
          <span>Piezometer Spike</span>
        </button>

        {/* Offline Simulation */}
        <button
          onClick={() => handleAction('offline', () => onTriggerEvent('NETWORK_OFFLINE', { duration_sec: 30 }))}
          className="p-2 rounded bg-[#06150C] border border-[#249344]/40 text-slate-300 hover:text-white hover:border-slate-400 flex items-center gap-1.5 transition-colors"
        >
          <WifiOff className="w-3.5 h-3.5 text-slate-400" />
          <span>Simulate Offline</span>
        </button>
      </div>
    </div>
  );
}
