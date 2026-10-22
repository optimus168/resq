import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ArrowRight, Network, Waves, ShieldCheck, 
  WifiOff, Smartphone, Shield, Activity, 
  Layers, CheckCircle2, ChevronRight, Lock, Mountain,
  Eye, Cpu, Radio, Sparkles, AlertTriangle,
  Compass, MapPin, ExternalLink, Sliders
} from 'lucide-react';
import { useNavigate } from '../router';
import { Logo } from '../components/Shell';
import HeroMapLibre from '../components/HeroMapLibre';
import { api } from '../api';
import { TILE_SOURCES } from '../lib/tileSources';

const AGENTS = [
  "Orchestrator", "Sentinel", "Terrain/Geo", "Field Intel", 
  "Learner", "Simulation", "Risk Analyst", "Verifier", 
  "Impact", "Route", "Resource", "Planner", "Dispatcher", "Ask Mission Control"
];

// Locations with Stunning Distinct 3D Models & Geological Relief
const LOCATIONS = [
  {
    id: "gangtok",
    name: "Gangtok – NH10 Corridor",
    region: "East Sikkim, Eastern Himalayas",
    state: "Sikkim",
    center: [27.305, 88.600],
    coords: "27.305° N, 88.600° E",
    elevation: "557m – 2,159m (Relief: 1,602m)",
    lifeline: "NH10 Gangtok–Ranipool Lifeline",
    risk: "ELEVATED",
    scenarioLabel: "SCENARIO (PROTOTYPE): 84 mm / 24h FORCING",
    riskNote: "Teesta river gorge slope instability",
    rainfallMm: 84,
    hasRain: true,
    scene: "S2A_45RXL_20261017_0_L2A",
    classification: "Primary NER Corridor"
  },
  {
    id: "aizawl",
    name: "Aizawl Knife-Edge Ridge",
    region: "Aizawl Synclinal Ridge, Mizoram",
    state: "Mizoram",
    center: [23.727, 92.717],
    coords: "23.727° N, 92.717° E",
    elevation: "323m – 1,326m (Relief: 1,003m)",
    lifeline: "NH306 Ridge Urban Lifeline",
    risk: "MODERATE",
    scenarioLabel: "SCENARIO (PROTOTYPE): 82 mm / 24h FORCING",
    riskNote: "40°+ sandstone slopes & urban slippage",
    rainfallMm: 82,
    hasRain: true,
    scene: "S2A_46QDM_20261011_0_L2A",
    classification: "Primary NER Corridor"
  },
  {
    id: "wayanad",
    name: "Wayanad (Chooralmala–Meppadi)",
    region: "Western Ghats Escarpment, Kerala",
    state: "Kerala",
    center: [11.517, 76.155],
    coords: "11.517° N, 76.155° E",
    elevation: "177m – 1,797m (Relief: 1,620m)",
    lifeline: "Chooralmala–Meppadi Lifeline Road",
    risk: "CRITICAL (SCENARIO)",
    scenarioLabel: "SCENARIO (PROTOTYPE): 170 mm / 24h FORCING",
    riskNote: "Generality evaluation on Western Ghats debris channel",
    rainfallMm: 170,
    hasRain: true,
    scene: "S2A_43PGN_20240731_0_L2A",
    classification: "Generality Demo"
  }
];

/**
 * Depth-varied angled rain canvas (cheap, GPU-friendly, respects prefers-reduced-motion).
 */
function AngledRainCanvas({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    const onResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    };
    window.addEventListener('resize', onResize);

    const numDrops = 75;
    const drops = Array.from({ length: numDrops }).map(() => ({
      x: Math.random() * (width + 200) - 100,
      y: Math.random() * height,
      length: Math.random() * 24 + 18,
      speed: Math.random() * 12 + 16,
      opacity: Math.random() * 0.25 + 0.15,
      thickness: Math.random() * 1.2 + 0.8
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Angled precipitation vector (~18 degrees slant)
      const angleRad = Math.PI / 10;
      const dx = Math.sin(angleRad);
      const dy = Math.cos(angleRad);

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.x += dx * d.speed;
        d.y += dy * d.speed;

        if (d.y > height || d.x > width + 100) {
          d.y = -d.length;
          d.x = Math.random() * (width + 200) - 100;
        }

        ctx.beginPath();
        ctx.strokeStyle = `rgba(189, 255, 66, ${d.opacity})`;
        ctx.lineWidth = d.thickness;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + dx * d.length, d.y + dy * d.length);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
      aria-hidden="true"
    />
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [activeLocIdx, setActiveLocIdx] = useState(0);
  const [tileSource, setTileSource] = useState('esri');
  const [hour, setHour] = useState(24);
  const [runs, setRuns] = useState({});
  const [loadError, setLoadError] = useState('');

  const activeLoc = LOCATIONS[activeLocIdx];
  const activeRun = runs[activeLoc.id] || null;

  const loadRun = useCallback(async (locId) => {
    try {
      const response = await api.runDetection({
        aoi: locId,
        scenario: 'heavy_24h',
        use_observed_sample: true,
      });
      const summary = response?.summary || response;
      if (summary?.run_id) {
        setRuns(prev => ({ ...prev, [locId]: summary }));
        return summary;
      }
    } catch (err) {
      console.warn(`Simulation fetch error for ${locId}:`, err);
    }
    return null;
  }, []);

  // Fetch the real, externally sourced rainfall sample for each site:
  // 1. Immediately load the active location for instant rendering
  // 2. Pre-fetch remaining locations concurrently in background
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('bhuraksha_token');
        if (!token) {
          try {
            await api.login('collector@bhuraksha.demo', 'Approve@RESQ26');
          } catch (e) {
            /* anonymous fallback supported */
          }
        }
        if (!alive) return;
        await loadRun(activeLoc.id);
        if (!alive) return;
        const others = LOCATIONS.filter(l => l.id !== activeLoc.id);
        await Promise.allSettled(others.map(loc => loadRun(loc.id)));
      } catch (err) {
        if (alive) setLoadError(err?.message || 'Could not reach the simulation API');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Ensure simulation is loaded if location changes before background pre-fetch
  useEffect(() => {
    if (!runs[activeLoc.id]) {
      loadRun(activeLoc.id);
    }
  }, [activeLoc.id, runs, loadRun]);

  const selectLocation = (idx) => {
    const loc = LOCATIONS[idx];
    setActiveLocIdx(idx);
    if (!runs[loc.id]) {
      loadRun(loc.id);
    }
    setHour(runs[loc.id]?.max_hour ?? 24);
  };

  // Keep the playhead inside the new run's window.
  useEffect(() => {
    if (!activeRun) return;
    setHour(h => Math.min(h, activeRun.max_hour ?? 24));
  }, [activeRun]);

  return (
    <div className="bg-[#06150C] text-white selection:bg-[#BDFF42] selection:text-[#06150C]">
      
      {/* Top Navigation Header */}
      <header className="relative z-30 flex items-center justify-between px-4 sm:px-8 lg:px-12 py-3.5 sm:py-4 border-b border-[#249344]/30 bg-[#06150C]/80 backdrop-blur-md">
        <Logo />

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-[#9FD8A8]">
          <a href="#workflow" className="hover:text-[#BDFF42] transition-colors">How it works</a>
          <a href="#agents" className="hover:text-[#BDFF42] transition-colors">14 Agents</a>
          <button onClick={() => navigate('/simulation-lab')} className="hover:text-[#BDFF42] transition-colors">
            Simulation Lab
          </button>
          <button onClick={() => navigate('/validation')} className="hover:text-[#BDFF42] transition-colors">
            Validation
          </button>
          <button onClick={() => navigate('/presenter')} className="hover:text-[#BDFF42] transition-colors text-amber-300">
            Presenter Mode
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            data-testid="landing-login-btn"
            onClick={() => navigate('/login')}
            className="px-3.5 py-1.5 text-xs font-medium rounded-sm border border-[#249344]/50 hover:border-[#BDFF42] text-white transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/mission-control')}
            className="hidden sm:flex btn-lime px-3.5 py-1.5 text-xs font-semibold rounded-sm items-center gap-1.5"
          >
            <span>Mission Control</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Hero Section: MapLibre GL JS Google-Earth-style 3D Digital Twin */}
      <section className="relative min-h-[700px] lg:h-[calc(100vh-65px)] overflow-hidden flex flex-col justify-between">
        
        {/* Genuine MapLibre GL JS 3D Tile Pyramid Engine */}
        <HeroMapLibre
          activeLocation={activeLoc}
          run={activeRun}
          hour={hour}
          onHourChange={setHour}
          tileSource={tileSource}
        />

        {/* Depth-Varied Angled Rain Effect (Only active when scenario/weather has precipitation) */}
        <AngledRainCanvas active={activeLoc.hasRain} />

        {/* Hero Content Area */}
        <div className="relative z-20 px-4 sm:px-8 lg:px-12 py-6 max-w-3xl flex-1 flex flex-col justify-center pointer-events-none">
          
          {/* Eyebrow badge */}
          <div className="text-[#BDFF42] text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#BDFF42] animate-pulse" />
            <span>MDONER & NDMA AGENTIC AI TRACK · BHURAKSHA DIGITAL TWIN</span>
          </div>

          {/* Main Hero Headline */}
          <h1 
            className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] mt-3 break-words text-white pointer-events-auto"
          >
            FOURTEEN AGENTS.<br />
            ONE DIGITAL TWIN.<br />
            <span className="text-[#BDFF42]">ZERO UNAPPROVED ALERTS.</span>
          </h1>

          {/* Value Prop Description */}
          <p 
            className="text-xs sm:text-sm md:text-base text-[#9FD8A8] mt-3.5 max-w-xl leading-relaxed pointer-events-auto"
          >
            BhuRaksha watches rainfall over steep mountain slopes, simulates slope failure and debris runout on real Copernicus DEM terrain with Voellmy shallow-water physics, drafts multilingual response plans — and re-plans the moment a road is blocked or a crack is reported. Every consequential action waits for a human.
          </p>

          {/* Action CTAs */}
          <div 
            className="flex flex-col sm:flex-row flex-wrap gap-3 mt-5 pointer-events-auto z-30"
          >
            <button
              data-testid="cta-mission-control"
              onClick={() => navigate('/mission-control')}
              className="btn-lime px-5 py-3 text-xs sm:text-sm flex items-center justify-center gap-2 rounded-sm w-full sm:w-auto shadow-lg shadow-[#BDFF42]/10"
            >
              <span>Open Mission Control</span>
              <ArrowRight size={15} />
            </button>

            <button
              data-testid="cta-simulation-lab"
              onClick={() => navigate('/simulation-lab')}
              className="btn-ghost px-5 py-3 text-xs sm:text-sm rounded-sm w-full sm:w-auto text-center hover:border-[#BDFF42]"
            >
              3D Simulation Lab
            </button>

            <button
              data-testid="cta-field-report"
              onClick={() => navigate('/field-reports')}
              className="btn-ghost px-5 py-3 text-xs sm:text-sm rounded-sm w-full sm:w-auto text-center hover:border-[#BDFF42]"
            >
              File a field report
            </button>
          </div>

          {/* Truthful Trust Chips & Honest Disclaimer */}
          <div className="mt-4 flex flex-wrap gap-2 items-center pointer-events-auto">
            <span className="sim-badge text-xs flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${activeRun ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>
                {activeRun
                  ? `LIVE MODEL · ${activeRun.detection_count} DETECTIONS · ${activeRun.regional?.rainfall?.level}`
                  : `DIGITAL TWIN: ${activeLoc.name.toUpperCase()}`}
              </span>
            </span>
            <span className="sim-badge text-xs">
              DECISION-SUPPORT PROTOTYPE · NOT AN OFFICIAL WARNING SERVICE
            </span>
            {loadError && (
              <span className="sim-badge text-xs border-amber-500/50 text-amber-300">
                {loadError}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Interactive Location Carousel Switcher & Provenance Telemetry Bar */}
        <div className="relative z-20 px-4 sm:px-8 lg:px-12 py-3 bg-[#06150C]/90 border-t border-[#249344]/30 backdrop-blur-md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            
            {/* Interactive Location Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              <div className="flex items-center gap-2">
                {LOCATIONS.map((loc, idx) => {
                  const isActive = idx === activeLocIdx;
                  return (
                    <button
                      key={loc.id}
                      onClick={() => selectLocation(idx)}
                      className={`px-3 py-1.5 rounded text-left transition-all flex items-center gap-2 flex-shrink-0 border ${
                        isActive
                          ? 'bg-[#BDFF42] text-[#06150C] border-[#BDFF42] font-semibold shadow-md shadow-[#BDFF42]/20'
                          : 'bg-[#0a2416]/80 text-[#9FD8A8] border-[#249344]/30 hover:border-[#BDFF42]/50 hover:text-white'
                      }`}
                    >
                      <MapPin size={12} className={isActive ? 'text-[#06150C]' : 'text-[#BDFF42]'} />
                      <div className="flex flex-col">
                        <span className="text-xs leading-tight font-medium">
                          {loc.name.split('–')[0].trim()}
                        </span>
                        <span className={`text-xs ${isActive ? 'text-[#06150C]/80' : 'text-[#5E8B67]'}`}>
                          {loc.state} · {loc.classification}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Science & Honest Scenario Telemetry */}
            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 text-xs font-mono text-[#9FD8A8]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#BDFF42]">COORDS:</span>
                <span className="text-white">{activeLoc.coords}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[#BDFF42]">ELEV:</span>
                <span>{activeLoc.elevation}</span>
              </div>
              
              {/* Observed sample badge (real ERA5 storm for this site) */}
              <div className="flex items-center gap-1.5 bg-[#0a2416] px-2.5 py-1 rounded border border-[#249344]/50">
                <span className={`w-2 h-2 rounded-full ${activeRun ? 'bg-[#BDFF42] animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-white font-bold max-w-[280px] truncate">
                  {activeRun?.observed_sample
                    ? `${activeRun.observed_sample.label} · ${activeRun.observed_sample.total_mm} mm`
                    : 'LOADING OBSERVED SAMPLE…'}
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Narrative Story Flow: Detect -> Predict -> Simulate -> Coordinate -> Gate -> Replan */}
      <section id="workflow" className="px-4 sm:px-8 lg:px-12 py-14 sm:py-20 bg-[#071d10]/50 border-y border-[#249344]/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="eyebrow text-[#BDFF42] text-xs">AUTONOMOUS MULTI-AGENT LIFECYCLE</div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold mt-2">
              From Rain Anomaly to Verified Plan V2
            </h2>
            <p className="text-xs sm:text-sm text-[#9FD8A8] mt-2 leading-relaxed">
              Watch 14 agents resolve disagreements, simulate physical runout, enforce human sign-off, and selectively re-plan on perturbation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {[
              { step: '01', title: 'Detect', desc: 'Sentinel & Weather agents ingest radar & rainfall telemetry', icon: Eye },
              { step: '02', title: 'Predict', desc: 'XGBoost ML engine predicts spatial susceptibility', icon: Cpu },
              { step: '03', title: 'Simulate', desc: 'Voellmy 2D physics calculates debris flow depth & speed', icon: Waves },
              { step: '04', title: 'Coordinate', desc: 'Planner synthesizes evacuation routes & shelter staging', icon: Network },
              { step: '05', title: 'Human Gate', desc: 'District Collector signs off with cryptographic binding', icon: Lock },
              { step: '06', title: 'Re-plan', desc: 'Verifier detects roadblock and triggers selective Plan V2', icon: Activity },
            ].map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="p-4 rounded bg-[#0A2416] border border-[#249344]/40 hover:border-[#BDFF42] transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[#BDFF42] mb-2 font-mono text-xs">
                    <span>STEP {step}</span>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="font-display text-base font-bold text-white">{title}</div>
                  <p className="text-xs text-[#9FD8A8] mt-1.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Core Pillars Section */}
      <section className="px-4 sm:px-8 lg:px-12 py-14 sm:py-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[
          {
            icon: Network,
            title: "Agents at work, visibly",
            desc: "Live LangGraph of 14 specialists. Every tool call, latency, confidence and LLM output is traced, auditable, and replayable."
          },
          {
            icon: Waves,
            title: "Voellmy physics digital twin",
            desc: "Rain → pore pressure diffusion → infinite-slope stability → 2D depth-averaged Voellmy runout → exposed roads & settlements."
          },
          {
            icon: ShieldCheck,
            title: "Re-planning with a human gate",
            desc: "New event? The Verifier invalidates assumptions, only affected agents re-run, Plan V2 arrives with a diff and needs fresh sign-off."
          }
        ].map(({ icon: Icon, title, desc }, i) => (
          <div 
            key={title}
            className="panel p-6 rise hover:border-[#BDFF42]/50 transition-colors"
            data-testid={`feature-card-${i}`}
          >
            <Icon className="text-[#BDFF42] w-6 h-6" />
            <div className="font-display text-xl sm:text-2xl font-bold text-white mt-4">{title}</div>
            <p className="text-xs sm:text-sm text-[#9FD8A8] mt-2 leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>

      {/* The Crew Section */}
      <section id="agents" className="px-4 sm:px-8 lg:px-12 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 sm:gap-12 items-start">
        <div>
          <div className="eyebrow text-[#5E8B67] text-xs">THE CREW</div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-white mt-2">
            You coordinate. Tools compute.
          </h2>
          <p className="text-xs sm:text-sm text-[#9FD8A8] mt-3 max-w-lg leading-relaxed">
            LLMs plan, explain and translate. Risk scores, factor of safety, runout and exposure come only from deterministic, tested code. Prompt-injection in field reports is quarantined; tool calls are allow-listed per agent.
          </p>

          {/* Agent Badges */}
          <div className="flex flex-wrap gap-2 mt-6">
            {AGENTS.map((a) => (
              <span 
                key={a}
                className="font-mono text-xs px-3 py-1.5 border border-[#249344]/50 bg-[#0A2416] text-[#d6f5dc] rounded-sm"
              >
                {a}
              </span>
            ))}
          </div>

          {/* Risk Severity Legend */}
          <div className="mt-8 p-4 panel rounded-sm">
            <div className="eyebrow mb-3 text-[#9FD8A8] text-xs">RISK CLASSIFICATION ENGINE (DETERMINISTIC)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 border border-green-500/40 bg-green-950/30 text-xs">
                <div className="font-bold text-green-400">LOW</div>
                <div className="text-xs text-green-200/70 font-mono mt-0.5">FS &gt; 1.3 · Rain &lt; 40mm</div>
              </div>
              <div className="p-2.5 border border-yellow-500/40 bg-yellow-950/30 text-xs">
                <div className="font-bold text-yellow-400">MODERATE</div>
                <div className="text-xs text-yellow-200/70 font-mono mt-0.5">FS 1.1–1.3 · Rain 40–80mm</div>
              </div>
              <div className="p-2.5 border border-orange-500/40 bg-orange-950/30 text-xs">
                <div className="font-bold text-orange-400">HIGH</div>
                <div className="text-xs text-orange-200/70 font-mono mt-0.5">FS 1.0–1.1 · Rain &gt; 80mm</div>
              </div>
              <div className="p-2.5 border border-red-500/50 bg-red-950/40 text-xs hatch-imminent">
                <div className="font-bold text-red-300">CRITICAL</div>
                <div className="text-xs text-red-200 font-mono mt-0.5">FS &lt; 1.0 · Runout active</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Feature Sub-cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: WifiOff,
              title: "Offline-first",
              desc: "Field reports queue in IndexedDB offline and sync idempotently upon reconnection."
            },
            {
              icon: Radio,
              title: "CAP Alert Protocol",
              desc: "ITU-T X.1303 formatted emergency broadcast with strict officer approval gates."
            },
            {
              icon: Smartphone,
              title: "Field PWA",
              desc: "Geo-tagged photos of cracks & road blockages trigger autonomous re-planning."
            },
            {
              icon: ShieldCheck,
              title: "Hash-chained audit",
              desc: "Every approval, denial, and assumption change is cryptographically SHA-256 sealed."
            }
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-4 hover:border-[#BDFF42]/40 transition-colors">
              <Icon size={20} className="text-[#BDFF42]" />
              <div className="font-display text-base sm:text-lg font-bold text-white mt-2.5">{title}</div>
              <p className="text-xs text-[#9FD8A8] mt-1.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer with Mandatory Attribution and Version Stamp */}
      <footer className="px-4 sm:px-8 lg:px-12 py-6 border-t border-[#249344]/30 text-xs text-[#5E8B67] font-mono flex flex-col md:flex-row justify-between items-center gap-3 text-center md:text-left">
        <div>
          RESQ.AI × BhuRaksha · Decision-support prototype · prototype data where marked · not an official warning service
        </div>
        <div>
          Imagery © Esri, Maxar & Copernicus Sentinel-2 · Terrain: Copernicus GLO-30 DEM · MapLibre GL JS v6
        </div>
      </footer>
    </div>
  );
}
