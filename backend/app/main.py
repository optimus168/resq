import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.db.seed import seed_users
from backend.app.api.auth import router as auth_router
from backend.app.api.terrain import router as terrain_router
from backend.app.api.simulation import router as simulation_router
from backend.app.api.incidents import router as incidents_router
from backend.app.api.reports import router as reports_router
from backend.app.api.alerts import router as alerts_router
from backend.app.api.chat import router as chat_router
from backend.app.api.audit import router as audit_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("server")

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting up RESQ.AI × BhuRaksha platform...")
    await db.init()
    await seed_users()
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
app.include_router(simulation_router, prefix=settings.API_V1_PREFIX)
app.include_router(incidents_router, prefix=settings.API_V1_PREFIX)
app.include_router(reports_router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts_router, prefix=settings.API_V1_PREFIX)
app.include_router(chat_router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_router, prefix=settings.API_V1_PREFIX)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "prototype_status": "decision-support prototype, not a certified warning service",
        "simulated": True
    }

@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "documentation": "/docs",
        "status": "running"
    }
