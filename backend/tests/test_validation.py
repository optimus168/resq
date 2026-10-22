import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app

@pytest.mark.asyncio
async def test_validation_report_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/validation/report")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        
        # 1. ML Susceptibility Model Verification
        ml = data["ml_susceptibility"]
        assert ml["spatial_cv_roc_auc_mean"] >= 0.80
        assert "slope_deg" in ml["feature_importances"]
        assert ml["feature_importances"]["slope_deg"] > 0.20
        
        # 2. Rainfall Threshold ROC
        roc = data["rainfall_roc"]
        assert roc["roc_auc"] >= 0.75
        assert roc["optimal_operating_point"]["hit_rate_tpr"] > 0.80
        
        # 3. Ground-Truth Hindcast Case Studies
        hindcasts = data["hindcasts"]
        assert len(hindcasts) == 3
        tupul = next(h for h in hindcasts if h["event_id"] == "tupul_2022")
        assert tupul["lead_time_imminent_alarm_hours"] >= 4
        assert tupul["lead_time_moderate_warning_hours"] >= 8
        
        # 4. Monte-Carlo Parametric Uncertainty
        mc = data["monte_carlo_uncertainty"]
        assert mc["n_simulations"] == 250
        assert mc["factor_of_safety_distribution"]["p5_conservative"] < mc["factor_of_safety_distribution"]["median_p50"]
        assert mc["probability_of_slope_failure"] > 0.10

@pytest.mark.asyncio
async def test_shap_feature_explanation_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/validation/explain",
            json={"slope_deg": 42.0, "twi": 10.5, "dist_drainage_m": 30.0, "dist_fault_km": 0.8}
        )
        assert res.status_code == 200
        exp = res.json()["explanation"]
        assert "predicted_susceptibility" in exp
        assert exp["predicted_susceptibility"] > 0.70
        assert "shap_values" in exp
        assert "primary_driver" in exp
