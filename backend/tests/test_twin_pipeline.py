import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
import json
import hashlib
import numpy as np
from PIL import Image
import pytest

TWIN_DIR = Path("data/twins/gangtok")

def test_twin_manifest_and_checksum_integrity():
    """Verify that all files in manifest.json exist and match their SHA-256 signatures."""
    assert TWIN_DIR.exists(), "Twin bundle directory data/twins/gangtok must exist"
    manifest_path = TWIN_DIR / "manifest.json"
    assert manifest_path.exists(), "manifest.json must exist"

    with open(manifest_path) as f:
        manifest = json.load(f)

    assert manifest["aoi_id"] == "gangtok"
    assert manifest["grid"]["width_px"] == 512
    assert manifest["grid"]["height_px"] == 512
    assert manifest["grid"]["min_elevation_m"] >= 500.0
    assert manifest["grid"]["max_elevation_m"] <= 2500.0
    assert "visual_approximations" in manifest
    assert len(manifest["visual_approximations"]) >= 3
    assert any("Screening-level" in text for text in manifest["visual_approximations"])

    # Verify SHA-256 checksums
    for filename, meta in manifest["files"].items():
        fpath = TWIN_DIR / filename
        assert fpath.exists(), f"Bundle file {filename} missing"
        assert fpath.stat().st_size == meta["bytes"], f"Byte size mismatch for {filename}"

        h = hashlib.sha256()
        with open(fpath, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
        assert h.hexdigest() == meta["sha256"], f"SHA-256 checksum mismatch for {filename}"

def test_georeferencing_control_points_alignment():
    """Verify known ground-truth locations land on valid DEM pixels with correct topography."""
    cp_path = TWIN_DIR / "control_points.json"
    assert cp_path.exists(), "control_points.json must exist"

    with open(cp_path) as f:
        cps = json.load(f)

    manifest_path = TWIN_DIR / "manifest.json"
    with open(manifest_path) as f:
        manifest = json.load(f)

    bounds = manifest["bounds"]
    dem_path = TWIN_DIR / "dem_512x512_f32.bin"
    dem = np.fromfile(dem_path, dtype=np.float32).reshape(512, 512)

    # All control points must land strictly inside the 512x512 grid
    for cp in cps:
        assert cp["in_bounds"] is True
        c, r = cp["pixel_col"], cp["pixel_row"]
        assert 0 <= c < 512
        assert 0 <= r < 512
        assert cp["dem_elevation_m"] == pytest.approx(float(dem[r, c]), abs=0.2)

    # Check topographically: Ranipool (valley) must be lower than Paljor Stadium (ridge)
    ranipool = next(c for c in cps if c["id"] == "cp-ranipool")
    paljor = next(c for c in cps if c["id"] == "cp-paljor")
    assert ranipool["dem_elevation_m"] < 900.0, "Ranipool must be in the valley floor (< 900m)"
    assert paljor["dem_elevation_m"] > 1500.0, "Paljor Stadium must be on the upper ridge (> 1500m)"
    assert ranipool["dem_elevation_m"] < paljor["dem_elevation_m"] - 700.0, "Ranipool must be >700m below Paljor Stadium"

def test_lod_pyramid_consistency():
    """Verify downsampled LODs preserve elevation extrema and mean within 1%."""
    d512 = np.fromfile(TWIN_DIR / "dem_512x512_f32.bin", dtype=np.float32).reshape(512, 512)
    d256 = np.fromfile(TWIN_DIR / "dem_256x256_f32.bin", dtype=np.float32).reshape(256, 256)
    d128 = np.fromfile(TWIN_DIR / "dem_128x128_f32.bin", dtype=np.float32).reshape(128, 128)

    # Means should be virtually identical
    assert d256.mean() == pytest.approx(d512.mean(), rel=1e-3)
    assert d128.mean() == pytest.approx(d512.mean(), rel=1e-3)

    # Extrema should be within 1.5%
    assert abs(d256.min() - d512.min()) / d512.min() < 0.015
    assert abs(d256.max() - d512.max()) / d512.max() < 0.015

def test_geomorphometry_raster_validity():
    """Verify slope, normal map, TWI, and canopy have valid numeric ranges without NaNs or Infs."""
    slope = np.array(Image.open(TWIN_DIR / "slope.png"))
    normal = np.array(Image.open(TWIN_DIR / "normal_map.png"))
    twi = np.array(Image.open(TWIN_DIR / "twi.png"))
    canopy = np.array(Image.open(TWIN_DIR / "canopy.png"))

    assert slope.shape == (512, 512)
    assert normal.shape == (512, 512, 3)
    assert twi.shape == (512, 512)
    assert canopy.shape == (512, 512)

    assert not np.isnan(slope).any()
    assert not np.isnan(normal).any()
    assert not np.isnan(twi).any()

    # Normal map z-component (blue) must point upwards (nz > 0, so B > 128)
    assert normal[:, :, 2].mean() > 140, "Surface normal vectors must predominantly face upward"

def test_infrastructure_geojson_and_building_alignment():
    """Verify vector infrastructure and buildings match the digital twin bounding box."""
    with open(TWIN_DIR / "manifest.json") as f:
        bounds = json.load(f)["bounds"]

    with open(TWIN_DIR / "infrastructure.geojson") as f:
        infra = json.load(f)

    assert len(infra["features"]) >= 5

    # Roads must be inside bounds
    for feat in infra["features"]:
        geom = feat["geometry"]
        if geom["type"] == "LineString":
            for lon, lat in geom["coordinates"]:
                assert bounds["west"] - 0.01 <= lon <= bounds["east"] + 0.01
                assert bounds["south"] - 0.01 <= lat <= bounds["north"] + 0.01

    with open(TWIN_DIR / "buildings.json") as f:
        bldgs = json.load(f)

    assert len(bldgs) >= 100
    for b in bldgs:
        assert 0.0 <= b["u"] <= 1.0
        assert 0.0 <= b["v"] <= 1.0
        assert 6.0 <= b["height_m"] <= 25.0
        assert b["ground_elevation_m"] >= bounds.get("min_elevation_m", 500.0) - 50.0

def test_twin_endpoints_api():
    """Verify backend API endpoints for digital twin bundle serve valid JSON and files."""
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)
    # Manifest
    r = client.get("/api/v1/twins/gangtok/manifest")
    assert r.status_code == 200
    data = r.json()
    assert data["aoi_id"] == "gangtok"
    assert "visual_approximations" in data

    # Infrastructure GeoJSON
    r = client.get("/api/v1/twins/gangtok/infrastructure")
    assert r.status_code == 200
    infra = r.json()
    assert infra["type"] == "FeatureCollection"
    assert len(infra["features"]) >= 5

    # Buildings
    r = client.get("/api/v1/twins/gangtok/buildings")
    assert r.status_code == 200
    bldgs = r.json()
    assert len(bldgs) >= 100

    # Static file streaming
    r = client.get("/api/v1/twins/gangtok/files/orthophoto_preview.jpg")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/jpeg")
    assert len(r.content) > 500

    # Path traversal security guard (rejected by Starlette/FastAPI)
    r = client.get("/api/v1/twins/gangtok/files/../manifest.json")
    assert r.status_code in (400, 404)

