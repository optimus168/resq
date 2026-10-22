import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getMapLibreStyle, TILE_SOURCES } from '../lib/tileSources';
import { TERRAIN_CONSTANTS, AOI_METADATA } from '../lib/terrainConfig';
import { API_BASE } from '../lib/api';
import {
  Layers, Mountain, Sparkles,
  AlertTriangle, CloudRain, Gauge, ChevronDown, ChevronUp
} from 'lucide-react';

/**
 * HeroMapLibre — hero-size 3D terrain twin for the landing page.
 *
 * All telemetry comes from a live backend detection run (`run`) at the selected
 * hour; nothing is interpolated or invented client-side. Hazard colouring is a
 * server-rendered RGBA layer draped over real Copernicus DEM tiles.
 */
export default function HeroMapLibre({
  activeLocation,
  run = null,
  hour = 12,
  onHourChange,
  playing = false,
  onTogglePlay,
  onPlayToggle,
  tileSource = 'esri',
}) {
  const handleTogglePlay = onTogglePlay || onPlayToggle;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [infra, setInfra] = useState(null);
  const [buildings, setBuildings] = useState(null);
  const [showImagery, setShowImagery] = useState(true);
  const [showHillshade, setShowHillshade] = useState(true);
  const [showModel, setShowModel] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);

  const aoiKey = activeLocation?.id || 'gangtok';
  const aoiMeta = AOI_METADATA[aoiKey] || AOI_METADATA.gangtok;
  const bounds = manifest?.bounds || aoiMeta.bounds;

  // Twin assets via API (works for all six AOIs, unlike the old static paths).
  useEffect(() => {
    let alive = true;
    setManifest(null);
    setInfra(null);
    setBuildings(null);
    Promise.all([
      fetch(`${API_BASE}/twins/${aoiKey}/manifest`).then(r => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/twins/${aoiKey}/infrastructure`).then(r => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/twins/${aoiKey}/buildings`).then(r => (r.ok ? r.json() : null)),
    ])
      .then(([m, i, b]) => {
        if (!alive) return;
        setManifest(m);
        setInfra(i);
        setBuildings(b);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [aoiKey]);

  // Map bootstrap
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: getMapLibreStyle(tileSource),
      center: aoiMeta.camera.center,
      zoom: aoiMeta.camera.zoom,
      pitch: aoiMeta.camera.pitch,
      bearing: aoiMeta.camera.bearing,
      maxPitch: 82,
      minZoom: 7,
      attributionControl: false,
      antialias: true,
      fadeDuration: 150,
      interactive: true,
    });
    mapRef.current = map;

    map.on('load', () => {
      try {
        map.setTerrain({ source: 'dem', exaggeration: TERRAIN_CONSTANTS.EXAGGERATION });
      } catch (err) {
        console.warn('hero terrain unavailable', err);
      }
      try {
        map.setSky({
          'sky-color': '#0b2a18',
          'horizon-color': '#163d24',
          'fog-color': '#04100a',
          'sky-horizon-blend': 0.62,
          'horizon-fog-blend': 0.55,
          'fog-ground-blend': 0.32,
        });
      } catch (err) {
        /* older maplibre */
      }
      map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right');
      setReady(true);
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to the active AOI
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.flyTo({
      center: aoiMeta.camera.center,
      zoom: aoiMeta.camera.zoom,
      pitch: is3D ? aoiMeta.camera.pitch : 0,
      bearing: is3D ? aoiMeta.camera.bearing : 0,
      duration: 2400,
      curve: 1.25,
      essential: true,
    });
  }, [aoiKey, ready, is3D, aoiMeta]);

  // Static twin geometry: buildings, lifelines, facilities
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;

      if (buildings) {
        const features = buildings
          .filter(b => Array.isArray(b.center) && b.center.length === 2)
          .map((b, i) => {
            const [cx, cy] = b.center;
            const cosLat = Math.cos((cy * Math.PI) / 180);
            const dx = (b.footprint_m?.[0] || 14) / 2;
            const dy = (b.footprint_m?.[1] || 10) / 2;
            const dLon = dx / (111139 * (cosLat || 0.88));
            const dLat = dy / 111139;
            return {
              type: 'Feature',
              id: i,
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [cx - dLon, cy - dLat],
                  [cx + dLon, cy - dLat],
                  [cx + dLon, cy + dLat],
                  [cx - dLon, cy + dLat],
                  [cx - dLon, cy - dLat],
                ]],
              },
              properties: {
                height_m: b.height_m || (b.storeys ? b.storeys * 3.2 : 9),
                name: b.village_name || 'Building',
                storeys: b.storeys || 3,
              },
            };
          });
        const data = { type: 'FeatureCollection', features };
        if (map.getSource('hero-buildings')) {
          map.getSource('hero-buildings').setData(data);
        } else {
          map.addSource('hero-buildings', { type: 'geojson', data });
          map.addLayer({
            id: 'hero-buildings-3d',
            type: 'fill-extrusion',
            source: 'hero-buildings',
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'height_m'],
                6, '#cbd5e1',
                12, '#94a3b8',
                18, '#64748b',
                26, '#f87171',
              ],
              'fill-extrusion-height': ['get', 'height_m'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.88,
            },
          });
        }
      }

      if (infra) {
        const roads = {
          type: 'FeatureCollection',
          features: (infra.features || []).filter(
            f => f.geometry?.type === 'LineString' && f.properties?.kind === 'road'
          ),
        };
        if (map.getSource('hero-lifelines')) {
          map.getSource('hero-lifelines').setData(roads);
        } else {
          map.addSource('hero-lifelines', { type: 'geojson', data: roads });
          map.addLayer({
            id: 'hero-lifelines-casing',
            type: 'line',
            source: 'hero-lifelines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#04100a', 'line-width': 6, 'line-opacity': 0.9 },
          });
          map.addLayer({
            id: 'hero-lifelines-core',
            type: 'line',
            source: 'hero-lifelines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': ['match', ['get', 'road_kind'], 'primary', '#ffb020', 'alternate', '#38bdf8', '#8ab4a0'],
              'line-width': ['match', ['get', 'road_kind'], 'primary', 3.4, 'alternate', 2.6, 1.7],
            },
          });
        }

        const points = {
          type: 'FeatureCollection',
          features: (infra.features || []).filter(
            f => f.geometry?.type === 'Point' && ['hospital', 'shelter', 'junction'].includes(f.properties?.kind)
          ),
        };
        if (map.getSource('hero-facilities')) {
          map.getSource('hero-facilities').setData(points);
        } else {
          map.addSource('hero-facilities', { type: 'geojson', data: points });
          map.addLayer({
            id: 'hero-facilities-glow',
            type: 'circle',
            source: 'hero-facilities',
            paint: {
              'circle-radius': ['match', ['get', 'kind'], 'hospital', 11, 'shelter', 10, 7],
              'circle-color': ['match', ['get', 'kind'], 'hospital', '#38bdf8', 'shelter', '#BDFF42', '#e2e8f0'],
              'circle-opacity': 0.2,
            },
          });
          map.addLayer({
            id: 'hero-facilities-core',
            type: 'circle',
            source: 'hero-facilities',
            paint: {
              'circle-radius': ['match', ['get', 'kind'], 'hospital', 4.5, 'shelter', 4, 2.6],
              'circle-color': ['match', ['get', 'kind'], 'hospital', '#38bdf8', 'shelter', '#BDFF42', '#e2e8f0'],
              'circle-stroke-width': 1,
              'circle-stroke-color': '#04100a',
            },
          });
          map.addLayer({
            id: 'hero-facilities-labels',
            type: 'symbol',
            source: 'hero-facilities',
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 11,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-ignore-placement': false,
            },
            paint: {
              'text-color': '#e6f2e6',
              'text-halo-color': '#04100a',
              'text-halo-width': 1.6,
            },
          });
          map.on('click', 'hero-facilities-glow', e => {
            const f = e.features?.[0];
            if (!f) return;
            const { name, kind, capacity, beds } = f.properties;
            popupRef.current?.remove();
            popupRef.current = new Popup({ closeButton: false, offset: 10 })
              .setLngLat(f.geometry.coordinates)
              .setHTML(
                `<div style="font-family:monospace;font-size:11px;color:#e6f2e6;background:#04100a;padding:6px 8px;border:1px solid #249344">
                  <b>${name}</b><br/><span style="color:#9FD8A8">${kind}${beds ? ' · ' + beds + ' beds' : capacity ? ' · ' + capacity + ' capacity' : ''}</span>
                </div>`
              )
              .addTo(map);
          });
          map.on('mouseenter', 'hero-facilities-glow', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'hero-facilities-glow', () => {
            map.getCanvas().style.cursor = '';
          });
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
  }, [ready, buildings, infra]);

  // Server-rendered hazard overlay
  const overlayCoords = useMemo(() => {
    if (!bounds) return null;
    return [
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south],
    ];
  }, [bounds]);

  const layerUrl = run?.run_id ? `${API_BASE}/simulations/${run.run_id}/layer/hazard/${hour}.png` : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      if (!layerUrl || !overlayCoords) {
        if (map.getLayer('hero-hazard')) map.removeLayer('hero-hazard');
        if (map.getSource('hero-hazard')) map.removeSource('hero-hazard');
        return;
      }
      const vis = showModel ? 'visible' : 'none';
      if (map.getSource('hero-hazard')) {
        map.getSource('hero-hazard').updateImage({ url: layerUrl, coordinates: overlayCoords });
        if (map.getLayer('hero-hazard')) map.setLayoutProperty('hero-hazard', 'visibility', vis);
      } else {
        map.addSource('hero-hazard', { type: 'image', url: layerUrl, coordinates: overlayCoords });
        map.addLayer(
          {
            id: 'hero-hazard',
            type: 'raster',
            source: 'hero-hazard',
            paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 100 },
          },
          map.getLayer('hero-lifelines-casing') ? 'hero-lifelines-casing' : undefined
        );
        map.setLayoutProperty('hero-hazard', 'visibility', vis);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, layerUrl, overlayCoords, showModel]);

  // Detection markers for the current hour
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      const features = (run?.detections?.features || []).filter(
        f => (f.properties.detection_hour ?? 0) <= hour
      );

      if (!features.length) {
        ['hero-det-halo', 'hero-det-core'].forEach(id => {
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });
        return;
      }

      const data = { type: 'FeatureCollection', features };
      if (map.getSource('hero-detections')) {
        map.getSource('hero-detections').setData(data);
      } else {
        map.addSource('hero-detections', { type: 'geojson', data });
        map.addLayer({
          id: 'hero-det-halo',
          type: 'circle',
          source: 'hero-detections',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'area_ha'], 0.2, 12, 2, 22, 20, 44],
            'circle-color': '#ef4444',
            'circle-opacity': 0.18,
            'circle-blur': 0.3,
          },
        });
        map.addLayer({
          id: 'hero-det-core',
          type: 'circle',
          source: 'hero-detections',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'area_ha'], 0.2, 3.5, 2, 6, 20, 11],
            'circle-color': [
              'match', ['get', 'confidence_label'],
              'HIGH', '#ef4444', 'MODERATE', '#f97316', '#facc15',
            ],
            'circle-stroke-width': 1.4,
            'circle-stroke-color': '#2b0808',
          },
        });
        map.on('click', 'hero-det-halo', e => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          popupRef.current?.remove();
          popupRef.current = new Popup({ closeButton: true, maxWidth: '260px' })
            .setLngLat(e.features[0].geometry.coordinates)
            .setHTML(
              `<div style="font-family:monospace;font-size:11px;color:#e6f2e6;background:#04100a;padding:8px;border:1px solid #7f1d1d">
                <b style="color:#ff8b8b">${p.id}</b><br/>
                <span style="color:#9FD8A8">${p.area_ha} ha · FS ${p.min_fs} · ${p.mean_slope_deg}°<br/>
                runout ${p.runout_distance_m} m · ${p.max_speed_kmh} km/h<br/>
                detected T+${p.detection_hour}h · confidence ${p.confidence}</span>
              </div>`
            )
            .addTo(map);
        });
      }

      ['hero-det-halo', 'hero-det-core'].forEach(id => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', showModel ? 'visible' : 'none');
        }
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, run, hour, showModel]);

  const row = run?.timeline?.[hour] || {};
  const maxHour = run?.timeline?.length ? run.timeline.length - 1 : 24;
  const activeSourceMeta = TILE_SOURCES[tileSource] || TILE_SOURCES.esri;
  const detectionsNow = (run?.detections?.features || []).filter(
    f => (f.properties.detection_hour ?? 0) <= hour
  );
  const levelColor =
    row.hazard_level === 'SEVERE' ? '#ef4444'
      : row.hazard_level === 'WARNING' ? '#f97316'
        : row.hazard_level === 'WATCH' ? '#eab308' : '#22c55e';

  return (
    <div className="absolute inset-0 overflow-hidden select-none">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" data-testid="hero-map" />

      {/* Readability scrims */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#04100a]/92 via-[#04100a]/40 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04100a]/95 via-transparent to-[#04100a]/35 pointer-events-none" />

      {/* Top controls */}
      <div className="absolute top-3 sm:top-5 right-2 sm:right-16 z-30 flex items-center gap-1.5">
        <HeroToggle on={showImagery} onClick={() => {
          const next = !showImagery;
          setShowImagery(next);
          if (mapRef.current?.getLayer('sat')) {
            mapRef.current.setLayoutProperty('sat', 'visibility', next ? 'visible' : 'none');
          }
        }} icon={<Layers size={13} />} label="IMAGERY" />
        <HeroToggle on={showHillshade} onClick={() => {
          const next = !showHillshade;
          setShowHillshade(next);
          if (mapRef.current?.getLayer('hs')) {
            mapRef.current.setLayoutProperty('hs', 'visibility', next ? 'visible' : 'none');
          }
        }} icon={<Mountain size={13} />} label="RELIEF" />
        <HeroToggle on={showModel} onClick={() => setShowModel(v => !v)} icon={<Sparkles size={13} />} label="MODEL" highlight />
        <button
          onClick={() => {
            const next = !is3D;
            setIs3D(next);
            mapRef.current?.easeTo({
              pitch: next ? aoiMeta.camera.pitch : 0,
              bearing: next ? aoiMeta.camera.bearing : 0,
              duration: 1100,
            });
          }}
          className={`px-2.5 py-1.5 text-xs font-mono rounded-sm border backdrop-blur-md transition-colors ${is3D
            ? 'bg-[#0a2416]/90 border-[#FFA31A] text-[#FFA31A] font-bold'
            : 'bg-[#04100a]/80 border-[#249344]/30 text-[#5E8B67] hover:text-white'}`}
        >
          {is3D ? '3D' : '2D'}
        </button>
      </div>

      {/* Observed-sample provenance chip */}
      {run?.observed_sample && (
        <div className="absolute top-3 sm:top-5 left-4 sm:left-8 z-30 max-w-[260px] text-[10px] font-mono px-2 py-1.5 rounded bg-[#04100a]/85 border border-[#BDFF42]/40 text-[#BDFF42] leading-tight">
          <div className="font-bold">OBSERVED RAINFALL SAMPLE</div>
          <div className="text-[#9FD8A8] normal-case">{run.observed_sample.label}</div>
          <div className="text-[#5E8B67]">{run.observed_sample.total_mm} mm / 48 h · ERA5 shape, documented magnitude</div>
        </div>
      )}

      {/* Bottom telemetry + timeline */}
      <div className="absolute bottom-16 sm:bottom-20 left-4 right-4 sm:left-8 sm:right-8 z-30">
        <div className="bg-[#04100a]/92 border border-[#249344]/50 backdrop-blur-md p-2.5 sm:p-3 rounded-sm shadow-2xl">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#BDFF42] font-bold whitespace-nowrap">
                T+{hour}h / {maxHour}h
              </span>
              <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded bg-[#0a2416] border border-[#249344]/40 text-[#9FD8A8]">
                {hour === 0 ? 'ANTECEDENT DRY' : hour <= 12 ? 'STORM LOADING' : hour <= 24 ? 'CRITICAL FORCING' : 'RUNOUT RECEDING'}
              </span>
            </div>

            {/* Detailed Storm Hyetograph Plot */}
            <MiniHyetographPlot hyetograph={run?.hyetograph} currentHour={hour} />

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
              <Metric icon={<CloudRain size={11} />} label="rain" value={`${row.rain_mm ?? 0} mm/h`} />
              <Metric label="cum" value={`${row.cum_rain_mm ?? 0} mm`} />
              <Metric label="sat" value={`${(((row.mean_saturation ?? 0) * 100)).toFixed(0)}%`} color="#38bdf8" />
              <Metric icon={<AlertTriangle size={11} />} label="failed" value={`${row.failed_cells ?? 0}`} color="#f87171" />
              <Metric label="runout" value={`${row.footprint_cells ?? 0}`} color="#fb923c" />
              <Metric icon={<Gauge size={11} />} label="pop" value={(row.exposed_population_est ?? 0).toLocaleString()} color="#BDFF42" />
              <span className="px-1.5 py-0.5 rounded border text-[10px] font-bold" style={{ borderColor: levelColor, color: levelColor }}>
                {row.hazard_level || 'IDLE'}
              </span>
            </div>
          </div>

          <div className="mt-2 pt-1.5 border-t border-[#249344]/30 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <Swatch color="#0284c7" label="Saturated" />
              <Swatch color="#eab308" label="FS 1.0–1.3" />
              <Swatch color="#ef4444" label="FS < 1" />
              <Swatch color="#f97316" label="Runout" />
              <Swatch color="#facc15" label="Detection" />
              <span className="text-[#5E8B67]">{detectionsNow.length} detections @ T+{hour}h</span>
            </div>
            <button
              onClick={() => setLegendOpen(v => !v)}
              className="text-[10px] text-[#5E8B67] hover:text-[#BDFF42] flex items-center gap-1"
            >
              provenance {legendOpen ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
            </button>
          </div>

          {legendOpen && (
            <div className="mt-1.5 text-[9px] font-mono text-[#5E8B67] leading-relaxed border-t border-[#249344]/25 pt-1.5">
              {run ? (
                <>
                  {run.model} · grid {run.grid?.[0]}×{run.grid?.[1]} @ {run.cell_size_m} m · hash {run.config_hash}
                  <br />
                  Rainfall {run.regional?.rainfall?.level} at {run.regional?.rainfall?.peak_ratio}× regional
                  intensity–duration threshold · mass balance error {run.mass_balance?.conservation_error_pct}%
                  <br />
                  Screening-level scenario model — not a validated hazard assessment or official warning.
                </>
              ) : (
                'Loading observed sample and running the detection pipeline…'
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-2 right-4 z-20 text-[10px] text-[#5E8B67] font-mono max-w-[60%] text-right">
        {activeSourceMeta.attribution}
      </div>
    </div>
  );
}

function HeroToggle({ on, onClick, icon, label, highlight }) {
  const base = 'px-2.5 py-1.5 text-xs font-mono rounded-sm border backdrop-blur-md transition-colors flex items-center gap-1.5';
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`${base} ${on
        ? highlight
          ? 'bg-[#BDFF42] border-[#BDFF42] text-[#04100a] font-bold'
          : 'bg-[#0a2416]/90 border-[#BDFF42] text-[#BDFF42] font-bold'
        : 'bg-[#04100a]/80 border-[#249344]/30 text-[#5E8B67] hover:text-white'}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Metric({ icon, label, value, color = '#e6f2e6' }) {
  return (
    <span className="flex items-center gap-1">
      {icon && <span className="text-[#5E8B67]">{icon}</span>}
      <span className="text-[#5E8B67]">{label}:</span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </span>
  );
}

function Swatch({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[#9FD8A8]">{label}</span>
    </span>
  );
}

function MiniHyetographPlot({ hyetograph = [], currentHour = 0 }) {
  if (!hyetograph || !hyetograph.length) return null;
  const maxRain = Math.max(...hyetograph, 15);
  const width = 130;
  const height = 24;
  const barWidth = width / hyetograph.length;
  return (
    <div className="hidden md:flex flex-col gap-0.5 border-l border-r border-[#249344]/30 px-3">
      <div className="flex justify-between items-center text-[8px] font-mono text-[#5E8B67] leading-none">
        <span>HYETOGRAPH</span>
        <span className="text-[#BDFF42] font-semibold">{Math.max(...hyetograph).toFixed(0)} mm/h peak</span>
      </div>
      <svg width={width} height={height} className="overflow-visible bg-[#06150C]/50 rounded-sm">
        {hyetograph.map((val, i) => {
          const barHeight = Math.max(1, (val / maxRain) * (height - 3));
          const isCurrent = i === currentHour;
          return (
            <rect
              key={i}
              x={i * barWidth}
              y={height - barHeight}
              width={Math.max(1.2, barWidth - 0.6)}
              height={barHeight}
              fill={isCurrent ? '#BDFF42' : val > 15 ? '#f97316' : '#38bdf8'}
              opacity={isCurrent ? 1 : 0.65}
            />
          );
        })}
      </svg>
    </div>
  );
}
