import React, { useState, useEffect } from 'react';
import { toast } from '../lib/toast';
import { http, errMsg, useAuth, useIncidentId, canOperate } from '../lib/api';
import { useIncident, useSimFrames } from '../lib/hooks';
import DigitalTwin3D from '../components/DigitalTwin3D';
import AgentGraph from '../components/AgentGraph';
import AgentOperationsMatrix from '../components/AgentOperationsMatrix';
import TraceFeed from '../components/TraceFeed';
import PlanPanel from '../components/PlanPanel';
import AssumptionLedger from '../components/AssumptionLedger';
import SimTimeline, { useFramePlayer } from '../components/SimTimeline';
import AskPanel from '../components/AskPanel';
import PresenterMode from '../components/PresenterMode';
import RedTeamPanel from '../components/RedTeamPanel';
import { RiskBadge, SimBadge } from '../components/RiskBadge';
import { 
  Globe2, Loader2, AlertTriangle, MapPin, Rocket, WifiOff, 
  Activity, ShieldAlert, CheckCircle2, Sliders, Shield
} from 'lucide-react';

export function IncidentLauncher({ compact = false }) {
  const { user } = useAuth();
  const { setIncidentId } = useIncidentId();
  const [aois, setAois] = useState([]);
  const [aoi, setAoi] = useState('gangtok');
  const [sc, setSc] = useState('heavy_24h');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    http.get('/aois')
      .then(r => setAois(r.data))
      .catch(() => {
        // Fallback standard NER AOIs
        setAois([
          { id: 'gangtok', name: 'Gangtok – NH10 Corridor', state: 'Sikkim' },
          { id: 'shillong', name: 'Shillong – Mawlai Bypass', state: 'Meghalaya' },
          { id: 'aizawl', name: 'Aizawl – Hunthar Veng', state: 'Mizoram' },
          { id: 'tupul', name: 'Tupul – NF Railway Camp', state: 'Manipur' }
        ]);
      });
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const r = await http.post('/incidents', { aoi, scenario: sc });
      setIncidentId(r.data.id);
      toast.success('Incident opened — 14 agents dispatched');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const selClass = 'bg-[#06150C] border border-[#249344]/50 text-xs px-2.5 py-1.5 rounded text-white outline-none';

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="incident-launcher">
      <select
        data-testid="aoi-select"
        className={selClass}
        value={aoi}
        onChange={e => setAoi(e.target.value)}
        aria-label="Area of interest"
      >
        {aois.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}, {a.state}
          </option>
        ))}
      </select>

      <select
        data-testid="scenario-select"
        className={selClass}
        value={sc}
        onChange={e => setSc(e.target.value)}
        aria-label="Scenario"
      >
        <option value="heavy_24h">24 h heavy rain (monsoon forcing)</option>
        <option value="burst_3h_saturated">3 h burst, saturated</option>
        <option value="escalation">Extreme escalation (+65mm surge)</option>
        <option value="dry_baseline">Dry baseline</option>
      </select>

      <button
        data-testid="start-incident-btn"
        disabled={busy}
        onClick={start}
        className="btn-lime px-3.5 py-1.5 rounded text-xs flex items-center gap-1.5 font-bold tracking-wider uppercase"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
        <span>{compact ? 'Start' : 'Start incident'}</span>
      </button>
    </div>
  );
}

function RecentIncidents() {
  const { setIncidentId } = useIncidentId();
  const [list, setList] = useState([]);

  useEffect(() => {
    http.get('/incidents')
      .then(r => setList((r.data || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  if (!list.length) return null;

  return (
    <div className="mt-8 flex flex-wrap gap-2.5 justify-center" data-testid="recent-incidents">
      {list.map(i => (
        <button
          key={i.id}
          data-testid={`resume-incident-${i.id}`}
          onClick={() => setIncidentId(i.id)}
          className="btn-ghost px-3.5 py-2 rounded text-xs font-mono"
        >
          Resume {i.aoi_name || i.aoi} · V{i.current_version || 1}
        </button>
      ))}
    </div>
  );
}

function LeftRail({ incident }) {
  const susc = Object.fromEntries(
    (incident?.risk?.village_susceptibility || []).map(v => [v.id, v])
  );
  const villages = [...(incident?.exposure?.villages || [])].sort((a, b) => {
    return (
      (b.exposed ? 1 : 0) - (a.exposed ? 1 : 0) ||
      (a.time_to_impact_h ?? 99) - (b.time_to_impact_h ?? 99)
    );
  });

  const roads = incident?.routes?.roads || [
    { id: 'NH10_SEC4', name: 'NH-10 Sector 4 (Singtam-Deorali)', status: 'OPEN' }
  ];

  const sc = {
    OPEN: '#22C55E',
    AT_RISK: '#FFA31A',
    BLOCKED: '#EF4444'
  };

  return (
    <div className="panel p-2.5 overflow-y-auto scroll-thin min-h-0 rounded-lg flex flex-col h-full" data-testid="left-rail">
      <div className="eyebrow mb-2">Prioritised locations</div>
      {!villages.length && (
        <div className="text-[11px] text-[#5E8B67] py-2">
          Awaiting Impact Agent evaluation…
        </div>
      )}

      <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto scroll-thin pr-1">
        {villages.map(v => (
          <div
            key={v.id}
            className={`px-2.5 py-2 rounded border transition-all ${
              v.exposed ? 'border-[#EF4444]/60 hatch-imminent bg-[#EF4444]/10' : 'card'
            }`}
            data-testid={`location-${v.id}`}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
              <MapPin size={11} color={v.exposed ? '#EF4444' : '#9FD8A8'} />
              <span>{v.name}</span>
            </div>
            <div className="font-data text-[10px] text-[#9FD8A8] mt-0.5">
              <span>{v.exposed ? `IN RUNOUT · T+${v.time_to_impact_h}h` : 'outside footprint'}</span>
              <span> · pop≈{v.pop?.toLocaleString() || '12,500'}</span>
            </div>
            {susc[v.id] && (
              <div
                className="font-data text-[10px] text-[#BDFF42] mt-0.5"
                data-testid={`village-susc-${v.id}`}
                title="XGBoost susceptibility (NASA GLC) · top TreeSHAP driver"
              >
                susc {(susc[v.id].probability * 100).toFixed(0)}% · {susc[v.id].top_driver || 'slope_deg'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lifeline Transport Corridor */}
      <div className="pt-2 border-t border-[#249344]/30 mt-2">
        <div className="eyebrow mb-1">Lifeline Transport Corridors</div>
        {roads.map(r => (
          <div key={r.id} className="text-[11px] flex items-center justify-between py-1">
            <span className="text-[#d6f5dc] truncate max-w-[150px]">{r.name}</span>
            <span
              className="font-data text-[9px] px-1.5 py-0.5 border rounded font-bold"
              style={{ color: sc[r.status] || '#22C55E', borderColor: sc[r.status] || '#22C55E' }}
            >
              {r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const TwinLegend = () => (
  <div className="glass px-3 py-1.5 text-[10px] font-data flex flex-wrap gap-3 rounded" data-testid="twin-legend">
    <span className="flex items-center gap-1 text-white">
      <i className="w-2.5 h-2.5 inline-block rounded-full" style={{ background: 'rgba(40,150,255,.9)' }} />
      <span>Saturation</span>
    </span>
    <span className="flex items-center gap-1 text-white">
      <i className="w-2.5 h-2.5 inline-block hatch-moderate rounded" style={{ background: 'rgba(234,179,8,.8)' }} />
      <span>Marginal FS 1–1.1</span>
    </span>
    <span className="flex items-center gap-1 text-white">
      <i className="w-2.5 h-2.5 inline-block hatch-imminent rounded" style={{ background: 'rgba(239,68,68,.9)' }} />
      <span>Unstable FS &lt; 1.0</span>
    </span>
    <span className="flex items-center gap-1 text-white">
      <i className="w-2.5 h-2.5 inline-block rounded" style={{ background: 'rgba(189,255,66,.8)' }} />
      <span>Runout Deposit</span>
    </span>
  </div>
);

export default function MissionControl() {
  const { incidentId, setIncidentId } = useIncidentId();
  const { incident, events, error } = useIncident(incidentId);
  const [rightTab, setRightTab] = useState('matrix'); // 'matrix', 'agents', 'ask'
  const [bottomTab, setBottomTab] = useState('plan'); // 'plan', 'assumptions', 'redteam'
  const [g3d, setG3d] = useState(false);
  const [mobileView, setMobileView] = useState('twin'); // 'twin', 'locations', 'agents', 'plan'

  // Auto-connect to latest incident if none active
  useEffect(() => {
    if (!incidentId) {
      http.get('/incidents')
        .then(r => {
          const list = r.data || [];
          if (list.length > 0 && list[0]?.id) {
            setIncidentId(list[0].id);
          }
        })
        .catch(() => {});
    }
  }, [incidentId, setIncidentId]);

  // Simulation frames
  const simFrames = useSimFrames(incident?.simulation?.run_id || incidentId);
  const timeline = incident?.simulation?.timeline || [];
  const player = useFramePlayer(timeline.length || 24);

  // Scenario perturbator
  const fireEvent = async (type, payload = {}) => {
    if (!incidentId) return;
    try {
      const res = await http.post(`/incidents/${incidentId}/events`, {
        type,
        payload,
        idempotency_key: `${type}-${Date.now()}`
      });
      toast.success(`${type.replace('_', ' ')} triggered → replan initiated`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-[#06150C] text-white overflow-hidden p-1 sm:p-2">
      {/* Top Operations Subheader */}
      <div className="panel px-2.5 sm:px-3 py-2 rounded-lg flex items-center justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1 min-w-0">
          <IncidentLauncher compact={true} />
          {incidentId && (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 border-l border-[#249344]/40 font-mono text-[11px] sm:text-xs">
              <span className="text-[#9FD8A8] hidden xs:inline">Incident:</span>
              <span className="font-bold text-white">{incidentId.slice(0, 8)}</span>
              <RiskBadge category={incident?.risk?.category || 'IMMINENT'} score={incident?.risk?.score} />
            </div>
          )}
        </div>

        {incident && (
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scroll-thin py-0.5 max-w-full">
            <PresenterMode />
            <div className="flex items-center gap-1 border-l border-[#249344]/40 pl-1.5 sm:pl-2 shrink-0">
              <button
                onClick={() => fireEvent('RAIN_ESCALATION', { delta: 0.6 })}
                className="btn-ghost px-2 py-1 text-[10px] sm:text-[11px] rounded whitespace-nowrap"
                title="Simulate +65mm rainfall spike"
              >
                + Rain Surge
              </button>
              <button
                onClick={() => fireEvent('ROAD_BLOCKED', { road_id: 'NH10_SEC4' })}
                className="btn-ghost px-2 py-1 text-[10px] sm:text-[11px] rounded whitespace-nowrap"
                title="Trigger road severed at KM-18"
              >
                Block NH-10
              </button>
              <button
                onClick={() => fireEvent('SENSOR_ANOMALY', { sensor_id: 'PZ-04' })}
                className="btn-ghost px-2 py-1 text-[10px] sm:text-[11px] rounded whitespace-nowrap"
                title="Inject pore-pressure sensor glitch"
              >
                Sensor Fault
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Central View */}
      {!incident ? (
        /* Empty State Matching Image 5 */
        <div className="flex-1 grid place-items-center text-center p-4 sm:p-8 panel rounded-lg">
          <div>
            <div className="font-display text-2xl sm:text-4xl text-white tracking-wide uppercase">
              No active incident
            </div>
            <p className="text-xs sm:text-sm text-[#9FD8A8] mt-2 sm:mt-3 max-w-md mx-auto leading-relaxed">
              Choose an NER area and rainfall scenario above, then press <b className="text-[#BDFF42]">Start</b>. 
              14 agents will monitor, simulate, verify and draft a plan for your approval.
            </p>
            <RecentIncidents />
          </div>
        </div>
      ) : (
        /* Active Incident View */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Mobile View Selector (Visible only on < lg screens) */}
          <div className="flex lg:hidden gap-1 p-1 bg-[#0A2416] border border-[#249344]/40 rounded-lg mb-1.5 shrink-0">
            {[
              { id: 'twin', label: '3D Twin' },
              { id: 'locations', label: 'Settlements' },
              { id: 'agents', label: 'Agents (14)' },
              { id: 'plan', label: 'Response Plan' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMobileView(tab.id)}
                className={`flex-1 py-1.5 px-1 text-[11px] font-data rounded text-center whitespace-nowrap transition-colors ${
                  mobileView === tab.id
                    ? 'bg-[#BDFF42] text-[#06150C] font-bold shadow-sm'
                    : 'text-[#9FD8A8] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* MOBILE CONTENT VIEW (< lg) */}
          <div className="flex-1 flex flex-col min-h-0 lg:hidden">
            {mobileView === 'twin' && (
              <div className="relative panel overflow-hidden flex-1 flex flex-col rounded-lg min-h-0">
                <DigitalTwin3D
                  aoi={incident.aoi || 'gangtok'}
                  simulationResult={incident.simulation}
                  weather={incident.observations?.weather}
                  onTimeChange={h => player?.setIdx(h)}
                />
                <button
                  onClick={() => setG3d(!g3d)}
                  className={`absolute top-2 right-2 z-10 px-2 py-0.5 text-[9px] font-data uppercase flex items-center gap-1 rounded glass ${
                    g3d ? 'bg-[#FFA31A] text-[#06150C]' : 'text-[#9FD8A8]'
                  }`}
                >
                  <Globe2 size={10} />
                  <span>{g3d ? 'Twin' : 'Google 3D'}</span>
                </button>
                <div className="absolute left-2 bottom-2 right-2 glass p-2 rounded-lg space-y-1">
                  <SimTimeline timeline={timeline} player={player} />
                  <div className="flex items-center justify-between flex-wrap gap-1 pt-1 border-t border-[#249344]/30 text-[9px]">
                    <TwinLegend />
                  </div>
                </div>
              </div>
            )}

            {mobileView === 'locations' && (
              <div className="flex-1 min-h-0 panel p-2.5 rounded-lg overflow-y-auto scroll-thin">
                <LeftRail incident={incident} />
              </div>
            )}

            {mobileView === 'agents' && (
              <div className="flex-1 min-h-0 panel p-2.5 rounded-lg flex flex-col">
                <div className="flex gap-1.5 mb-2 border-b border-[#249344]/30 pb-1.5 shrink-0 overflow-x-auto scroll-thin">
                  <button
                    onClick={() => setRightTab('matrix')}
                    className={`font-data text-xs px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                      rightTab === 'matrix' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8]'
                    }`}
                  >
                    Agent Matrix (14)
                  </button>
                  <button
                    onClick={() => setRightTab('agents')}
                    className={`font-data text-xs px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                      rightTab === 'agents' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8]'
                    }`}
                  >
                    DAG Graph
                  </button>
                  <button
                    onClick={() => setRightTab('ask')}
                    className={`font-data text-xs px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                      rightTab === 'ask' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8]'
                    }`}
                  >
                    Ask Assistant
                  </button>
                </div>
                {rightTab === 'matrix' ? (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <AgentOperationsMatrix incident={incident} events={events} onSelectAgent={() => setRightTab('agents')} />
                  </div>
                ) : rightTab === 'agents' ? (
                  <div className="flex-1 flex flex-col min-h-0 space-y-2 overflow-y-auto scroll-thin">
                    <div className="h-[260px] shrink-0 border border-[#249344]/30 rounded overflow-hidden">
                      <AgentGraph status={incident?.agent_status} events={events} incident={incident} height={260} />
                    </div>
                    <div className="eyebrow text-[9px]">Live activity trace</div>
                    <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
                      <TraceFeed events={events} compact={true} />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <AskPanel incidentId={incidentId} height="100%" />
                  </div>
                )}
              </div>
            )}

            {mobileView === 'plan' && (
              <div className="flex-1 min-h-0 panel p-2.5 rounded-lg flex flex-col overflow-y-auto scroll-thin">
                <div className="flex gap-2 mb-2 border-b border-[#249344]/30 pb-1 shrink-0">
                  <button
                    onClick={() => setBottomTab('plan')}
                    className={`font-data text-xs px-2.5 py-1 rounded transition-colors ${
                      bottomTab === 'plan' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8]'
                    }`}
                  >
                    Response Plan
                  </button>
                  <button
                    onClick={() => setBottomTab('assumptions')}
                    className={`font-data text-xs px-2.5 py-1 rounded transition-colors ${
                      bottomTab === 'assumptions' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8]'
                    }`}
                  >
                    Assumptions
                  </button>
                  <button
                    onClick={() => setBottomTab('redteam')}
                    className={`font-data text-xs px-2.5 py-1 rounded transition-colors ${
                      bottomTab === 'redteam' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8]'
                    }`}
                  >
                    Red-Team
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {bottomTab === 'plan' && <PlanPanel incident={incident} compact={true} />}
                  {bottomTab === 'assumptions' && <AssumptionLedger incident={incident} />}
                  {bottomTab === 'redteam' && <RedTeamPanel incidentId={incidentId} />}
                </div>
              </div>
            )}
          </div>

          {/* DESKTOP 3-COLUMN OPS ROOM (>= lg) */}
          <div
            className="hidden lg:grid flex-1 min-h-0 gap-2"
            style={{
              gridTemplateColumns: '250px minmax(0,1fr) 400px',
              gridTemplateRows: 'minmax(0,1fr) 280px'
            }}
          >
            {/* Left Rail */}
            <div className="row-span-2 min-h-0 flex flex-col">
              <LeftRail incident={incident} />
            </div>

            {/* Center 3D Digital Twin & Terrain */}
            <div className="relative panel overflow-hidden min-h-0 rounded-lg">
              <DigitalTwin3D
                aoi={incident.aoi || 'gangtok'}
                simulationResult={incident.simulation}
                weather={incident.observations?.weather}
                onTimeChange={h => player?.setIdx(h)}
              />

              {/* Google 3D Toggle */}
              <button
                onClick={() => setG3d(!g3d)}
                className={`absolute top-3 right-3 z-10 px-2.5 py-1 text-[10px] font-data uppercase flex items-center gap-1.5 rounded glass ${
                  g3d ? 'bg-[#FFA31A] text-[#06150C]' : 'text-[#9FD8A8]'
                }`}
              >
                <Globe2 size={12} />
                <span>{g3d ? 'Standard Twin' : 'Google 3D (optional)'}</span>
              </button>

              {/* Bottom Floating Bar */}
              <div className="absolute left-3 bottom-3 right-3 glass p-2 rounded-lg space-y-1.5">
                <SimTimeline timeline={timeline} player={player} />
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#249344]/30">
                  <TwinLegend />
                  <SimBadge text="Screening-level simulation — not a validated hazard assessment" />
                </div>
              </div>
            </div>

            {/* Right Column: Agent Matrix, Agent Graph & Ask Mission Control */}
            <div className="row-span-2 panel p-2.5 flex flex-col min-h-0 rounded-lg">
              {/* Tabs */}
              <div className="flex gap-1.5 mb-2 border-b border-[#249344]/30 pb-1.5 shrink-0 overflow-x-auto scroll-thin">
                <button
                  onClick={() => setRightTab('matrix')}
                  className={`font-data text-xs px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    rightTab === 'matrix' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8] hover:text-white'
                  }`}
                  title="Live activity matrix of all 14 role-bound agents"
                >
                  Agent Matrix (14)
                </button>
                <button
                  onClick={() => setRightTab('agents')}
                  className={`font-data text-xs px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    rightTab === 'agents' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8] hover:text-white'
                  }`}
                  title="Interactive 14-Agent DAG and real-time execution trace"
                >
                  DAG Graph
                </button>
                <button
                  onClick={() => setRightTab('ask')}
                  className={`font-data text-xs px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                    rightTab === 'ask' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8] hover:text-white'
                  }`}
                  title="Natural-language Q&A citing NDMA SOPs"
                >
                  Ask Assistant
                </button>
              </div>

              {rightTab === 'matrix' ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AgentOperationsMatrix 
                    incident={incident} 
                    events={events} 
                    onSelectAgent={() => setRightTab('agents')} 
                  />
                </div>
              ) : rightTab === 'agents' ? (
                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                  <div className="h-[340px] shrink-0 border border-[#249344]/30 rounded overflow-hidden">
                    <AgentGraph
                      status={incident?.agent_status}
                      events={events}
                      incident={incident}
                      height={340}
                    />
                  </div>
                  <div className="eyebrow text-[9px]">Live activity · tool calls · LLM trace</div>
                  <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
                    <TraceFeed events={events} compact={true} />
                  </div>
                </div>
              ) : (
                <AskPanel incidentId={incidentId} height="100%" />
              )}
            </div>

            {/* Bottom Row under Digital Twin: Response Plan & Assumptions */}
            <div className="panel p-2.5 flex flex-col min-h-0 rounded-lg">
              <div className="flex gap-2 mb-2 border-b border-[#249344]/30 pb-1">
                <button
                  onClick={() => setBottomTab('plan')}
                  className={`font-data text-xs px-2.5 py-1 rounded transition-colors ${
                    bottomTab === 'plan' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8] hover:text-white'
                  }`}
                >
                  Response plan
                </button>
                <button
                  onClick={() => setBottomTab('assumptions')}
                  className={`font-data text-xs px-2.5 py-1 rounded transition-colors ${
                    bottomTab === 'assumptions' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8] hover:text-white'
                  }`}
                >
                  Assumption ledger
                </button>
                <button
                  onClick={() => setBottomTab('redteam')}
                  className={`font-data text-xs px-2.5 py-1 rounded transition-colors ${
                    bottomTab === 'redteam' ? 'bg-[#BDFF42] text-[#06150C] font-bold' : 'text-[#9FD8A8] hover:text-white'
                  }`}
                >
                  Red-Team Defense
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scroll-thin pr-1">
                {bottomTab === 'plan' && <PlanPanel incident={incident} compact={true} />}
                {bottomTab === 'assumptions' && <AssumptionLedger incident={incident} />}
                {bottomTab === 'redteam' && <RedTeamPanel incidentId={incidentId} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

