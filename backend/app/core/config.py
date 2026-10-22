import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent
load_dotenv(ROOT_DIR / ".env")

class Settings(BaseModel):
    APP_NAME: str = "RESQ.AI × BhuRaksha"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True
    
    # Storage & DB
    DATABASE_PATH: str = os.environ.get("DATABASE_PATH", str(ROOT_DIR / "bhuraksha.db"))
    DATAPACK_DIR: str = os.environ.get("DATAPACK_DIR", str(ROOT_DIR / "data" / "datapacks"))
    SIM_RUN_DIR: str = os.environ.get("SIM_RUN_DIR", str(ROOT_DIR / "data" / "simulation_runs"))
    
    # Security
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "9f2c7b1e4a8d3f6c0b5e9a2d7c4f1e8b3a6d9c2f5e8b1a4d7c0f3e6b9a2d5c8f")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12 hours
    
    # Roles
    ROLES: list[str] = ["admin", "approver", "operator", "field_officer", "analyst", "citizen"]
    
    # LLM Settings
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")
    LLM_MODEL: str = os.environ.get("LLM_MODEL", "claude-sonnet-4-6")
    FORCED_OFFLINE: bool = False
    
    # CORS
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")

settings = Settings()
Path(settings.DATAPACK_DIR).mkdir(parents=True, exist_ok=True)
