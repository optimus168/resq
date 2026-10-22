import React from 'react';

export default function AssumptionLedger({ incident }) {
  const valid = incident?.assumptions || [];
  const hist = [...(incident?.assumption_history || [])].reverse();

  if (!valid.length) {
    return (
      <div className="p-3 text-xs text-[#5E8B67] font-data" data-testid="assumptions-empty">
        Assumptions appear after the Verifier runs.
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="assumption-ledger">
      {valid.map(a => (
        <div key={a.id} className="card px-2 py-1 text-[11px] flex gap-2 rounded" data-testid={`assumption-${a.id}`}>
          <span className="font-data text-[#22C55E] w-[92px] shrink-0 font-medium">{a.id}</span>
          <span className="flex-1 text-[#d6f5dc]">{a.text}</span>
          <span className="font-data text-[9px] text-[#22C55E] shrink-0">VALID</span>
          <span className="font-data text-[9px] text-[#5E8B67] shrink-0">by {a.by}</span>
        </div>
      ))}
      {hist.length > 0 && (
        <div className="pt-2 border-t border-[#249344]/30 mt-2 space-y-1">
          <div className="eyebrow text-[9px]">Invalidated assumptions ({hist.length})</div>
          {hist.map((h, i) => (
            <div key={i} className="px-2 py-1 text-[10px] flex gap-2 opacity-60 line-through text-[#EF4444]">
              <span className="font-data w-[92px] shrink-0">{h.id}</span>
              <span className="flex-1">{h.text}</span>
              <span className="font-data text-[9px]">INVALIDATED: {h.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
