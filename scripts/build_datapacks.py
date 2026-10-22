#!/usr/bin/env python3
"""
Downloads and caches real 30m elevation DEM arrays (AWS Terrarium / SRTM / Copernicus GLO-30)
for the 4 North Eastern Region AOIs into data/datapacks/.
Creates a data provenance manifest with exact coordinates, source URLs, and retrieval timestamps.
"""

import io
import math
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import requests
from PIL import Image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("datapacks")

DATAPACK_DIR = Path("data/datapacks")
DATAPACK_DIR.mkdir(parents=True, exist_ok=True)

AOIS = {
    "gangtok": {
        "name": "Gangtok – NH10 Corridor",
        "center": [27.305, 88.600],
        "state": "Sikkim",
        "lifeline": "NH-10 Highway"
    },
    "shillong": {
        "name": "Shillong Hills",
        "center": [25.570, 91.880],
        "state": "Meghalaya",
        "lifeline": "NH-6 Bypass"
    },
    "aizawl": {
        "name": "Aizawl Ridge",
        "center": [23.730, 92.720],
        "state": "Mizoram",
        "lifeline": "NH-54 Lifeline"
    },
    "tupul": {
        "name": "Tupul / Noney Railway Site",
        "center": [24.810, 93.630],
        "state": "Manipur",
        "lifeline": "Jiribam-Imphal Railway Infrastructure"
    }
}

Z = 13
TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

def _tile_xy(lat: float, lon: float, z: int) -> tuple[float, float]:
    n = 2 ** z
    x = (lon + 180) / 360 * n
    lat_rad = math.radians(lat)
    y = (1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n
    return x, y

def _tile_lon(x: float, z: int) -> float:
    return x / (2 ** z) * 360 - 180

def _tile_lat(y: float, z: int) -> float:
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / (2 ** z)))))

def fetch_and_save(aoi_id: str, aoi_meta: dict) -> dict:
    lat, lon = aoi_meta["center"]
    xf, yf = _tile_xy(lat, lon, Z)
    x0, y0 = int(round(xf)) - 1, int(round(yf)) - 1
    
    mosaic = np.zeros((512, 512), dtype=np.float64)
    tile_urls = []
    
    log.info("Fetching real DEM tiles for %s (%s, %s)...", aoi_id, lat, lon)
    for dx in range(2):
        for dy in range(2):
            url = TERRARIUM.format(z=Z, x=x0 + dx, y=y0 + dy)
            tile_urls.append(url)
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            a = np.asarray(img).astype(np.float64)
            elev = a[..., 0] * 256.0 + a[..., 1] + a[..., 2] / 256.0 - 32768.0
            mosaic[dy * 256:(dy + 1) * 256, dx * 256:(dx + 1) * 256] = elev
            
    bounds = {
        "west": float(_tile_lon(x0, Z)),
        "east": float(_tile_lon(x0 + 2, Z)),
        "north": float(_tile_lat(y0, Z)),
        "south": float(_tile_lat(y0 + 2, Z))
    }
    
    out_file = DATAPACK_DIR / f"{aoi_id}.npz"
    np.savez_compressed(out_file, dem=mosaic, **bounds)
    log.info("✓ Saved real 30m DEM for %s to %s (Min: %.1fm, Max: %.1fm)", 
             aoi_id, out_file, float(mosaic.min()), float(mosaic.max()))
             
    return {
        "aoi": aoi_id,
        "name": aoi_meta["name"],
        "state": aoi_meta["state"],
        "center": [lat, lon],
        "bounds": bounds,
        "resolution_m": 30.0,
        "shape": [512, 512],
        "min_elevation_m": round(float(mosaic.min()), 1),
        "max_elevation_m": round(float(mosaic.max()), 1),
        "source": "AWS Terrain Tiles (Mapzen Terrarium - SRTM & Copernicus GLO-30)",
        "licence": "Open Data Commons Open Database License (ODbL) / Public Domain",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "tile_urls": tile_urls
    }

def main():
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "description": "Pre-cached real 30m DEM elevation datasets for North Eastern Region AOIs",
        "aois": {}
    }
    
    for aoi_id, aoi_meta in AOIS.items():
        try:
            info = fetch_and_save(aoi_id, aoi_meta)
            manifest["aois"][aoi_id] = info
        except Exception as e:
            log.error("Failed to fetch %s: %s", aoi_id, e)
            
    manifest_path = DATAPACK_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    log.info("✓ Data provenance manifest saved to %s", manifest_path)

if __name__ == "__main__":
    main()
