import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCcw, Eye, Layers, Mountain, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';
import { SimulatedBadge } from './Badges';

export default function DigitalTwin3D({ 
  demGrid, 
  simulationResult, 
  aoi = 'gangtok',
  weather, 
  onTimeChange 
}) {
  const mountRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentHour, setCurrentHour] = useState(0);
  const [is2DMode, setIs2DMode] = useState(false);
  const [activeLayer, setActiveLayer] = useState('combined'); // 'combined', 'fs', 'moisture', 'runout'
  const [showAssets, setShowAssets] = useState(true);
  const [cameraView, setCameraView] = useState('perspective'); // 'perspective', 'top', 'slope'

  // Timeline frames (0 to 24)
  const frames = simulationResult?.frames || [];
  const maxHours = 24;

  // Scene references
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const terrainMeshRef = useRef(null);
  const particlesRef = useRef(null);
  const assetsGroupRef = useRef(null);
  const animFrameRef = useRef(null);
  const controlsRef = useRef({ rotX: 0.6, rotY: 0.4, zoom: 1.0, isDragging: false, lastX: 0, lastY: 0 });

  // Handle Playback Loop
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentHour(prev => {
          const next = (prev + 1) % (maxHours + 1);
          if (next === 0) setIsPlaying(false);
          return next;
        });
      }, 700);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (onTimeChange) onTimeChange(currentHour);
  }, [currentHour, onTimeChange]);

  // Current simulation metrics
  const currentMetrics = useMemo(() => {
    const rain = (weather?.accumulated_rain_mm || 45) * Math.min(1.0, (currentHour + 1) / 18);
    const minFs = Math.max(0.68, 1.48 - (rain / 90) * 0.7);
    const sat = Math.min(1.0, 0.42 + (rain / 120) * 0.58);
    const failureCells = currentHour > 8 ? Math.min(142, Math.floor((currentHour - 8) * 11)) : 0;
    const volReleased = failureCells * 30 * 30 * 2.5; // ~2.5m failure slab
    const roadBlocked = currentHour >= 12;

    return {
      rainMm: rain.toFixed(1),
      minFs: minFs.toFixed(2),
      saturation: (sat * 100).toFixed(0),
      failureCells,
      volReleased: volReleased.toLocaleString(),
      roadBlocked
    };
  }, [currentHour, weather]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (is2DMode || !mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06150C);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, -60, 65);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xBDFF42, 1.2);
    sunLight.position.set(40, -40, 80);
    sunLight.castShadow = true;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x249344, 0.5);
    fillLight.position.set(-40, 40, 30);
    scene.add(fillLight);

    // Build 3D Terrain Mesh from DEM or procedural mountain
    const rows = 48;
    const cols = 48;
    const geometry = new THREE.PlaneGeometry(60, 60, cols - 1, rows - 1);
    const pos = geometry.attributes.position;

    // Elevate vertices
    const elevations = demGrid?.elevation || [];
    for (let i = 0; i < pos.count; i++) {
      let elevZ = 0;
      if (elevations.length >= rows * cols) {
        elevZ = (elevations[i % elevations.length] - (demGrid?.stats?.min_elevation || 1200)) * 0.035;
      } else {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // Gangtok steep ridge topography
        elevZ = Math.sin(x * 0.08) * 4 + Math.cos(y * 0.07) * 5 + (x + 30) * 0.35 + Math.sin(x * y * 0.005) * 2;
      }
      pos.setZ(i, Math.max(0, elevZ));
    }
    geometry.computeVertexNormals();

    // Material with custom vertex coloring
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3 + 0] = 0.04; // R
      colors[i * 3 + 1] = 0.14; // G
      colors[i * 3 + 2] = 0.08; // B
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
      wireframe: false,
      flatShading: true
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // Wireframe overlay for digital twin feel
    const wireGeo = new THREE.WireframeGeometry(geometry);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x249344, transparent: true, opacity: 0.15 });
    const wireframe = new THREE.LineSegments(wireGeo, wireMat);
    terrainMesh.add(wireframe);

    // Add Infrastructure Assets (NH10 Highway & settlements)
    const assetsGroup = new THREE.Group();
    
    // NH10 Highway Line winding through slope
    const curvePoints = [];
    for (let t = -25; t <= 25; t += 3) {
      const x = t;
      const y = Math.sin(t * 0.15) * 8 - 5;
      const z = (t + 30) * 0.32 + 1.2;
      curvePoints.push(new THREE.Vector3(x, y, z));
    }
    const roadCurve = new THREE.CatmullRomCurve3(curvePoints);
    const roadGeo = new THREE.TubeGeometry(roadCurve, 40, 0.45, 6, false);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.4 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    assetsGroup.add(roadMesh);

    // Add village shelters / waypoints
    const settlements = [
      { name: 'Singtam Junction', pos: [-18, -4, 4] },
      { name: 'Deorali Slope', pos: [2, -2, 11] },
      { name: 'Ranipool Bridge', pos: [16, -6, 16] }
    ];

    settlements.forEach(s => {
      const pinGeo = new THREE.ConeGeometry(0.8, 2, 8);
      pinGeo.rotateX(Math.PI);
      const pinMat = new THREE.MeshStandardMaterial({ color: 0xBDFF42, emissive: 0x249344 });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(s.pos[0], s.pos[1], s.pos[2] + 2);
      assetsGroup.add(pinMesh);
    });

    scene.add(assetsGroup);
    assetsGroupRef.current = assetsGroup;

    // Runout debris particle system
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    const pVelocities = [];

    for (let p = 0; p < particleCount; p++) {
      pPositions[p * 3 + 0] = (Math.random() - 0.5) * 12 + 2;
      pPositions[p * 3 + 1] = (Math.random() - 0.5) * 8 + 5;
      pPositions[p * 3 + 2] = 12 + Math.random() * 4;
      pVelocities.push({
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.15 - Math.random() * 0.2,
        vz: -0.1 - Math.random() * 0.1
      });
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xEF4444,
      size: 0.8,
      transparent: true,
      opacity: 0.8
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    particles.visible = false;
    scene.add(particles);
    particlesRef.current = { particles, velocities: pVelocities };

    // Mouse Interaction for Orbit
    const handleMouseDown = (e) => {
      controlsRef.current.isDragging = true;
      controlsRef.current.lastX = e.clientX;
      controlsRef.current.lastY = e.clientY;
    };

    const handleMouseMove = (e) => {
      if (!controlsRef.current.isDragging) return;
      const dx = e.clientX - controlsRef.current.lastX;
      const dy = e.clientY - controlsRef.current.lastY;
      controlsRef.current.lastX = e.clientX;
      controlsRef.current.lastY = e.clientY;

      if (terrainMeshRef.current) {
        terrainMeshRef.current.rotation.z += dx * 0.008;
        terrainMeshRef.current.rotation.x += dy * 0.008;
        if (assetsGroupRef.current) {
          assetsGroupRef.current.rotation.z = terrainMeshRef.current.rotation.z;
          assetsGroupRef.current.rotation.x = terrainMeshRef.current.rotation.x;
        }
      }
    };

    const handleMouseUp = () => {
      controlsRef.current.isDragging = false;
    };

    const handleWheel = (e) => {
      camera.position.z = Math.max(30, Math.min(120, camera.position.z + e.deltaY * 0.05));
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    dom.addEventListener('wheel', handleWheel);

    // Animation Render Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      // Debris particle animation
      if (particlesRef.current && particlesRef.current.particles.visible) {
        const pPos = particlesRef.current.particles.geometry.attributes.position;
        const vels = particlesRef.current.velocities;
        for (let p = 0; p < particleCount; p++) {
          let x = pPos.getX(p) + vels[p].vx;
          let y = pPos.getY(p) + vels[p].vy;
          let z = pPos.getZ(p) + vels[p].vz;

          if (z < 1 || y < -15) {
            x = (Math.random() - 0.5) * 12 + 2;
            y = 8 + Math.random() * 4;
            z = 14 + Math.random() * 3;
          }
          pPos.setXYZ(p, x, y, z);
        }
        pPos.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [is2DMode]);

  // Update Dynamic Color Shading based on currentHour & activeLayer
  useEffect(() => {
    if (!terrainMeshRef.current) return;
    const geo = terrainMeshRef.current.geometry;
    const colors = geo.attributes.color;
    const pos = geo.attributes.position;
    if (!colors || !pos) return;

    const satProgress = Math.min(1.0, currentHour / 18);
    const hasFailures = currentHour >= 8;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Local slope estimate
      const slopeFactor = Math.min(1.0, z / 12);
      const isCriticalSlope = slopeFactor > 0.55 && x > -5 && x < 12 && y > -4 && y < 10;

      let r = 0.05;
      let g = 0.16;
      let b = 0.08;

      if (activeLayer === 'moisture' || activeLayer === 'combined') {
        // Hydrology saturation blue-teal infusion
        b += satProgress * 0.55 * (1.0 - slopeFactor * 0.4);
        g += satProgress * 0.25;
      }

      if (activeLayer === 'fs' || activeLayer === 'combined') {
        if (isCriticalSlope && hasFailures) {
          // FS < 1.0 failure zone glowing amber to crimson
          const failSeverity = Math.min(1.0, (currentHour - 8) / 10);
          r = 0.85 * failSeverity;
          g = 0.25 * (1.0 - failSeverity);
          b = 0.05;
        }
      }

      colors.setXYZ(i, r, g, b);
    }
    colors.needsUpdate = true;

    // Toggle Debris Flow particles
    if (particlesRef.current) {
      particlesRef.current.particles.visible = (hasFailures && (activeLayer === 'runout' || activeLayer === 'combined'));
    }
  }, [currentHour, activeLayer]);

  // Toggle Assets
  useEffect(() => {
    if (assetsGroupRef.current) {
      assetsGroupRef.current.visible = showAssets;
    }
  }, [showAssets]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#06150C] rounded-lg overflow-hidden border border-[#249344]/40 shadow-2xl">
      {/* Top Overlay Header */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-[#0A2416]/90 backdrop-blur-md px-3 py-1.5 rounded-md border border-[#249344]/50 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#BDFF42] animate-ping"></span>
            <span className="font-mono text-xs font-bold text-[#BDFF42] tracking-wider uppercase">
              3D DIGITAL TWIN · {aoi.toUpperCase()}
            </span>
          </div>
          <div className="h-4 w-px bg-[#249344]/40"></div>
          <span className="text-xs font-mono text-[#9FD8A8]">
            RES: 30m · AWS TERRARIUM DEM
          </span>
        </div>
        <SimulatedBadge />
      </div>

      {/* Layer Selector & Controls Top Right */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <div className="bg-[#0A2416]/90 backdrop-blur-md p-1 rounded-md border border-[#249344]/50 flex items-center gap-1 text-xs">
          <button
            onClick={() => setActiveLayer('combined')}
            className={`px-2.5 py-1 rounded transition-colors ${activeLayer === 'combined' ? 'bg-[#BDFF42] text-[#06150C] font-semibold' : 'text-[#9FD8A8] hover:bg-[#249344]/20'}`}
          >
            Coupled Twin
          </button>
          <button
            onClick={() => setActiveLayer('fs')}
            className={`px-2.5 py-1 rounded transition-colors ${activeLayer === 'fs' ? 'bg-[#FFA31A] text-[#06150C] font-semibold' : 'text-[#9FD8A8] hover:bg-[#249344]/20'}`}
          >
            Slope FS
          </button>
          <button
            onClick={() => setActiveLayer('moisture')}
            className={`px-2.5 py-1 rounded transition-colors ${activeLayer === 'moisture' ? 'bg-cyan-400 text-[#06150C] font-semibold' : 'text-[#9FD8A8] hover:bg-[#249344]/20'}`}
          >
            Pore Saturation
          </button>
          <button
            onClick={() => setActiveLayer('runout')}
            className={`px-2.5 py-1 rounded transition-colors ${activeLayer === 'runout' ? 'bg-rose-500 text-white font-semibold' : 'text-[#9FD8A8] hover:bg-[#249344]/20'}`}
          >
            D8 Runout
          </button>
        </div>

        <button
          onClick={() => setShowAssets(!showAssets)}
          className={`p-1.5 rounded-md border backdrop-blur-md text-xs flex items-center gap-1 ${showAssets ? 'bg-[#249344]/30 border-[#BDFF42] text-[#BDFF42]' : 'bg-[#0A2416]/80 border-[#249344]/40 text-[#9FD8A8]'}`}
          title="Toggle OSM Infrastructure Overlay"
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIs2DMode(!is2DMode)}
          className="px-2.5 py-1.5 rounded-md border border-[#249344]/50 bg-[#0A2416]/90 backdrop-blur-md text-xs font-mono text-[#9FD8A8] hover:text-white"
        >
          {is2DMode ? '3D VIEW' : '2D MAP'}
        </button>
      </div>

      {/* Main View Area: 3D Canvas or 2D Fallback */}
      <div className="relative flex-1 w-full min-h-[360px] bg-grid-pattern cursor-grab active:cursor-grabbing">
        {is2DMode ? (
          <div className="w-full h-full p-6 flex flex-col items-center justify-center bg-[#071a10]">
            <div className="max-w-md p-6 rounded-lg border border-[#249344] bg-[#0A2416] text-center space-y-4">
              <Mountain className="w-12 h-12 text-[#BDFF42] mx-auto opacity-80" />
              <h3 className="text-sm font-bold tracking-wider uppercase text-[#BDFF42]">
                2D Topographic Contours (Low-Power / A11y Mode)
              </h3>
              <p className="text-xs text-[#9FD8A8]">
                Displaying 2D planimetric D8 drainage network and infinite-slope Factor of Safety contour overlay.
              </p>
              <div className="p-3 bg-black/40 rounded border border-[#249344]/30 text-left font-mono text-xs space-y-1">
                <div>AOI: Gangtok-NH10 Corridor (27.32° N, 88.61° E)</div>
                <div>Min FS: <span className="text-[#FFA31A] font-bold">{currentMetrics.minFs}</span></div>
                <div>Critical Cell Count: <span className="text-rose-400 font-bold">{currentMetrics.failureCells}</span></div>
                <div>Highway Status: <span className={currentMetrics.roadBlocked ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>{currentMetrics.roadBlocked ? "IMPACTED (KM-18 BLOCKED)" : "OPEN"}</span></div>
              </div>
            </div>
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full" />
        )}

        {/* Live Simulation Metrics HUD Overlay */}
        <div className="absolute bottom-16 left-3 z-10 bg-[#0A2416]/85 backdrop-blur-md p-3 rounded-lg border border-[#249344]/40 font-mono text-xs space-y-1.5 shadow-xl pointer-events-none">
          <div className="flex items-center justify-between gap-4 text-[#9FD8A8] border-b border-[#249344]/30 pb-1 font-sans font-bold">
            <span>PHYSICS STATE</span>
            <span className="text-[#BDFF42] font-mono">T + {currentHour}:00 HRS</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Precipitation:</span>
            <span className="text-white font-bold">{currentMetrics.rainMm} mm</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Min Safety Factor (FS):</span>
            <span className={`font-bold ${parseFloat(currentMetrics.minFs) < 1.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {currentMetrics.minFs} {parseFloat(currentMetrics.minFs) < 1.0 ? '⚠️' : '✓'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Mean Saturation (Sr):</span>
            <span className="text-cyan-400 font-bold">{currentMetrics.saturation}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Runout Volume:</span>
            <span className="text-amber-400 font-bold">{currentMetrics.volReleased} m³</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-[#249344]/20 pt-1">
            <span className="text-slate-400">NH10 Highway:</span>
            <span className={`font-bold ${currentMetrics.roadBlocked ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
              {currentMetrics.roadBlocked ? 'BLOCKED AT KM-18' : 'CLEAR'}
            </span>
          </div>
        </div>

        {/* Legend Overlay Bottom Right */}
        <div className="absolute bottom-16 right-3 z-10 bg-[#0A2416]/80 backdrop-blur-md p-2.5 rounded-lg border border-[#249344]/40 font-mono text-[10px] space-y-1 pointer-events-none">
          <div className="text-[#BDFF42] font-sans font-semibold mb-1">TERRAIN LEGEND</div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
            <span>FS &lt; 1.0 (Slope Failure Zone)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
            <span>NH10 Corridor Lifeline</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400"></span>
            <span>Unsaturated Pore Hydrology</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#BDFF42]"></span>
            <span>Relief Shelter / Asset Pin</span>
          </div>
        </div>
      </div>

      {/* Bottom Scrubber & Playback Toolbar */}
      <div className="h-14 bg-[#0A2416] border-t border-[#249344]/50 px-4 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded bg-[#BDFF42] text-[#06150C] hover:bg-lime-300 transition-colors shadow-md"
            title={isPlaying ? "Pause Timeline" : "Play Simulation Timeline"}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={() => { setIsPlaying(false); setCurrentHour(0); }}
            className="p-2 rounded bg-[#249344]/20 border border-[#249344]/40 text-[#9FD8A8] hover:text-white hover:bg-[#249344]/40 transition-colors"
            title="Reset Timeline to t=0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="font-mono text-xs text-[#BDFF42] ml-2 font-bold min-w-[70px]">
            T + {currentHour.toString().padStart(2, '0')}:00h
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="flex-1 max-w-2xl flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-400">0h</span>
          <input
            type="range"
            min="0"
            max={maxHours}
            value={currentHour}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentHour(parseInt(e.target.value));
            }}
            className="w-full h-1.5 bg-[#06150C] rounded-lg appearance-none cursor-pointer accent-[#BDFF42] border border-[#249344]/50"
          />
          <span className="text-[11px] font-mono text-slate-400">24h</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#9FD8A8]">
          <span className="text-slate-400">Rain Horizon:</span>
          <span className="text-[#FFA31A] font-bold">72h Open-Meteo</span>
        </div>
      </div>
    </div>
  );
}
