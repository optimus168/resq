import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.db.database import db
from backend.app.db.seed import seed_users
from backend.app.services.audit_service import record_audit, verify_audit_chain

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    await db.init()
    await seed_users()
    yield

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["simulated"] is True

@pytest.mark.asyncio
async def test_valid_login_and_me():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "collector@bhuraksha.demo",
            "password": "Approve@RESQ26"
        })
        assert login_res.status_code == 200
        data = login_res.json()
        assert "token" in data
        assert data["user"]["email"] == "collector@bhuraksha.demo"
        assert data["user"]["role"] == "approver"
        
        token = data["token"]
        me_res = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["role"] == "approver"

@pytest.mark.asyncio
async def test_invalid_login():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/login", json={
            "email": "collector@bhuraksha.demo",
            "password": "WrongPassword123!"
        })
        assert res.status_code == 401
        assert "Invalid email or password" in res.json()["detail"]

@pytest.mark.asyncio
async def test_audit_hash_chain_integrity():
    # Insert several audit records
    rec1 = await record_audit("test.action.1", "operator@bhuraksha.demo", {"sample": 1})
    rec2 = await record_audit("test.action.2", "collector@bhuraksha.demo", {"sample": 2})
    rec3 = await record_audit("test.action.3", "admin@bhuraksha.demo", {"sample": 3})
    
    assert rec2["prev_hash"] == rec1["hash"]
    assert rec3["prev_hash"] == rec2["hash"]
    
    verification = await verify_audit_chain()
    assert verification["intact"] is True
    assert verification["total_records"] >= 3

@pytest.mark.asyncio
async def test_role_denial():
    from backend.app.api.auth import require_roles
    from fastapi import Depends
    
    # Define a dummy endpoint requiring 'approver'
    @app.get("/api/v1/test/approver-only")
    async def approver_only(user=Depends(require_roles("approver"))):
        return {"ok": True}
        
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login as operator
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "operator@bhuraksha.demo",
            "password": "Operate@RESQ26"
        })
        token = login_res.json()["token"]
        
        # Operator tries to access approver-only endpoint -> 403 Forbidden
        res = await ac.get("/api/v1/test/approver-only", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 403
        assert "unauthorized" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_rate_limiting_lockout():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        for _ in range(5):
            await ac.post("/api/v1/auth/login", json={
                "email": "victim@bhuraksha.demo",
                "password": "WrongPassword"
            })
            
        # 6th attempt should be blocked with 429
        res = await ac.post("/api/v1/auth/login", json={
            "email": "victim@bhuraksha.demo",
            "password": "WrongPassword"
        })
        assert res.status_code == 429
        assert "too many failed" in res.json()["detail"].lower()
