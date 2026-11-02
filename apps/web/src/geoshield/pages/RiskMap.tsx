import { useEffect, useState, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import {
  getStations, getRiskHeatmap, getRoads, getVillages, predictAtLocation,
  Station, HeatmapPoint, Road, Village, PredictResult,
} from '../services/api';
import { t } from '../i18n/translations';
import {
  MapPin, Navigation, Building2,
  MousePointerClick, X, Loader2, AlertTriangle, AlertCircle, Layers, Globe,
} from 'lucide-react';

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  very_high: '#ea580c',
  critical: '#ef4444',
};

const ROAD_COLORS: Record<string, string> = {
  open: '#22c55e',
  partially_blocked: '#f59e0b',
  blocked: '#ef4444',
};

const VILLAGE_COLORS: Record<string, string> = {
  safe: '#22c55e',
  low_risk: '#22c55e',
  medium_risk: '#f59e0b',
  high_risk: '#ef4444',
};

const NER_CENTER: [number, number] = [25.5, 92.5];

const BASEMAP_TILES: Record<string, { url: string; attribution: string; maxZoom: number }> = {
  hybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: 'Google Earth Hybrid',
    maxZoom: 20,
  },
  satellite: {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: 'Google Earth Satellite',
    maxZoom: 20,
  },
  terrain: {
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: 'Google Earth Terrain',
    maxZoom: 20,
  },
  dark: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: 'OpenStreetMap',
    maxZoom: 19,
  },
};

const REGIONS: Record<string, { name: string; center: [number, number]; zoom: number }> = {
  all: { name: 'All NER & Himalayas', center: [25.5, 92.5], zoom: 7 },
  sikkim: { name: 'Sikkim (Gangtok / Teesta)', center: [27.33, 88.61], zoom: 11 },
  meghalaya: { name: 'Meghalaya (Shillong / Sohra)', center: [25.57, 91.89], zoom: 11 },
  mizoram: { name: 'Mizoram (Aizawl Ridge)', center: [23.73, 92.71], zoom: 12 },
  manipur: { name: 'Manipur (Tupul / Noney Rail)', center: [24.81, 93.65], zoom: 12 },
  assam: { name: 'Assam (Dima Hasao / Haflong)', center: [25.17, 93.02], zoom: 10 },
  arunachal: { name: 'Arunachal Pradesh (Kameng / Tawang)', center: [27.58, 91.86], zoom: 9 },
  uttarakhand: { name: 'Uttarakhand (Uttarkashi / Joshimath)', center: [30.55, 79.56], zoom: 10 },
  wayanad: { name: 'Kerala (Wayanad / Chooralmala)', center: [11.52, 76.15], zoom: 11 },
};

export default function RiskMap() {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [showRoads, setShowRoads] = useState(true);
  const [showVillages, setShowVillages] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showHistorical, setShowHistorical] = useState(true);
  const [showEarthquakes, setShowEarthquakes] = useState(true);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [basemap, setBasemap] = useState<'hybrid' | 'satellite' | 'terrain' | 'dark'>('hybrid');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Click-to-predict state
  const [predictMode, setPredictMode] = useState(false);
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictResult, setPredictResult] = useState<PredictResult | null>(null);
  const [predictError, setPredictError] = useState('');
  const [predictMarker, setPredictMarker] = useState<{ lat: number; lng: number } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const gsiLayerRef = useRef<L.LayerGroup | null>(null);
  const roadsLayerRef = useRef<L.LayerGroup | null>(null);
  const villagesLayerRef = useRef<L.LayerGroup | null>(null);
  const earthquakesLayerRef = useRef<L.LayerGroup | null>(null);
  const predictLayerRef = useRef<L.LayerGroup | null>(null);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setPredictMarker({ lat, lng });
    setPredictLoading(true);
    setPredictError('');
    setPredictResult(null);
    try {
      const res = await predictAtLocation({ latitude: lat, longitude: lng });
      setPredictResult(res.data);
    } catch (e: any) {
      setPredictError('Prediction failed. Please try again.');
    } finally {
      setPredictLoading(false);
    }
  }, []);

  const predictModeRef = useRef(predictMode);
  predictModeRef.current = predictMode;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stationsRes, heatRes, roadsRes, villagesRes, eqRes] = await Promise.all([
          getStations(),
          getRiskHeatmap(),
          getRoads(),
          getVillages(),
          fetch('/api/earthquakes?radius_km=1500&limit=50').then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] })),
        ]);
        setStations(stationsRes.data);
        setHeatmap(heatRes.data);
        setRoads(roadsRes.data);
        setVillages(villagesRes.data);
        setEarthquakes(eqRes?.events || []);
      } catch (e) {
        console.error('Map fetch error:', e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: NER_CENTER,
      zoom: 7,
      zoomControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);

    const config = BASEMAP_TILES[basemap] || BASEMAP_TILES.hybrid;
    const tile = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      className: basemap === 'dark' ? 'dark-tiles' : '',
    }).addTo(map);
    tileLayerRef.current = tile;

    const stationsGroup = L.layerGroup().addTo(map);
    const gsiGroup = L.layerGroup().addTo(map);
    const roadsGroup = L.layerGroup().addTo(map);
    villagesLayerRef.current = L.layerGroup().addTo(map);
    const eqGroup = L.layerGroup().addTo(map);
    const predictGroup = L.layerGroup().addTo(map);

    stationsLayerRef.current = stationsGroup;
    gsiLayerRef.current = gsiGroup;
    roadsLayerRef.current = roadsGroup;
    earthquakesLayerRef.current = eqGroup;
    predictLayerRef.current = predictGroup;
    mapInstanceRef.current = map;

    const onClick = (e: L.LeafletMouseEvent) => {
      if (predictModeRef.current) {
        handleMapClick(e.latlng.lat, e.latlng.lng);
      }
    };
    map.on('click', onClick);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [handleMapClick]);

  // Sync Basemap Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const config = BASEMAP_TILES[basemap] || BASEMAP_TILES.hybrid;
    const tile = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      className: basemap === 'dark' ? 'dark-tiles' : '',
    }).addTo(mapInstanceRef.current);
    tile.bringToBack();
    tileLayerRef.current = tile;
  }, [basemap]);

  const handleRegionSelect = (key: string) => {
    setSelectedRegion(key);
    const reg = REGIONS[key];
    if (reg && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(reg.center, reg.zoom, { duration: 1.2 });
    }
  };

  const getRiskRadius = (score: number) => Math.max(6, score / 5);

  // Sync Station Heatmap & GSI Landslide Markers
  useEffect(() => {
    const sGroup = stationsLayerRef.current;
    const gGroup = gsiLayerRef.current;
    if (sGroup) sGroup.clearLayers();
    if (gGroup) gGroup.clearLayers();

    heatmap.forEach((point: any) => {
      const isHist = point.is_historical;
      if (isHist && (!showHistorical || !gGroup)) return;
      if (!isHist && (!showStations || !sGroup)) return;

      const marker = L.circleMarker([point.lat, point.lng], {
        radius: isHist ? (point.deaths > 0 ? 7 : 5) : getRiskRadius(point.risk_score),
        fillColor: isHist ? (point.deaths > 0 ? '#ef4444' : '#f59e0b') : (RISK_COLORS[point.risk_level] || '#22c55e'),
        color: isHist ? (point.deaths > 0 ? '#b91c1c' : '#d97706') : (RISK_COLORS[point.risk_level] || '#22c55e'),
        weight: isHist ? 1.5 : 2,
        opacity: 0.9,
        fillOpacity: isHist ? 0.65 : 0.4,
      });

      const riskColor =
        point.risk_level === 'critical' ? '#ef4444' :
        point.risk_level === 'very_high' ? '#ea580c' :
        point.risk_level === 'high' ? '#f97316' :
        point.risk_level === 'moderate' ? '#f59e0b' : '#22c55e';

      const popupContent = isHist ? `
        <div style="font-size: 13px; font-family: Inter, sans-serif; line-height: 1.4;">
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #f59e0b; letter-spacing: 0.05em;">GSI Historical Landslide</div>
          <p style="font-weight: bold; margin: 2px 0;">${point.station_name}</p>
          <p style="color: #94a3b8; font-size: 11px;">${point.state} • ${point.district}</p>
          <div style="margin-top: 4px; padding: 4px 6px; background: rgba(245, 158, 11, 0.1); border-left: 2px solid #f59e0b; font-size: 11px;">
            <p style="color: ${point.deaths > 0 ? '#ef4444' : '#e2e8f0'}; font-weight: 600;">
              ${point.deaths > 0 ? `⚠️ ${point.deaths} Fatalities Reported` : '✓ Geotechnical Inventory Record'}
            </p>
            <p style="color: #94a3b8; font-size: 10px; margin-top: 2px;">Trigger: ${point.trigger || 'Monsoonal pore pressure'}</p>
            <p style="color: #94a3b8; font-size: 10px;">Material: ${point.material || 'Debris'} (${point.movement || 'Slide'})</p>
          </div>
          <div style="font-size: 9px; color: #64748b; margin-top: 4px;">Ref: ${point.station_id} • Source: GSI</div>
        </div>
      ` : `
        <div style="font-size: 13px; font-family: Inter, sans-serif; line-height: 1.4;">
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #22c55e; letter-spacing: 0.05em;">Live IoT Sensor Station</div>
          <p style="font-weight: bold; margin: 2px 0;">${point.station_name}</p>
          <p style="color: #94a3b8; font-size: 11px;">${point.state} • ${point.district}</p>
          <p style="font-weight: bold; margin-top: 4px; color: ${riskColor};">
            Live Risk: ${point.risk_score}/100 (${(point.risk_level || '').toUpperCase().replace('_', ' ')})
          </p>
          <a href="#/station/${point.station_id}" style="display: inline-block; margin-top: 6px; font-size: 11px; color: #38bdf8; text-decoration: underline;">
            View Station Telemetry →
          </a>
        </div>
      `;
      marker.bindPopup(popupContent);
      if (isHist && gGroup) marker.addTo(gGroup);
      else if (!isHist && sGroup) marker.addTo(sGroup);
    });
  }, [heatmap, showStations, showHistorical]);

  // Sync Roads Polylines
  useEffect(() => {
    const group = roadsLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showRoads) return;

    roads.forEach((road) => {
      const poly = L.polyline([[road.start_lat, road.start_lng], [road.end_lat, road.end_lng]], {
        color: ROAD_COLORS[road.status] || '#64748b',
        weight: road.road_type === 'national_highway' ? 3 : 2,
        dashArray: road.status === 'blocked' ? '5,10' : undefined,
      });

      const statusColor = road.status === 'blocked' ? '#ef4444' : road.status === 'partially_blocked' ? '#f59e0b' : '#22c55e';
      const popupContent = `
        <div style="font-size: 13px; font-family: Inter, sans-serif;">
          <p style="font-weight: bold;">${road.road_name}</p>
          <p style="color: #94a3b8; font-size: 11px;">${road.road_type.replace('_', ' ')}</p>
          <p style="font-weight: bold; margin-top: 4px; color: ${statusColor};">
            Status: ${road.status.replace('_', ' ').toUpperCase()}
          </p>
          ${road.blockage_reason ? `<p style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${road.blockage_reason}</p>` : ''}
        </div>
      `;
      poly.bindPopup(popupContent);
      poly.addTo(group);
    });
  }, [roads, showRoads]);

  // Sync Villages Markers
  useEffect(() => {
    const group = villagesLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showVillages) return;

    villages.forEach((village) => {
      const marker = L.circleMarker([village.latitude, village.longitude], {
        radius: Math.max(4, Math.min(10, village.population / 50000)),
        fillColor: VILLAGE_COLORS[village.risk_zone] || '#64748b',
        color: '#ffffff',
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0.6,
      });

      const zoneColor = village.risk_zone.includes('high') ? '#ef4444' : village.risk_zone.includes('medium') ? '#f59e0b' : '#22c55e';
      const popupContent = `
        <div style="font-size: 13px; font-family: Inter, sans-serif;">
          <p style="font-weight: bold;">${village.name}</p>
          <p style="color: #94a3b8; font-size: 11px;">${village.state} • ${village.district}</p>
          <p style="margin-top: 4px; font-size: 11px;">👥 Population: ${village.population.toLocaleString()}</p>
          <p style="font-weight: bold; color: ${zoneColor}; font-size: 11px;">
            Zone: ${village.risk_zone.replace('_', ' ').toUpperCase()}
          </p>
          <p style="font-size: 10px; color: #94a3b8; margin-top: 2px;">🏥 ${village.nearest_hospital_km}km | 🚔 ${village.nearest_police_km}km</p>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.addTo(group);
    });
  }, [villages, showVillages]);

  // Sync Prediction Marker
  useEffect(() => {
    const group = predictLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!predictMarker) return;

    const marker = L.circleMarker([predictMarker.lat, predictMarker.lng], {
      radius: 10,
      fillColor: '#a855f7',
      color: '#a855f7',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.6,
    });
    const popupContent = `
      <div style="font-size: 13px; font-family: Inter, sans-serif;">
        <p style="font-weight: bold; color: #c084fc;">🎯 AI Prediction Point</p>
        <p style="color: #94a3b8; font-size: 11px;">${predictMarker.lat.toFixed(4)}°N, ${predictMarker.lng.toFixed(4)}°E</p>
      </div>
    `;
    marker.bindPopup(popupContent).openPopup();
    marker.addTo(group);
  }, [predictMarker]);

  // Sync Live Earthquake Markers (NCS & USGS Seismicity)
  useEffect(() => {
    const group = earthquakesLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showEarthquakes) return;

    earthquakes.forEach((eq: any) => {
      const mag = Number(eq.magnitude) || 3.0;
      const size = Math.max(12, Math.min(26, 8 + mag * 3));
      const icon = L.divIcon({
        className: 'earthquake-pin',
        html: `<div style="width:${size}px;height:${size}px" class="rounded-full border-2 border-amber-200 bg-orange-600/90 shadow-[0_0_12px_rgba(249,115,22,0.85)] flex items-center justify-center text-[9px] font-black text-white">${mag.toFixed(1)}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([eq.latitude, eq.longitude], { icon });
      marker.bindPopup(`
        <div style="font-size: 13px; font-family: Inter, sans-serif; line-height: 1.4;">
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #f97316; letter-spacing: 0.05em;">NCS Seismic Telemetry</div>
          <p style="font-weight: bold; margin: 2px 0;">M${mag.toFixed(1)} Earthquake</p>
          <p style="color: #94a3b8; font-size: 11px;">${eq.location}</p>
          <div style="margin-top: 4px; padding: 4px 6px; background: rgba(249, 115, 22, 0.1); border-left: 2px solid #f97316; font-size: 11px;">
            <p style="color: #fed7aa; font-weight: 600;">Depth: ${eq.depth_km} km</p>
            <p style="color: #94a3b8; font-size: 10px;">Status: ${eq.status || 'Reviewed'}</p>
            <p style="color: #94a3b8; font-size: 10px;">Time: ${new Date(eq.event_time).toLocaleString()}</p>
          </div>
        </div>
      `);
      marker.addTo(group);
    });
  }, [earthquakes, showEarthquakes]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] min-h-[580px] overflow-hidden bg-[#06150C]">
      {/* Map Controls */}
      <div className="p-3 border-b border-dark-700 bg-dark-900/90 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              {t('map')}
            </h2>

            {/* Region Selector */}
            <div className="flex items-center gap-1.5 bg-dark-800/80 border border-dark-700 rounded-lg px-2.5 py-1 text-xs text-dark-200">
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={selectedRegion}
                onChange={(e) => handleRegionSelect(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
              >
                {Object.entries(REGIONS).map(([key, reg]) => (
                  <option key={key} value={key} className="bg-dark-900 text-white">
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Basemap Switcher */}
            <div className="flex items-center gap-1 bg-dark-800/80 border border-dark-700 rounded-lg p-0.5 text-xs">
              <span className="px-1.5 text-[10px] text-dark-400 font-medium flex items-center gap-1">
                <Layers className="w-3 h-3 text-dark-400" />
              </span>
              {(['hybrid', 'satellite', 'terrain', 'dark'] as const).map((bm) => (
                <button
                  key={bm}
                  onClick={() => setBasemap(bm)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-all ${
                    basemap === bm
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  {bm}
                </button>
              ))}
            </div>
          </div>

          {/* Layer toggles and predict mode */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setPredictMode(!predictMode); setPredictResult(null); setPredictMarker(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                predictMode
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-lg shadow-purple-600/20'
                  : 'bg-dark-800 text-dark-400 border border-dark-700 hover:text-white'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              {predictMode ? 'Predicting...' : (t('predictOnMap') || 'Click to Predict')}
            </button>

            <button
              onClick={() => setShowStations(!showStations)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showStations ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-dark-800 text-dark-400 border border-dark-700'
              }`}
            >
              <Navigation className="w-3 h-3 inline mr-1" />
              Sensors ({stations.length || heatmap.filter(p => !(p as any).is_historical).length || 20})
            </button>
            <button
              onClick={() => setShowHistorical(!showHistorical)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showHistorical ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30 shadow-md shadow-amber-600/10' : 'bg-dark-800 text-dark-400 border border-dark-700'
              }`}
            >
              ⛰️ GSI Landslides ({heatmap.filter(p => (p as any).is_historical).length || '350+'})
            </button>
            <button
              onClick={() => setShowRoads(!showRoads)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showRoads ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'bg-dark-800 text-dark-400 border border-dark-700'
              }`}
            >
              🛣️ Roads ({roads.length})
            </button>
            <button
              onClick={() => setShowVillages(!showVillages)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showVillages ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30' : 'bg-dark-800 text-dark-400 border border-dark-700'
              }`}
            >
              <Building2 className="w-3 h-3 inline mr-1" />
              Villages ({villages.length})
            </button>
            <button
              onClick={() => setShowEarthquakes(!showEarthquakes)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showEarthquakes ? 'bg-orange-600/20 text-orange-400 border border-orange-600/30 shadow-md shadow-orange-600/10' : 'bg-dark-800 text-dark-400 border border-dark-700'
              }`}
            >
              💥 Earthquakes ({earthquakes.length})
            </button>
          </div>
        </div>
        {predictMode && (
          <div className="mt-2 text-xs text-purple-300 bg-purple-600/10 border border-purple-600/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            Click anywhere on the map to get AI risk prediction with RF+GB ensemble model and real NER terrain data.
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative w-full overflow-hidden">
        <div
          ref={mapContainerRef}
          className="absolute inset-0 h-full w-full z-0"
          style={{ background: '#0f172a' }}
        />

        {/* Click-to-Predict Result Panel (Left side of map on desktop, bottom sheet on mobile) */}
        {predictMode && (predictLoading || predictResult || predictError) && (
          <div
            className="
              absolute left-2.5 right-2.5 bottom-2.5 max-h-[62%]
              md:top-3.5 md:left-3.5 md:right-auto md:bottom-auto md:w-[355px] lg:w-[380px] md:max-h-[calc(100%-28px)]
              z-[1000] bg-[#0B1528] border border-purple-500/50 rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.92)]
              flex flex-col overflow-hidden
            "
            style={{ backgroundColor: '#0B1528' }}
            data-testid="predict-result-panel"
          >
            {/* Sticky Card Header */}
            <div className="bg-purple-950/60 border-b border-purple-500/30 px-4 py-2.5 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>AI Risk Prediction</span>
                </h3>
                {predictMarker && (
                  <p className="text-[10px] font-mono text-purple-300/80 mt-0.5">
                    {predictMarker.lat.toFixed(4)}° N, {predictMarker.lng.toFixed(4)}° E
                  </p>
                )}
              </div>
              <button
                onClick={() => { setPredictResult(null); setPredictMarker(null); }}
                className="p-1 rounded-lg text-dark-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close prediction panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Card Body */}
            <div className="p-3.5 sm:p-4 overflow-y-auto scroll-thin space-y-3">
              {predictLoading && (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <span className="text-sm text-dark-200">Analyzing terrain & weather data...</span>
                </div>
              )}

              {predictError && (
                <div className="flex items-center gap-2 py-2 text-red-400 text-xs bg-red-950/40 border border-red-500/30 rounded-lg px-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{predictError}</span>
                </div>
              )}

              {predictResult && (
                <div className="space-y-3">
                  {/* Top 2x2 Summary KPI Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-dark-900/90 border border-dark-700/80 rounded-lg p-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-dark-400 block">Risk Score</span>
                      <span className={`text-lg font-extrabold font-mono leading-tight ${
                        predictResult.risk_assessment.risk_level === 'critical' ? 'text-red-400' :
                        predictResult.risk_assessment.risk_level === 'very_high' ? 'text-red-300' :
                        predictResult.risk_assessment.risk_level === 'high' ? 'text-orange-400' :
                        predictResult.risk_assessment.risk_level === 'moderate' ? 'text-amber-400' : 'text-green-400'
                      }`}>
                        {predictResult.risk_assessment.risk_score}/100
                      </span>
                    </div>

                    <div className="bg-dark-900/90 border border-dark-700/80 rounded-lg p-2.5 flex flex-col justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-dark-400 block">Risk Level</span>
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                          predictResult.risk_assessment.risk_level === 'critical' ? 'bg-red-600/25 text-red-400 border border-red-500/40' :
                          predictResult.risk_assessment.risk_level === 'very_high' ? 'bg-red-500/25 text-red-300 border border-red-400/40' :
                          predictResult.risk_assessment.risk_level === 'high' ? 'bg-orange-600/25 text-orange-400 border border-orange-500/40' :
                          predictResult.risk_assessment.risk_level === 'moderate' ? 'bg-amber-600/25 text-amber-400 border border-amber-500/40' :
                          'bg-green-600/25 text-green-400 border border-green-500/40'
                        }`}>
                          {(predictResult.risk_assessment.risk_level || '').toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-dark-900/90 border border-dark-700/80 rounded-lg p-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-dark-400 block">Probability</span>
                      <span className="text-sm font-bold font-mono text-white">
                        {((predictResult.risk_assessment.landslide_probability || 0) * 100).toFixed(1)}%
                      </span>
                    </div>

                    {predictResult.nearest_station && (
                      <div className="bg-dark-900/90 border border-dark-700/80 rounded-lg p-2.5 min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-dark-400 block">Nearest Station</span>
                        <span className="text-[11px] font-semibold text-white block truncate" title={predictResult.nearest_station.name || ''}>
                          {predictResult.nearest_station.name}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400">
                          {predictResult.nearest_station.distance_km} km away
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contributing Factors */}
                  {predictResult.risk_assessment.contributing_factors && predictResult.risk_assessment.contributing_factors.length > 0 && (
                    <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-2.5 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-300 block">Contributing Factors</span>
                      {predictResult.risk_assessment.contributing_factors.map((f: string, i: number) => (
                        <div key={i} className="text-xs text-amber-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Operational Recommendation */}
                  <div className="bg-dark-900/80 border border-dark-700/80 rounded-lg p-2.5">
                    <p className="text-xs text-dark-200 leading-relaxed">
                      {predictResult.risk_assessment.recommendation}
                    </p>
                  </div>

                  {/* Terrain Data from nearest-neighbor lookup */}
                  {(predictResult.risk_assessment as any).terrain_data && (
                    <div className="bg-dark-900/90 border border-dark-700/80 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">
                          TERRAIN DATA (Real NER)
                        </p>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          {(predictResult.risk_assessment as any).terrain_data.source}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div className="flex items-center justify-between bg-dark-800/70 px-2 py-1 rounded">
                          <span className="text-dark-400 text-[11px]">Slope</span>
                          <span className="font-mono font-semibold text-white">{(predictResult.risk_assessment as any).terrain_data.slope}°</span>
                        </div>
                        <div className="flex items-center justify-between bg-dark-800/70 px-2 py-1 rounded">
                          <span className="text-dark-400 text-[11px]">Elev</span>
                          <span className="font-mono font-semibold text-white">{(predictResult.risk_assessment as any).terrain_data.elevation}m</span>
                        </div>
                        <div className="flex items-center justify-between bg-dark-800/70 px-2 py-1 rounded">
                          <span className="text-dark-400 text-[11px]">NDVI</span>
                          <span className="font-mono font-semibold text-white">{(predictResult.risk_assessment as any).terrain_data.ndvi}</span>
                        </div>
                        <div className="flex items-center justify-between bg-dark-800/70 px-2 py-1 rounded">
                          <span className="text-dark-400 text-[11px]">Soil</span>
                          <span className="font-mono font-semibold text-white">{(predictResult.risk_assessment as any).terrain_data.soil_moisture}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Feature Importance (WHY THIS SCORE?) */}
                  {(predictResult.risk_assessment as any).feature_importance && (
                    <div className="bg-dark-900/90 border border-dark-700/80 rounded-lg p-2.5">
                      <p className="text-[10px] text-purple-300 font-bold tracking-wider uppercase mb-2">
                        WHY THIS SCORE?
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries((predictResult.risk_assessment as any).feature_importance).slice(0, 5).map(([feat, imp]: [string, any]) => (
                          <div key={feat} className="flex items-center gap-2">
                            <span className="text-[11px] text-dark-300 w-24 capitalize truncate">
                              {feat.replace(/_/g, ' ')}
                            </span>
                            <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-400 rounded-full"
                                style={{ width: `${Math.min(100, Number(imp) || 0)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-semibold text-purple-300 w-10 text-right">
                              {imp}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-0.5 text-center">
                    <p className="text-[10px] font-mono text-dark-400">
                      Model: {predictResult.model_info?.type || 'RF+GB VotingClassifier'} · Features: {predictResult.model_info?.features || 9}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend (Bottom-Right on Desktop, hidden on mobile while prediction sheet is open) */}
        <div
          className={`absolute bottom-4 right-4 z-[900] bg-[#0B1528]/95 border border-dark-700 rounded-xl p-3 shadow-2xl ${
            predictMode && (predictLoading || predictResult || predictError) ? 'hidden md:block' : 'block'
          }`}
          style={{ backgroundColor: 'rgba(11, 21, 40, 0.94)' }}
        >
          <p className="text-xs font-semibold text-white mb-2">Risk Level</p>
          <div className="space-y-1">
            {[
              { level: t('lowLevel'), color: RISK_COLORS.low },
              { level: t('moderateLevel'), color: RISK_COLORS.moderate },
              { level: t('highLevel'), color: RISK_COLORS.high },
              { level: 'Very High', color: RISK_COLORS.very_high },
              { level: t('criticalLevel'), color: RISK_COLORS.critical },
            ].map(({ level, color }) => (
              <div key={level} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-dark-300">{level}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-dark-700">
            <p className="text-xs font-semibold text-white mb-1">Roads</p>
            <div className="space-y-1">
              {[
                { label: 'Open', color: ROAD_COLORS.open },
                { label: 'Partially Blocked', color: ROAD_COLORS.partially_blocked },
                { label: 'Blocked', color: ROAD_COLORS.blocked },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-4 h-0.5" style={{ backgroundColor: color }} />
                  <span className="text-xs text-dark-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-dark-700">
            <p className="text-xs font-semibold text-white mb-1">Data Provenance</p>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span>Live IoT Sensors (20)</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>GSI Landslide Catalog (350+)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
