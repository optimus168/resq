import React, { useState, useEffect } from 'react';
import { HazardZone, OperationalModule } from '../types';
import { LIVE_VIEW_IMAGES } from '../data/mockData';
import {
  MapPin,
  Search,
  AlertTriangle,
  Zap,
  CloudRain,
  Droplets,
  TrendingUp,
  Map,
  BellRing,
  ShieldAlert,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Shield,
  Activity,
  ArrowUpRight,
  Radio,
} from 'lucide-react';
import { useI18n } from '../i18n/index.tsx';

interface TerraDashboardProps {
  selectedZone: HazardZone;
  onSelectZone: (zone: HazardZone) => void;
  zones: HazardZone[];
  onNavigate: (module: OperationalModule) => void;
  theme: 'dark' | 'light';
}

export const TerraDashboard: React.FC<TerraDashboardProps> = ({
  selectedZone,
  onSelectZone,
  zones,
  onNavigate,
  theme,
}) => {
  const { t } = useI18n();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchLocation, setSearchLocation] = useState(selectedZone.name);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    setSearchLocation(selectedZone.name);
  }, [selectedZone]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % LIVE_VIEW_IMAGES.length);
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + LIVE_VIEW_IMAGES.length) % LIVE_VIEW_IMAGES.length);
  };

  // High & Medium warning zones
  const warningZones = zones.filter(
    (z) => z.riskStatus === 'CRITICAL RED' || z.riskStatus === 'ADVISORY ORANGE'
  );

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Top Search & Live Time Bar (Screen 2 Mockup) */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0d1c2d] border-[#1c2b3c] text-white'
        }`}
      >
        {/* Location Dropdown / Search */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <MapPin className="w-4 h-4 text-emerald-500" />
            </div>
            <select
              value={selectedZone.id}
              onChange={(e) => {
                const z = zones.find((item) => item.id === e.target.value);
                if (z) onSelectZone(z);
              }}
              className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm font-semibold border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-[#122131] border-[#273647] text-white'
              }`}
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.subDivision})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              <span className="text-xs">▼</span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('risk-details')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm tracking-wide shadow cursor-pointer transition-all flex-shrink-0"
          >
            {t('dashboard.check')}
          </button>
        </div>

        {/* Live Date / Time & Status Indicator */}
        <div className="flex items-center gap-3 self-end md:self-auto text-xs font-mono">
          <span className="text-slate-500 dark:text-slate-400">
            {currentTime || 'Mon, 2 Sep 2024 03:45 PM'}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-bold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {t('dashboard.liveData')}
          </span>
        </div>
      </div>

      {/* Main Grid: Current Risk Level + Live Optical View (Screen 2 Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Current Risk Level Card (7 cols) */}
        <div
          className={`lg:col-span-7 p-6 rounded-2xl border flex flex-col justify-between shadow-md ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0d1c2d] border-[#1c2b3c] text-white'
          }`}
        >
          <div>
            <span className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
              {t('dashboard.currentRiskLevel')}
            </span>

            {/* Risk Badge Header */}
            <div className="mt-3 flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  selectedZone.riskStatus === 'CRITICAL RED'
                    ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}
              >
                <AlertTriangle className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-red-500 tracking-tight">
                  {selectedZone.riskStatus === 'CRITICAL RED' ? t('dashboard.highRisk') : t('dashboard.moderateRisk')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {t('dashboard.riskWindow')}
                </p>
              </div>
            </div>

            {/* Key Metrics Strip (Screen 2 Mockup) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {/* Metric 1: Risk Score */}
              <div
                className={`p-3 rounded-xl border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#122131] border-[#1c2b3c]'
                }`}
              >
                <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Zap className="w-3.5 h-3.5 text-red-400" />
                  {t('dashboard.riskScore')}
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-red-500 block mt-1">
                  {selectedZone.rfConfidence || '78%'}
                </span>
              </div>

              {/* Metric 2: 24h Rainfall */}
              <div
                className={`p-3 rounded-xl border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#122131] border-[#1c2b3c]'
                }`}
              >
                <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                  {t('dashboard.rainfall24h')}
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-cyan-400 block mt-1">
                  120 mm
                </span>
              </div>

              {/* Metric 3: Soil Moisture */}
              <div
                className={`p-3 rounded-xl border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#122131] border-[#1c2b3c]'
                }`}
              >
                <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Droplets className="w-3.5 h-3.5 text-amber-400" />
                  {t('dashboard.soilMoisture')}
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-amber-400 block mt-1">
                  {selectedZone.soilPoreSaturation}
                </span>
              </div>

              {/* Metric 4: Slope Angle */}
              <div
                className={`p-3 rounded-xl border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#122131] border-[#1c2b3c]'
                }`}
              >
                <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                  {t('dashboard.slopeAngle')}
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono text-white block mt-1">
                  {selectedZone.slopeGradient}
                </span>
              </div>
            </div>
          </div>

          {/* Safety Advisory Banner */}
          <div className="mt-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="font-medium">
              Heavy rainfall and vulnerable terrain detected along {selectedZone.highwaySegment}.
              Avoid non-essential travel to high-risk areas.
            </span>
          </div>
        </div>

        {/* Right: Live View Carousel Card (5 cols) */}
        <div
          className={`lg:col-span-5 p-6 rounded-2xl border flex flex-col justify-between shadow-md ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0d1c2d] border-[#1c2b3c] text-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                {t('dashboard.liveView')}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                UAV QUAD-402
              </span>
            </div>

            {/* Interactive Vector UAV Reconnaissance Feed */}
            <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-700/50 group h-52 sm:h-56 bg-[#040d14] flex flex-col justify-between p-3 select-none">
              {/* Radar Grid & Topographic Contour Lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 400 240" preserveAspectRatio="none">
                <defs>
                  <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#44d8f1" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#44d8f1" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* Coordinate Crosshairs */}
                <line x1="0" y1="120" x2="400" y2="120" stroke="#16384c" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="200" y1="0" x2="200" y2="240" stroke="#16384c" strokeWidth="1" strokeDasharray="4 4" />
                
                {/* Elevation Contours */}
                <path d="M 20 200 Q 120 140 200 160 T 380 110" fill="none" stroke="#22536c" strokeWidth="1.2" />
                <path d="M 0 170 Q 140 100 220 130 T 400 80" fill="none" stroke="#22536c" strokeWidth="1.2" />
                <path d="M 0 130 Q 160 70 240 100 T 400 50" fill="none" stroke="#22536c" strokeWidth="1.2" />

                {/* Thermal Hotspot Polygon depending on sector */}
                {currentImageIndex === 0 && (
                  <ellipse cx="230" cy="115" rx="55" ry="32" fill="#ff5449" fillOpacity="0.25" stroke="#ff5449" strokeWidth="1.5" strokeDasharray="3 2" />
                )}
                {currentImageIndex === 1 && (
                  <ellipse cx="180" cy="140" rx="70" ry="40" fill="#ff897d" fillOpacity="0.25" stroke="#ff897d" strokeWidth="1.5" strokeDasharray="3 2" />
                )}
                {currentImageIndex === 2 && (
                  <ellipse cx="260" cy="90" rx="45" ry="25" fill="#ffb870" fillOpacity="0.25" stroke="#ffb870" strokeWidth="1.5" strokeDasharray="3 2" />
                )}

                {/* Target Lock Reticle */}
                <circle cx="200" cy="120" r="38" fill="none" stroke="#44d8f1" strokeWidth="1" opacity="0.6" />
                <circle cx="200" cy="120" r="14" fill="none" stroke="#44d8f1" strokeWidth="1.5" />
                <line x1="200" y1="95" x2="200" y2="105" stroke="#44d8f1" strokeWidth="2" />
                <line x1="200" y1="135" x2="200" y2="145" stroke="#44d8f1" strokeWidth="2" />
                <line x1="175" y1="120" x2="185" y2="120" stroke="#44d8f1" strokeWidth="2" />
                <line x1="215" y1="120" x2="225" y2="120" stroke="#44d8f1" strokeWidth="2" />
              </svg>

              {/* HUD Header Bar */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800/60 uppercase">
                    {LIVE_VIEW_IMAGES[currentImageIndex].label}
                  </span>
                </div>
                <div className="text-[9px] font-mono text-cyan-300 bg-[#051c2c]/80 px-2 py-0.5 rounded border border-cyan-800/50">
                  OPT-SAR · 4K FLIR
                </div>
              </div>

              {/* HUD Center Data Vector */}
              <div className="relative z-10 my-auto text-center pointer-events-none">
                <div className="text-[10px] font-mono text-cyan-400/90 tracking-widest font-semibold">
                  TARGET LOCK: SECTOR {currentImageIndex + 1}
                </div>
                <div className="text-[9px] font-mono text-slate-400">
                  ALT 1,480m · FOV 64° · AZ 142° · PITCH -28°
                </div>
              </div>

              {/* HUD Bottom Info Bar */}
              <div className="relative z-10 bg-[#020b12]/90 backdrop-blur-sm p-2 rounded-lg border border-slate-800/80">
                <p className="text-xs font-semibold text-white truncate">
                  {LIVE_VIEW_IMAGES[currentImageIndex].caption}
                </p>
                <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-400">
                  <span className="text-cyan-400">{LIVE_VIEW_IMAGES[currentImageIndex].time}</span>
                  <span className="text-emerald-400">PkW-SAR LOCK: STABLE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Carousel Slider Controls < 1/3 > */}
          <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
            <button
              onClick={handlePrevImage}
              className="p-1 rounded hover:bg-slate-700/40 text-slate-300 cursor-pointer"
              title="Previous drone scan"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span>
              {currentImageIndex + 1} / {LIVE_VIEW_IMAGES.length}
            </span>

            <button
              onClick={handleNextImage}
              className="p-1 rounded hover:bg-slate-700/40 text-slate-300 cursor-pointer"
              title="Next drone scan"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Quick Action Cards (Screen 2 Mockup) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Action 1: View Risk Map */}
        <div
          onClick={() => onNavigate('risk-map')}
          className={`p-4 rounded-xl border flex items-center gap-3.5 transition-all cursor-pointer group hover:shadow-md ${
            theme === 'light'
              ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
              : 'bg-[#0d1c2d] hover:bg-[#122131] border-[#1c2b3c] text-white'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <Map className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold truncate">{t('dashboard.viewRiskMap')}</h4>
            <p className="text-[11px] text-slate-400 truncate">{t('dashboard.exploreRiskZones')}</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
        </div>

        {/* Action 2: Check Alerts */}
        <div
          onClick={() => onNavigate('alerts')}
          className={`p-4 rounded-xl border flex items-center gap-3.5 transition-all cursor-pointer group hover:shadow-md ${
            theme === 'light'
              ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
              : 'bg-[#0d1c2d] hover:bg-[#122131] border-[#1c2b3c] text-white'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <BellRing className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold truncate">{t('dashboard.checkAlerts')}</h4>
            <p className="text-[11px] text-slate-400 truncate">{t('dashboard.latestWarnings')}</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
        </div>

        {/* Action 3: Emergency SOS */}
        <div
          onClick={() => onNavigate('emergency-sos')}
          className={`p-4 rounded-xl border flex items-center gap-3.5 transition-all cursor-pointer group hover:shadow-md ${
            theme === 'light'
              ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
              : 'bg-[#0d1c2d] hover:bg-[#122131] border-[#1c2b3c] text-white'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold truncate">{t('dashboard.emergencySos')}</h4>
            <p className="text-[11px] text-slate-400 truncate">{t('dashboard.getHelpNow')}</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
        </div>

        {/* Action 4: Nearby Helplines */}
        <div
          onClick={() => onNavigate('emergency-sos')}
          className={`p-4 rounded-xl border flex items-center gap-3.5 transition-all cursor-pointer group hover:shadow-md ${
            theme === 'light'
              ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
              : 'bg-[#0d1c2d] hover:bg-[#122131] border-[#1c2b3c] text-white'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold truncate">{t('dashboard.nearbyHelplines')}</h4>
            <p className="text-[11px] text-slate-400 truncate">{t('dashboard.importantContacts')}</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
        </div>
      </div>

      {/* High and Medium Warning Zones Live Telemetry Summary (User Request) */}
      <div
        className={`p-6 rounded-2xl border shadow-sm ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0d1c2d] border-[#1c2b3c] text-white'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>{t('dashboard.warningZones')}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('dashboard.warningZonesDescription')}
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-red-500/10 text-red-500 border border-red-500/30">
            {warningZones.length} {t('dashboard.corridorsActive')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {warningZones.map((zone) => (
            <div
              key={zone.id}
              onClick={() => {
                onSelectZone(zone);
                onNavigate('risk-details');
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] shadow-sm ${
                zone.riskStatus === 'CRITICAL RED'
                  ? 'border-red-500/40 bg-red-500/5 hover:border-red-500'
                  : 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm truncate">{zone.name}</span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    zone.riskStatus === 'CRITICAL RED'
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {zone.riskStatus === 'CRITICAL RED' ? 'HIGH' : 'MODERATE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{zone.corridor}</p>

              {/* Data metrics */}
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('dashboard.rain24h')}</span>
                  <span className="font-bold text-cyan-500">120 mm</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SOIL MOISTURE</span>
                  <span className="font-bold text-amber-500">{zone.soilPoreSaturation}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SLOPE GRADIENT</span>
                  <span className="font-bold text-slate-200 dark:text-white">{zone.slopeGradient}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{t('dashboard.leadTimeEvac')}</span>
                  <span className="font-bold text-emerald-500">{zone.lstmEvac}</span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-700/30 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">{zone.populationRunout}</span>
                <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                  {t('dashboard.inspect')} <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
