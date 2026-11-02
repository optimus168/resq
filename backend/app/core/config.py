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
    
    # LLM Settings (Local Qwen3-4B primary + deterministic fallback)
    HF_HOME: str = os.environ.get("HF_HOME", str(ROOT_DIR / ".cache" / "huggingface"))
    QWEN_MODEL_ID: str = os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen3-4B")
    QWEN_ADAPTER_DIR: str = os.environ.get("QWEN_ADAPTER_DIR", str(ROOT_DIR / "data" / "models" / "qwen3_4b_qlora_adapter"))
    QWEN_ENABLED: bool = os.environ.get("QWEN_ENABLED", "true").lower() in ("1", "true", "yes")
    QWEN_LOAD_IN_4BIT: bool = os.environ.get("QWEN_LOAD_IN_4BIT", "true").lower() in ("1", "true", "yes")
    QWEN_MAX_NEW_TOKENS: int = int(os.environ.get("QWEN_MAX_NEW_TOKENS", "384"))
    QWEN_TEMPERATURE: float = float(os.environ.get("QWEN_TEMPERATURE", "0.2"))
    QWEN_TOP_P: float = float(os.environ.get("QWEN_TOP_P", "0.9"))
    QWEN_TIMEOUT_SECONDS: float = float(os.environ.get("QWEN_TIMEOUT_SECONDS", "45.0"))
    QWEN_ENABLE_THINKING: bool = os.environ.get("QWEN_ENABLE_THINKING", "false").lower() in ("1", "true", "yes")
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")
    LLM_MODEL: str = os.environ.get("LLM_MODEL", "Qwen/Qwen3-4B")
    FORCED_OFFLINE: bool = os.environ.get("FORCED_OFFLINE", "false").lower() in ("1", "true", "yes")

    # TextBee.dev SMS Gateway Settings (https://github.com/textbee/textbee)
    TEXTBEE_API_KEY: str = os.environ.get("TEXTBEE_API_KEY", "")
    TEXTBEE_BASE_URL: str = os.environ.get("TEXTBEE_BASE_URL", "https://api.textbee.dev/api/v1/gateway")
    TEXTBEE_DEVICE_ID: str = os.environ.get("TEXTBEE_DEVICE_ID", "6adc7b8ba4996b8ebf83ed43")
    TEXTBEE_PHONE_NAME: str = os.environ.get("TEXTBEE_PHONE_NAME", "motorola moto g34 5G")
    TEXTBEE_DEFAULT_PHONE: str = os.environ.get("TEXTBEE_DEFAULT_PHONE", "")
    
    # CORS
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")

settings = Settings()
os.environ.setdefault("HF_HOME", settings.HF_HOME)
Path(settings.HF_HOME).mkdir(parents=True, exist_ok=True)
Path(settings.DATAPACK_DIR).mkdir(parents=True, exist_ok=True)
