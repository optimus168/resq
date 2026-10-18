import asyncio
from datetime import datetime
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

router = APIRouter(prefix="/aois", tags=["Geospatial & Terrain"])

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

@router.get("")
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

@router.get("/{aoi_id}")
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

@router.get("/{aoi_id}/grid")
async def get_aoi_grid(aoi_id: str):
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
