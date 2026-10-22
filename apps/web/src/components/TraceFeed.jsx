import React, { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle2, AlertTriangle, ArrowRight, Zap, ShieldCheck, Filter, Search, RefreshCw } from 'lucide-react';
import { api } from '../api';

export default function TraceFeed({ traces = [], events = [], incidentId = '', onSelectAgent = null, compact = false }) {
  const [fetchedEvents, setFetchedEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAgent, setFilterAgent] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const incomingList = traces.length > 0 ? traces : events;

  useEffect(() => {
    if (!incidentId || incomingList.length > 0) return;
    let alive = true;
    setLoading(true);

    api.getIncidentEvents(incidentId)
      .then((evts) => {
        if (!alive) return;
        if (evts && evts.length > 0) {
          setFetchedEvents(evts);
        } else {
          // Fallback to replay trace if events table empty
          return api.replayIncident(incidentId).then((r) => {
            if (alive && r?.replay_steps) {
              setFetchedEvents(r.replay_steps);
            }
          });
        }
      })
      .catch((err) => console.warn('TraceFeed fetch error:', err))
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [incidentId, incomingList.length]);

  const rawList = incomingList.length > 0 ? incomingList : fetchedEvents;

  // Normalize items
  const normalizedTraces = rawList.map((item, idx) => {
    const agent = item.agent || 'system';
    const action = item.action || item.type || item.message || 'Workflow step executed';
    const detail = item.detail || item.message || item.reason || (typeof item.payload === 'string' ? item.payload : '');
    const toolCalls = item.tool_calls || (item.type === 'tool' ? [{ name: item.tool || 'tool.invoke' }] : []);
    const latency = item.latency_ms ?? (item.latency ? Math.round(item.latency * 1000) : null);
    const ts = item.timestamp || item.ts || '';

    return {
      id: item.seq ?? idx + 1,
      agent,
      action,
      detail,
      toolCalls,
      latency,
      evidence: item.evidence,
      invalidation: item.invalidation,
      timestamp: ts,
      raw: item,
    };
  });

  const availableAgents = ['ALL', ...Array.from(new Set(normalizedTraces.map(t => t.agent.toLowerCase())))];

  const filtered = normalizedTraces.filter((t) => {
    if (filterAgent !== 'ALL' && t.agent.toLowerCase() !== filterAgent.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.agent.toLowerCase().includes(q) ||
        t.action.toLowerCase().includes(q) ||
        String(t.detail).toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-hidden">
      {/* Controls: Filter & Search Bar */}
      <div className="p-2 border-b border-[#249344]/30 bg-[#06150C]/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Search size={13} className="text-[#5E8B67]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter trace events..."
            className="w-full bg-[#0A2416] border border-[#249344]/30 text-white text-[11px] px-2 py-1 rounded-sm outline-none focus:border-[#BDFF42]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-[#9FD8A8]" />
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-[#0A2416] border border-[#249344]/30 text-[#BDFF42] text-[10px] px-2 py-1 rounded-sm uppercase font-mono outline-none"
          >
            {availableAgents.map((ag) => (
              <option key={ag} value={ag}>
                {ag}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-[#5E8B67] pl-1">
            {filtered.length} / {normalizedTraces.length}
          </span>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scroll-thin">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 text-[#BDFF42] mb-2 animate-spin" />
            <div>Streaming immutable event log...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <Activity className="w-8 h-8 text-[#249344] mb-2 opacity-50 animate-pulse" />
            <div>{searchQuery ? 'No events matching filter' : 'Awaiting agent activation...'}</div>
            <div className="text-[10px] text-slate-600 mt-1">Traces stream dynamically as agents execute tasks.</div>
          </div>
        ) : (
          filtered.map((trace) => {
            const isVerifier = trace.agent === 'verifier';
            const isSimulation = trace.agent === 'simulation';
            const isReplan = trace.agent === 'replan' || trace.invalidation;
            const isSupervisor = trace.agent === 'orchestrator' || trace.agent === 'supervisor';

            let borderClass = 'border-[#249344]/30 bg-[#06150C]';
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
            } else if (isSupervisor) {
              borderClass = 'border-[#BDFF42]/40 bg-emerald-950/20';
              badgeColor = 'bg-[#BDFF42]/20 text-[#BDFF42]';
            }

            return (
              <div
                key={trace.id}
                onClick={() => onSelectAgent?.(trace.agent)}
                className={`p-2.5 rounded-sm border ${borderClass} transition-all hover:border-[#BDFF42]/60 space-y-1.5 cursor-pointer`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#5E8B67] font-mono">#{trace.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${badgeColor}`}>
                      {trace.agent}
                    </span>
                    <span className="text-[11px] font-sans font-semibold text-white">
                      {trace.action}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    {trace.latency !== null && (
                      <span className="text-cyan-400 font-mono">{trace.latency}ms</span>
                    )}
                    {trace.timestamp && (
                      <span className="text-[#5E8B67] hidden sm:inline">
                        {trace.timestamp.split('T')[1]?.slice(0, 8) || ''}
                      </span>
                    )}
                  </div>
                </div>

                {trace.detail && (
                  <p className="text-[11px] text-slate-300 font-mono leading-relaxed pl-2 border-l border-[#249344]/30 break-words">
                    {typeof trace.detail === 'object' ? JSON.stringify(trace.detail) : trace.detail}
                  </p>
                )}

                {trace.toolCalls && trace.toolCalls.length > 0 && (
                  <div className="text-[10px] text-[#BDFF42] bg-[#0A2416] px-2 py-1 rounded border border-[#249344]/30 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-[#BDFF42] flex-shrink-0" />
                    <span className="text-slate-400">Tool:</span>
                    <span className="font-mono">{trace.toolCalls.map((t) => t.name).join(', ')}</span>
                  </div>
                )}

                {trace.evidence && (
                  <div className="text-[10px] text-slate-400 pl-2 border-l border-emerald-500/40">
                    📄 Evidence: {trace.evidence}
                  </div>
                )}

                {trace.invalidation && (
                  <div className="text-[10px] text-[#FFA31A] pl-2 border-l border-[#FFA31A]">
                    ⚠️ Invalidation: {trace.invalidation}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
