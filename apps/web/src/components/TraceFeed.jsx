import React from 'react';
import { Activity, Clock, CheckCircle2, AlertTriangle, ArrowRight, Zap, ShieldCheck } from 'lucide-react';

export default function TraceFeed({ traces = [] }) {
  if (!traces || traces.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs">
        <Activity className="w-8 h-8 text-[#249344] mb-2 opacity-50 animate-pulse" />
        <div>Awaiting agent activation...</div>
        <div className="text-[10px] text-slate-600 mt-1">Traces will stream dynamically as agents execute tasks.</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-2.5 font-mono text-xs">
      {traces.map((trace, idx) => {
        const isVerifier = trace.agent === 'verifier';
        const isSimulation = trace.agent === 'simulation';
        const isReplan = trace.agent === 'replan';

        let borderClass = 'border-[#249344]/30 bg-black/40';
        let badgeColor = 'bg-[#249344]/30 text-[#9FD8A8]';

        if (isVerifier) {
          borderClass = 'border-purple-500/40 bg-purple-950/20';
          badgeColor = 'bg-purple-900/60 text-purple-300';
        } else if (isSimulation) {
          borderClass = 'border-blue-500/40 bg-blue-950/20';
          badgeColor = 'bg-blue-900/60 text-blue-300';
        } else if (isReplan) {
          borderClass = 'border-[#FFA31A]/50 bg-amber-950/20';
          badgeColor = 'bg-amber-900/60 text-[#FFA31A]';
        }

        return (
          <div 
            key={idx}
            className={`p-2.5 rounded-lg border ${borderClass} transition-all hover:border-[#BDFF42]/50 space-y-1.5`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${badgeColor}`}>
                  {trace.agent || 'SYSTEM'}
                </span>
                <span className="text-[11px] font-sans font-semibold text-white">
                  {trace.action || 'Workflow step executed'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                {trace.latency_ms ? `${trace.latency_ms}ms` : '12ms'}
              </span>
            </div>

            {trace.tool_calls && trace.tool_calls.length > 0 && (
              <div className="text-[11px] text-[#BDFF42] bg-[#06150C] px-2 py-1 rounded border border-[#249344]/20 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[#BDFF42]" />
                <span className="text-slate-400">Tool:</span>
                <span>{trace.tool_calls.map(t => t.name).join(', ')}</span>
              </div>
            )}

            {trace.evidence && (
              <div className="text-[10px] text-slate-400 pl-2 border-l border-[#249344]/40">
                {trace.evidence}
              </div>
            )}

            {trace.invalidation && (
              <div className="text-[10px] text-[#FFA31A] pl-2 border-l border-[#FFA31A]">
                ⚠️ Invalidation: {trace.invalidation}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
