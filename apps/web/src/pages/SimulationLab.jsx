import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Zap, Layers, Mountain, Sliders, Activity,
  AlertTriangle, ShieldAlert, Info, Download, CloudRain, X, Loader2,
  ChevronRight, CheckCircle2, Gauge, Clock3, Waves
} from 'lucide-react';
import DigitalTwin3D from '../components/DigitalTwin3D';
import { api } from '../api';
import { errMsg } from '../lib/api';
import { useNavigate, useLocation } from '../router';
import LandslideRiskSimulator from '../terraguard/components/LandslideRiskSimulator';
import GeoShieldSimulator from '../geoshield/pages/Simulator';

const RAIN_PRESETS = {
  observed_event: 'Observed Event Rain (ERA5 Ground Truth)',
  heavy_24h: '24 h heavy monsoon (~220 mm)',
  cloudburst: 'Cloudburst (160 mm in 3 h)',
  deluge_48h: 'Extreme deluge (~380 mm)',
  dry_baseline: 'Dry baseline (no forcing)',
};

const LAYERS = [
  { id: 'hazard', label: 'Hazard', hint: 'saturation + FS + runout' },
  { id: 'depth', label: 'Depth', hint: 'deposition thickness' },
  { id: 'velocity', label: 'Velocity', hint: 'flow speed' },
  { id: 'fs', label: 'Stability', hint: 'factor of safety' },
];

const AOI_ORDER = ['gangtok', 'shillong', 'aizawl', 'tupul', 'wayanad', 'joshimath'];

function Slider({ label, value, unit, min, max, step = 0.01, onChange, hint }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-[#9FD8A8]">{label}</span>
        <span className="font-data text-[#BDFF42] font-semibold">
          {value}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#BDFF42] h-1.5 bg-[#0A2416] rounded cursor-pointer"
      />
      <div className="flex justify-between font-data text-[8px] text-[#5E8B67]">
        <span>{min}</span>
        <span className="truncate px-1">{hint}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, accent = '#BDFF42', hint }) {
  return (
    <div className="p-2 rounded bg-[#0A2416] border border-[#249344]/40">
      <div className="text-[9px] uppercase tracking-wide text-[#5E8B67]">{label}</div>
      <div className="font-data font-bold text-sm" style={{ color: accent }}>
        {value} <span className="text-[10px] font-normal">{unit}</span>
      </div>
      {hint && <div className="text-[8px] text-[#5E8B67] leading-tight mt-0.5">{hint}</div>}
    </div>
  );
}

export default function SimulationLab() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const raw = window.location.hash || window.location.search;
      const queryPart = raw.includes('?') ? raw.split('?')[1] : '';
      const urlParams = new URLSearchParams(queryPart);
      if (urlParams.get('tab') === 'fos') return 'fos';
      if (urlParams.get('tab') === 'network') return 'network';
      if (window.location.pathname.includes('terraguard') || window.location.hash.includes('terraguard')) return 'fos';
    }
    return 'physics';
  });

  useEffect(() => {
    const rawPath = location?.pathname || '';
    const queryPart = rawPath.includes('?') ? rawPath.split('?')[1] : (typeof window !== 'undefined' ? (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.search.replace(/^\?/, '')) : '');
    const urlParams = new URLSearchParams(queryPart);
    const tab = urlParams.get('tab');
    if (tab === 'fos' || tab === 'network' || tab === 'physics') {
      setActiveTab(tab);
    } else if (rawPath.includes('terraguard')) {
      setActiveTab('fos');
    } else {
      setActiveTab('physics');
    }
  }, [location?.pathname]);

  const [aois, setAois] = useState([]);
  const [aoi, setAoi] = useState('gangtok');
  const [scenario, setScenario] = useState('heavy_24h');
  const [customRain, setCustomRain] = useState(false);
  const [hyetograph, setHyetograph] = useState([]);
  const [hour, setHour] = useState(0);
  const [layer, setLayer] = useState('hazard');

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProvenance, setShowProvenance] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [params, setParams] = useState({
    c_soil: 4.5, c_root: 4.0, phi: 32.0, z_base: 2.2,
    mu: 0.22, xi: 500.0, reach_angle: 13.0, m0: 0.24,
  });

  const [playing, setPlaying] = useState(false);
  const playRef = useRef(null);

  const maxHour = run?.max_hour ?? (hyetograph.length ? hyetograph.length - 1 : 24);

  // AOI catalogue
  useEffect(() => {
    api.getAOIs()
      .then(list => setAois(Array.isArray(list) ? list : []))
      .catch(() => setAois([]));
  }, []);

  const regional = useMemo(() => {
    return (run?.regional?.profile) || null;
  }, [run]);

  // Reset profile-derived defaults when the AOI changes
  useEffect(() => {
    if (regional) return;
    const defaults = {
      gangtok: { c_soil: 4.5, c_root: 4.0, phi: 32.0, z_base: 2.2, mu: 0.22, xi: 500, reach_angle: 13, m0: 0.24 },
      shillong: { c_soil: 3.6, c_root: 5.0, phi: 30.0, z_base: 2.9, mu: 0.20, xi: 450, reach_angle: 11, m0: 0.30 },
      aizawl: { c_soil: 3.0, c_root: 3.5, phi: 28.0, z_base: 1.8, mu: 0.19, xi: 430, reach_angle: 12, m0: 0.26 },
      tupul: { c_soil: 4.0, c_root: 4.0, phi: 30.0, z_base: 2.4, mu: 0.21, xi: 480, reach_angle: 12, m0: 0.28 },
    };
    if (defaults[aoi]) setParams(defaults[aoi]);
  }, [aoi, regional]);

  const execute = useCallback(async (opts = {}) => {
    const targetAoi = opts.aoi ?? aoi;
    const targetScenario = opts.scenario ?? scenario;
    const isObserved = targetScenario === 'observed_event';
    setLoading(true);
    setError('');
    try {
      const payload = {
        aoi: targetAoi,
        scenario: isObserved ? 'heavy_24h' : targetScenario,
        rain_multiplier: 1.0,
        overrides: opts.useAdvanced === false ? {} : normalizeParams(params),
        use_observed_sample: isObserved,
      };
      if (customRain && hyetograph.length >= 6) payload.hyetograph = hyetograph;

      const response = await api.runDetection(payload);
      // API returns { summary, cached }; tolerate a flat summary too.
      const result = response?.summary || response;
      setRun(result);
      setHour(result?.timeline?.length ? Math.min(12, result.timeline.length - 1) : 0);
      if (result?.hyetograph) setHyetograph(result.hyetograph);
      return result;
    } catch (e) {
      setError(errMsg(e));
      setRun(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [aoi, scenario, params, customRain, hyetograph]);

  // Initial run
  useEffect(() => {
    execute({ useAdvanced: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Playback
  useEffect(() => {
    if (!playing) {
      clearInterval(playRef.current);
      return;
    }
    playRef.current = setInterval(() => {
      setHour(h => (h >= maxHour ? 0 : h + 1));
    }, 520);
    return () => clearInterval(playRef.current);
  }, [playing, maxHour]);

  const row = run?.timeline?.[hour] || {};
  const detections = run?.detections?.features || [];
  const detectionsNow = detections.filter(d => d.properties.detection_hour <= hour);
  const significant = detectionsNow.filter(d => d.properties.area_ha >= 1.0);
  const topDetection = significant[0] || detectionsNow[0] || null;
  const hits = useMemo(() => {
    const map = new Map();
    detectionsNow.forEach(d => {
      (d.properties.assets || []).forEach(a => {
        const key = `${a.kind}:${a.id}`;
        const prev = map.get(key);
        const t = a.time_to_impact_h;
        if (!prev || (t != null && (prev.t == null || t < prev.t))) {
          map.set(key, { ...a, t });
        }
      });
    });
    return [...map.values()];
  }, [detectionsNow]);

  const blockingRoads = hits.filter(h => h.kind === 'road');
  const exposedVillages = hits.filter(h => h.kind === 'village');
  const exposedFacilities = hits.filter(h => h.kind === 'hospital' || h.kind === 'shelter');

  const rainfall = run?.regional?.rainfall;

  const handleAoi = (next) => {
    setAoi(next);
    setRun(null);
    execute({ aoi: next });
  };

  const handleScenario = (next) => {
    setScenario(next);
    setCustomRain(false);
    execute({ scenario: next });
  };

  const exportGeoJson = () => {
    if (!run) return;
    const payload = {
      type: 'FeatureCollection',
      features: (run.detections?.features || []).map(f => ({
        ...f,
        properties: { ...f.properties, run_id: run.run_id, config_hash: run.config_hash },
      })),
      properties: {
        aoi: run.aoi,
        scenario: run.scenario,
        model: run.model,
        disclaimer: run.disclaimer,
        created_at: run.created_at,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bhuraksha_detections_${run.aoi}_${run.config_hash}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const aoiMeta = aois.find(a => a.id === aoi);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#04100a] text-[#E0EADF]">
      {/* Provenance ribbon */}
      <div className="bg-[#0d2416] border-b border-[#249344]/50 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#BDFF42]/10 border border-[#BDFF42]/40 text-[#BDFF42] font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" /> PHYSICS-BASED SCREENING
          </span>
          <span className="text-[#9FD8A8] hidden sm:inline">
            Transient infiltration → infinite-slope FS → Voellmy D8 runout, NER-calibrated.
          </span>
        </div>
        <div className="flex items-center gap-3">
          {rainfall && (
            <span className="font-data text-[10px] text-[#9FD8A8]">
              rainfall ID-ratio <b className="text-[#BDFF42]">{rainfall.peak_ratio}×</b>
              {' '}({rainfall.governing_duration_h}h window)
            </span>
          )}
          <button
            onClick={() => setShowProvenance(true)}
            className="flex items-center gap-1 text-[#BDFF42] hover:underline font-semibold"
          >
            <Info className="w-3.5 h-3.5" /> Method & limits
          </button>
        </div>
      </div>

      {/* Simulation Engine Mode Tabs */}
      <div className="bg-[#06150C] border-b border-[#249344]/40 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto scroll-thin shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-[#5E8B67] mr-1 hidden sm:inline">Engine:</span>
          <button
            onClick={() => setActiveTab('physics')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap ${
              activeTab === 'physics'
                ? 'bg-[#BDFF42] text-[#06150C] shadow-sm font-bold'
                : 'text-[#9FD8A8] hover:text-white hover:bg-[#249344]/20'
            }`}
          >
            <Mountain size={13} />
            <span>3D Physics Digital Twin</span>
          </button>

          <button
            onClick={() => setActiveTab('fos')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap ${
              activeTab === 'fos'
                ? 'bg-[#BDFF42] text-[#06150C] shadow-sm font-bold'
                : 'text-[#9FD8A8] hover:text-white hover:bg-[#249344]/20'
            }`}
          >
            <Activity size={13} />
            <span>Geotechnical FoS Calculator</span>
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all whitespace-nowrap ${
              activeTab === 'network'
                ? 'bg-[#BDFF42] text-[#06150C] shadow-sm font-bold'
                : 'text-[#9FD8A8] hover:text-white hover:bg-[#249344]/20'
            }`}
          >
            <Zap size={13} />
            <span>Sensor Network Simulator</span>
          </button>
        </div>
      </div>

      {activeTab === 'fos' && (
        <div className="flex-1 overflow-y-auto p-4 bg-[#051424]">
          <LandslideRiskSimulator theme="dark" onNavigateToMap={() => navigate('/risk-map')} />
        </div>
      )}

      {activeTab === 'network' && (
        <div className="flex-1 overflow-y-auto p-4 bg-[#06150C]">
          <GeoShieldSimulator />
        </div>
      )}

      {activeTab === 'physics' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* ---------------- Left: controls ---------------- */}
        <div className="lg:col-span-3 p-3 space-y-3 border-r border-[#249344]/40 overflow-y-auto bg-[#071d10]/60">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#5E8B67] mb-1">Area of interest</div>
            <div className="grid grid-cols-2 gap-1">
              {AOI_ORDER.map(id => {
                const meta = aois.find(a => a.id === id);
                const active = aoi === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleAoi(id)}
                    disabled={loading}
                    className={`text-left px-2 py-1.5 rounded border text-[11px] transition-colors ${
                      active
                        ? 'bg-[#249344]/25 border-[#BDFF42] text-[#BDFF42] font-semibold'
                        : 'bg-[#0A2416] border-[#249344]/30 text-[#9FD8A8] hover:border-[#249344]'
                    }`}
                  >
                    <div className="capitalize">{id}</div>
                    <div className="text-[8px] text-[#5E8B67] truncate">{meta?.state || '—'}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#5E8B67] mb-1">Rainfall scenario</div>
            <div className="space-y-1">
              {Object.entries(RAIN_PRESETS).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => handleScenario(id)}
                  disabled={loading}
                  className={`w-full text-left px-2 py-1.5 rounded border text-[11px] transition-colors ${
                    scenario === id && !customRain
                      ? 'bg-[#249344]/25 border-[#BDFF42] text-[#BDFF42] font-semibold'
                      : 'bg-[#0A2416] border-[#249344]/30 text-[#9FD8A8] hover:border-[#249344]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Hyetograph preview (read-only unless custom) */}
          <div>
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[#5E8B67] mb-1">
              <span>Hourly hyetograph</span>
              <span className="font-data text-[#BDFF42]">
                Σ {run?.rain_total_mm != null ? run.rain_total_mm : hyetograph.reduce((a, b) => a + b, 0)} mm
              </span>
            </div>
            <div className="h-16 flex items-end gap-px bg-[#04100a] border border-[#249344]/30 rounded p-1">
              {(run?.hyetograph || hyetograph).map((v, i) => {
                const peak = Math.max(...(run?.hyetograph || hyetograph || [1]), 1);
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${i === hour ? 'bg-[#BDFF42]' : 'bg-[#2896FF]'}`}
                    style={{ height: `${Math.max(3, (v / peak) * 100)}%` }}
                    title={`T+${i}h: ${v} mm`}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => execute()}
              disabled={loading}
              className="flex-1 py-1.5 rounded bg-[#BDFF42] hover:bg-white text-[#04100a] text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              {loading ? 'RUNNING…' : 'RUN MODEL'}
            </button>
            <button
              onClick={exportGeoJson}
              disabled={!run}
              className="px-2 rounded border border-[#249344]/50 text-[#9FD8A8] hover:border-[#BDFF42] disabled:opacity-40"
              title="Export detections as GeoJSON"
            >
              <Download size={13} />
            </button>
          </div>

          {error && (
            <div className="p-2 rounded border border-[#FF4B4B]/50 bg-[#FF4B4B]/10 text-[11px] text-[#ffb3b3] flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-[#5E8B67] hover:text-[#BDFF42] pt-1"
          >
            <span>Geotechnical parameters</span>
            <ChevronRight size={11} className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="space-y-2">
              <div className="text-[9px] text-[#5E8B67] leading-snug">
                Regional defaults for {aoiMeta?.state || aoi}. Changes are audited with the run's
                config hash.
              </div>
              <Slider label="Soil cohesion c′" value={params.c_soil} unit="kPa" min={1} max={12} step={0.1}
                hint="weathered regolith" onChange={v => setParams(p => ({ ...p, c_soil: v }))} />
              <Slider label="Root cohesion" value={params.c_root} unit="kPa" min={0} max={8} step={0.1}
                hint="forest reinforcement" onChange={v => setParams(p => ({ ...p, c_root: v }))} />
              <Slider label="Friction angle φ′" value={params.phi} unit="°" min={24} max={42} step={0.5}
                hint="effective stress" onChange={v => setParams(p => ({ ...p, phi: v }))} />
              <Slider label="Regolith depth z" value={params.z_base} unit="m" min={0.5} max={4} step={0.1}
                hint="soil mantle" onChange={v => setParams(p => ({ ...p, z_base: v }))} />
              <Slider label="Basal friction μ" value={params.mu} min={0.08} max={0.42} step={0.01}
                hint="Voellmy Coulomb" onChange={v => setParams(p => ({ ...p, mu: v }))} />
              <Slider label="Turbulent drag ξ" value={params.xi} unit="m/s²" min={200} max={1000} step={10}
                hint="Voellmy drag" onChange={v => setParams(p => ({ ...p, xi: v }))} />
              <Slider label="Reach angle" value={params.reach_angle} unit="°" min={8} max={24} step={0.5}
                hint="Fahrböschung stop" onChange={v => setParams(p => ({ ...p, reach_angle: v }))} />
              <Slider label="Antecedent m₀" value={params.m0} min={0.05} max={0.9} step={0.01}
                hint="pre-storm wetness" onChange={v => setParams(p => ({ ...p, m0: v }))} />
            </div>
          )}
        </div>

        {/* ---------------- Center: map ---------------- */}
        <div className="lg:col-span-6 flex flex-col relative min-h-[55vh]">
          <div className="flex-1 relative">
            <DigitalTwin3D
              aoi={aoi}
              run={run}
              hour={hour}
              layer={layer}
              playing={playing}
              onHourChange={setHour}
              onTogglePlay={() => setPlaying(p => !p)}
            />
            {loading && (
              <div className="absolute inset-0 z-30 bg-[#04100a]/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-[#BDFF42] animate-spin" />
                <div className="text-[11px] font-data text-[#BDFF42]">Running physics pipeline…</div>
              </div>
            )}
          </div>

          {/* Layer selector */}
          <div className="bg-[#071d10] border-t border-[#249344]/40 px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-[#5E8B67] mr-1">Overlay</span>
            {LAYERS.map(l => (
              <button
                key={l.id}
                onClick={() => setLayer(l.id)}
                title={l.hint}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  layer === l.id
                    ? 'bg-[#BDFF42] text-[#04100a]'
                    : 'bg-[#0A2416] text-[#9FD8A8] border border-[#249344]/30 hover:border-[#BDFF42]'
                }`}
              >
                {l.label}
              </button>
            ))}
            <span className="ml-auto text-[9px] font-data text-[#5E8B67]">
              {run ? `${run.grid[0]}×${run.grid[1]} · ${run.cell_size_m} m cells` : 'awaiting run'}
            </span>
          </div>
        </div>

        {/* ---------------- Right: results ---------------- */}
        <div className="lg:col-span-3 p-3 space-y-3 border-l border-[#249344]/40 overflow-y-auto bg-[#071d10]/60">
          {/* Playback card */}
          <div className="p-2.5 rounded bg-[#0A2416] border border-[#249344]/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-[#5E8B67]">Timeline</span>
              <span className="font-data text-[#BDFF42] text-sm font-bold">
                T+{hour}h / {maxHour}h
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPlaying(p => !p)}
                className="flex-1 py-1.5 rounded bg-[#249344] hover:bg-[#BDFF42] text-[#04100a] font-bold text-[10px] flex items-center justify-center gap-1.5"
              >
                {playing ? <Pause size={12} /> : <Play size={12} />}
                {playing ? 'PAUSE' : 'PLAY'}
              </button>
              <button
                onClick={() => { setPlaying(false); setHour(0); }}
                className="p-1.5 rounded bg-[#04100a] border border-[#249344]/40 hover:border-[#BDFF42] text-[#9FD8A8]"
              >
                <RotateCcw size={12} />
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={maxHour}
              value={hour}
              onChange={e => setHour(Number(e.target.value))}
              className="w-full accent-[#BDFF42] h-1.5 bg-[#04100a] rounded"
            />
          </div>

          {/* Hazard state */}
          <div className="grid grid-cols-2 gap-1.5">
            <Metric label="Rain now" value={(row.rain_mm ?? 0).toFixed(1)} unit="mm/h"
              hint={`Σ ${(row.cum_rain_mm ?? 0).toFixed(0)} mm`} />
            <Metric label="Saturation" value={(((row.mean_saturation ?? 0) * 100)).toFixed(0)} unit="%" accent="#38bdf8"
              hint="mean m(t)" />
            <Metric label="Failed cells" value={row.failed_cells ?? 0} unit="" accent="#f87171"
              hint={`${((row.failed_cells ?? 0) * (run?.cell_area_m2 || 0) / 1e6).toFixed(2)} km²`} />
            <Metric label="Runout cells" value={row.footprint_cells ?? 0} unit="" accent="#fb923c"
              hint={`${((row.footprint_cells ?? 0) * (run?.cell_area_m2 || 0) / 1e6).toFixed(2)} km²`} />
          </div>

          {/* Rainfall threshold vs observed */}
          {rainfall && (
            <div className="p-2.5 rounded bg-[#0A2416] border border-[#249344]/40 space-y-1.5">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[#5E8B67]">
                <span>Rainfall vs regional threshold</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  rainfall.level === 'SEVERE' ? 'bg-[#FF4B4B]/20 text-[#FF4B4B]'
                    : rainfall.level === 'WARNING' ? 'bg-[#FFA31A]/20 text-[#FFA31A]'
                    : rainfall.level === 'WATCH' ? 'bg-[#eab308]/20 text-[#eab308]'
                    : 'bg-[#249344]/20 text-[#BDFF42]'
                }`}>{rainfall.level}</span>
              </div>
              <div className="space-y-1">
                {(rainfall.by_duration || []).map(w => {
                  const pct = Math.min(100, (w.observed_mm / Math.max(w.threshold_mm, 1)) * 100);
                  return (
                    <div key={w.duration_h} className="text-[9px] font-data">
                      <div className="flex justify-between text-[#9FD8A8]">
                        <span>{w.duration_h}h window</span>
                        <span>{w.observed_mm} / {w.threshold_mm} mm</span>
                      </div>
                      <div className="h-1 bg-[#04100a] rounded overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct >= 100 ? '#ef4444' : pct >= 75 ? '#f97316' : '#22c55e',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[8px] text-[#5E8B67] leading-tight">
                Caine-type ID envelope, antecedent-adjusted ({rainfall.antecedent_factor}×).
              </div>
            </div>
          )}

          {/* Detections list */}
          <div className="p-2.5 rounded bg-[#0A2416] border border-[#249344]/40">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] uppercase tracking-wider text-[#5E8B67]">Detections</span>
              <span className="font-data text-[10px] text-[#BDFF42]">
                {detectionsNow.length}
                {run?.detection_count > detectionsNow.length ? ` / ${run.detection_count}` : ''}
              </span>
            </div>
            {!detectionsNow.length && (
              <div className="text-[10px] text-[#5E8B67] py-2 text-center">
                No modelled failures at this hour.
              </div>
            )}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {detectionsNow.slice(0, 18).map(d => {
                const p = d.properties;
                const colour =
                  p.confidence_label === 'HIGH' ? '#ef4444'
                    : p.confidence_label === 'MODERATE' ? '#f97316' : '#facc15';
                return (
                  <div key={p.id} className="text-[9px] font-data border-l-2 pl-1.5 py-0.5"
                    style={{ borderColor: colour }}>
                    <div className="flex justify-between">
                      <span className="text-[#e6f2e6] truncate">{p.id}</span>
                      <span style={{ color: colour }}>{p.confidence}</span>
                    </div>
                    <div className="text-[#5E8B67]">
                      T+{p.detection_hour}h · {p.area_ha} ha · FS {p.min_fs}
                      {p.runout_distance_m ? ` · ${p.runout_distance_m} m` : ''}
                    </div>
                    {p.nearest_asset && (
                      <div className="text-[#9FD8A8] truncate">
                        near {p.nearest_asset}
                        {p.nearest_asset_distance_m != null ? ` (${Math.round(p.nearest_asset_distance_m)} m)` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Impact summary */}
          <div className="p-2.5 rounded bg-[#0A2416] border border-[#249344]/40 space-y-1.5">
            <div className="text-[9px] uppercase tracking-wider text-[#5E8B67]">Cumulative impact @ T+{hour}h</div>
            <ImpactRow icon={<Gauge size={11} />} label="Population exposed"
              value={(row.exposed_population_est ?? 0).toLocaleString()} tone="#BDFF42" />
            <ImpactRow icon={<AlertTriangle size={11} />} label="Lifelines blocked"
              value={blockingRoads.length ? blockingRoads.map(r => r.name).join(', ') : 'none'}
              tone={blockingRoads.length ? '#FF4B4B' : '#BDFF42'} small />
            <ImpactRow icon={<Waves size={11} />} label="Settlements hit"
              value={exposedVillages.length ? exposedVillages.map(v => v.name).join(', ') : 'none'}
              tone={exposedVillages.length ? '#FFA31A' : '#BDFF42'} small />
            <ImpactRow icon={<CheckCircle2 size={11} />} label="Facilities impacted"
              value={exposedFacilities.length ? exposedFacilities.map(f => f.name).join(', ') : 'none'}
              tone={exposedFacilities.length ? '#38bdf8' : '#BDFF42'} small />
            {topDetection && (
              <div className="pt-1 border-t border-[#249344]/25 text-[8px] font-data text-[#5E8B67] leading-tight">
                Largest: {topDetection.properties.id} · {topDetection.properties.area_ha} ha ·
                max {topDetection.properties.max_speed_kmh} km/h ·
                deposit {topDetection.properties.max_deposit_m} m
              </div>
            )}
          </div>

          {/* Mass balance / audit */}
          {run && (
            <div className="p-2 rounded bg-[#04100a] border border-[#249344]/30 text-[8px] font-data text-[#5E8B67] space-y-0.5">
              <div className="flex justify-between">
                <span>released</span><span className="text-[#9FD8A8]">{run.mass_balance.released_m3.toLocaleString()} m³</span>
              </div>
              <div className="flex justify-between">
                <span>deposited</span><span className="text-[#9FD8A8]">{run.mass_balance.deposited_m3.toLocaleString()} m³</span>
              </div>
              <div className="flex justify-between">
                <span>outflow</span><span className="text-[#9FD8A8]">{run.mass_balance.outflow_m3.toLocaleString()} m³</span>
              </div>
              <div className="flex justify-between">
                <span>conservation err</span><span className="text-[#BDFF42]">{run.mass_balance.conservation_error_pct}%</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#249344]/20">
                <span>config hash</span><span className="text-[#BDFF42]">{run.config_hash}</span>
              </div>
              <div className="flex justify-between">
                <span>pre-existing unstable</span><span>{run.pre_existing_unstable_cells} cells</span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Provenance modal */}
      {showProvenance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-2xl w-full max-h-[85vh] flex flex-col bg-[#071d10] border border-[#249344] rounded-lg">
            <div className="flex justify-between items-center border-b border-[#249344]/40 p-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Mountain size={16} className="text-[#BDFF42]" />
                Model method, data provenance and limits
              </h3>
              <button onClick={() => setShowProvenance(false)} className="text-[#9FD8A8] hover:text-[#BDFF42]">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 text-[11px] leading-relaxed text-[#9FD8A8]">
              <div className="p-2.5 rounded bg-[#0A2416] border border-[#BDFF42]/30 text-[#E0EADF]">
                <b className="text-[#BDFF42]">What this is:</b> a physically-based screening model.
                It answers "where and when could slopes fail under this rainfall, and what would be in the way".
                It does <b>not</b> confirm that a landslide has occurred and is not an official warning.
              </div>

              <Section title="1. Rainfall forcing">
                Hourly hyetograph from a scenario preset or a user-supplied series. Evaluated against a
                Caine-type intensity–duration envelope <code>I = a · D^−b</code> scaled per AOI and
                reduced by antecedent wetness (bounded 0.70–1.00). Thresholds are screening estimates,
                not IMD/GSI official values.
              </Section>

              <Section title="2. Infiltration and stability">
                Capacity-limited infiltration (regional <code>k_sat</code>), topographic wetness weighting
                and drainage update the saturation fraction m(t). Factor of safety uses the infinite-slope
                closed form:
                <code className="block bg-[#04100a] p-1.5 rounded font-data text-[#BDFF42] my-1">
                  FS = c′/(γ z sinβ cosβ) + (1 − m·γ_w/γ)·tanφ′/tanβ
                </code>
                Soil strength includes spatially correlated heterogeneity and a road-cut weakening factor,
                so failure clusters form where terrain and infrastructure actually concentrate stress.
              </Section>

              <Section title="3. Runout">
                Released volume is routed with D8 steepest descent using a Voellmy energy balance
                (<code>dv/dt = g(sinθ − μcosθ) − g v²/ξ</code>) and stopped by the Fahrböschung reach angle
                or momentum loss. Mass balance (released = deposited + outflow) is reported for every run.
              </Section>

              <Section title="4. Calibration source">
                {run?.regional?.profile ? (
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><b>{run.regional.profile.state}</b>: {run.regional.profile.terrain_note}</li>
                    <li>Regolith: {run.regional.profile.regolith}</li>
                    {(run.regional.profile.notes || []).map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                ) : 'Run a simulation to see the active regional calibration.'}
              </Section>

              <Section title="5. Known limitations">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>30 m DEM cannot resolve individual cut slopes or gully headwalls.</li>
                  <li>Soil parameters are literature-informed assumptions, not site investigation data.</li>
                  <li>Detection confidence is an interpretable heuristic, not a calibrated probability.</li>
                  <li>Population and asset locations are approximate unless replaced with official registries.</li>
                  <li>Antecedent wetness is scenario-driven, not live ERA5/IMD assimilation.</li>
                </ul>
              </Section>
            </div>
            <div className="border-t border-[#249344]/40 p-3 flex justify-end">
              <button
                onClick={() => setShowProvenance(false)}
                className="px-3 py-1.5 rounded bg-[#BDFF42] text-[#04100a] text-[11px] font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeParams(p) {
  const out = {};
  Object.entries(p || {}).forEach(([k, v]) => {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  });
  return out;
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="font-semibold text-[#BDFF42] text-xs mb-1">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function ImpactRow({ icon, label, value, tone, small }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px]">
      <span style={{ color: tone }} className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[#5E8B67]">{label}</div>
        <div style={{ color: tone }} className={small ? 'text-[9px] leading-tight truncate whitespace-normal' : 'font-data font-bold'}>
          {value}
        </div>
      </div>
    </div>
  );
}
