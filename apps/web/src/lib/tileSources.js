/**
 * apps/web/src/lib/tileSources.js
 * BhuRaksha Tile Source Abstraction
 *
 * Provides seamless Google Earth & Esri World Imagery satellite photography
 * backed by instant local high-resolution orthophoto tiles and Copernicus GLO-30 3D DEM.
 */

export const TILE_SOURCES = {
  esri: {
    id: "esri",
    name: "Google Earth & Esri World Imagery (3D Satellite)",
    satTiles: [
      "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    ],
    sat: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    dem: "/tiles/terrain/{z}/{x}/{y}.png",
    attribution: "Imagery © Google Earth, Esri, Maxar & Copernicus Sentinel-2 · Terrain: Copernicus GLO-30 DEM",
    minZoom: 1,
    maxZoom: 19,
    demMinZoom: 12,
    demMaxZoom: 14
  },
  eox: {
    id: "eox",
    name: "EOX Sentinel-2 Cloudless",
    satTiles: [
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"
    ],
    sat: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    dem: "/tiles/terrain/{z}/{x}/{y}.png",
    attribution: "Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0) · Terrain: Copernicus GLO-30",
    minZoom: 1,
    maxZoom: 15,
    demMinZoom: 12,
    demMaxZoom: 14
  },
  local: {
    id: "local",
    name: "Offline Digital Twin (Local Orthophoto)",
    satTiles: ["/tiles/satellite/{z}/{x}/{y}.jpg"],
    sat: "/tiles/satellite/{z}/{x}/{y}.jpg",
    dem: "/tiles/terrain/{z}/{x}/{y}.png",
    attribution: "Imagery: Copernicus Sentinel-2 L2A · Terrain: Copernicus GLO-30 (Local Twin)",
    minZoom: 12,
    maxZoom: 14,
    demMinZoom: 12,
    demMaxZoom: 14
  }
};

export function getMapLibreStyle(sourceKey = "esri") {
  const src = TILE_SOURCES[sourceKey] || TILE_SOURCES.esri;

  return {
    version: 8,
    sources: {
      local_sat: {
        type: "raster",
        tiles: ["/tiles/satellite/{z}/{x}/{y}.jpg"],
        tileSize: 256,
        minzoom: 12,
        maxzoom: 14
      },
      sat: {
        type: "raster",
        tiles: src.satTiles || [src.sat],
        tileSize: 256,
        minzoom: src.minZoom || 1,
        maxzoom: src.maxZoom || 19,
        attribution: src.attribution
      },
      dem: {
        type: "raster-dem",
        tiles: [src.dem],
        encoding: "terrarium",
        tileSize: 256,
        minzoom: src.demMinZoom || 12,
        maxzoom: src.demMaxZoom || 14
      },
      demhs: {
        type: "raster-dem",
        tiles: [src.dem],
        encoding: "terrarium",
        tileSize: 256,
        minzoom: src.demMinZoom || 12,
        maxzoom: src.demMaxZoom || 14
      }
    },
    layers: [
      {
        id: "bg",
        type: "background",
        paint: { "background-color": "#06150C" }
      },
      {
        id: "local-sat-layer",
        type: "raster",
        source: "local_sat",
        paint: {
          "raster-fade-duration": 150,
          "raster-saturation": 0.08,
          "raster-contrast": 0.12
        }
      },
      {
        id: "sat",
        type: "raster",
        source: "sat",
        paint: {
          "raster-fade-duration": 250,
          "raster-saturation": 0.08,
          "raster-brightness-max": 1.0,
          "raster-contrast": 0.12
        }
      },
      {
        id: "hs",
        type: "hillshade",
        source: "demhs",
        paint: {
          "hillshade-shadow-color": "#021008",
          "hillshade-highlight-color": "#e2f8b0",
          "hillshade-exaggeration": 0.22
        }
      }
    ]
  };
}
