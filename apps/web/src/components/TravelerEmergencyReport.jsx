import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle, Camera, MapPin, Send, CheckCircle2, Phone,
  Upload, ShieldAlert, Sparkles, RefreshCw, Car, Waves, Mountain,
  Flame, Check, BellRing, Smartphone, Aperture
} from 'lucide-react';
import { http, errMsg } from '../lib/api';
import { toast } from '../lib/toast';
import CameraCaptureModal from './CameraCaptureModal';

const PRESET_CORRIDORS = [
  { id: 'gangtok', name: 'Gangtok – NH10 Corridor (Sikkim)', lat: 27.3135, lon: 88.6015 },
  { id: 'aizawl', name: 'Aizawl – NH306 Ridge (Mizoram)', lat: 23.7271, lon: 92.7176 },
  { id: 'wayanad', name: 'Wayanad – Chooralmala Ghat (Kerala)', lat: 11.5170, lon: 76.1550 },
  { id: 'shillong', name: 'Shillong – Mawlai Bypass (Meghalaya)', lat: 25.5950, lon: 91.8780 },
  { id: 'tupul', name: 'Tupul – NF Railway Lifeline (Manipur)', lat: 24.8690, lon: 93.6120 },
];

const HAZARD_CATEGORIES = [
  { id: 'slope_movement', label: 'Active Landslide / Debris', icon: Mountain, color: 'text-red-400 border-red-500/50 bg-red-950/30' },
  { id: 'rockfall', label: 'Rockfall / Boulders on Road', icon: AlertTriangle, color: 'text-orange-400 border-orange-500/50 bg-orange-950/30' },
  { id: 'blocked_road', label: 'Road Subsidence / Route Cut', icon: Car, color: 'text-amber-400 border-amber-500/50 bg-amber-950/30' },
  { id: 'cracks', label: 'Tension Cracks on Road Surface', icon: ShieldAlert, color: 'text-yellow-400 border-yellow-500/50 bg-yellow-950/30' },
  { id: 'stranded_vehicle', label: 'Stranded Vehicle / Trapped', icon: Car, color: 'text-red-300 border-red-400/60 bg-red-900/40' },
  { id: 'water', label: 'Mudflow / Flash Torrent', icon: Waves, color: 'text-sky-400 border-sky-500/50 bg-sky-950/30' },
  { id: 'other', label: 'Traveler Emergency SOS', icon: Flame, color: 'text-rose-400 border-rose-500/50 bg-rose-950/40' },
];

const SEVERITIES = [
  { id: 'CRITICAL', label: 'CRITICAL (Life Threat / Road Blocked)', desc: 'Immediate rescue & closure required', color: 'border-red-500 text-red-300 bg-red-950/50', active: 'bg-red-600 text-white border-red-400 font-bold shadow-lg shadow-red-900/40' },
  { id: 'HIGH', label: 'HIGH (Active Movement / Heavy Hazard)', desc: 'Pre-failure / Heavy debris on lane', color: 'border-orange-500 text-orange-300 bg-orange-950/40', active: 'bg-orange-500 text-[#06150C] border-orange-400 font-bold shadow-lg shadow-orange-900/30' },
  { id: 'MODERATE', label: 'MODERATE (Developing Hazard)', desc: 'Visible cracks / slow displacement', color: 'border-yellow-500 text-yellow-300 bg-yellow-950/30', active: 'bg-yellow-400 text-[#06150C] border-yellow-300 font-bold' },
  { id: 'LOW', label: 'LOW (Early Advisory)', desc: 'Minor raveling / precautionary note', color: 'border-emerald-500 text-emerald-300 bg-emerald-950/30', active: 'bg-emerald-500 text-[#06150C] border-emerald-400 font-bold' },
];

export default function TravelerEmergencyReport() {
  const [lat, setLat] = useState('27.3135');
  const [lon, setLon] = useState('88.6015');
  const [selectedCorridor, setSelectedCorridor] = useState('gangtok');
  const [category, setCategory] = useState('rockfall');
  const [severity, setSeverity] = useState('CRITICAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [travelerPhone, setTravelerPhone] = useState('');

  // Media state
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const nativeCameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Status state
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);

  const handleSelectCorridor = (cId) => {
    setSelectedCorridor(cId);
    const found = PRESET_CORRIDORS.find(c => c.id === cId);
    if (found) {
      setLat(found.lat.toFixed(5));
      setLon(found.lon.toFixed(5));
    }
  };

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const curLat = pos.coords.latitude.toFixed(5);
        const curLon = pos.coords.longitude.toFixed(5);
        setLat(curLat);
        setLon(curLon);
        setSelectedCorridor('custom');
        setGpsLoading(false);
        toast.success(`GPS Acquired: ${curLat}° N, ${curLon}° E (±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setGpsLoading(false);
        toast.error(`GPS Error: ${err.message}. Please select a mountain corridor from the list.`);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!lat || !lon) {
      toast.error('Please specify incident coordinates or use GPS detection');
      return;
    }
    if (!description.trim() && !title.trim()) {
      toast.error('Please provide a brief description of the emergency or road hazard');
      return;
    }

    setSubmitting(true);
    try {
      const clientId = `traveler_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fd = new FormData();
      fd.append('title', title.trim() || `Traveler Emergency (${category.replace('_', ' ').toUpperCase()})`);
      fd.append('lat', String(lat));
      fd.append('lon', String(lon));
      fd.append('category', category);
      fd.append('severity', severity);
      fd.append('notify_officer', 'true');
      fd.append('is_emergency', 'true');
      if (travelerPhone.trim()) {
        fd.append('traveler_phone', travelerPhone.trim());
      }
      fd.append('description', description.trim());
      fd.append('client_id', clientId);
      fd.append('captured_at', new Date().toISOString());

      if (photo) {
        fd.append('photo', photo, photo.name || 'emergency_photo.jpg');
      }

      const res = await http.post('/reports', fd);
      const data = res.data || {};
      setSubmittedResult(data);
      toast.success(
        `🚨 Emergency Alert Dispatched! SMS sent to On-Duty Disaster Officers (${data.officer_dispatch_id || 'Dispatched'})`
      );
    } catch (err) {
      toast.error(`Submission failed: ${errMsg(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedResult(null);
    setTitle('');
    setDescription('');
    setPhoto(null);
    setPhotoPreview(null);
    setTravelerPhone('');
    setSeverity('CRITICAL');
  };

  return (
    <section
      id="traveler-emergency-section"
      className="px-4 sm:px-8 lg:px-12 py-12 border-t-2 border-[#FFA31A]/60 bg-gradient-to-b from-[#091F11] via-[#05160C] to-[#020A05] text-white"
      data-testid="traveler-emergency-section"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Section Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFA31A]/15 border border-[#FFA31A]/50 text-[#FFA31A] text-xs font-mono font-bold tracking-wide animate-pulse">
            <BellRing size={14} />
            <span>IMMEDIATE TRAVELER EMERGENCY & FIELD REPORTING</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Caught in a Landslide, Rockfall, or Road Emergency?
          </h2>
          <p className="text-xs sm:text-sm text-[#9FD8A8] max-w-2xl mx-auto leading-relaxed">
            Anyone traveling across Himalayan corridors or mountain passes can report active hazards, blocked highways, or emergencies. Submitting this form <b>immediately transmits an urgent severity SMS alert directly to on-duty District Officers and Disaster Response Commanders</b>.
          </p>
        </div>

        {/* Confirmation Screen on Successful Dispatch */}
        {submittedResult ? (
          <div className="panel p-6 sm:p-8 rounded-2xl border-2 border-[#22C55E] bg-[#071F11] shadow-2xl space-y-5 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-[#22C55E]/20 border-2 border-[#22C55E] flex items-center justify-center text-[#22C55E] mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <div className="font-display text-xl sm:text-2xl font-bold text-white">
                EMERGENCY REPORT DISPATCHED TO ON-DUTY OFFICERS
              </div>
              <div className="text-xs font-mono text-[#BDFF42]">
                Official Dispatch ID: <b>{submittedResult.officer_dispatch_id || 'NTF-CONFIRMED'}</b> · Report ID: {submittedResult.id?.slice(0, 8)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#06150C] border border-[#249344]/50 max-w-lg mx-auto text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between border-b border-[#249344]/30 pb-1.5">
                <span className="text-[#9FD8A8]">Severity Level:</span>
                <span className="font-bold text-[#FFA31A]">{submittedResult.triage?.severity || severity}</span>
              </div>
              <div className="flex justify-between border-b border-[#249344]/30 pb-1.5">
                <span className="text-[#9FD8A8]">GPS Location:</span>
                <span className="text-white">{lat}° N, {lon}° E</span>
              </div>
              <div className="flex justify-between border-b border-[#249344]/30 pb-1.5">
                <span className="text-[#9FD8A8]">Target Officer Notification:</span>
                <span className="text-[#BDFF42] font-bold">Transmitted via TextBee SMS Gateway</span>
              </div>
              {submittedResult.triage?.sms_dispatch && (
                <div className="flex justify-between pt-0.5 text-[11px]">
                  <span className="text-[#9FD8A8]">SMS Dispatch Ref:</span>
                  <span className="text-[#7DD3FC]">{submittedResult.triage.sms_dispatch.sms_id || 'SMS-TRANSMITTED'}</span>
                </div>
              )}
            </div>

            <div className="text-xs text-[#9FD8A8] max-w-md mx-auto leading-relaxed">
              District Disaster Management Authorities, SDRF control rooms, and corridor patrol units have been alerted with your coordinates and report details.
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              className="btn-lime px-6 py-2.5 rounded-lg text-xs font-mono font-bold mx-auto flex items-center gap-2 shadow-md"
            >
              <Sparkles size={14} />
              <span>Submit Another Report</span>
            </button>
          </div>
        ) : (
          /* Emergency Form */
          <form
            onSubmit={handleSubmit}
            className="panel p-5 sm:p-7 rounded-2xl border border-[#249344]/60 bg-[#071D10] shadow-2xl space-y-5"
          >
            {/* Step 1: Coordinates & Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-mono uppercase text-[#BDFF42] font-bold flex items-center gap-1.5">
                  <MapPin size={14} />
                  <span>1. Incident Location & Mountain Corridor</span>
                </label>

                {/* 1-Click GPS Auto-Detect Button */}
                <button
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={gpsLoading}
                  className="btn-lime px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm"
                  title="Detect GPS location from device"
                >
                  <MapPin size={13} className={gpsLoading ? 'animate-bounce' : ''} />
                  <span>{gpsLoading ? 'Acquiring GPS…' : '📍 Use My Current GPS Location'}</span>
                </button>
              </div>

              {/* Corridor Preset Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <select
                    value={selectedCorridor}
                    onChange={(e) => handleSelectCorridor(e.target.value)}
                    className="w-full bg-[#06150C] border border-[#249344]/60 focus:border-[#BDFF42] rounded-lg px-3 py-2 text-xs text-white outline-none"
                  >
                    {PRESET_CORRIDORS.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="custom">Custom GPS Coordinates</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <div className="flex-1 flex items-center gap-1 bg-[#06150C] border border-[#249344]/60 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] font-mono text-[#5E8B67]">LAT:</span>
                    <input
                      type="number"
                      step="0.00001"
                      value={lat}
                      onChange={(e) => {
                        setLat(e.target.value);
                        setSelectedCorridor('custom');
                      }}
                      className="bg-transparent text-white text-xs font-mono outline-none w-full"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-1 bg-[#06150C] border border-[#249344]/60 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] font-mono text-[#5E8B67]">LON:</span>
                    <input
                      type="number"
                      step="0.00001"
                      value={lon}
                      onChange={(e) => {
                        setLon(e.target.value);
                        setSelectedCorridor('custom');
                      }}
                      className="bg-transparent text-white text-xs font-mono outline-none w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Emergency Category */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-[#BDFF42] font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>2. Hazard or Emergency Category</span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {HAZARD_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'border-[#BDFF42] bg-[#0A2416] text-white shadow-md'
                          : 'border-[#249344]/40 bg-[#06150C] text-[#9FD8A8] hover:border-[#BDFF42]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon size={16} className={isSelected ? 'text-[#BDFF42]' : 'text-[#5E8B67]'} />
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#BDFF42]" />}
                      </div>
                      <div className="text-[11px] font-semibold leading-tight">{cat.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Severity Level */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase text-[#FFA31A] font-bold flex items-center gap-1.5">
                  <ShieldAlert size={14} />
                  <span>3. Emergency Severity Level (Dispatched to Officers)</span>
                </label>
                <span className="text-[10px] font-mono text-[#FFA31A]">Defaults to Critical for traveler emergencies</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SEVERITIES.map((s) => {
                  const isSelected = severity === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeverity(s.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        isSelected ? s.active : s.color
                      }`}
                    >
                      <div className="font-bold font-mono text-xs">{s.id}</div>
                      <div className="text-[9px] mt-1 leading-tight opacity-90">{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Situation Description & Traveler Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8 space-y-2">
                <label className="text-xs font-mono uppercase text-[#BDFF42] font-bold">
                  4. Emergency Details & Location Landmarks
                </label>
                <input
                  type="text"
                  placeholder="Headline e.g., 'NH10 KM-18 Boulder Fall Blocking Ranipool Road'…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#06150C] border border-[#249344]/60 focus:border-[#BDFF42] rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
                <textarea
                  rows={3}
                  placeholder="Describe what you see: number of vehicles stuck, slope slide height, injuries, nearest bridge/milepost…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#06150C] border border-[#249344]/60 focus:border-[#BDFF42] rounded-lg px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="sm:col-span-4 space-y-2">
                <label className="text-xs font-mono uppercase text-[#BDFF42] font-bold flex items-center gap-1">
                  <Phone size={13} />
                  <span>Your Contact Phone</span>
                </label>
                <div className="flex items-center gap-1 bg-[#06150C] border border-[#249344]/60 rounded-lg px-2.5 py-2">
                  <span className="text-xs font-mono text-[#BDFF42] font-bold">+91</span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210 (10 digits)"
                    value={travelerPhone}
                    onChange={(e) => setTravelerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="bg-transparent text-white text-xs font-mono outline-none w-full"
                  />
                </div>
                <div className="text-[10px] text-[#9FD8A8] leading-tight">
                  Disaster Officers & SDRF patrol units will use this number to contact you immediately for location confirmation or rescue coordination.
                </div>
              </div>
            </div>

            {/* Step 5: Camera & Media Upload Option */}
            <div className="space-y-2 pt-1 border-t border-[#249344]/30">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase text-[#BDFF42] font-bold flex items-center gap-1.5">
                  <Camera size={14} />
                  <span>5. Live Camera / Photo Evidence (Optional)</span>
                </label>
                <span className="text-[10px] font-mono text-[#9FD8A8]">Upload via Camera supported</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Button 1: Live WebRTC Viewfinder Modal */}
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="btn-lime px-3.5 py-2 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Aperture size={14} />
                  <span>Take Photo with Camera</span>
                </button>

                {/* Button 2: Native Rear Camera File Picker */}
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="btn-ghost px-3 py-2 rounded-lg text-xs font-mono text-[#BDFF42] border border-[#BDFF42]/40 hover:bg-[#BDFF42]/10 flex items-center gap-1.5"
                >
                  <Smartphone size={14} />
                  <span>Snap Photo (Device App)</span>
                </button>
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhoto(f);
                      const reader = new FileReader();
                      reader.onload = () => setPhotoPreview(reader.result);
                      reader.readAsDataURL(f);
                    }
                  }}
                />

                {/* Button 3: Choose from Gallery / Files */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-ghost px-3 py-2 rounded-lg text-xs font-mono text-[#9FD8A8] hover:text-white border border-[#249344]/40 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  <span>{photo ? photo.name : 'From Files / Gallery'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhoto(f);
                      const reader = new FileReader();
                      reader.onload = () => setPhotoPreview(reader.result);
                      reader.readAsDataURL(f);
                    }
                  }}
                />
              </div>

              {/* Photo Preview thumbnail */}
              {photo && (
                <div className="p-2.5 rounded-lg bg-[#06150C] border border-[#249344]/50 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={photoPreview || (photo instanceof Blob ? URL.createObjectURL(photo) : photo)}
                      alt="Captured evidence"
                      className="h-12 w-16 rounded border border-[#BDFF42]/50 object-cover shrink-0"
                    />
                    <div className="truncate">
                      <div className="font-semibold text-white truncate text-[11px]">{photo.name || 'Camera Photo'}</div>
                      <div className="text-[10px] font-mono text-[#9FD8A8]">{(photo.size / 1024).toFixed(0)} KB · Ready to dispatch</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setPhotoPreview(null);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Submission Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#249344]/40">
              <div className="text-[11px] text-[#9FD8A8] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FFA31A] animate-ping" />
                <span>SMS alert will be sent <b>strictly to on-duty Officers</b> via TextBee Gateway.</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-lime w-full sm:w-auto px-6 py-3 rounded-xl text-xs sm:text-sm font-mono font-bold flex items-center justify-center gap-2 shadow-xl shadow-lime-500/20 disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>TRANSMITTING & ALERTING OFFICERS VIA SMS…</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>🚨 TRANSMIT EMERGENCY REPORT & ALERT ON-DUTY OFFICERS</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(file, dataUrl) => {
          setPhoto(file);
          setPhotoPreview(dataUrl);
        }}
        title="Capture Emergency Hazard Photo"
      />
    </section>
  );
}
