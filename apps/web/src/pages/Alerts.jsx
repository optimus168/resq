import React, { useState, useEffect } from 'react';
import { toast } from '../lib/toast';
import { http, errMsg, useAuth, canOperate } from '../lib/api';
import { RiskBadge, SimBadge } from '../components/RiskBadge';
import { Bell, Send, CheckCircle2, AlertOctagon, Radio, ShieldAlert } from 'lucide-react';

const FLOW = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'ACKNOWLEDGED', 'RESOLVED'];

function AlertCard({ a, refresh }) {
  const { user } = useAuth();

  const go = async to => {
    try {
      await http.post(`/alerts/${a.id}/transition`, null, {
        params: { to }
      });
      toast.success(`Alert → ${to}`);
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const cur = FLOW.indexOf(a.status);

  return (
    <div className="panel p-3 rounded-lg space-y-2 border border-[#249344]/30" data-testid={`alert-${a.id}`}>
      {/* Alert Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <RiskBadge category={a.severity} />
        <span className="font-data text-[10px] text-[#9FD8A8]">
          plan V{a.plan_version} · INC-{a.incident_id} · {a.aoi}
        </span>
        <SimBadge text="PROTOTYPE delivery" />
        <span
          className="font-data text-[11px] ml-auto font-bold"
          style={{ color: a.status === 'CANCELLED' ? '#EF4444' : '#BDFF42' }}
          data-testid={`alert-status-${a.id}`}
        >
          {a.status}
        </span>
      </div>

      {/* Lifecycle Progress Bar */}
      <div className="flex gap-1 mt-1" aria-label="Lifecycle">
        {FLOW.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className="h-1 rounded"
              style={{
                background:
                  a.status === 'CANCELLED'
                    ? '#5E8B67'
                    : i <= cur
                    ? '#BDFF42'
                    : 'rgba(36,147,68,.25)'
              }}
            />
            <div className="font-data text-[8px] text-[#5E8B67] mt-0.5 truncate">{s}</div>
          </div>
        ))}
      </div>

      {/* Alert message body */}
      <p
        className="text-[13px] card p-2.5 rounded leading-relaxed text-white whitespace-pre-line"
        data-testid={`alert-message-${a.id}`}
      >
        {a.messages?.en || a.description || 'Landslide warning issued for immediate evacuation.'}
      </p>

      {/* Channels & Meta */}
      <div className="font-data text-[10px] text-[#FFA31A] flex items-center gap-2 flex-wrap">
        {a.needs_human_review && (
          <span>⚑ Needs human review — {a.translation_source || 'AI draft'}</span>
        )}
        <span>· channels: {(a.channels || ['CAP/SACHET', 'SMS', 'Siren']).join(', ')}</span>
      </div>

      {a.cancel_reason && (
        <div className="text-[11px] text-[#EF4444] font-mono">
          Cancelled: {a.cancel_reason}
        </div>
      )}

      {/* Receipts */}
      {a.receipts && a.receipts.length > 0 && (
        <div className="font-data text-[10px] text-[#22C55E]" data-testid={`alert-receipts-${a.id}`}>
          {a.receipts.map(r => `${r.channel}: ${r.status} (${r.recipients})`).join(' · ')}
        </div>
      )}

      {/* Transitions */}
      {canOperate(user) && (
        <div className="flex gap-1.5 pt-2 border-t border-[#249344]/20 flex-wrap">
          {a.status === 'DRAFT' && (
            <button
              onClick={() => go('PENDING_APPROVAL')}
              className="btn-ghost px-2.5 py-1 text-xs rounded"
            >
              Submit for approval
            </button>
          )}
          {a.status === 'PENDING_APPROVAL' && ['admin', 'approver'].includes(user?.role) && (
            <button
              onClick={() => go('APPROVED')}
              className="btn-lime px-2.5 py-1 text-xs rounded font-bold"
            >
              Approve alert
            </button>
          )}
          {a.status === 'APPROVED' && (
            <button
              onClick={() => go('DISPATCHED')}
              className="btn-amber px-2.5 py-1 text-xs rounded font-bold flex items-center gap-1"
            >
              <Radio size={12} /> Dispatch broadcast
            </button>
          )}
          {a.status === 'DISPATCHED' && (
            <button
              onClick={() => go('ACKNOWLEDGED')}
              className="btn-ghost px-2.5 py-1 text-xs rounded"
            >
              Mark acknowledged
            </button>
          )}
          {['DISPATCHED', 'ACKNOWLEDGED'].includes(a.status) && (
            <button
              onClick={() => go('RESOLVED')}
              className="btn-ghost px-2.5 py-1 text-xs rounded text-[#22C55E]"
            >
              Resolve / All-Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    http.get('/alerts')
      .then(r => {
        setAlerts(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-3 max-w-5xl mx-auto space-y-4" data-testid="alerts-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="font-display text-2xl sm:text-3xl text-white">CAP Emergency Alert Center</div>
          <div className="font-data text-[11px] sm:text-xs text-[#9FD8A8] mt-0.5">
            Common Alerting Protocol (ITU-T X.1303 / NDMA SACHET) · Standard English Protocol
          </div>
        </div>
        <div className="self-start sm:self-auto">
          <SimBadge text="SANDBOX MODE · ZERO UNAPPROVED BROADCASTS" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#5E8B67] text-xs font-mono">
          Loading alerts…
        </div>
      ) : !alerts.length ? (
        <div className="panel p-8 text-center rounded-lg space-y-2">
          <ShieldAlert className="w-10 h-10 text-[#249344] mx-auto opacity-60" />
          <div className="font-display text-lg text-white">No active CAP alerts</div>
          <p className="text-xs text-[#9FD8A8] max-w-md mx-auto">
            When an incident risk reaches IMMINENT or HIGH, the Alert Dispatcher drafts verified CAP 1.2 advisories for Collector review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <AlertCard key={a.id} a={a} refresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
