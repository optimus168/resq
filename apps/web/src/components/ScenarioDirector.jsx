import React, { useState } from 'react';
import { 
  Sliders, CloudRain, AlertOctagon, FileSpreadsheet, Activity, 
  WifiOff, Play, Pause, SkipForward, RotateCcw, Check, Sparkles, ShieldAlert, Award
} from 'lucide-react';

const JUDGE_STEPS = [
  {
    step: 1,
    title: 'Baseline Surveillance',
    caption: 'Real 30m Copernicus DEM + IMD 72h rain forecast ingested. Slopes stable (FS > 1.25).',
    action: 'reset'
  },
  {
    step: 2,
    title: 'Rain Escalation & Debate',
    caption: 'Monsoon deluge (+65mm). Slope fails (FS = 0.82). Skeptic agent challenges, Verifier confirms.',
    action: 'rain'
  },
  {
    step: 3,
    title: 'Human Gate Authorization',
    caption: 'Plan V1 drafted with SOP evacuation routes. Collector cryptographically approves.',
    action: 'approve_v1'
  },
  {
    step: 4,
    title: 'Lifeline Severance & Re-Plan',
    caption: 'NH-10 blocked at KM-18. Agents invalidate V1, replan selectively, and present V2 diff.',
    action: 'road_block'
  },
  {
    step: 5,
    title: 'Red-Team Adversarial Defense',
    caption: 'Adversary injects malicious prompt override. Perimeter quarantines and hashes to audit ledger.',
    action: 'redteam'
  }
];

export default function ScenarioDirector({ 
  onTriggerEvent, 
  onReset, 
  onRunAutoDemo,
  isAutoDemoRunning = false,
  incidentId = '',
  onApproveV1 = null,
  onOpenRedTeam = null
}) {
  const [activeAction, setActiveAction] = useState(null);
  const [currentJudgeStep, setCurrentJudgeStep] = useState(1);
  const [isJudgeModeActive, setIsJudgeModeActive] = useState(false);

  const handleAction = async (name, fn) => {
    setActiveAction(name);
    try {
      await fn();
    } finally {
      setTimeout(() => setActiveAction(null), 1200);
    }
  };

  const handleExecuteJudgeStep = async (stepNum) => {
    setCurrentJudgeStep(stepNum);
    const s = JUDGE_STEPS[stepNum - 1];
    if (s.action === 'reset') {
      await handleAction('reset', onReset);
    } else if (s.action === 'rain') {
      await handleAction('rain', () => onTriggerEvent('RAIN_ESCALATION', { delta: 0.6, mm_added: 65 }));
    } else if (s.action === 'approve_v1') {
      if (onApproveV1) {
        await onApproveV1();
      }
    } else if (s.action === 'road_block') {
      await handleAction('road', () => onTriggerEvent('ROAD_BLOCKED', { road_id: 'NH10_KM18', segment: 'KM-18 Singtam-Deorali' }));
    } else if (s.action === 'redteam') {
      if (onOpenRedTeam) {
        onOpenRedTeam();
      }
    }
  };

  const handleNextStep = () => {
    if (currentJudgeStep < JUDGE_STEPS.length) {
      handleExecuteJudgeStep(currentJudgeStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentJudgeStep > 1) {
      handleExecuteJudgeStep(currentJudgeStep - 1);
    }
  };

  return (
    <div className="bg-[#0A2416] rounded-lg border border-[#249344]/40 p-3 shadow-xl space-y-3 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#249344]/30 pb-2">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#BDFF42]" />
          <span className="text-xs font-bold text-white tracking-wider uppercase font-sans">
            JUDGE MODE & SCENARIO DIRECTOR
          </span>
        </div>
        <button
          onClick={() => setIsJudgeModeActive(!isJudgeModeActive)}
          className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${
            isJudgeModeActive 
              ? 'bg-[#BDFF42] text-[#06150C] border-[#BDFF42]' 
              : 'bg-[#FFA31A]/20 text-[#FFA31A] border-[#FFA31A]/40'
          }`}
        >
          {isJudgeModeActive ? 'STEPPER ON' : 'STEPPER VIEW'}
        </button>
      </div>

      {/* Guided Judge Walkthrough Stepper */}
      {isJudgeModeActive && (
        <div className="p-2.5 bg-[#06150C] rounded-lg border border-[#BDFF42]/40 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#BDFF42] font-bold font-sans">
              STEP {currentJudgeStep} OF 5: {JUDGE_STEPS[currentJudgeStep - 1].title}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevStep}
                disabled={currentJudgeStep === 1}
                className="px-1.5 py-0.5 rounded bg-[#0A2416] border border-[#249344]/30 text-slate-300 disabled:opacity-40"
              >
                ◀
              </button>
              <button
                onClick={handleNextStep}
                disabled={currentJudgeStep === JUDGE_STEPS.length}
                className="px-1.5 py-0.5 rounded bg-[#0A2416] border border-[#249344]/30 text-[#BDFF42] disabled:opacity-40"
              >
                ▶
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-300 font-sans leading-tight">
            {JUDGE_STEPS[currentJudgeStep - 1].caption}
          </p>

          {/* Step Progress Bar */}
          <div className="grid grid-cols-5 gap-1 pt-1">
            {JUDGE_STEPS.map((s) => (
              <button
                key={s.step}
                onClick={() => handleExecuteJudgeStep(s.step)}
                className={`h-1.5 rounded transition-all ${
                  s.step <= currentJudgeStep ? 'bg-[#BDFF42]' : 'bg-slate-700'
                }`}
                title={s.title}
              />
            ))}
          </div>
        </div>
      )}

      {/* Auto-Demo Hero Button */}
      <div>
        <button
          onClick={onRunAutoDemo}
          disabled={isAutoDemoRunning}
          className={`w-full py-2.5 px-3 rounded-md font-sans font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
            isAutoDemoRunning 
              ? 'bg-[#FFA31A] text-black animate-pulse' 
              : 'bg-gradient-to-r from-[#BDFF42] to-emerald-400 text-[#06150C] hover:brightness-110 shadow-lime-500/20'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{isAutoDemoRunning ? 'AUTO-DEMO RUNNING (3-MIN SEQUENCE)...' : 'RUN ONE-CLICK AUTO DEMO (3-MIN)'}</span>
        </button>
      </div>

      {/* Manual Perturbation Triggers */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {/* Reset */}
        <button
          onClick={() => handleAction('reset', onReset)}
          className="p-1.5 rounded bg-[#06150C] border border-[#249344]/40 text-[#9FD8A8] hover:text-white hover:border-[#BDFF42] flex items-center gap-1.5 transition-colors text-[11px]"
        >
          <RotateCcw className={`w-3 h-3 ${activeAction === 'reset' ? 'animate-spin' : ''}`} />
          <span>Reset Baseline</span>
        </button>

        {/* Rain Escalation */}
        <button
          onClick={() => handleAction('rain', () => onTriggerEvent('RAIN_ESCALATION', { delta: 0.6, mm_added: 65 }))}
          className="p-1.5 rounded bg-[#06150C] border border-[#249344]/40 text-cyan-300 hover:text-white hover:border-cyan-400 flex items-center gap-1.5 transition-colors text-[11px]"
        >
          <CloudRain className="w-3 h-3 text-cyan-400" />
          <span>+65mm Rain</span>
        </button>

        {/* Block Road */}
        <button
          onClick={() => handleAction('road', () => onTriggerEvent('ROAD_BLOCKED', { road_id: 'NH10_KM18', segment: 'KM-18 Singtam-Deorali' }))}
          className="p-1.5 rounded bg-[#06150C] border border-[#249344]/40 text-amber-300 hover:text-white hover:border-amber-400 flex items-center gap-1.5 transition-colors text-[11px]"
        >
          <AlertOctagon className="w-3 h-3 text-amber-400" />
          <span>Block NH10</span>
        </button>

        {/* Crack Report */}
        <button
          onClick={() => handleAction('report', () => onTriggerEvent('NEW_REPORT', { category: 'cracks', width_cm: 15, loc: 'Deorali slope' }))}
          className="p-1.5 rounded bg-[#06150C] border border-[#249344]/40 text-purple-300 hover:text-white hover:border-purple-400 flex items-center gap-1.5 transition-colors text-[11px]"
        >
          <FileSpreadsheet className="w-3 h-3 text-purple-400" />
          <span>Crack Report</span>
        </button>

        {/* Piezometer Anomaly */}
        <button
          onClick={() => handleAction('sensor', () => onTriggerEvent('SENSOR_ANOMALY', { sensor_id: 'PIEZO_DEORALI_02', ru_spike: 0.48 }))}
          className="p-1.5 rounded bg-[#06150C] border border-[#249344]/40 text-rose-300 hover:text-white hover:border-rose-400 flex items-center gap-1.5 transition-colors text-[11px]"
        >
          <Activity className="w-3 h-3 text-rose-400" />
          <span>Piezo Spike</span>
        </button>

        {/* Offline Simulation */}
        <button
          onClick={() => handleAction('offline', () => onTriggerEvent('NETWORK_OFFLINE', { duration_sec: 30 }))}
          className="p-1.5 rounded bg-[#06150C] border border-[#249344]/40 text-slate-300 hover:text-white hover:border-slate-400 flex items-center gap-1.5 transition-colors text-[11px]"
        >
          <WifiOff className="w-3 h-3 text-slate-400" />
          <span>Offline Edge</span>
        </button>
      </div>
    </div>
  );
}
