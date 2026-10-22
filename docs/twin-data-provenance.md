# Digital Twin Data Provenance & Geodetic Datums

**System**: RESQ.AI × BhuRaksha (MDONER / SIH26001 Track)  
**Date**: 2026-10-19  
**Specification**: Unified Terrain & Earth Observation Provenance

---

## 1. Single Source of Truth Elevation DEM

To eliminate vertical discrepancies between simulation solvers and client visualizers (which previously caused overlays to appear submerged up to 788 m inside mountains), the platform enforces **one single elevation dataset**:

- **Dataset**: Copernicus DEM GLO-30 / AWS Elevation Tiles Clip
- **Vertical Datum**: WGS84 Ellipsoidal Heights / EGM96 Geoid
- **Spatial Resolution**: 30 metres (approx. 16.98 m cell size in Web Mercator grid at zoom 13)
- **Licence**: Open Data Commons Open Database License (ODbL) / Public Domain
- **Encoding**: Terrarium RGB format:
  $$\text{Elevation (m)} = (R \times 256 + G + B / 256) - 32768$$
- **Tile Grid Hierarchy**:
  - Zoom 12: Composite overview (128x128 per quadrant, 256x256 composite)
  - Zoom 13: Exact 2x2 tile slice per AOI (256x256 per tile)
  - Zoom 14: Bicubic interpolated 4x4 tile slice per AOI (256x256 per tile)
- **Single Exaggeration Factor**: $1.4\times$ applied universally across MapLibre terrain and elevation calculations.

---

## 2. Satellite Imagery

- **Sensor**: Copernicus Sentinel-2 L2A Multi-Spectral Instrument (MSI)
- **Bands**: B04 (Red, 665 nm), B03 (Green, 560 nm), B02 (Blue, 490 nm) True Colour RGB
- **Scene**: `S2A_45RXL_20261017_0_L2A` (Gangtok Corridor), orthorectified bottom-of-atmosphere reflectance
- **Alternate Source**: Esri World Imagery (Maxar / Earthstar Geographics) under Master Terms / Public Demonstration
- **Licence**: Copernicus Open Access Policy (free, full, and open access)

---

## 3. Infrastructure & Lifelines

- **Roads**: OpenStreetMap Contributors (ODbL) + National Highways Authority of India (NHAI) Lifeline records
  - NH10 (Gangtok–Ranipool): Primary lifeline arterial
  - Sichey–Ranipool Link: Critical bypass corridor
  - Lower Syari Bypass: Secondary evacuation feeder
- **Critical Facilities**:
  - STNM Multi-Specialty Hospital, Sochakgang (450 beds)
  - Central Referral Hospital, Manipal Medical College, Tadong (300 beds)
  - Paljor Stadium Designated Staging Shelter (1,500 capacity)
  - Ranipool Bridge Lifeline Junction

---

## 4. Physical Simulation Data & Verification

- **Hydrology Solver**: Kinematic Wave & Green-Ampt infiltration on Copernicus GLO-30 DEM.
- **Slope Stability**: 3D Infinite Slope Limit Equilibrium with dynamic pore-water pressure coupling.
- **Debris Runout**: 2D Shallow-Water Voellmy fluid solver ($\mu = 0.16$, $\xi = 650\text{ m/s}^2$).
- **Overlay Registration**: Voellmy debris flow polygon and velocity footprints are projected directly as MapLibre draped GeoJSON layers, guaranteeing zero vertical error relative to the terrain mesh.
