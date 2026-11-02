import React, { useState, useEffect } from 'react';
import { toast } from '../lib/toast';
import { http, errMsg, useAuth, canApprove } from '../lib/api';
import { api } from '../api';
import { 
  Check, GitCompare, Link2, Lock, MessageSquareWarning, 
  ShieldAlert, X, Download, Plus, Radio, CheckCircle2, 
  Clock, Copy, FileText, Send, AlertTriangle
} from 'lucide-react';
import { RiskBadge } from './RiskBadge';

const STATUS_C = {
  PENDING_APPROVAL: '#FFA31A',
  APPROVED: '#22C55E',
  EXECUTING: '#BDFF42',
  SUPERSEDED: '#5E8B67',
  REJECTED: '#EF4444',
  CHANGES_REQUESTED: '#FFA31A'
};

export const PlanStatus = ({ s }) => (
  <span
    className="font-data text-[10px] px-1.5 py-0.5 border rounded"
    style={{ color: STATUS_C[s] || '#9FD8A8', borderColor: STATUS_C[s] || '#9FD8A8' }}
    data-testid="plan-status"
  >
    {s}
  </span>
);

export function DiffView({ diff }) {
  if (!diff) return null;
  const Row = ({ sym, color, children, id }) => (
    <div className="flex gap-2 text-[11px] py-0.5" data-testid={id}>
      <span className="font-data font-bold w-3" style={{ color }}>{sym}</span>
      <div className="flex-1">{children}</div>
    </div>
  );

  return (
    <div className="card p-2 mt-2" data-testid="plan-diff">
      <div className="eyebrow flex items-center gap-1 mb-1">
        <GitCompare size={11} /> Plan diff vs previous version
      </div>
      {(diff.added || []).map(t => (
        <Row key={t.id} sym="+" color="#22C55E" id={`diff-added-${t.id}`}>
          {t.title}
        </Row>
      ))}
      {(diff.removed || []).map(t => (
        <Row key={t.id} sym="−" color="#EF4444" id={`diff-removed-${t.id}`}>
          <s className="opacity-70">{t.title}</s>
        </Row>
      ))}
      {(diff.changed || []).map(c => (
        <Row key={c.id} sym="~" color="#FFA31A" id={`diff-changed-${c.id}`}>
          <div>{c.title}</div>
          {Object.entries(c.changes || {}).map(([f, v]) => (
            <div key={f} className="font-data text-[10px] text-[#9FD8A8]">
              {f}: <s className="text-[#EF4444]/80">{String(v.from)}</s> → <span className="text-[#BDFF42]">{String(v.to)}</span>
            </div>
          ))}
        </Row>
      ))}
      <div className="font-data text-[10px] text-[#5E8B67] mt-1">
        = {(diff.unchanged || []).length} unchanged task(s) carried over without recomputation
      </div>
    </div>
  );
}

export function ApprovalBar({ incident, plan, onPlanUpdated }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (decision) => {
    setBusy(true);
    try {
      await http.post(`/incidents/${incident.id}/plans/${plan.version}/decision`, {
        decision,
        notes
      });
      toast.success(`Plan V${plan.version}: ${decision.replace('_', ' ')}`);
      setNotes('');
      if (onPlanUpdated) onPlanUpdated();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (plan.status !== 'PENDING_APPROVAL') return null;

  return (
    <div className="mt-2 p-2 border border-[#FFA31A] bg-[#FFA31A]/10 pulse-amber rounded" data-testid="human-gate">
      <div className="flex items-center gap-2 text-[#FFA31A] font-display text-sm">
        <ShieldAlert size={15} /> Human gate · approval bound to V{plan.version}
      </div>
      {canApprove(user) ? (
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            data-testid="approval-notes-input"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Decision notes (audited)"
            className="flex-1 min-w-[140px] bg-[#06150C] border border-[#249344]/50 px-2 py-1 text-xs rounded text-white"
          />
          <button
            disabled={busy}
            data-testid="approve-plan-btn"
            onClick={() => decide('approve')}
            className="btn-amber px-3 py-1 text-xs flex items-center gap-1 rounded"
          >
            <Check size={13} /> Approve V{plan.version}
          </button>
          <button
            disabled={busy}
            data-testid="request-changes-btn"
            onClick={() => decide('request_changes')}
            className="btn-ghost px-2 py-1 text-xs flex items-center gap-1 rounded"
          >
            <MessageSquareWarning size={13} /> Changes
          </button>
          <button
            disabled={busy}
            data-testid="reject-plan-btn"
            onClick={() => decide('reject')}
            className="btn-ghost px-2 py-1 text-xs flex items-center gap-1 rounded"
          >
            <X size={13} /> Reject
          </button>
        </div>
      ) : (
        <div className="text-[11px] text-[#9FD8A8] mt-1 flex items-center gap-1" data-testid="approval-locked">
          <Lock size={11} /> Only Approver/Admin can sign off. You are {user?.role || 'anonymous'}. Enforced server-side.
        </div>
      )}
    </div>
  );
}

export default function PlanPanel({ incident, compact = false }) {
  const [view, setView] = useState(null);
  const [taskStates, setTaskStates] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportText, setExportText] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDetail, setNewTaskDetail] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState('District Disaster Response');
  const [newTaskPriority, setNewTaskPriority] = useState(1);
  const [dispatching, setDispatching] = useState(false);

  const plans = incident?.plans || [];

  useEffect(() => {
    setView(null);
  }, [plans.length]);

  if (!plans.length) {
    return (
      <div className="p-4 text-xs text-[#5E8B67] font-data" data-testid="plan-empty">
        {incident?.busy ? 'Agents are building Plan V1…' : 'No plan yet.'}
      </div>
    );
  }

  const plan = plans.find(p => p.version === view) || plans[plans.length - 1];

  const handleToggleTaskStatus = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : currentStatus === 'IN_PROGRESS' ? 'COMPLETED' : 'IN_PROGRESS';
    setTaskStates(prev => ({ ...prev, [taskId]: nextStatus }));
    try {
      await api.updatePlanTaskStatus(incident.id, plan.version, taskId, nextStatus);
      toast.success(`Task status updated: ${nextStatus}`);
    } catch (e) {
      toast.error(errMsg(e));
      setTaskStates(prev => ({ ...prev, [taskId]: currentStatus }));
    }
  };

  const handleExportPlan = async () => {
    try {
      const res = await api.exportPlanProtocol(incident.id, plan.version);
      setExportText(res.markdown || '');
      setShowExportModal(true);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const handleAddTaskSubmit = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      await api.addPlanTask(incident.id, plan.version, {
        title: newTaskTitle,
        detail: newTaskDetail || 'Field tactical directive added by Incident Commander',
        owner: newTaskOwner,
        priority: Number(newTaskPriority)
      });
      toast.success('Tactical task appended to Plan');
      setNewTaskTitle('');
      setNewTaskDetail('');
      setShowAddTask(false);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const handleDispatchAlerts = async () => {
    setDispatching(true);
    try {
      const res = await api.dispatchPlanAlerts(incident.id, plan.version);
      toast.success(res.message || 'Alerts dispatched to CAP emergency channels');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="plan-panel">
      {/* Versions Tabs & Action Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#249344]/30 pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {plans.map(p => (
            <button
              key={p.version}
              data-testid={`plan-version-tab-${p.version}`}
              onClick={() => setView(p.version)}
              className={`font-data text-xs px-2 py-0.5 border rounded ${
                p.version === plan.version ? 'border-[#BDFF42] text-[#BDFF42] bg-[#BDFF42]/10 font-bold' : 'border-[#249344]/40 text-[#9FD8A8]'
              }`}
            >
              V{p.version}
            </button>
          ))}
          <PlanStatus s={plan.status} />
          <RiskBadge category={plan.risk?.category} score={plan.risk?.score} testid="plan-risk-badge" />
        </div>

        {/* Operational Actions Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportPlan}
            title="Export Official NDMA Action Plan Protocol"
            className="px-2 py-0.5 rounded bg-[#249344]/20 hover:bg-[#249344]/40 text-[#9FD8A8] hover:text-white border border-[#249344]/50 text-[10px] flex items-center gap-1 transition-colors"
          >
            <Download size={10} />
            <span>Export Protocol</span>
          </button>
          {plan.status === 'EXECUTING' && (
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              title="Add Tactical Directive"
              className="px-2 py-0.5 rounded bg-[#BDFF42]/20 hover:bg-[#BDFF42]/30 text-[#BDFF42] border border-[#BDFF42]/40 text-[10px] flex items-center gap-1 transition-colors font-medium"
            >
              <Plus size={10} />
              <span>Add Task</span>
            </button>
          )}
          {(plan.status === 'APPROVED' || plan.status === 'EXECUTING') && (
            <button
              onClick={handleDispatchAlerts}
              disabled={dispatching}
              title="Broadcast CAP 1.2 Warning Alerts"
              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] flex items-center gap-1 transition-colors font-medium"
            >
              <Radio size={10} className={dispatching ? 'animate-pulse' : ''} />
              <span>CAP Broadcast</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Ad-Hoc Task Form */}
      {showAddTask && (
        <form onSubmit={handleAddTaskSubmit} className="mt-2 p-2.5 rounded bg-[#0A2416] border border-[#BDFF42]/40 text-xs space-y-2">
          <div className="flex items-center justify-between text-[#BDFF42] font-semibold">
            <span>Append Tactical Task (Plan V{plan.version})</span>
            <button type="button" onClick={() => setShowAddTask(false)} className="text-[#9FD8A8] hover:text-white">
              <X size={12} />
            </button>
          </div>
          <input
            type="text"
            required
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            placeholder="e.g. Deploy heavy excavator to clear NH10 KM38 debris"
            className="w-full px-2 py-1 bg-[#06150C] border border-[#249344]/40 rounded text-white text-xs outline-none focus:border-[#BDFF42]"
          />
          <input
            type="text"
            value={newTaskDetail}
            onChange={e => setNewTaskDetail(e.target.value)}
            placeholder="Operational notes, rendezvous coordinate, radio frequency"
            className="w-full px-2 py-1 bg-[#06150C] border border-[#249344]/40 rounded text-[#9FD8A8] text-xs outline-none focus:border-[#BDFF42]"
          />
          <div className="flex gap-2">
            <select
              value={newTaskOwner}
              onChange={e => setNewTaskOwner(e.target.value)}
              className="flex-1 px-2 py-1 bg-[#06150C] border border-[#249344]/40 rounded text-white text-xs"
            >
              <option value="State Disaster Response Force (SDRF)">State Disaster Response Force (SDRF)</option>
              <option value="PWD Heavy Clearance Division">PWD Heavy Clearance Division</option>
              <option value="District Health & Ambulance Service">District Health & Ambulance Service</option>
              <option value="District Transport Evacuation Wing">District Transport Evacuation Wing</option>
              <option value="Police Traffic Escort Unit">Police Traffic Escort Unit</option>
            </select>
            <select
              value={newTaskPriority}
              onChange={e => setNewTaskPriority(Number(e.target.value))}
              className="w-24 px-2 py-1 bg-[#06150C] border border-[#249344]/40 rounded text-white text-xs"
            >
              <option value={1}>P1 - Urgent</option>
              <option value={2}>P2 - High</option>
              <option value={3}>P3 - Medium</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1 bg-[#BDFF42] text-[#06150C] rounded font-bold hover:bg-lime-300"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* Plan Content */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin mt-2 pr-1">
        <p className="text-[12px] text-[#d6f5dc] whitespace-pre-line leading-relaxed" data-testid="plan-summary">
          {(plan.summary || '').replace(/\*\*/g, '')}
        </p>

        {/* Tasks list */}
        <div className="mt-2 space-y-1.5">
          {(plan.tasks || []).map((t, i) => {
            const currentStatus = taskStates[t.id] || t.status || 'PENDING';
            const isCompleted = currentStatus === 'COMPLETED';
            const isInProgress = currentStatus === 'IN_PROGRESS';

            return (
              <div 
                key={t.id || i} 
                className={`card px-2.5 py-2 flex items-start gap-2.5 rounded transition-all ${
                  isCompleted ? 'border-[#249344]/30 bg-[#06150C]/60 opacity-80' : 
                  isInProgress ? 'border-[#BDFF42]/60 bg-[#249344]/15' : 'border-[#249344]/40'
                }`} 
                data-testid={`plan-task-${t.id}`}
              >
                {/* Interactive Status Checkbox */}
                <button
                  type="button"
                  title={`Status: ${currentStatus}. Click to cycle.`}
                  onClick={() => handleToggleTaskStatus(t.id, currentStatus)}
                  className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                    isCompleted ? 'bg-[#22C55E] text-[#06150C]' :
                    isInProgress ? 'border-2 border-[#BDFF42] bg-[#BDFF42]/20 text-[#BDFF42]' :
                    'border border-[#5E8B67] hover:border-[#BDFF42]'
                  }`}
                >
                  {isCompleted ? <Check size={11} strokeWidth={3} /> : isInProgress ? <Clock size={10} /> : null}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white flex items-center gap-2 font-medium flex-wrap">
                    <span className={isCompleted ? 'line-through text-slate-400' : ''}>
                      {t.title}
                    </span>
                    {t.carried_over && (
                      <span className="font-data text-[9px] text-[#5E8B67] border border-[#5E8B67]/50 px-1 rounded">
                        CARRIED
                      </span>
                    )}
                    <span className={`font-data text-[9px] px-1 rounded ${
                      isCompleted ? 'bg-green-600/20 text-green-400' :
                      isInProgress ? 'bg-lime-400/20 text-[#BDFF42]' : 'text-slate-500'
                    }`}>
                      {currentStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9FD8A8] mt-0.5 leading-snug">{t.detail}</div>
                  {!compact && (
                    <div className="font-data text-[9px] text-[#5E8B67] flex items-center gap-1 flex-wrap mt-1">
                      <Link2 size={9} />
                      <span className="text-[#BDFF42]">{t.owner}</span>
                      {t.depends_on && t.depends_on.length > 0 && (
                        <span>· deps: {t.depends_on.join(', ')}</span>
                      )}
                    </div>
                  )}
                </div>
                <span
                  className="font-data text-[10px] h-fit px-1.5 py-0.5 border rounded shrink-0"
                  style={{
                    color: t.priority === 1 ? '#EF4444' : t.priority === 2 ? '#F97316' : '#9FD8A8',
                    borderColor: 'currentColor'
                  }}
                >
                  P{t.priority}
                </span>
              </div>
            );
          })}
        </div>

        {/* Diff view */}
        <DiffView diff={plan.diff} />

        {/* Approvals history */}
        {(plan.approvals || []).map((a, i) => (
          <div key={i} className="font-data text-[10px] text-[#22C55E] mt-1.5 p-1 rounded bg-[#249344]/10 border border-[#249344]/20" data-testid={`approval-record-${i}`}>
            ✔ {a.decision} by {a.user} ({a.role}) at {new Date(a.timestamp * 1000).toLocaleTimeString()} {a.notes ? `— "${a.notes}"` : ''}
          </div>
        ))}
      </div>

      {/* Human gate */}
      <ApprovalBar incident={incident} plan={plan} />

      {/* Export Protocol Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A2416] border border-[#BDFF42]/50 rounded-xl p-5 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#249344]/40">
              <div className="flex items-center gap-2">
                <FileText className="text-[#BDFF42]" size={18} />
                <h3 className="font-bold text-white text-sm font-sans tracking-wide">
                  NDMA Incident Action Plan Protocol (V{plan.version})
                </h3>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 p-3 bg-[#06150C] rounded border border-[#249344]/30 font-mono text-xs text-slate-300 whitespace-pre-wrap select-all">
              {exportText}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#249344]/30">
              <span className="text-[10px] text-slate-500 font-mono">
                SHA-256 Verified Action Plan Protocol
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(exportText);
                    toast.success('Protocol copied to clipboard');
                  }}
                  className="px-3 py-1.5 rounded bg-[#249344]/20 hover:bg-[#249344]/40 text-[#9FD8A8] text-xs font-bold flex items-center gap-1.5"
                >
                  <Copy size={13} />
                  <span>Copy Text</span>
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([exportText], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `NDMA_Plan_V${plan.version}_Incident_${incident.id}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('Downloaded protocol markdown file');
                  }}
                  className="px-4 py-1.5 rounded bg-[#BDFF42] text-[#06150C] text-xs font-bold hover:bg-lime-300 flex items-center gap-1.5 shadow"
                >
                  <Download size={13} />
                  <span>Download .MD</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

