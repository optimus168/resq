import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '../lib/toast';
import { http, errMsg, useAuth } from '../lib/api';
import { CheckCircle2, ShieldOff, Camera, CloudOff, MapPin, RefreshCw, Upload, AlertTriangle } from 'lucide-react';

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
    lat: '',
    lon: '',
    category: 'cracks',
    description: ''
  });
  const [photo, setPhoto] = useState(null);
  const [queue, setQueue] = useState(loadQ());
  const [forceOffline, setForceOffline] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [reports, setReports] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = () =>
    http.get('/reports')
      .then(r => setReports(r.data))
      .catch(() => {});

  const sync = useCallback(async () => {
    const q = loadQ();
    if (!q.length || forceOffline || !navigator.onLine) return;
    setSyncing(true);
    const left = [];

    for (const item of q) {
      try {
        const fd = new FormData();
        ['lat', 'lon', 'category', 'description', 'client_id', 'captured_at'].forEach(k => {
          if (item[k] !== undefined) fd.append(k, item[k]);
        });
        if (item.photo) {
          fd.append('photo', await dataUrlToBlob(item.photo), 'photo.jpg');
        }
        const r = await http.post('/reports', fd);
        toast.success(
          `Synced ${item.client_id.slice(0, 8)} (${r.data.sync || 'ok'})${
            r.data.triggered_event ? ' → replan triggered' : ''
          }`
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
  }, [forceOffline]);

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
  }, [sync]);

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
    if (photo && photo.size > 5 * 1024 * 1024) return toast.error('Photo must be ≤ 5 MB');

    const item = {
      ...form,
      client_id: `r${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
      captured_at: new Date().toISOString(),
      photo: photo ? await toDataUrl(photo) : null
    };

    const q = [...loadQ(), item];
    try {
      saveQ(q);
    } catch {
      saveQ([...loadQ(), { ...item, photo: null }]);
      toast.warning('Photo too large for local queue — saved without photo');
    }

    setQueue(loadQ());
    setForm(f => ({ ...f, description: '' }));
    setPhoto(null);
    toast.info(forceOffline || !navigator.onLine ? 'Saved offline — will sync on reconnect' : 'Queued — syncing…');
    sync();
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

  const inp = 'w-full bg-[#06150C] border border-[#249344]/50 focus:border-[#BDFF42] px-3 py-2 text-xs rounded text-white outline-none';
  const offline = forceOffline || !online;

  return (
    <div className="p-3 grid lg:grid-cols-[420px_1fr] gap-3 max-w-6xl mx-auto" data-testid="field-reports-page">
      {/* Form column */}
      <form onSubmit={submit} className="panel p-4 space-y-3 h-fit rounded-lg">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl text-white">Field report</div>
          <span
            className={`font-data text-[10px] px-2 py-0.5 border rounded ${
              offline ? 'text-[#FFA31A] border-[#FFA31A]' : 'text-[#22C55E] border-[#22C55E]'
            }`}
            data-testid="connectivity-status"
          >
            {offline ? 'OFFLINE' : 'ONLINE'}
          </span>
        </div>

        {/* Coords */}
        <div className="grid grid-cols-2 gap-2">
          <input
            data-testid="report-lat-input"
            className={inp}
            placeholder="Latitude (e.g. 27.3135)"
            value={form.lat}
            onChange={e => setForm({ ...form, lat: e.target.value })}
            inputMode="decimal"
            aria-label="Latitude"
          />
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

        {/* Category */}
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
          <option value="other">Other</option>
        </select>

        {/* Description */}
        <textarea
          data-testid="report-description-input"
          className={inp}
          rows={3}
          maxLength={2000}
          placeholder="What do you see? Width of cracks, houses nearby, mud accumulation…"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />

        {/* Photo Upload */}
        <label
          className="btn-ghost px-3 py-2 text-xs flex items-center gap-2 cursor-pointer rounded"
          data-testid="report-photo-label"
        >
          <Camera size={14} />
          <span>{photo ? photo.name : 'Attach photo (optional, ≤ 5 MB)'}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => setPhoto(e.target.files?.[0] || null)}
          />
        </label>

        {photo && (
          <div className="relative w-fit">
            <img
              src={URL.createObjectURL(photo)}
              alt="preview"
              className="h-24 rounded border border-[#249344]/50 object-cover"
            />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="absolute -top-1 -right-1 bg-[#EF4444] text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center"
            >
              ×
            </button>
          </div>
        )}

        {/* Offline simulator toggle */}
        <div className="flex items-center justify-between text-xs text-[#9FD8A8] pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={forceOffline}
              onChange={e => setForceOffline(e.target.checked)}
              className="accent-[#FFA31A]"
            />
            <span className="font-mono text-[11px]">Simulate offline environment</span>
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
          data-testid="submit-report-btn"
          className="btn-lime w-full py-2.5 rounded font-display tracking-wider text-sm flex items-center justify-center gap-2"
        >
          <Upload size={14} />
          <span>FILE FIELD OBSERVATION</span>
        </button>
      </form>

      {/* Reports feed */}
      <div className="panel p-4 space-y-3 rounded-lg flex flex-col min-h-0">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl text-white">Verified intel stream</div>
          <button
            onClick={() => {
              sync();
              refresh();
            }}
            disabled={syncing}
            className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1.5 rounded"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>

        {queue.length > 0 && (
          <div className="p-2.5 border border-[#FFA31A] bg-[#FFA31A]/10 rounded font-mono text-xs text-[#FFA31A] space-y-1">
            <div className="font-bold">Offline Sync Queue ({queue.length})</div>
            {queue.map((item, idx) => (
              <div key={idx} className="text-[10px] text-[#d6f5dc] flex justify-between">
                <span>{item.category}: {item.description.slice(0, 35)}…</span>
                <span>{item.lat}, {item.lon}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin space-y-2 pr-1">
          {!reports.length && (
            <div className="text-center py-12 text-[#5E8B67] text-xs font-mono">
              No field reports ingested yet. Submit an observation on the left.
            </div>
          )}

          {reports.map(r => (
            <div
              key={r.id}
              className={`card p-3 rounded space-y-1.5 border transition-all ${
                r.quarantined ? 'border-[#EF4444] bg-[#EF4444]/5' : 'border-[#249344]/30'
              }`}
              data-testid={`report-card-${r.id}`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white capitalize">{r.category?.replace('_', ' ')}</span>
                  <span className="font-data text-[10px] text-[#9FD8A8]">
                    {r.lat?.toFixed ? r.lat.toFixed(4) : r.lat}, {r.lon?.toFixed ? r.lon.toFixed(4) : r.lon}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {r.quarantined ? (
                    <span className="font-data text-[9px] px-1.5 py-0.5 bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444] rounded flex items-center gap-1">
                      <ShieldOff size={10} /> QUARANTINED (INJECTION DETECTED)
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

              <p className="text-xs text-[#d6f5dc] leading-relaxed whitespace-pre-line">
                {r.description}
              </p>

              {r.photo_url && (
                <div className="pt-1">
                  <img
                    src={r.photo_url}
                    alt="field evidence"
                    className="h-28 rounded border border-[#249344]/40 object-cover"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-[#249344]/20 text-[10px] text-[#5E8B67] font-mono">
                <span>By {r.author || r.client_id || 'officer'} · {new Date(r.timestamp * 1000 || r.captured_at || Date.now()).toLocaleTimeString()}</span>
                {['admin', 'approver'].includes(user?.role) && r.status !== 'VERIFIED' && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => verify(r.id, 'VERIFIED')}
                      className="text-[#22C55E] hover:underline flex items-center gap-0.5"
                    >
                      <CheckCircle2 size={11} /> Verify
                    </button>
                    <button
                      onClick={() => verify(r.id, 'REJECTED')}
                      className="text-[#EF4444] hover:underline flex items-center gap-0.5"
                    >
                      <ShieldOff size={11} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
