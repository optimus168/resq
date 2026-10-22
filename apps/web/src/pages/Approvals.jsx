import React, { useState, useEffect } from 'react';
import { http, useIncidentId } from '../lib/api';
import { useIncident } from '../lib/hooks';
import PlanPanel, { PlanStatus } from '../components/PlanPanel';
import { RiskBadge } from '../components/RiskBadge';
import { ShieldAlert, AlertTriangle, CloudRain, CheckCircle, Database } from 'lucide-react';

function Evidence({ incident }) {
  const r = incident?.risk;
  const v = incident?.verification;
  const e = incident?.exposure;
  const o = incident?.observations;

  if (!r) return null;

  return (
    <div className="space-y-2" data-testid="evidence-panel">
      {/* Deterministic Risk Drivers */}
      <div className="card p-2 rounded">
        <div className="eyebrow mb-1">Risk drivers (deterministic engine)</div>
        {(r.drivers || []).map(d => (
          <div key={d.factor} className="text-[11px] flex items-center gap-2 py-0.5">
            <span className="flex-1 text-[#d6f5dc]">{d.factor}</span>
            <div className="w-24 h-1.5 bg-[#06150C] rounded overflow-hidden">
              <div
                className="h-full bg-[#F97316] rounded"
                style={{ width: `${Math.min(100, (d.contribution || 0) * 3.3)}%` }}
              />
            </div>
            <span className="font-data w-10 text-right text-white">{d.contribution}</span>
          </div>
        ))}
        <div className="font-data text-[9px] text-[#5E8B67] mt-1 border-t border-[#249344]/20 pt-1">
          {r.threshold_ref} · ratio {r.rain_threshold_ratio} · {r.model_version}
        </div>
      </div>

      {/* Verifier Report */}
      {v && (
        <div className="card p-2 rounded" data-testid="verification-report">
          <div className="eyebrow mb-1 flex items-center gap-1">
            <ShieldAlert size={11} className="text-[#BDFF42]" /> Verifier
          </div>
          <p className="text-[11px] text-[#d6f5dc] leading-tight">{v.note}</p>
          {(v.issues || []).map((issue, idx) => (
            <div key={idx} className="text-[11px] text-[#FFA31A] mt-1 flex items-start gap-1">
              <span>⚠</span>
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Observations */}
      {o && (
        <div className="card p-2 text-[11px] rounded">
          <div className="eyebrow mb-1 flex items-center gap-1">
            <CloudRain size={11} className="text-[#9FD8A8]" /> Observations
          </div>
          <div className="text-[#d6f5dc] leading-relaxed">
            Live feed <b className="text-white">{o.weather?.mode || 'live'}</b>: 72h observed{' '}
            <span className="text-[#BDFF42]">{o.weather?.observed_72h_mm ?? 'n/a'}</span> mm · next 24h forecast{' '}
            <span className="text-[#BDFF42]">{o.weather?.forecast_24h_mm ?? 'n/a'}</span> mm (Open-Meteo, modelled).
          </div>
          {o.scenario && (
            <div className="font-data text-[10px] text-[#FFA31A] mt-1">
              Scenario forcing: {o.scenario.title} (+{o.scenario.forcing_mm}mm)
            </div>
          )}
        </div>
      )}

      {/* Exposed Settlements */}
      {e && (
        <div className="card p-2 text-[11px] rounded">
          <div className="eyebrow mb-1">Exposure summary</div>
          <div className="text-white font-medium mb-1">
            {e.villages_exposed ? `${e.villages_exposed} settlement(s) in direct runout` : 'No settlements in footprint'}
          </div>
          {(e.villages || []).filter(x => x.exposed).map(x => (
            <div key={x.id} className="text-[10px] text-[#EF4444] flex justify-between py-0.5">
              <span>📍 {x.name}</span>
              <span className="font-data">pop {x.pop?.toLocaleString()} · T+{x.time_to_impact_h}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Approvals() {
  const { incidentId, setIncidentId } = useIncidentId();
  const [list, setList] = useState([]);
  const { incident } = useIncident(incidentId);

  useEffect(() => {
    const f = () => http.get('/incidents').then(r => setList(r.data)).catch(() => {});
    f();
    const t = setInterval(f, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="min-h-[calc(100vh-48px)] lg:h-[calc(100vh-48px)] grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px] gap-2 p-2 bg-[#06150C] overflow-y-auto lg:overflow-hidden"
      data-testid="approvals-page"
    >
      {/* Left: Approval Queue */}
      <aside className="panel p-2 overflow-y-auto scroll-thin rounded-lg flex flex-col min-h-0">
        <div className="font-display text-lg flex items-center gap-2 mb-2 text-white">
          <ShieldAlert size={16} className="text-[#FFA31A]" />
          <span>Approval queue</span>
        </div>
        {!list.length && (
          <p className="text-xs text-[#5E8B67] mt-2">No active incidents in queue.</p>
        )}
        <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto scroll-thin pr-1">
          {list.map(i => (
            <button
              key={i.id}
              data-testid={`queue-item-${i.id}`}
              onClick={() => setIncidentId(i.id)}
              className={`w-full text-left card p-2 rounded transition-all ${
                i.id === incidentId ? 'border-[#BDFF42] bg-[#0A2416]' : 'hover:border-[#249344]/80'
              }`}
            >
              <div className="text-[12px] flex justify-between items-center text-white">
                <span className="font-bold">{i.aoi_name || i.aoi}</span>
                <span className="font-data text-[#9FD8A8]">V{i.current_version || 1}</span>
              </div>
              <div className="flex gap-1.5 mt-1.5 items-center">
                <PlanStatus s={i.status || 'PENDING_APPROVAL'} />
                <RiskBadge category={i.risk?.category || 'HIGH'} />
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center: Plan Panel */}
      <section className="panel p-3 min-h-0 flex flex-col rounded-lg">
        {incident ? (
          <PlanPanel incident={incident} />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-[#5E8B67]">
            Select an incident from the approval queue.
          </div>
        )}
      </section>

      {/* Right: Evidence provenance */}
      <aside className="panel p-2 overflow-y-auto scroll-thin rounded-lg min-h-0">
        <div className="font-display text-lg mb-2 text-white">Evidence Provenance</div>
        {incident ? (
          <Evidence incident={incident} />
        ) : (
          <div className="text-xs text-[#5E8B67] p-2">Awaiting incident selection.</div>
        )}
      </aside>
    </div>
  );
}
