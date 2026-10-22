import React, { useState, useEffect, useRef } from 'react';
import { 
  Radar, FlaskConical, Network, ShieldCheck, 
  Smartphone, Siren, Activity, ScrollText, 
  Sun, Moon, LogOut, Mountain, UserCheck,
  Menu, X, Shield, Map, Radio, Zap, Satellite, Waves, Rocket,
  ChevronDown, Layers, ChevronRight, Sparkles, CheckCircle2, Clapperboard
} from 'lucide-react';
import { useNavigate, useLocation } from '../router';
import { api } from '../api';

// Primary high-command workspaces (Clean, unified core navigation)
export const PRIMARY_NAV_ITEMS = [
  { to: '/mission-control', label: 'Mission Control', icon: Radar },
  { to: '/risk-map', label: 'GIS Risk Map', icon: Map, badge: 'GSI Live' },
  { to: '/simulation-lab', label: 'Simulation Lab', icon: FlaskConical },
  { to: '/agent-console', label: 'Agent Console', icon: Network },
  { to: '/approvals', label: 'Response Plans', icon: ShieldCheck },
  { to: '/field-reports', label: 'Field & Sensors', icon: Smartphone },
];

// Preserved for backward compatibility with existing tests/imports
export const NAV_ITEMS = [
  { to: '/mission-control', label: 'Mission Control', icon: Radar },
  { to: '/simulation-lab', label: 'Simulation Lab', icon: FlaskConical },
  { to: '/agent-console', label: 'Agent Console', icon: Network },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/field-reports', label: 'Field Reports', icon: Smartphone },
  { to: '/alerts', label: 'Alert Center', icon: Siren },
  { to: '/data-health', label: 'Risk & Data', icon: Activity },
  { to: '/audit', label: 'Audit', icon: ScrollText },
];

export const GEOSHIELD_ITEMS = [
  { to: '/geoshield/dashboard', label: 'Sensor Sentinel', icon: Shield, desc: 'NER regional sensor & state summary' },
  { to: '/risk-map', label: 'GIS Risk Map', icon: Map, desc: 'Unified sensor & GSI hazard map' },
  { to: '/stations', label: 'Sensor Grid', icon: Radio, desc: 'IoT tiltmeter & piezometer telemetry' },
  { to: '/simulation-lab?tab=network', label: 'Network Simulator', icon: Zap, desc: 'IoT sensor network stress engine' },
  { to: '/satellite', label: 'Satellite Hub', icon: Satellite, desc: 'Sentinel-1 SAR deformation' },
  { to: '/flood', label: 'Flood Correlation', icon: Waves, desc: 'Hydro-meteorological streamflow' },
  { to: '/demo', label: 'Operations Walkthrough', icon: Rocket, desc: 'Interactive emergency response walkthrough' },
];

export const TERRAGUARD_ITEMS = [
  { to: '/terraguard', label: 'BhuRaksha Geotech', icon: Mountain, desc: 'Regional geotechnical intelligence' },
  { to: '/risk-map', label: 'Unified GIS Heatmap', icon: Map, desc: 'Micro-catchment slope heatmap' },
  { to: '/terraguard/earthquakes', label: 'Earthquakes', icon: Activity, desc: 'USGS/EMSC seismic events feed' },
  { to: '/simulation-lab?tab=fos', label: 'FoS Slope Sim', icon: Zap, desc: 'Factor of Safety slope simulator' },
  { to: '/terraguard/lstm', label: 'Temporal LSTM', icon: Radio, desc: 'Deep learning rainfall predictor' },
  { to: '/alerts', label: 'CAP Dispatch', icon: Siren, desc: 'Multilingual emergency broadcast' },
  { to: '/terraguard/ml', label: 'ML Sandbox', icon: FlaskConical, desc: 'Model evaluation & ROC/AUC' },
  { to: '/terraguard/hills', label: 'Hills & Mountains', icon: Mountain, desc: 'NER topography & elevation' },
];

export const GOVERNANCE_ITEMS = [
  { to: '/alerts', label: 'Alert Center', icon: Siren, desc: 'Real-time alarms & trigger feeds' },
  { to: '/data-health', label: 'Risk & Data Health', icon: Activity, desc: 'Sensor telemetry & stream status' },
  { to: '/audit', label: 'Audit Ledger', icon: ScrollText, desc: 'Cryptographic tamper-evident log' },
  { to: '/validation', label: 'Model Validation', icon: CheckCircle2, desc: 'Historical hindcast benchmarks' },
  { to: '/responsible-ai', label: 'Responsible AI & Safety', icon: ShieldCheck, desc: 'Human-in-the-loop governance' },
  { to: '/presenter', label: 'Presenter Walkthrough', icon: Clapperboard, desc: 'Scripted 6-step lifecycle demo' },
];

export function Logo({ small = false }) {
  const navigate = useNavigate();
  return (
    <div 
      onClick={() => navigate('/')} 
      className="flex items-center gap-2 cursor-pointer select-none group"
      data-testid="brand-logo"
    >
      <div className="w-7 h-7 rounded-md bg-[#BDFF42] grid place-items-center shadow-md shadow-lime-500/25 group-hover:scale-105 transition-transform shrink-0">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#06150C">
          <path d="M2 20 L9 8 L13 14 L16 10 L22 20 Z" />
          <circle cx="17.5" cy="5.5" r="2.2" />
        </svg>
      </div>
      <div className="leading-none min-w-0">
        <div className="font-display text-[14px] sm:text-[15px] font-bold text-white tracking-wide truncate">
          RESQ.AI <span className="text-[#BDFF42]">· BHURAKSHA</span>
        </div>
        {!small && (
          <div className="font-data text-[9px] text-[#5E8B67] tracking-[0.2em] uppercase mt-0.5 hidden sm:block">
            NER-OPERATIONAL · AGENTIC LANDSLIDE OPS
          </div>
        )}
      </div>
    </div>
  );
}

export function Clock() {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="font-data text-[11px] sm:text-xs text-[#9FD8A8] tabular-nums whitespace-nowrap" data-testid="ops-clock">
      {timeStr} <span className="hidden sm:inline">IST</span>
    </span>
  );
}

export default function Shell({ children, currentUser, onLogout }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isLight, setIsLight] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suiteMenuOpen, setSuiteMenuOpen] = useState(false);
  const suiteMenuRef = useRef(null);

  // Accordion state in mobile menu
  const [mobileExpandedSection, setMobileExpandedSection] = useState('primary');

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight);
  }, [isLight]);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSuiteMenuOpen(false);
  }, [pathname]);

  // Click outside to close suite dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suiteMenuRef.current && !suiteMenuRef.current.contains(event.target)) {
        setSuiteMenuOpen(false);
      }
    };
    if (suiteMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [suiteMenuOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSuiteMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    api.logout();
    if (onLogout) onLogout();
    navigate('/login');
  };

  // Check if current route is part of deep suite tools
  const isSuiteActive = (
    GOVERNANCE_ITEMS.some(item => pathname === item.to || pathname.startsWith(item.to + '/')) ||
    GEOSHIELD_ITEMS.some(item => item.to !== '/risk-map' && (pathname === item.to || pathname.startsWith(item.to + '/'))) ||
    TERRAGUARD_ITEMS.some(item => pathname === item.to || pathname.startsWith(item.to + '/'))
  );

  // Find active suite label for badge
  const activeSuiteItem = [
    ...GOVERNANCE_ITEMS,
    ...GEOSHIELD_ITEMS.filter(i => i.to !== '/risk-map'),
    ...TERRAGUARD_ITEMS
  ].find(item => pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to + '/')));

  return (
    <div className="min-h-screen flex flex-col bg-[#06150C] text-white selection:bg-[#BDFF42] selection:text-[#06150C]">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#06150C]/90 border-b border-[#249344]/40 px-3 h-12 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Logo small />
        </div>

        {/* Streamlined Desktop Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1">
          {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => {
            const isActive = pathname === to || (to !== '/' && pathname.startsWith(to + '/'));
            return (
              <button
                key={to}
                onClick={() => navigate(to)}
                data-testid={`nav-${to.slice(1).replace(/[/]/g, '-')}`}
                className={`relative flex items-center gap-1.5 px-3 h-10 text-[12px] font-medium rounded-md transition-all ${
                  isActive
                    ? 'text-white bg-[#BDFF42]/15 border border-[#BDFF42]/40 font-semibold shadow-sm shadow-lime-500/10'
                    : 'text-[#9FD8A8] hover:text-white hover:bg-[#249344]/15 border border-transparent'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[#BDFF42]' : 'text-[#5E8B67]'} />
                <span>{label}</span>
                {badge && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#249344]/40 text-[#BDFF42] border border-[#BDFF42]/30">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="h-5 w-px bg-[#249344]/30 mx-1.5 shrink-0" />

          {/* Suite & Modules Dropdown Menu */}
          <div className="relative" ref={suiteMenuRef}>
            <button
              onClick={() => setSuiteMenuOpen(!suiteMenuOpen)}
              data-testid="suite-dropdown-btn"
              className={`flex items-center gap-1.5 px-3 h-10 text-[12px] font-medium rounded-md border transition-all ${
                suiteMenuOpen || isSuiteActive
                  ? 'bg-[#10B981]/15 border-[#10B981]/50 text-white font-semibold'
                  : 'text-[#6EE7B7] hover:text-white hover:bg-[#10B981]/10 border-transparent'
              }`}
            >
              <Layers size={14} className={isSuiteActive ? 'text-[#38BDF8]' : 'text-[#6EE7B7]'} />
              <span>Suite & Modules</span>
              {activeSuiteItem && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0284C7]/30 text-[#7DD3FC] border border-[#38BDF8]/40 truncate max-w-[90px]">
                  {activeSuiteItem.label}
                </span>
              )}
              <ChevronDown 
                size={13} 
                className={`transition-transform duration-200 text-[#9FD8A8] ${suiteMenuOpen ? 'rotate-180 text-white' : ''}`} 
              />
            </button>

            {/* Polished Mega Popover Menu */}
            {suiteMenuOpen && (
              <div 
                className="absolute right-0 sm:left-0 sm:right-auto mt-1 w-[720px] max-w-[92vw] bg-[#071E10]/95 backdrop-blur-2xl border border-[#249344]/60 rounded-xl shadow-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                data-testid="suite-dropdown-panel"
              >
                {/* Column 1: Core Command & Governance */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#249344]/30 mb-1">
                    <ShieldCheck size={13} className="text-[#BDFF42]" />
                    <span className="font-data text-[10px] font-bold text-[#BDFF42] tracking-wider uppercase">
                      Core Operations & Audit
                    </span>
                  </div>
                  {GOVERNANCE_ITEMS.map(({ to, label, icon: Icon, desc }) => {
                    const isActive = pathname === to;
                    return (
                      <button
                        key={to}
                        onClick={() => {
                          navigate(to);
                          setSuiteMenuOpen(false);
                        }}
                        data-testid={`nav-${to.slice(1)}`}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                          isActive 
                            ? 'bg-[#BDFF42]/20 border border-[#BDFF42]/40 text-white'
                            : 'hover:bg-[#249344]/20 border border-transparent text-[#9FD8A8] hover:text-white'
                        }`}
                      >
                        <Icon size={16} className={`mt-0.5 shrink-0 ${isActive ? 'text-[#BDFF42]' : 'text-[#5E8B67]'}`} />
                        <div>
                          <div className="text-[12px] font-medium leading-tight">{label}</div>
                          <div className="text-[10px] text-[#5E8B67] leading-snug mt-0.5">{desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Column 2: BhuRaksha Sensor AI */}
                <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-[#249344]/30 md:pl-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#38BDF8]/30 mb-1">
                    <Shield size={13} className="text-[#38BDF8]" />
                    <span className="font-data text-[10px] font-bold text-[#38BDF8] tracking-wider uppercase">
                      Sensor Sentinel (NER)
                    </span>
                  </div>
                  {GEOSHIELD_ITEMS.map(({ to, label, icon: Icon, desc }) => {
                    const isActive = pathname === to;
                    return (
                      <button
                        key={to}
                        onClick={() => {
                          navigate(to);
                          setSuiteMenuOpen(false);
                        }}
                        data-testid={`nav-geoshield-${to.replace(/[/]/g, '-')}`}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                          isActive 
                            ? 'bg-[#0284C7]/25 border border-[#38BDF8]/40 text-white'
                            : 'hover:bg-[#0284C7]/15 border border-transparent text-[#7DD3FC] hover:text-white'
                        }`}
                      >
                        <Icon size={16} className={`mt-0.5 shrink-0 ${isActive ? 'text-[#38BDF8]' : 'text-[#0284C7]'}`} />
                        <div>
                          <div className="text-[12px] font-medium leading-tight">{label}</div>
                          <div className="text-[10px] text-[#0284C7] leading-snug mt-0.5">{desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Column 3: BhuRaksha Geotechnical & ML */}
                <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-[#249344]/30 md:pl-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#10B981]/30 mb-1">
                    <Mountain size={13} className="text-[#10B981]" />
                    <span className="font-data text-[10px] font-bold text-[#10B981] tracking-wider uppercase">
                      BhuRaksha Geotech & ML
                    </span>
                  </div>
                  {TERRAGUARD_ITEMS.map(({ to, label, icon: Icon, desc }) => {
                    const isActive = pathname === to;
                    return (
                      <button
                        key={to}
                        onClick={() => {
                          navigate(to);
                          setSuiteMenuOpen(false);
                        }}
                        data-testid={`nav-terraguard-${to.replace(/[/]/g, '-')}`}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                          isActive 
                            ? 'bg-[#10B981]/25 border border-[#10B981]/40 text-white'
                            : 'hover:bg-[#10B981]/15 border border-transparent text-[#6EE7B7] hover:text-white'
                        }`}
                      >
                        <Icon size={16} className={`mt-0.5 shrink-0 ${isActive ? 'text-[#10B981]' : 'text-[#059669]'}`} />
                        <div>
                          <div className="text-[12px] font-medium leading-tight">{label}</div>
                          <div className="text-[10px] text-[#059669] leading-snug mt-0.5">{desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right Status Items & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="sim-badge hidden 2xl:inline text-[9px]" data-testid="global-sim-badge">
            PROTOTYPE
          </span>

          <Clock />

          <button
            aria-label="Toggle theme"
            data-testid="theme-toggle"
            onClick={() => setIsLight(!isLight)}
            className="text-[#9FD8A8] hover:text-white p-1 rounded hover:bg-[#249344]/20 transition-colors"
          >
            {isLight ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          {/* Current User Info */}
          <div className="text-right leading-tight hidden md:block" data-testid="current-user">
            <div className="text-[11px] text-white font-medium max-w-[140px] truncate">
              {currentUser?.name || 'District Collector'}
            </div>
            <div className="font-data text-[9px] text-[#BDFF42] uppercase tracking-wider">
              {currentUser?.role || 'APPROVER'}
            </div>
          </div>

          {/* Desktop Logout Button */}
          <button
            onClick={handleLogout}
            title="Sign out / Switch Role"
            className="hidden sm:flex text-[#9FD8A8] hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors items-center gap-1"
          >
            <LogOut size={14} />
          </button>

          {/* Mobile Hamburger Button (Visible on < lg) */}
          <button
            aria-label="Toggle mobile menu"
            data-testid="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded text-[#BDFF42] hover:bg-[#249344]/20 transition-colors flex items-center justify-center border border-[#249344]/40"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="relative ml-auto w-84 max-w-[90vw] h-full bg-[#06150C] border-l border-[#249344]/50 p-4 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto scroll-thin">
            <div>
              {/* Header inside drawer */}
              <div className="flex items-center justify-between pb-3 border-b border-[#249344]/30 mb-3">
                <Logo small />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded text-[#9FD8A8] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* User Pill */}
              <div className="p-2.5 rounded bg-[#0A2416] border border-[#249344]/40 mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser?.name || 'District Collector'}
                  </div>
                  <div className="font-data text-[9px] text-[#BDFF42] uppercase tracking-wider">
                    {currentUser?.role || 'APPROVER'}
                  </div>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              </div>

              {/* Primary Command Workspaces */}
              <div className="space-y-1 mb-3">
                <div className="font-data text-[9px] text-[#5E8B67] px-2 mb-1 uppercase tracking-wider">
                  PRIMARY COMMAND WORKSPACES
                </div>
                {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => {
                  const isActive = pathname === to;
                  return (
                    <button
                      key={to}
                      onClick={() => {
                        navigate(to);
                        setMobileMenuOpen(false);
                      }}
                      data-testid={`mobile-nav-${to.slice(1).replace(/[/]/g, '-')}`}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors text-left ${
                        isActive
                          ? 'bg-[#BDFF42] text-[#06150C] font-bold shadow-sm'
                          : 'text-[#9FD8A8] hover:text-white hover:bg-[#249344]/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} className={isActive ? 'text-[#06150C]' : 'text-[#BDFF42]'} />
                        <span>{label}</span>
                      </div>
                      {badge && (
                        <span className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                          isActive ? 'bg-[#06150C]/20 text-[#06150C]' : 'bg-[#249344]/30 text-[#BDFF42]'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Collapsible Section: Core Operations & Audit */}
              <div className="mb-2 border border-[#249344]/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'core' ? '' : 'core')}
                  className="w-full flex items-center justify-between p-2.5 bg-[#081F12] text-xs font-semibold text-[#BDFF42]"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} />
                    <span>Governance & Audit ({GOVERNANCE_ITEMS.length})</span>
                  </div>
                  <ChevronRight 
                    size={13} 
                    className={`transition-transform ${mobileExpandedSection === 'core' ? 'rotate-90' : ''}`} 
                  />
                </button>
                {mobileExpandedSection === 'core' && (
                  <div className="p-1 space-y-1 bg-[#06150C]">
                    {GOVERNANCE_ITEMS.map(({ to, label, icon: Icon }) => {
                      const isActive = pathname === to;
                      return (
                        <button
                          key={to}
                          onClick={() => {
                            navigate(to);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors text-left ${
                            isActive
                              ? 'bg-[#BDFF42]/20 text-[#BDFF42] font-semibold'
                              : 'text-[#9FD8A8] hover:text-white hover:bg-[#249344]/20'
                          }`}
                        >
                          <Icon size={14} className={isActive ? 'text-[#BDFF42]' : 'text-[#5E8B67]'} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Collapsible Section: Sensor Sentinel */}
              <div className="mb-2 border border-[#38BDF8]/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'geoshield' ? '' : 'geoshield')}
                  className="w-full flex items-center justify-between p-2.5 bg-[#0284C7]/15 text-xs font-semibold text-[#38BDF8]"
                >
                  <div className="flex items-center gap-2">
                    <Shield size={14} />
                    <span>Sensor Sentinel ({GEOSHIELD_ITEMS.length})</span>
                  </div>
                  <ChevronRight 
                    size={13} 
                    className={`transition-transform ${mobileExpandedSection === 'geoshield' ? 'rotate-90' : ''}`} 
                  />
                </button>
                {mobileExpandedSection === 'geoshield' && (
                  <div className="p-1 space-y-1 bg-[#06150C]">
                    {GEOSHIELD_ITEMS.map(({ to, label, icon: Icon }) => {
                      const isActive = pathname === to;
                      return (
                        <button
                          key={to}
                          onClick={() => {
                            navigate(to);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors text-left ${
                            isActive
                              ? 'bg-[#0284C7]/30 text-[#38BDF8] font-semibold'
                              : 'text-[#7DD3FC] hover:text-white hover:bg-[#0284C7]/20'
                          }`}
                        >
                          <Icon size={14} className={isActive ? 'text-[#38BDF8]' : 'text-[#0284C7]'} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Collapsible Section: BhuRaksha Geotech */}
              <div className="mb-2 border border-[#10B981]/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setMobileExpandedSection(mobileExpandedSection === 'terraguard' ? '' : 'terraguard')}
                  className="w-full flex items-center justify-between p-2.5 bg-[#10B981]/15 text-xs font-semibold text-[#10B981]"
                >
                  <div className="flex items-center gap-2">
                    <Mountain size={14} />
                    <span>BhuRaksha Geotechnical ({TERRAGUARD_ITEMS.length})</span>
                  </div>
                  <ChevronRight 
                    size={13} 
                    className={`transition-transform ${mobileExpandedSection === 'terraguard' ? 'rotate-90' : ''}`} 
                  />
                </button>
                {mobileExpandedSection === 'terraguard' && (
                  <div className="p-1 space-y-1 bg-[#06150C]">
                    {TERRAGUARD_ITEMS.map(({ to, label, icon: Icon }) => {
                      const isActive = pathname === to;
                      return (
                        <button
                          key={to}
                          onClick={() => {
                            navigate(to);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors text-left ${
                            isActive
                              ? 'bg-[#10B981]/30 text-[#10B981] font-semibold'
                              : 'text-[#6EE7B7] hover:text-white hover:bg-[#10B981]/20'
                          }`}
                        >
                          <Icon size={14} className={isActive ? 'text-[#10B981]' : 'text-[#059669]'} />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions inside drawer */}
            <div className="pt-4 border-t border-[#249344]/30 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#9FD8A8] px-1">
                <span>Theme</span>
                <button
                  onClick={() => setIsLight(!isLight)}
                  className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1.5 rounded"
                >
                  {isLight ? <Moon size={12} /> : <Sun size={12} />}
                  <span>{isLight ? 'Light' : 'Dark'}</span>
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
              >
                <LogOut size={14} />
                <span>Sign Out / Switch Role</span>
              </button>

              <div className="text-center font-data text-[9px] text-[#5E8B67]">
                RESQ.AI × BHURAKSHA · PROTOTYPE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Area */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
