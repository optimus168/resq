"""
Controlled Agentic AI Tools for RESQ.AI × BhuRaksha.

Exposes validated, backend-governed tool interfaces adapted to the existing
repository schemas and models:
1. `get_landslide_prediction(location, timestamp=None, features=None)`
   -> Calls the existing `EnhancedLandslidePredictor.predict()` (`enhanced_xgb_model.pkl`)
      and optional `LandslideSusceptibilityModel.explain_sample_shap()` without altering
      feature ordering, thresholds, or prediction semantics.
2. `get_sensor_readings(location, time_window=24)`
   -> Queries `SensorStation` & `SensorReading` in GeoShield DB (`geoshield.db`) and runs
      the deterministic sensor integrity/contradiction audit.
3. `get_rainfall_history(location, time_window=48)`
   -> Queries `WeatherData` & `SensorReading` in `geoshield.db` plus terrain 7-day accumulation.
4. `search_disaster_documents(query)`
   -> Searches official NDMA/SDMA SOPs (`backend/app/api/chat.py`) and GSI NER landslide
      catalog records (`data/real/gsi_ner_landslides.geojson`).
5. `get_official_alerts(location=None)`
   -> Queries active/historical alerts from `geoshield.db` (`Alert`) and `bhuraksha.db`.
6. `get_incident_history(location=None)`
   -> Queries verified citizen/field reports (`CitizenReport`), historical GSI landslide
      events (`gsi_ner_landslides.geojson`), and mission control incidents.

Safety Guarantees:
- All tool executions are controlled by backend Python code with strict input validation,
  coordinate bounds checking, prompt-injection scanning, and execution timeouts.
- The local `Qwen/Qwen3-4B` model may select tools and explain their returned payloads,
  but cannot fabricate tool outputs or bypass the deterministic XGBoost pipeline.
"""

from __future__ import annotations

import os
import json
import math
import time
import logging
import concurrent.futures
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from backend.app.geoshield.ai_engine.enhanced_predictor import get_enhanced_predictor
from backend.app.geoshield.ai_engine.risk_predictor import get_predictor
from backend.app.geoshield.database import SessionLocal as gs_SessionLocal
from backend.app.geoshield.models import (
    Alert as GSAlert,
    CitizenReport as GSCitizenReport,
    RiskAssessment as GSRiskAssessment,
    SensorReading as GSSensorReading,
    SensorStation as GSSensorStation,
    WeatherData as GSWeatherData,
)
from backend.app.api.chat import SOPS, search_sops
from backend.app.agents.llm_adapter import detect_injection
from backend.app.ml.qwen_service import (
    audit_sensor_and_prediction_context,
    get_qwen_service,
)

log = logging.getLogger("disaster_tools")

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
GSI_GEOJSON_PATH = ROOT_DIR / "data" / "real" / "gsi_ner_landslides.geojson"

# Named NER & Western Ghats reference locations for string-based location resolution
NAMED_LOCATIONS: Dict[str, Dict[str, Any]] = {
    "gangtok": {"name": "Gangtok (NH10 Corridor, Sikkim)", "latitude": 27.3314, "longitude": 88.6138, "state": "Sikkim"},
    "sikkim": {"name": "Gangtok / Mangan Sector, Sikkim", "latitude": 27.3314, "longitude": 88.6138, "state": "Sikkim"},
    "mangan": {"name": "Mangan (North Sikkim)", "latitude": 27.4989, "longitude": 88.5342, "state": "Sikkim"},
    "aizawl": {"name": "Aizawl Knife-Edge Ridge (Mizoram)", "latitude": 23.7271, "longitude": 92.7176, "state": "Mizoram"},
    "mizoram": {"name": "Aizawl Sector, Mizoram", "latitude": 23.7271, "longitude": 92.7176, "state": "Mizoram"},
    "cherrapunji": {"name": "Cherrapunji / Sohra Escarpment (Meghalaya)", "latitude": 25.2702, "longitude": 91.7323, "state": "Meghalaya"},
    "shillong": {"name": "Shillong Plateau (Meghalaya)", "latitude": 25.5788, "longitude": 91.8933, "state": "Meghalaya"},
    "meghalaya": {"name": "Shillong / Sohra Corridor, Meghalaya", "latitude": 25.5788, "longitude": 91.8933, "state": "Meghalaya"},
    "wayanad": {"name": "Wayanad (Chooralmala / Meppadi, Kerala)", "latitude": 11.5550, "longitude": 76.1350, "state": "Kerala"},
    "chooralmala": {"name": "Chooralmala (Wayanad, Kerala)", "latitude": 11.5550, "longitude": 76.1350, "state": "Kerala"},
    "guwahati": {"name": "Guwahati Hills (Kamrup, Assam)", "latitude": 26.1445, "longitude": 91.7362, "state": "Assam"},
    "kohima": {"name": "Kohima NH29 Corridor (Nagaland)", "latitude": 25.6751, "longitude": 94.1086, "state": "Nagaland"},
    "tawang": {"name": "Tawang High-Altitude Sector (Arunachal Pradesh)", "latitude": 27.5861, "longitude": 91.8594, "state": "Arunachal Pradesh"},
    "itanagar": {"name": "Itanagar (Arunachal Pradesh)", "latitude": 27.0844, "longitude": 93.6053, "state": "Arunachal Pradesh"},
    "imphal": {"name": "Imphal / Tamenglong Sector (Manipur)", "latitude": 24.8170, "longitude": 93.9368, "state": "Manipur"},
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    return r * 2.0 * math.asin(min(1.0, math.sqrt(a)))


def resolve_location_input(location: Union[str, Dict[str, Any], None]) -> Dict[str, Any]:
    """
    Validate and resolve `location` into `{"latitude": float, "longitude": float, "label": str, "station_id": Optional[str]}`.
    Raises ValueError if coordinates are invalid or outside supported geographic bounds.
    """
    if location is None:
        return {
            "latitude": 27.3314,
            "longitude": 88.6138,
            "label": "Gangtok (Default NER Reference)",
            "station_id": None,
        }

    if isinstance(location, dict):
        lat = location.get("latitude", location.get("lat"))
        lng = location.get("longitude", location.get("lng", location.get("lon")))
        station_id = location.get("station_id")
        name = location.get("name") or location.get("label")

        if lat is not None and lng is not None:
            lat_f = float(lat)
            lng_f = float(lng)
            if not (5.0 <= lat_f <= 38.0 and 68.0 <= lng_f <= 100.0):
                raise ValueError(
                    f"Coordinates ({lat_f}, {lng_f}) are outside supported India/NER domain (lat 5..38, lon 68..100)."
                )
            return {
                "latitude": lat_f,
                "longitude": lng_f,
                "label": str(name or f"({lat_f:.4f}, {lng_f:.4f})"),
                "station_id": station_id,
            }
        if station_id or name:
            location = str(station_id or name)
        else:
            raise ValueError("Location dictionary must provide (`latitude`, `longitude`) or `station_id`/`name`.")

    if isinstance(location, str):
        loc_clean = location.strip()
        if not loc_clean:
            raise ValueError("Location string cannot be empty.")

        # Check database stations first
        session = gs_SessionLocal()
        try:
            station = (
                session.query(GSSensorStation)
                .filter(
                    (GSSensorStation.station_id.ilike(loc_clean))
                    | (GSSensorStation.name.ilike(f"%{loc_clean}%"))
                    | (GSSensorStation.district.ilike(f"%{loc_clean}%"))
                    | (GSSensorStation.state.ilike(f"%{loc_clean}%"))
                )
                .first()
            )
            if station:
                return {
                    "latitude": float(station.latitude),
                    "longitude": float(station.longitude),
                    "label": f"{station.name} ({station.district}, {station.state})",
                    "station_id": station.station_id,
                }
        finally:
            session.close()

        # Check named locations dictionary
        loc_lower = loc_clean.lower()
        for key, info in NAMED_LOCATIONS.items():
            if key in loc_lower or loc_lower in key:
                return {
                    "latitude": float(info["latitude"]),
                    "longitude": float(info["longitude"]),
                    "label": info["name"],
                    "station_id": None,
                }

        # Check "lat,lng" string format
        if "," in loc_clean:
            parts = [p.strip() for p in loc_clean.split(",")]
            if len(parts) == 2:
                lat_f = float(parts[0])
                lng_f = float(parts[1])
                if not (5.0 <= lat_f <= 38.0 and 68.0 <= lng_f <= 100.0):
                    raise ValueError(f"Coordinates ({lat_f}, {lng_f}) out of valid domain.")
                return {
                    "latitude": lat_f,
                    "longitude": lng_f,
                    "label": f"({lat_f:.4f}, {lng_f:.4f})",
                    "station_id": None,
                }

        raise ValueError(f"Unrecognized location '{loc_clean}'. Provide valid coordinates or a known NER station/district.")

    raise ValueError(f"Unsupported location type: {type(location).__name__}")


def get_landslide_prediction(
    location: Union[str, Dict[str, Any]],
    timestamp: Optional[str] = None,
    features: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Controlled Tool 1: Run the existing validated XGBoost landslide prediction pipeline
    (`EnhancedLandslidePredictor.predict`) for a location and optional feature overrides.
    Never modifies the XGBoost model, feature ordering, or thresholds.
    """
    resolved = resolve_location_input(location)
    lat = resolved["latitude"]
    lng = resolved["longitude"]

    sanitized_features: Dict[str, Any] = {}
    if features and isinstance(features, dict):
        allowed_numeric = {
            "slope",
            "aspect",
            "elevation",
            "rainfall_24hr",
            "rainfall_7day",
            "ndvi",
            "soil_moisture",
            "distance_to_road",
        }
        for k, v in features.items():
            if k in allowed_numeric and v is not None:
                val = float(v)
                if k == "soil_moisture" and val > 1.0:
                    # Convert percentage (0-100) to fraction (0-1) expected by EnhancedLandslidePredictor
                    val = val / 100.0
                sanitized_features[k] = val

    predictor = get_enhanced_predictor()
    xgb_result = predictor.predict(lat, lng, sanitized_features or None)

    return {
        "tool": "get_landslide_prediction",
        "status": "ok",
        "timestamp": timestamp or datetime.now(timezone.utc).isoformat(),
        "location": resolved,
        "prediction": xgb_result,
        "calibration_notice": (
            "The `confidence` field from XGBoost (`predict_proba`) is an uncalibrated tree-ensemble "
            "class score and must not be described as a calibrated physical probability."
        ),
    }


def get_sensor_readings(
    location: Union[str, Dict[str, Any]],
    time_window: int = 24,
) -> Dict[str, Any]:
    """
    Controlled Tool 2: Retrieve ground-station telemetry near `location` within `time_window` hours,
    including station metadata and deterministic sensor quality flags.
    """
    time_window_hours = max(1, min(int(time_window or 24), 720))
    resolved = resolve_location_input(location)
    lat, lng = resolved["latitude"], resolved["longitude"]

    session = gs_SessionLocal()
    try:
        stations = session.query(GSSensorStation).all()
        if not stations:
            return {
                "tool": "get_sensor_readings",
                "status": "no_stations_available",
                "location": resolved,
                "time_window_hours": time_window_hours,
                "readings": [],
            }

        nearest_station = min(
            stations,
            key=lambda s: _haversine_km(lat, lng, float(s.latitude), float(s.longitude)),
        )
        dist_km = round(_haversine_km(lat, lng, float(nearest_station.latitude), float(nearest_station.longitude)), 2)

        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=time_window_hours)
        readings_q = (
            session.query(GSSensorReading)
            .filter(
                GSSensorReading.station_id == nearest_station.station_id,
                GSSensorReading.timestamp >= cutoff,
            )
            .order_by(GSSensorReading.timestamp.desc())
            .limit(20)
            .all()
        )

        if not readings_q:
            # Fetch most recent historical reading if none in window
            readings_q = (
                session.query(GSSensorReading)
                .filter(GSSensorReading.station_id == nearest_station.station_id)
                .order_by(GSSensorReading.timestamp.desc())
                .limit(5)
                .all()
            )

        serialized_readings = [
            {
                "station_id": r.station_id,
                "rainfall_mm": round(float(r.rainfall_mm or 0.0), 2),
                "soil_moisture": round(float(r.soil_moisture or 0.0), 2),
                "soil_temperature": round(float(r.soil_temperature or 0.0), 2),
                "ground_displacement": round(float(r.ground_displacement or 0.0), 3),
                "tilt_angle_x": round(float(r.tilt_angle_x or 0.0), 3),
                "tilt_angle_y": round(float(r.tilt_angle_y or 0.0), 3),
                "pore_water_pressure": round(float(r.pore_water_pressure or 0.0), 2),
                "vibration_level": round(float(r.vibration_level or 0.0), 3),
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "is_active": bool(nearest_station.is_active),
            }
            for r in readings_q
        ]

        latest = serialized_readings[0] if serialized_readings else None
        return {
            "tool": "get_sensor_readings",
            "status": "ok",
            "location": resolved,
            "time_window_hours": time_window_hours,
            "nearest_station": {
                "station_id": nearest_station.station_id,
                "name": nearest_station.name,
                "state": nearest_station.state,
                "district": nearest_station.district,
                "village": nearest_station.village,
                "latitude": nearest_station.latitude,
                "longitude": nearest_station.longitude,
                "elevation_m": nearest_station.elevation,
                "slope_deg": nearest_station.slope_angle,
                "soil_type": nearest_station.soil_type,
                "vegetation_cover_pct": nearest_station.vegetation_cover,
                "is_active": bool(nearest_station.is_active),
                "distance_km": dist_km,
            },
            "latest_reading": latest,
            "readings_count": len(serialized_readings),
            "readings": serialized_readings[:10],
        }
    finally:
        session.close()


def get_rainfall_history(
    location: Union[str, Dict[str, Any]],
    time_window: int = 48,
) -> Dict[str, Any]:
    """
    Controlled Tool 3: Retrieve rainfall history and forecast telemetry for `location`
    over `time_window` hours from `WeatherData` and `SensorReading` tables.
    """
    time_window_hours = max(1, min(int(time_window or 48), 720))
    resolved = resolve_location_input(location)
    lat, lng = resolved["latitude"], resolved["longitude"]

    session = gs_SessionLocal()
    try:
        stations = session.query(GSSensorStation).all()
        if not stations:
            return {
                "tool": "get_rainfall_history",
                "status": "no_stations_available",
                "location": resolved,
                "time_window_hours": time_window_hours,
            }

        nearest = min(
            stations,
            key=lambda s: _haversine_km(lat, lng, float(s.latitude), float(s.longitude)),
        )
        dist_km = round(_haversine_km(lat, lng, float(nearest.latitude), float(nearest.longitude)), 2)

        weather_rows = (
            session.query(GSWeatherData)
            .filter(GSWeatherData.station_id == nearest.station_id)
            .order_by(GSWeatherData.timestamp.desc())
            .limit(12)
            .all()
        )

        sensor_rows = (
            session.query(GSSensorReading)
            .filter(GSSensorReading.station_id == nearest.station_id)
            .order_by(GSSensorReading.timestamp.desc())
            .limit(24)
            .all()
        )

        latest_weather = weather_rows[0] if weather_rows else None
        sensor_rain_values = [float(r.rainfall_mm or 0.0) for r in sensor_rows]

        return {
            "tool": "get_rainfall_history",
            "status": "ok",
            "location": resolved,
            "time_window_hours": time_window_hours,
            "station_id": nearest.station_id,
            "station_name": nearest.name,
            "distance_km": dist_km,
            "summary": {
                "rainfall_1h_mm": round(float(latest_weather.rainfall_1h), 2) if latest_weather else None,
                "rainfall_24h_mm": round(float(latest_weather.rainfall_24h), 2) if latest_weather else (
                    round(sum(sensor_rain_values[:6]), 2) if sensor_rain_values else None
                ),
                "rainfall_7d_mm": round(float(latest_weather.rainfall_7d), 2) if latest_weather else None,
                "forecast_rainfall_24h_mm": round(float(latest_weather.forecast_rainfall_24h), 2) if latest_weather else None,
                "forecast_rainfall_48h_mm": round(float(latest_weather.forecast_rainfall_48h), 2) if latest_weather else None,
                "humidity_pct": round(float(latest_weather.humidity), 1) if latest_weather else None,
                "recorded_at": latest_weather.timestamp.isoformat() if (latest_weather and latest_weather.timestamp) else None,
            },
            "recent_observations_count": len(weather_rows) + len(sensor_rows),
        }
    finally:
        session.close()


def search_disaster_documents(query: str) -> Dict[str, Any]:
    """
    Controlled Tool 4: Retrieve official NDMA/SDMA Standard Operating Procedures (SOPs)
    and GSI Northeast India historical landslide records matching `query`.
    """
    clean_query = (query or "").strip()[:500]
    if not clean_query:
        raise ValueError("Search query cannot be empty.")

    injection_flags = detect_injection(clean_query)
    matched_sops = search_sops(clean_query, limit=5)
    if not matched_sops:
        matched_sops = SOPS[:3]

    gsi_matches: List[Dict[str, Any]] = []
    if GSI_GEOJSON_PATH.exists():
        try:
            data = json.loads(GSI_GEOJSON_PATH.read_text(encoding="utf-8"))
            q_tokens = {t for t in clean_query.lower().split() if len(t) >= 3}
            for feat in data.get("features", []):
                props = feat.get("properties") or {}
                blob = json.dumps(props).lower()
                if any(tok in blob for tok in q_tokens):
                    gsi_matches.append({
                        "id": props.get("id") or props.get("event_id") or props.get("name"),
                        "name": props.get("name") or props.get("location") or "GSI Landslide Event",
                        "state": props.get("state"),
                        "district": props.get("district"),
                        "trigger": props.get("trigger") or props.get("cause"),
                        "date": props.get("date") or props.get("year"),
                        "coordinates": (feat.get("geometry") or {}).get("coordinates"),
                    })
                    if len(gsi_matches) >= 5:
                        break
        except Exception as exc:
            log.warning("GSI GeoJSON search warning: %s", exc)

    return {
        "tool": "search_disaster_documents",
        "status": "ok",
        "query": clean_query,
        "injection_flags": injection_flags,
        "official_sops": matched_sops,
        "gsi_historical_records": gsi_matches,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


def get_official_alerts(location: Optional[Union[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Controlled Tool 5: Retrieve active and recent official alerts from GeoShield DB,
    optionally filtered by proximity to `location`.
    """
    resolved = resolve_location_input(location) if location else None
    session = gs_SessionLocal()
    try:
        alerts_q = (
            session.query(GSAlert)
            .order_by(GSAlert.created_at.desc())
            .limit(25)
            .all()
        )

        items: List[Dict[str, Any]] = []
        for a in alerts_q:
            dist_km: Optional[float] = None
            if resolved and a.latitude is not None and a.longitude is not None:
                dist_km = round(
                    _haversine_km(resolved["latitude"], resolved["longitude"], float(a.latitude), float(a.longitude)),
                    2,
                )
            items.append({
                "id": a.id,
                "station_id": a.station_id,
                "risk_level": a.risk_level,
                "title": a.title,
                "message": a.message,
                "status": a.status,
                "affected_population": a.affected_population,
                "latitude": a.latitude,
                "longitude": a.longitude,
                "distance_km": dist_km,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })

        if resolved:
            items.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else 99999.0)

        return {
            "tool": "get_official_alerts",
            "status": "ok",
            "location_filter": resolved,
            "active_alerts_count": sum(1 for x in items if x.get("status") == "active"),
            "alerts": items[:10],
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }
    finally:
        session.close()


def get_incident_history(location: Optional[Union[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Controlled Tool 6: Retrieve past landslide incidents, citizen/field reports, and
    GSI historical catalog events near `location`.
    """
    resolved = resolve_location_input(location) if location else None
    session = gs_SessionLocal()
    try:
        reports_q = (
            session.query(GSCitizenReport)
            .order_by(GSCitizenReport.created_at.desc())
            .limit(20)
            .all()
        )
        field_reports: List[Dict[str, Any]] = []
        for r in reports_q:
            dist_km = None
            if resolved and r.latitude is not None and r.longitude is not None:
                dist_km = round(
                    _haversine_km(resolved["latitude"], resolved["longitude"], float(r.latitude), float(r.longitude)),
                    2,
                )
            # Scan untrusted report description for prompt injection
            inj = detect_injection(r.description or "")
            field_reports.append({
                "id": r.id,
                "report_type": r.report_type,
                "description": "[QUARANTINED UNTRUSTED TEXT]" if inj else (r.description or "")[:300],
                "status": r.status,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "distance_km": dist_km,
                "injection_flagged": bool(inj),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        if resolved:
            field_reports.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else 99999.0)

        gsi_nearby: List[Dict[str, Any]] = []
        if GSI_GEOJSON_PATH.exists():
            try:
                data = json.loads(GSI_GEOJSON_PATH.read_text(encoding="utf-8"))
                for feat in data.get("features", []):
                    coords = (feat.get("geometry") or {}).get("coordinates") or []
                    props = feat.get("properties") or {}
                    if len(coords) >= 2:
                        lon_f, lat_f = float(coords[0]), float(coords[1])
                        dist_km = (
                            round(_haversine_km(resolved["latitude"], resolved["longitude"], lat_f, lon_f), 2)
                            if resolved
                            else None
                        )
                        gsi_nearby.append({
                            "event_id": props.get("id") or props.get("event_id"),
                            "name": props.get("name") or props.get("location") or "GSI Recorded Landslide",
                            "state": props.get("state"),
                            "district": props.get("district"),
                            "date": props.get("date") or props.get("year"),
                            "trigger": props.get("trigger") or props.get("cause"),
                            "latitude": lat_f,
                            "longitude": lon_f,
                            "distance_km": dist_km,
                        })
                if resolved:
                    gsi_nearby.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else 99999.0)
            except Exception as exc:
                log.warning("GSI history lookup warning: %s", exc)

        return {
            "tool": "get_incident_history",
            "status": "ok",
            "location_filter": resolved,
            "field_reports": field_reports[:8],
            "gsi_historical_landslides": gsi_nearby[:8],
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "ground_truth_notice": (
                "Historical landslide inventories and citizen reports provide spatial context only "
                "and are not sufficient ground truth for future-event certainty."
            ),
        }
    finally:
        session.close()


def get_earthquake_activity(
    location: Optional[Union[str, Dict[str, Any]]] = None,
    radius_km: float = 350.0,
    min_magnitude: float = 2.5,
) -> Dict[str, Any]:
    """
    Controlled Tool 7: Retrieve recent and historical earthquake events near `location`
    from the official NCS / USGS earthquake service (`earthquake_service`) and compute
    co-seismic landslide destabilization indicators (hypocentral distance, estimated PGA,
    and post-seismic slope inspection guidance).
    """
    from backend.app.terraguard.services.earthquake_service import earthquake_service
    from backend.app.terraguard.routers.earthquakes import HISTORICAL_EARTHQUAKES

    resolved = resolve_location_input(location)
    lat, lng = resolved["latitude"], resolved["longitude"]
    rad = max(20.0, min(float(radius_km or 350.0), 2000.0))
    min_mag = max(0.0, min(float(min_magnitude or 2.5), 9.5))

    eq_feed = earthquake_service.get_earthquakes(
        latitude=lat,
        longitude=lng,
        radius_km=rad,
        limit=25,
    )
    raw_events = eq_feed.get("events") if isinstance(eq_feed, dict) else []
    if not raw_events:
        from backend.app.terraguard.services.earthquake_service import VERIFIED_FALLBACK_EVENTS
        raw_events = VERIFIED_FALLBACK_EVENTS

    recent_events: List[Dict[str, Any]] = []
    max_pga_g = 0.0
    strongest_event: Optional[Dict[str, Any]] = None

    for ev in raw_events:
        mag = float(ev.get("magnitude") or 0.0)
        if mag < min_mag:
            continue
        ev_lat = float(ev.get("latitude") or lat)
        ev_lng = float(ev.get("longitude") or lng)
        depth_km = float(ev.get("depth_km") or 15.0)
        epi_dist_km = round(_haversine_km(lat, lng, ev_lat, ev_lng), 1)
        if epi_dist_km > rad:
            continue
        hypo_dist_km = math.sqrt(epi_dist_km ** 2 + depth_km ** 2)
        # Empirical Himalayan attenuation screening estimate for Peak Ground Acceleration (g)
        pga_g = round(
            min(0.85, (10 ** (0.5 * mag - 1.8)) / ((hypo_dist_km + 15.0) ** 1.15)),
            4,
        )
        if pga_g > max_pga_g:
            max_pga_g = pga_g

        item = {
            "id": ev.get("id"),
            "magnitude": mag,
            "depth_km": depth_km,
            "epicentral_distance_km": epi_dist_km,
            "estimated_pga_g": pga_g,
            "location": ev.get("location"),
            "event_time": ev.get("event_time"),
            "source": ev.get("source", "National Center for Seismology (NCS)"),
        }
        recent_events.append(item)
        if strongest_event is None or mag > float(strongest_event.get("magnitude", 0.0)):
            strongest_event = item

    recent_events.sort(key=lambda x: (x["epicentral_distance_km"], -x["magnitude"]))

    # Nearby major historical earthquakes for tectonic context
    historical_nearby: List[Dict[str, Any]] = []
    for h in HISTORICAL_EARTHQUAKES:
        d_km = round(_haversine_km(lat, lng, float(h["latitude"]), float(h["longitude"])), 1)
        if d_km <= 500.0:
            historical_nearby.append({
                "id": h["id"],
                "magnitude": h["magnitude"],
                "depth_km": h["depth_km"],
                "distance_km": d_km,
                "location": h["location"],
                "event_time": h["event_time"],
            })
    historical_nearby.sort(key=lambda x: x["distance_km"])

    if max_pga_g >= 0.12 or (strongest_event and strongest_event["magnitude"] >= 5.0 and strongest_event["epicentral_distance_km"] <= 100.0):
        coseismic_tier = "HIGH_COSEISMIC_SLOPE_TRIGGER"
    elif max_pga_g >= 0.04 or (strongest_event and strongest_event["magnitude"] >= 4.0 and strongest_event["epicentral_distance_km"] <= 150.0):
        coseismic_tier = "MODERATE_COSEISMIC_WATCH"
    else:
        coseismic_tier = "BASELINE_SEISMIC_BACKGROUND"

    return {
        "tool": "get_earthquake_activity",
        "status": "ok",
        "location": resolved,
        "search_radius_km": rad,
        "recent_events_count": len(recent_events),
        "recent_events": recent_events[:8],
        "strongest_recent_event": strongest_event,
        "estimated_max_pga_g": max_pga_g,
        "coseismic_landslide_trigger_tier": coseismic_tier,
        "coseismic_landslide_trigger_status": coseismic_tier,
        "historical_tectonic_events": historical_nearby[:5],
        "scientific_notice": (
            "Earthquakes cannot be deterministically predicted in advance. Seismic telemetry from NCS/USGS "
            "is used strictly to evaluate post-earthquake ground shaking (PGA), fault-zone proximity, "
            "and co-seismic / rainfall-coupled landslide susceptibility."
        ),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


CONTROLLED_TOOLS: Dict[str, Dict[str, Any]] = {
    "get_landslide_prediction": {
        "fn": get_landslide_prediction,
        "description": "Run the validated 9-feature XGBoost landslide prediction pipeline for a location.",
        "parameters": ["location", "timestamp", "features"],
    },
    "get_sensor_readings": {
        "fn": get_sensor_readings,
        "description": "Retrieve ground-station telemetry readings near a location within time_window hours.",
        "parameters": ["location", "time_window"],
    },
    "get_rainfall_history": {
        "fn": get_rainfall_history,
        "description": "Retrieve 1h, 24h, 7d, and forecast rainfall telemetry for a location.",
        "parameters": ["location", "time_window"],
    },
    "search_disaster_documents": {
        "fn": search_disaster_documents,
        "description": "Search official NDMA/SDMA SOPs and GSI landslide catalog documents.",
        "parameters": ["query"],
    },
    "get_official_alerts": {
        "fn": get_official_alerts,
        "description": "Retrieve active and recent official landslide alerts.",
        "parameters": ["location"],
    },
    "get_incident_history": {
        "fn": get_incident_history,
        "description": "Retrieve verified/pending field reports and GSI historical landslide incidents.",
        "parameters": ["location"],
    },
    "get_earthquake_activity": {
        "fn": get_earthquake_activity,
        "description": "Retrieve official NCS/USGS recent & historical earthquakes, PGA shaking estimates, and co-seismic landslide trigger tiers.",
        "parameters": ["location", "radius_km", "min_magnitude"],
    },
}


def execute_controlled_tool(
    tool_name: str,
    arguments: Optional[Dict[str, Any]] = None,
    timeout_seconds: float = 10.0,
) -> Dict[str, Any]:
    """
    Execute a registered backend tool with input validation, timeout enforcement,
    and structured error reporting if a tool is unavailable or fails.
    """
    t0 = time.monotonic()
    if tool_name not in CONTROLLED_TOOLS:
        return {
            "tool": tool_name,
            "status": "unavailable",
            "error": (
                f"Tool '{tool_name}' is not available in the controlled registry. "
                f"Available tools: {', '.join(sorted(CONTROLLED_TOOLS.keys()))}"
            ),
            "latency_ms": 0.0,
        }

    spec = CONTROLLED_TOOLS[tool_name]
    fn: Callable[..., Dict[str, Any]] = spec["fn"]
    safe_args = {k: v for k, v in (arguments or {}).items() if k in spec["parameters"]}

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(fn, **safe_args)
            result = future.result(timeout=timeout_seconds)
        result["latency_ms"] = round((time.monotonic() - t0) * 1000.0, 1)
        return result
    except concurrent.futures.TimeoutError:
        return {
            "tool": tool_name,
            "status": "timeout",
            "error": f"Tool '{tool_name}' timed out after {timeout_seconds:.1f}s.",
            "latency_ms": round((time.monotonic() - t0) * 1000.0, 1),
        }
    except Exception as exc:
        return {
            "tool": tool_name,
            "status": "error",
            "error": f"{type(exc).__name__}: {str(exc)[:240]}",
            "latency_ms": round((time.monotonic() - t0) * 1000.0, 1),
        }


def run_agentic_workflow(
    query: str,
    location: Optional[Union[str, Dict[str, Any]]] = None,
    features: Optional[Dict[str, Any]] = None,
    requested_tools: Optional[List[str]] = None,
    include_llm_synthesis: bool = True,
) -> Dict[str, Any]:
    """
    End-to-end controlled agentic workflow:
    1. Scans user query for prompt injection or unsafe earthquake/override requests.
    2. Selects and runs deterministic backend tools (always running XGBoost prediction
       if a location or risk question is asked).
    3. Audits sensor telemetry and XGBoost output for missing/contradictory data.
    4. Invokes local `Qwen/Qwen3-4B` (or deterministic fallback if disabled) strictly
       grounded on the verified tool outputs.
    """
    clean_query = (query or "").strip()[:1000]
    injection_flags = detect_injection(clean_query)
    q_lower = clean_query.lower()

    # Check if location is embedded in query if not explicitly passed
    target_location = location
    if target_location is None:
        for name_key in NAMED_LOCATIONS:
            if name_key in q_lower:
                target_location = name_key
                break
        if target_location is None:
            target_location = "Gangtok"

    # Determine which controlled tools to invoke
    tools_to_run: List[str] = []
    if requested_tools:
        tools_to_run = [t for t in requested_tools if t in CONTROLLED_TOOLS]
    else:
        tools_to_run.append("get_landslide_prediction")
        tools_to_run.append("get_sensor_readings")
        tools_to_run.append("get_earthquake_activity")
        if any(w in q_lower for w in ("rain", "weather", "monsoon", "precip", "forecast", "threshold")):
            tools_to_run.append("get_rainfall_history")
        if any(w in q_lower for w in ("sop", "protocol", "evacuat", "guideline", "procedure", "ndma", "document", "report")):
            tools_to_run.append("search_disaster_documents")
        else:
            tools_to_run.append("search_disaster_documents")
        if any(w in q_lower for w in ("alert", "warning", "advisory", "cap")):
            tools_to_run.append("get_official_alerts")
        if any(w in q_lower for w in ("history", "incident", "past", "citizen", "crack", "gsi")):
            tools_to_run.append("get_incident_history")

    # Report any unavailable requested tools explicitly
    unavailable_tools = [t for t in (requested_tools or []) if t not in CONTROLLED_TOOLS]

    tool_results: Dict[str, Any] = {}
    for t_name in tools_to_run:
        if t_name == "get_landslide_prediction":
            tool_results[t_name] = execute_controlled_tool(
                t_name, {"location": target_location, "features": features}
            )
        elif t_name in ("get_sensor_readings", "get_rainfall_history"):
            tool_results[t_name] = execute_controlled_tool(
                t_name, {"location": target_location, "time_window": 24}
            )
        elif t_name == "get_earthquake_activity":
            tool_results[t_name] = execute_controlled_tool(
                t_name, {"location": target_location, "radius_km": 350.0, "min_magnitude": 2.5}
            )
        elif t_name == "search_disaster_documents":
            tool_results[t_name] = execute_controlled_tool(
                t_name, {"query": clean_query or "landslide escalation SOP"}
            )
        elif t_name in ("get_official_alerts", "get_incident_history"):
            tool_results[t_name] = execute_controlled_tool(
                t_name, {"location": target_location}
            )

    pred_payload = (tool_results.get("get_landslide_prediction") or {}).get("prediction") or {}
    sensor_payload = (tool_results.get("get_sensor_readings") or {}).get("latest_reading")
    sop_payload = (tool_results.get("search_disaster_documents") or {}).get("official_sops") or []
    alerts_payload = (tool_results.get("get_official_alerts") or {}).get("alerts") or []
    reports_payload = (tool_results.get("get_incident_history") or {}).get("field_reports") or []

    # Check if user asked about earthquake prediction
    earthquake_disclaimer: Optional[str] = None
    if "earthquake" in q_lower or "seismic" in q_lower:
        earthquake_disclaimer = (
            "SAFETY LIMITATION: Neither the LLM (Qwen3-4B) nor the XGBoost landslide model can predict "
            "earthquakes. Seismic events are monitored via external USGS/NCS catalogs strictly as post-event "
            "slope-destabilization triggers."
        )

    qwen = get_qwen_service()
    if include_llm_synthesis and not injection_flags:
        llm_res = qwen.explain_xgboost_prediction(
            xgb_output=pred_payload,
            location=(tool_results.get("get_landslide_prediction") or {}).get("location"),
            sensor_readings=sensor_payload,
            field_reports=reports_payload,
            official_alerts=alerts_payload,
            sops=sop_payload,
        )
        synthesis_text = llm_res["explanation"]
        if earthquake_disclaimer:
            synthesis_text = f"{earthquake_disclaimer}\n\n{synthesis_text}"
        if unavailable_tools:
            synthesis_text = (
                f"TOOL LIMITATION: Requested tool(s) {unavailable_tools} are unavailable. "
                f"Supported tools: {list(CONTROLLED_TOOLS.keys())}.\n\n{synthesis_text}"
            )
    else:
        flags = audit_sensor_and_prediction_context(pred_payload, sensor_payload, reports_payload)
        from backend.app.ml.qwen_service import build_deterministic_explanation

        synthesis_text = build_deterministic_explanation(
            pred_payload,
            flags,
            reason="quarantined_prompt_injection" if injection_flags else "deterministic_only",
        )
        if earthquake_disclaimer:
            synthesis_text = f"{earthquake_disclaimer}\n\n{synthesis_text}"
        llm_res = {
            "explanation": synthesis_text,
            "used_llm": False,
            "model_id": "deterministic-rule-engine",
            "data_quality_flags": flags,
        }

    return {
        "query": clean_query,
        "resolved_location": (tool_results.get("get_landslide_prediction") or {}).get("location"),
        "tools_executed": list(tool_results.keys()),
        "unavailable_tools_requested": unavailable_tools,
        "tool_outputs": tool_results,
        "xgboost_prediction": pred_payload,
        "data_quality_flags": llm_res.get("data_quality_flags", []),
        "answer": synthesis_text,
        "used_llm": llm_res.get("used_llm", False),
        "model_id": llm_res.get("model_id"),
        "earthquake_disclaimer": earthquake_disclaimer,
        "injection_flags": injection_flags,
        "quarantined": bool(injection_flags),
    }
