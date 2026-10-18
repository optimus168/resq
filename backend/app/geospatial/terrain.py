import io
import math
import base64
import hashlib
import logging
from pathlib import Path
from typing import Optional
import numpy as np
import requests
from PIL import Image
from backend.app.core.config import settings

log = logging.getLogger("terrain")
DATAPACK = Path(settings.DATAPACK_DIR)
DATAPACK.mkdir(parents=True, exist_ok=True)
Z = 13
TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

ASSET_NOTE = "Approximate hand-placed demo assets (names real, geometry approximate, population estimates SIMULATED)."

AOIS = {
    "gangtok": {
        "name": "Gangtok – NH10 Corridor", "state": "Sikkim", "district": "Gangtok (East Sikkim)",
        "center": [27.305, 88.600],
        "villages": [
            {"id": "v-gtk", "name": "Gangtok (MG Marg)", "lat": 27.3314, "lon": 88.6138, "pop": 30000},
            {"id": "v-dor", "name": "Deorali", "lat": 27.3240, "lon": 88.6115, "pop": 6000},
            {"id": "v-tad", "name": "Tadong", "lat": 27.3135, "lon": 88.6015, "pop": 8000},
            {"id": "v-rnp", "name": "Ranipool", "lat": 27.2905, "lon": 88.5952, "pop": 5000},
            {"id": "v-sic", "name": "Sichey", "lat": 27.3380, "lon": 88.6185, "pop": 4000},
            {"id": "v-syr", "name": "Lower Syari", "lat": 27.3300, "lon": 88.6000, "pop": 3000},
        ],
        "roads": [
            {"id": "r-nh10", "name": "NH10 Gangtok–Ranipool", "kind": "primary",
             "coords": [[88.6138, 27.3314], [88.6115, 27.3240], [88.6015, 27.3135], [88.5980, 27.3000], [88.5952, 27.2905], [88.5800, 27.2750], [88.5650, 27.2650]]},
            {"id": "r-alt", "name": "Sichey–Tathangchen–Ranipool link", "kind": "alternate",
             "coords": [[88.6138, 27.3314], [88.6185, 27.3380], [88.6250, 27.3200], [88.6200, 27.3000], [88.5952, 27.2905]]},
        ],
        "shelters": [{"id": "s-pal", "name": "Paljor Stadium", "lat": 27.3290, "lon": 88.6125, "capacity": 1500},
                     {"id": "s-rnp", "name": "Govt School Ranipool", "lat": 27.2925, "lon": 88.5975, "capacity": 400}],
        "hospitals": [{"id": "h-stnm", "name": "STNM Hospital, Sochakgang", "lat": 27.3060, "lon": 88.6000},
                      {"id": "h-crh", "name": "Central Referral Hospital, Tadong", "lat": 27.3110, "lon": 88.6000}],
        "history": [{"date": "2023-10-04", "event": "South Lhonak GLOF; NH10 heavily damaged downstream (Teesta valley)", "source": "Public reports (NDMA/SSDMA)"}],
    },
    "shillong": {
        "name": "Shillong Hills", "state": "Meghalaya", "district": "East Khasi Hills",
        "center": [25.570, 91.880],
        "villages": [
            {"id": "v-pb", "name": "Police Bazar", "lat": 25.5760, "lon": 91.8825, "pop": 25000},
            {"id": "v-lai", "name": "Laitumkhrah", "lat": 25.5700, "lon": 91.8960, "pop": 15000},
            {"id": "v-maw", "name": "Mawlai", "lat": 25.5950, "lon": 91.8780, "pop": 12000},
            {"id": "v-non", "name": "Nongthymmai", "lat": 25.5800, "lon": 91.9000, "pop": 9000},
            {"id": "v-ups", "name": "Upper Shillong", "lat": 25.5550, "lon": 91.8500, "pop": 6000},
        ],
        "roads": [
            {"id": "r-nh6", "name": "NH6 Shillong section", "kind": "primary",
             "coords": [[91.8780, 25.5950], [91.8850, 25.5800], [91.8900, 25.5700], [91.8800, 25.5550], [91.8650, 25.5450]]},
            {"id": "r-gs", "name": "GS Road link", "kind": "alternate",
             "coords": [[91.8780, 25.5950], [91.8700, 25.5850], [91.8650, 25.5650], [91.8650, 25.5450]]},
        ],
        "shelters": [{"id": "s-polo", "name": "Polo Ground", "lat": 25.5870, "lon": 91.8870, "capacity": 2000}],
        "hospitals": [{"id": "h-civ", "name": "Civil Hospital Shillong", "lat": 25.5745, "lon": 91.8890}],
        "history": [{"date": "2022-06", "event": "Extreme pre-monsoon/monsoon rainfall; multiple landslides across Meghalaya", "source": "Public reports"}],
    },
    "aizawl": {
        "name": "Aizawl Ridge", "state": "Mizoram", "district": "Aizawl",
        "center": [23.727, 92.717],
        "villages": [
            {"id": "v-daw", "name": "Dawrpui", "lat": 23.7300, "lon": 92.7180, "pop": 14000},
            {"id": "v-hun", "name": "Hunthar", "lat": 23.7200, "lon": 92.7050, "pop": 5000},
            {"id": "v-ram", "name": "Ramhlun", "lat": 23.7500, "lon": 92.7300, "pop": 11000},
            {"id": "v-chn", "name": "Chanmari", "lat": 23.7400, "lon": 92.7200, "pop": 9000},
            {"id": "v-mel", "name": "Melthum", "lat": 23.6950, "lon": 92.7100, "pop": 4000},
        ],
        "roads": [
            {"id": "r-nh306", "name": "NH306 Aizawl section", "kind": "primary",
             "coords": [[92.7100, 23.6950], [92.7150, 23.7150], [92.7180, 23.7300], [92.7300, 23.7500], [92.7350, 23.7600]]},
            {"id": "r-byp", "name": "Western bypass", "kind": "alternate",
             "coords": [[92.7100, 23.6950], [92.7000, 23.7100], [92.7050, 23.7350], [92.7350, 23.7600]]},
        ],
        "shelters": [{"id": "s-lam", "name": "Lammual Ground", "lat": 23.7290, "lon": 92.7160, "capacity": 1800}],
        "hospitals": [{"id": "h-civa", "name": "Civil Hospital Aizawl", "lat": 23.7340, "lon": 92.7170}],
        "history": [{"date": "2024-05-28", "event": "Cyclone Remal rainfall; stone-quarry collapse & landslides near Melthum", "source": "Public reports"}],
    },
    "tupul": {
        "name": "Noney / Tupul", "state": "Manipur", "district": "Noney",
        "center": [24.866, 93.611],
        "villages": [
            {"id": "v-tcamp", "name": "Tupul rail project camp", "lat": 24.8690, "lon": 93.6120, "pop": 300},
            {"id": "v-non", "name": "Noney town", "lat": 24.8560, "lon": 93.6160, "pop": 3000},
            {"id": "v-mar", "name": "Marangching", "lat": 24.8780, "lon": 93.6000, "pop": 500},
        ],
        "roads": [
            {"id": "r-nh37", "name": "NH37 Imphal–Jiribam section", "kind": "primary",
             "coords": [[93.6400, 24.8400], [93.6200, 24.8560], [93.6100, 24.8690], [93.5900, 24.8800]]},
            {"id": "r-khp", "name": "Noney–Khoupum link", "kind": "alternate",
             "coords": [[93.6200, 24.8560], [93.5950, 24.8450], [93.5800, 24.8600], [93.5900, 24.8800]]},
        ],
        "shelters": [{"id": "s-hss", "name": "Noney Higher Secondary School", "lat": 24.8540, "lon": 93.6180, "capacity": 600}],
        "hospitals": [{"id": "h-chc", "name": "CHC Noney", "lat": 24.8555, "lon": 93.6190}],
        "history": [{"date": "2022-06-30", "event": "Tupul railway construction site landslide (major loss of life)", "source": "Public reports"}],
    },
}

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

def procedural_dem(seed: int = 7, n: int = 512) -> np.ndarray:
    """Deterministic synthetic DEM fallback generator with realistic mountain valleys."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n
    dem = 1200 + 700 * np.sin(xx * 3.1 + 0.5) * np.cos(yy * 2.3)
    for k in range(1, 6):
        dem += rng.normal(0, 140 / k) * np.sin(xx * 6 * k + rng.uniform(0, 6)) * np.cos(yy * 5 * k + rng.uniform(0, 6))
    return dem

def fetch_dem_tiles(lat: float, lon: float) -> tuple[np.ndarray, dict]:
    xf, yf = _tile_xy(lat, lon, Z)
    x0, y0 = int(round(xf)) - 1, int(round(yf)) - 1
    mosaic = np.zeros((512, 512), dtype=np.float64)
    for dx in range(2):
        for dy in range(2):
            url = TERRARIUM.format(z=Z, x=x0 + dx, y=y0 + dy)
            r = requests.get(url, timeout=12)
            r.raise_for_status()
            img = Image.open(io.BytesIO(r.content)).convert("RGB")
            a = np.asarray(img).astype(np.float64)
            elev = a[..., 0] * 256.0 + a[..., 1] + a[..., 2] / 256.0 - 32768.0
            mosaic[dy * 256:(dy + 1) * 256, dx * 256:(dx + 1) * 256] = elev
    bounds = {
        "west": _tile_lon(x0, Z),
        "east": _tile_lon(x0 + 2, Z),
        "north": _tile_lat(y0, Z),
        "south": _tile_lat(y0 + 2, Z)
    }
    return mosaic, bounds

def d8_receivers(dem: np.ndarray, cs: float) -> np.ndarray:
    """Computes D8 steepest descent receiver indices for flow routing."""
    h, w = dem.shape
    pad = np.pad(dem, 1, mode="edge")
    best = np.zeros((h, w), dtype=np.float64)
    recv = -np.ones((h, w), dtype=np.int64)
    idx = np.arange(h * w).reshape(h, w)
    
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            nb = pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
            dist = cs * math.hypot(dy, dx)
            grad = (dem - nb) / dist
            ys = np.clip(np.arange(h)[:, None] + dy, 0, h - 1)
            xs = np.clip(np.arange(w)[None, :] + dx, 0, w - 1)
            target = idx[ys, xs]
            better = grad > best
            best = np.where(better, grad, best)
            recv = np.where(better, target, recv)
    return recv.ravel()

def derive_terrain(dem: np.ndarray, cs: float):
    """Computes slope (deg), aspect (deg), flow accumulation and TWI."""
    dzdy, dzdx = np.gradient(dem, cs)
    slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    aspect = (np.degrees(np.arctan2(-dzdx, dzdy)) + 360) % 360
    recv = d8_receivers(dem, cs)
    
    # Calculate flow accumulation via topological sort
    acc = np.ones(dem.size, dtype=np.float64)
    for i in np.argsort(-dem.ravel(), kind="stable"):
        r = recv[i]
        if r >= 0:
            acc[r] += acc[i]
    acc = acc.reshape(dem.shape)
    
    # Topographic Wetness Index (TWI)
    tan_b = np.maximum(np.tan(np.radians(slope)), 0.01)
    twi = np.log((acc * cs) / tan_b)
    return slope, aspect, recv, acc, twi

_cache = {}

def load_terrain(aoi_id: str) -> dict:
    if aoi_id in _cache:
        return _cache[aoi_id]
        
    if aoi_id not in AOIS:
        raise ValueError(f"Unknown AOI: {aoi_id}")
        
    aoi = AOIS[aoi_id]
    f = DATAPACK / f"{aoi_id}.npz"
    source = "AWS Terrain Tiles (Terrarium, SRTM/GLO-30) — cached datapack"
    
    if f.exists():
        d = np.load(f)
        dem512 = d["dem"]
        bounds = {k: float(d[k]) for k in ("west", "east", "north", "south")}
    else:
        try:
            dem512, bounds = fetch_dem_tiles(*aoi["center"])
            np.savez_compressed(f, dem=dem512, **bounds)
            source = "AWS Terrain Tiles (Terrarium) — live fetch, now cached"
        except Exception as e:
            log.warning("Live DEM fetch failed for %s (%s); falling back to procedural DEM", aoi_id, e)
            lat, lon = aoi["center"]
            dem512 = procedural_dem(seed=len(aoi_id) * 17)
            bounds = {"west": lon - 0.045, "east": lon + 0.045, "north": lat + 0.04, "south": lat - 0.04}
            source = "PROCEDURAL SYNTHETIC DEM (offline fallback) — SIMULATED"
            
    # Subsample to 256x256 for optimal 60fps simulation balance
    dem = dem512.reshape(256, 2, 256, 2).mean(axis=(1, 3))
    lat = aoi["center"][0]
    cs = 156543.03392 * math.cos(math.radians(lat)) / (2 ** Z) * 2.0
    slope, aspect, recv, acc, twi = derive_terrain(dem, cs)
    
    checksum = hashlib.sha256(dem.astype(np.float32).tobytes()).hexdigest()[:16]
    
    terrain_data = {
        "aoi_id": aoi_id,
        "dem": dem,
        "cs": cs,
        "bounds": bounds,
        "slope": slope,
        "aspect": aspect,
        "recv": recv,
        "acc": acc,
        "twi": twi,
        "source": source,
        "checksum": checksum
    }
    _cache[aoi_id] = terrain_data
    return terrain_data

def latlon_to_cell(t: dict, lat: float, lon: float) -> Optional[tuple[int, int]]:
    b = t["bounds"]
    n = t["dem"].shape[0]
    y_top = _tile_xy(b["north"], b["west"], Z)[1]
    y_bot = _tile_xy(b["south"], b["west"], Z)[1]
    x = (lon - b["west"]) / (b["east"] - b["west"]) * n
    y = (_tile_xy(lat, lon, Z)[1] - y_top) / (y_bot - y_top) * n
    r, c = int(y), int(x)
    if 0 <= r < n and 0 <= c < n:
        return r, c
    return None

def b64(arr_u8: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(arr_u8, dtype=np.uint8).tobytes()).decode("utf-8")

def terrain_summary(t: dict) -> dict:
    s = t["slope"]
    return {
        "cell_size_m": round(t["cs"], 1),
        "grid": list(t["dem"].shape),
        "bounds": t["bounds"],
        "elev_min_m": round(float(t["dem"].min())),
        "elev_max_m": round(float(t["dem"].max())),
        "mean_slope_deg": round(float(s.mean()), 1),
        "pct_slope_gt_30": round(float((s > 30).mean() * 100), 1),
        "pct_slope_gt_40": round(float((s > 40).mean() * 100), 1),
        "dem_source": t["source"],
        "dem_checksum": t["checksum"]
    }
