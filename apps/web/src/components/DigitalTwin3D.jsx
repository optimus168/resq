import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getMapLibreStyle } from '../lib/tileSources';
import { AOI_METADATA, TERRAIN_CONSTANTS } from '../lib/terrainConfig';
import { API_BASE } from '../lib/api';
import {
  Layers, Mountain, Sparkles, Play, Pause, RotateCcw,
  AlertTriangle, ShieldAlert, ChevronDown, ChevronUp
} from 'lucide-react';

/**
 * DigitalTwin3D — simulation-driven 3D terrain twin.
 *
 * Every number shown here comes from the backend `run` object (detection
 * summary) or from the twin bundle on disk. There are no client-side
 * interpolations presented as physics.
 *
 * Props:
 *   aoi          AOI id (gangtok | shillong | aizawl | tupul)
 *   run          detection summary from POST /simulations/detect
 *   hour         current timeline hour
 *   layer        hazard | depth | velocity | fs
 *   playing      playback state
 *   onHourChange (hour) => void
 *   onTogglePlay () => void
 *   compact      render a reduced legend for embedded uses
 */
export default function DigitalTwin3D({
  aoi = 'gangtok',
  run = null,
  simulationResult = null,
  hour: hourProp,
  layer = 'hazard',
  playing: playingProp = false,
  onHourChange,
  onTimeChange,
  onTogglePlay,
  compact = false,
}) {
  // Accept the legacy `simulationResult` prop so incident pages keep working.
  const activeRun = run || simulationResult || null;
  const controlledHour = hourProp != null;
  const [internalHour, setInternalHour] = useState(0);
  const [internalPlaying, setInternalPlaying] = useState(false);
  const hour = controlledHour ? hourProp : internalHour;
  const playing = playingProp != null && onTogglePlay ? playingProp : internalPlaying;

  const emitHour = useCallback(
    (h) => {
      if (!controlledHour) setInternalHour(h);
      onHourChange?.(h);
      onTimeChange?.(h);
    },
    [controlledHour, onHourChange, onTimeChange]
  );

  const togglePlayback = useCallback(() => {
    if (onTogglePlay) onTogglePlay();
    else setInternalPlaying(p => !p);
  }, [onTogglePlay]);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [infra, setInfra] = useState(null);
  const [buildings, setBuildings] = useState(null);
  const [showImagery, setShowImagery] = useState(true);
  const [showRelief, setShowRelief] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const [legendOpen, setLegendOpen] = useState(!compact);

  const aoiMeta = AOI_METADATA[aoi] || AOI_METADATA.gangtok;
  const bounds = manifest?.bounds || aoiMeta.bounds;

  // Internal playback when the parent does not control the timeline.
  useEffect(() => {
    if (controlledHour || !playing) return;
    const maxH = activeRun?.timeline?.length ? activeRun.timeline.length - 1 : 24;
    const t = setInterval(() => setInternalHour(h => (h >= maxH ? 0 : h + 1)), 520);
    return () => clearInterval(t);
  }, [controlledHour, playing, activeRun]);

  // ---------------------------------------------------------------------
  // Twin assets (manifest / infrastructure / buildings) from the API
  // ---------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    setManifest(null);
    setInfra(null);
    setBuildings(null);

    Promise.all([
      fetch(`${API_BASE}/twins/${aoi}/manifest`).then(r => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/twins/${aoi}/infrastructure`).then(r => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/twins/${aoi}/buildings`).then(r => (r.ok ? r.json() : null)),
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
  }, [aoi]);

  // ---------------------------------------------------------------------
  // Map bootstrap
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: getMapLibreStyle('esri'),
      center: aoiMeta.camera.center,
      zoom: aoiMeta.camera.zoom,
      pitch: aoiMeta.camera.pitch,
      bearing: aoiMeta.camera.bearing,
      maxPitch: 80,
      minZoom: 8,
      attributionControl: false,
      antialias: true,
      fadeDuration: 180,
    });
    mapRef.current = map;

    map.on('load', () => {
      try {
        map.setTerrain({ source: 'dem', exaggeration: TERRAIN_CONSTANTS.EXAGGERATION });
      } catch (err) {
        console.warn('terrain unavailable', err);
      }
      try {
        map.setSky({
          'sky-color': '#0b2a18',
          'horizon-color': '#163d24',
          'fog-color': '#04100a',
          'sky-horizon-blend': 0.6,
          'horizon-fog-blend': 0.55,
          'fog-ground-blend': 0.35,
        });
      } catch (err) {
        /* older maplibre */
      }
      map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
      setReady(true);
    });

    return () => {
      if (popupRef.current) popupRef.current.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to AOI when it changes
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.flyTo({
      center: aoiMeta.camera.center,
      zoom: aoiMeta.camera.zoom,
      pitch: is3D ? aoiMeta.camera.pitch : 0,
      bearing: is3D ? aoiMeta.camera.bearing : 0,
      duration: 1600,
      essential: true,
    });
  }, [aoi, ready, is3D, aoiMeta]);

  // ---------------------------------------------------------------------
  // Static twin layers: buildings + lifelines + facilities
  // ---------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !bounds) return;

    const add = () => {
      if (!map.isStyleLoaded()) return;

      if (buildings?.length) {
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
                storeys: b.storeys || 3,
                name: b.village_name || 'Building',
                typology: b.typology || '',
              },
            };
          });
        const data = { type: 'FeatureCollection', features };
        if (map.getSource('twin-buildings')) {
          map.getSource('twin-buildings').setData(data);
        } else {
          map.addSource('twin-buildings', {
            type: 'geojson',
            data,
          });
          map.addLayer({
            id: 'twin-buildings-3d',
            type: 'fill-extrusion',
            source: 'twin-buildings',
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'height_m'],
                6, '#cbd5e1', 14, '#94a3b8', 25, '#64748b',
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
        if (map.getSource('twin-lifelines')) {
          map.getSource('twin-lifelines').setData(roads);
        } else {
          map.addSource('twin-lifelines', { type: 'geojson', data: roads });
          map.addLayer({
            id: 'twin-lifelines-casing',
            type: 'line',
            source: 'twin-lifelines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#04100a', 'line-width': 5.5, 'line-opacity': 0.85 },
          });
          map.addLayer({
            id: 'twin-lifelines-core',
            type: 'line',
            source: 'twin-lifelines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': ['match', ['get', 'road_kind'], 'primary', '#ffb020', 'alternate', '#38bdf8', '#8ab4a0'],
              'line-width': ['match', ['get', 'road_kind'], 'primary', 3.2, 'alternate', 2.4, 1.6],
              'line-opacity': 0.95,
            },
          });
        }

        const points = {
          type: 'FeatureCollection',
          features: (infra.features || []).filter(
            f => f.geometry?.type === 'Point' && ['shelter', 'hospital', 'junction', 'settlement'].includes(f.properties?.kind)
          ),
        };
        if (map.getSource('twin-facilities')) {
          map.getSource('twin-facilities').setData(points);
        } else {
          map.addSource('twin-facilities', { type: 'geojson', data: points });
          map.addLayer({
            id: 'twin-facilities-halo',
          type: 'circle',
          source: 'twin-facilities',
          paint: {
            'circle-radius': ['match', ['get', 'kind'], 'hospital', 9, 'shelter', 8, 6],
            'circle-color': ['match', ['get', 'kind'], 'hospital', '#38bdf8', 'shelter', '#BDFF42', '#e2e8f0'],
            'circle-opacity': 0.22,
          },
        });
        map.addLayer({
          id: 'twin-facilities-core',
          type: 'circle',
          source: 'twin-facilities',
          paint: {
            'circle-radius': ['match', ['get', 'kind'], 'hospital', 4.2, 'shelter', 3.6, 2.6],
            'circle-color': ['match', ['get', 'kind'], 'hospital', '#38bdf8', 'shelter', '#BDFF42', '#e2e8f0'],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#04100a',
          },
        });
        map.addLayer({
          id: 'twin-facilities-labels',
          type: 'symbol',
          source: 'twin-facilities',
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
        map.on('click', 'twin-facilities-halo', e => {
          const f = e.features?.[0];
          if (!f) return;
          const { name, kind, capacity, beds } = f.properties;
          const detail =
            kind === 'hospital'
              ? `${beds ? beds + ' beds' : 'referral facility'}`
              : kind === 'shelter'
                ? `${capacity || '—'} capacity`
                : '';
          popupRef.current?.remove();
          popupRef.current = new Popup({ closeButton: false, offset: 10 })
            .setLngLat(f.geometry.coordinates)
            .setHTML(
              `<div style="font-family:monospace;font-size:11px;color:#e6f2e6;background:#04100a;padding:6px 8px;border:1px solid #249344">
                 <b>${name}</b><br/><span style="color:#9FD8A8">${kind}${detail ? ' · ' + detail : ''}</span>
               </div>`
            )
            .addTo(map);
        });
        map.on('mouseenter', 'twin-facilities-halo', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'twin-facilities-halo', () => {
          map.getCanvas().style.cursor = '';
        });
      }
    }
  };

    if (map.isStyleLoaded()) add();
    else map.once('idle', add);
  }, [ready, buildings, infra, bounds]);

  // ---------------------------------------------------------------------
  // Simulation raster overlay (server-rendered PNG)
  // ---------------------------------------------------------------------
  const layerUrl = useMemo(() => {
    // Only detection-pipeline runs have server-rendered overlay layers.
    if (!activeRun?.run_id || activeRun.run_kind !== 'detection') return null;
    return `${API_BASE}/simulations/${activeRun.run_id}/layer/${layer}/${hour}.png`;
  }, [activeRun?.run_id, activeRun?.run_kind, layer, hour]);

  const overlayCoords = useMemo(() => {
    if (!bounds) return null;
    return [
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south],
    ];
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;

      if (!layerUrl || !overlayCoords) {
        if (map.getLayer('sim-overlay')) map.removeLayer('sim-overlay');
        if (map.getSource('sim-overlay')) map.removeSource('sim-overlay');
        return;
      }

      const visible = showOverlay ? 'visible' : 'none';
      if (map.getSource('sim-overlay')) {
        map.getSource('sim-overlay').updateImage({ url: layerUrl, coordinates: overlayCoords });
        if (map.getLayer('sim-overlay')) {
          map.setLayoutProperty('sim-overlay', 'visibility', visible);
        }
      } else {
        map.addSource('sim-overlay', {
          type: 'image',
          url: layerUrl,
          coordinates: overlayCoords,
        });
        map.addLayer(
          {
            id: 'sim-overlay',
            type: 'raster',
            source: 'sim-overlay',
            paint: { 'raster-opacity': 0.92, 'raster-fade-duration': 120, 'raster-resampling': 'linear' },
          },
          map.getLayer('twin-lifelines-casing') ? 'twin-lifelines-casing' : undefined
        );
        map.setLayoutProperty('sim-overlay', 'visibility', visible);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, layerUrl, overlayCoords, showOverlay]);

  // Preload next frames so scrubbing feels instant
  useEffect(() => {
    if (!layerUrl) return;
    const maxH = activeRun?.timeline?.length ? activeRun.timeline.length - 1 : 24;
    [hour + 1, hour + 2, hour + 3]
      .filter(h => h <= maxH)
      .forEach(h => {
        const img = new Image();
        img.src = `${API_BASE}/simulations/${activeRun.run_id}/layer/${layer}/${h}.png`;
      });
  }, [layerUrl, activeRun?.run_id, activeRun?.timeline, hour, layer]);

  // ---------------------------------------------------------------------
  // Detections layer
  // ---------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      const features = (activeRun?.detections?.features || []).filter(
        f => (f.properties.detection_hour ?? 0) <= hour
      );

      if (!features.length) {
        if (map.getLayer('detections-halo')) map.setLayoutProperty('detections-halo', 'visibility', 'none');
        if (map.getLayer('detections-core')) map.setLayoutProperty('detections-core', 'visibility', 'none');
        if (map.getLayer('detections-label')) map.setLayoutProperty('detections-label', 'visibility', 'none');
        return;
      }

      const data = { type: 'FeatureCollection', features };
      if (map.getSource('detections')) {
        map.getSource('detections').setData(data);
      } else {
        map.addSource('detections', { type: 'geojson', data });
        map.addLayer({
          id: 'detections-halo',
          type: 'circle',
          source: 'detections',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'area_ha'],
              0.2, 12, 1, 20, 5, 32, 20, 46,
            ],
            'circle-color': '#ef4444',
            'circle-opacity': 0.16,
            'circle-blur': 0.35,
          },
        });
        map.addLayer({
          id: 'detections-core',
          type: 'circle',
          source: 'detections',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'area_ha'],
              0.2, 3.5, 1, 5.5, 5, 8, 20, 11,
            ],
            'circle-color': [
              'match', ['get', 'confidence_label'],
              'HIGH', '#ef4444',
              'MODERATE', '#f97316',
              '#facc15',
            ],
            'circle-stroke-width': 1.4,
            'circle-stroke-color': '#2b0808',
          },
        });
        map.addLayer({
          id: 'detections-label',
          type: 'symbol',
          source: 'detections',
          minzoom: 11.5,
          layout: {
            'text-field': ['get', 'id'],
            'text-size': 9.5,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-font': ['Open Sans Regular'],
          },
          paint: {
            'text-color': '#ffd9d9',
            'text-halo-color': '#200404',
            'text-halo-width': 1.1,
          },
        });

        map.on('click', 'detections-halo', e => {
          const p = e.features?.[0]?.properties;
          if (!p) return;
          popupRef.current?.remove();
          const assets = (p.assets || [])
            .map(a => `<div>· ${a.kind}: ${a.name}${a.time_to_impact_h != null ? ' @ T+' + a.time_to_impact_h + 'h' : ''}</div>`)
            .join('');
          popupRef.current = new Popup({ closeButton: true, maxWidth: '280px' })
            .setLngLat(e.features[0].geometry.coordinates)
            .setHTML(
              `<div style="font-family:monospace;font-size:11px;color:#e6f2e6;background:#04100a;padding:8px;border:1px solid #7f1d1d">
                 <b style="color:#ff8b8b">${p.id}</b><br/>
                 <span style="color:#9FD8A8">
                   ${p.area_ha} ha · FS ${p.min_fs} · ${p.mean_slope_deg}°<br/>
                   runout ${p.runout_distance_m} m · ${p.max_speed_kmh} km/h<br/>
                   detected T+${p.detection_hour}h · confidence ${p.confidence}
                 </span>
                 ${assets ? `<div style="margin-top:4px">${assets}</div>` : ''}
               </div>`
            )
            .addTo(map);
        });
        map.on('mouseenter', 'detections-halo', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'detections-halo', () => {
          map.getCanvas().style.cursor = '';
        });
      }

      ['detections-halo', 'detections-core', 'detections-label'].forEach(id => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', showDetections ? 'visible' : 'none');
        }
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once('idle', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeRun, hour, showDetections]);

  // Layer toggles
  const toggleBasemap = () => {
    const next = !showImagery;
    setShowImagery(next);
    if (mapRef.current?.getLayer('sat')) {
      mapRef.current.setLayoutProperty('sat', 'visibility', next ? 'visible' : 'none');
    }
  };
  const toggleRelief = () => {
    const next = !showRelief;
    setShowRelief(next);
    if (mapRef.current?.getLayer('hs')) {
      mapRef.current.setLayoutProperty('hs', 'visibility', next ? 'visible' : 'none');
    }
  };
  const toggle3D = () => {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.easeTo({
      pitch: next ? aoiMeta.camera.pitch : 0,
      bearing: next ? aoiMeta.camera.bearing : 0,
      duration: 900,
    });
  };

  const timeline = activeRun?.timeline || [];
  const row = timeline[hour] || {};
  const maxHour = timeline.length ? timeline.length - 1 : 24;
  const detectionsNow = (activeRun?.detections?.features || []).filter(
    f => (f.properties.detection_hour ?? 0) <= hour
  );

  const levelColor =
    row.hazard_level === 'SEVERE'
      ? '#ef4444'
      : row.hazard_level === 'WARNING'
        ? '#f97316'
        : row.hazard_level === 'WATCH'
          ? '#eab308'
          : '#22c55e';

  return (
    <div className="relative w-full h-full min-h-[420px] bg-[#04100a] rounded-lg overflow-hidden border border-[#249344]/40 flex flex-col">
      <div ref={containerRef} className="absolute inset-0" data-testid="simulation-map" />

      {/* Top controls */}
      <div className="relative z-20 p-2 flex flex-wrap items-center gap-1.5 pointer-events-auto">
        <MapToggle active={showImagery} onClick={toggleBasemap} icon={<Layers size={11} />} label="IMAGERY" />
        <MapToggle active={showRelief} onClick={toggleRelief} icon={<Mountain size={11} />} label="RELIEF" />
        <MapToggle active={showOverlay} onClick={() => setShowOverlay(v => !v)} icon={<Sparkles size={11} />} label="MODEL" highlight />
        <MapToggle active={showDetections} onClick={() => setShowDetections(v => !v)} icon={<AlertTriangle size={11} />} label="DETECTIONS" />
        <MapToggle active={is3D} onClick={toggle3D} label="3D" />
      </div>

      {/* Honesty ribbon */}
      <div className="absolute top-2 right-11 z-20 pointer-events-none">
        <span className="text-[9px] font-mono px-2 py-1 rounded bg-[#04100a]/85 border border-[#BDFF42]/35 text-[#BDFF42]">
          SCREENING OUTPUT · NOT A VALIDATED WARNING
        </span>
      </div>

      <div className="flex-1" />

      {/* Bottom HUD */}
      <div className="relative z-20 m-2 p-2 bg-[#04100a]/92 border border-[#249344]/50 rounded backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={togglePlayback}
              className="p-1 rounded bg-[#0a2416] border border-[#249344] hover:border-[#BDFF42] text-[#BDFF42]"
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              onClick={() => emitHour(0)}
              className="p-1 rounded bg-[#0a2416] border border-[#249344]/50 hover:border-[#BDFF42] text-[#9FD8A8]"
              title="Reset"
            >
              <RotateCcw size={13} />
            </button>
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <span className="text-[11px] font-mono text-[#BDFF42] font-bold whitespace-nowrap">
                T+{hour}h
              </span>
              <input
                type="range"
                min={0}
                max={maxHour}
                value={hour}
                onChange={e => emitHour(Number(e.target.value))}
                className="w-full accent-[#BDFF42] h-1.5 bg-[#0a2416] rounded cursor-pointer"
                data-testid="sim-hour-slider"
              />
              <span className="text-[10px] font-mono text-[#5E8B67] whitespace-nowrap">T+{maxHour}h</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono">
            <Read label="rain" value={`${row.rain_mm ?? 0} mm/h`} />
            <Read label="cum" value={`${row.cum_rain_mm ?? 0} mm`} />
            <Read label="sat" value={`${(((row.mean_saturation ?? 0) * 100)).toFixed(0)}%`} accent="#38bdf8" />
            <Read label="failed" value={`${row.failed_cells ?? 0} cells`} accent="#f87171" />
            <Read label="runout" value={`${row.footprint_cells ?? 0} cells`} accent="#fb923c" />
            <span className="px-1.5 py-0.5 rounded border" style={{ borderColor: levelColor, color: levelColor }}>
              {row.hazard_level || 'IDLE'}
            </span>
          </div>
        </div>

        <div className="mt-1.5 pt-1.5 border-t border-[#249344]/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[9px] font-mono text-[#9FD8A8]">
            <LegendDot color="#0284c7" label="Saturated" />
            <LegendDot color="#eab308" label="FS 1.0–1.3" />
            <LegendDot color="#ef4444" label="FS < 1" />
            <LegendDot color="#f97316" label="Runout" />
            <LegendDot color="#facc15" label="Detection" />
            <span className="text-[#5E8B67]">· {detectionsNow.length} detections @ T+{hour}h</span>
          </div>
          <button
            onClick={() => setLegendOpen(v => !v)}
            className="text-[9px] font-mono text-[#5E8B67] hover:text-[#BDFF42] flex items-center gap-1"
          >
            <ShieldAlert size={10} /> provenance
            {legendOpen ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>
        </div>

        {legendOpen && (
          <div className="mt-1.5 text-[9px] font-mono text-[#5E8B67] leading-relaxed border-t border-[#249344]/25 pt-1.5">
            DEM {manifest?.data_provenance?.dem_source || 'Copernicus GLO-30 (AWS Terrarium)'} ·{' '}
            {manifest?.grid ? `${manifest.grid.cell_size_m} m grid` : 'twin grid'} ·{' '}
            imagery {manifest?.data_provenance?.satellite_imagery_date || 'cached'} ·{' '}
            hypothesis: {activeRun?.model || 'transient infiltration + infinite slope + Voellmy runout'}
            {activeRun?.config_hash ? ` · hash ${activeRun.config_hash}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function MapToggle({ active, onClick, icon, label, highlight }) {
  const base =
    'px-2 py-1 text-[10px] font-mono rounded-sm border backdrop-blur-md transition-colors flex items-center gap-1';
  if (active) {
    return (
      <button
        onClick={onClick}
        className={`${base} ${highlight ? 'bg-[#BDFF42] border-[#BDFF42] text-[#04100a]' : 'bg-[#0a2416]/90 border-[#BDFF42] text-[#BDFF42]'}`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`${base} bg-[#04100a]/80 border-[#249344]/30 text-[#5E8B67] hover:text-white`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Read({ label, value, accent }) {
  return (
    <span>
      <span className="text-[#5E8B67]">{label}: </span>
      <span style={{ color: accent || '#e6f2e6' }} className="font-semibold">{value}</span>
    </span>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
