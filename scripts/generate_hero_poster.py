#!/usr/bin/env python3
"""
scripts/generate_hero_poster.py
Generates golden-hour cinematic 3D mountain landscape posters
for instant hero LCP first-paint on desktop and mobile.
"""

from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT_DIR = Path(__file__).resolve().parent.parent
TWIN_DIR = ROOT_DIR / "data" / "twins" / "gangtok"
PUB_DIR = ROOT_DIR / "apps" / "web" / "public"
PUB_DIR.mkdir(parents=True, exist_ok=True)

def generate_posters():
    ortho_path = TWIN_DIR / "orthophoto.jpg"
    normal_path = TWIN_DIR / "normal_map.png"
    slope_path = TWIN_DIR / "slope.png"

    ortho = Image.open(ortho_path).convert("RGB")
    normal = Image.open(normal_path).convert("RGB")
    slope = Image.open(slope_path).convert("L")

    # Resize to 2560x1440
    target_w, target_h = 2560, 1440
    ortho_lg = ortho.resize((target_w, target_h), Image.Resampling.LANCZOS)
    normal_lg = normal.resize((target_w, target_h), Image.Resampling.BILINEAR)
    slope_lg = slope.resize((target_w, target_h), Image.Resampling.BILINEAR)

    # Compute directional golden-hour lighting from normal map
    # Light direction: azimuth 240 deg (South-West afternoon sun), elevation 32 deg
    # L = [cos(el)*sin(az), cos(el)*cos(az), sin(el)]
    norm_arr = (np.asarray(normal_lg, dtype=np.float32) / 255.0) * 2.0 - 1.0 # [-1, 1]
    
    # Sun vector
    az = np.radians(240.0)
    el = np.radians(35.0)
    lx = np.cos(el) * np.sin(az)
    ly = np.cos(el) * np.cos(az)
    lz = np.sin(el)
    light_vec = np.array([lx, ly, lz], dtype=np.float32)
    light_vec /= np.linalg.norm(light_vec)

    # N dot L hillshade
    n_dot_l = np.clip(
        norm_arr[..., 0] * light_vec[0] + 
        norm_arr[..., 1] * light_vec[1] + 
        norm_arr[..., 2] * light_vec[2],
        0.0, 1.0
    )

    # Atmospheric grading: warm golden highlights, deep teal/forest shadows
    ortho_arr = np.asarray(ortho_lg, dtype=np.float32)
    shaded = ortho_arr * (0.45 + 0.65 * n_dot_l[..., None])

    # Add golden tint to lit faces
    shaded[..., 0] *= (1.0 + 0.18 * n_dot_l) # warm red
    shaded[..., 1] *= (1.0 + 0.12 * n_dot_l) # golden yellow
    shaded[..., 2] *= (0.85 + 0.15 * (1.0 - n_dot_l)) # cool blue/green in shadows

    # Atmospheric ridge haze gradient (higher towards background/horizon)
    y_coords = np.linspace(0.0, 1.0, target_h)[:, None, None]
    haze_intensity = (1.0 - y_coords) ** 2.2 * 0.35
    haze_color = np.array([11, 42, 24], dtype=np.float32) # #0b2a18 deep Himalayan haze

    shaded = shaded * (1.0 - haze_intensity) + haze_color * haze_intensity
    shaded = np.clip(shaded, 0.0, 255.0).astype(np.uint8)

    final_img = Image.fromarray(shaded, mode="RGB")
    final_img = ImageEnhance.Contrast(final_img).enhance(1.12)
    final_img = ImageEnhance.Color(final_img).enhance(1.08)

    # 1. Desktop 2560x1440 WebP and JPG
    out_webp = PUB_DIR / "poster_hero_gangtok.webp"
    out_jpg = PUB_DIR / "poster_hero_gangtok.jpg"
    final_img.save(out_webp, format="WEBP", quality=92)
    final_img.save(out_jpg, format="JPEG", quality=90)
    print(f"✓ Saved desktop hero poster to {out_webp} ({out_webp.stat().st_size // 1024} KB)")

    # 2. Mobile 1080x1920 portrait cut
    mob_w, mob_h = 1080, 1920
    # Crop central region and resize
    crop_x = (target_w - int(target_h * (mob_w / mob_h))) // 2
    mob_crop = final_img.crop((crop_x, 0, target_w - crop_x, target_h))
    mob_img = mob_crop.resize((mob_w, mob_h), Image.Resampling.LANCZOS)
    
    out_mob_webp = PUB_DIR / "poster_hero_gangtok_mobile.webp"
    out_mob_jpg = PUB_DIR / "poster_hero_gangtok_mobile.jpg"
    mob_img.save(out_mob_webp, format="WEBP", quality=90)
    mob_img.save(out_mob_jpg, format="JPEG", quality=88)
    print(f"✓ Saved mobile hero poster to {out_mob_webp} ({out_mob_webp.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    generate_posters()
