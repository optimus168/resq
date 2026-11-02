import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getMapLibreStyle, TILE_SOURCES } from '../lib/tileSources';
import { TERRAIN_CONSTANTS, AOI_METADATA } from '../lib/terrainConfig';
import { API_BASE } from '../lib/api';
import {
  Layers, Mountain, Sparkles, Compass, MapPin,
  AlertTriangle, CloudRain, Gauge, ChevronDown, ChevronUp, Play, Pause
} from 'lucide-react';

/**
 * HeroMapLibre — Google-Earth-style 3D terrain twin for the landing page.
 *
 * Displays distinct 3D satellite locations (Gangtok, Aizawl Knife-Edge Ridge,
 * Wayanad Chooralmala–Meppadi) with real Copernicus DEM relief, high-resolution
 * satellite orthophotos, Google Earth landmark pins, and smooth continuous
 * 3D camera orbital movement.
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
  const userInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef(null);
  const flyTransitioningRef = useRef(false);
  const prevAoiRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [infra, setInfra] = useState(null);
  const [buildings, setBuildings] = useState(null);
  const [showImagery, setShowImagery] = useState(true);
  const [showHillshade, setShowHillshade] = useState(true);
  const [showModel, setShowModel] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);

  const aoiKey = activeLocation?.id || 'gangtok';
  const aoiMeta = AOI_METADATA[aoiKey] || AOI_METADATA.gangtok;
  const bounds = manifest?.bounds || aoiMeta.bounds;

  // Twin assets via API (works for all six AOIs).
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
    prevAoiRef.current = aoiKey;

    const pauseOrbitOnUserAction = () => {
      userInteractingRef.current = true;
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      interactionTimeoutRef.current = setTimeout(() => {
        userInteractingRef.current = false;
      }, 3800);
    };

    const canvasContainer = map.getCanvasContainer();
    canvasContainer.addEventListener('mousedown', pauseOrbitOnUserAction, { passive: true });
    canvasContainer.addEventListener('touchstart', pauseOrbitOnUserAction, { passive: true });
    canvasContainer.addEventListener('wheel', pauseOrbitOnUserAction, { passive: true });

    map.on('load', () => {
      try {
        map.setTerrain({ source: 'dem', exaggeration: TERRAIN_CONSTANTS.EXAGGERATION });
      } catch (err) {
        console.warn('hero terrain unavailable', err);
      }
      try {
        map.setSky({
          'sky-color': '#0b2a18',
          'horizon-color': '#1b4d2e',
          'fog-color': '#06150C',
          'sky-horizon-blend': 0.55,
          'horizon-fog-blend': 0.45,
          'fog-ground-blend': 0.22,
        });
      } catch (err) {
        /* older maplibre */
      }
      map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right');
      setReady(true);
    });

    return () => {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      canvasContainer.removeEventListener('mousedown', pauseOrbitOnUserAction);
      canvasContainer.removeEventListener('touchstart', pauseOrbitOnUserAction);
      canvasContainer.removeEventListener('wheel', pauseOrbitOnUserAction);
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crisp Google-Earth swoop to the selected AOI (Gangtok, Aizawl, Wayanad)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    popupRef.current?.remove();
    flyTransitioningRef.current = true;

    const isLocationSwitch = prevAoiRef.current !== aoiKey;
    prevAoiRef.current = aoiKey;

    if (isLocationSwitch) {
      // True Google Earth flight: swoop gracefully across Indian terrain into the new corridor
      map.flyTo({
        center: aoiMeta.camera.center,
        zoom: aoiMeta.camera.zoom,
        pitch: is3D ? aoiMeta.camera.pitch : 0,
        bearing: is3D ? aoiMeta.camera.bearing : 0,
        speed: 1.4,
        curve: 1.35,
        essential: true,
      });
    } else {
      map.easeTo({
        center: aoiMeta.camera.center,
        zoom: aoiMeta.camera.zoom,
        pitch: is3D ? aoiMeta.camera.pitch : 0,
        bearing: is3D ? aoiMeta.camera.bearing : 0,
        duration: 900,
        essential: true,
      });
    }

    const onFlyEnd = () => {
      flyTransitioningRef.current = false;
    };
    map.once('moveend', onFlyEnd);

    const timer = setTimeout(() => {
      flyTransitioningRef.current = false;
    }, isLocationSwitch ? 2200 : 950);

    return () => {
      clearTimeout(timer);
      map.off('moveend', onFlyEnd);
    };
  }, [aoiKey, ready, is3D, aoiMeta]);

  // Gentle, non-blocking 3D Google Earth camera orbital drift (never starves tile/image loading)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !autoOrbit) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const intervalId = setInterval(() => {
      if (
        mapRef.current &&
        !userInteractingRef.current &&
        !flyTransitioningRef.current &&
        !mapRef.current.isMoving() &&
        is3D
      ) {
        try {
          const nextBearing = (mapRef.current.getBearing() + 0.28) % 360;
          mapRef.current.setBearing(nextBearing);
        } catch (err) {
          /* ignore during style update */
        }
      }
    }, 140);

    return () => {
      clearInterval(intervalId);
    };
  }, [ready, autoOrbit, is3D, aoiKey]);

  // Bounds coordinates for draped AOI orthophoto and hazard overlay
  const overlayCoords = useMemo(() => {
    if (!bounds) return null;
    return [
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.east, bounds.south],
      [bounds.west, bounds.south],
    ];
  }, [bounds]);

  // Guaranteed high-resolution satellite orthophoto for each location (Gangtok, Aizawl, Wayanad)
  const orthophotoUrl = `${API_BASE}/twins/${aoiKey}/files/orthophoto.jpg`;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !overlayCoords) return;

    const applyOrtho = () => {
      try {
        const vis = showImagery ? 'visible' : 'none';
        if (map.getLayer('hero-orthophoto')) map.removeLayer('hero-orthophoto');
        if (map.getSource('hero-orthophoto')) map.removeSource('hero-orthophoto');

        map.addSource('hero-orthophoto', {
          type: 'image',
          url: orthophotoUrl,
          coordinates: overlayCoords,
        });
        const beforeLayer = map.getLayer('hs')
          ? 'hs'
          : map.getLayer('hero-hazard')
            ? 'hero-hazard'
            : undefined;
        map.addLayer(
          {
            id: 'hero-orthophoto',
            type: 'raster',
            source: 'hero-orthophoto',
            paint: {
              'raster-opacity': 0.96,
              'raster-contrast': 0.14,
              'raster-saturation': 0.1,
              'raster-fade-duration': 150,
            },
          },
          beforeLayer
        );
        map.setLayoutProperty('hero-orthophoto', 'visibility', vis);
      } catch (err) {
        map.once('idle', applyOrtho);
      }
    };

    applyOrtho();
  }, [ready, orthophotoUrl, overlayCoords, showImagery]);

  // Static twin geometry: buildings, lifelines, facilities, and Google Earth landmark pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const apply = () => {
      try {
        // 1. Google Earth Landmark Callout Pins for the active location
        const landmarkFeatures = (aoiMeta.landmarks || []).map((lm, idx) => ({
          type: 'Feature',
          id: idx,
          geometry: {
            type: 'Point',
            coordinates: lm.coordinates,
          },
          properties: {
            name: lm.name,
            tag: lm.tag || 'LANDMARK',
          },
        }));
        const landmarkGeoJSON = { type: 'FeatureCollection', features: landmarkFeatures };
        if (map.getSource('hero-landmarks')) {
          map.getSource('hero-landmarks').setData(landmarkGeoJSON);
        } else {
          map.addSource('hero-landmarks', { type: 'geojson', data: landmarkGeoJSON });
          map.addLayer({
            id: 'hero-landmarks-halo',
            type: 'circle',
            source: 'hero-landmarks',
            paint: {
              'circle-radius': 10,
              'circle-color': '#BDFF42',
              'circle-opacity': 0.25,
            },
          });
          map.addLayer({
            id: 'hero-landmarks-pin',
            type: 'circle',
            source: 'hero-landmarks',
            paint: {
              'circle-radius': 4.5,
              'circle-color': '#BDFF42',
              'circle-stroke-width': 1.8,
              'circle-stroke-color': '#04100a',
            },
          });
          map.addLayer({
            id: 'hero-landmarks-label',
            type: 'symbol',
            source: 'hero-landmarks',
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 12,
              'text-offset': [0, -1.1],
              'text-anchor': 'bottom',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#BDFF42',
              'text-halo-color': '#04100a',
              'text-halo-width': 2.0,
            },
          });
        }

        // 2. 3D Extruded Buildings
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

        // 3. Lifeline Roads & Emergency Facilities
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
                'circle-opacity': 0.22,
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
      } catch (err) {
        map.once('idle', apply);
      }
    };

    apply();
  }, [ready, buildings, infra, aoiMeta]);

  // Server-rendered hazard overlay (semi-transparent so satellite imagery stays crisp)
  const layerUrl =
    run?.run_id && !String(run.run_id).startsWith('preset-')
      ? `${API_BASE}/simulations/${run.run_id}/layer/hazard/${hour}.png`
      : null;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      try {
        if (!layerUrl || !overlayCoords) {
          if (map.getLayer('hero-hazard')) map.removeLayer('hero-hazard');
          if (map.getSource('hero-hazard')) map.removeSource('hero-hazard');
          return;
        }
        const vis = showModel ? 'visible' : 'none';
        if (map.getSource('hero-hazard')) {
          try {
            map.getSource('hero-hazard').updateImage({ url: layerUrl, coordinates: overlayCoords });
          } catch (e) {
            if (map.getLayer('hero-hazard')) map.removeLayer('hero-hazard');
            if (map.getSource('hero-hazard')) map.removeSource('hero-hazard');
            map.addSource('hero-hazard', { type: 'image', url: layerUrl, coordinates: overlayCoords });
            map.addLayer(
              {
                id: 'hero-hazard',
                type: 'raster',
                source: 'hero-hazard',
                paint: { 'raster-opacity': 0.56, 'raster-fade-duration': 120 },
              },
              map.getLayer('hero-lifelines-casing') ? 'hero-lifelines-casing' : undefined
            );
          }
          if (map.getLayer('hero-hazard')) map.setLayoutProperty('hero-hazard', 'visibility', vis);
        } else {
          map.addSource('hero-hazard', { type: 'image', url: layerUrl, coordinates: overlayCoords });
          map.addLayer(
            {
              id: 'hero-hazard',
              type: 'raster',
              source: 'hero-hazard',
              paint: { 'raster-opacity': 0.56, 'raster-fade-duration': 120 },
            },
            map.getLayer('hero-lifelines-casing') ? 'hero-lifelines-casing' : undefined
          );
          map.setLayoutProperty('hero-hazard', 'visibility', vis);
        }
      } catch (err) {
        map.once('idle', apply);
      }
    };
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, layerUrl, overlayCoords, showModel]);

  // Detection markers & simulated failure runout zones for the current hour
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      try {
        const features = (run?.detections?.features || []).filter(
          f => (f.properties.detection_hour ?? 0) <= hour
        );

        const data = { type: 'FeatureCollection', features };
        if (map.getSource('hero-detections')) {
          map.getSource('hero-detections').setData(data);
        } else {
          map.addSource('hero-detections', { type: 'geojson', data });
          map.addLayer({
            id: 'hero-det-outer',
            type: 'circle',
            source: 'hero-detections',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'area_ha'], 0.2, 22, 2, 38, 20, 68],
              'circle-color': [
                'match', ['get', 'confidence_label'],
                'HIGH', '#ef4444', 'MODERATE', '#f97316', '#facc15',
              ],
              'circle-opacity': 0.22,
              'circle-blur': 0.45,
            },
          });
          map.addLayer({
            id: 'hero-det-halo',
            type: 'circle',
            source: 'hero-detections',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'area_ha'], 0.2, 12, 2, 22, 20, 42],
              'circle-color': '#ef4444',
              'circle-opacity': 0.35,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#fb923c',
            },
          });
          map.addLayer({
            id: 'hero-det-core',
            type: 'circle',
            source: 'hero-detections',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'area_ha'], 0.2, 5, 2, 7.5, 20, 12],
              'circle-color': [
                'match', ['get', 'confidence_label'],
                'HIGH', '#ef4444', 'MODERATE', '#f97316', '#facc15',
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });
          map.addLayer({
            id: 'hero-det-label',
            type: 'symbol',
            source: 'hero-detections',
            layout: {
              'text-field': ['concat', ['get', 'id'], ' · FS ', ['to-string', ['get', 'min_fs']]],
              'text-size': 10,
              'text-offset': [0, 1.3],
              'text-anchor': 'top',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#fecaca',
              'text-halo-color': '#04100a',
              'text-halo-width': 1.8,
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

        const vis = showModel && features.length > 0 ? 'visible' : 'none';
        ['hero-det-outer', 'hero-det-halo', 'hero-det-core', 'hero-det-label'].forEach(id => {
          if (map.getLayer(id)) {
            map.setLayoutProperty(id, 'visibility', vis);
          }
        });
      } catch (err) {
        map.once('idle', apply);
      }
    };
    apply();
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

      {/* Lighter readability scrims so Google Earth 3D terrain shines clearly */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#04100a]/82 via-[#04100a]/25 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#04100a]/88 via-transparent to-[#04100a]/25 pointer-events-none" />

      {/* Active Google Earth 3D Location Badge (Top-Right under layer toggles) */}
      <div className="hidden lg:flex absolute top-14 right-4 sm:right-16 z-30 flex-col gap-1 bg-[#04100a]/88 border border-[#BDFF42]/45 backdrop-blur-md px-3 py-2 rounded-sm shadow-xl max-w-[300px] pointer-events-none">
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#BDFF42]">
          <span className="flex items-center gap-1 font-bold">
            <MapPin size={11} />
            GOOGLE EARTH 3D TWIN
          </span>
          <span className="px-1.5 py-0.2 rounded bg-[#BDFF42]/15 text-[#BDFF42] border border-[#BDFF42]/30">
            {autoOrbit ? 'AUTO-ORBIT' : 'LOCKED'}
          </span>
        </div>
        <div className="text-xs font-bold text-white truncate">
          {activeLocation?.name || aoiMeta.name}
        </div>
        <div className="text-[10px] font-mono text-[#9FD8A8] flex items-center justify-between gap-2">
          <span>{activeLocation?.coords || `${aoiMeta.center[1].toFixed(3)}° N, ${aoiMeta.center[0].toFixed(3)}° E`}</span>
          <span className="text-[#BDFF42]">
            {aoiMeta.elevationRange.min}m–{aoiMeta.elevationRange.max}m
          </span>
        </div>
      </div>

      {/* Top controls */}
      <div className="absolute top-3 sm:top-5 right-2 sm:right-16 z-30 flex items-center gap-1.5">
        <HeroToggle on={autoOrbit} onClick={() => setAutoOrbit(v => !v)} icon={<Compass size={13} className={autoOrbit ? 'animate-spin' : ''} style={{ animationDuration: '8s' }} />} label="ORBIT" />
        <HeroToggle on={showImagery} onClick={() => {
          const next = !showImagery;
          setShowImagery(next);
          ['sat', 'local-sat-layer', 'hero-orthophoto'].forEach(layerId => {
            if (mapRef.current?.getLayer(layerId)) {
              mapRef.current.setLayoutProperty(layerId, 'visibility', next ? 'visible' : 'none');
            }
          });
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

      {/* Observed provenance chip */}
      {run?.observed_sample && (
        <div className="absolute top-3 sm:top-5 left-4 sm:left-8 z-30 max-w-[260px] text-[10px] font-mono px-2 py-1.5 rounded bg-[#04100a]/85 border border-[#BDFF42]/40 text-[#BDFF42] leading-tight">
          <div className="font-bold">OBSERVED RAINFALL</div>
          <div className="text-[#9FD8A8] normal-case">{run.observed_sample.label}</div>
          <div className="text-[#5E8B67]">{run.observed_sample.total_mm} mm / 48 h · ERA5 shape, documented magnitude</div>
        </div>
      )}

      {/* Bottom telemetry + timeline */}
      <div className="absolute bottom-3 sm:bottom-4 left-4 right-4 sm:left-8 sm:right-8 z-20">
        <div className="bg-[#04100a]/92 border border-[#249344]/50 backdrop-blur-md p-2.5 sm:p-3 rounded-sm shadow-2xl">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              {handleTogglePlay && (
                <button
                  onClick={handleTogglePlay}
                  title={playing ? 'Pause simulation' : 'Play simulation'}
                  className="px-2 py-1 rounded bg-[#BDFF42] text-[#06150C] font-bold text-[10px] font-mono flex items-center gap-1 hover:bg-[#d2ff75] transition-colors shrink-0"
                >
                  {playing ? <Pause size={11} /> : <Play size={11} />}
                  <span>{playing ? 'PAUSE' : 'PLAY'}</span>
                </button>
              )}
              <span className="text-xs font-mono text-[#BDFF42] font-bold whitespace-nowrap">
                T+{hour}h / {maxHour}h
              </span>
              {onHourChange && (
                <input
                  type="range"
                  min={0}
                  max={maxHour}
                  value={Math.min(hour, maxHour)}
                  onChange={e => onHourChange(Number(e.target.value))}
                  aria-label="Simulation hour"
                  className="w-24 sm:w-32 accent-[#BDFF42] cursor-pointer"
                />
              )}
              <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded bg-[#0a2416] border border-[#249344]/40 text-[#9FD8A8] whitespace-nowrap">
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
                {row.hazard_level || 'ACTIVE'}
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
