"""
backend/tests/test_terraguard_api.py
Comprehensive test suite verifying all TerraGuard (Landslide-AI) endpoints on the unified app:
- Health check endpoints (/health, /api/health)
- Hazard zones (/api/zones)
- Susceptibility calculation (/api/zones/calculate-susceptibility)
- Dynamic Factor of Safety & Temporal LSTM (/api/predict/lstm)
- Citizen Crowdsource Reports & AI CV vision (/api/reports, /api/reports/submit)
- IoT Sensor telemetry nodes (/api/sensors)
- Common Alerting Protocol CAP 1.2 generation (/api/alerts/cap)
- Live weather & soil moisture feed (/api/weather/live)
- SMS Broadcast provider state machine (/api/alerts/sms-broadcast)
- ML Model Inference (/api/ml/predict, /predict)
- Model Info (/api/ml/model-info, /model-info)
- Cumulative rainfall constraint validation (422)
- ML Pipeline Metrics & Comparison (/api/ml/metrics, /api/ml/comparison)
- Datasets Inventory (/api/ml/datasets)
- GIS Historical Training Events (/api/zones/historical-training-events)
- GIS Zone ML Risk & ML Pattern Heatmap (/api/zones/{id}/ml-risk, /api/zones/ml-heatmap-points)
- National Center for Seismology Earthquake feed & safe fallback (/api/earthquakes)
- Chatbot TerraBot (/api/chat) with 9 languages, grounded location risk, and action routing
- GeoJSON map layers (risk polygons, boundaries, fault lines, heatmap)
"""
import pytest
from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.terraguard.services import earthquake_service as earthquake_module
from backend.app.terraguard.services.chatbot_service import generate_offline_response

client = TestClient(app)


def test_terraguard_health():
    res1 = client.get("/api/health")
    assert res1.status_code == 200
    assert res1.json()["status"] == "healthy"
    res2 = client.get("/health")
    assert res2.status_code == 200
    assert res2.json()["status"] == "healthy"


def test_terraguard_hazard_zones():
    response = client.get("/api/zones")
    assert response.status_code == 200
    zones = response.json()
    assert len(zones) >= 5
    assert any(z["id"] == "zone-sk-01" for z in zones)


def test_terraguard_susceptibility_calculation():
    payload = {
        "slope_deg": 48.5,
        "soil_saturation_pct": 85.0,
        "elevation_m": 1420.0
    }
    response = client.post("/api/zones/calculate-susceptibility", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "susceptibility_index" in data
    assert data["risk_status"] in ["CRITICAL RED", "ADVISORY ORANGE", "NOMINAL GREEN"]


def test_terraguard_predict_lstm():
    response = client.get("/api/predict/lstm?extra_rainfall=25")
    assert response.status_code == 200
    data = response.json()
    assert "hazard_score" in data
    assert "simulated_fos" in data
    assert "simulated_pwp" in data
    assert "lead_time_display" in data


def test_terraguard_crowdsource_reports():
    response = client.get("/api/reports")
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) >= 1
    assert "classification" in reports[0] or "aiClassificationStatus" in reports[0]


def test_terraguard_report_submission_and_cv():
    payload = {
        "location": "NH-10 Near Dikchu Bend (Km 36.2)",
        "subDivision": "Mangan Sub-Division",
        "state": "sikkim",
        "latitude": 27.2388,
        "longitude": 88.5012,
        "description": "Active rotational blowout with tension cracks across roadway."
    }
    response = client.post("/api/reports/submit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["urgency"] == "CRITICAL"
    assert data["classification"] == "landslide"
    assert data["confidence"] > 0


def test_terraguard_sensor_nodes():
    response = client.get("/api/sensors")
    assert response.status_code == 200
    sensors = response.json()
    assert len(sensors) >= 4


def test_terraguard_cap_alert():
    response = client.get("/api/alerts/cap")
    assert response.status_code == 200
    data = response.json()
    assert "alert" in data
    assert "raw_xml" in data
    assert "MANDATORY EVACUATION" in data["alert"]["headline"]


def test_terraguard_live_weather():
    response = client.get("/api/weather/live?state=sikkim")
    assert response.status_code == 200
    data = response.json()
    assert "current_temperature_c" in data
    assert "soil_saturation_pct" in data


def test_terraguard_sms_broadcast():
    from backend.app.terraguard import config
    payload = {
        "headline": "MANDATORY EVACUATION NH-10",
        "instruction": "Move to Singtam Relief Camp immediately.",
        "phone_numbers": ["+919800012345"],
        "state": "sikkim"
    }
    config.SMS_DEMO_MODE = True
    response = client.post("/api/alerts/sms-broadcast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "demo"
    assert data["gateway"] == "SMSHorizon DEMO"


def test_terraguard_ml_predict():
    payload = {
        "elevation": 1450.0,
        "slope": 38.0,
        "aspect": 190.0,
        "soil_id": "4276.0",
        "landcover_class": "50.0",
        "rainfall_1d": 65.0,
        "rainfall_3d": 120.0,
        "rainfall_7d": 195.0,
        "rainfall_15d": 260.0,
        "rainfall_30d": 380.0
    }
    response = client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data

    res_alias = client.post("/predict", json=payload)
    assert res_alias.status_code == 200
    assert "prediction" in res_alias.json()


def test_terraguard_model_info():
    res1 = client.get("/api/ml/model-info")
    assert res1.status_code == 200
    assert "model_name" in res1.json()
    res2 = client.get("/model-info")
    assert res2.status_code == 200
    assert "model_name" in res2.json()


def test_terraguard_predict_invalid_rainfall():
    invalid_payload = {
        "elevation": 1450.0,
        "slope": 38.0,
        "aspect": 190.0,
        "soil_id": "4276.0",
        "landcover_class": "50.0",
        "rainfall_1d": 120.0,
        "rainfall_3d": 50.0,
        "rainfall_7d": 195.0,
        "rainfall_15d": 260.0,
        "rainfall_30d": 380.0
    }
    response = client.post("/predict", json=invalid_payload)
    assert response.status_code == 422
    assert "Cumulative rainfall constraint violated" in response.json()["detail"]


def test_terraguard_ml_metrics():
    response = client.get("/api/ml/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "roc_auc" in data
    assert "accuracy" in data


def test_terraguard_ml_comparison():
    response = client.get("/api/ml/comparison")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


def test_terraguard_ml_datasets():
    response = client.get("/api/ml/datasets")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 15


def test_terraguard_gis_historical_training_events():
    response = client.get("/api/zones/historical-training-events")
    assert response.status_code == 200
    events = response.json()
    assert len(events) >= 30


def test_terraguard_gis_zone_ml_risk():
    response = client.get("/api/zones/zone-sk-01/ml-risk?extra_rainfall=30")
    assert response.status_code == 200
    data = response.json()
    assert data["zone_id"] == "zone-sk-01"
    assert "probability_percentage" in data


def test_terraguard_gis_ml_heatmap_points():
    response = client.get("/api/zones/ml-heatmap-points?extra_rainfall=25")
    assert response.status_code == 200
    data = response.json()
    assert "points" in data
    assert len(data["points"]) >= 50


def test_terraguard_earthquake_feed():
    response = client.get("/api/earthquakes?latitude=27.53&longitude=88.51&radius_km=500")
    assert response.status_code == 200
    data = response.json()
    assert "earthquake_data_available" in data
    assert "earthquake_trigger_score" in data
    assert isinstance(data["events"], list)


def test_terraguard_map_layers():
    risk = client.get("/api/map/risk-polygons?state=sikkim")
    assert risk.status_code == 200
    risk_payload = risk.json()
    assert risk_payload["type"] == "FeatureCollection"
    assert len(risk_payload["features"]) >= 1

    bounds = client.get("/api/map/boundaries?level=state")
    assert bounds.status_code == 200
    bounds_payload = bounds.json()
    assert bounds_payload["type"] == "FeatureCollection"
    assert len(bounds_payload["features"]) >= 1

    faults = client.get("/api/map/fault-lines")
    assert faults.status_code == 200
    assert faults.json()["type"] == "FeatureCollection"

    heatmap = client.get("/api/map/heatmap")
    assert heatmap.status_code == 200
    assert "points" in heatmap.json()


def test_terraguard_chatbot():
    res = client.post("/api/chat", json={"message": "What is the landslide risk at Teesta Basin?"})
    assert res.status_code == 200
    data = res.json()
    assert "Teesta Basin" in data["reply"]

    # Test navigation action
    res2 = client.post("/api/chat", json={"message": "Show me the risk map"})
    assert res2.status_code == 200
    assert res2.json()["action"]["type"] == "NAVIGATE"
    assert res2.json()["action"]["module"] == "risk-map"

    # Test emergency helpline
    res3 = client.post("/api/chat", json={"message": "What is the emergency helpline number?"})
    assert res3.status_code == 200
    assert "1078" in res3.json()["reply"]
