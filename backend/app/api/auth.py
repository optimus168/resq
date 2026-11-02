import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel
from backend.app.db.database import db
from backend.app.core.security import (
    verify_password,
    create_access_token,
    decode_token,
    public_user,
    now_iso
)
from backend.app.services.audit_service import record_audit
from backend.app.services.textbee_service import (
    normalize_indian_phone,
    extract_10_digit_phone,
    get_textbee_config,
    save_textbee_config,
    update_env_file,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Officer Profile"])

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    user: dict
    token: str

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    sms_enabled: Optional[bool] = True
    textbee_api_key: Optional[str] = None
    textbee_device_id: Optional[str] = None

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    payload = decode_token(token)
    user = await db.fetch_one("SELECT id, email, name, role, phone, sms_enabled FROM users WHERE id = ?", (payload["sub"],))
    if not user:
        raise HTTPException(status_code=401, detail="User account not found")
        
    return user

async def get_current_user_optional(request: Request) -> dict | None:
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        
    if not token:
        return None
        
    try:
        payload = decode_token(token)
        user = await db.fetch_one("SELECT id, email, name, role, phone, sms_enabled FROM users WHERE id = ?", (payload["sub"],))
        return user
    except Exception:
        return None


async def get_officer_or_current_user(user: dict | None = Depends(get_current_user_optional)) -> dict:
    """Resolve authenticated user or default to the District Collector Officer account."""
    if user:
        return user
    default_officer = await db.fetch_one(
        "SELECT id, email, name, role, phone, sms_enabled FROM users WHERE email = ? OR role = 'approver' LIMIT 1",
        ("collector@bhuraksha.demo",),
    )
    if default_officer:
        return default_officer
    return {
        "id": "officer-session",
        "email": "collector@bhuraksha.demo",
        "name": "District Collector (Authorized Approver)",
        "role": "approver",
        "phone": "",
        "sms_enabled": 1,
    }

def require_roles(*allowed_roles: str):
    async def role_guard(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            await record_audit(
                "authz.denied",
                current_user["email"],
                {"required_roles": list(allowed_roles), "user_role": current_user["role"]}
            )
            raise HTTPException(
                status_code=403,
                detail=f"Role '{current_user['role']}' is unauthorized. Required: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_guard

@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, response: Response):
    email = body.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    rate_id = f"{client_ip}:{email}"
    
    # Rate limiting check (5 attempts / 15 mins)
    attempt = await db.fetch_one("SELECT count, last_attempt FROM login_attempts WHERE identifier = ?", (rate_id,))
    if attempt and attempt["count"] >= 5:
        last_time = datetime.fromisoformat(attempt["last_attempt"])
        if (datetime.now(timezone.utc) - last_time).total_seconds() < 900:
            raise HTTPException(status_code=429, detail="Too many failed login attempts. Account temporarily locked for 15 minutes.")
            
    user = await db.fetch_one("SELECT id, email, name, role, phone, sms_enabled, password_hash FROM users WHERE email = ?", (email,))
    if not user or not verify_password(body.password, user["password_hash"]):
        # Increment failure
        if attempt:
            await db.execute(
                "UPDATE login_attempts SET count = count + 1, last_attempt = ? WHERE identifier = ?",
                (now_iso(), rate_id)
            )
        else:
            await db.execute(
                "INSERT INTO login_attempts (identifier, count, last_attempt) VALUES (?, 1, ?)",
                (rate_id, now_iso())
            )
        await record_audit("auth.failed", email, {"ip": client_ip})
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # Reset attempts on success
    await db.execute("DELETE FROM login_attempts WHERE identifier = ?", (rate_id,))
    
    token = create_access_token(user["id"], user["email"], user["role"])
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=43200,
        path="/"
    )
    
    await record_audit("auth.login", email, {"role": user["role"], "ip": client_ip})
    return {"user": public_user(user), "token": token}

@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    cfg = await get_textbee_config()
    u = public_user(current_user)
    u["textbee_configured"] = cfg["configured"]
    u["masked_api_key"] = cfg["masked_api_key"]
    return u

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_officer_or_current_user)):
    cfg = await get_textbee_config()
    u = public_user(current_user)

    # Persistent fallback for phone from system_settings / .env if current user has empty phone
    if not u.get("phone") and cfg.get("default_phone"):
        u["phone"] = cfg["default_phone"]
        u["phone_10digit"] = extract_10_digit_phone(cfg["default_phone"])

    # Pass actual configured key to UI so input box shows the API key
    u["textbee_api_key"] = cfg["api_key"]
    u["api_key"] = cfg["api_key"]
    u["textbee_configured"] = cfg["configured"]
    u["masked_api_key"] = cfg["masked_api_key"]
    u["textbee_device_id"] = cfg.get("device_id", "")
    u["phone_name"] = cfg.get("phone_name", "motorola moto g34 5G")
    u["send_sms_endpoint"] = cfg["send_sms_endpoint"]
    u["send_bulk_sms_endpoint"] = cfg["send_bulk_sms_endpoint"]
    return u

@router.post("/profile")
@router.put("/profile")
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: dict = Depends(get_officer_or_current_user),
):
    normalized_phone = current_user.get("phone") or ""
    if body.phone is not None:
        try:
            normalized_phone = normalize_indian_phone(body.phone, allow_empty=True)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    new_name = (body.name or current_user.get("name") or "District Collector").strip()
    sms_enabled_int = 1 if (body.sms_enabled if body.sms_enabled is not None else True) else 0

    # 1. Update users table for current user
    await db.execute(
        "UPDATE users SET name = ?, phone = ?, sms_enabled = ? WHERE email = ?",
        (new_name, normalized_phone, sms_enabled_int, current_user["email"]),
    )
    # Also update collector account to guarantee cross-session persistence
    if normalized_phone:
        await db.execute(
            "UPDATE users SET phone = ?, sms_enabled = 1 WHERE email = 'collector@bhuraksha.demo'",
            (normalized_phone,),
        )

    # 2. Persist phone to system_settings AND .env
    now_str = now_iso()
    if normalized_phone:
        await db.execute(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('OFFICER_DEFAULT_PHONE', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (normalized_phone, now_str),
        )
        os.environ["TEXTBEE_DEFAULT_PHONE"] = normalized_phone
        from backend.app.core.config import settings
        settings.TEXTBEE_DEFAULT_PHONE = normalized_phone
        update_env_file("TEXTBEE_DEFAULT_PHONE", normalized_phone)

    # 3. Persist TextBee API key and device ID
    if body.textbee_api_key is not None or body.textbee_device_id is not None:
        await save_textbee_config(
            api_key=body.textbee_api_key,
            device_id=body.textbee_device_id,
        )

    updated = await db.fetch_one(
        "SELECT id, email, name, role, phone, sms_enabled FROM users WHERE email = ?",
        (current_user["email"],),
    ) or {
        **current_user,
        "name": new_name,
        "phone": normalized_phone,
        "sms_enabled": sms_enabled_int,
    }

    await record_audit(
        "profile.updated",
        current_user["email"],
        {
            "phone": normalized_phone,
            "sms_enabled": bool(sms_enabled_int),
            "textbee_key_updated": body.textbee_api_key is not None,
        },
    )

    cfg = await get_textbee_config()
    u = public_user(updated)
    u["textbee_api_key"] = cfg["api_key"]
    u["api_key"] = cfg["api_key"]
    u["textbee_configured"] = cfg["configured"]
    u["masked_api_key"] = cfg["masked_api_key"]
    u["textbee_device_id"] = cfg.get("device_id", "")
    u["phone_name"] = cfg.get("phone_name", "motorola moto g34 5G")
    return u

@router.post("/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    await record_audit("auth.logout", current_user["email"], {})
    return {"status": "logged_out"}
