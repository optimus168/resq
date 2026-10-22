import React, { useState, useEffect } from 'react';
import { RouterProvider, useLocation, useNavigate } from './router';
import { AuthProvider, IncidentProvider, useAuth } from './lib/api';
import { Toaster } from './lib/toast';
import Shell from './components/Shell';
import { getCurrentLanguage } from './geoshield/i18n/translations';

// RESQ Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import MissionControl from './pages/MissionControl';
import SimulationLab from './pages/SimulationLab';
import AgentConsole from './pages/AgentConsole';
import Approvals from './pages/Approvals';
import FieldReports from './pages/FieldReports';
import Alerts from './pages/Alerts';
import DataHealth from './pages/DataHealth';
import Audit from './pages/Audit';

// GeoShield Pages
import GeoShieldDashboard from './geoshield/pages/Dashboard';
import GeoShieldRiskMap from './geoshield/pages/RiskMap';
import GeoShieldStations from './geoshield/pages/Stations';
import GeoShieldStationDetail from './geoshield/pages/StationDetail';
import GeoShieldSimulator from './geoshield/pages/Simulator';
import GeoShieldSatellite from './geoshield/pages/SatelliteData';
import GeoShieldFlood from './geoshield/pages/FloodData';
import GeoShieldDemo from './geoshield/pages/DemoFlow';
import GeoShieldAlerts from './geoshield/pages/Alerts';
import GeoShieldReports from './geoshield/pages/Reports';

// TerraGuard Pages
import TerraGuardPage from './pages/TerraGuardPage';

// Verification, Governance & Presenter Pages
import ValidationPage from './components/ValidationPage';
import PresenterPage from './pages/PresenterPage';
import ResponsibleAIPage from './components/ResponsibleAIPage';

function MainRouter() {
  const { pathname } = useLocation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [lang, setLang] = useState(getCurrentLanguage());

  useEffect(() => {
    const onLangChange = (e) => setLang(e.detail || getCurrentLanguage());
    window.addEventListener('geoshield-languagechange', onLangChange);
    return () => window.removeEventListener('geoshield-languagechange', onLangChange);
  }, []);

  // Route routing logic
  if (pathname === '/' || pathname === '') {
    return <Landing />;
  }

  if (pathname === '/login') {
    return <Login onLoginSuccess={u => setUser(u)} />;
  }

  // Route mapping within the operations Shell
  let PageComponent = MissionControl;
  if (pathname === '/simulation-lab') PageComponent = SimulationLab;
  else if (pathname === '/agent-console') PageComponent = AgentConsole;
  else if (pathname === '/approvals') PageComponent = Approvals;
  else if (pathname === '/field-reports') PageComponent = FieldReports;
  else if (pathname === '/alerts') PageComponent = Alerts;
  else if (pathname === '/data-health') PageComponent = DataHealth;
  else if (pathname === '/audit') PageComponent = Audit;
  else if (pathname === '/mission-control') PageComponent = MissionControl;
  else if (pathname === '/validation') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <ValidationPage onBack={() => navigate('/mission-control')} />
      </Shell>
    );
  }
  else if (pathname === '/presenter') PageComponent = PresenterPage;
  else if (pathname === '/responsible-ai') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <ResponsibleAIPage onBack={() => navigate('/mission-control')} />
      </Shell>
    );
  }
  // GeoShield Routes
  else if (pathname === '/geoshield' || pathname === '/geoshield/dashboard' || pathname === '/geoshield-overview') PageComponent = GeoShieldDashboard;
  else if (pathname === '/risk-map' || pathname === '/map' || pathname === '/geoshield/map' || pathname === '/terraguard/gis' || pathname === '/terraguard/map') PageComponent = GeoShieldRiskMap;
  else if (pathname === '/stations' || pathname === '/geoshield/stations') PageComponent = GeoShieldStations;
  else if (pathname.startsWith('/station/') || pathname.startsWith('/geoshield/station/')) PageComponent = GeoShieldStationDetail;
  else if (pathname === '/simulator' || pathname === '/geoshield/simulator' || pathname === '/terraguard/simulator') PageComponent = SimulationLab;
  else if (pathname === '/satellite' || pathname === '/geoshield/satellite') PageComponent = GeoShieldSatellite;
  else if (pathname === '/flood' || pathname === '/geoshield/flood') PageComponent = GeoShieldFlood;
  else if (pathname === '/demo' || pathname === '/geoshield/demo') PageComponent = GeoShieldDemo;
  else if (pathname === '/geoshield/alerts' || pathname === '/terraguard/dispatch') PageComponent = Alerts;
  else if (pathname === '/geoshield/reports') PageComponent = GeoShieldReports;
  // BhuRaksha Geotech Routes
  else if (pathname === '/terraguard' || pathname === '/terraguard/home') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="home" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/dashboard') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="dashboard" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/earthquakes') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="earthquake-monitor" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/lstm') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="temporal-lstm-predictor" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/cv') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="crowdsource-cv-verification" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/ml') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="ml-models-pipeline" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/hills') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="hills-regions" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/sos') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="emergency-sos" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/alerts') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="alerts" key={pathname} />
      </Shell>
    );
  }
  else if (pathname === '/terraguard/about') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="about" key={pathname} />
      </Shell>
    );
  }

  return (
    <Shell currentUser={user} onLogout={() => setUser(false)}>
      <PageComponent key={lang} />
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <IncidentProvider>
        <RouterProvider>
          <Toaster />
          <MainRouter />
        </RouterProvider>
      </IncidentProvider>
    </AuthProvider>
  );
}
