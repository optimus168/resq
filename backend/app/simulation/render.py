"""PNG rendering for simulation overlays (hazard, depth, velocity, factor of safety)."""

from __future__ import annotations

import io

import numpy as np
from PIL import Image

LAYERS = ("hazard", "depth", "velocity", "fs", "fos", "debris")


def _rgba(shape: tuple[int, int]) -> np.ndarray:
    return np.zeros((shape[0], shape[1], 4), dtype=np.uint8)


def _feather_mask(shape: tuple[int, int], margin: int = 10) -> np.ndarray:
    """Compute smooth cosine falloff along grid borders to prevent square box edges."""
    ny, nx = shape
    y = np.arange(ny)
    x = np.arange(nx)
    fy = np.clip(np.minimum(y, ny - 1 - y) / float(max(1, margin)), 0.0, 1.0)
    fx = np.clip(np.minimum(x, nx - 1 - x) / float(max(1, margin)), 0.0, 1.0)
    fy = 0.5 - 0.5 * np.cos(fy * np.pi)
    fx = 0.5 - 0.5 * np.cos(fx * np.pi)
    return np.outer(fy, fx).astype(np.float32)


def _ramp(values: np.ndarray, stops: list[tuple[float, tuple[int, int, int]]], alpha_max: int = 210) -> tuple[np.ndarray, np.ndarray]:
    """Piecewise-linear colour ramp. Returns (rgb, alpha)."""
    vals = np.nan_to_num(values, nan=0.0, posinf=0.0, neginf=0.0)
    lo = stops[0][0]
    hi = stops[-1][0]
    t = np.clip((vals - lo) / max(hi - lo, 1e-9), 0.0, 1.0)

    rgb = np.zeros(vals.shape + (3,), dtype=np.float32)
    for i in range(len(stops) - 1):
        a_pos, a_col = stops[i]
        b_pos, b_col = stops[i + 1]
        seg_lo = (a_pos - lo) / max(hi - lo, 1e-9)
        seg_hi = (b_pos - lo) / max(hi - lo, 1e-9)
        mask = (t >= seg_lo) & (t <= seg_hi)
        local = np.clip((t - seg_lo) / max(seg_hi - seg_lo, 1e-9), 0.0, 1.0)
        for ch in range(3):
            rgb[..., ch] = np.where(
                mask,
                a_col[ch] + (b_col[ch] - a_col[ch]) * local,
                rgb[..., ch],
            )
    return rgb.astype(np.uint8), (t * alpha_max).astype(np.uint8)


def render_layer(fields: dict, layer: str, hour: int) -> bytes:
    """
    Render one RGBA overlay frame.

    `hour` is clamped to the simulated window. Colours intentionally match the
    legend used in the Simulation Lab (blue saturation, amber marginal, red
    failure, orange runout).
    """
    layer = {"fos": "fs", "debris": "depth"}.get(layer, layer)
    hour = int(max(0, min(hour, fields["hours"])))
    fs_grid = fields["fs"][hour]
    sat = fields["sat"][hour]
    fail_hour = fields["fail_hour"]
    arrival = fields["arrival"]
    speed = fields["speed"]
    deposit = fields["deposit"]

    failed = (fail_hour >= 0) & (fail_hour <= hour)
    arrived = arrival <= hour
    rgba = _rgba(fs_grid.shape)

    if layer == "fs":
        # Full stability map: red <1, orange 1-1.12, yellow 1.12-1.25, faint green >1.25
        out = _rgba(fs_grid.shape)
        out[..., 3] = 0
        unstable = fs_grid < 1.0
        marginal = (fs_grid >= 1.0) & (fs_grid < 1.12)
        watch = (fs_grid >= 1.12) & (fs_grid < 1.25)
        stable = fs_grid >= 1.25
        out[unstable] = (239, 68, 68, 220)
        out[marginal] = (249, 115, 22, 175)
        out[watch] = (234, 179, 8, 120)
        # Stable terrain is only faintly shaded so the satellite image remains visible.
        out[stable] = (34, 197, 94, 20)
        feather = _feather_mask(out.shape[:2], margin=8)
        out[..., 3] = (out[..., 3].astype(np.float32) * feather).astype(np.uint8)
        return _png(out)

    if layer == "depth":
        depth = np.where(arrived, deposit, 0.0)
        trail = fields["trail"] & arrived
        depth = np.where(trail & (depth < 0.05), 0.05, depth)
        rgb, alpha = _ramp(
            depth,
            [(0.02, (253, 186, 116)), (0.25, (249, 115, 22)), (1.0, (185, 28, 28)), (3.0, (120, 20, 20))],
            alpha_max=220,
        )
        rgba[..., :3] = rgb
        rgba[..., 3] = np.where(depth > 0.02, alpha, 0)
        feather = _feather_mask(rgba.shape[:2], margin=6)
        rgba[..., 3] = (rgba[..., 3].astype(np.float32) * feather).astype(np.uint8)
        return _png(rgba)

    if layer == "velocity":
        spd = np.where(arrived, speed, 0.0)
        rgb, alpha = _ramp(
            spd,
            [(0.5, (254, 240, 138)), (8.0, (250, 204, 21)), (20.0, (249, 115, 22)), (40.0, (220, 38, 38))],
            alpha_max=220,
        )
        rgba[..., :3] = rgb
        rgba[..., 3] = np.where(spd > 0.5, alpha, 0)
        feather = _feather_mask(rgba.shape[:2], margin=6)
        rgba[..., 3] = (rgba[..., 3].astype(np.float32) * feather).astype(np.uint8)
        return _png(rgba)

    # --- combined hazard layer (default) ---
    # Focus on active failure scars, near-critical slopes, and debris flow channels.
    # We do NOT paint a flat background over the entire box so terrain drapes seamlessly.
    sat_crit = sat > 0.78
    if sat_crit.any():
        s_rgb, s_alpha = _ramp(
            sat,
            [(0.78, (14, 116, 144)), (0.90, (2, 132, 199)), (1.0, (56, 189, 248))],
            alpha_max=130,
        )
        ch_mask = sat_crit & ~failed & ~arrived
        rgba[ch_mask, :3] = s_rgb[ch_mask]
        rgba[ch_mask, 3] = s_alpha[ch_mask]

    # Critical tension / near-failure slopes (FS 1.0 to 1.12)
    marginal = (fs_grid >= 1.0) & (fs_grid < 1.12) & ~arrived & ~failed
    rgba[marginal, :3] = (249, 115, 22)
    rgba[marginal, 3] = 160

    # Warning watch slopes (FS 1.12 to 1.25)
    watch = (fs_grid >= 1.12) & (fs_grid < 1.25) & ~arrived & ~failed
    rgba[watch, :3] = (234, 179, 8)
    rgba[watch, 3] = 95

    # Discrete failure scars (FS < 1.0)
    failed_mask = failed & ~arrived
    rgba[failed_mask, :3] = (239, 68, 68)
    rgba[failed_mask, 3] = 230

    # Debris flow runout tracks & deposition lobes
    if arrived.any():
        depth = np.where(arrived, deposit, 0.0)
        trail = fields["trail"] & arrived
        depth = np.where(trail & (depth < 0.05), 0.05, depth)
        r_rgb, r_alpha = _ramp(
            depth,
            [(0.02, (253, 186, 116)), (0.3, (249, 115, 22)), (1.2, (194, 65, 12)), (3.0, (120, 20, 20))],
            alpha_max=235,
        )
        rgba[arrived, :3] = r_rgb[arrived]
        rgba[arrived, 3] = r_alpha[arrived]

    # Feather edges so the simulation bounds blend organically into satellite terrain
    feather = _feather_mask(rgba.shape[:2], margin=10)
    rgba[..., 3] = (rgba[..., 3].astype(np.float32) * feather).astype(np.uint8)

    return _png(rgba)


def _png(rgba: np.ndarray) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(np.ascontiguousarray(rgba), mode="RGBA").save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_legend() -> dict:
    return {
        "hazard": [
            {"label": "Saturation > 55%", "color": "#0284c7"},
            {"label": "Marginal FS 1.0-1.3", "color": "#eab308"},
            {"label": "Failure FS < 1.0", "color": "#ef4444"},
            {"label": "Debris runout", "color": "#f97316"},
        ],
        "depth": [
            {"label": "0.05 m", "color": "#fdba74"},
            {"label": "0.3 m", "color": "#f97316"},
            {"label": "1.2 m", "color": "#c2410c"},
            {"label": ">3 m", "color": "#781414"},
        ],
        "velocity": [
            {"label": "2 m/s", "color": "#fef08a"},
            {"label": "10 m/s", "color": "#facc15"},
            {"label": "25 m/s", "color": "#f97316"},
            {"label": ">40 m/s", "color": "#dc2626"},
        ],
        "fs": [
            {"label": "FS < 1.0", "color": "#ef4444"},
            {"label": "1.0-1.15", "color": "#f97316"},
            {"label": "1.15-1.3", "color": "#eab308"},
            {"label": "Stable > 1.3", "color": "#22c55e"},
        ],
    }
