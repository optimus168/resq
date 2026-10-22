import asyncio
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
import numpy as np
from backend.app.geospatial.terrain import (
    AOIS,
    ASSET_NOTE,
    load_terrain,
    terrain_summary,
    b64
)
from backend.app.core.security import now_iso

router = APIRouter(tags=["Geospatial & Terrain"])

def aoi_to_geojson(aoi: dict) -> dict:
    features = []
    for v in aoi["villages"]:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [v["lon"], v["lat"]]},
            "properties": {**v, "kind": "village"}
        })
    for r in aoi["roads"]:
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": r["coords"]},
            "properties": {"id": r["id"], "name": r["name"], "kind": "road", "road_kind": r["kind"]}
        })
    for k in ("shelters", "hospitals"):
        for f in aoi[k]:
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [f["lon"], f["lat"]]},
                "properties": {**f, "kind": k[:-1]}
            })
    return {"type": "FeatureCollection", "features": features}

@router.get("/aois")
@router.get("/terrain/aoi")
async def list_aois():
    return [
        {
            "id": k,
            "name": a["name"],
            "state": a["state"],
            "district": a["district"],
            "center": a["center"]
        }
        for k, a in AOIS.items()
    ]

@router.get("/aois/{aoi_id}")
@router.get("/terrain/aoi/{aoi_id}")
async def get_aoi(aoi_id: str):
    if aoi_id not in AOIS:
        raise HTTPException(status_code=404, detail="AOI not found in catalogue")
    aoi = AOIS[aoi_id]
    terrain = await asyncio.to_thread(load_terrain, aoi_id)
    return {
        "id": aoi_id,
        "name": aoi["name"],
        "state": aoi["state"],
        "district": aoi["district"],
        "center": aoi["center"],
        "history": aoi["history"],
        "shelters": aoi["shelters"],
        "hospitals": aoi["hospitals"],
        "villages": aoi["villages"],
        "roads": [{"id": r["id"], "name": r["name"], "kind": r["kind"]} for r in aoi["roads"]],
        "geojson": aoi_to_geojson(aoi),
        "terrain": terrain_summary(terrain),
        "asset_note": ASSET_NOTE,
        "simulated": True
    }

@router.get("/aois/{aoi_id}/grid")
@router.get("/terrain/grid/{aoi_id}")
async def get_aoi_grid(aoi_id: str, res: int = 64):
    """Returns quantized terrain parameters for client-side Web Worker Factor of Safety calculation."""
    if aoi_id not in AOIS:
        raise HTTPException(status_code=404, detail="AOI not found")
    t = await asyncio.to_thread(load_terrain, aoi_id)
    twi = t["twi"]
    twi_w = np.clip(twi / np.mean(twi), 0.4, 2.0)
    
    return {
        "shape": list(t["slope"].shape),
        "bounds": t["bounds"],
        "slope_q": b64(np.clip(np.round(t["slope"] * 4.0), 0, 255)),
        "twi_w_q": b64(np.clip(np.round(twi_w * 100.0), 0, 255)),
        "encoding": {"slope_deg": "byte/4.0", "twi_weight": "byte/100.0"},
        "simulated": True
    }

@router.get("/terrain/sensors/{aoi_id}")
@router.get("/aois/{aoi_id}/sensors")
async def get_sensors(aoi_id: str, anomaly: bool = False):
    from backend.app.integrations.sensors import simulate_sensors
    if aoi_id not in AOIS:
        raise HTTPException(status_code=404, detail="AOI not found")
    return simulate_sensors(aoi_id, anomaly=anomaly)

TWINS_DIR = Path("data/twins")

@router.get("/twins/{aoi_id}/manifest")
async def get_twin_manifest(aoi_id: str):
    f = TWINS_DIR / aoi_id / "manifest.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Digital twin manifest not found for AOI")
    import json
    with open(f) as fp:
        return json.load(fp)

@router.get("/twins/{aoi_id}/infrastructure")
async def get_twin_infrastructure(aoi_id: str):
    f = TWINS_DIR / aoi_id / "infrastructure.geojson"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Twin infrastructure GeoJSON not found")
    import json
    with open(f) as fp:
        return json.load(fp)

@router.get("/twins/{aoi_id}/buildings")
async def get_twin_buildings(aoi_id: str):
    f = TWINS_DIR / aoi_id / "buildings.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Twin buildings data not found")
    import json
    with open(f) as fp:
        return json.load(fp)

@router.get("/twins/{aoi_id}/trees")
async def get_twin_trees(aoi_id: str):
    f = TWINS_DIR / aoi_id / "trees.json"
    if not f.exists():
        raise HTTPException(status_code=404, detail="Twin trees data not found")
    import json
    with open(f) as fp:
        return json.load(fp)

@router.get("/twins/{aoi_id}/files/{filename}")
async def get_twin_file(aoi_id: str, filename: str):
    from fastapi.responses import FileResponse
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    f = TWINS_DIR / aoi_id / filename
    if not f.exists():
        raise HTTPException(status_code=404, detail="Twin file not found")
    media_type = "image/jpeg" if filename.endswith((".jpg", ".jpeg")) else "image/png" if filename.endswith(".png") else "application/octet-stream"
    return FileResponse(f, media_type=media_type)

TILES_ROOT = Path("data/tiles")
WEB_TILES_ROOT = Path("apps/web/public/tiles")

@router.get("/tiles/terrain/{z}/{x}/{y}.png")
async def get_terrain_tile(z: int, x: int, y: int):
    from fastapi.responses import FileResponse
    for base in (TILES_ROOT, WEB_TILES_ROOT):
        p = base / "terrain" / str(z) / str(x) / f"{y}.png"
        if p.exists():
            return FileResponse(p, media_type="image/png")
    fallback = WEB_TILES_ROOT / "terrain" / "fallback.png"
    if fallback.exists():
        return FileResponse(fallback, media_type="image/png")
    raise HTTPException(status_code=404, detail="Tile not found")

@router.get("/tiles/satellite/{z}/{x}/{y}.jpg")
async def get_satellite_tile(z: int, x: int, y: int):
    from fastapi.responses import FileResponse
    for base in (TILES_ROOT, WEB_TILES_ROOT):
        p = base / "satellite" / str(z) / str(x) / f"{y}.jpg"
        if p.exists():
            return FileResponse(p, media_type="image/jpeg")
    fallback = WEB_TILES_ROOT / "satellite" / "fallback.jpg"
    if fallback.exists():
        return FileResponse(fallback, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Tile not found")

