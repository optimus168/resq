"""
FastAPI Router for TextBee.dev SMS Gateway Integration.
Reference: https://github.com/textbee/textbee

Endpoints:
- GET  /api/v1/sms/status      -> Gateway config, registered +91 Officer phone numbers & dispatch logs
- POST /api/v1/sms/config      -> Configure TEXTBEE_API_KEY, device_id, and Officer +91 10-digit phone
- POST /api/v1/sms/send        -> Send critical SMS via https://api.textbee.dev/api/v1/gateway/send-sms
- POST /api/v1/sms/send-bulk   -> Send bulk SMS via https://api.textbee.dev/api/v1/gateway/send-bulk-sms
- POST /api/v1/sms/test        -> Send test critical SMS to registered Officer +91 phone number
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.api.auth import get_officer_or_current_user
from backend.app.db.database import db
from backend.app.services.textbee_service import (
    get_officer_sms_recipients,
    get_textbee_config,
    list_recent_sms_dispatches,
    normalize_indian_phone,
    notify_officers_critical_sms,
    save_textbee_config,
    send_bulk_sms_via_textbee,
    send_sms_via_textbee,
)

router = APIRouter(prefix="/sms", tags=["TextBee.dev Critical SMS Gateway"])


class SendSmsRequest(BaseModel):
    recipients: Optional[List[str]] = Field(
        default=None,
        description="List of recipient phone numbers (10-digit Indian numbers or +91XXXXXXXXXX). Defaults to registered Officer phones if omitted.",
    )
    message: str = Field(..., min_length=1, max_length=1600)
    event_type: str = Field(default="critical_alert")
    report_id: Optional[str] = None


class BulkSmsItem(BaseModel):
    recipients: List[str] = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=1600)


class SendBulkSmsRequest(BaseModel):
    messages: List[BulkSmsItem] = Field(..., min_length=1)
    event_type: str = Field(default="bulk_critical_alert")
    report_id: Optional[str] = None


class SmsGatewayConfigRequest(BaseModel):
    textbee_api_key: Optional[str] = None
    textbee_device_id: Optional[str] = None
    textbee_phone_name: Optional[str] = None
    textbee_base_url: Optional[str] = None
    officer_phone: Optional[str] = Field(
        default=None,
        description="10-digit Indian mobile number (automatically prefixed with +91)",
    )


class TestSmsPayload(BaseModel):
    phone: Optional[str] = Field(
        default=None,
        description="Any phone number to test sending to (10-digit Indian number or +91XXXXXXXXXX)",
    )
    message: Optional[str] = Field(
        default=None,
        description="Optional custom test message text",
    )
    device_id: Optional[str] = None


@router.get("/status")
async def get_sms_gateway_status(user: dict = Depends(get_officer_or_current_user)) -> Dict[str, Any]:
    cfg = await get_textbee_config()
    officer_recipients = await get_officer_sms_recipients()
    dispatches = await list_recent_sms_dispatches(limit=25)
    default_p = cfg.get("default_phone") or (officer_recipients[0] if officer_recipients else "")
    return {
        "gateway": "textbee.dev",
        "configured": cfg["configured"],
        "api_key": cfg["api_key"],
        "textbee_api_key": cfg["api_key"],
        "masked_api_key": cfg["masked_api_key"],
        "device_id": cfg.get("device_id", ""),
        "phone_name": cfg.get("phone_name", "motorola moto g34 5G"),
        "send_sms_endpoint": cfg["send_sms_endpoint"],
        "send_bulk_sms_endpoint": cfg["send_bulk_sms_endpoint"],
        "country_code": "+91",
        "officer_recipients": officer_recipients,
        "default_phone": default_p,
        "current_user_phone": user.get("phone") or default_p,
        "recent_dispatches": dispatches,
    }


@router.post("/config")
async def update_sms_gateway_config(
    req: SmsGatewayConfigRequest,
    user: dict = Depends(get_officer_or_current_user),
) -> Dict[str, Any]:
    if req.officer_phone is not None:
        try:
            normalized_phone = normalize_indian_phone(req.officer_phone, allow_empty=True)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        await db.execute(
            "UPDATE users SET phone = ?, sms_enabled = 1 WHERE email = ?",
            (normalized_phone, user["email"]),
        )
        if normalized_phone:
            await db.execute(
                """
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('OFFICER_DEFAULT_PHONE', ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                """,
                (normalized_phone,),
            )
            from backend.app.services.textbee_service import update_env_file
            update_env_file("TEXTBEE_DEFAULT_PHONE", normalized_phone)

    cfg = await save_textbee_config(
        api_key=req.textbee_api_key,
        device_id=req.textbee_device_id,
        base_url=req.textbee_base_url,
        phone_name=req.textbee_phone_name,
    )
    officer_recipients = await get_officer_sms_recipients()
    return {
        "status": "updated",
        "configured": cfg["configured"],
        "masked_api_key": cfg["masked_api_key"],
        "device_id": cfg.get("device_id", ""),
        "phone_name": cfg.get("phone_name", ""),
        "officer_recipients": officer_recipients,
    }


@router.post("/send")
async def send_single_sms_endpoint(
    req: SendSmsRequest,
    user: dict = Depends(get_officer_or_current_user),
) -> Dict[str, Any]:
    try:
        recipients = req.recipients
        if not recipients:
            recipients = await get_officer_sms_recipients()
        return await send_sms_via_textbee(
            recipients=recipients,
            message=req.message,
            event_type=req.event_type,
            report_id=req.report_id,
            triggered_by=user.get("email", "officer"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/send-bulk")
async def send_bulk_sms_endpoint(
    req: SendBulkSmsRequest,
    user: dict = Depends(get_officer_or_current_user),
) -> Dict[str, Any]:
    try:
        return await send_bulk_sms_via_textbee(
            messages=[m.model_dump() for m in req.messages],
            event_type=req.event_type,
            report_id=req.report_id,
            triggered_by=user.get("email", "officer"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/test")
async def send_test_officer_sms(
    payload: Optional[TestSmsPayload] = None,
    phone: Optional[str] = None,
    user: dict = Depends(get_officer_or_current_user),
) -> Dict[str, Any]:
    """
    Test SMS delivery by dispatching a test alert to any target phone number,
    or to all registered Officers if no phone number is provided.
    """
    target_phone = (payload.phone if payload and payload.phone else phone) or ""
    custom_msg = (payload.message if payload and payload.message else "")

    dev_name = "motorola moto g34 5G"
    default_msg = (
        f"[RESQ.AI x BhuRaksha CRITICAL TEST] Officer SMS gateway verified via TextBee ({dev_name}). "
        f"Recipient active for emergency disaster dispatches. "
        f"Sender: {user.get('name', 'District Collector')}. "
        f"Ref: TEST-{user.get('email', 'officer')[:6]}."
    )
    final_msg = custom_msg.strip() if custom_msg.strip() else default_msg

    if target_phone.strip():
        try:
            norm = normalize_indian_phone(target_phone.strip())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        # Send test SMS directly to the specified target phone number
        return await send_sms_via_textbee(
            recipients=[norm],
            message=final_msg,
            event_type="officer_custom_test_sms",
            triggered_by=user.get("email", "officer"),
        )

    # If no specific phone provided, send to all registered officer numbers
    return await notify_officers_critical_sms(
        message=final_msg,
        event_type="officer_test_sms",
        triggered_by=user.get("email", "officer"),
    )
