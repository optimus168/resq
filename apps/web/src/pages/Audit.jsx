import React, { useState, useEffect } from 'react';
import { http } from '../lib/api';
import { ShieldCheck, ShieldAlert, CheckCircle, RefreshCw, Key } from 'lucide-react';

export default function Audit() {
  const [rows, setRows] = useState(null);
  const [chain, setChain] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchLogs = () => {
    http.get('/audit')
      .then(r => setRows(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const verify = () => {
    http.get('/audit/verify')
      .then(r => setChain(r.data))
      .catch(() => {});
  };

  return (
    <div className="p-3 max-w-6xl mx-auto space-y-3" data-testid="audit-page">
      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <div className="font-display text-2xl text-white">Cryptographic Audit Ledger</div>
          <span className="font-data text-[10px] text-[#5E8B67]">
            Append-only linear SHA-256 hash-chained immutable security record
          </span>
        </div>

        <button
          data-testid="verify-chain-btn"
          onClick={verify}
          className="btn-ghost px-3 py-1.5 text-xs ml-auto rounded flex items-center gap-1.5"
        >
          <Key size={13} />
          <span>Verify chain integrity</span>
        </button>

        {chain && (
          <span
            className="font-data text-xs flex items-center gap-1 font-bold px-2 py-1 rounded border"
            style={{
              color: chain.intact ? '#22C55E' : '#EF4444',
              borderColor: chain.intact ? '#22C55E' : '#EF4444',
              background: chain.intact ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'
            }}
            data-testid="chain-result"
          >
            {chain.intact ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            <span>{chain.intact ? `INTACT · ${chain.records} records verified` : `BROKEN at record #${chain.broken_at}`}</span>
          </span>
        )}
      </div>

      {/* Ledger table */}
      <div className="panel rounded-lg overflow-x-auto scroll-thin border border-[#249344]/30">
        <table className="w-full min-w-[620px] text-[11px]" data-testid="audit-table">
          <thead>
            <tr className="eyebrow text-left border-b border-[#249344]/30 bg-[#06150C]">
              <th className="p-2.5">#</th>
              <th className="p-2.5">Time</th>
              <th className="p-2.5">Action</th>
              <th className="p-2.5">User</th>
              <th className="p-2.5">Prev Hash</th>
              <th className="p-2.5">Record Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#249344]/15 font-data">
            {!rows ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-[#5E8B67]">
                  Loading audit chain…
                </td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-[#5E8B67]">
                  No audit entries recorded yet.
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <React.Fragment key={r.id || r.seq}>
                  <tr
                    onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                    className="hover:bg-[#249344]/10 cursor-pointer transition-colors"
                  >
                    <td className="p-2 text-[#9FD8A8]">{r.seq ?? r.id}</td>
                    <td className="p-2 text-white">
                      {new Date(r.timestamp * 1000 || r.created_at || Date.now()).toLocaleTimeString()}
                    </td>
                    <td className="p-2 text-[#BDFF42] font-bold">{r.action}</td>
                    <td className="p-2 text-[#d6f5dc]">{r.user || r.actor || 'system'}</td>
                    <td className="p-2 text-[#5E8B67] truncate max-w-[120px]" title={r.prev_hash}>
                      {r.prev_hash?.slice(0, 12)}…
                    </td>
                    <td className="p-2 text-[#22C55E] truncate max-w-[140px]" title={r.hash || r.record_hash}>
                      {(r.hash || r.record_hash)?.slice(0, 16)}…
                    </td>
                  </tr>
                  {expandedRow === r.id && (
                    <tr className="bg-[#06150C]">
                      <td colSpan={6} className="p-3 border-t border-b border-[#249344]/40">
                        <div className="eyebrow mb-1">Payload & cryptographic proofs</div>
                        <pre className="text-[10px] text-[#9FD8A8] overflow-x-auto p-2 bg-[#0A2416] rounded border border-[#249344]/20">
                          {JSON.stringify(r.payload || r.details || r, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
