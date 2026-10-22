import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../lib/toast';
import { http, errMsg, useAuth, useIncidentId, canApprove } from '../lib/api';
import { Clapperboard, Square } from 'lucide-react';

const STEPS = [
  {
    t: 'Incident opens',
    d: '24 h monsoon forcing on Gangtok–NH10. Sentinel, Terrain and Field Intel fan out; the twin simulates failures and runout.'
  },
  {
    t: 'Human gate · V1',
    d: 'Plan V1 waits for the District Collector. Nothing reaches the public until a human signs this exact version.'
  },
  {
    t: 'Rain escalates',
    d: 'Sentinel sees forcing rise ×1.6. Verifier invalidates A-RAIN; only affected agents re-run, including the simulation.'
  },
  {
    t: 'Plan V2 + diff',
    d: 'New evacuations appear, unchanged tasks are carried over. V1’s approval does not cover V2 — fresh sign-off.'
  },
  {
    t: 'Crack report',
    d: 'A field officer files fresh tension cracks. Field Intel triages, Learner lowers soil cohesion, the twin re-runs.'
  },
  {
    t: 'Plan V3 at the gate',
    d: 'Re-planned again from ground truth. Your move: review the diff and approve.'
  }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default function PresenterMode() {
  const { user } = useAuth();
  const { setIncidentId } = useIncidentId();
  const [step, setStep] = useState(-1);
  const [t0, setT0] = useState(null);
  const [now, setNow] = useState(Date.now());
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
      notes: 'Presenter demo approval'
    });
  };

  const run = async () => {
    if (!canApprove(user)) {
      return toast.error('Sign in as Approver/Admin to run the presenter demo (it performs version-bound approvals).');
    }
    stop.current = false;
    setT0(Date.now());

    try {
      setStep(0);
      const { data } = await http.post('/incidents', { aoi: 'gangtok', scenario: 'heavy_24h' });
      const id = data.id;
      setIncidentId(id);

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
    } catch (e) {
      if (e.message !== 'stopped') toast.error(errMsg(e));
      setStep(-1);
    }
  };

  const elapsed = t0 ? Math.round((now - t0) / 1000) : 0;

  return (
    <>
      <button
        data-testid="presenter-start-btn"
        disabled={step >= 0 && step < 5}
        onClick={run}
        className="btn-amber px-3 py-1 text-xs flex items-center gap-1 rounded disabled:opacity-50"
      >
        <Clapperboard size={13} />
        <span>Presenter demo</span>
      </button>

      {step >= 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] glass w-[640px] max-w-[92vw] p-4 rise rounded-xl shadow-2xl"
          data-testid="presenter-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="font-data text-[10px] text-[#FFA31A] font-bold uppercase tracking-wider">
              PRESENTER · STEP {step + 1} OF {STEPS.length}
            </span>
            <span className="font-data text-[10px] text-[#9FD8A8]">
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </span>
            <button
              onClick={() => {
                stop.current = true;
                setStep(-1);
              }}
              className="ml-auto text-xs text-[#5E8B67] hover:text-[#EF4444] flex items-center gap-1"
            >
              <Square size={11} /> Stop
            </button>
          </div>

          <div className="font-display text-lg text-white font-bold mb-1">
            {STEPS[step]?.t}
          </div>
          <p className="text-xs text-[#d6f5dc] leading-relaxed">
            {STEPS[step]?.d}
          </p>

          <div className="flex gap-1.5 mt-3">
            {STEPS.map((s, idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  idx < step ? 'bg-[#22C55E]' : idx === step ? 'bg-[#FFA31A] animate-pulse' : 'bg-[#249344]/30'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
