# Georeferencing Conventions & Coordinate Systems

**System**: RESQ.AI × BhuRaksha (MDONER / SIH26001 Track)  
**Date**: 2026-10-19  
**Standard**: Web Mercator (EPSG:3857) and WGS84 Geodetic (EPSG:4326)

---

## 1. Grid Alignment and Half-Cell Conventions

In BhuRaksha digital twin pipelines, all raster arrays (DEM, orthophoto, TWI, slope, aspect, simulation flood depths) share identical pixel-to-geographic mapping conventions:

### Row and Column Directions
- **Column Axis ($X$)**: West to East. Index $0$ is `west`, index $511$ is `east`.
- **Row Axis ($Y$)**: North to South. Index $0$ is `north`, index $511$ is `south`.

### Half-Cell Center Evaluation
- Continuous coordinate evaluation uses half-cell centering:
  $$u = \frac{x + 0.5}{W}, \quad v = \frac{y + 0.5}{H}$$
  where $u, v \in [0, 1]$.
- Geographic Longitude and Latitude conversion:
  $$\text{lon}(u) = \text{west} + u \times (\text{east} - \text{west})$$
  $$\text{lat}(v) = \text{north} - v \times (\text{north} - \text{south})$$

---

## 2. Web Mercator Tile Grid Mathematics

All raster DEM and imagery tiles adhere to standard Web Mercator tile coordinates $(x, y, z)$:

$$\text{lon} = \frac{x}{2^z} \times 360^\circ - 180^\circ$$
$$\text{lat} = \arctan\left(\sinh\left(\pi \times \left(1 - \frac{2y}{2^z}\right)\right)\right) \times \frac{180^\circ}{\pi}$$

### Inverse Projection (Geodetic to Tile Coordinates):
$$n = 2^z$$
$$x = \frac{\text{lon} + 180^\circ}{360^\circ} \times n$$
$$y = \left(1 - \frac{\ln(\tan(\text{lat}_{\text{rad}}) + \sec(\text{lat}_{\text{rad}}))}{\pi}\right) \times \frac{n}{2}$$

---

## 3. MapLibre Draping Strategy

To guarantee overlays **never sink inside mountains**:
1. **Vector Features**: Roads (`LineString`), evacuation paths, building footprints (`Polygon`), and hazard zones are registered as MapLibre GeoJSON layers (`type: "line"`, `type: "fill"`, `type: "circle"`).
2. **GPU Surface Draping**: MapLibre renders draped layers directly on the 3D terrain surface mesh displaced by the active `raster-dem` elevation texture.
3. **Anchor Heights for Extruded / Billboard Elements**:
   Points with leader lines (e.g. piezometers, hospital markers) query `map.queryTerrainElevation(lngLat)` to anchor the base of the billboard strictly at the ground surface:
   $$\text{Anchor Height} = \text{QueryTerrainElevation}(\text{lng}, \text{lat})$$
   $$\text{Offset} \ge 0.0\text{ m (no subsurface clipping)}$$
