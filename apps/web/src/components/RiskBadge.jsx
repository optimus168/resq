import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Flame } from 'lucide-react';

export const RISK = {
  LOW: {
    color: '#22C55E',
    icon: ShieldCheck,
    hatch: 'hatch-low',
    label: 'LOW'
  },
  MODERATE: {
    color: '#EAB308',
    icon: AlertTriangle,
    hatch: 'hatch-moderate',
    label: 'MODERATE'
  },
  HIGH: {
    color: '#F97316',
    icon: AlertOctagon,
    hatch: 'hatch-high',
    label: 'HIGH'
  },
  IMMINENT: {
    color: '#EF4444',
    icon: Flame,
    hatch: 'hatch-imminent',
    label: 'IMMINENT'
  }
};

export const RiskBadge = ({ category, score, size = 'sm', testid = 'risk-badge' }) => {
  const r = RISK[category];
  if (!r) {
    return (
      <span className="font-data text-xs text-[var(--muted)]" data-testid={testid}>
        — NO ASSESSMENT
      </span>
    );
  }
  const Icon = r.icon;
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 font-data font-bold rounded ${
        size === 'lg' ? 'text-base px-3 py-1.5' : 'text-[11px] px-2 py-0.5'
      } ${r.hatch}`}
      style={{
        color: r.color,
        border: `1px solid ${r.color}`,
        backgroundColor: 'rgba(6,21,12,.92)',
        textShadow: '0 0 2px #000'
      }}
      aria-label={`Risk ${r.label}`}
    >
      <Icon size={size === 'lg' ? 18 : 13} aria-hidden={true} />
      <span>{r.label}</span>
      {score != null && <span className="opacity-80">· {score}</span>}
    </span>
  );
};

export const SimBadge = ({ text = 'PROTOTYPE', testid }) => (
  <span className="sim-badge" data-testid={testid}>
    {text}
  </span>
);

export const RiskLegend = () => (
  <div className="flex flex-wrap gap-2" data-testid="risk-legend">
    {Object.keys(RISK).map(k => (
      <RiskBadge key={k} category={k} testid={`legend-${k.toLowerCase()}`} />
    ))}
  </div>
);

export default RiskBadge;
