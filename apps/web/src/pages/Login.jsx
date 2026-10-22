import React, { useState } from 'react';
import { Loader2, ArrowLeft, Shield, CheckCircle } from 'lucide-react';
import { useNavigate } from '../router';
import { Logo } from '../components/Shell';
import { api } from '../api';

const DEMO_ACCOUNTS = [
  { role: 'Approver', email: 'collector@bhuraksha.demo', pass: 'Approve@RESQ26', title: 'District Collector (Sign-off Authority)' },
  { role: 'Operator', email: 'operator@bhuraksha.demo', pass: 'Operate@RESQ26', title: 'Incident Commander (Orchestration)' },
  { role: 'Field Officer', email: 'field@bhuraksha.demo', pass: 'Field@RESQ26', title: 'Field Operations & Ground Triage' },
  { role: 'Admin', email: 'admin@bhuraksha.demo', pass: 'Admin@RESQ26', title: 'System Security & Ledger Auditor' }
];

export default function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('collector@bhuraksha.demo');
  const [password, setPassword] = useState('Approve@RESQ26');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.login(email.trim(), password.trim());
      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
      navigate('/mission-control');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setError('');
  };

  const inputStyle = "w-full bg-[#06150C] border border-[#249344]/50 px-3 py-2 text-sm text-white focus:border-[#BDFF42] focus:ring-1 focus:ring-[#BDFF42] outline-none rounded-sm transition-all";

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#06150C]" data-testid="login-page">
      {/* Left Column: Atmospheric Visual Hero (Locally hosted, zero external CDN dependencies) */}
      <div 
        className="hidden lg:block relative bg-cover bg-center"
        style={{
          backgroundImage: "url('/poster_hero_gangtok.webp')"
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#06150C] via-[#06150C]/50 to-[#06150C]/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#06150C]/20 to-[#06150C]" />

        <div className="absolute top-8 left-8">
          <button 
            onClick={() => navigate('/')} 
            className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5 rounded-sm"
          >
            <ArrowLeft size={14} />
            <span>Back to Overview</span>
          </button>
        </div>

        <div className="absolute bottom-12 left-12 right-12">
          <div className="font-display text-4xl font-bold text-white leading-tight">
            Every alert is a human decision.
          </div>
          <p className="text-[#9FD8A8] text-sm mt-2 leading-relaxed">
            Agents prepare. Officials approve. Audit remembers.
          </p>
          <div className="flex gap-4 mt-6 text-xs text-[#5E8B67] font-data">
            <span>• 14 AI AGENTS</span>
            <span>• 30M COPERNICUS DEM</span>
            <span>• SHA-256 LEDGER</span>
          </div>
        </div>
      </div>

      {/* Right Column: Unified Login Form for All Roles */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex justify-between items-center">
            <Logo />
            <button 
              onClick={() => navigate('/')}
              className="lg:hidden text-xs text-[#9FD8A8] hover:text-white"
            >
              ← Overview
            </button>
          </div>

          <div>
            <h1 className="font-display text-3xl font-bold text-white mt-4">
              Operator sign-in
            </h1>
            <p className="text-xs text-[#9FD8A8] mt-1">
              Authenticate to access the live digital twin & human approval gate
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="eyebrow block mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                data-testid="login-email-input"
                className={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="eyebrow block mb-1.5" htmlFor="pw">
                Password
              </label>
              <input
                id="pw"
                type="password"
                data-testid="login-password-input"
                className={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="p-2.5 rounded bg-red-950/40 border border-red-500/50 text-red-300 text-xs font-mono" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              data-testid="login-submit-btn"
              disabled={loading}
              className="btn-lime w-full py-2.5 text-sm flex justify-center items-center gap-2 rounded-sm cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>Sign in</span>
            </button>
          </form>

          {/* Quick-select Demo Accounts (Only visible when VITE_DEMO_MODE=true or in local dev) */}
          {(import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.DEV) && (
            <div className="pt-4 border-t border-[#249344]/30">
              <div className="eyebrow mb-2.5 text-[#9FD8A8] flex justify-between items-center text-xs">
                <span>Demo accounts (DEMO ONLY)</span>
                <span className="text-xs text-[#5E8B67]">Click to fill</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = email === acc.email;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      data-testid={`demo-fill-${acc.role.toLowerCase().replace(' ', '-')}`}
                      onClick={() => handleQuickFill(acc)}
                      className={`btn-ghost text-xs py-2 px-2.5 rounded-sm capitalize text-left flex flex-col justify-between transition-colors ${
                        isSelected ? 'border-[#BDFF42] bg-[#BDFF42]/10 text-white' : ''
                      }`}
                    >
                      <span className="font-bold flex items-center justify-between">
                        {acc.role}
                        {isSelected && <CheckCircle size={12} className="text-[#BDFF42]" />}
                      </span>
                      <span className="text-xs font-mono text-[#5E8B67] truncate mt-0.5">
                        {acc.email.split('@')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
