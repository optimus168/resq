# Data Provenance and Source Register

**Project:** RESQ.AI × BhuRaksha (SIH26001)  
**Verification Date:** 2026-10-18  
**Integrity Rule:** Every external endpoint in this register has been probed with actual HTTP requests and measured for latency, response code, and payload structure.

---

## 1. Verified Live Data Sources

| # | Data Source | Exact Endpoint Probed | Status | HTTP Code | Latency (ms) | Payload Size | License | Auth Required | NER Coverage |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Open-Meteo Weather API** | `https://api.open-meteo.com/v1/forecast?latitude=27.3&longitude=88.6&hourly=precipitation,soil_moisture_0_to_1cm&forecast_days=1` | **OK** | 200 | 685 ms | 1,047 bytes | CC BY 4.0 | None (Free) | Full NER (3–11 km grid) |
| 2 | **AWS Terrarium DEM** | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/6059/3424.png` | **OK** | 200 | 841 ms | 48,670 bytes | Open Data / Mapzen / CC-BY | None | Global / Full NER (~30m SRTM/Copernicus) |
| 3 | **Esri World Imagery** | `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3424/6059` | **OK** | 200 | 87 ms | 20,544 bytes | Esri Master Agreement | None (Standard web access) | High-resolution satellite drape across NER |
| 4 | **USGS Earthquake Feed** | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | **OK** | 200 | 514 ms | 141,443 bytes | Public Domain | None | Global seismic monitoring |
| 5 | **OpenStreetMap Nominatim** | `https://nominatim.openstreetmap.org/search?q=Gangtok&format=json&limit=1` | **OK** | 200 | 583 ms | 444 bytes | ODbL 1.0 | User-Agent required | High density in NER hill towns |
| 6 | **Planetary Computer STAC** | `https://planetarycomputer.microsoft.com/api/stac/v1` | **OK** | 200 | 628 ms | 2,135 bytes | CDLA-Permissive | None | Sentinel-2 multispectral data across NER |

---

## 2. Restricted / Roadmap / Simulated Sources Register

| Data Source | Status | Reason / Access Requirement | Handling in BhuRaksha |
|---|---|---|---|
| **Google Photorealistic 3D Tiles** | `NEEDS_KEY` | Requires Google Cloud billing and Map Tiles API enablement. | Architecture supports client-side toggle; platform works 100% on open MapLibre + AWS Terrarium without key. |
| **NASA GPM IMERG** | `NEEDS_KEY` | Requires NASA Earthdata login and token generation. | Supported via adapter interface; fallback to Open-Meteo ECMWF/GFS precipitation. |
| **GSI Bhukosh (Geological Survey of India)** | `BLOCKED` | Indian government portal requiring manual captcha login; no open programmatic REST API. | Documented historical records ingested into local catalogue with explicit source attribution. |
| **IMD Automatic Weather Stations (AWS)** | `UNAVAILABLE` | Gridded real-time AWS API is restricted to authorized state departments. | Open-Meteo high-resolution model precipitation serves as primary live feed. |
| **Geotechnical Piezometers / Inclinometers** | `SIMULATED` | Physical hardware is not deployed in hackathon setting. | **Mandatory Labeling:** Telemetry labeled `SIMULATED: true` in UI and API; physical noise model with pore-pressure ratio $r_u$ and tilt velocity. |
| **Sentinel-1 InSAR Ground Deformation** | `SIMULATED / PRECOMPUTED` | Interferometric synthetic aperture radar processing requires heavy compute (ISCE2/SNAP) and days of baseline acquisitions. | Precomputed simulated line-of-sight deformation layers labeled clearly as demo overlays. |

---

## 3. Areas of Interest (AOI) Selection Rationale

Four strategic disaster corridors in the North Eastern Region were selected based on historical vulnerability, complex relief, and asset exposure:

### 1. Gangtok – NH10 Corridor (East Sikkim)
- **Coordinates:** 27.305°N, 88.600°E
- **Terrain:** Steep relief ($>40^\circ$ on 32% of cells), fragile schist and phyllite geology.
- **Vulnerability:** NH10 is the sole lifeline connecting Sikkim to the rest of India; repeatedly severed by slope failures during heavy monsoon rainfall and the October 2023 South Lhonak GLOF.
- **Key Assets:** Gangtok city, Deorali, Tadong, Ranipool, STNM Multi-Speciality Hospital, Paljor Stadium evacuation shelter.

### 2. Shillong Hills (East Khasi Hills, Meghalaya)
- **Coordinates:** 25.570°N, 91.880°E
- **Terrain:** Rolling high-plateau with deeply incised gorges, extreme monsoon precipitation (Mawsynram/Cherrapunji weather belt).
- **Vulnerability:** Urban slope cutting, intense episodic downpours triggering slope failures along NH6.
- **Key Assets:** Police Bazar, Laitumkhrah, Mawlai, Nongthymmai, Civil Hospital Shillong, Polo Ground shelter.

### 3. Aizawl Ridge (Aizawl, Mizoram)
- **Coordinates:** 23.727°N, 92.717°E
- **Terrain:** Razor-sharp anticlinal ridge settlement with steep westward and eastward slopes ($>45^\circ$).
- **Vulnerability:** Unplanned multi-story construction on weak sedimentary formations; severe landslides triggered during Cyclone Remal (May 2024) causing fatalities at Melthum.
- **Key Assets:** Dawrpui, Hunthar slide zone, Ramhlun, Melthum, Civil Hospital Aizawl, Lammual Ground shelter.

### 4. Noney / Tupul Railway Corridor (Noney, Manipur)
- **Coordinates:** 24.866°N, 93.611°E
- **Terrain:** Rugged Ijei river valley with massive earth-work railway construction cuts.
- **Vulnerability:** Site of the catastrophic June 30, 2022 Tupul landslide (58+ fatalities); dammed the Ijei river creating compound landslide-dam flash flood hazard.
- **Key Assets:** Tupul rail project camp, Noney town, Marangching village, NH37 Imphal–Jiribam highway, Noney CHC.

---

## 4. Offline Datapack Strategy

To guarantee that RESQ BhuRaksha runs deterministically offline without internet or paid API keys:
1. **DEM Clip:** Compressed 512×512 Terrarium elevation grids stored locally as `.npz` files in `backend/datapacks/`.
2. **Derived Rasters:** Slope, aspect, D8 receiver networks, flow accumulation, and Topographic Wetness Index (TWI) are cached alongside the raw DEM.
3. **Asset Vectors:** Real-world OSM settlements, lifelines, and emergency shelters with approximate demo population estimates.
4. **Deterministic Seed:** Hyetographs and simulation parameters are locked to seed `42` for identical bit-for-bit replayability.
