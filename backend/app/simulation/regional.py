"""
Regional calibration for landslide screening in India's North Eastern Region (NER).

The values here are *screening-level* starting points derived from published
intensity-duration thresholds (Caine 1980) and regional geotechnical/geological
descriptions. They are deliberately explicit so operators can see, override and
audit every assumption. They are NOT an official IMD / GSI warning threshold and
must not be presented as a validated early-warning service.

Why a regional layer at all?
---------------------------
A single global rainfall threshold systematically over-warns the wet Meghalaya
plateau and under-warns the thin residual soils of Mizoram. NER terrain also
differs in regolith thickness, cohesion and runout mobility between the Sikkim
Himalaya, the Khasi Hills, the Mizoram anticline and the Manipur ophiolite belt.
This module encodes those differences once so the simulator, the API and the UI
all speak the same calibrated numbers.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict, field
from typing import Iterable, Optional


@dataclass(frozen=True)
class RegionalProfile:
    """Calibrated geotechnical + hydro-meteorological profile for one AOI."""

    aoi: str
    state: str
    terrain_note: str
    regolith: str
    # Infinite-slope / hydrology defaults
    c_soil_kpa: float
    c_root_kpa: float
    phi_deg: float
    gamma_kn_m3: float
    z_base_m: float
    porosity: float
    infil_frac: float
    drainage: float
    k_sat_m_s: float
    m0_monsoon: float
    # Voellmy runout defaults
    mu: float
    xi_m_s2: float
    reach_angle_deg: float
    # Rainfall threshold calibration (Caine-type: I = a * D^-b, I in mm/h)
    id_a: float = 14.82
    id_b: float = 0.39
    id_calibration: float = 1.0
    threshold_durations_h: tuple[int, ...] = (3, 6, 12, 24)
    threshold_source: str = "Caine (1980) global intensity-duration envelope, regionally scaled"
    notes: tuple[str, ...] = ()

    def threshold_mm(self, duration_h: float) -> float:
        """Caine-type rainfall depth threshold (mm) for a storm duration."""
        d = max(float(duration_h), 0.5)
        intensity_mm_h = self.id_calibration * self.id_a * d ** (-self.id_b)
        return round(intensity_mm_h * d, 1)

    def thresholds(self) -> list[dict]:
        return [
            {"duration_h": d, "threshold_mm": self.threshold_mm(d)}
            for d in self.threshold_durations_h
        ]

    def to_dict(self) -> dict:
        out = asdict(self)
        out["thresholds"] = self.thresholds()
        return out


# ---------------------------------------------------------------------------
# NER profiles
# ---------------------------------------------------------------------------

REGIONAL_PROFILES: dict[str, RegionalProfile] = {
    "gangtok": RegionalProfile(
        aoi="gangtok",
        state="Sikkim",
        terrain_note="Teesta valley flank of the Sikkim Himalaya; 550-2160 m relief, glaciated headwaters.",
        regolith="Weathered phyllite / Darjeeling gneiss colluvium with thin glacial till veneer.",
        c_soil_kpa=4.5,
        c_root_kpa=4.0,
        phi_deg=32.0,
        gamma_kn_m3=19.5,
        z_base_m=2.2,
        porosity=0.38,
        infil_frac=0.68,
        drainage=0.0042,
        k_sat_m_s=3.0e-5,
        m0_monsoon=0.24,
        mu=0.22,
        xi_m_s2=500.0,
        reach_angle_deg=13.0,
        id_calibration=1.00,
        notes=(
            "Monsoon-dominated; 2023 South Lhonak GLOF and recurrent NH10 slope failures.",
            "Deep colluvium on 30-40 deg benches is the dominant translational-slide setting.",
        ),
    ),
    "shillong": RegionalProfile(
        aoi="shillong",
        state="Meghalaya",
        terrain_note="Khasi plateau edge; broad undulating ridge with steep escarpment spurs.",
        regolith="Deeply weathered Khasi granite/gneiss with lateritic soil mantle (2-4 m).",
        c_soil_kpa=3.6,
        c_root_kpa=5.0,
        phi_deg=30.0,
        gamma_kn_m3=18.6,
        z_base_m=2.9,
        porosity=0.42,
        infil_frac=0.62,
        drainage=0.0034,
        k_sat_m_s=8.0e-5,
        m0_monsoon=0.30,
        mu=0.20,
        xi_m_s2=450.0,
        reach_angle_deg=11.0,
        id_calibration=1.15,
        notes=(
            "One of the wettest places on Earth; antecedent saturation persists through monsoon.",
            "High infiltration capacity means rainfall thresholds must be higher than Sikkim.",
        ),
    ),
    "aizawl": RegionalProfile(
        aoi="aizawl",
        state="Mizoram",
        terrain_note="North-south trending anticlinal ridge; steep west-facing escarpment.",
        regolith="Thin residual clay over interbedded shale and sandstone; rapid weathering front.",
        c_soil_kpa=3.0,
        c_root_kpa=3.5,
        phi_deg=28.0,
        gamma_kn_m3=18.8,
        z_base_m=1.8,
        porosity=0.36,
        infil_frac=0.58,
        drainage=0.0050,
        k_sat_m_s=2.0e-5,
        m0_monsoon=0.26,
        mu=0.19,
        xi_m_s2=430.0,
        reach_angle_deg=12.0,
        id_calibration=1.10,
        notes=(
            "Thin soil + steep ridge flanks => small rainfall increments can trigger failures.",
            "May 2024 Cyclone Remal rainfall triggered quarry collapse and landslides near Melthum.",
        ),
    ),
    "tupul": RegionalProfile(
        aoi="tupul",
        state="Manipur",
        terrain_note="Noney hills along the Ijai/Irung confluence; high-relief ophiolite belt.",
        regolith="Colluvium and weathered ophiolite melange over sheared serpentinite.",
        c_soil_kpa=4.0,
        c_root_kpa=4.0,
        phi_deg=30.0,
        gamma_kn_m3=19.2,
        z_base_m=2.4,
        porosity=0.37,
        infil_frac=0.64,
        drainage=0.0046,
        k_sat_m_s=4.0e-5,
        m0_monsoon=0.28,
        mu=0.21,
        xi_m_s2=480.0,
        reach_angle_deg=12.0,
        id_calibration=1.05,
        notes=(
            "June 2022 Tupul railway-camp landslide (major loss of life) is the local benchmark.",
            "Sheared serpentinite melange produces long-runout debris avalanches.",
        ),
    ),


    # --- Generality demos (outside NER, retained for transferability testing) ---
    "wayanad": RegionalProfile(
        aoi="wayanad",
        state="Kerala",
        terrain_note="Western Ghats escarpment; deeply incised debris channels draining to Chaliyar.",
        regolith="Lateritic soil over charnockite/gneiss with thick colluvial valley fills.",
        c_soil_kpa=3.4,
        c_root_kpa=2.6,
        phi_deg=30.0,
        gamma_kn_m3=17.8,
        z_base_m=2.6,
        porosity=0.45,
        infil_frac=0.55,
        drainage=0.0040,
        k_sat_m_s=1.2e-4,
        m0_monsoon=0.28,
        mu=0.17,
        xi_m_s2=380.0,
        reach_angle_deg=10.0,
        id_calibration=1.20,
        notes=(
            "July 2024 Chooralmala-Mundakkai debris flows (>200 deaths) are the benchmark.",
            "Extreme orographic rainfall; transferability test, not an NER warning configuration.",
        ),
    ),
    "joshimath": RegionalProfile(
        aoi="joshimath",
        state="Uttarakhand",
        terrain_note="Garhwal Himalaya township built on moraine and colluvial debris over gneiss.",
        regolith="Glacial moraine and colluvium with high secondary permeability.",
        c_soil_kpa=3.2,
        c_root_kpa=2.0,
        phi_deg=29.0,
        gamma_kn_m3=18.2,
        z_base_m=3.6,
        porosity=0.40,
        infil_frac=0.72,
        drainage=0.0032,
        k_sat_m_s=6.0e-5,
        m0_monsoon=0.26,
        mu=0.20,
        xi_m_s2=460.0,
        reach_angle_deg=13.0,
        id_calibration=0.92,
        notes=(
            "January 2023 subsidence event was driven by groundwater and infrastructure, not rainfall alone.",
            "Rainfall-only screening under-represents the subsidence mechanism; treat as a transferability demo.",
        ),
    ),
}


def profile_for(aoi: str) -> RegionalProfile:
    if aoi not in REGIONAL_PROFILES:
        raise ValueError(f"No NER calibration profile for AOI '{aoi}'")
    return REGIONAL_PROFILES[aoi]


# ---------------------------------------------------------------------------
# Rainfall threshold evaluation
# ---------------------------------------------------------------------------

LEVELS = ("NORMAL", "WATCH", "WARNING", "SEVERE")
_LEVEL_RANK = {name: i for i, name in enumerate(LEVELS)}


def _window_sums(series: Iterable[float], hour: int) -> dict[int, float]:
    """Cumulative rainfall (mm) over trailing windows ending at `hour`."""
    values = list(series)[: hour + 1]
    out = {}
    for d in (1, 3, 6, 12, 24, 48, 72):
        out[d] = round(sum(values[-d:]) if values else 0.0, 1)
    return out


def evaluate_rainfall(
    profile: RegionalProfile,
    hyetograph: list[float],
    hour: int,
    antecedent_m0: Optional[float] = None,
) -> dict:
    """
    Evaluate rainfall against the regional intensity-duration envelope.

    Antecedent moisture lowers the effective threshold: saturated hillslopes need
    less additional rain to reach failure. The factor is linear and bounded so it
    cannot manufacture a warning from dry conditions.
    """
    m0 = profile.m0_monsoon if antecedent_m0 is None else float(antecedent_m0)
    antecedent_factor = max(0.70, min(1.0, 1.0 - 0.55 * (m0 - 0.35)))
    sums = _window_sums(hyetograph, hour)

    ratios = {}
    for d in profile.threshold_durations_h:
        if hour + 1 < min(d, 3):
            continue
        th = profile.threshold_mm(d) * antecedent_factor
        ratios[d] = {
            "duration_h": d,
            "observed_mm": sums.get(d, 0.0),
            "threshold_mm": round(th, 1),
            "ratio": round(sums.get(d, 0.0) / max(th, 1e-6), 2),
        }

    peak = max(ratios.values(), key=lambda r: r["ratio"]) if ratios else None
    ratio = peak["ratio"] if peak else 0.0
    if ratio >= 1.5:
        level = "SEVERE"
    elif ratio >= 1.0:
        level = "WARNING"
    elif ratio >= 0.75:
        level = "WATCH"
    else:
        level = "NORMAL"

    return {
        "level": level,
        "peak_ratio": round(ratio, 2),
        "governing_duration_h": peak["duration_h"] if peak else None,
        "observed_mm": peak["observed_mm"] if peak else 0.0,
        "effective_threshold_mm": peak["threshold_mm"] if peak else None,
        "antecedent_factor": round(antecedent_factor, 2),
        "windows": sums,
        "by_duration": list(ratios.values()),
        "basis": profile.threshold_source,
    }


def escalate(level: str, steps: int = 1) -> str:
    return LEVELS[max(0, min(len(LEVELS) - 1, _LEVEL_RANK.get(level, 0) + steps))]


def detection_confidence(
    rainfall_ratio: float,
    area_ha: float,
    mean_slope_deg: float,
    min_fs: float,
) -> tuple[float, str]:
    """
    Screening confidence (0-1) that a modelled unstable cluster is a real
    landslide candidate. This is an interpretable heuristic, not a calibrated
    probability; it is labelled as such everywhere it is surfaced.
    """
    score = 0.30
    score += 0.25 * min(1.0, max(0.0, (rainfall_ratio - 0.6) / 0.8))
    score += 0.15 * min(1.0, max(0.0, (mean_slope_deg - 22.0) / 18.0))
    score += 0.15 * min(1.0, max(0.0, area_ha / 2.0))
    score += 0.15 * min(1.0, max(0.0, (1.0 - min_fs) / 0.35))
    score = round(min(0.95, max(0.05, score)), 2)
    label = "HIGH" if score >= 0.70 else "MODERATE" if score >= 0.50 else "LOW"
    return score, label


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


__all__ = [
    "RegionalProfile",
    "REGIONAL_PROFILES",
    "profile_for",
    "evaluate_rainfall",
    "escalate",
    "detection_confidence",
    "haversine_m",
    "LEVELS",
]
