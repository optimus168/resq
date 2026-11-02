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
import AgentDashboard from './pages/AgentDashboard';
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

  const basePath = pathname.split('?')[0];

  // Route routing logic
  if (basePath === '/' || basePath === '') {
    return <Landing />;
  }

  if (basePath === '/login') {
    return <Login onLoginSuccess={u => setUser(u)} />;
  }

  // Route mapping within the operations Shell
  let PageComponent = MissionControl;
  if (basePath === '/agent') PageComponent = AgentDashboard;
  else if (basePath === '/simulation-lab') PageComponent = SimulationLab;
  else if (basePath === '/agent-console') PageComponent = AgentConsole;
  else if (basePath === '/approvals') PageComponent = Approvals;
  else if (basePath === '/field-reports') PageComponent = FieldReports;
  else if (basePath === '/alerts') PageComponent = Alerts;
  else if (basePath === '/data-health') PageComponent = DataHealth;
  else if (basePath === '/audit') PageComponent = Audit;
  else if (basePath === '/mission-control') PageComponent = MissionControl;
  else if (basePath === '/validation') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <ValidationPage onBack={() => navigate('/mission-control')} />
      </Shell>
    );
  }
  else if (basePath === '/presenter') PageComponent = PresenterPage;
  else if (basePath === '/responsible-ai') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <ResponsibleAIPage onBack={() => navigate('/mission-control')} />
      </Shell>
    );
  }
  // GeoShield Routes
  else if (basePath === '/geoshield' || basePath === '/geoshield/dashboard' || basePath === '/geoshield-overview') PageComponent = GeoShieldDashboard;
  else if (basePath === '/risk-map' || basePath === '/map' || basePath === '/geoshield/map' || basePath === '/terraguard/gis' || basePath === '/terraguard/map') PageComponent = GeoShieldRiskMap;
  else if (basePath === '/stations' || basePath === '/geoshield/stations') PageComponent = GeoShieldStations;
  else if (basePath.startsWith('/station/') || basePath.startsWith('/geoshield/station/')) PageComponent = GeoShieldStationDetail;
  else if (basePath === '/simulator' || basePath === '/geoshield/simulator' || basePath === '/terraguard/simulator') PageComponent = SimulationLab;
  else if (basePath === '/satellite' || basePath === '/geoshield/satellite') PageComponent = GeoShieldSatellite;
  else if (basePath === '/flood' || basePath === '/geoshield/flood') PageComponent = GeoShieldFlood;
  else if (basePath === '/demo' || basePath === '/geoshield/demo') PageComponent = GeoShieldDemo;
  else if (basePath === '/geoshield/alerts' || basePath === '/terraguard/dispatch') PageComponent = Alerts;
  else if (basePath === '/geoshield/reports') PageComponent = GeoShieldReports;
  // BhuRaksha Geotech Routes
  else if (basePath === '/terraguard' || basePath === '/terraguard/home') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="home" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/dashboard') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="dashboard" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/earthquakes') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="earthquake-monitor" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/lstm') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="temporal-lstm-predictor" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/cv') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="crowdsource-cv-verification" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/ml') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="ml-models-pipeline" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/hills') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="hills-regions" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/sos') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="emergency-sos" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/alerts') {
    return (
      <Shell currentUser={user} onLogout={() => setUser(false)}>
        <TerraGuardPage initialModule="alerts" key={pathname} />
      </Shell>
    );
  }
  else if (basePath === '/terraguard/about') {
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
