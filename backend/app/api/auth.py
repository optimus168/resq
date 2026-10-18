from datetime import datetime, timezone, timedelta
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

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    user: dict
    token: str

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    payload = decode_token(token)
    user = await db.fetch_one("SELECT id, email, name, role FROM users WHERE id = ?", (payload["sub"],))
    if not user:
        raise HTTPException(status_code=401, detail="User account not found")
        
    return user

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
            
    user = await db.fetch_one("SELECT id, email, name, role, password_hash FROM users WHERE email = ?", (email,))
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
    return public_user(current_user)

@router.post("/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    await record_audit("auth.logout", current_user["email"], {})
    return {"status": "logged_out"}
