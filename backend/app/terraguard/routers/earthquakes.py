from typing import Optional

from fastapi import APIRouter, Query

from backend.app.terraguard.services.earthquake_service import earthquake_service

router = APIRouter(prefix="/api/earthquakes", tags=["Official NCS Earthquakes"])


@router.get("")
def get_recent_earthquakes(
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    radius_km: float = Query(500.0, gt=0, le=2000),
    limit: int = Query(100, gt=0, le=200),
):
    """Return validated, recent earthquake events from the official NCS RISEQ feed."""
    return earthquake_service.get_earthquakes(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        limit=limit,
    )


HISTORICAL_EARTHQUAKES = [
    {
        "id": "EQ-HIST-1950-AS",
        "magnitude": 8.6,
        "latitude": 28.50,
        "longitude": 96.50,
        "depth_km": 15.0,
        "location": "1950 Great Assam-Tibet Earthquake (Upper Assam / Arunachal Border)",
        "event_time": "1950-08-15T19:39:28+05:30",
        "source": "GSI / NCS Historical Seismicity Catalog",
    },
    {
        "id": "EQ-HIST-1897-ML",
        "magnitude": 8.1,
        "latitude": 26.00,
        "longitude": 91.80,
        "depth_km": 32.0,
        "location": "1897 Great Shillong Plateau Earthquake (Oldham Fault, Meghalaya)",
        "event_time": "1897-06-12T17:15:00+05:30",
        "source": "GSI / NCS Historical Seismicity Catalog",
    },
    {
        "id": "EQ-HIST-1991-UK",
        "magnitude": 6.8,
        "latitude": 30.73,
        "longitude": 78.79,
        "depth_km": 11.6,
        "location": "1991 Uttarkashi Earthquake (Bhagirathi Valley, Uttarakhand)",
        "event_time": "1991-10-20T02:53:16+05:30",
        "source": "GSI / NCS Historical Seismicity Catalog",
    },
    {
        "id": "EQ-HIST-1999-CM",
        "magnitude": 6.8,
        "latitude": 30.41,
        "longitude": 79.42,
        "depth_km": 15.0,
        "location": "1999 Chamoli / Alaknanda Earthquake (Garhwal Himalaya)",
        "event_time": "1999-03-29T00:35:13+05:30",
        "source": "GSI / NCS Historical Seismicity Catalog",
    },
    {
        "id": "EQ-HIST-2011-SK",
        "magnitude": 6.9,
        "latitude": 27.72,
        "longitude": 88.06,
        "depth_km": 19.7,
        "location": "2011 Sikkim-Nepal Border Earthquake (Teesta Catchment & Gangtok)",
        "event_time": "2011-09-18T18:10:48+05:30",
        "source": "NCS / USGS Historic Archive",
    },
    {
        "id": "EQ-HIST-2016-MN",
        "magnitude": 6.7,
        "latitude": 24.80,
        "longitude": 93.65,
        "depth_km": 55.0,
        "location": "2016 Imphal / Noney Railway Alignment Earthquake (Manipur)",
        "event_time": "2016-01-04T04:35:21+05:30",
        "source": "NCS Historic Catalog",
    },
    {
        "id": "EQ-HIST-2020-MZ",
        "magnitude": 5.5,
        "latitude": 23.22,
        "longitude": 93.22,
        "depth_km": 20.0,
        "location": "2020 Champhai Earthquake Swarm (Indo-Myanmar Wedge, Mizoram)",
        "event_time": "2020-06-22T04:10:52+05:30",
        "source": "NCS Historic Catalog",
    },
    {
        "id": "EQ-HIST-2021-AS",
        "magnitude": 6.4,
        "latitude": 26.69,
        "longitude": 92.36,
        "depth_km": 34.0,
        "location": "2021 Dhekiajuli / Sonitpur Earthquake (Kopili Fault, Assam)",
        "event_time": "2021-04-28T07:51:25+05:30",
        "source": "NCS Historic Catalog",
    },
    {
        "id": "EQ-HIST-2023-UK",
        "magnitude": 3.9,
        "latitude": 30.55,
        "longitude": 79.56,
        "depth_km": 8.0,
        "location": "2023 Joshimath Subsidence Micro-Seismic Sequence (Uttarakhand)",
        "event_time": "2023-01-06T15:22:10+05:30",
        "source": "NCS Historic Catalog",
    },
    {
        "id": "EQ-HIST-2024-MN",
        "magnitude": 5.1,
        "latitude": 24.35,
        "longitude": 93.75,
        "depth_km": 40.0,
        "location": "2024 Churachandpur Seismic Activity (Manipur Hills)",
        "event_time": "2024-03-12T10:14:30+05:30",
        "source": "NCS Historic Catalog",
    },
]


@router.get("/historical")
def get_historical_earthquakes(
    year: Optional[int] = Query(None, ge=1800, le=2100),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
):
    """Return verified historical earthquake events across the Himalayas and NER."""
    results = list(HISTORICAL_EARTHQUAKES)
    if year is not None:
        results = [
            e for e in results
            if e["event_time"].startswith(str(year))
        ]
    return results

