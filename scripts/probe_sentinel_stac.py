"""
Query Earth Search AWS Sentinel-2 L2A STAC API for real satellite imagery scenes
across North Eastern Region AOIs: Gangtok, Shillong, Aizawl, Tupul.
"""

import json
import urllib.request
import urllib.error

AOIS = {
    "gangtok": {"name": "Gangtok – NH10 Corridor, Sikkim", "bbox": [88.55, 27.25, 88.65, 27.35]},
    "shillong": {"name": "Shillong Hills, Meghalaya", "bbox": [91.84, 25.52, 91.94, 25.61]},
    "aizawl": {"name": "Aizawl Ridge, Mizoram", "bbox": [92.68, 23.68, 92.76, 23.78]},
    "tupul": {"name": "Noney / Tupul, Manipur", "bbox": [93.58, 24.83, 93.65, 24.90]},
}

STAC_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"

def search_sentinel_scenes(aoi_id, aoi_data):
    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": aoi_data["bbox"],
        "limit": 5
    }
    
    req = urllib.request.Request(
        STAC_SEARCH_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "RESQ-BhuRaksha-Probe/1.0"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            features = data.get("features", [])
            print(f"\n>>> AOI: {aoi_data['name']} ({aoi_id})")
            print(f"Found {len(features)} latest Sentinel-2 scenes:")
            scenes = []
            for f in features:
                props = f.get("properties", {})
                assets = f.get("assets", {})
                visual_url = assets.get("visual", {}).get("href") or assets.get("overview", {}).get("href")
                scene_info = {
                    "id": f.get("id"),
                    "datetime": props.get("datetime"),
                    "cloud_cover": round(props.get("eo:cloud_cover", 0), 2),
                    "platform": props.get("platform"),
                    "tile_id": props.get("s2:tile_id", ""),
                    "visual_url": visual_url,
                    "sun_elevation": round(props.get("view:sun_elevation", 0), 1),
                    "sun_azimuth": round(props.get("view:sun_azimuth", 0), 1)
                }
                scenes.append(scene_info)
                print(f"  • Date: {scene_info['datetime']} | Cloud: {scene_info['cloud_cover']}% | Sun Elev: {scene_info['sun_elevation']}° | ID: {scene_info['id']}")
            return scenes
    except Exception as e:
        print(f"STAC search failed for {aoi_id}: {e}")
        return []

def main():
    catalog = {}
    for aoi_id, aoi_data in AOIS.items():
        catalog[aoi_id] = search_sentinel_scenes(aoi_id, aoi_data)
        
    with open("data/sentinel_scenes.json", "w") as f:
        json.dump(catalog, f, indent=2)
    print("\nSaved Sentinel-2 scene catalog to data/sentinel_scenes.json")

if __name__ == "__main__":
    main()
