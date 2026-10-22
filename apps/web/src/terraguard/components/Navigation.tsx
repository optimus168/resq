import React, { useCallback, useEffect, useRef, useState } from 'react';
import { OperationalModule, NerState } from '../types';
import { useI18n } from '../i18n/index.tsx';
import {
  Home,
  LayoutDashboard,
  Map,
  BarChart2,
  Bell,
  AlertOctagon,
  Cpu,
  Info,
  PlayCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  Mountain,
  PlusCircle,
  ShieldAlert,
} from 'lucide-react';

interface NavigationProps {
  activeModule: OperationalModule;
  onChangeModule: (module: OperationalModule) => void;
  reportCount?: number;
  theme?: 'dark' | 'light';
  language?: string;
  selectedState?: NerState;
  onSelectState?: (state: NerState) => void;
  onOpenQuickEvac?: () => void;
  onOpenReportHazard?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeModule,
  onChangeModule,
  reportCount = 12,
  theme = 'dark',
  language,
  selectedState,
  onSelectState,
  onOpenQuickEvac,
  onOpenReportHazard,
}) => {
  const { t } = useI18n();
  const isDark = theme === 'dark';
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 1);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    updateScrollState();
    element.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateScrollState)
      : null;
    resizeObserver?.observe(element);

    return () => {
      element.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
    updateScrollState();
  }, [activeModule, updateScrollState]);

  const scrollNavigation = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: direction * Math.max(scrollRef.current.clientWidth * 0.72, 220),
      behavior: 'smooth',
    });
  };

  const primaryModules: {
    id: OperationalModule;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }[] = [
    {
      id: 'home',
      title: t('navigation.home'),
      icon: Home,
    },
    {
      id: 'dashboard',
      title: t('navigation.dashboard'),
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      id: 'risk-map',
      title: t('navigation.riskMap'),
      icon: Map,
      badge: 'GIS 3D',
      badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
      id: 'earthquake-monitor',
      title: t('navigation.earthquakes'),
      icon: Activity,
      badge: 'NCS Live',
      badgeColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    },
    {
      id: 'risk-details',
      title: t('navigation.riskDetails'),
      icon: BarChart2,
      badge: 'Analytics',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
    {
      id: 'alerts',
      title: t('navigation.alerts'),
      icon: Bell,
      badge: '4 High',
      badgeColor: 'text-red-400 bg-red-500/15 border-red-500/30 animate-pulse',
    },
    {
      id: 'emergency-sos',
      title: t('navigation.emergencySos'),
      icon: AlertOctagon,
      badge: '24x7',
      badgeColor: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    },
    {
      id: 'risk-simulator',
      title: t('navigation.mlSimulator'),
      icon: PlayCircle,
      badge: 'Real ML',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      id: 'hills-regions',
      title: t('navigation.hillsMountains'),
      icon: Mountain,
      badge: 'NER',
      badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
      id: 'about',
      title: t('navigation.about'),
      icon: Cpu,
    },
  ];

  return (
    <nav
      className={`border-b sticky top-12 z-30 transition-colors duration-200 ${
        isDark
          ? 'bg-[#051424]/90 backdrop-blur-md border-slate-800/80'
          : 'bg-white/90 backdrop-blur-md border-slate-200/80 shadow-sm'
      }`}
    >
      <div className="app-wide-container w-full px-3 sm:px-6">
        <div className="flex min-w-0 items-center justify-between gap-2 py-2">
          {/* Scrollable module navigation pills */}
          <div className="flex min-w-0 items-center gap-1.5 flex-1">
            <button
              type="button"
              onClick={() => scrollNavigation(-1)}
              disabled={!canScrollLeft}
              aria-label="Scroll navigation left"
              className={`shrink-0 rounded-lg border p-1.5 transition-colors ${
                canScrollLeft
                  ? isDark
                    ? 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  : 'cursor-not-allowed border-transparent text-slate-600 opacity-50'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div
              ref={scrollRef}
              onWheel={(event) => {
                if (event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                  event.currentTarget.scrollLeft += event.deltaY;
                  event.preventDefault();
                }
              }}
              className="navigation-scroll min-w-0 flex-1 overflow-x-auto no-scrollbar scroll-smooth"
            >
              <div className="flex w-max items-center gap-1.5 sm:gap-2">
              {primaryModules.map((m) => {
                const Icon = m.icon;
                // Map legacy IDs to canonical nav items
                const isActive =
                  activeModule === m.id ||
                  (m.id === 'risk-map' && activeModule === 'spatial-gis-command') ||
                  (m.id === 'alerts' && activeModule === 'emergency-broadcast-and-dispatch') ||
                  (m.id === 'about' &&
                    (activeModule === 'ml-models-pipeline' ||
                      activeModule === 'temporal-lstm-predictor' ||
                      activeModule === 'crowdsource-cv-verification'));

                return (
                  <button
                    key={m.id}
                    ref={isActive ? activeButtonRef : undefined}
                    onClick={() => onChangeModule(m.id)}
                    className={`navigation-item flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative cursor-pointer whitespace-nowrap border ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                        : isDark
                        ? 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-500'}`} />
                    <span>{m.title}</span>

                    {m.badge && (
                      <span
                        className={`navigation-badge text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                          isActive ? 'bg-white/20 text-white border-white/30' : m.badgeColor
                        }`}
                      >
                        {m.badge}
                      </span>
                    )}
                  </button>
                );
              })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => scrollNavigation(1)}
              disabled={!canScrollRight}
              aria-label="Scroll navigation right"
              className={`shrink-0 rounded-lg border p-1.5 transition-colors ${
                canScrollRight
                  ? isDark
                    ? 'border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  : 'cursor-not-allowed border-transparent text-slate-600 opacity-50'
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Operational Utility Cluster: State Filter + Report Hazard + CAP Dispatch */}
          <div className="hidden md:flex items-center gap-2 shrink-0 border-l pl-3 border-slate-800">
            {onSelectState && (
              <div className="relative">
                <select
                  value={selectedState || 'all'}
                  onChange={(e) => onSelectState(e.target.value as NerState)}
                  aria-label="Filter command sector by state"
                  className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 pr-6 appearance-none cursor-pointer border transition-all ${
                    isDark
                      ? 'bg-slate-900/80 text-slate-200 border-slate-700 hover:border-emerald-500'
                      : 'bg-slate-100 text-slate-800 border-slate-300 hover:border-emerald-600'
                  }`}
                >
                  <option value="all">ALL REGIONS (NER & HIMALAYAS)</option>
                  <option value="uttarakhand">UTTARAKHAND (UTTARKASHI)</option>
                  <option value="sikkim">SIKKIM (TEESTA)</option>
                  <option value="assam">ASSAM (DIMA HASAO)</option>
                  <option value="meghalaya">MEGHALAYA (SOHRA)</option>
                  <option value="arunachal">ARUNACHAL (KAMENG)</option>
                  <option value="manipur">MANIPUR (TUPUL)</option>
                  <option value="mizoram">MIZORAM (AIZAWL)</option>
                  <option value="nagaland">NAGALAND (KOHIMA)</option>
                  <option value="tripura">TRIPURA (JAMPUI)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
                  <span className="text-[9px]">▼</span>
                </div>
              </div>
            )}

            {onOpenReportHazard && (
              <button
                onClick={onOpenReportHazard}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
                title="Submit field observation / hazard telemetry"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Report Hazard</span>
              </button>
            )}

            {onOpenQuickEvac && (
              <button
                onClick={onOpenQuickEvac}
                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm shrink-0"
                title="Issue CAP protocol emergency broadcast"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>CAP Dispatch</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
