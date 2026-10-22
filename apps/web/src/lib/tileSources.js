/**
 * apps/web/src/lib/tileSources.js
 * BhuRaksha Tile Source Abstraction
 *
 * Provides seamless, continuous satellite imagery across the entire landscape (no square cutoffs)
 * combined with local high-resolution Copernicus GLO-30 3D elevation tiles.
 */

export const TILE_SOURCES = {
  esri: {
    id: "esri",
    name: "Esri World Imagery (Continuous High-Res)",
    sat: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    dem: "/tiles/terrain/{z}/{x}/{y}.png",
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics · Terrain: Copernicus GLO-30 DEM",
    minZoom: 1,
    maxZoom: 18,
    demMinZoom: 10,
    demMaxZoom: 14
  },
  eox: {
    id: "eox",
    name: "EOX Sentinel-2 Cloudless",
    sat: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    dem: "/tiles/terrain/{z}/{x}/{y}.png",
    attribution: "Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0) · Terrain: Copernicus GLO-30",
    minZoom: 1,
    maxZoom: 15,
    demMinZoom: 10,
    demMaxZoom: 14
  },
  local: {
    id: "local",
    name: "Offline Digital Twin (Local Orthophoto)",
    sat: "/tiles/satellite/{z}/{x}/{y}.jpg",
    dem: "/tiles/terrain/{z}/{x}/{y}.png",
    attribution: "Imagery: Copernicus Sentinel-2 L2A · Terrain: Copernicus GLO-30 (Local Twin)",
    minZoom: 10,
    maxZoom: 16,
    demMinZoom: 10,
    demMaxZoom: 14
  }
};

export function getMapLibreStyle(sourceKey = "esri") {
  const src = TILE_SOURCES[sourceKey] || TILE_SOURCES.esri;

  return {
    version: 8,
    sources: {
      sat: {
        type: "raster",
        tiles: [src.sat],
        tileSize: 256,
        minzoom: src.minZoom || 1,
        maxzoom: src.maxZoom || 18,
        attribution: src.attribution
      },
      dem: {
        type: "raster-dem",
        tiles: [src.dem],
        encoding: "terrarium",
        tileSize: 256,
        minzoom: src.demMinZoom || 10,
        maxzoom: src.demMaxZoom || 14
      },
      demhs: {
        type: "raster-dem",
        tiles: [src.dem],
        encoding: "terrarium",
        tileSize: 256,
        minzoom: src.demMinZoom || 10,
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
        id: "sat",
        type: "raster",
        source: "sat",
        paint: {
          "raster-fade-duration": 300,
          "raster-saturation": -0.05,
          "raster-brightness-max": 0.98,
          "raster-contrast": 0.08
        }
      },
      {
        id: "hs",
        type: "hillshade",
        source: "demhs",
        paint: {
          "hillshade-shadow-color": "#02140a",
          "hillshade-highlight-color": "#BDFF42",
          "hillshade-exaggeration": 0.35
        }
      }
    ]
  };
}
