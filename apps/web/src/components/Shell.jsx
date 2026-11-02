import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Radar, FlaskConical, Network, ShieldCheck, 
  Smartphone, Siren, Activity, ScrollText, 
  Sun, Moon, LogOut, Mountain, UserCheck,
  Menu, X, Shield, Map, Radio, Zap, Satellite, Waves, Rocket,
  ChevronDown, Layers, ChevronRight, Sparkles, CheckCircle2, Clapperboard,
  Key, Send, Check
} from 'lucide-react';
import { useNavigate, useLocation } from '../router';
import { api } from '../api';
import { toast } from '../lib/toast';
import { BrandMountainLogo } from './BrandMountainLogo';

// Primary high-command workspaces (Clean, unified core navigation)
export const PRIMARY_NAV_ITEMS = [
  { to: '/agent', label: 'AGENT', icon: Sparkles, badge: 'AI Chief', desc: 'Autonomous LLM Assistant, Plans, Processes & Human Gate' },
  { to: '/mission-control', label: 'Mission Control', icon: Radar, badge: 'Command', desc: 'Unified multi-agent operations center' },
  { to: '/risk-map', label: 'GIS Risk Map', icon: Map, badge: 'GSI Live', desc: 'Interactive NER landslide susceptibility & GSI layers' },
  { to: '/simulation-lab', label: 'Simulation Lab', icon: FlaskConical, desc: '3D Voellmy debris-flow & FoS physics twin' },
  { to: '/agent-console', label: 'Agent Console', icon: Network, badge: 'Qwen3-4B', desc: '14 agents + Main Officer Assistant LLM' },
  { to: '/approvals', label: 'Response Plans', icon: ShieldCheck, desc: 'Human-gated Plan V1/V2 sign-off & diffs' },
  { to: '/field-reports', label: 'Field & Sensors', icon: Smartphone, desc: 'Citizen field reports & ground truth intake' },
];

// Preserved for backward compatibility with existing tests/imports
export const NAV_ITEMS = [
  { to: '/agent', label: 'AGENT', icon: Sparkles },
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
];

export const TERRAGUARD_ITEMS = [
  { to: '/terraguard', label: 'BhuRaksha Geotech', icon: Mountain, desc: 'Regional geotechnical intelligence' },
  { to: '/risk-map', label: 'Unified GIS Heatmap', icon: Map, desc: 'Micro-catchment slope heatmap' },
  { to: '/terraguard/earthquakes', label: 'Earthquakes', icon: Activity, desc: 'USGS/EMSC seismic events feed' },
  { to: '/simulation-lab?tab=fos', label: 'FoS Slope Sim', icon: Zap, desc: 'Factor of Safety slope simulator' },
  { to: '/terraguard/lstm', label: 'Temporal LSTM', icon: Radio, desc: 'Deep learning rainfall predictor' },
  { to: '/alerts', label: 'CAP Dispatch', icon: Siren, desc: 'CAP 1.2 emergency broadcast' },
  { to: '/terraguard/ml', label: 'ML Sandbox', icon: FlaskConical, desc: 'Model evaluation & ROC/AUC' },
  { to: '/terraguard/hills', label: 'Hills & Mountains', icon: Mountain, desc: 'NER topography & elevation' },
];

export const GOVERNANCE_ITEMS = [
  { to: '/alerts', label: 'Alert Center', icon: Siren, desc: 'Real-time alarms & trigger feeds' },
  { to: '/data-health', label: 'Risk & Data Health', icon: Activity, desc: 'Sensor telemetry & stream status' },
  { to: '/audit', label: 'Audit Ledger', icon: ScrollText, desc: 'Cryptographic tamper-evident log' },
  { to: '/validation', label: 'Model Validation', icon: CheckCircle2, desc: 'Historical hindcast benchmarks' },
  { to: '/responsible-ai', label: 'Responsible AI & Safety', icon: ShieldCheck, desc: 'Human-in-the-loop governance' },
];

export function Logo({ small = false }) {
  const navigate = useNavigate();
  return <BrandMountainLogo small={small} onClick={() => navigate('/')} />;
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

  // Officer Profile & TextBee.dev SMS Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    role: '',
    phone: '',
    phone_10digit: '',
    country_code: '+91',
    sms_enabled: true,
    textbee_api_key: '',
    textbee_device_id: '',
    textbee_configured: false,
    masked_api_key: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [testSmsSending, setTestSmsSending] = useState(false);
  const [testAnyPhone, setTestAnyPhone] = useState('');
  const [testAnyMessage, setTestAnyMessage] = useState('');
  const [testAnySending, setTestAnySending] = useState(false);
  const [smsLogs, setSmsLogs] = useState([]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await api.getProfile();
      const smsStat = await api.getSmsStatus().catch(() => ({}));
      
      const realApiKey = res.textbee_api_key || res.api_key || smsStat.api_key || smsStat.textbee_api_key || '';
      const localPhone = (typeof localStorage !== 'undefined' ? localStorage.getItem('resq_officer_phone') : '') || '';
      const phone = res.phone || smsStat.default_phone || smsStat.current_user_phone || (localPhone ? `+91${localPhone}` : '') || '';
      const phone10 = res.phone_10digit || (phone ? phone.replace('+91', '').trim() : '') || localPhone;

      setProfileData(prev => ({
        ...prev,
        ...res,
        textbee_api_key: realApiKey || prev.textbee_api_key || '',
        phone,
        phone_10digit: phone10 || prev.phone_10digit || '',
        textbee_configured: Boolean(res.textbee_configured || smsStat.configured || realApiKey),
        masked_api_key: res.masked_api_key || smsStat.masked_api_key || '',
        phone_name: res.phone_name || smsStat.phone_name || 'motorola moto g34 5G',
      }));
      setSmsLogs(smsStat.recent_dispatches || []);
    } catch (e) {
      console.warn('Profile load error:', e);
    }
  }, []);

  useEffect(() => {
    if (profileModalOpen) {
      loadProfile();
    }
  }, [profileModalOpen, loadProfile]);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setProfileSaving(true);
    try {
      const digits = (profileData.phone_10digit || '').replace(/\D/g, '');
      if (digits && digits.length !== 10) {
        toast.error('Please enter a valid 10-digit Indian mobile number (or leave empty).');
        setProfileSaving(false);
        return;
      }
      const fullPhone = digits ? `+91${digits}` : '';
      if (digits && typeof localStorage !== 'undefined') {
        localStorage.setItem('resq_officer_phone', digits);
      }
      const updated = await api.updateProfile({
        name: profileData.name,
        phone: fullPhone,
        sms_enabled: profileData.sms_enabled,
        textbee_api_key: profileData.textbee_api_key ? profileData.textbee_api_key.trim() : undefined,
        textbee_device_id: profileData.textbee_device_id ? profileData.textbee_device_id.trim() : undefined,
      });

      // Dual persist to /sms/config for system_settings table guarantee
      await api.updateSmsConfig({
        textbee_api_key: profileData.textbee_api_key ? profileData.textbee_api_key.trim() : undefined,
        textbee_device_id: profileData.textbee_device_id ? profileData.textbee_device_id.trim() : undefined,
        officer_phone: digits || undefined,
      }).catch(() => {});

      setProfileData(prev => ({
        ...prev,
        ...updated,
        phone: fullPhone || updated.phone,
        phone_10digit: digits || updated.phone_10digit,
        textbee_api_key: profileData.textbee_api_key || updated.textbee_api_key || '',
        textbee_configured: Boolean(profileData.textbee_api_key || updated.textbee_configured),
      }));
      toast.success('Officer Profile & TextBee SMS settings saved!');
      loadProfile();
    } catch (err) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSendTestSms = async () => {
    const digits = (profileData.phone_10digit || '').replace(/\D/g, '');
    if (!digits || digits.length !== 10) {
      toast.error('Please enter a 10-digit Indian phone number first.');
      return;
    }
    setTestSmsSending(true);
    try {
      const res = await api.testOfficerSms(`+91${digits}`);
      if (res.status === 'SENT') {
        toast.success(`Critical Test SMS sent to +91${digits} via TextBee.dev!`);
      } else if (res.status === 'QUEUED_AWAITING_API_KEY') {
        toast.warning('Test SMS queued: Enter your TEXTBEE_API_KEY in the input field above.');
      } else {
        toast.info(`Test SMS dispatched (${res.status}): ${res.sms_id}`);
      }
      loadProfile();
    } catch (err) {
      toast.error(`Test SMS failed: ${err.message}`);
    } finally {
      setTestSmsSending(false);
    }
  };

  const handleSendTestToAnyNumber = async () => {
    const digits = (testAnyPhone || profileData.phone_10digit || '').replace(/\D/g, '');
    if (!digits || digits.length !== 10) {
      toast.error('Please enter a valid 10-digit Indian phone number to test.');
      return;
    }
    setTestAnySending(true);
    try {
      const res = await api.testOfficerSms({
        phone: `+91${digits}`,
        message: testAnyMessage.trim() || undefined
      });
      if (res.status === 'SENT') {
        toast.success(`Test SMS dispatched to +91${digits} via TextBee!`);
      } else if (res.status === 'QUEUED_AWAITING_API_KEY') {
        toast.warning('Test SMS queued: Enter your TEXTBEE_API_KEY in the field above.');
      } else {
        toast.info(`Test SMS dispatched (${res.status}): ${res.sms_id}`);
      }
      loadProfile();
    } catch (err) {
      toast.error(`Test SMS failed: ${err.message}`);
    } finally {
      setTestAnySending(false);
    }
  };

  useEffect(() => {
    // Keep UI/UX colors in default dark theme at all times; only sync header logo Sun/Moon
    document.documentElement.classList.remove('light');
    window.dispatchEvent(new CustomEvent('bhuraksha-theme-change', { detail: { isLight } }));
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

  // All navigable items across the entire platform
  const ALL_MENU_ITEMS = [
    ...PRIMARY_NAV_ITEMS,
    ...GOVERNANCE_ITEMS,
    ...GEOSHIELD_ITEMS,
    ...TERRAGUARD_ITEMS,
  ];

  // Resolve the currently selected menu item for the compact header indicator
  const currentMenuItem =
    ALL_MENU_ITEMS.find(item => pathname === item.to) ||
    ALL_MENU_ITEMS.find(item => item.to !== '/' && pathname.startsWith(item.to.split('?')[0] + '/')) ||
    ALL_MENU_ITEMS.find(item => item.to.split('?')[0] === pathname) ||
    PRIMARY_NAV_ITEMS[0];

  const CurrentIcon = currentMenuItem?.icon || Radar;

  return (
    <div className="min-h-screen flex flex-col bg-[#06150C] text-white selection:bg-[#BDFF42] selection:text-[#06150C]">
      {/* Top Header Navigation — Compact: Logo | Current Selected Page + Suite & Modules | User & Clock */}
      <header className="sticky top-0 z-[5000] bg-[#06150C] border-b border-[#249344]/40 px-3 sm:px-5 h-13 flex items-center justify-between gap-3 whitespace-nowrap">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <Logo small />
        </div>

        {/* Center Navigation: Current Selected Page + AGENT + Suite & Modules Dropdown */}
        <nav className="flex items-center justify-center gap-2 min-w-0 whitespace-nowrap">
          {/* Currently Selected Page Pill */}
          <button
            onClick={() => setSuiteMenuOpen(!suiteMenuOpen)}
            data-testid={`nav-${(currentMenuItem?.to || '/mission-control').slice(1).split('?')[0].replace(/[/]/g, '-')}`}
            title="Current active workspace (click to switch module)"
            className="flex items-center gap-2 px-3 h-9 text-xs font-semibold rounded-md bg-[#BDFF42]/15 border border-[#BDFF42]/50 text-white shadow-sm shadow-lime-500/10 whitespace-nowrap shrink-0 transition-all hover:bg-[#BDFF42]/25"
          >
            <CurrentIcon size={14} className="shrink-0 text-[#BDFF42]" />
            <span className="whitespace-nowrap">{currentMenuItem?.label || 'Mission Control'}</span>
            {currentMenuItem?.badge && (
              <span className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#249344]/40 text-[#BDFF42] border border-[#BDFF42]/30 whitespace-nowrap shrink-0">
                {currentMenuItem.badge}
              </span>
            )}
          </button>

          {/* Dedicated AGENT workspace button */}
          <button
            onClick={() => navigate('/agent')}
            data-testid="header-agent-btn"
            title="Open Autonomous Agent Dashboard & Officer Assistant"
            className={`flex items-center gap-1.5 px-3 h-9 text-xs font-semibold rounded-md transition-all shrink-0 ${
              pathname === '/agent'
                ? 'bg-[#BDFF42] text-[#06150C] font-bold shadow-md shadow-lime-500/20'
                : 'bg-[#BDFF42]/10 border border-[#BDFF42]/40 text-[#BDFF42] hover:bg-[#BDFF42]/20'
            }`}
          >
            <Sparkles size={14} className={pathname === '/agent' ? 'text-[#06150C]' : 'text-[#BDFF42]'} />
            <span>AGENT</span>
            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
              pathname === '/agent' ? 'bg-[#06150C]/20 text-[#06150C]' : 'bg-[#249344]/40 text-[#BDFF42]'
            }`}>
              AI Chief
            </span>
          </button>

          <div className="h-5 w-px bg-[#249344]/30 shrink-0" />

          {/* Suite & Modules Dropdown Menu (Contains EVERY menu item) */}
          <div className="relative shrink-0" ref={suiteMenuRef}>
            <button
              onClick={() => setSuiteMenuOpen(!suiteMenuOpen)}
              data-testid="suite-dropdown-btn"
              className={`flex items-center gap-1.5 px-3 h-9 text-xs font-semibold rounded-md border transition-all whitespace-nowrap shrink-0 ${
                suiteMenuOpen
                  ? 'bg-[#10B981]/25 border-[#BDFF42] text-white shadow-md'
                  : 'bg-[#0A2416] text-[#9FD8A8] hover:text-white hover:border-[#BDFF42]/60 border-[#249344]/50'
              }`}
            >
              <Layers size={14} className="shrink-0 text-[#BDFF42]" />
              <span className="whitespace-nowrap">Suite & Modules</span>
              <ChevronDown
                size={14}
                className={`shrink-0 transition-transform duration-200 text-[#9FD8A8] ${suiteMenuOpen ? 'rotate-180 text-[#BDFF42]' : ''}`}
              />
            </button>

            {/* Unified Mega Menu Popover containing EVERY workspace & module — strictly viewport-centered */}
            {suiteMenuOpen && (
              <div
                className="fixed top-14 bg-[#071E10] border border-[#249344] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.95)] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 z-[5100] whitespace-normal overflow-y-auto"
                style={{
                  backgroundColor: '#071E10',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 'min(920px, calc(100vw - 24px))',
                  maxHeight: 'calc(100vh - 72px)',
                }}
                data-testid="suite-dropdown-panel"
              >
                {/* Column 1: Primary Command Workspaces */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 px-2 py-1 border-b border-[#BDFF42]/40 mb-1">
                    <Radar size={13} className="text-[#BDFF42]" />
                    <span className="font-data text-[10px] font-bold text-[#BDFF42] tracking-wider uppercase">
                      Command Workspaces
                    </span>
                  </div>
                  {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon, desc, badge }) => {
                    const isActive = pathname === to || (to !== '/' && pathname.startsWith(to + '/'));
                    return (
                      <button
                        key={to}
                        onClick={() => {
                          navigate(to);
                          setSuiteMenuOpen(false);
                        }}
                        data-testid={`suite-nav-${to.slice(1).replace(/[/]/g, '-')}`}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all ${
                          isActive
                            ? 'bg-[#BDFF42]/20 border border-[#BDFF42]/50 text-white'
                            : 'hover:bg-[#249344]/20 border border-transparent text-[#9FD8A8] hover:text-white'
                        }`}
                      >
                        <Icon size={16} className={`mt-0.5 shrink-0 ${isActive ? 'text-[#BDFF42]' : 'text-[#5E8B67]'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[12px] font-semibold leading-tight">{label}</span>
                            {badge && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#249344]/40 text-[#BDFF42] border border-[#BDFF42]/30 shrink-0">
                                {badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#5E8B67] leading-snug mt-0.5">{desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Column 2: Core Operations & Governance */}
                <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-[#249344]/30 sm:pl-4">
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

                {/* Column 3: BhuRaksha Sensor AI */}
                <div className="space-y-1.5 border-t lg:border-t-0 lg:border-l border-[#249344]/30 lg:pl-4">
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

                {/* Column 4: BhuRaksha Geotechnical & ML */}
                <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-[#249344]/30 sm:pl-4">
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
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 whitespace-nowrap">
          <Clock />

          <button
            aria-label="Toggle theme"
            data-testid="theme-toggle"
            onClick={() => setIsLight(!isLight)}
            className="text-[#9FD8A8] hover:text-white p-1 rounded hover:bg-[#249344]/20 transition-colors shrink-0"
          >
            {isLight ? <Moon size={14} /> : <Sun size={14} />}
          </button>

          {/* Current User Info / Officer Profile & SMS Button */}
          <button
            onClick={() => setProfileModalOpen(true)}
            title="Click to edit Officer Profile, 10-digit Phone (+91) & TextBee SMS Key"
            data-testid="officer-profile-btn"
            className="text-right leading-tight hidden xl:flex items-center gap-2 p-1.5 rounded hover:bg-[#249344]/20 border border-transparent hover:border-[#BDFF42]/40 transition-all shrink-0 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-[#BDFF42]/15 border border-[#BDFF42]/50 flex items-center justify-center text-[#BDFF42] shrink-0">
              <Smartphone size={13} />
            </div>
            <div className="text-left">
              <div className="text-[11px] text-white font-medium max-w-[130px] truncate">
                {currentUser?.name || profileData.name || 'District Collector'}
              </div>
              <div className="font-data text-[9px] text-[#BDFF42] uppercase tracking-wider flex items-center gap-1">
                <span>{currentUser?.role || 'APPROVER'}</span>
                <span className="text-[#9FD8A8] font-mono text-[9px]">
                  {profileData.phone ? `(${profileData.phone})` : '(+91 SMS)'}
                </span>
              </div>
            </div>
          </button>

          {/* Desktop Logout Button */}
          <button
            onClick={handleLogout}
            title="Sign out / Switch Role"
            className="hidden sm:flex text-[#9FD8A8] hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors items-center gap-1 shrink-0"
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
        <div className="fixed inset-0 z-[5200] lg:hidden flex">
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

              {/* User Pill / Officer Profile Button */}
              <button
                type="button"
                onClick={() => {
                  setProfileModalOpen(true);
                  setMobileMenuOpen(false);
                }}
                data-testid="mobile-officer-profile-btn"
                className="w-full text-left p-2.5 rounded bg-[#0A2416] border border-[#249344]/40 hover:border-[#BDFF42] mb-3 flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="text-xs font-semibold text-white truncate">
                    {currentUser?.name || profileData.name || 'District Collector'}
                  </div>
                  <div className="font-data text-[9px] text-[#BDFF42] uppercase tracking-wider">
                    {currentUser?.role || 'APPROVER'} · {profileData.phone || '+91 SMS Setup'}
                  </div>
                </div>
                <Smartphone size={14} className="text-[#BDFF42]" />
              </button>

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
                RESQ.AI × BHURAKSHA · MISSION COMMAND
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Area */}
      <main className="flex-1 flex flex-col relative z-0 isolate">
        {children}
      </main>

      {/* Officer Profile & TextBee.dev Critical SMS Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-[6500] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="bg-[#071E10] border border-[#249344] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] scroll-thin"
            data-testid="officer-profile-modal"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#249344]/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#BDFF42]/15 border border-[#BDFF42]/40 flex items-center justify-center text-[#BDFF42]">
                  <Smartphone size={18} />
                </div>
                <div>
                  <div className="font-display text-base text-white">Officer Profile & TextBee SMS</div>
                  <div className="text-[10px] text-[#9FD8A8]">Critical alerting gateway for human officers</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="text-[#9FD8A8] hover:text-white text-xs font-mono p-1"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              {/* Officer Name & Role */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">Officer Name</label>
                  <input
                    type="text"
                    value={profileData.name || ''}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full bg-[#06150C] border border-[#249344]/50 focus:border-[#BDFF42] rounded px-3 py-2 text-white outline-none"
                    placeholder="District Collector"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#9FD8A8] mb-1">Assigned Role</label>
                  <input
                    type="text"
                    disabled
                    value={profileData.role || currentUser?.role || 'APPROVER'}
                    className="w-full bg-[#06150C]/60 border border-[#249344]/30 rounded px-3 py-2 text-[#9FD8A8] outline-none font-mono uppercase"
                  />
                </div>
              </div>

              {/* 10-Digit Mobile Number with fixed India +91 Country Code */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono uppercase text-[#BDFF42] font-bold">
                    Officer Mobile Number (10 Digits · India +91)
                  </label>
                  <span className="text-[9px] font-mono text-[#9FD8A8]">Prefix: +91</span>
                </div>
                <div className="flex items-center">
                  <span className="bg-[#0A2416] border border-r-0 border-[#249344]/60 text-[#BDFF42] font-mono text-xs font-bold px-3 py-2 rounded-l">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    data-testid="officer-phone-input"
                    value={profileData.phone_10digit || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setProfileData({ ...profileData, phone_10digit: val });
                    }}
                    placeholder="9876543210"
                    className="flex-1 bg-[#06150C] border border-[#249344]/60 focus:border-[#BDFF42] rounded-r px-3 py-2 text-white outline-none font-mono text-sm tracking-wider"
                  />
                </div>
                <div className="text-[10px] text-[#5E8B67] mt-1">
                  When a field report is uploaded or a critical hazard escalates, an instant SMS is sent to <b className="text-[#9FD8A8]">+91 {profileData.phone_10digit || 'XXXXXXXXXX'}</b> via TextBee.dev.
                </div>
              </div>

              {/* TextBee.dev API Key & Android Gateway Device */}
              <div className="p-3 rounded-lg bg-[#06150C] border border-[#249344]/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase text-[#BDFF42] font-bold flex items-center gap-1.5">
                    <Key size={12} />
                    <span>TextBee.dev API Key (TEXTBEE_API_KEY)</span>
                  </label>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    profileData.textbee_configured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    {profileData.textbee_configured ? 'CONFIGURED' : 'PASTE KEY HERE'}
                  </span>
                </div>
                <input
                  type="text"
                  data-testid="textbee-api-key-input"
                  value={profileData.textbee_api_key || ''}
                  onChange={(e) => setProfileData({ ...profileData, textbee_api_key: e.target.value })}
                  placeholder={profileData.masked_api_key || "Paste your TextBee API key (or set in .env)"}
                  className="w-full bg-[#0A2416] border border-[#249344]/60 focus:border-[#BDFF42] rounded px-3 py-2 text-white outline-none font-mono text-xs"
                />
                {profileData.textbee_configured && (
                  <div className="text-[10px] text-[#22C55E] flex items-center gap-1.5 font-mono">
                    <CheckCircle2 size={12} />
                    <span>Active Gateway Key: {profileData.masked_api_key || 'Configured'} (Loaded from .env / SQLite)</span>
                  </div>
                )}

                {/* Gateway Device Info */}
                <div className="p-2 rounded bg-[#0A2416] border border-[#249344]/40 space-y-1 text-[10px] font-mono">
                  <div className="flex items-center justify-between text-[#9FD8A8]">
                    <span>Default Android Gateway:</span>
                    <span className="text-white font-bold">{profileData.phone_name || 'motorola moto g34 5G'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#5E8B67]">
                    <span>Device ID (Optional):</span>
                    <span className="text-[#BDFF42] truncate max-w-[200px]">{profileData.device_id || '6adc7b8ba4996b8ebf83ed43'}</span>
                  </div>
                  <div className="text-[9px] text-[#5E8B67]">
                    * If Device ID is left empty, TextBee uses default settings with the primary active device.
                  </div>
                </div>

                <div className="text-[10px] text-[#9FD8A8] flex items-center justify-between gap-1 flex-wrap">
                  <span>Endpoint: <code className="text-[#BDFF42]">https://api.textbee.dev/api/v1/gateway/send-sms</code></span>
                  <a
                    href="https://textbee.dev/blog/textbee-dev-sms-gateway-quickstart"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#38BDF8] hover:underline"
                  >
                    Quickstart Guide
                  </a>
                </div>
              </div>

              {/* Test SMS to ANY Phone Number */}
              <div className="p-3 rounded-lg bg-[#0A2213] border border-[#38BDF8]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono uppercase text-[#38BDF8] font-bold flex items-center gap-1.5">
                    <Send size={12} />
                    <span>Test SMS Gateway (Send to Any Number)</span>
                  </div>
                  <span className="text-[9px] font-mono text-[#9FD8A8]">Live Dispatch</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center">
                    <span className="bg-[#06150C] border border-r-0 border-[#249344]/60 text-[#38BDF8] font-mono text-xs font-bold px-2.5 py-1.5 rounded-l">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={testAnyPhone}
                      onChange={(e) => setTestAnyPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder={profileData.phone_10digit || "Any 10 digits"}
                      className="flex-1 bg-[#06150C] border border-[#249344]/60 focus:border-[#38BDF8] rounded-r px-2.5 py-1.5 text-white outline-none font-mono text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={testAnyMessage}
                    onChange={(e) => setTestAnyMessage(e.target.value)}
                    placeholder="Custom test message (or leave empty for default)"
                    className="bg-[#06150C] border border-[#249344]/60 focus:border-[#38BDF8] rounded px-2.5 py-1.5 text-white outline-none text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[10px] text-[#9FD8A8]">
                    Send a real verification SMS to any phone via Motorola Moto G34 5G.
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestToAnyNumber}
                    disabled={testAnySending}
                    data-testid="send-test-sms-to-any-btn"
                    className="btn-lime px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-40"
                  >
                    <Send size={12} className={testAnySending ? 'animate-bounce' : ''} />
                    <span>{testAnySending ? 'TRANSMITTING…' : 'SEND TEST SMS'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons: Save & Close */}
              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="btn-ghost px-3 py-2 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  data-testid="save-profile-btn"
                  className="btn-lime px-4 py-2 rounded text-xs font-mono font-bold flex items-center gap-1.5"
                >
                  <Check size={13} />
                  <span>{profileSaving ? 'SAVING…' : 'SAVE PROFILE & SMS'}</span>
                </button>
              </div>

              {/* Recent SMS Dispatches Log */}
              {smsLogs.length > 0 && (
                <div className="pt-2 border-t border-[#249344]/30 space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-[#9FD8A8] font-bold">
                    Recent TextBee SMS Transmissions ({smsLogs.length})
                  </div>
                  <div className="max-h-28 overflow-y-auto scroll-thin space-y-1 pr-1 font-mono text-[10px]">
                    {smsLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="p-1.5 rounded bg-[#06150C] border border-[#249344]/30 flex items-center justify-between text-[#d6f5dc]">
                        <span className="truncate max-w-[200px]">{log.message}</span>
                        <span className={`px-1 rounded text-[9px] ${
                          log.status === 'SENT' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
