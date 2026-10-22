import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Clock, AlertOctagon, HelpCircle } from 'lucide-react';

export function SimulatedBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[#FFA31A]/20 text-[#FFA31A] border border-[#FFA31A]/40 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#FFA31A] animate-pulse"></span>
      PROTOTYPE
    </span>
  );
}

export function RiskBadge({ level, score, showScore = true, className = '' }) {
  const normLevel = (level || 'LOW').toUpperCase();
  
  const config = {
    LOW: {
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-500/50',
      text: 'text-emerald-400',
      icon: CheckCircle2,
      label: 'LOW HAZARD',
      hatch: '///'
    },
    MODERATE: {
      bg: 'bg-amber-950/40',
      border: 'border-amber-500/50',
      text: 'text-amber-400',
      icon: Clock,
      label: 'MODERATE',
      hatch: '///'
    },
    HIGH: {
      bg: 'bg-orange-950/40',
      border: 'border-orange-500/60',
      text: 'text-orange-400',
      icon: AlertTriangle,
      label: 'HIGH RISK',
      hatch: 'XXX'
    },
    CRITICAL: {
      bg: 'bg-rose-950/50',
      border: 'border-rose-500/80',
      text: 'text-rose-400',
      icon: AlertOctagon,
      label: 'IMMINENT FAILURE',
      hatch: '!!!'
    },
    IMMINENT: {
      bg: 'bg-rose-950/50',
      border: 'border-rose-500/80',
      text: 'text-rose-400',
      icon: AlertOctagon,
      label: 'IMMINENT FAILURE',
      hatch: '!!!'
    }
  }[normLevel] || {
    bg: 'bg-slate-900',
    border: 'border-slate-700',
    text: 'text-slate-300',
    icon: HelpCircle,
    label: normLevel,
    hatch: '???'
  };

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${config.bg} ${config.border} ${config.text} ${className}`}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="font-mono text-[10px] tracking-tight mr-0.5 opacity-60">[{config.hatch}]</span>
      <span>{config.label}</span>
      {showScore && score !== undefined && (
        <span className="ml-1 pl-1 border-l border-current/30 font-mono text-[11px]">
          {(score * 100).toFixed(0)}%
        </span>
      )}
    </span>
  );
}

export function StatusBadge({ status, className = '' }) {
  const norm = (status || 'UNKNOWN').toUpperCase();
  const styles = {
    MONITORING: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
    PENDING_APPROVAL: 'bg-amber-950/60 border-amber-500/50 text-amber-300 animate-amber-glow',
    EXECUTING: 'bg-blue-950/60 border-blue-500/40 text-blue-300',
    REPLANNING: 'bg-purple-950/60 border-purple-500/50 text-purple-300 animate-pulse',
    RESOLVED: 'bg-slate-900 border-slate-700 text-slate-400',
    REJECTED: 'bg-rose-950/60 border-rose-500/40 text-rose-300',
  }[norm] || 'bg-slate-900 border-slate-700 text-slate-400';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${styles} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {norm.replace('_', ' ')}
    </span>
  );
}

export function RoleBadge({ role }) {
  const norm = (role || 'OPERATOR').toUpperCase();
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono tracking-wide bg-[#249344]/20 border border-[#249344]/40 text-[#9FD8A8]">
      <span className="text-[#BDFF42]">ROLE:</span> {norm}
    </span>
  );
}
