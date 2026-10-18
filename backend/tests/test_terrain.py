import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.geospatial.terrain import (
    derive_terrain,
    load_terrain,
    latlon_to_cell,
    AOIS
)
from backend.app.integrations.weather import get_weather
from backend.app.integrations.sensors import simulate_sensors

def test_analytic_plane_slope():
    """Verify derive_terrain computes exact mathematical slope on an artificial inclined ramp."""
    n = 64
    cs = 30.0  # 30m cell size
    # Ramp with 30 degree slope: dz/dx = tan(30 deg) = 0.57735
    target_deg = 30.0
    grad = np.tan(np.radians(target_deg))
    x = np.arange(n) * cs
    dem = np.tile(x * grad, (n, 1))
    
    slope, aspect, recv, acc, twi = derive_terrain(dem, cs)
    # Interior cells (avoiding border gradient artifacts)
    interior_slope = slope[2:-2, 2:-2]
    np.testing.assert_allclose(interior_slope, target_deg, atol=0.2)

def test_flat_terrain_zero_slope():
    n = 64
    cs = 30.0
    dem = np.full((n, n), 500.0)
    slope, aspect, recv, acc, twi = derive_terrain(dem, cs)
    assert np.all(slope == 0.0)

def test_latlon_to_cell_projection():
    t = load_terrain("gangtok")
    center_lat, center_lon = AOIS["gangtok"]["center"]
    cell = latlon_to_cell(t, center_lat, center_lon)
    assert cell is not None
    r, c = cell
    assert 0 <= r < 256
    assert 0 <= c < 256

def test_weather_fallback_handling():
    # Force outage mode
    res = get_weather("gangtok", force_outage=True)
    assert res["mode"] in ("cached", "unavailable")
    assert "observed_72h_mm" in res
    assert "forecast_24h_mm" in res
    assert "STALE_CACHED_DATA" in res["quality_flags"] or "NO_LIVE_DATA" in res["quality_flags"]

def test_sensor_simulation_and_anomaly():
    stations = simulate_sensors("gangtok", rain_multiplier=1.0, anomaly=False)
    assert len(stations) == 3
    assert all(s["simulated"] is True for s in stations)
    assert all(s["anomaly"] is False for s in stations)
    
    # Anomaly test
    stations_anom = simulate_sensors("gangtok", rain_multiplier=2.0, anomaly=True)
    pz2 = next(s for s in stations_anom if "PZ-GAN-2" in s["id"])
    assert pz2["anomaly"] is True
    assert pz2["pore_pressure_ratio"] > 0.90

@pytest.mark.asyncio
async def test_aoi_api_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_list = await ac.get("/api/v1/aois")
        assert res_list.status_code == 200
        aois = res_list.json()
        assert len(aois) == 4
        assert any(a["id"] == "gangtok" for a in aois)
        
        res_gtk = await ac.get("/api/v1/aois/gangtok")
        assert res_gtk.status_code == 200
        data = res_gtk.json()
        assert "terrain" in data
        assert data["terrain"]["cell_size_m"] > 0
        assert "geojson" in data
        
        res_grid = await ac.get("/api/v1/aois/gangtok/grid")
        assert res_grid.status_code == 200
        grid_data = res_grid.json()
        assert "slope_q" in grid_data
        assert "twi_w_q" in grid_data
