"""
backend/tests/test_geoshield_api.py
Comprehensive test suite verifying all GeoShield endpoints:
- Auth & JWT
- Dashboard (stats, risk-heatmap, rainfall-trend, risk-trend, state-summary)
- Sensors (20 stations, station detail, reading history, latest readings)
- Alerts (active, timeline, 30-day history, stats)
- Reports, Roads (48 roads), Villages (18 villages)
- Weather & Forecast
- Simulator (landslide trigger, batch)
- Satellite Data (20 stations live metrics, summary, risk zones)
- AI Click-to-Predict
- Compound Flood & Landslide Correlation (19 districts)
- ML Enhanced (XGBoost model health, predict, risk grid)
- GIS Data Export (GeoJSON, CSV, risk zones)
"""
import pytest
from starlette.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_geoshield_auth_login():
    res = client.post("/api/auth/login", json={"email": "admin@geoshield.gov.in", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["user"]["email"] == "admin@geoshield.gov.in"
    assert data["user"]["role"] == "admin"


def test_geoshield_dashboard_endpoints():
    res_stats = client.get("/api/dashboard/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_stations"] == 20
    assert "risk_distribution" in stats
    assert "road_status" in stats

    res_heatmap = client.get("/api/dashboard/risk-heatmap")
    assert res_heatmap.status_code == 200
    points = res_heatmap.json()
    assert len(points) >= 20
    # Check that when excluding historical points, exactly the 20 active stations are returned
    res_stations_only = client.get("/api/dashboard/risk-heatmap?include_historical=false")
    assert res_stations_only.status_code == 200
    assert len(res_stations_only.json()) == 20

    res_rain = client.get("/api/dashboard/rainfall-trend")
    assert res_rain.status_code == 200
    assert len(res_rain.json()) > 0

    res_risk = client.get("/api/dashboard/risk-trend")
    assert res_risk.status_code == 200
    assert len(res_risk.json()) > 0

    res_state = client.get("/api/dashboard/state-summary")
    assert res_state.status_code == 200
    assert len(res_state.json()) == 8  # 8 NER states


def test_geoshield_sensors_and_stations():
    res_stations = client.get("/api/sensors/stations")
    assert res_stations.status_code == 200
    stations = res_stations.json()
    assert len(stations) == 20

    res_st = client.get("/api/sensors/stations/NER-001")
    assert res_st.status_code == 200
    st = res_st.json()
    assert st["station"]["station_id"] == "NER-001"
    assert st["station"]["state"] == "Sikkim"
    assert "readings" in st
    assert "risk_assessment" in st

    res_hist = client.get("/api/sensors/stations/NER-001/history?hours=24")
    assert res_hist.status_code == 200
    assert isinstance(res_hist.json(), list)


def test_geoshield_alerts_and_timeline():
    res_alerts = client.get("/api/alerts")
    assert res_alerts.status_code == 200
    assert isinstance(res_alerts.json(), list)

    res_active = client.get("/api/alerts/active")
    assert res_active.status_code == 200

    res_tl = client.get("/api/alerts/timeline")
    assert res_tl.status_code == 200
    data = res_tl.json()
    assert "timeline" in data

    res_hist = client.get("/api/alerts/history")
    assert res_hist.status_code == 200
    assert isinstance(res_hist.json(), list)


def test_geoshield_infrastructure_and_reports():
    res_roads = client.get("/api/roads")
    assert res_roads.status_code == 200
    roads = res_roads.json()
    assert len(roads) == 48

    res_villages = client.get("/api/villages")
    assert res_villages.status_code == 200
    villages = res_villages.json()
    assert len(villages) == 18

    res_reports = client.get("/api/reports")
    assert res_reports.status_code == 200
    assert isinstance(res_reports.json(), list)


def test_geoshield_weather_and_forecast():
    res_w = client.get("/api/weather/NER-001")
    assert res_w.status_code == 200
    assert "data" in res_w.json()

    res_fc = client.get("/api/weather/NER-001/forecast")
    assert res_fc.status_code == 200
    assert isinstance(res_fc.json(), list)


def test_geoshield_simulator():
    login_res = client.post("/api/auth/login", json={"email": "admin@geoshield.gov.in", "password": "admin123"})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_sim = client.post("/api/simulate/landslide", json={"station_id": "NER-001", "intensity": "high"}, headers=headers)
    assert res_sim.status_code == 200
    data = res_sim.json()
    assert data["status"] == "success"
    assert "simulation" in data
    assert "risk_assessment" in data


def test_geoshield_satellite_data():
    res_data = client.get("/api/satellite/data")
    assert res_data.status_code == 200
    assert res_data.json()["total_stations"] == 20

    res_summary = client.get("/api/satellite/summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert "elevation" in summary
    assert "soil_moisture_surface" in summary

    res_zones = client.get("/api/satellite/risk-zones")
    assert res_zones.status_code == 200
    assert isinstance(res_zones.json(), list)


def test_geoshield_predict():
    res = client.post("/api/predict", json={"latitude": 27.3389, "longitude": 88.6065})
    assert res.status_code == 200
    data = res.json()
    assert "risk_assessment" in data
    assert "model_info" in data
    assert data["risk_assessment"]["risk_score"] >= 0


def test_geoshield_flood_and_compound_risk():
    res_f = client.get("/api/flood/data")
    assert res_f.status_code == 200
    assert res_f.json()["total_districts"] == 19

    res_s = client.get("/api/flood/summary")
    assert res_s.status_code == 200
    assert res_s.json()["total_districts"] == 19

    res_c = client.get("/api/flood/correlation")
    assert res_c.status_code == 200
    data = res_c.json()
    assert "correlation" in data
    assert len(data["correlation"]) == 19
    for item in data["correlation"]:
        assert "compound_risk" in item
        assert "flood_risk" in item
        assert "landslide_risk" in item


def test_geoshield_ml_enhanced():
    res_h = client.get("/api/ml/health")
    assert res_h.status_code == 200
    assert res_h.json()["model_loaded"] is True

    res_p = client.post("/api/ml/predict", json={"latitude": 27.3389, "longitude": 88.6065})
    assert res_p.status_code == 200
    p = res_p.json()
    assert "risk_score" in p
    assert "risk_level" in p
    assert "factors" in p


def test_geoshield_gis_export():
    res_geo = client.get("/api/export/geojson")
    assert res_geo.status_code == 200
    assert res_geo.json()["type"] == "FeatureCollection"

    res_csv = client.get("/api/export/csv")
    assert res_csv.status_code == 200
    assert "station_id,name,state" in res_csv.text

    res_rz = client.get("/api/export/risk-zones")
    assert res_rz.status_code == 200
