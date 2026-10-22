"""
Live Probe of Remote Data Sources for RESQ.AI × BhuRaksha Digital Twin
Probes Copernicus GLO-30 / AWS Terrarium, Sentinel-2 STAC, Esri World Imagery,
Open-Meteo, NASA GIBS, Google 3D Tiles, Overpass OSM, SoilGrids.
"""

import sys
import time
import json
import urllib.request
import urllib.error

AOIS = {
    "gangtok": {"name": "Gangtok - NH10 Corridor, Sikkim", "lat": 27.305, "lon": 88.600, "bbox": [88.55, 27.25, 27.35, 88.65]},
    "shillong": {"name": "Shillong Hills, Meghalaya", "lat": 25.570, "lon": 91.880, "bbox": [91.84, 25.52, 25.61, 91.94]},
    "aizawl": {"name": "Aizawl Ridge, Mizoram", "lat": 23.727, "lon": 92.717, "bbox": [92.68, 23.68, 23.78, 92.76]},
    "tupul": {"name": "Noney / Tupul, Manipur", "lat": 24.866, "lon": 93.611, "bbox": [93.58, 24.83, 24.90, 93.65]},
}

PROBES = [
    {
        "layer": "Terrain DEM",
        "source": "AWS Terrain Tiles (Mapzen Terrarium - SRTM & Copernicus GLO-30)",
        "url": "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/6111/3449.png",
        "licence": "ODbL / Public Domain",
        "res": "30 m (SRTM / Copernicus GLO-30 mosaic)"
    },
    {
        "layer": "Satellite Orthophoto",
        "source": "Esri World Imagery (MapServer WMTS)",
        "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3449/6111",
        "licence": "Esri Master License / Public View (Maxar, Earthstar)",
        "res": "10-15 m worldwide, sub-meter regional"
    },
    {
        "layer": "Satellite STAC",
        "source": "Earth Search AWS (Sentinel-2 L2A COG STAC)",
        "url": "https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a",
        "licence": "Copernicus Open Access Policy (Free & Open)",
        "res": "10 m (B2, B3, B4, B8)"
    },
    {
        "layer": "Weather Forecast & Ensemble",
        "source": "Open-Meteo Ensemble & Landslide Soil Moisture API",
        "url": "https://ensemble-api.open-meteo.com/v1/ensemble?latitude=27.305&longitude=88.6&hourly=precipitation",
        "licence": "CC BY 4.0 (Non-commercial & Commercial with attribution)",
        "res": "ERA5-Land ~9 km / GFS ~13 km"
    },
    {
        "layer": "Precipitation Overlay",
        "source": "NASA GIBS IMERG Precipitation (Global Hydrology)",
        "url": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?Service=WMTS&Request=GetCapabilities",
        "licence": "NASA Open Data Policy (Public Domain)",
        "res": "0.1 deg (~10 km) half-hourly"
    },
    {
        "layer": "Vector Roads & Buildings",
        "source": "OpenStreetMap Overpass API",
        "url": "https://overpass-api.de/api/interpreter?data=[out:json][timeout:10];node(around:500,27.305,88.6);out;",
        "licence": "ODbL 1.0 (OpenStreetMap contributors)",
        "res": "Vector road lines & building polygons"
    },
    {
        "layer": "Soil Properties",
        "source": "ISRIC SoilGrids WCS / REST",
        "url": "https://rest.isric.org/soilgrids/v2.0/properties/query?lon=88.6&lat=27.305&property=clay&depth=0-5cm",
        "licence": "CC BY 4.0 (ISRIC - World Soil Information)",
        "res": "250 m spatial resolution"
    },
    {
        "layer": "3D Photorealistic Tiles",
        "source": "Google Photorealistic 3D Tiles (Map Tiles API)",
        "url": "https://tile.googleapis.com/v1/3dtiles/root.json",
        "licence": "Google Maps Platform Terms of Service (Requires API Key & Billing)",
        "res": "Sub-meter mesh (urban/regional)"
    }
]

def probe_url(url, timeout=6):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "RESQ-BhuRaksha-Probe/1.0 (Disaster-Resilience-Research)"}
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            latency_ms = round((time.time() - t0) * 1000)
            return {
                "status": "ONLINE",
                "http_code": resp.status,
                "latency_ms": latency_ms,
                "note": f"HTTP {resp.status} in {latency_ms}ms"
            }
    except urllib.error.HTTPError as e:
        latency_ms = round((time.time() - t0) * 1000)
        # HTTP 400, 401, 403 means host is reachable! E.g. Google Tiles requires API key, which returns 400/403
        if e.code in (400, 401, 403):
            return {
                "status": "REQUIRES_AUTH_OR_PARAMS" if e.code != 403 else "ONLINE_AUTH_GATED",
                "http_code": e.code,
                "latency_ms": latency_ms,
                "note": f"Reachable (HTTP {e.code} auth/param gate in {latency_ms}ms)"
            }
        return {
            "status": "HTTP_ERROR",
            "http_code": e.code,
            "latency_ms": latency_ms,
            "note": f"HTTP {e.code}"
        }
    except Exception as ex:
        latency_ms = round((time.time() - t0) * 1000)
        return {
            "status": "UNREACHABLE_OR_SANDBOXED",
            "http_code": 0,
            "latency_ms": latency_ms,
            "note": str(ex)[:80]
        }

def run_probe():
    results = []
    print("=" * 80)
    print("PROBING REMOTE DATA SOURCES FOR RESQ.AI × BHURAKSHA DIGITAL TWIN")
    print("=" * 80)
    for p in PROBES:
        res = probe_url(p["url"])
        item = {**p, **res}
        results.append(item)
        print(f"[{item['status']:<22}] {item['layer']:<22} | {item['latency_ms']:>4}ms | {item['source']}")
    
    with open("data/probe_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nProbe results saved to data/probe_results.json")

if __name__ == "__main__":
    run_probe()
