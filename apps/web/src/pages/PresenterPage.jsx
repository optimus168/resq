import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../lib/toast';
import { http, errMsg, useAuth, useIncidentId, canApprove } from '../lib/api';
import { useNavigate } from '../router';
import { 
  Clapperboard, Play, CheckCircle2, ArrowRight, ShieldCheck, 
  AlertTriangle, Layers, Activity, RotateCcw, Compass, Square,
  ExternalLink, Sparkles, Mountain, Cpu, Radio, Send
} from 'lucide-react';

const STEPS = [
  {
    step: 1,
    title: 'Incident opens · Multi-Agent Dispatch',
    desc: '24 h monsoon forcing on Gangtok–NH10 corridor. Sentinel, Terrain, and Field Intel fan out in parallel. Digital Twin 3D simulates hydraulic infiltration and Voellmy D8 runout.',
    agent: 'Sentinel + Twin',
    tag: 'T+00:00'
  },
  {
    step: 2,
    title: 'Human Gate · Plan V1 Cryptographic Lock',
    desc: 'Plan V1 synthesizes 6 actionable tasks and routes to the District Collector. Strict human-in-the-loop gate ensures zero unverified alerts reach the public.',
    agent: 'Collector Gate',
    tag: 'GATE V1'
  },
  {
    step: 3,
    title: 'Rain Escalation · Targeted Invalidation',
    desc: 'Sentinel detects a 1.6× precipitation surge. Verifier invalidates Assumption A-RAIN in the Assumption Ledger. Only affected agents re-compute to save compute.',
    agent: 'Verifier + Replan',
    tag: 'EVENT TRIGGER'
  },
  {
    step: 4,
    title: 'Plan V2 + Structural Diff Synthesis',
    desc: 'New high-risk settlements added for evacuation; stable tasks preserved. The system synthesizes Plan V2 with semantic diffs requiring fresh Collector sign-off.',
    agent: 'Planner V2',
    tag: 'GATE V2'
  },
  {
    step: 5,
    title: 'Citizen Ground Truth · Soil Cohesion Calibration',
    desc: 'A verified citizen report files 3 cm tension cracks above the corridor. Field Intel isolates prompt injections, while Continuous Learner lowers soil cohesion c′.',
    agent: 'Learner + Vision',
    tag: 'FEEDBACK LOOP'
  },
  {
    step: 6,
    title: 'Plan V3 at Gate · Complete Operational Cycle',
    desc: 'Digital twin re-runs from physical ground truth. Plan V3 is ready at the approval gate with audited cryptographic provenance.',
    agent: 'Mission Control',
    tag: 'FINAL SIGN-OFF'
  }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default function PresenterPage() {
  const { user } = useAuth();
  const { incidentId, setIncidentId } = useIncidentId();
  const navigate = useNavigate();
  const [step, setStep] = useState(-1);
  const [t0, setT0] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [activeIid, setActiveIid] = useState(incidentId || null);
  const stop = useRef(false);

  useEffect(() => {
    if (step < 0) return;
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, [step]);

  const waitFor = async (id, pred) => {
    for (let i = 0; i < 90; i++) {
      if (stop.current) throw new Error('stopped');
      try {
        const { data } = await http.get(`/incidents/${id}`);
        if (!data.busy && pred(data)) return data;
      } catch {}
      await sleep(1500);
    }
    throw new Error('Timed out waiting for agents');
  };

  const approve = async (id, v) => {
    await sleep(3500);
    await http.post(`/incidents/${id}/plans/${v}/decision`, {
      decision: 'approve',
      notes: 'Presenter scripted demonstration approval'
    });
  };

  const run = async () => {
    stop.current = false;
    setT0(Date.now());

    try {
      setStep(0);
      const { data } = await http.post('/incidents', { aoi: 'gangtok', scenario: 'heavy_24h' });
      const id = data.id;
      setActiveIid(id);
      setIncidentId(id);
      toast.success(`Demo incident opened: ${id.slice(0, 8)}`);

      await waitFor(id, d => (d.current_version || d.plans?.length || 0) >= 1);
      setStep(1);
      await approve(id, 1);

      setStep(2);
      await sleep(2500);
      await http.post(`/incidents/${id}/events`, {
        type: 'RAIN_ESCALATION',
        payload: { delta: 0.6 },
        idempotency_key: `presenter-rain-${id}`
      });

      await waitFor(id, d => (d.current_version || d.plans?.length || 0) >= 2);
      setStep(3);
      await approve(id, 2);

      setStep(4);
      await sleep(2500);
      const inc = (await http.get(`/incidents/${id}`)).data;
      const v = inc.exposure?.villages?.find(x => x.exposed) || inc.exposure?.villages?.[0] || { lat: 27.33, lon: 88.61, name: 'Gangtok' };

      const fd = new FormData();
      fd.append('lat', v.lat);
      fd.append('lon', v.lon);
      fd.append('category', 'cracks');
      fd.append('client_id', `presenter-${id}`);
      fd.append('description', `Fresh tension cracks ~3 cm wide on slope above ${v.name}; muddy seepage after night rain. (PROTOTYPE presenter report)`);
      await http.post('/reports', fd);

      await waitFor(id, d => (d.current_version || d.plans?.length || 0) >= 3);
      setStep(5);
      toast.success('6-step presenter demonstration completed successfully!');
    } catch (e) {
      if (e.message !== 'stopped') toast.error(errMsg(e));
      setStep(-1);
    }
  };

  const elapsed = t0 ? Math.round((now - t0) / 1000) : 0;
  const isRunning = step >= 0 && step < 5;

  return (
    <div className="flex-1 bg-[#06150C] text-white p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#249344]/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded bg-amber-500/20 text-[#FFA31A] border border-amber-500/40">
                <Clapperboard className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase font-sans">
                  PRESENTER SCRIPTED DEMONSTRATION
                </h1>
                <p className="text-xs text-[#9FD8A8] font-mono">
                  Autonomous 6-Step End-to-End Emergency Response Lifecycle Walkthrough
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                onClick={() => {
                  stop.current = true;
                  setStep(-1);
                }}
                className="px-4 py-2 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <Square className="w-4 h-4" />
                <span>STOP DEMO</span>
              </button>
            ) : (
              <button
                onClick={run}
                className="px-5 py-2.5 rounded bg-[#FFA31A] hover:bg-amber-400 text-[#06150C] font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>START SCRIPTED DEMO</span>
              </button>
            )}

            <button
              onClick={() => navigate('/mission-control')}
              className="px-3.5 py-2.5 rounded bg-[#0A2416] hover:bg-[#249344]/20 border border-[#249344]/40 text-[#BDFF42] text-xs font-bold flex items-center gap-1.5"
            >
              <span>MISSION CONTROL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Execution Progress Card */}
        {step >= 0 && (
          <div className="p-4 rounded-xl bg-[#0A2416] border border-amber-500/50 shadow-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#FFA31A] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FFA31A] animate-ping" />
                EXECUTING STAGE {step + 1} OF 6
              </span>
              <span className="text-[#9FD8A8]">
                ELAPSED: {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">
                {STEPS[step]?.title}
              </h2>
              <p className="text-xs text-slate-300">
                {STEPS[step]?.desc}
              </p>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5 pt-2">
              {STEPS.map((s, idx) => (
                <div
                  key={idx}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    idx < step
                      ? 'bg-emerald-500'
                      : idx === step
                      ? 'bg-[#FFA31A] animate-pulse'
                      : 'bg-[#249344]/30'
                  }`}
                />
              ))}
            </div>

            {activeIid && (
              <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-[#9FD8A8] border-t border-[#249344]/20">
                <span>Active Incident: <b className="text-white">{activeIid.slice(0, 10)}</b></span>
                <button
                  onClick={() => navigate('/mission-control')}
                  className="text-[#BDFF42] hover:underline flex items-center gap-1"
                >
                  View live in Mission Control <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 6-Step Visual Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STEPS.map((s, idx) => {
            const isPassed = step > idx;
            const isCurrent = step === idx;

            return (
              <div
                key={s.step}
                className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                  isCurrent
                    ? 'bg-[#0A2416] border-[#FFA31A] shadow-lg shadow-amber-500/10'
                    : isPassed
                    ? 'bg-[#0A2416]/90 border-emerald-500/40'
                    : 'bg-[#06150C] border-[#249344]/30 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isCurrent
                      ? 'bg-amber-500/20 text-[#FFA31A] border border-amber-500/40'
                      : isPassed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-[#0A2416] text-[#5E8B67] border border-[#249344]/20'
                  }`}>
                    STEP 0{s.step} · {s.tag}
                  </span>
                  {isPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-[#FFA31A] animate-ping" />
                  ) : null}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white font-sans">
                    {s.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#249344]/20 flex items-center justify-between text-[10px] font-mono text-[#9FD8A8]">
                  <span>Lead: <b className="text-[#BDFF42]">{s.agent}</b></span>
                  <span>Phase {s.step}/6</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Technical Governance Notes */}
        <div className="p-4 rounded-xl bg-[#0A2416] border border-[#249344]/30 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-[#BDFF42] font-bold font-sans">
            <ShieldCheck className="w-4 h-4" />
            <span>OPERATIONAL DEMO GUARANTEES</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            This presenter scenario runs against actual database records and FastAPI endpoints. It executes the exact mathematical 3D Voellmy numerical solver, queries real Open-Meteo rainfall profiles for Gangtok, checks the cryptographic Assumption Ledger, and pauses at versioned human authorization gates.
          </p>
        </div>

      </div>
    </div>
  );
}
