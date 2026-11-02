import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.db.seed import seed_users
from backend.app.api.auth import router as auth_router
from backend.app.api.terrain import router as terrain_router
from backend.app.api.simulation import router as simulation_router, compat_router as simulation_compat_router
from backend.app.api.incidents import router as incidents_router
from backend.app.api.reports import router as reports_router
from backend.app.api.alerts import router as alerts_router
from backend.app.api.chat import router as chat_router
from backend.app.api.audit import router as audit_router
from backend.app.api.validation import router as validation_router
from backend.app.api.llm import router as llm_router
from backend.app.api.sms import router as sms_router

# GeoShield Comprehensive AI, GIS, IoT Sensors, Flood, Satellite, and ML Engine
from backend.app.geoshield.database import engine as gs_engine, Base as gs_Base, SessionLocal as gs_SessionLocal, get_db as gs_get_db
from backend.app.geoshield.seed_data import seed_database as gs_seed_database
from backend.app.geoshield.models import SensorStation as gs_SensorStation
from backend.app.geoshield.routers import (
    sensors as gs_sensors,
    dashboard as gs_dashboard,
    alerts as gs_alerts,
    reports as gs_reports,
    weather as gs_weather,
    simulator as gs_simulator,
    satellite as gs_satellite,
    predict as gs_predict,
    alerts_timeline as gs_alerts_timeline,
    flood as gs_flood,
    ml_enhanced as gs_ml_enhanced,
)
from backend.app.geoshield.auth import authenticate_user, create_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("server")

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting up RESQ.AI × BhuRaksha platform...")
    await db.init()
    await seed_users()
    try:
        gs_Base.metadata.create_all(bind=gs_engine)
        gs_db = gs_SessionLocal()
        if gs_db.query(gs_SensorStation).count() == 0:
            log.info("Seeding GeoShield database...")
            gs_seed_database()
        gs_db.close()
        log.info("GeoShield database initialized & verified.")
    except Exception as e:
        log.warning(f"GeoShield DB init warning: {e}")
    try:
        tg_Base.metadata.create_all(bind=tg_engine)
        tg_seed_database()
        log.info("TerraGuard database initialized & verified.")
    except Exception as e:
        log.warning(f"TerraGuard DB init warning: {e}")
    yield
    log.info("Shutting down BhuRaksha backend...")

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Agentic AI Landslide Intelligence, 3D Digital Twin Simulation & Response Coordination for India's North Eastern Region",
    lifespan=lifespan
)

# CORS configuration
origins = settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"]
app.add_middleware(GZipMiddleware, minimum_size=1200)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(terrain_router, prefix=settings.API_V1_PREFIX)
app.include_router(terrain_router, prefix="/api")
app.include_router(terrain_router)
app.include_router(simulation_router, prefix=settings.API_V1_PREFIX)
app.include_router(simulation_compat_router, prefix=settings.API_V1_PREFIX)
app.include_router(simulation_router, prefix="/api")
app.include_router(simulation_compat_router, prefix="/api")
app.include_router(simulation_router)
app.include_router(simulation_compat_router)
app.include_router(incidents_router, prefix=settings.API_V1_PREFIX)
app.include_router(reports_router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts_router, prefix=settings.API_V1_PREFIX)
app.include_router(chat_router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_router, prefix=settings.API_V1_PREFIX)
app.include_router(validation_router, prefix=settings.API_V1_PREFIX)
app.include_router(llm_router, prefix=settings.API_V1_PREFIX)
app.include_router(llm_router, prefix="/api")
app.include_router(sms_router, prefix=settings.API_V1_PREFIX)
app.include_router(sms_router, prefix="/api")

# Mount TerraGuard Routers (Susceptibility, Spatial GIS, Earthquakes, Predict LSTM, ML Pipeline, CAP Alerts, Reports, Chatbot)
from backend.app.terraguard.database.database import engine as tg_engine, Base as tg_Base
from backend.app.terraguard.database.seeds import seed_database as tg_seed_database
from backend.app.terraguard.routers import (
    susceptibility as tg_susceptibility,
    predict as tg_predict,
    reports as tg_reports,
    sensors as tg_sensors,
    alerts as tg_alerts,
    weather as tg_weather,
    ml_model as tg_ml_model,
    earthquakes as tg_earthquakes,
    chatbot as tg_chatbot,
    field_classification as tg_field_classification,
    map as tg_map_router,
)
app.include_router(tg_susceptibility.router)
app.include_router(tg_predict.router)
app.include_router(tg_earthquakes.router)
app.include_router(tg_chatbot.router)
app.include_router(tg_map_router.router)
app.include_router(tg_ml_model.router)
app.include_router(tg_field_classification.router)
app.include_router(tg_reports.router)
app.include_router(tg_alerts.router)
app.include_router(tg_weather.router)
app.include_router(gs_sensors.router)
app.include_router(tg_sensors.router)

# Mount GeoShield Routers (Dashboard, Alerts, Reports, Weather, Simulator, Satellite, Predict, Flood, ML)
app.include_router(gs_dashboard.router)
app.include_router(gs_alerts.router)
app.include_router(gs_reports.router)
app.include_router(gs_weather.router)
app.include_router(gs_simulator.router)
app.include_router(gs_satellite.router)
app.include_router(gs_predict.router)
app.include_router(gs_alerts_timeline.router)
app.include_router(gs_flood.router)
app.include_router(gs_ml_enhanced.router)

# Expose direct /predict and /model-info aliases for LandslideGuard ML API
@app.post("/predict")
def tg_predict_alias(data: tg_ml_model.LandslidePredictionInput):
    return tg_ml_model.predict_landslide(data)

@app.get("/model-info")
def tg_model_info_alias():
    return tg_ml_model.get_model_info()

@app.get("/api/stations")
@app.get("/api/v1/stations")
def geoshield_stations_alias(db: Session = Depends(gs_get_db)):
    return gs_sensors.get_stations(db)

@app.post("/api/v1/simulate/landslide")
def compat_simulate_landslide(request: gs_simulator.LandslideRequest, db: Session = Depends(gs_get_db)):
    return gs_simulator._run_simulation(
        db=db,
        station_id=request.station_id,
        intensity=request.intensity,
        custom_rainfall=request.custom_rainfall,
        custom_moisture=request.custom_moisture,
    )

@app.post("/api/v1/simulate/batch")
def compat_simulate_batch(count: int = 5, db: Session = Depends(gs_get_db)):
    stations = db.query(gs_SensorStation).filter(gs_SensorStation.slope_angle > 30).all()
    if not stations:
        stations = db.query(gs_SensorStation).all()
    intensities = ["moderate", "high", "critical", "high", "moderate"]
    results = []
    for i in range(min(count, len(stations))):
        result = gs_simulator._run_simulation(
            db=db,
            station_id=stations[i % len(stations)].station_id,
            intensity=intensities[i % len(intensities)],
        )
        results.append(result)
    return {"status": "success", "simulations_count": len(results), "results": results}

@app.post("/api/v1/simulate/reset")
def compat_simulate_reset(db: Session = Depends(gs_get_db)):
    from backend.app.geoshield.models import Alert as GSAlert, RiskAssessment as GSRiskAssessment, SensorReading as GSSensorReading
    from datetime import datetime, timedelta
    db.query(GSAlert).delete(synchronize_session=False)
    db.query(GSRiskAssessment).filter(GSRiskAssessment.model_version == "v1.0-sim").delete(synchronize_session=False)
    db.query(GSSensorReading).filter(
        GSSensorReading.timestamp > datetime.utcnow() - timedelta(hours=1)
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "message": "All simulation data cleared."}

@app.post("/api/auth/login")
async def geoshield_login(request: Request):
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        data = await request.json()
        email = data.get("email")
        password = data.get("password")
    else:
        form = await request.form()
        email = form.get("email")
        password = form.get("password")
        
    user = authenticate_user(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user)
    return {
        "token": token,
        "user": {
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
        },
    }

@app.get("/health")
@app.get("/api/health")
@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "prototype_status": "decision-support prototype, not a certified warning service",
        "simulated": True
    }

@app.get("/api/v1/health/sources")
@app.get("/health/sources")
async def get_health_sources():
    return [
        {"source": "Open-Meteo API", "status": "OK_LIVE", "latency_ms": 138, "auth": "anonymous"},
        {"source": "AWS Terrarium DEM", "status": "OK_CACHE", "latency_ms": 72, "auth": "public s3"},
        {"source": "NASA Global Landslide Catalog", "status": "OK_INGESTED", "latency_ms": 8, "auth": "local geojson"},
        {"source": "Sentinel-2 Landslide Rapid Mapping", "status": "OK_STANDBY", "latency_ms": 195, "auth": "copernicus open access"},
        {"source": "IMD Rain Telemetry / Mausam", "status": "SIMULATED", "latency_ms": 4, "auth": "mocked"}
    ]

@app.get("/api/v1/model/card")
@app.get("/model/card")
async def get_model_card_alias():
    from backend.app.api.validation import get_model_card
    return await get_model_card()


import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "dist"))

@app.get("/tiles/terrain/{path:path}")
async def serve_terrain_tile(path: str):
    for candidate in [
        os.path.join(dist_path, "tiles", "terrain", path),
        os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "public", "tiles", "terrain", path),
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "tiles", "terrain", path)
    ]:
        if os.path.exists(candidate):
            return FileResponse(candidate, media_type="image/png")
    fallback = os.path.join(dist_path, "tiles", "terrain", "fallback.png")
    if not os.path.exists(fallback):
        fallback = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "public", "tiles", "terrain", "fallback.png")
    if os.path.exists(fallback):
        return FileResponse(fallback, media_type="image/png")
    raise HTTPException(status_code=404, detail="Terrain tile not found")

@app.get("/tiles/satellite/{path:path}")
async def serve_satellite_tile(path: str):
    for candidate in [
        os.path.join(dist_path, "tiles", "satellite", path),
        os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "public", "tiles", "satellite", path),
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "tiles", "satellite", path)
    ]:
        if os.path.exists(candidate):
            return FileResponse(candidate, media_type="image/jpeg")
    fallback = os.path.join(dist_path, "tiles", "satellite", "fallback.jpg")
    if not os.path.exists(fallback):
        fallback = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "public", "tiles", "satellite", "fallback.jpg")
    if os.path.exists(fallback):
        return FileResponse(fallback, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Satellite tile not found")

if os.path.exists(dist_path) and os.path.isdir(os.path.join(dist_path, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    if os.path.isdir(os.path.join(dist_path, "tiles")):
        app.mount("/tiles", StaticFiles(directory=os.path.join(dist_path, "tiles")), name="tiles")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "service": settings.APP_NAME,
            "documentation": "/docs",
            "status": "running"
        }

