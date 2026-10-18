import React, { useState } from 'react';
import MissionControl from './components/MissionControl';
import { Mountain, Shield, Activity, Sparkles, ArrowRight, Layers, FileCheck } from 'lucide-react';
import { SimulatedBadge } from './components/Badges';

export default function App() {
  const [currentView, setCurrentView] = useState('mission_control'); // 'landing', 'mission_control'

  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-[#06150C] text-white flex flex-col font-sans">
        {/* Navigation */}
        <header className="px-8 py-5 border-b border-[#249344]/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#BDFF42] text-[#06150C] flex items-center justify-center font-black text-base shadow-lg shadow-lime-500/20">
              RQ
            </div>
            <div>
              <div className="text-lg font-black tracking-tight">
                BHURAKSHA <span className="text-[#BDFF42]">×</span> RESQ.AI
              </div>
              <div className="text-[11px] font-mono text-[#9FD8A8]">
                AGENTIC AI LANDSLIDE INTELLIGENCE PLATFORM (SIH26001)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SimulatedBadge />
            <button
              onClick={() => setCurrentView('mission_control')}
              className="px-5 py-2.5 rounded-lg bg-[#BDFF42] text-[#06150C] font-bold text-xs tracking-wider uppercase hover:bg-lime-300 transition-all shadow-lg shadow-lime-500/25 flex items-center gap-2"
            >
              <span>Launch Mission Control</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-6xl mx-auto px-6 py-16 flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#249344]/20 border border-[#249344]/40 text-[#BDFF42] text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>INFOTHON 7.0 / SIH 2026 PROTOTYPE · AUTONOMOUS AGENTIC REPLANNING</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl">
            Protecting India's North Eastern Region With{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#BDFF42] via-emerald-400 to-[#FFA31A]">
              Coupled Physics & Autonomous Agentic AI
            </span>
          </h1>

          <p className="max-w-2xl text-slate-300 text-base leading-relaxed">
            A 14-agent LangGraph supervisor orchestration coordinating AWS Terrarium DEM digital twins, 
            infinite-slope Factor of Safety simulations, tamper-evident SHA-256 audit ledgers, 
            and backend-enforced Human Approval Gates for Gangtok, Shillong, Aizawl, and Tupul.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setCurrentView('mission_control')}
              className="px-8 py-3.5 rounded-lg bg-[#BDFF42] text-[#06150C] font-bold text-sm tracking-wider uppercase hover:bg-lime-300 transition-all shadow-xl shadow-lime-500/30 flex items-center gap-2"
            >
              <span>Enter Mission Control Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 text-left w-full">
            <div className="p-6 rounded-xl bg-[#0A2416] border border-[#249344]/40 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#249344]/30 text-[#BDFF42] flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Visible Agent Graph</h3>
              <p className="text-xs text-[#9FD8A8] leading-relaxed">
                Watch 14 logical agents analyze rainfall telemetry, inspect slope stability, run simulations, and route multilingual alerts in real time.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#0A2416] border border-[#249344]/40 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#249344]/30 text-[#BDFF42] flex items-center justify-center">
                <Mountain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">3D Landslide Digital Twin</h3>
              <p className="text-xs text-[#9FD8A8] leading-relaxed">
                Coupled hydro-mechanical simulation: unsaturated bucket infiltration → infinite-slope failure → D8 debris runout on real 30m terrain.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#0A2416] border border-[#249344]/40 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#249344]/30 text-[#BDFF42] flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Autonomous Re-planning Gate</h3>
              <p className="text-xs text-[#9FD8A8] leading-relaxed">
                When external conditions change (rain surge, blocked road), the Verifier invalidates assumptions and generates Plan V2 with visual diffs.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <MissionControl />;
}
