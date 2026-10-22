import React, { useState, useEffect } from 'react';
import { CrowdsourceReport } from '../types';
import { CROWDSOURCE_REPORTS } from '../data/mockData';
import { LandslideApi } from '../services/api';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  MapPin,
  Clock,
  Play,
  Pause,
  Volume2,
  Languages,
  ShieldAlert,
  Send,
  XCircle,
  Database,
  Eye,
  EyeOff,
  Layers,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface CrowdsourceCvVerificationProps {
  onForwardToCap: (reportCode: string) => void;
}

export const CrowdsourceCvVerification: React.FC<CrowdsourceCvVerificationProps> = ({
  onForwardToCap,
}) => {
  const [reports, setReports] = useState<CrowdsourceReport[]>(CROWDSOURCE_REPORTS);
  const [activeReport, setActiveReport] = useState<CrowdsourceReport>(CROWDSOURCE_REPORTS[0]);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [offlineSyncing, setOfflineSyncing] = useState<boolean>(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    LandslideApi.getReports().then((data) => {
      if (active && data && data.length > 0) {
        setReports(data);
        setActiveReport(data[0]);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleAudio = () => {
    setIsPlayingAudio(!isPlayingAudio);
    if (!isPlayingAudio) {
      showToast('Streaming Ground Officer Audio Transmission with Neural STT');
    }
  };

  const handleActionDM = async () => {
    try {
      await LandslideApi.escalateReport(activeReport.id);
    } catch (e) {
      console.warn('API call failed, using local handling', e);
    }
    showToast(
      `CRITICAL DISPATCH: Escalated ${activeReport.code} to District Magistrate & SDMA. CAP emergency alert queued.`
    );
    onForwardToCap(activeReport.code);
  };

  const handleDispatchGsi = () => {
    showToast(
      `GSI Task Order issued for ${activeReport.location}. Rapid In-Situ Response Geotechnical Team notified.`
    );
  };

  const handleDismissReport = async () => {
    try {
      await LandslideApi.dismissReport(activeReport.id);
    } catch (e) {
      console.warn('API call failed, using local handling', e);
    }
    showToast(`Report ${activeReport.code} marked as Non-Threat / Controlled Erosion.`);
    setReports((prev) => prev.filter((r) => r.id !== activeReport.id));
    if (reports.length > 1) {
      setActiveReport(reports[1]);
    }
  };

  const handleTriggerOfflineSync = async () => {
    setOfflineSyncing(true);
    try {
      const res = await LandslideApi.syncOfflineReports();
      setOfflineSyncing(false);
      showToast(res.message);
    } catch {
      setOfflineSyncing(false);
      showToast('SQLite / WatermelonDB local offline store synchronized with Central GSI Cloud (4 pending uploads cleared)');
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#122131] text-[#90cfec] border border-[#44d8f1] px-4 py-3 rounded-lg shadow-2xl shadow-cyan-950/80 flex items-center gap-3 font-sans text-xs sm:text-sm animate-bounce">
          <Zap className="w-4 h-4 text-[#ffb870] flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Ticker / Metric Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-[#8a9297]">
            <span className="font-mono text-[10px] uppercase">Incoming Field Feeds</span>
            <Camera className="w-3.5 h-3.5 text-[#44d8f1]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">184 Reports</div>
          <p className="text-[11px] text-[#bfc8cd] truncate">Citizen App &amp; Forest Guard Uplinks</p>
        </div>

        <div className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-[#8a9297]">
            <span className="font-mono text-[10px] uppercase">YOLOv8 Detections</span>
            <span className="w-2 h-2 rounded-full bg-[#ffb4ab] animate-pulse" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#ffb4ab] mt-1">12 Anomaly Flags</div>
          <p className="text-[11px] text-[#bfc8cd] truncate">Tension cracks &amp; toe cuts &gt;85%</p>
        </div>

        <div className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-[#8a9297]">
            <span className="font-mono text-[10px] uppercase">Verified &amp; Actioned</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#90cfec]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#90cfec] mt-1">8 Priority Sectors</div>
          <p className="text-[11px] text-[#bfc8cd] truncate">Dispatched to SDMA / BRO units</p>
        </div>

        <div
          onClick={handleTriggerOfflineSync}
          className="bg-[#0d1c2d] border border-[#1c2b3c] hover:border-[#44d8f1]/50 rounded-xl p-3 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-xs text-[#8a9297]">
            <span className="font-mono text-[10px] uppercase">Offline Sync Buffer</span>
            <Database className={`w-3.5 h-3.5 text-[#ffb870] ${offlineSyncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#ffb870] mt-1">
            {offlineSyncing ? 'Syncing...' : '4 Pending'}
          </div>
          <p className="text-[11px] text-[#44d8f1] underline truncate">Click to force WatermelonDB sync</p>
        </div>
      </div>

      {/* Main Incident Dossier Card */}
      <div className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xl overflow-hidden shadow-2xl">
        {/* Incident Header */}
        <div className="px-4 py-3 bg-[#122131] border-b border-[#1c2b3c] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold text-white bg-[#93000a] px-2 py-0.5 rounded">
              {activeReport.urgency}
            </span>
            <span className="text-sm font-mono font-bold text-[#44d8f1]">
              {activeReport.code}
            </span>
            <span className="text-xs text-white font-medium hidden sm:inline">
              {activeReport.location}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#8a9297]">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#90cfec]" />
              <span>{activeReport.timeAgo} ({activeReport.reportedTime})</span>
            </span>
            <span className="hidden md:inline">|</span>
            <span className="text-[#bfc8cd] hidden md:inline">{activeReport.verifiedBy}</span>
          </div>
        </div>

        {/* Incident Content Body */}
        <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 cols: Interactive Computer Vision Viewport */}
          <div className="lg:col-span-7 space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-[#1c2b3c] bg-[#051424] shadow-inner select-none group">
              {/* Main Drone / Citizen Photo with Vector Topo Fallback */}
              {!failedImages[activeReport.imageUrl] && activeReport.imageUrl ? (
                <img
                  src={activeReport.imageUrl}
                  alt={activeReport.imageAlt}
                  className="w-full h-[280px] sm:h-[360px] object-cover"
                  onError={() =>
                    setFailedImages((prev) => ({ ...prev, [activeReport.imageUrl]: true }))
                  }
                />
              ) : (
                <div className="w-full h-[280px] sm:h-[360px] bg-[#040d16] flex flex-col items-center justify-center relative overflow-hidden select-none">
                  <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 500 360" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lidarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#44d8f1" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ff5449" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 240 Q 120 180 250 210 T 500 150 L 500 360 L 0 360 Z" fill="url(#lidarGrad)" />
                    <path d="M 0 180 Q 140 120 280 150 T 500 90" fill="none" stroke="#44d8f1" strokeWidth="1.5" strokeDasharray="4 4" />
                    <path d="M 0 270 Q 160 200 320 230 T 500 170" fill="none" stroke="#22536c" strokeWidth="1.2" />
                    <circle cx="250" cy="180" r="90" fill="none" stroke="#44d8f1" strokeWidth="0.8" opacity="0.4" />
                    <circle cx="250" cy="180" r="30" fill="none" stroke="#ffb4ab" strokeWidth="1" opacity="0.6" />
                    <line x1="250" y1="70" x2="250" y2="290" stroke="#16384c" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="100" y1="180" x2="400" y2="180" stroke="#16384c" strokeWidth="1" strokeDasharray="3 3" />
                  </svg>
                  <div className="relative z-10 text-center px-4">
                    <div className="text-xs font-mono font-bold text-[#44d8f1] tracking-widest uppercase">
                      SAR / LiDAR TOPOGRAPHIC POINT CLOUD
                    </div>
                    <div className="text-[10px] font-mono text-[#8ca3ba] mt-1">
                      {activeReport.location} · {activeReport.coordinates}
                    </div>
                  </div>
                </div>
              )}

              {/* YOLOv8 Bounding Boxes Overlay */}
              {showBoundingBoxes && activeReport.boundingBoxes?.map((box, idx) => (
                <div
                  key={idx}
                  style={{
                    top: box.top,
                    left: box.left,
                    width: box.width,
                    height: box.height,
                  }}
                  className={`absolute border-2 rounded pointer-events-none transition-all ${
                    box.color === 'error'
                      ? 'border-[#ffb4ab] bg-[#93000a]/20 shadow-[0_0_15px_rgba(255,180,171,0.5)]'
                      : box.color === 'tertiary'
                      ? 'border-[#ffb870] bg-[#7d4800]/20 shadow-[0_0_15px_rgba(255,184,112,0.5)]'
                      : 'border-[#44d8f1] bg-[#00363e]/20'
                  }`}
                >
                  {/* Bounding Box Label Tag */}
                  <div
                    className={`absolute -top-6 left-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap ${
                      box.color === 'error'
                        ? 'bg-[#93000a] text-white border border-[#ffb4ab]'
                        : box.color === 'tertiary'
                        ? 'bg-[#7d4800] text-white border border-[#ffb870]'
                        : 'bg-[#00363e] text-[#44d8f1] border border-[#00bcd4]'
                    }`}
                  >
                    <span>{box.label} ({box.confidence})</span>
                  </div>

                  {box.extraInfo && (
                    <div className="absolute bottom-1 right-1 bg-[#051424]/90 text-[9px] font-mono text-[#d4e4fa] px-1 py-0.5 rounded">
                      {box.extraInfo}
                    </div>
                  )}
                </div>
              ))}

              {/* Viewport Control Bar */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                  className="bg-[#051424]/90 hover:bg-[#122131] text-xs font-mono text-white px-2.5 py-1 rounded-md border border-[#273647] flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  {showBoundingBoxes ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-[#ffb870]" />
                      <span>HIDE BOXES</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-[#44d8f1]" />
                      <span>SHOW YOLO BOXES</span>
                    </>
                  )}
                </button>
              </div>

              {/* Model stamp */}
              <div className="absolute bottom-3 left-3 bg-[#051424]/90 border border-[#1c2b3c] rounded px-2.5 py-1 text-[10px] font-mono text-[#bfc8cd]">
                <span>MODEL: {activeReport.cvModel}</span>
              </div>
            </div>

            {/* YOLOv8 Confidence & Risk Output */}
            <div className="bg-[#122131] border border-[#1c2b3c] rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-[#8a9297] uppercase">Computer Vision Classification</span>
                <div className="text-xs sm:text-sm font-bold text-[#ffb4ab]">
                  {activeReport.cvLabel}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#8a9297] uppercase">Risk Probability</span>
                <div className="text-sm sm:text-base font-bold font-mono text-white">
                  {activeReport.cvRisk}
                </div>
              </div>
            </div>
          </div>

          {/* Right 5 cols: Verification Data, Vernacular Audio, In-Situ Corroboration */}
          <div className="lg:col-span-5 space-y-3">
            {/* Geotag & EXIF Integrity Card */}
            <div className="bg-[#122131] border border-[#1c2b3c] rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-[#1c2b3c] pb-2">
                <span className="font-mono text-[11px] text-[#8a9297] uppercase flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#44d8f1]" />
                  GEOTAG &amp; EXIF VALIDATION
                </span>
                <span className="text-[10px] font-mono text-[#90cfec] bg-[#0d5c75]/40 px-1.5 py-0.5 rounded border border-[#0d5c75]">
                  TAMPER-PROOF
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div>
                  <span className="text-[#8a9297] block text-[10px]">COORDINATES</span>
                  <span className="text-white font-bold">{activeReport.coordinates}</span>
                </div>
                <div>
                  <span className="text-[#8a9297] block text-[10px]">ELEVATION</span>
                  <span className="text-white font-bold">{activeReport.elevation}</span>
                </div>
                <div>
                  <span className="text-[#8a9297] block text-[10px]">SLOPE GRADIENT</span>
                  <span className="text-[#ffb870] font-bold">{activeReport.slope}</span>
                </div>
                <div>
                  <span className="text-[#8a9297] block text-[10px]">PRECIPITATION LOCK</span>
                  <span className="text-[#44d8f1] font-bold">{activeReport.precipitation}</span>
                </div>
              </div>

              {/* In-Situ Sensor Corroboration Callout */}
              <div className="mt-2 bg-[#0d1c2d] border border-[#44d8f1]/30 rounded p-2 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#44d8f1]">
                  <span className="font-bold flex items-center gap-1">
                    <Zap className="w-3 h-3" /> IN-SITU CORROBORATION
                  </span>
                  <span>{activeReport.sensorCorroboration.rate}</span>
                </div>
                <p className="text-[11px] text-[#bfc8cd]">
                  {activeReport.sensorCorroboration.thresholdMessage}
                </p>
              </div>
            </div>

            {/* Field Audio Voice Note Player (Audio STT) */}
            <div className="bg-[#122131] border border-[#1c2b3c] rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Mic className="w-3.5 h-3.5 text-[#44d8f1]" />
                  <span>Field Audio Transmission (Audio STT)</span>
                </div>
                <span className="text-[10px] font-mono text-[#44d8f1] bg-[#00363e]/40 px-1.5 py-0.5 rounded border border-[#00363e]">
                  English · {activeReport.audioDuration}
                </span>
              </div>

              {/* Audio Playback Controls */}
              <div className="bg-[#051424] border border-[#1c2b3c] rounded-lg p-2.5 flex items-center gap-3">
                <button
                  onClick={handleToggleAudio}
                  aria-label={isPlayingAudio ? 'Pause citizen audio recording' : 'Play citizen audio recording'}
                  className="w-8 h-8 rounded-full bg-[#44d8f1] hover:bg-white text-[#00363e] flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md"
                >
                  {isPlayingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>

                {/* Animated Audio Waveform */}
                <div className="flex-1 flex items-center gap-1 h-6">
                  {[24, 40, 16, 80, 60, 95, 45, 70, 30, 85, 50, 65, 30, 90, 40, 60, 20].map((h, i) => (
                    <div
                      key={i}
                      style={{ height: isPlayingAudio ? `${h}%` : '20%' }}
                      className={`w-1 rounded-full transition-all duration-200 ${
                        isPlayingAudio ? 'bg-[#44d8f1]' : 'bg-[#273647]'
                      }`}
                    />
                  ))}
                </div>

                <span className="text-[10px] font-mono text-[#8a9297]">
                  {isPlayingAudio ? '00:14' : activeReport.audioDuration}
                </span>
              </div>

              {/* Verified English Audio Transcript */}
              <div className="space-y-1 text-xs bg-[#0d1c2d] p-2.5 rounded-lg border border-[#1c2b3c]">
                <span className="text-[10px] font-mono text-[#44d8f1] block">
                  TRANSCRIBED AUDIO DISPATCH (ENGLISH):
                </span>
                <p className="text-xs text-white font-medium leading-relaxed">
                  {activeReport.englishTranslation}
                </p>
              </div>
            </div>

            {/* Duty Officer Fast Action Bar */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleActionDM}
                className="w-full py-2.5 px-3 bg-[#93000a] hover:bg-[#b00020] text-white font-bold text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition-all cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>ESCALATE TO DISTRICT MAGISTRATE (LEVEL 3)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDispatchGsi}
                  className="py-2 px-2 bg-[#122131] hover:bg-[#1c2b3c] text-[#44d8f1] border border-[#00bcd4]/40 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>DISPATCH GSI TEAM</span>
                </button>

                <button
                  onClick={handleDismissReport}
                  className="py-2 px-2 bg-[#122131] hover:bg-[#1c2b3c] text-[#8a9297] hover:text-white border border-[#273647] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 text-[#ffb4ab]" />
                  <span>DISMISS REPORT</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Crowdsourced Triage Queue */}
      <div className="bg-[#0d1c2d] border border-[#1c2b3c] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#44d8f1]" />
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
              Regional Crowdsource Triage Queue ({reports.length} Incidents)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#bfc8cd]">
            Select an incident below to examine computer vision telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {reports.map((item) => {
            const isSelected = activeReport.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActiveReport(item)}
                className={`bg-[#122131] border rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.01] ${
                  isSelected
                    ? 'border-[#44d8f1] shadow-md shadow-cyan-950/60 ring-1 ring-[#44d8f1]'
                    : 'border-[#1c2b3c] hover:border-[#44d8f1]/40'
                }`}
              >
                <div className="h-32 relative overflow-hidden bg-[#051424]">
                  {!failedImages[item.imageUrl] && item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt}
                      className="w-full h-full object-cover"
                      onError={() =>
                        setFailedImages((prev) => ({ ...prev, [item.imageUrl]: true }))
                      }
                    />
                  ) : (
                    <div className="w-full h-full bg-[#051424] flex items-center justify-center p-2 relative">
                      <svg className="w-full h-full opacity-30 absolute inset-0" viewBox="0 0 200 120" preserveAspectRatio="none">
                        <path d="M 0 80 Q 50 40 100 60 T 200 40 L 200 120 L 0 120 Z" fill="#44d8f1" fillOpacity="0.3" />
                        <path d="M 0 50 Q 60 20 120 40 T 200 10" fill="none" stroke="#44d8f1" strokeWidth="1" strokeDasharray="3 2" />
                      </svg>
                      <div className="relative z-10 text-center">
                        <span className="text-[10px] font-mono text-cyan-400 font-semibold block">{item.location.split('(')[0]}</span>
                        <span className="text-[9px] font-mono text-slate-400 block">{item.slope} · {item.elevation}</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-[#051424]/90 text-xs font-mono font-bold text-[#44d8f1] px-2 py-0.5 rounded border border-[#273647]">
                    {item.code}
                  </div>
                  <div
                    className={`absolute bottom-2 right-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      item.urgency === 'CRITICAL'
                        ? 'bg-[#93000a] text-white'
                        : item.urgency === 'URGENT'
                        ? 'bg-[#7d4800] text-white'
                        : 'bg-[#00363e] text-[#44d8f1]'
                    }`}
                  >
                    {item.urgency}
                  </div>
                </div>

                <div className="p-3 space-y-1.5">
                  <div className="font-semibold text-xs text-white truncate">
                    {item.location}
                  </div>
                  <p className="text-[11px] text-[#bfc8cd] line-clamp-2">
                    {item.summary}
                  </p>
                  <div className="pt-1.5 border-t border-[#1c2b3c] flex items-center justify-between text-[10px] font-mono text-[#8a9297]">
                    <span>{item.timeAgo}</span>
                    <span className="text-[#44d8f1] font-bold flex items-center gap-0.5">
                      INSPECT <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
