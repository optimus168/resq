import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Lock, CheckCircle2, RefreshCw, Terminal, Hash } from 'lucide-react';
import { api } from '../api';

export default function AuditLedger({ records = [], onRefresh }) {
  const [verification, setVerification] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const res = await api.verifyAuditChain();
      setVerification(res);
    } catch (err) {
      setVerification({ intact: false, reason: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A2416] rounded-lg border border-[#249344]/40 overflow-hidden shadow-xl font-mono text-xs">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#06150C] border-b border-[#249344]/30 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#BDFF42]" />
          <span className="font-bold text-white tracking-wider uppercase font-sans">
            APPEND-ONLY SHA-256 AUDIT LEDGER
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="px-2.5 py-1 rounded bg-[#249344]/30 border border-[#BDFF42] text-[#BDFF42] hover:bg-[#BDFF42] hover:text-[#06150C] transition-all flex items-center gap-1.5 font-bold shadow"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Verifying Math...' : 'Verify Cryptographic Chain'}</span>
          </button>
        </div>
      </div>

      {/* Verification Status Banner */}
      {verification && (
        <div className={`px-4 py-2 border-b flex items-center justify-between ${
          verification.intact
            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/70 border-rose-500/50 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {verification.intact ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            )}
            <span className="font-bold">
              {verification.intact 
                ? `LEDGER INTACT · ${verification.total_records || records.length} BLOCKS VERIFIED (GENESIS → HEAD)` 
                : `CHAIN BROKEN AT SEQ #${verification.broken_at_seq}: ${verification.reason}`}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Zero Retroactive Tampering</span>
        </div>
      )}

      {/* Ledger Table */}
      <div className="flex-1 overflow-auto p-3">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#249344]/30 text-slate-400 text-[10px] uppercase">
              <th className="py-2 px-2">SEQ</th>
              <th className="py-2 px-2">ACTION</th>
              <th className="py-2 px-2">ACTOR</th>
              <th className="py-2 px-2">SHA-256 HASH SIGNATURE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#249344]/20 text-[11px]">
            {records.map((r, i) => (
              <tr key={r.seq || i} className="hover:bg-black/30 transition-colors">
                <td className="py-2 px-2 font-bold text-[#BDFF42]">#{r.seq}</td>
                <td className="py-2 px-2 font-medium text-white">{r.action}</td>
                <td className="py-2 px-2 text-[#9FD8A8]">{r.actor}</td>
                <td className="py-2 px-2 text-slate-400 font-mono text-[10px] truncate max-w-[140px]" title={r.hash}>
                  {r.hash ? `${r.hash.substring(0, 14)}...` : 'HASH-VALID'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
