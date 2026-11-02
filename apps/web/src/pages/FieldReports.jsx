import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '../lib/toast';
import { http, errMsg, useAuth } from '../lib/api';
import CameraCaptureModal from '../components/CameraCaptureModal';
import {
  CheckCircle2, ShieldOff, Camera, Video, FileText, Bell, BellRing,
  MapPin, RefreshCw, Upload, AlertTriangle, Check, Aperture
} from 'lucide-react';

const QKEY = 'br_report_queue';
const loadQ = () => {
  try {
    return JSON.parse(localStorage.getItem(QKEY) || '[]');
  } catch {
    return [];
  }
};
const saveQ = q => localStorage.setItem(QKEY, JSON.stringify(q));

const PRESETS = [
  ['Gangtok – Tadong', 27.3135, 88.6015],
  ['Shillong – Mawlai', 25.595, 91.878],
  ['Aizawl – Hunthar', 23.72, 92.705],
  ['Tupul camp', 24.869, 93.612]
];

const SEVERITY_LEVELS = [
  { id: 'LOW', label: 'LOW', color: 'border-emerald-500/60 text-emerald-300 bg-emerald-950/40', active: 'bg-emerald-500 text-[#06150C] border-emerald-400 font-bold' },
  { id: 'MODERATE', label: 'MODERATE', color: 'border-yellow-500/60 text-yellow-300 bg-yellow-950/40', active: 'bg-yellow-400 text-[#06150C] border-yellow-300 font-bold' },
  { id: 'HIGH', label: 'HIGH', color: 'border-orange-500/60 text-orange-300 bg-orange-950/40', active: 'bg-orange-500 text-[#06150C] border-orange-400 font-bold' },
  { id: 'CRITICAL', label: 'CRITICAL', color: 'border-red-500/70 text-red-300 bg-red-950/50', active: 'bg-red-500 text-white border-red-400 font-bold' },
];

const severityBadgeStyle = (sev) => {
  switch ((sev || 'MODERATE').toUpperCase()) {
    case 'CRITICAL':
      return 'bg-red-500/20 border-red-500 text-red-300';
    case 'HIGH':
      return 'bg-orange-500/20 border-orange-500 text-orange-300';
    case 'LOW':
      return 'bg-emerald-500/20 border-emerald-500 text-emerald-300';
    default:
      return 'bg-yellow-500/20 border-yellow-500 text-yellow-300';
  }
};

const toDataUrl = f =>
  new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(f);
  });

async function dataUrlToBlob(u) {
  const res = await fetch(u);
  return res.blob();
}

export default function FieldReports() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: '',
    lat: '27.3135',
    lon: '88.6015',
    category: 'cracks',
    severity: 'HIGH',
    notify_officer: true,
    officer_phone: '',
    description: ''
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const nativeCameraInputRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [queue, setQueue] = useState(loadQ());
  const [forceOffline, setForceOffline] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    http.get('/reports')
      .then(r => setReports(r.data || []))
      .catch(() => {});
    http.get('/reports/notifications')
      .then(r => setNotifications(r.data || []))
      .catch(() => {});
  }, []);

  const sync = useCallback(async () => {
    const q = loadQ();
    if (!q.length || forceOffline || !navigator.onLine) return;
    setSyncing(true);
    const left = [];

    for (const item of q) {
      try {
        const fd = new FormData();
        ['title', 'lat', 'lon', 'category', 'severity', 'notify_officer', 'description', 'client_id', 'captured_at'].forEach(k => {
          if (item[k] !== undefined && item[k] !== null) fd.append(k, String(item[k]));
        });
        if (item.photo) {
          fd.append('photo', await dataUrlToBlob(item.photo), item.photoName || 'photo.jpg');
        }
        const r = await http.post('/reports', fd);
        toast.success(
          `Synced ${item.client_id.slice(0, 8)} · ${r.data.officer_notified ? 'Officer Notified' : 'Saved'}`
        );
      } catch (e) {
        if (e.response && e.response.status < 500) {
          toast.error(`Rejected: ${errMsg(e)}`);
        } else {
          left.push(item);
        }
      }
    }

    saveQ(left);
    setQueue(left);
    setSyncing(false);
    refresh();
  }, [forceOffline, refresh]);

  useEffect(() => {
    refresh();
    const on = () => {
      setOnline(true);
      sync();
    };
    const off = () => setOnline(false);

    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [sync, refresh]);

  useEffect(() => {
    if (!forceOffline) sync();
  }, [forceOffline, sync]);

  const geo = () => {
    navigator.geolocation?.getCurrentPosition(
      p =>
        setForm(f => ({
          ...f,
          lat: p.coords.latitude.toFixed(5),
          lon: p.coords.longitude.toFixed(5)
        })),
      () => toast.error('Location unavailable — pick a preset')
    );
  };

  const submit = async e => {
    e.preventDefault();
    if (!form.lat || !form.lon) return toast.error('Location coordinates required');
    if (photo && photo.size > 15 * 1024 * 1024) return toast.error('Photo must be ≤ 15 MB');
    if (video && video.size > 50 * 1024 * 1024) return toast.error('Video must be ≤ 50 MB');
    if (reportFile && reportFile.size > 25 * 1024 * 1024) return toast.error('Report file must be ≤ 25 MB');

    const clientId = `r${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const capturedAt = new Date().toISOString();

    // Direct online multipart upload for instant image + video + report file + officer notification
    if (!forceOffline && navigator.onLine) {
      setSubmitting(true);
      try {
        const fd = new FormData();
        fd.append('title', form.title || `${form.category.replace('_', ' ')} observation`);
        fd.append('lat', String(form.lat));
        fd.append('lon', String(form.lon));
        fd.append('category', form.category);
        fd.append('severity', form.severity);
        fd.append('notify_officer', String(form.notify_officer));
        if (form.officer_phone) fd.append('officer_phone', form.officer_phone);
        fd.append('description', form.description);
        fd.append('client_id', clientId);
        fd.append('captured_at', capturedAt);
        if (photo) fd.append('photo', photo, photo.name);
        if (video) fd.append('video', video, video.name);
        if (reportFile) fd.append('report_file', reportFile, reportFile.name);

        const res = await http.post('/reports', fd);
        const data = res.data || {};
        const smsNotice = data.triage?.sms_dispatch ? ' · SMS Sent to Officer (+91)' : '';
        toast.success(
          data.officer_notified
            ? `Report uploaded & Officer Notified (${data.officer_dispatch_id || 'Dispatched'})${smsNotice}`
            : `Report uploaded (${data.id?.slice(0, 8)})`
        );
        setForm(f => ({ ...f, title: '', description: '' }));
        setPhoto(null);
        setPhotoPreview(null);
        setVideo(null);
        setReportFile(null);
        refresh();
      } catch (err) {
        toast.error(`Upload failed: ${errMsg(err)}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Offline fallback queue
    const item = {
      ...form,
      client_id: clientId,
      captured_at: capturedAt,
      photo: photo ? await toDataUrl(photo) : null,
      photoName: photo?.name || null,
    };

    const q = [...loadQ(), item];
    try {
      saveQ(q);
    } catch {
      saveQ([...loadQ(), { ...item, photo: null }]);
      toast.warning('Media too large for offline storage — saved metadata offline');
    }

    setQueue(loadQ());
    setForm(f => ({ ...f, title: '', description: '' }));
    setPhoto(null);
    setPhotoPreview(null);
    setVideo(null);
    setReportFile(null);
    toast.info('Saved offline — will sync & notify officer on reconnect');
  };

  const verify = async (id, status) => {
    try {
      await http.post(`/reports/${id}/verify`, null, { params: { status } });
      refresh();
      toast.success(`Report ${id.slice(0, 8)}: ${status}`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const updateSeverity = async (id, newSeverity) => {
    try {
      const res = await http.post(`/reports/${id}/severity`, null, {
        params: { severity: newSeverity, notify_officer: true }
      });
      refresh();
      toast.success(
        `Officer updated severity → ${res.data?.severity || newSeverity} (Officer notified)`
      );
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const notifyOfficer = async (id) => {
    try {
      const res = await http.post(`/reports/${id}/notify-officer`);
      refresh();
      toast.success(`Notified District Collector & SDMA Officer (${res.data?.officer_dispatch_id})`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const acknowledgeNotification = async (id) => {
    try {
      await http.post(`/reports/${id}/acknowledge`);
      refresh();
      toast.success(`Officer acknowledged dispatch for report ${id.slice(0, 8)}`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const inp = 'w-full bg-[#06150C] border border-[#249344]/50 focus:border-[#BDFF42] px-3 py-2 text-xs rounded text-white outline-none';
  const offline = forceOffline || !online;
  const unackedNotifications = notifications.filter(n => !n.acknowledged);

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto space-y-3" data-testid="field-reports-page">
      {/* Officer Priority Notification Banner */}
      {unackedNotifications.length > 0 && (
        <div
          className="p-3 rounded-lg bg-[#0A2416] border border-[#BDFF42]/60 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
          data-testid="officer-notification-banner"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded bg-[#BDFF42]/20 text-[#BDFF42] shrink-0 mt-0.5">
              <BellRing size={16} className="animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-sm font-bold text-white uppercase tracking-wide">
                  Officer Dispatch Queue ({unackedNotifications.length} Active Alert{unackedNotifications.length > 1 ? 's' : ''})
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#BDFF42]/20 text-[#BDFF42] border border-[#BDFF42]/40">
                  DISTRICT COLLECTOR & SDMA DUTY OFFICER
                </span>
              </div>
              <div className="text-xs text-[#9FD8A8] mt-0.5">
                Latest: <b className="text-white">{unackedNotifications[0].title}</b> ({unackedNotifications[0].severity}) at {unackedNotifications[0].lat}, {unackedNotifications[0].lon} · Dispatch <span className="font-mono text-[#BDFF42]">{unackedNotifications[0].dispatch_id}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => acknowledgeNotification(unackedNotifications[0].id)}
              data-testid="ack-officer-notification-btn"
              className="btn-lime px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5"
            >
              <Check size={13} />
              <span>Acknowledge as Officer</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[440px_1fr] gap-4">
        {/* Left Column: Upload Field Report, Images, Video, Document & Severity */}
        <form onSubmit={submit} className="panel p-4 space-y-3 h-fit rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-xl sm:text-2xl text-white">Upload Field Report</div>
              <div className="text-[11px] text-[#9FD8A8]">Attach images, video, inspection docs & notify officer</div>
            </div>
            <span
              className={`font-data text-[10px] px-2 py-0.5 border rounded ${
                offline ? 'text-[#FFA31A] border-[#FFA31A]' : 'text-[#22C55E] border-[#22C55E]'
              }`}
              data-testid="connectivity-status"
            >
              {offline ? 'OFFLINE' : 'ONLINE'}
            </span>
          </div>

          {/* Report Title */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">Report Title / Subject</label>
            <input
              data-testid="report-title-input"
              className={inp}
              placeholder="e.g. NH10 KM-18 Retaining Wall Tension Crack & Debris"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>

          {/* Coords */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">Latitude</label>
              <input
                data-testid="report-lat-input"
                className={inp}
                placeholder="Latitude (e.g. 27.3135)"
                value={form.lat}
                onChange={e => setForm({ ...form, lat: e.target.value })}
                inputMode="decimal"
                aria-label="Latitude"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">Longitude</label>
              <input
                data-testid="report-lon-input"
                className={inp}
                placeholder="Longitude (e.g. 88.6015)"
                value={form.lon}
                onChange={e => setForm({ ...form, lon: e.target.value })}
                inputMode="decimal"
                aria-label="Longitude"
              />
            </div>
          </div>

          {/* GPS and presets */}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              data-testid="use-gps-btn"
              onClick={geo}
              className="btn-ghost px-2 py-1 text-[11px] flex items-center gap-1 rounded"
            >
              <MapPin size={11} /> GPS
            </button>
            {PRESETS.map(([n, la, lo], i) => (
              <button
                key={n}
                type="button"
                data-testid={`preset-location-${i}`}
                onClick={() => setForm({ ...form, lat: String(la), lon: String(lo) })}
                className="btn-ghost px-2 py-1 text-[11px] rounded"
              >
                {n}
              </button>
            ))}
          </div>

          {/* Category & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">Hazard Category</label>
              <select
                data-testid="report-category-select"
                className={inp}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                aria-label="Category"
              >
                <option value="cracks">Cracks on slope/road</option>
                <option value="slope_movement">Slope movement / tilting</option>
                <option value="blocked_road">Blocked road / debris</option>
                <option value="water">New springs / muddy seepage</option>
                <option value="other">Other geotechnical hazard</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">
                Severity Level (Officer Editable)
              </label>
              <div className="grid grid-cols-4 gap-1" data-testid="report-severity-selector">
                {SEVERITY_LEVELS.map(s => {
                  const isSelected = form.severity === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`severity-btn-${s.id}`}
                      onClick={() => setForm({ ...form, severity: s.id })}
                      className={`py-2 px-1 rounded text-[10px] font-mono border text-center transition-all ${
                        isSelected ? s.active : s.color
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">Field Observation Details</label>
            <textarea
              data-testid="report-description-input"
              className={inp}
              rows={3}
              maxLength={2000}
              placeholder="Describe crack width, slope deformation, affected roads/settlements, seepage rate…"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Multi-Media & Report File Uploads: Camera Capture, Gallery Image, Video, Report File */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase text-[#BDFF42] flex items-center gap-1.5 font-bold">
                <Camera size={13} />
                <span>Evidence & Media (Live Camera / Image / Video / Document)</span>
              </div>
              <span className="text-[9px] font-mono text-[#9FD8A8]">Camera supported</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Option 1: Live WebRTC Viewfinder Camera */}
              <button
                type="button"
                onClick={() => setShowCameraModal(true)}
                data-testid="report-camera-modal-btn"
                className="btn-lime px-2.5 py-2 text-xs flex items-center justify-center gap-1.5 rounded font-mono font-bold shadow-sm transition-all"
              >
                <Aperture size={14} className="shrink-0" />
                <span className="truncate text-[11px]">Live Camera</span>
              </button>

              {/* Option 2: Native Device Rear Camera Picker */}
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                data-testid="report-native-camera-btn"
                className="btn-ghost px-2.5 py-2 text-xs flex items-center justify-center gap-1.5 rounded border border-[#BDFF42]/40 text-[#BDFF42] hover:bg-[#BDFF42]/10 transition-all"
              >
                <Camera size={14} className="shrink-0" />
                <span className="truncate text-[11px]">Snap Photo</span>
              </button>
              <input
                ref={nativeCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                data-testid="report-native-camera-input"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPhoto(f);
                    const url = await toDataUrl(f);
                    setPhotoPreview(url);
                  }
                }}
              />

              {/* Option 3: Choose Image from Files */}
              <label
                className="btn-ghost px-2.5 py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer rounded border border-[#249344]/50 hover:border-[#BDFF42]"
                data-testid="report-photo-label"
              >
                <Upload size={14} className="text-[#9FD8A8] shrink-0" />
                <span className="truncate text-[11px]">{photo ? photo.name : 'From Files'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="report-photo-input"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhoto(f);
                      const url = await toDataUrl(f);
                      setPhotoPreview(url);
                    }
                  }}
                />
              </label>

              {/* Option 4: Video Upload */}
              <label
                className="btn-ghost px-2.5 py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer rounded border border-[#249344]/50 hover:border-[#BDFF42]"
                data-testid="report-video-label"
              >
                <Video size={14} className="text-[#38BDF8] shrink-0" />
                <span className="truncate text-[11px]">{video ? video.name : 'Upload Video'}</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  data-testid="report-video-input"
                  onChange={e => setVideo(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Document / Inspection File */}
            <div className="pt-0.5">
              <label
                className="btn-ghost px-2.5 py-1.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer rounded border border-[#249344]/40 hover:border-[#FFA31A]/70 text-[#9FD8A8]"
                data-testid="report-file-label"
              >
                <FileText size={13} className="text-[#FFA31A] shrink-0" />
                <span className="truncate text-[11px]">{reportFile ? reportFile.name : 'Attach Inspection Document / Log (.pdf, .doc, .txt)'}</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,.json,application/pdf,text/*"
                  className="hidden"
                  data-testid="report-file-input"
                  onChange={e => setReportFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Previews of attached files */}
            {(photo || video || reportFile) && (
              <div className="p-2.5 rounded bg-[#06150C] border border-[#249344]/40 space-y-2">
                {photo && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={photoPreview || (photo instanceof Blob ? URL.createObjectURL(photo) : photo)}
                        alt="preview"
                        className="h-12 w-16 rounded border border-[#249344]/50 object-cover shrink-0"
                      />
                      <span className="text-[#9FD8A8] truncate text-[11px]">{photo.name || 'Camera Photo'} ({(photo.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                      className="text-red-400 hover:text-red-300 text-xs px-1.5"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {video && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#7DD3FC]">
                      <span className="truncate">Video: {video.name} ({(video.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      <button
                        type="button"
                        onClick={() => setVideo(null)}
                        className="text-red-400 hover:text-red-300 text-xs px-1.5"
                      >
                        Remove
                      </button>
                    </div>
                    <video
                      src={URL.createObjectURL(video)}
                      controls
                      className="h-28 w-full rounded border border-[#249344]/50 bg-black object-contain"
                    />
                  </div>
                )}

                {reportFile && (
                  <div className="flex items-center justify-between text-[11px] text-[#FFA31A]">
                    <span className="truncate flex items-center gap-1.5">
                      <FileText size={13} />
                      <span>Report Doc: {reportFile.name} ({(reportFile.size / 1024).toFixed(1)} KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReportFile(null)}
                      className="text-red-400 hover:text-red-300 text-xs px-1.5"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notify Officer Toggle & Instant SMS Setup */}
          <div className="p-2.5 rounded bg-[#0A2416] border border-[#BDFF42]/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white font-medium">
                <input
                  type="checkbox"
                  data-testid="notify-officer-checkbox"
                  checked={form.notify_officer}
                  onChange={e => setForm({ ...form, notify_officer: e.target.checked })}
                  className="accent-[#BDFF42] w-4 h-4"
                />
                <span className="flex items-center gap-1.5">
                  <Bell size={13} className="text-[#BDFF42]" />
                  <span>Notify District Collector / Duty Officer Immediately</span>
                </span>
              </label>
              <span className="text-[10px] font-mono text-[#BDFF42] px-1.5 py-0.5 rounded bg-[#BDFF42]/15">
                TEXTBEE SMS
              </span>
            </div>

            {form.notify_officer && (
              <div className="pt-2 border-t border-[#249344]/30 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#9FD8A8]">
                  <span>OFFICER SMS PHONE (10 DIGITS · +91)</span>
                  <span className="text-[#5E8B67]">Default: Officer Profile</span>
                </div>
                <div className="flex items-center">
                  <span className="bg-[#06150C] border border-r-0 border-[#249344]/50 text-[#BDFF42] font-mono text-xs font-bold px-2.5 py-1.5 rounded-l">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9876543210 (leave empty to use registered profile)"
                    value={form.officer_phone}
                    onChange={e => setForm({ ...form, officer_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full bg-[#06150C] border border-[#249344]/50 focus:border-[#BDFF42] rounded-r px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Offline simulator toggle */}
          <div className="flex items-center justify-between text-xs text-[#9FD8A8]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={forceOffline}
                onChange={e => setForceOffline(e.target.checked)}
                className="accent-[#FFA31A]"
              />
              <span className="font-mono text-[11px]">Queue in offline mode</span>
            </label>
            {queue.length > 0 && (
              <span className="font-data text-[10px] text-[#FFA31A]">
                {queue.length} in offline queue
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            data-testid="submit-report-btn"
            className="btn-lime w-full py-2.5 rounded font-display tracking-wider text-sm flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            <span>{submitting ? 'UPLOADING & NOTIFYING OFFICER…' : 'UPLOAD REPORT & NOTIFY OFFICER'}</span>
          </button>
        </form>

        {/* Right Column: Verified Intel Stream & Officer Severity Control */}
        <div className="panel p-4 space-y-3 rounded-lg flex flex-col min-h-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="font-display text-xl sm:text-2xl text-white">Field Reports & Officer Triage</div>
              <div className="text-[11px] text-[#9FD8A8]">
                Officer can edit severity directly, review uploaded images/videos/reports, and verify dispatches
              </div>
            </div>
            <button
              onClick={() => {
                sync();
                refresh();
              }}
              disabled={syncing}
              className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1.5 rounded"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {queue.length > 0 && (
            <div className="p-2.5 border border-[#FFA31A] bg-[#FFA31A]/10 rounded font-mono text-xs text-[#FFA31A] space-y-1">
              <div className="font-bold">Offline Sync Queue ({queue.length})</div>
              {queue.map((item, idx) => (
                <div key={idx} className="text-[10px] text-[#d6f5dc] flex justify-between">
                  <span>[{item.severity || 'HIGH'}] {item.category}: {item.description.slice(0, 35)}…</span>
                  <span>{item.lat}, {item.lon}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto scroll-thin space-y-2.5 pr-1">
            {!reports.length && (
              <div className="text-center py-12 text-[#5E8B67] text-xs font-mono">
                No field reports ingested yet. Upload a report on the left.
              </div>
            )}

            {reports.map(r => {
              const currentSev = (r.severity || r.triage?.severity || 'MODERATE').toUpperCase();
              return (
                <div
                  key={r.id}
                  className={`card p-3.5 rounded-lg space-y-2 border transition-all ${
                    r.quarantined ? 'border-[#EF4444] bg-[#EF4444]/5' : 'border-[#249344]/40 bg-[#071D10]'
                  }`}
                  data-testid={`report-card-${r.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">
                        {r.title || r.category?.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#0A2416] border border-[#249344]/40 text-[#BDFF42] uppercase">
                        {r.category?.replace('_', ' ')}
                      </span>
                      <span className="font-data text-[10px] text-[#9FD8A8]">
                        {r.lat?.toFixed ? r.lat.toFixed(4) : r.lat}, {r.lon?.toFixed ? r.lon.toFixed(4) : r.lon}
                        {r.aoi ? ` · ${r.aoi.toUpperCase()}` : ''}
                      </span>
                    </div>

                    {/* Officer Editable Severity Control + Verification Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-[#9FD8A8]">SEVERITY:</span>
                        <select
                          aria-label={`Edit severity for report ${r.id}`}
                          data-testid={`officer-severity-select-${r.id}`}
                          value={currentSev}
                          onChange={e => updateSeverity(r.id, e.target.value)}
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border outline-none cursor-pointer ${severityBadgeStyle(currentSev)}`}
                        >
                          <option value="LOW" className="bg-[#06150C] text-emerald-300">LOW</option>
                          <option value="MODERATE" className="bg-[#06150C] text-yellow-300">MODERATE</option>
                          <option value="HIGH" className="bg-[#06150C] text-orange-300">HIGH</option>
                          <option value="CRITICAL" className="bg-[#06150C] text-red-300">CRITICAL</option>
                        </select>
                      </div>

                      {r.quarantined ? (
                        <span className="font-data text-[9px] px-1.5 py-0.5 bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444] rounded flex items-center gap-1">
                          <ShieldOff size={10} /> QUARANTINED
                        </span>
                      ) : (
                        <span
                          className={`font-data text-[9px] px-1.5 py-0.5 border rounded ${
                            r.status === 'VERIFIED'
                              ? 'text-[#22C55E] border-[#22C55E]'
                              : r.status === 'REJECTED'
                              ? 'text-[#EF4444] border-[#EF4444]'
                              : 'text-[#FFA31A] border-[#FFA31A]'
                          }`}
                        >
                          {r.status || 'PENDING'}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.description && (
                    <p className="text-xs text-[#d6f5dc] leading-relaxed whitespace-pre-line">
                      {r.description}
                    </p>
                  )}

                  {/* Attached Image / Video / Document Media */}
                  {(r.photo_url || r.video_url || r.report_file_url) && (
                    <div className="flex flex-wrap items-start gap-3 pt-1">
                      {r.photo_url && (
                        <div>
                          <div className="text-[9px] font-mono text-[#9FD8A8] mb-1">ATTACHED IMAGE</div>
                          <a href={r.photo_url} target="_blank" rel="noreferrer">
                            <img
                              src={r.photo_url}
                              alt="field evidence"
                              className="h-28 rounded border border-[#249344]/50 object-cover hover:border-[#BDFF42]"
                            />
                          </a>
                        </div>
                      )}

                      {r.video_url && (
                        <div className="w-56">
                          <div className="text-[9px] font-mono text-[#38BDF8] mb-1">ATTACHED VIDEO</div>
                          <video
                            src={r.video_url}
                            controls
                            className="h-28 w-full rounded border border-[#38BDF8]/40 bg-black object-contain"
                          />
                        </div>
                      )}

                      {r.report_file_url && (
                        <div className="flex flex-col justify-center">
                          <div className="text-[9px] font-mono text-[#FFA31A] mb-1">INSPECTION DOCUMENT</div>
                          <a
                            href={r.report_file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 rounded bg-[#0A2416] border border-[#FFA31A]/50 text-[#FFA31A] hover:bg-[#FFA31A]/15 text-xs font-mono flex items-center gap-1.5"
                          >
                            <FileText size={13} />
                            <span>{r.report_file_name || 'View Uploaded Report'}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer: Author, Officer Notification Status & Officer Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#249344]/25 text-[10px] text-[#5E8B67] font-mono">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>
                        By {r.author || r.client_id || 'officer'} · {new Date(r.captured_at || r.created_at || Date.now()).toLocaleTimeString()}
                      </span>
                      {r.triage?.severity_updated_by && (
                        <span className="text-[#BDFF42]">
                          · Severity edited by {r.triage.severity_updated_by}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {r.officer_notified ? (
                        <span
                          className="px-2 py-0.5 rounded bg-[#BDFF42]/15 border border-[#BDFF42]/40 text-[#BDFF42] flex items-center gap-1"
                          data-testid={`officer-notified-badge-${r.id}`}
                        >
                          <BellRing size={10} />
                          <span>
                            OFFICER NOTIFIED ({r.officer_dispatch_id || 'DISPATCHED'})
                            {r.officer_acknowledged ? ' · ACKED' : ''}
                          </span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => notifyOfficer(r.id)}
                          data-testid={`notify-officer-btn-${r.id}`}
                          className="px-2 py-0.5 rounded bg-[#0A2416] border border-[#BDFF42]/50 text-[#BDFF42] hover:bg-[#BDFF42] hover:text-[#06150C] transition-colors flex items-center gap-1"
                        >
                          <Bell size={10} />
                          <span>Notify Officer</span>
                        </button>
                      )}

                      {r.status !== 'VERIFIED' && (
                        <div className="flex gap-2 pl-1 border-l border-[#249344]/30">
                          <button
                            type="button"
                            onClick={() => verify(r.id, 'VERIFIED')}
                            className="text-[#22C55E] hover:underline flex items-center gap-0.5 font-bold"
                          >
                            <CheckCircle2 size={11} /> Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => verify(r.id, 'REJECTED')}
                            className="text-[#EF4444] hover:underline flex items-center gap-0.5"
                          >
                            <ShieldOff size={11} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(file, dataUrl) => {
          setPhoto(file);
          setPhotoPreview(dataUrl);
        }}
        title="Capture Field Inspection Photo"
      />
    </div>
  );
}
