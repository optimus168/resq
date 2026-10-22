# BhuRaksha × RESQ.AI — Scientific & Operational Limitations

**Document Status:** Public Engineering Transparency Disclosure  
**System Classification:** Operational Decision-Support Prototype (Screening-Level Model)  
**Regulatory Status:** NOT an Official Certified Early Warning Service (Statutory Authority: GSI / IMD)

---

## 1. Geotechnical & Physics Modeling Limitations

### 1.1 Infinite Slope Planar Assumption
- **Theory:** The geotechnical failure engine implements the classical 1D infinite slope equilibrium equation:
  $$FS = \frac{c' + (\gamma \cdot z \cdot \cos^2\beta - u) \tan\phi'}{\gamma \cdot z \cdot \sin\beta \cos\beta}$$
- **Limitation:** The model assumes an infinitely long, planar failure surface parallel to the topography. It neglects 3D lateral shear resistance at the margins of the landslide body and cannot simulate rotational slip circles typical of deep-seated bedrock landslides.
- **Consequence:** Factor of Safety ($FS$) calculations are accurate for translational debris slides and shallow colluvial slumps (which represent $>80\%$ of monsoon failures in the North Eastern Region), but serve as screening-level approximations for massive deep-seated rock slope collapses.

### 1.2 Geotechnical Parameter Homogeneity
- **Parameters:** Effective cohesion ($c' = 12\text{ kPa}$), effective internal friction angle ($\phi' = 30^\circ$), and saturated soil depth ($z = 2.0\text{ m}$) are assigned based on regional GSI literature for Himalayan residual soils and phyllite colluvium.
- **Limitation:** In real Himalayan topography, shear strength and soil thickness vary dramatically across meters due to weathering grade, joint orientation, and relict bedding planes.
- **Mitigation Implemented:** We implemented an ensemble **Monte-Carlo Geotechnical Uncertainty Engine** ($N=250$ stochastic realizations) that samples parameter distributions ($\phi' \sim \mathcal{N}(30^\circ, 3.5^\circ)$, $c' \sim \mathcal{N}(10, 2.5\text{ kPa})$) to output probabilistic failure distributions rather than a misleading single deterministic number.

---

## 2. Hydro-Meteorological & Spatial Data Limitations

### 2.1 Atmospheric & Rainfall Resolution
- **Current Feeds:** Open-Meteo ECMWF reanalysis (0.1° / ~11 km grid) and synthetic point AWS stations.
- **Limitation:** Himalayan cloudbursts and localized convective storms frequently occur over micro-catchments narrower than 2 kilometers. An 11 km grid cell can average out an extreme 100 mm/hr cloudburst cell, leading to potential under-prediction if satellite radar QPE is not ingested.
- **Future Operational Requirement:** Real deployment requires Doppler Weather Radar (DWR) integration from IMD Gangtok / Agartala and high-density tipping-bucket rain gauges spaced every 5 km along arterial highways.

### 2.2 Digital Elevation Model (DEM) Resolution
- **Dataset:** 30-meter ground sampling distance (Copernicus GLO-30 / AWS Terrarium).
- **Limitation:** A 30m grid cell cannot resolve localized highway cutting slopes, retaining wall failures, or steep 1:1 excavated road benches constructed by the Border Roads Organisation (BRO).
- **Future Requirement:** Drone LiDAR or 2m Cartosat stereo DEMs along high-risk highway corridors to capture engineered slope cuts.

---

## 3. Telemetry & Sensor Deployment Status

### 3.1 Simulated Telemetry Feeds
- **Current Prototype:** Piezometer pore-water pressure ($r_u$), borehole tiltmeter movement ($mm/hr$), and crack sensor telemetry are simulated by stochastic physical anomaly generators (`backend/app/geospatial/terrain.py`).
- **Disclosure:** While the mathematical response of the physics and ML models to these telemetry feeds is authentic, there is no physical IoT sensor hardware currently transmitting from Sikkim or Manipur hillsides.
- **Labeling Policy:** All telemetry cards, graphs, and simulation outputs are badged with `SIMULATED` in the user interface and tagged with `simulated: true` in JSON payloads.

---

## 4. Regulatory & Legal Disclaimer

1. **Not a Certified Warning Authority:**
   Under the Disaster Management Act (2005) and NDMA national guidelines, the Geological Survey of India (GSI) is the sole statutory nodal agency for landslide early warning in India, and the India Meteorological Department (IMD) is the nodal agency for weather warnings.
2. **Operational Decision Support:**
   BhuRaksha × RESQ.AI is an advanced operational intelligence and decision-support platform designed for disaster management authorities in India's North Eastern Region. It is intended to assist district emergency managers and response planners with scenario planning, exposure analysis, and automated coordination, and must not be used as an autonomous, unsupervised public warning system.
