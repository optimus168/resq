import React from 'react';
import { ShieldCheck, Lock, AlertTriangle, Users, DollarSign, CheckCircle2, XCircle, ArrowLeft, HeartHandshake } from 'lucide-react';

export default function ResponsibleAIPage({ onBack }) {
  return (
    <div className="h-full w-full bg-[#06150C] text-white flex flex-col font-mono text-xs overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#249344]/40 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded bg-[#0A2416] border border-[#249344]/40 text-[#BDFF42] hover:bg-[#249344]/20 flex items-center gap-1 font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO MISSION CONTROL</span>
          </button>
          <div>
            <h1 className="text-base font-bold text-white uppercase font-sans tracking-wider">
              RESPONSIBLE AI, SAFETY BOUNDARIES & IMPACT MODEL
            </h1>
            <p className="text-[11px] text-[#9FD8A8]">
              Operational Governance · Human-in-the-Loop Authority · Grounded Economics
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded bg-amber-500/20 text-[#FFA31A] border border-amber-500/40 font-bold text-[10px]">
          PROTOTYPE DECISION-SUPPORT SYSTEM · NOT A STATUTORY WARNING SERVICE
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Safety & Autonomous Authority Matrix */}
        <div className="space-y-4">
          <div className="p-4 bg-[#0A2416] rounded-xl border border-[#249344]/40 space-y-3">
            <div className="flex items-center gap-2 text-[#BDFF42] font-bold text-sm font-sans">
              <ShieldCheck className="w-5 h-5" />
              <span>AGENT AUTONOMY VS. HUMAN APPROVAL BOUNDARY</span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans">
              To guarantee zero hallucinated emergency actions, the platform strictly segregates what agents can execute autonomously versus what requires cryptographic sign-off by the District Collector.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border border-[#249344]/30 rounded">
                <thead className="bg-[#06150C] text-[#BDFF42]">
                  <tr>
                    <th className="p-2 border-b border-[#249344]/30">Action / Capability</th>
                    <th className="p-2 border-b border-[#249344]/30">Agentic Role</th>
                    <th className="p-2 border-b border-[#249344]/30">Human Authority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#249344]/20 text-slate-300">
                  <tr>
                    <td className="p-2">Terrain Ingestion & Physics Simulation</td>
                    <td className="p-2 text-emerald-400 font-bold">Autonomous</td>
                    <td className="p-2 text-slate-400">None required</td>
                  </tr>
                  <tr>
                    <td className="p-2">Drafting Evacuation & Response SOP Plans</td>
                    <td className="p-2 text-emerald-400 font-bold">Autonomous</td>
                    <td className="p-2 text-slate-400">Review only</td>
                  </tr>
                  <tr>
                    <td className="p-2">Disseminating Public CAP 1.2 Alerts</td>
                    <td className="p-2 text-rose-400 font-bold">LOCKED</td>
                    <td className="p-2 text-[#BDFF42] font-bold">Collector / DM Only</td>
                  </tr>
                  <tr>
                    <td className="p-2">Mobilizing SDRF / NDRF Heavy Assets</td>
                    <td className="p-2 text-rose-400 font-bold">LOCKED</td>
                    <td className="p-2 text-[#BDFF42] font-bold">Incident Commander</td>
                  </tr>
                  <tr>
                    <td className="p-2">Selective Replanning on Perturbation</td>
                    <td className="p-2 text-emerald-400 font-bold">Autonomous Draft</td>
                    <td className="p-2 text-[#BDFF42] font-bold">Re-Authorization Required</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Privacy & Citizen Protection */}
          <div className="p-4 bg-[#0A2416] rounded-xl border border-[#249344]/40 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm font-sans">
              <Lock className="w-5 h-5" />
              <span>DATA PRIVACY & PII SAFEGUARDS</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <strong>GPS Jittering:</strong> Citizen field reports undergo 150m random spatial dithering in public views to protect household privacy.
              </li>
              <li>
                <strong>Automatic PII Redaction:</strong> Phone numbers, vehicle registration plates, and personal names are scrubbed before LLM summarization.
              </li>
              <li>
                <strong>Prompt Injection Quarantine:</strong> Incoming citizen text is parsed strictly as passive data, never system instructions.
              </li>
            </ul>
          </div>
        </div>

        {/* Column 2: Pilot Plan & Unit Economics */}
        <div className="space-y-4">
          {/* Unit Cost Estimates */}
          <div className="p-4 bg-[#0A2416] rounded-xl border border-[#249344]/40 space-y-3">
            <div className="flex items-center gap-2 text-[#FFA31A] font-bold text-sm font-sans">
              <DollarSign className="w-5 h-5" />
              <span>DEPLOYMENT UNIT ECONOMICS (ESTIMATES)</span>
            </div>
            <p className="text-[11px] text-slate-300 font-sans">
              Grounded cost modeling with transparent assumptions. Zero licensing cost for core GIS/ML layers:
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#06150C] p-2.5 rounded border border-[#249344]/30">
                <span className="text-slate-400 block text-[10px]">LoRaWAN Sensor Node:</span>
                <span className="text-[#BDFF42] font-bold text-sm">₹45,000 / unit</span>
                <span className="text-[10px] text-slate-400 block">Vibrating wire piezometer + tilt + solar</span>
              </div>
              <div className="bg-[#06150C] p-2.5 rounded border border-[#249344]/30">
                <span className="text-slate-400 block text-[10px]">30m Terrain Elevation:</span>
                <span className="text-emerald-400 font-bold text-sm">₹0 (Open Data)</span>
                <span className="text-[10px] text-slate-400 block">Copernicus GLO-30 / AWS Open Data</span>
              </div>
              <div className="bg-[#06150C] p-2.5 rounded border border-[#249344]/30">
                <span className="text-slate-400 block text-[10px]">District Server / Inference:</span>
                <span className="text-cyan-400 font-bold text-sm">₹18,000 / month</span>
                <span className="text-[10px] text-slate-400 block">NIC Cloud or local edge server node</span>
              </div>
              <div className="bg-[#06150C] p-2.5 rounded border border-[#249344]/30">
                <span className="text-slate-400 block text-[10px]">District Pilot Budget:</span>
                <span className="text-[#FFA31A] font-bold text-sm">₹8.5 Lakhs (1 Year)</span>
                <span className="text-[10px] text-slate-400 block">10 telemetry nodes + gateway + compute</span>
              </div>
            </div>
          </div>

          {/* Stakeholders & Pilot Plan */}
          <div className="p-4 bg-[#0A2416] rounded-xl border border-[#249344]/40 space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm font-sans">
              <Users className="w-5 h-5" />
              <span>STAKEHOLDERS & DISTRICT PILOT ROADMAP</span>
            </div>

            <div className="space-y-2 text-[11px] text-slate-300">
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <span className="text-[#BDFF42] font-bold block">1. Sikkim Pilot Corridor (NH-10):</span>
                <span>Collaboration with Sikkim State Disaster Management Authority (SSDMA) & Border Roads Organisation (Project Swastik). 6-month trial on Singtam-Rangpo stretch.</span>
              </div>
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <span className="text-cyan-400 font-bold block">2. Manipur Noney/Tupul Pilot:</span>
                <span>Northeast Frontier Railway (NFR) alignment monitoring with District Disaster Management Authority (DDMA Noney).</span>
              </div>
              <div className="bg-[#06150C] p-2 rounded border border-[#249344]/30">
                <span className="text-[#FFA31A] font-bold block">3. Success KPIs:</span>
                <span>&gt;4 hours advance evacuation lead-time; &lt;10% false positive alert rate; &lt;3-second selective replanning latency.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
