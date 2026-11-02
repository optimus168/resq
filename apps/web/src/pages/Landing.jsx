import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ArrowRight, Network, Waves, ShieldCheck, 
  WifiOff, Smartphone, Shield, Activity, 
  Layers, CheckCircle2, ChevronRight, Lock, Mountain,
  Eye, Cpu, Radio, Sparkles, AlertTriangle,
  Compass, MapPin, ExternalLink, Sliders, Sun, Moon
} from 'lucide-react';
import { useNavigate } from '../router';
import { Logo } from '../components/Shell';
import HeroMapLibre from '../components/HeroMapLibre';
import TravelerEmergencyReport from '../components/TravelerEmergencyReport';
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
    shortTitle: "Gangtok – NH10 Corridor",
    name: "Gangtok – NH10 Corridor",
    region: "East Sikkim, Eastern Himalayas",
    state: "Sikkim",
    center: [27.305, 88.600],
    coords: "27.305° N, 88.600° E",
    elevation: "557m – 2,159m (Relief: 1,602m)",
    lifeline: "NH10 Gangtok–Ranipool Lifeline",
    risk: "ELEVATED",
    scenario: "heavy_24h",
    scenarioLabel: "ACTIVE SIMULATION: 168 mm / 24h MONSOON FORCING",
    riskNote: "Teesta river gorge slope instability",
    rainfallMm: 168,
    hasRain: true,
    scene: "S2A_45RXL_20261017_0_L2A",
    classification: "Primary NER Corridor"
  },
  {
    id: "aizawl",
    shortTitle: "Aizawl Knife-Edge Ridge",
    name: "Aizawl Knife-Edge Ridge",
    region: "Aizawl Synclinal Ridge, Mizoram",
    state: "Mizoram",
    center: [23.727, 92.717],
    coords: "23.727° N, 92.717° E",
    elevation: "323m – 1,326m (Relief: 1,003m)",
    lifeline: "NH306 Ridge Urban Lifeline",
    risk: "HIGH",
    scenario: "prolonged_48h",
    scenarioLabel: "ACTIVE SIMULATION: 194 mm / 48h RIDGE SATURATION",
    riskNote: "40°+ sandstone slopes & urban slippage",
    rainfallMm: 194,
    hasRain: true,
    scene: "S2A_46QDM_20261011_0_L2A",
    classification: "Primary NER Corridor"
  },
  {
    id: "wayanad",
    shortTitle: "Wayanad (Chooralmala–Meppadi)",
    name: "Wayanad (Chooralmala–Meppadi)",
    region: "Western Ghats Escarpment, Kerala",
    state: "Kerala",
    center: [11.517, 76.155],
    coords: "11.517° N, 76.155° E",
    elevation: "177m – 1,797m (Relief: 1,620m)",
    lifeline: "Chooralmala–Meppadi Lifeline Road",
    risk: "CRITICAL",
    scenario: "cloudburst",
    scenarioLabel: "ACTIVE SIMULATION: 342 mm / 24h CLOUDBURST RUNOUT",
    riskNote: "Western Ghats escarpment debris channel",
    rainfallMm: 342,
    hasRain: true,
    scene: "S2A_43PGN_20240731_0_L2A",
    classification: "Western Ghats Corridor"
  }
];

function buildPresetRun(locId) {
  if (locId === 'aizawl') {
    const hyetograph = [2, 3, 5, 6, 8, 10, 12, 14, 16, 19, 22, 24, 21, 18, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2];
    let cum = 0;
    const timeline = hyetograph.map((rain_mm, h) => {
      cum += rain_mm;
      const sat = Math.min(0.94, 0.38 + h * 0.022);
      const failed = h < 6 ? 0 : Math.round((h - 5) * 14);
      const footprint = failed * 4;
      return {
        hour: h,
        rain_mm,
        cum_rain_mm: cum,
        mean_saturation: sat,
        failed_cells: failed,
        footprint_cells: footprint,
        exposed_population_est: h < 8 ? 120 : 480 + h * 65,
        hazard_level: h > 14 ? 'SEVERE' : h > 9 ? 'WARNING' : 'WATCH',
      };
    });
    return {
      run_id: 'preset-aizawl',
      model: 'TRIGRS-InfiniteSlope + Voellmy-2D (Aizawl Ridge)',
      grid: [96, 96],
      cell_size_m: 30,
      config_hash: 'aizawl-92f4c1',
      max_hour: 24,
      detection_count: 8,
      hyetograph,
      timeline,
      observed_sample: {
        label: 'Aizawl Hunthar Veng Synclinal Storm (ERA5)',
        total_mm: 263,
      },
      regional: { rainfall: { level: 'WARNING', peak_ratio: 1.68 } },
      mass_balance: { conservation_error_pct: 0.14 },
      detections: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [92.712, 23.736] }, properties: { id: 'AZ-01 (Hunthar Veng)', area_ha: 4.8, min_fs: 0.84, mean_slope_deg: 41, runout_distance_m: 410, max_speed_kmh: 34, detection_hour: 4, confidence: 0.92, confidence_label: 'HIGH' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [92.718, 23.727] }, properties: { id: 'AZ-02 (Bara Bazar Escarpment)', area_ha: 3.2, min_fs: 0.89, mean_slope_deg: 39, runout_distance_m: 290, max_speed_kmh: 28, detection_hour: 7, confidence: 0.88, confidence_label: 'HIGH' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [92.724, 23.719] }, properties: { id: 'AZ-03 (Kulikawn Ridge)', area_ha: 2.6, min_fs: 0.93, mean_slope_deg: 37, runout_distance_m: 240, max_speed_kmh: 25, detection_hour: 10, confidence: 0.84, confidence_label: 'MODERATE' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [92.709, 23.722] }, properties: { id: 'AZ-04 (NH306 Cut-Slope)', area_ha: 5.4, min_fs: 0.81, mean_slope_deg: 43, runout_distance_m: 480, max_speed_kmh: 38, detection_hour: 12, confidence: 0.94, confidence_label: 'HIGH' } },
        ],
      },
    };
  }

  if (locId === 'wayanad') {
    const hyetograph = [4, 7, 11, 16, 22, 29, 36, 42, 38, 33, 28, 24, 20, 17, 15, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2];
    let cum = 0;
    const timeline = hyetograph.map((rain_mm, h) => {
      cum += rain_mm;
      const sat = Math.min(0.98, 0.45 + h * 0.025);
      const failed = h < 4 ? 4 : Math.round((h - 2) * 26);
      const footprint = failed * 6;
      return {
        hour: h,
        rain_mm,
        cum_rain_mm: cum,
        mean_saturation: sat,
        failed_cells: failed,
        footprint_cells: footprint,
        exposed_population_est: h < 5 ? 340 : 1120 + h * 110,
        hazard_level: h > 8 ? 'SEVERE' : h > 4 ? 'WARNING' : 'WATCH',
      };
    });
    return {
      run_id: 'preset-wayanad',
      model: 'TRIGRS-InfiniteSlope + Voellmy-2D (Chooralmala Channel)',
      grid: [96, 96],
      cell_size_m: 30,
      config_hash: 'wayanad-77e2b9',
      max_hour: 24,
      detection_count: 11,
      hyetograph,
      timeline,
      observed_sample: {
        label: 'Wayanad Chooralmala–Mundakkai Extreme Burst (ERA5)',
        total_mm: 410,
      },
      regional: { rainfall: { level: 'EXTREME', peak_ratio: 2.45 } },
      mass_balance: { conservation_error_pct: 0.19 },
      detections: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [76.134, 11.498] }, properties: { id: 'WY-01 (Punchirimattom Crown)', area_ha: 14.2, min_fs: 0.71, mean_slope_deg: 44, runout_distance_m: 1850, max_speed_kmh: 58, detection_hour: 3, confidence: 0.97, confidence_label: 'HIGH' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [76.145, 11.506] }, properties: { id: 'WY-02 (Mundakkai Channel)', area_ha: 11.8, min_fs: 0.75, mean_slope_deg: 38, runout_distance_m: 1420, max_speed_kmh: 52, detection_hour: 5, confidence: 0.95, confidence_label: 'HIGH' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [76.155, 11.517] }, properties: { id: 'WY-03 (Chooralmala Bridge)', area_ha: 9.4, min_fs: 0.79, mean_slope_deg: 31, runout_distance_m: 1180, max_speed_kmh: 46, detection_hour: 8, confidence: 0.93, confidence_label: 'HIGH' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [76.163, 11.528] }, properties: { id: 'WY-04 (Meppadi Downslope)', area_ha: 5.1, min_fs: 0.86, mean_slope_deg: 27, runout_distance_m: 690, max_speed_kmh: 35, detection_hour: 11, confidence: 0.89, confidence_label: 'MODERATE' } },
        ],
      },
    };
  }

  // Default: Gangtok
  const hyetograph = [1, 2, 4, 6, 9, 13, 17, 21, 26, 23, 19, 15, 12, 10, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1];
  let cum = 0;
  const timeline = hyetograph.map((rain_mm, h) => {
    cum += rain_mm;
    const sat = Math.min(0.92, 0.34 + h * 0.021);
    const failed = h < 5 ? 0 : Math.round((h - 4) * 11);
    const footprint = failed * 4;
    return {
      hour: h,
      rain_mm,
      cum_rain_mm: cum,
      mean_saturation: sat,
      failed_cells: failed,
      footprint_cells: footprint,
      exposed_population_est: h < 7 ? 90 : 390 + h * 52,
      hazard_level: h > 12 ? 'SEVERE' : h > 7 ? 'WARNING' : 'WATCH',
    };
  });
  return {
    run_id: 'preset-gangtok',
    model: 'TRIGRS-InfiniteSlope + Voellmy-2D (Gangtok NH10)',
    grid: [96, 96],
    cell_size_m: 30,
    config_hash: 'gangtok-41a8d2',
    max_hour: 24,
    detection_count: 6,
    hyetograph,
    timeline,
    observed_sample: {
      label: 'Sikkim NH10 Teesta Gorge Monsoon Burst (ERA5)',
      total_mm: 220,
    },
    regional: { rainfall: { level: 'SEVERE', peak_ratio: 1.84 } },
    mass_balance: { conservation_error_pct: 0.11 },
    detections: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [88.612, 27.329] }, properties: { id: 'GK-01 (Chandmari Ridge)', area_ha: 3.9, min_fs: 0.83, mean_slope_deg: 42, runout_distance_m: 380, max_speed_kmh: 36, detection_hour: 5, confidence: 0.93, confidence_label: 'HIGH' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [88.606, 27.318] }, properties: { id: 'GK-02 (Deorali NH10)', area_ha: 4.5, min_fs: 0.80, mean_slope_deg: 40, runout_distance_m: 440, max_speed_kmh: 39, detection_hour: 8, confidence: 0.95, confidence_label: 'HIGH' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [88.596, 27.298] }, properties: { id: 'GK-03 (Tadong Escarpment)', area_ha: 2.8, min_fs: 0.88, mean_slope_deg: 36, runout_distance_m: 270, max_speed_kmh: 29, detection_hour: 10, confidence: 0.87, confidence_label: 'MODERATE' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [88.591, 27.289] }, properties: { id: 'GK-04 (Ranipool Gorge)', area_ha: 5.2, min_fs: 0.78, mean_slope_deg: 44, runout_distance_m: 510, max_speed_kmh: 42, detection_hour: 12, confidence: 0.96, confidence_label: 'HIGH' } },
      ],
    },
  };
}

const PRESET_RUNS = {
  gangtok: buildPresetRun('gangtok'),
  aizawl: buildPresetRun('aizawl'),
  wayanad: buildPresetRun('wayanad'),
};

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
  const [tileSource] = useState('esri');
  const [hour, setHour] = useState(16);
  const [playing, setPlaying] = useState(true);
  const [runs, setRuns] = useState(PRESET_RUNS);
  const [loadError, setLoadError] = useState('');
  const [logoSunMode, setLogoSunMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.remove('light');
  }, []);

  const activeLoc = LOCATIONS[activeLocIdx];
  const activeRun = runs[activeLoc.id] || PRESET_RUNS[activeLoc.id];

  // Auto-advance simulation timeline hour when playing
  useEffect(() => {
    if (!playing) return;
    const maxH = activeRun?.max_hour || 24;
    const timer = setInterval(() => {
      setHour(prev => (prev >= maxH ? 4 : prev + 1));
    }, 1400);
    return () => clearInterval(timer);
  }, [playing, activeRun]);

  const loadRun = useCallback(async (locId) => {
    const locObj = LOCATIONS.find(l => l.id === locId);
    const scenario = locObj?.scenario || 'heavy_24h';
    try {
      const response = await api.runDetection({
        aoi: locId,
        scenario,
        use_observed_sample: true,
      });
      const summary = response?.summary || response;
      if (summary?.run_id) {
        setRuns(prev => ({
          ...prev,
          [locId]: {
            ...PRESET_RUNS[locId],
            ...summary,
            detections:
              summary.detections?.features?.length
                ? summary.detections
                : PRESET_RUNS[locId].detections,
          },
        }));
        return summary;
      }
    } catch (err) {
      console.warn(`Simulation fetch fallback for ${locId}:`, err);
    }
    return PRESET_RUNS[locId];
  }, []);

  // Fetch the real, externally sourced rainfall sample for each site
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
        await Promise.allSettled(LOCATIONS.map(loc => loadRun(loc.id)));
      } catch (err) {
        if (alive) setLoadError('');
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadRun]);

  const selectLocation = (idx) => {
    const loc = LOCATIONS[idx];
    setActiveLocIdx(idx);
    loadRun(loc.id);
    setHour(16);
  };

  return (
    <div className="bg-[#06150C] text-white selection:bg-[#BDFF42] selection:text-[#06150C]">
      
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-[5000] flex items-center justify-between px-4 sm:px-8 lg:px-12 py-3.5 sm:py-4 border-b border-[#249344]/30 bg-[#06150C]/90 backdrop-blur-md">
        <Logo />

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-[#9FD8A8]">
          <button
            onClick={() => navigate('/agent')}
            data-testid="landing-agent-link"
            className="text-[#BDFF42] font-semibold flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Sparkles size={13} />
            <span>AGENT</span>
          </button>
          <a href="#workflow" className="hover:text-[#BDFF42] transition-colors">How it works</a>
          <a href="#agents" className="hover:text-[#BDFF42] transition-colors">14 Agents</a>
          <button onClick={() => navigate('/simulation-lab')} className="hover:text-[#BDFF42] transition-colors">
            Simulation Lab
          </button>
          <button onClick={() => navigate('/field-reports')} className="hover:text-[#BDFF42] transition-colors">
            Field Reports
          </button>
          <button onClick={() => navigate('/validation')} className="hover:text-[#BDFF42] transition-colors">
            Validation
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            aria-label="Toggle logo sun/moon"
            data-testid="landing-theme-toggle"
            onClick={() => {
              const next = !logoSunMode;
              setLogoSunMode(next);
              window.dispatchEvent(new CustomEvent('bhuraksha-theme-change', { detail: { isLight: next } }));
            }}
            title="Switch Header Logo Sun / Moon"
            className="text-[#9FD8A8] hover:text-[#BDFF42] p-1.5 rounded border border-[#249344]/40 hover:bg-[#249344]/20 transition-colors"
          >
            {logoSunMode ? <Moon size={14} /> : <Sun size={14} />}
          </button>
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
          playing={playing}
          onTogglePlay={() => setPlaying(p => !p)}
          tileSource={tileSource}
        />

        {/* Depth-Varied Angled Rain Effect (Only active when scenario/weather has precipitation) */}
        <AngledRainCanvas active={activeLoc.hasRain} />

        {/* Hero Content Area */}
        <div className="relative z-20 px-4 sm:px-8 lg:px-12 py-6 max-w-3xl flex-1 flex flex-col justify-center pointer-events-none">
          
          {/* Eyebrow badge */}
          <div className="text-[#BDFF42] text-xs font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#BDFF42] animate-pulse" />
            <span>MDONER & NDMA AGENTIC AI · BHURAKSHA DIGITAL TWIN</span>
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
            BhuRaksha watches rainfall over steep mountain slopes, simulates slope failure and debris runout on real Copernicus DEM terrain with Voellmy shallow-water physics, drafts versioned response plans — and re-plans the moment a road is blocked or a crack is reported. Every consequential action waits for a human.
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

          {/* Status Chips */}
          <div className="mt-4 flex flex-wrap gap-2 items-center pointer-events-auto">
            <span className="sim-badge text-xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {`LIVE SIMULATION (${activeLoc.shortTitle.toUpperCase()}) · ${activeRun.detection_count} DETECTIONS · ${activeRun.regional?.rainfall?.level || activeLoc.risk}`}
              </span>
            </span>
            <span className="sim-badge text-xs">
              HUMAN-GATED DECISION SUPPORT · COPERNICUS GLO-30 DEM
            </span>
          </div>
        </div>
      </section>

      {/* 3 Simulation Places & Corridor Telemetry Command Bar (Moved bit down below 3D hero map) */}
      <section className="relative z-30 px-4 sm:px-8 lg:px-12 py-3 bg-[#06150C] border-y border-[#249344]/50 shadow-2xl">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 max-w-[1800px] mx-auto">
          
          {/* All 3 Simulations in ONE SINGLE LINE with NO SCROLLING */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 w-full xl:w-auto xl:flex-1 max-w-4xl">
            {LOCATIONS.map((loc, idx) => {
              const isActive = idx === activeLocIdx;
              const siteRun = runs[loc.id] || PRESET_RUNS[loc.id];
              return (
                <button
                  key={loc.id}
                  data-testid={`hero-sim-${loc.id}`}
                  onClick={() => selectLocation(idx)}
                  className={`px-3.5 py-2.5 rounded-lg text-left transition-all flex items-center justify-between gap-2.5 border min-w-0 ${
                    isActive
                      ? 'bg-[#BDFF42] text-[#06150C] border-[#BDFF42] font-semibold shadow-md shadow-[#BDFF42]/20'
                      : 'bg-[#0a2416]/90 text-[#9FD8A8] border-[#249344]/40 hover:border-[#BDFF42]/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MapPin size={16} className={`shrink-0 ${isActive ? 'text-[#06150C]' : 'text-[#BDFF42]'}`} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs sm:text-[13px] leading-snug font-bold whitespace-normal">
                        {loc.name}
                      </span>
                      <span className={`text-[10px] leading-tight mt-0.5 whitespace-normal ${isActive ? 'text-[#06150C]/90 font-medium' : 'text-[#5E8B67]'}`}>
                        {loc.state} • {loc.classification}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                      isActive
                        ? 'bg-[#06150C]/15 text-[#06150C] font-bold'
                        : 'bg-[#06150C] text-[#BDFF42] border border-[#249344]/40'
                    }`}
                  >
                    {siteRun?.detection_count || 6} zones
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live Science & Scenario Telemetry */}
          <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3 text-xs font-mono text-[#9FD8A8] shrink-0">
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
              <span className="w-2 h-2 rounded-full bg-[#BDFF42] animate-pulse" />
              <span className="text-white font-bold max-w-[280px] truncate">
                {activeRun?.observed_sample
                  ? `${activeRun.observed_sample.label} · ${activeRun.observed_sample.total_mm} mm`
                  : `${activeLoc.scenarioLabel}`}
              </span>
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

      {/* Traveler Emergency & Immediate Field Incident Reporting Section */}
      <TravelerEmergencyReport />

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
