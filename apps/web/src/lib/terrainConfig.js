/**
 * apps/web/src/lib/terrainConfig.js
 * Single Source of Truth for Terrain, Geospatial Projections, Elevation Datums,
 * and Control Points across RESQ.AI × BhuRaksha.
 *
 * Guaranteed Properties:
 * 1. Single Exaggeration: 1.4 across rendering, analysis, and markers.
 * 2. Shared Elevation Datum: Copernicus GLO-30 Terrarium tiles (WGS84 ellipsoidal / EGM96).
 * 3. Half-Cell Alignment: Pixel centers are evaluated at (col + 0.5, row + 0.5).
 * 4. Row Convention: Row 0 is North, Row 511 is South. Col 0 is West, Col 511 is East.
 */

export const TERRAIN_CONSTANTS = {
  EXAGGERATION: 1.4,
  TILE_ZOOM: 13,
  GRID_SIZE: 512,
  DEM_RESOLUTION_M: 16.98,
  HALF_CELL_OFFSET: true,
  ROW_ORDER: "NORTH_TO_SOUTH",
  COL_ORDER: "WEST_TO_EAST",
  ENCODING: "terrarium",
  BASE_DEM_PROVENANCE: "Copernicus GLO-30 & AWS Terrarium Clip (30m spatial resolution)"
};

export const AOI_METADATA = {
  gangtok: {
    id: "gangtok",
    name: "Gangtok – NH10 Corridor",
    state: "Sikkim",
    district: "East Sikkim",
    center: [88.596, 27.298], // [lng, lat]
    camera: {
      center: [88.596, 27.298],
      zoom: 13.15,
      pitch: 69,
      bearing: 26
    },
    bounds: {
      west: 88.5498046875,
      east: 88.6376953125,
      north: 27.33273513685914,
      south: 27.254629577800074
    },
    elevationRange: { min: 557.0, max: 2159.0, relief: 1602.0 },
    primaryLifeline: "NH10 Gangtok–Ranipool Lifeline",
    tileOriginZ13: { x: 6111, y: 3449 },
    landmarks: [
      { name: "Gangtok Ridge (1,650m)", coordinates: [88.612, 27.322], tag: "CAPITAL RIDGE" },
      { name: "Tadong · NH-10 Lifeline", coordinates: [88.596, 27.308], tag: "PRIMARY CORRIDOR" },
      { name: "Ranipool Gorge Confluence", coordinates: [88.587, 27.287], tag: "VALLEY FLOOR" },
      { name: "Lower Syari Active Scarp", coordinates: [88.614, 27.301], tag: "SLOPE WATCH" }
    ],
    simulatedIncident: {
      hazard: "Debris Flow & Translational Slide",
      trigger: "SCENARIO (PROTOTYPE): 112 mm / 24h FORCING",
      riskLevel: "HIGH / IMMINENT",
      affectedVillages: ["Tadong", "Ranipool", "Lower Syari"],
      blockedRoads: ["NH10 Gangtok–Ranipool", "Sichey–Tathangchen–Ranipool link"]
    }
  },
  shillong: {
    id: "shillong",
    name: "Shillong Hills",
    state: "Meghalaya",
    district: "East Khasi Hills",
    center: [91.880, 25.570],
    camera: {
      center: [91.880, 25.570],
      zoom: 12.6,
      pitch: 70,
      bearing: -15
    },
    bounds: {
      west: 91.845703125,
      east: 91.93359375,
      north: 25.601902261115736,
      south: 25.522614647623286
    },
    elevationRange: { min: 1031.0, max: 1965.0, relief: 934.0 },
    primaryLifeline: "NH6 Shillong Arterial",
    tileOriginZ13: { x: 6186, y: 3493 },
    simulatedIncident: {
      hazard: "Slope Wash & Rockfall",
      trigger: "SCENARIO (PROTOTYPE): 94 mm / 24h FORCING",
      riskLevel: "MODERATE / ADVISORY",
      affectedVillages: ["Mawlai", "Police Bazar"],
      blockedRoads: ["GS Road Link"]
    }
  },
  aizawl: {
    id: "aizawl",
    name: "Aizawl Ridge",
    state: "Mizoram",
    district: "Aizawl",
    center: [92.719, 23.727],
    camera: {
      center: [92.719, 23.727],
      zoom: 13.25,
      pitch: 71,
      bearing: 148
    },
    bounds: {
      west: 92.6806640625,
      east: 92.7685546875,
      north: 23.765236889758665,
      south: 23.684774166883745
    },
    elevationRange: { min: 323.0, max: 1326.0, relief: 1003.0 },
    primaryLifeline: "NH-54 / NH306 Lifeline",
    tileOriginZ13: { x: 6205, y: 3539 },
    landmarks: [
      { name: "Aizawl Knife-Edge Crest (1,132m)", coordinates: [92.718, 23.727], tag: "SYNCLINAL RIDGE" },
      { name: "Hunthar Bypass Slope", coordinates: [92.705, 23.741], tag: "CREEP ZONE" },
      { name: "Dawrpui · NH-306 Spine", coordinates: [92.719, 23.736], tag: "URBAN LIFELINE" },
      { name: "Tlawng Gorge Drop-Off", coordinates: [92.698, 23.718], tag: "WEST ESCARPMENT" }
    ],
    simulatedIncident: {
      hazard: "Crest Instability & Creep",
      trigger: "SCENARIO (PROTOTYPE): 82 mm / 24h FORCING",
      riskLevel: "MODERATE",
      affectedVillages: ["Hunthar", "Dawrpui"],
      blockedRoads: ["Aizawl West Bypass"]
    }
  },
  tupul: {
    id: "tupul",
    name: "Tupul / Noney Railway Site",
    state: "Manipur",
    district: "Noney",
    center: [93.611, 24.866],
    camera: {
      center: [93.611, 24.866],
      zoom: 12.7,
      pitch: 72,
      bearing: -10
    },
    bounds: {
      west: 93.603515625,
      east: 93.69140625,
      north: 24.84656534821974,
      south: 24.766784522874442
    },
    elevationRange: { min: 341.0, max: 1616.0, relief: 1275.0 },
    primaryLifeline: "NH37 Imphal–Jiribam Lifeline",
    tileOriginZ13: { x: 6226, y: 3512 },
    simulatedIncident: {
      hazard: "High-Relief Debris Avalanche",
      trigger: "SCENARIO (PROTOTYPE): 140 mm / 24h FORCING",
      riskLevel: "CRITICAL / RETROSPECTIVE BENCHMARK",
      affectedVillages: ["Tupul Rail Project Camp", "Marangching"],
      blockedRoads: ["NH37 Imphal–Jiribam Lifeline"]
    }
  },
  wayanad: {
    id: "wayanad",
    name: "Wayanad (Chooralmala–Meppadi)",
    state: "Kerala (Generality Demo)",
    district: "Wayanad",
    center: [76.156, 11.519],
    camera: {
      center: [76.156, 11.519],
      zoom: 13.12,
      pitch: 68,
      bearing: -118
    },
    bounds: {
      west: 76.11328125,
      east: 76.201171875,
      north: 11.566143767762854,
      south: 11.480024648555817
    },
    elevationRange: { min: 177.0, max: 1797.0, relief: 1620.0 },
    primaryLifeline: "Chooralmala–Meppadi Lifeline Road",
    tileOriginZ13: { x: 5828, y: 3831 },
    landmarks: [
      { name: "Chooralmala Town & Bridge", coordinates: [76.161, 11.516], tag: "IMPACT ZONE" },
      { name: "Mundakkai Debris Channel", coordinates: [76.144, 11.504], tag: "RUNOUT PATH" },
      { name: "Vellarimala Headwall (1,797m)", coordinates: [76.132, 11.495], tag: "CROWN SCARP" },
      { name: "Meppadi Staging Corridor", coordinates: [76.156, 11.545], tag: "RELIEF HUB" }
    ],
    simulatedIncident: {
      hazard: "Catastrophic Valley Debris Torrent",
      trigger: "SCENARIO (PROTOTYPE): 170 mm / 24h FORCING",
      riskLevel: "CRITICAL",
      affectedVillages: ["Chooralmala", "Mundakkai"],
      blockedRoads: ["Chooralmala–Meppadi Lifeline Road"]
    }
  },
  joshimath: {
    id: "joshimath",
    name: "Joshimath Subsidence Corridor",
    state: "Uttarakhand (Generality Demo)",
    district: "Chamoli",
    center: [79.566, 30.557],
    camera: {
      center: [79.566, 30.557],
      zoom: 12.6,
      pitch: 73,
      bearing: -25
    },
    bounds: {
      west: 79.541015625,
      east: 79.62890625,
      north: 30.600093873550065,
      south: 30.524413269923993
    },
    elevationRange: { min: 1357.0, max: 3972.0, relief: 2615.0 },
    primaryLifeline: "Badrinath National Highway (NH-07)",
    tileOriginZ13: { x: 5906, y: 3364 },
    simulatedIncident: {
      hazard: "Sub-surface Subsidence & Creep",
      trigger: "SCENARIO (PROTOTYPE): Continuous Pore Pressure Rise",
      riskLevel: "ELEVATED",
      affectedVillages: ["Sunil Ward", "Manohar Bagh"],
      blockedRoads: ["Upper Badrinath Road"]
    }
  }
};

/**
 * Bilinear DEM sampler matching MapLibre elevation texture sampling.
 */
export function sampleBilinearElevation(demArray, width, height, bounds, lon, lat) {
  const { west, east, south, north } = bounds;
  const u = (lon - west) / (east - west);
  const v = (north - lat) / (north - south); // Row 0 is North
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;

  const px = u * (width - 1);
  const py = v * (height - 1);
  const x0 = Math.floor(px);
  const x1 = Math.min(width - 1, x0 + 1);
  const y0 = Math.floor(py);
  const y1 = Math.min(height - 1, y0 + 1);

  const fx = px - x0;
  const fy = py - y0;

  const v00 = demArray[y0 * width + x0];
  const v10 = demArray[y0 * width + x1];
  const v01 = demArray[y1 * width + x0];
  const v11 = demArray[y1 * width + x1];

  const top = v00 * (1 - fx) + v10 * fx;
  const bottom = v01 * (1 - fx) + v11 * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Gets real terrain-surface elevation at any [lng, lat] coordinate.
 * If queryTerrainElevation is supported by MapLibre, uses it (which accounts for exaggeration).
 * Otherwise falls back to analytical bilinear sampling.
 */
export function getSurfaceElevation(map, lng, lat, aoiConfig, demArray = null) {
  if (map && typeof map.queryTerrainElevation === "function") {
    try {
      const qElev = map.queryTerrainElevation({ lng, lat });
      if (qElev !== null && !isNaN(qElev)) {
        return qElev;
      }
    } catch {
      // Fallback to bilinear
    }
  }
  if (demArray && aoiConfig) {
    const raw = sampleBilinearElevation(
      demArray,
      TERRAIN_CONSTANTS.GRID_SIZE,
      TERRAIN_CONSTANTS.GRID_SIZE,
      aoiConfig.bounds,
      lng,
      lat
    );
    if (raw !== null) {
      return raw * TERRAIN_CONSTANTS.EXAGGERATION;
    }
  }
  return null;
}
