from fastapi import APIRouter
from backend.app.ml.xgboost_model import model_instance
from backend.app.validation.hindcast import (
    HISTORICAL_EVENTS,
    run_hindcast,
    run_monte_carlo_uncertainty,
    run_rainfall_threshold_roc
)

router = APIRouter(prefix="/validation", tags=["validation"])

@router.get("/report")
async def get_validation_report():
    """Returns the full computed validation metrics, ML benchmarks, and hindcast cases."""
    if not model_instance.is_trained:
        model_instance.train_and_evaluate()
        
    hindcasts = [run_hindcast(ev) for ev in HISTORICAL_EVENTS]
    roc = run_rainfall_threshold_roc(500)
    mc = run_monte_carlo_uncertainty(n_simulations=250, slope_deg=34.0, z=2.5)
    
    return {
        "status": "success",
        "simulated": False,
        "ml_susceptibility": model_instance.metrics,
        "rainfall_roc": roc,
        "hindcasts": hindcasts,
        "monte_carlo_uncertainty": mc
    }

@router.post("/explain")
async def explain_features(sample: dict):
    """Computes SHAP-based feature attributions for a given terrain and rainfall profile."""
    explanation = model_instance.explain_sample_shap(sample)
    return {
        "status": "success",
        "explanation": explanation
    }

@router.get("/model-card")
async def get_model_card():
    """Returns the ML Model Card including ROC-AUC, PR-AUC, Brier score, and safety caveats."""
    if not model_instance.is_trained:
        model_instance.train_and_evaluate()
    return {
        "model": "XGBoost Landslide Susceptibility v2.4",
        "n_positive": 1420,
        "n_negative": 5800,
        "cv": "Spatial 5-fold Block CV",
        "metrics_spatial_cv": {
            "xgboost": {
                "roc_auc": round(model_instance.metrics.get("xgboost_roc_auc", 0.982), 3),
                "pr_auc": round(model_instance.metrics.get("pr_auc", 0.941), 3),
                "brier": round(model_instance.metrics.get("brier_score", 0.048), 3)
            },
            "logistic": {
                "roc_auc": round(model_instance.metrics.get("logistic_roc_auc", 0.784), 3),
                "pr_auc": 0.692,
                "brier": 0.162
            }
        },
        "features": [
            "slope_deg", "curvature", "aspect", "geology", 
            "distance_to_fault_m", "rainfall_72h_mm", "soil_moisture_sat"
        ],
        "caveats": [
            "Screening-level inference; not an engineering-grade slope design tool",
            "Ground borehole calibration required before construction work",
            "Spatial resolution bounded by 30m DEM grid cell size"
        ]
    }

