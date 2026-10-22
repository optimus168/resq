from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.terraguard.database.database import get_db
from backend.app.terraguard.database.models import HazardZoneModel
from backend.app.terraguard.routers.ml_model import LocationRiskRequest, compute_location_risk

router = APIRouter(prefix="/api/map", tags=["GIS Map Layers"])


NORTHEAST_STATE_POLYGONS: Dict[str, List[List[List[float]]]] = {
    "sikkim": [[[88.0, 27.0], [88.9, 27.0], [88.9, 28.5], [88.0, 28.5], [88.0, 27.0]]],
    "assam": [[[90.0, 24.0], [96.0, 24.0], [96.0, 28.5], [90.0, 28.5], [90.0, 24.0]]],
    "meghalaya": [[[90.7, 24.6], [92.1, 24.6], [92.1, 26.1], [90.7, 26.1], [90.7, 24.6]]],
    "arunachal": [[[91.5, 26.5], [97.0, 26.5], [97.0, 29.5], [91.5, 29.5], [91.5, 26.5]]],
    "manipur": [[[93.2, 23.5], [94.8, 23.5], [94.8, 25.8], [93.2, 25.8], [93.2, 23.5]]],
    "nagaland": [[[93.3, 25.2], [95.3, 25.2], [95.3, 27.0], [93.3, 27.0], [93.3, 25.2]]],
    "mizoram": [[[92.2, 21.9], [93.5, 21.9], [93.5, 24.5], [92.2, 24.5], [92.2, 21.9]]],
    "tripura": [[[91.0, 22.9], [92.5, 22.9], [92.5, 24.6], [91.0, 24.6], [91.0, 22.9]]],
}


def _parse_coord_string(coord_text: str) -> Optional[Tuple[float, float]]:
    try:
        cleaned = coord_text.replace("°", "").replace("N", "").replace("S", "").replace("E", "").replace("W", "").strip()
        lat_text, lon_text = [part.strip() for part in cleaned.split(",")[:2]]
        lat = float(lat_text)
        lon = float(lon_text)
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon
    except Exception:
        return None
    return None


def _risk_level_from_score(score: float) -> str:
    if score >= 75:
        return "VERY_HIGH"
    if score >= 50:
        return "HIGH"
    if score >= 25:
        return "MODERATE"
    return "LOW"


def _point_polygon(lat: float, lon: float, meters: float = 1200.0) -> List[List[float]]:
    lat_offset = meters / 111_000.0
    lon_offset = meters / (111_000.0 * max(0.25, abs(__import__('math').cos(__import__('math').radians(lat)))))
    return [
        [lon - lon_offset, lat - lat_offset],
        [lon + lon_offset, lat - lat_offset],
        [lon + lon_offset, lat + lat_offset],
        [lon - lon_offset, lat + lat_offset],
        [lon - lon_offset, lat - lat_offset],
    ]


def _feature_for_zone(zone: HazardZoneModel, risk_score: float, risk_level: str) -> Dict[str, Any]:
    coords = _parse_coord_string(zone.coords)
    center = coords if coords else (27.5312, 88.5134)
    polygon = _point_polygon(center[0], center[1], meters=1800.0)
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [polygon],
        },
        "properties": {
            "risk_score": float(risk_score),
            "risk_level": risk_level,
            "state": zone.state,
            "district": zone.subDivision,
            "updated_at": "live",
            "source": "TerraGuard",
            "zone_id": zone.id,
            "name": zone.name,
            "corridor": zone.corridor,
        },
    }


@router.get("/risk-polygons")
def get_risk_polygons(
    state: Optional[str] = Query(None, description="Optional NER state filter"),
    db: Session = Depends(get_db),
):
    """Return a GeoJSON FeatureCollection for live risk polygons derived from TerraGuard hazard zones."""
    query = db.query(HazardZoneModel)
    if state and state.lower() != "all":
        query = query.filter(HazardZoneModel.state == state.lower())

    features: List[Dict[str, Any]] = []
    for zone in query.all():
        try:
            parsed_lat, parsed_lon = _parse_coord_string(zone.coords) or (27.5312, 88.5134)
            risk_eval = compute_location_risk(
                LocationRiskRequest(
                    name=zone.name,
                    location_type="region",
                    latitude=parsed_lat,
                    longitude=parsed_lon,
                    state=zone.state,
                    elevation=float(str(zone.elevation).replace(",", "").replace("m", "").strip() or "1200"),
                    slope=float(str(zone.slopeGradient).replace("°", "").strip() or "35"),
                    aspect=180.0,
                    soil_id="4276.0",
                    landcover_class="50.0",
                    extra_rainfall=0.0,
                )
            )
            risk_score = float(risk_eval.get("final_risk_score", 0.0) or 0.0)
            risk_level = str(risk_eval.get("risk_level", _risk_level_from_score(risk_score))).upper()
        except Exception:
            risk_score = float(zone.hazardScore or 0.0) * 10.0
            risk_level = _risk_level_from_score(risk_score)

        features.append(_feature_for_zone(zone, risk_score, risk_level))

    return {
        "type": "FeatureCollection",
        "features": features,
    }


@router.get("/boundaries")
def get_boundaries(
    level: str = Query("state", description="state or district"),
    state: Optional[str] = Query(None, description="Optional state filter"),
):
    """Return lightweight administrative boundary polygons for NER context. These are representative map overlays, not a replacement for authoritative datasets."""
    requested_level = (level or "state").lower()
    state_filter = (state or "all").lower()

    if requested_level != "state":
        return {"type": "FeatureCollection", "features": []}

    features: List[Dict[str, Any]] = []
    for key, polygons in NORTHEAST_STATE_POLYGONS.items():
        if state_filter != "all" and key != state_filter:
            continue
        for index, polygon in enumerate(polygons):
            ring = [[point[0], point[1]] for point in polygon] if polygon else []
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [ring],
                },
                "properties": {
                    "state": key,
                    "state_code": key.upper(),
                    "district": f"Boundary Context {index + 1}",
                    "district_code": f"{key.upper()}-{index + 1:02d}",
                    "level": "state",
                    "source": "TerraGuard boundary context",
                },
            })

    return {"type": "FeatureCollection", "features": features}


@router.get("/reports")
def get_map_reports(
    state: Optional[str] = Query(None, description="Filter by state"),
    db: Session = Depends(get_db),
):
    """Return report coordinates in GeoJSON format for lower overhead map rendering."""
    from backend.app.terraguard.database.models import CrowdsourceReportModel

    query = db.query(CrowdsourceReportModel)
    if state and state.lower() != "all":
        query = query.filter(CrowdsourceReportModel.state == state.lower())

    features: List[Dict[str, Any]] = []
    for report in query.order_by(CrowdsourceReportModel.reportedTime.desc()).all():
        if report.latitude is None or report.longitude is None:
            continue
        properties = {
            "id": report.id,
            "location": report.location,
            "state": report.state,
            "classification": report.classification or report.aiClassificationStatus or "pending",
            "confidence": report.confidence,
            "severity": report.urgency,
            "timestamp": report.reportedTime,
            "description": report.description,
            "source": "citizen_report",
        }
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [report.longitude, report.latitude]},
            "properties": properties,
        })

    return {"type": "FeatureCollection", "features": features}


@router.get("/fault-lines")
def get_fault_lines():
    """Return major geological fault lines and tectonic thrusts in the North Eastern Region."""
    faults = [
        {
            "name": "Main Central Thrust (MCT)",
            "type": "Major Thrust Fault",
            "slip_rate_mm_yr": 18.0,
            "depth_km": 15,
            "seismic_zone": "Zone V",
            "coords": [[88.2, 27.8], [89.5, 27.9], [91.2, 28.1], [93.0, 28.3], [95.5, 28.5]]
        },
        {
            "name": "Main Boundary Thrust (MBT)",
            "type": "Frontal Thrust Fault",
            "slip_rate_mm_yr": 14.5,
            "depth_km": 12,
            "seismic_zone": "Zone V",
            "coords": [[88.0, 27.1], [89.8, 27.0], [91.5, 27.2], [93.8, 27.4], [96.0, 27.8]]
        },
        {
            "name": "Dauki Fault",
            "type": "Strike-Slip / Reverse Fault",
            "slip_rate_mm_yr": 8.0,
            "depth_km": 20,
            "seismic_zone": "Zone V",
            "coords": [[90.1, 25.18], [91.0, 25.15], [91.8, 25.12], [92.6, 25.08]]
        },
        {
            "name": "Kopili Fault Zone",
            "type": "NW-SE Transverse Strike-Slip",
            "slip_rate_mm_yr": 5.2,
            "depth_km": 35,
            "seismic_zone": "Zone V",
            "coords": [[92.4, 25.5], [92.8, 26.0], [93.2, 26.5], [93.6, 27.0]]
        },
        {
            "name": "Naga Thrust & Disang Thrust",
            "type": "Schuppen Belt Imbricate Thrust",
            "slip_rate_mm_yr": 6.8,
            "depth_km": 10,
            "seismic_zone": "Zone V",
            "coords": [[93.5, 25.6], [94.2, 26.2], [95.0, 26.8], [95.8, 27.2]]
        },
        {
            "name": "Mishmi Thrust",
            "type": "Eastern Himalayan Syntaxis Thrust",
            "slip_rate_mm_yr": 12.0,
            "depth_km": 18,
            "seismic_zone": "Zone V",
            "coords": [[95.2, 27.8], [96.0, 28.2], [96.8, 28.6], [97.2, 28.9]]
        }
    ]

    features = []
    for f in faults:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": f["coords"]
            },
            "properties": {
                "name": f["name"],
                "fault_type": f["type"],
                "slip_rate_mm_yr": f["slip_rate_mm_yr"],
                "depth_km": f["depth_km"],
                "seismic_zone": f["seismic_zone"],
                "source": "GSI & Seismotectonic Atlas of India"
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/heatmap")
def get_compound_heatmap(db: Session = Depends(get_db)):
    """Return unified heatmap points combining historical landslide events and recent earthquake triggers."""
    from backend.app.terraguard.routers.susceptibility import load_training_events
    from backend.app.terraguard.services.earthquake_service import earthquake_service

    points = []

    # 1. Landslide ground truth events
    events = load_training_events()
    for evt in events:
        points.append({
            "lat": evt.get("lat", 27.0),
            "lng": evt.get("lon", 88.5),
            "weight": min(1.0, max(0.2, (evt.get("rainfall_3d", 50.0) or 50.0) / 250.0)),
            "type": "landslide",
            "intensity": evt.get("rainfall_3d", 0.0),
            "label": f"Landslide: {evt.get('state', '').title()} ({evt.get('date', 'Historical')})"
        })

    # 2. Earthquake epicenter points
    try:
        eq_data = earthquake_service.get_earthquakes(latitude=26.0, longitude=92.5, radius_km=600)
        for eq in eq_data.get("events", []):
            mag = float(eq.get("magnitude", 3.0))
            weight = min(1.0, max(0.3, mag / 7.0))
            points.append({
                "lat": float(eq.get("latitude", 26.0)),
                "lng": float(eq.get("longitude", 92.5)),
                "weight": weight,
                "type": "earthquake",
                "intensity": mag,
                "label": f"Earthquake M{mag}: {eq.get('location', 'NER')} ({eq.get('depth_km', 10)}km)"
            })
    except Exception:
        pass

    # 3. Hazard zones susceptibility points
    zones = db.query(HazardZoneModel).all()
    for z in zones:
        coords = _parse_coord_string(z.coords)
        if coords:
            points.append({
                "lat": coords[0],
                "lng": coords[1],
                "weight": min(1.0, max(0.25, (z.hazardScore or 5.0) / 10.0)),
                "type": "zone_susceptibility",
                "intensity": z.hazardScore or 5.0,
                "label": f"Zone: {z.name} ({z.corridor})"
            })

    return {
        "status": "success",
        "total_points": len(points),
        "breakdown": {
            "landslides": len([p for p in points if p["type"] == "landslide"]),
            "earthquakes": len([p for p in points if p["type"] == "earthquake"]),
            "zones": len([p for p in points if p["type"] == "zone_susceptibility"])
        },
        "points": points
    }

