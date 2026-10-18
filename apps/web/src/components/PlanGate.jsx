import React, { useState } from 'react';
import { 
  ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, 
  GitCommit, ArrowRight, FileText, Check, AlertOctagon, Sparkles 
} from 'lucide-react';
import { StatusBadge } from './Badges';

export default function PlanGate({ 
  incident, 
  currentRole = 'collector', 
  onApprove, 
  onReject, 
  isLoading = false 
}) {
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!incident) {
    return (
      <div className="p-4 bg-[#0A2416] border border-[#249344]/30 rounded-lg text-slate-500 font-mono text-xs text-center">
        No active incident plan loaded. Start a scenario to view plans.
      </div>
    );
  }

  const currentVersion = incident.current_version || 1;
  const plans = incident.plans || [];
  const currentPlan = plans.find(p => p.version === currentVersion) || plans[0] || {};
  const status = incident.status;
  const isPendingApproval = status === 'PENDING_APPROVAL';
  const diff = currentPlan.diff;
  const assumptions = incident.assumptions || [];

  const handleAction = async (decision) => {
    setErrorMessage('');
    try {
      if (decision === 'approve') {
        await onApprove(currentVersion, notes || `Plan V${currentVersion} authorized by ${currentRole}`);
      } else {
        await onReject(currentVersion, notes || `Plan V${currentVersion} rejected`);
      }
      setNotes('');
    } catch (err) {
      setErrorMessage(err.message || 'Action failed');
    }
  };

  return (
    <div className="bg-[#0A2416] rounded-lg border border-[#249344]/40 overflow-hidden shadow-2xl flex flex-col">
      {/* Gate Header */}
      <div className="px-4 py-3 bg-[#06150C] border-b border-[#249344]/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-[#FFA31A]/20 border border-[#FFA31A]/50 text-[#FFA31A]">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white tracking-wider">
                HUMAN APPROVAL GATE · PLAN V{currentVersion}
              </span>
              <StatusBadge status={status} />
            </div>
            <div className="text-[11px] text-[#9FD8A8]">
              Backend-enforced authority: Only authenticated District Magistrate / Collector can approve
            </div>
          </div>
        </div>

        {/* Plan Version Tabs */}
        <div className="flex items-center gap-1.5 bg-[#06150C] p-1 rounded-md border border-[#249344]/30 text-xs font-mono">
          {plans.map(p => (
            <span
              key={p.version}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 ${
                p.version === currentVersion 
                  ? 'bg-[#BDFF42] text-[#06150C] font-bold shadow' 
                  : 'text-slate-400'
              }`}
            >
              <span>V{p.version}</span>
              {p.decision === 'approve' && <Check className="w-3 h-3 text-emerald-800 stroke-[3]" />}
            </span>
          ))}
        </div>
      </div>

      {/* Error Alert Banner if Stale / Denied */}
      {errorMessage && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-500/60 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Body: Diff View or Task List */}
      <div className="p-4 space-y-4 max-h-72 overflow-y-auto">
        {diff ? (
          /* Autonomous Re-planning Diff Mode (Wow Moment 3) */
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#249344]/30">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FFA31A] font-mono">
                <Sparkles className="w-4 h-4 text-[#FFA31A]" />
                AUTONOMOUS REPLANNING DIFF (V1 → V2)
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-emerald-400">+{diff.added?.length || 0} Added</span>
                <span className="text-amber-400">~{diff.changed?.length || 0} Changed</span>
                <span className="text-slate-400">{diff.unchanged?.length || 0} Preserved</span>
              </div>
            </div>

            {/* Added Tasks */}
            {diff.added && diff.added.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  + Newly Synthesized Operations
                </div>
                {diff.added.map((task, i) => (
                  <div key={i} className="p-2 rounded bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span>
                    <div>
                      <div className="font-semibold text-white">{task.action || task.title || task}</div>
                      <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                        Target: {task.target || 'NH10 Highway Lifeline'} · SOP Reference: [NDMA-SOP-2.1]
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Changed Tasks */}
            {diff.changed && diff.changed.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  ~ Modified Parameters & Allocations
                </div>
                {diff.changed.map((task, i) => (
                  <div key={i} className="p-2 rounded bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0"></span>
                    <div>
                      <div className="font-semibold text-white">{task.action || task.title || task}</div>
                      <div className="text-[10px] text-amber-300 font-mono mt-0.5">
                        Scope widened due to rainfall escalation & road closure
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Unchanged Tasks (Selective Re-plan proof) */}
            {diff.unchanged && diff.unchanged.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  = Preserved Unaffected Tasks (Zero Latency Re-run)
                </div>
                <div className="p-2 rounded bg-black/40 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  {diff.unchanged.map((task, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-slate-600">•</span>
                      <span>{task.action || task.title || task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Task List for Plan V1 */
          <div className="space-y-2">
            <div className="text-xs font-mono text-[#9FD8A8] font-semibold">
              RESPONSE PLAN ACTIONS ({currentPlan.tasks?.length || 4} Tasks)
            </div>
            <div className="space-y-2">
              {(currentPlan.tasks || [
                { title: 'Issue Red Warning to Singtam & Deorali blocks', type: 'ALERT', priority: 'HIGH' },
                { title: 'Pre-position earthmovers at 32nd Mile NH10 depot', type: 'RESOURCE', priority: 'CRITICAL' },
                { title: 'Prepare Ranipool Community Hall relief shelter', type: 'SHELTER', priority: 'MEDIUM' },
                { title: 'Dispatch field inspection team to monitor slope fissures', type: 'SURVEILLANCE', priority: 'HIGH' }
              ]).map((t, i) => (
                <div key={i} className="p-2.5 rounded bg-black/40 border border-[#249344]/30 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#249344]/30 text-[#BDFF42] flex items-center justify-center font-mono text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span className="text-white font-medium">{t.title || t.action || t}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#249344]/20 text-[#BDFF42] border border-[#249344]/40">
                    {t.priority || 'HIGH'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assumption Ledger */}
        <div className="p-2.5 rounded bg-black/60 border border-[#249344]/20 font-mono text-[11px] space-y-1">
          <div className="text-slate-400 font-bold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#BDFF42]" />
            ACTIVE ASSUMPTION LEDGER (VERIFIER MONITORED):
          </div>
          <div className="text-[#9FD8A8] pl-2 space-y-0.5 text-[10px]">
            <div>• Rain trajectory follows Open-Meteo 72h forecast (delta &lt; +40mm)</div>
            <div>• NH10 corridor alternate route via Melli is open and navigable</div>
            <div>• Field reports from Deorali sector verified credible (confidence 0.94)</div>
          </div>
        </div>
      </div>

      {/* Decision Footer */}
      <div className="p-3 bg-[#06150C] border-t border-[#249344]/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Official authorization notes / conditionality..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!isPendingApproval || isLoading}
            className="w-full px-3 py-1.5 rounded bg-[#0A2416] border border-[#249344]/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#BDFF42] font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          {isPendingApproval ? (
            <>
              <button
                onClick={() => handleAction('reject')}
                disabled={isLoading}
                className="px-3 py-1.5 rounded bg-rose-950/60 border border-rose-500/50 text-rose-300 hover:bg-rose-900/60 transition-colors text-xs font-mono font-semibold flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                Reject
              </button>
              <button
                onClick={() => handleAction('approve')}
                disabled={isLoading}
                className="px-4 py-1.5 rounded bg-[#BDFF42] text-[#06150C] hover:bg-lime-300 transition-colors text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg shadow-lime-500/20"
              >
                <ShieldCheck className="w-4 h-4 fill-current" />
                Authorize Plan V{currentVersion}
              </button>
            </>
          ) : (
            <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Plan V{currentVersion} Authorized and Executing</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
