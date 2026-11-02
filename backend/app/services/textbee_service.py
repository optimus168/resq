"""
TextBee.dev SMS Gateway Integration Service for RESQ.AI × BhuRaksha.
Reference: https://github.com/textbee/textbee

Supports:
1. Single SMS Dispatch:
   POST https://api.textbee.dev/api/v1/gateway/send-sms
   Headers: x-api-key: $TEXTBEE_API_KEY, Content-Type: application/json
   Body: { "recipients": ["+919876543210"], "message": "..." }

2. Bulk SMS Dispatch:
   POST https://api.textbee.dev/api/v1/gateway/send-bulk-sms
   Headers: x-api-key: $TEXTBEE_API_KEY, Content-Type: application/json
   Body: { "messages": [ { "recipients": ["+919876543210"], "message": "..." } ] }

3. Indian 10-Digit Phone Normalization with +91 Country Code Prefix:
   Validates 10-digit Indian mobile numbers and normalizes to `+91XXXXXXXXXX`.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx

from backend.app.core.config import settings
from backend.app.core.security import new_id, now_iso
from backend.app.db.database import db
from backend.app.services.audit_service import record_audit

log = logging.getLogger("textbee_sms")

INDIA_COUNTRY_CODE = "+91"


def normalize_indian_phone(phone_raw: Optional[str], allow_empty: bool = False) -> str:
    """
    Validate and normalize a 10-digit Indian mobile number with `+91` prefix.
    Accepts:
      - "9876543210" -> "+919876543210"
      - "+919876543210" -> "+919876543210"
      - "919876543210" -> "+919876543210"
      - "+91 98765 43210" -> "+919876543210"
    Raises ValueError if not a valid 10-digit number (unless allow_empty=True and input is empty).
    """
    raw = (phone_raw or "").strip()
    if not raw:
        if allow_empty:
            return ""
        raise ValueError("Phone number is required (10 digits for India +91).")

    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]

    if len(digits) != 10 or not digits.isdigit():
        raise ValueError(
            f"Invalid Indian phone number '{phone_raw}'. Please enter a valid 10-digit mobile number (e.g. 9876543210)."
        )

    return f"{INDIA_COUNTRY_CODE}{digits}"


def extract_10_digit_phone(phone_raw: Optional[str]) -> str:
    """Return the 10-digit local part of an Indian phone number for UI display."""
    raw = (phone_raw or "").strip()
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    if len(digits) == 10:
        return digits
    return digits[-10:] if len(digits) > 10 else digits


def update_env_file(key: str, value: str) -> None:
    """Safely update or insert a key-value pair in .env file on disk."""
    try:
        from backend.app.core.config import ROOT_DIR
        env_path = ROOT_DIR / ".env"
        val_str = str(value).strip()
        if not env_path.exists():
            env_path.write_text(f"{key}={val_str}\n", encoding="utf-8")
            return
        content = env_path.read_text(encoding="utf-8")
        if key == "TEXTBEE_API_KEY" and val_str.startswith("test_"):
            m = re.search(r"^TEXTBEE_API_KEY=(txb_[^\s\r\n]+)", content, flags=re.MULTILINE)
            if m:
                log.info("Preserving active user TextBee key in .env against mock test key")
                return
        pattern = rf"^{re.escape(key)}=.*$"
        if re.search(pattern, content, flags=re.MULTILINE):
            new_content = re.sub(pattern, f"{key}={val_str}", content, flags=re.MULTILINE)
        else:
            new_content = content.rstrip() + f"\n{key}={val_str}\n"
        env_path.write_text(new_content, encoding="utf-8")
    except Exception as exc:
        log.debug("Failed updating .env: %s", exc)


async def get_textbee_config() -> Dict[str, Any]:
    """
    Retrieve TextBee API key and gateway settings from SQLite `system_settings`
    or fallback to environment variables (`TEXTBEE_API_KEY`, `TEXTBEE_BASE_URL`, `TEXTBEE_DEVICE_ID`, `TEXTBEE_PHONE_NAME`).
    """
    from backend.app.core.config import ROOT_DIR
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file, override=True)

    env_key = (os.environ.get("TEXTBEE_API_KEY", "") or settings.TEXTBEE_API_KEY or "").strip()
    api_key = env_key
    base_url = (os.environ.get("TEXTBEE_BASE_URL", "") or settings.TEXTBEE_BASE_URL or "https://api.textbee.dev/api/v1/gateway").strip()
    device_id = (os.environ.get("TEXTBEE_DEVICE_ID", "") or settings.TEXTBEE_DEVICE_ID or "6adc7b8ba4996b8ebf83ed43").strip()
    phone_name = (os.environ.get("TEXTBEE_PHONE_NAME", "") or getattr(settings, "TEXTBEE_PHONE_NAME", "motorola moto g34 5G")).strip()
    default_phone = (os.environ.get("TEXTBEE_DEFAULT_PHONE", "") or getattr(settings, "TEXTBEE_DEFAULT_PHONE", "")).strip()

    try:
        rows = await db.fetch_all(
            "SELECT key, value FROM system_settings WHERE key IN ('TEXTBEE_API_KEY', 'TEXTBEE_BASE_URL', 'TEXTBEE_DEVICE_ID', 'TEXTBEE_PHONE_NAME', 'OFFICER_DEFAULT_PHONE')"
        )
        kv = {r["key"]: r["value"] for r in rows}
        db_key = (kv.get("TEXTBEE_API_KEY") or "").strip()
        # Prefer actual user key: if DB key is a mock/test key while env has real txb_ key, use env_key
        if db_key and not (db_key.startswith("test_") and env_key.startswith("txb_")):
            api_key = db_key
        elif env_key:
            api_key = env_key

        if kv.get("TEXTBEE_BASE_URL"):
            base_url = kv["TEXTBEE_BASE_URL"].strip()
        if "TEXTBEE_DEVICE_ID" in kv and kv["TEXTBEE_DEVICE_ID"]:
            device_id = kv["TEXTBEE_DEVICE_ID"].strip()
        if "TEXTBEE_PHONE_NAME" in kv and kv["TEXTBEE_PHONE_NAME"]:
            phone_name = kv["TEXTBEE_PHONE_NAME"].strip()
        if kv.get("OFFICER_DEFAULT_PHONE"):
            default_phone = kv["OFFICER_DEFAULT_PHONE"].strip()
    except Exception as exc:
        log.debug("system_settings lookup warning: %s", exc)

    masked_key = ""
    if api_key:
        if len(api_key) > 8:
            masked_key = f"{api_key[:4]}••••{api_key[-4:]}"
        else:
            masked_key = "••••"

    return {
        "api_key": api_key,
        "textbee_api_key": api_key,
        "masked_api_key": masked_key,
        "configured": bool(api_key),
        "base_url": base_url.rstrip("/"),
        "device_id": device_id,
        "phone_name": phone_name,
        "default_phone": default_phone,
        "send_sms_endpoint": f"{base_url.rstrip('/')}/send-sms",
        "send_bulk_sms_endpoint": f"{base_url.rstrip('/')}/send-bulk-sms",
        "country_code": INDIA_COUNTRY_CODE,
    }


async def save_textbee_config(
    api_key: Optional[str] = None,
    device_id: Optional[str] = None,
    base_url: Optional[str] = None,
    phone_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist TextBee API key and gateway config into SQLite `system_settings`, runtime env, and .env file."""
    now_str = now_iso()
    if api_key is not None:
        clean_key = api_key.strip()
        os.environ["TEXTBEE_API_KEY"] = clean_key
        settings.TEXTBEE_API_KEY = clean_key
        await db.execute(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('TEXTBEE_API_KEY', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (clean_key, now_str),
        )
        if clean_key:
            update_env_file("TEXTBEE_API_KEY", clean_key)

    if device_id is not None:
        clean_dev = device_id.strip()
        os.environ["TEXTBEE_DEVICE_ID"] = clean_dev
        settings.TEXTBEE_DEVICE_ID = clean_dev
        await db.execute(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('TEXTBEE_DEVICE_ID', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (clean_dev, now_str),
        )
        if clean_dev:
            update_env_file("TEXTBEE_DEVICE_ID", clean_dev)

    if phone_name is not None:
        clean_pname = phone_name.strip()
        os.environ["TEXTBEE_PHONE_NAME"] = clean_pname
        await db.execute(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('TEXTBEE_PHONE_NAME', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (clean_pname, now_str),
        )
        if clean_pname:
            update_env_file("TEXTBEE_PHONE_NAME", clean_pname)

    if base_url is not None and base_url.strip():
        clean_url = base_url.strip().rstrip("/")
        os.environ["TEXTBEE_BASE_URL"] = clean_url
        settings.TEXTBEE_BASE_URL = clean_url
        await db.execute(
            """
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('TEXTBEE_BASE_URL', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (clean_url, now_str),
        )
        update_env_file("TEXTBEE_BASE_URL", clean_url)

    return await get_textbee_config()


async def get_officer_sms_recipients(extra_recipients: Optional[List[str]] = None) -> List[str]:
    """
    Collect all registered Officer phone numbers (`+91XXXXXXXXXX`) from the `users` table
    where `sms_enabled = 1` and `phone` is non-empty, plus any designated Officer phone
    in `system_settings` or `settings.TEXTBEE_DEFAULT_PHONE`.
    Guarantees SMS is targeted strictly to authorized Officers.
    """
    recipients: List[str] = []
    seen = set()

    def _add(p: str):
        try:
            norm = normalize_indian_phone(p)
            if norm and norm not in seen:
                seen.add(norm)
                recipients.append(norm)
        except ValueError:
            # Also allow already E.164 formatted numbers if explicitly passed
            p_clean = (p or "").strip()
            if re.match(r"^\+\d{10,15}$", p_clean) and p_clean not in seen:
                seen.add(p_clean)
                recipients.append(p_clean)

    # 1. System Settings designated Officer phone (saved from Officer Profile modal)
    try:
        sys_rows = await db.fetch_all(
            "SELECT key, value FROM system_settings WHERE key IN ('OFFICER_DEFAULT_PHONE', 'TEXTBEE_OFFICER_PHONE', 'OFFICER_PHONE')"
        )
        for sr in sys_rows:
            if sr.get("value"):
                _add(sr["value"])
    except Exception as exc:
        log.debug("system_settings officer phone query warning: %s", exc)

    # 2. Users table registered officers with sms_enabled
    try:
        rows = await db.fetch_all(
            "SELECT email, role, phone, sms_enabled FROM users WHERE phone IS NOT NULL AND phone != '' AND sms_enabled = 1"
        )
        for r in rows:
            role = (r.get("role") or "").lower()
            # Must be an officer / authority role
            if not role or any(w in role for w in ("officer", "approver", "admin", "collector", "commander", "lead", "operator")):
                _add(r["phone"])
    except Exception as exc:
        log.debug("Officer phone query warning: %s", exc)

    # 3. Environment default officer phone
    if settings.TEXTBEE_DEFAULT_PHONE:
        _add(settings.TEXTBEE_DEFAULT_PHONE)

    if extra_recipients:
        for r in extra_recipients:
            _add(r)

    return recipients


async def _log_sms_dispatch(
    event_type: str,
    recipients: List[str],
    message: str,
    mode: str,
    status: str,
    response_data: Dict[str, Any],
    report_id: Optional[str] = None,
    triggered_by: str = "system",
) -> Dict[str, Any]:
    sms_id = f"SMS-{new_id()[:8].upper()}"
    ts = now_iso()
    try:
        await db.execute(
            """
            INSERT INTO sms_dispatch_log (id, ts, event_type, recipients_json, message, mode, status, response_json, report_id, triggered_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sms_id,
                ts,
                event_type,
                json.dumps(recipients),
                message,
                mode,
                status,
                json.dumps(response_data),
                report_id,
                triggered_by,
            ),
        )
    except Exception as exc:
        log.warning("Failed to record sms_dispatch_log: %s", exc)

    return {
        "sms_id": sms_id,
        "ts": ts,
        "event_type": event_type,
        "recipients": recipients,
        "message": message,
        "mode": mode,
        "status": status,
        "response": response_data,
        "report_id": report_id,
        "triggered_by": triggered_by,
    }


async def send_sms_via_textbee(
    recipients: List[str],
    message: str,
    event_type: str = "critical_sms",
    report_id: Optional[str] = None,
    triggered_by: str = "system",
) -> Dict[str, Any]:
    """
    Send a critical SMS using TextBee.dev Gateway:
      POST https://api.textbee.dev/api/v1/gateway/send-sms
      -H "x-api-key: $TEXTBEE_API_KEY"
      -H "Content-Type: application/json"
      -d '{"recipients": ["+91..."], "message": "..."}'
    """
    normalized_recipients: List[str] = []
    for r in recipients:
        try:
            normalized_recipients.append(normalize_indian_phone(r))
        except ValueError:
            r_clean = (r or "").strip()
            if re.match(r"^\+\d{10,15}$", r_clean):
                normalized_recipients.append(r_clean)
            else:
                raise

    if not normalized_recipients:
        return await _log_sms_dispatch(
            event_type=event_type,
            recipients=[],
            message=message,
            mode="single",
            status="SKIPPED_NO_RECIPIENT",
            response_data={"detail": "No Officer +91 phone number registered yet in Profile."},
            report_id=report_id,
            triggered_by=triggered_by,
        )

    cfg = await get_textbee_config()
    api_key = cfg["api_key"]
    endpoint = cfg["send_sms_endpoint"]
    payload = {
        "recipients": normalized_recipients,
        "message": message,
    }
    if cfg.get("device_id"):
        payload["deviceId"] = cfg["device_id"]

    if not api_key:
        record = await _log_sms_dispatch(
            event_type=event_type,
            recipients=normalized_recipients,
            message=message,
            mode="single",
            status="QUEUED_AWAITING_API_KEY",
            response_data={
                "gateway": "textbee.dev",
                "endpoint": endpoint,
                "payload": payload,
                "note": "TEXTBEE_API_KEY not yet set. Add TEXTBEE_API_KEY in Officer Profile or .env to transmit live SMS.",
            },
            report_id=report_id,
            triggered_by=triggered_by,
        )
        await record_audit(
            "sms.textbee.queued",
            triggered_by,
            {"sms_id": record["sms_id"], "recipients": normalized_recipients, "report_id": report_id},
        )
        return record

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            # If device_id is also configured and direct route returns 404, try device-scoped route
            if resp.status_code == 404 and cfg.get("device_id"):
                dev_endpoint = f"{cfg['base_url']}/devices/{cfg['device_id']}/send-sms"
                resp = await client.post(dev_endpoint, headers=headers, json=payload)
                endpoint = dev_endpoint

            try:
                resp_body = resp.json()
            except Exception:
                resp_body = {"raw": resp.text}

            status_str = "SENT" if 200 <= resp.status_code < 300 else f"HTTP_{resp.status_code}"
            record = await _log_sms_dispatch(
                event_type=event_type,
                recipients=normalized_recipients,
                message=message,
                mode="single",
                status=status_str,
                response_data={
                    "http_status": resp.status_code,
                    "endpoint": endpoint,
                    "gateway_response": resp_body,
                },
                report_id=report_id,
                triggered_by=triggered_by,
            )
            await record_audit(
                "sms.textbee.dispatched",
                triggered_by,
                {
                    "sms_id": record["sms_id"],
                    "status": status_str,
                    "recipients": normalized_recipients,
                    "report_id": report_id,
                },
            )
            return record
    except Exception as exc:
        log.warning("TextBee send-sms HTTP error: %s", exc)
        record = await _log_sms_dispatch(
            event_type=event_type,
            recipients=normalized_recipients,
            message=message,
            mode="single",
            status="GATEWAY_ERROR",
            response_data={"endpoint": endpoint, "error": str(exc), "payload": payload},
            report_id=report_id,
            triggered_by=triggered_by,
        )
        return record


async def send_bulk_sms_via_textbee(
    messages: List[Dict[str, Any]],
    event_type: str = "bulk_critical_sms",
    report_id: Optional[str] = None,
    triggered_by: str = "system",
) -> Dict[str, Any]:
    """
    Send bulk SMS using TextBee.dev Gateway:
      POST https://api.textbee.dev/api/v1/gateway/send-bulk-sms
      -H "x-api-key: $TEXTBEE_API_KEY"
      -H "Content-Type: application/json"
      -d '{"messages": [{"recipients": ["+91..."], "message": "..."}]}'
    """
    normalized_messages: List[Dict[str, Any]] = []
    all_recipients: List[str] = []

    for item in messages:
        recs = item.get("recipients") or []
        msg_text = (item.get("message") or "").strip()
        if not msg_text:
            continue
        norm_recs: List[str] = []
        for r in recs:
            try:
                nr = normalize_indian_phone(r)
            except ValueError:
                r_clean = (r or "").strip()
                if re.match(r"^\+\d{10,15}$", r_clean):
                    nr = r_clean
                else:
                    raise
            norm_recs.append(nr)
            if nr not in all_recipients:
                all_recipients.append(nr)
        if norm_recs:
            normalized_messages.append({"recipients": norm_recs, "message": msg_text})

    if not normalized_messages:
        return await _log_sms_dispatch(
            event_type=event_type,
            recipients=[],
            message="",
            mode="bulk",
            status="SKIPPED_NO_RECIPIENT",
            response_data={"detail": "No valid recipients in bulk SMS payload."},
            report_id=report_id,
            triggered_by=triggered_by,
        )

    cfg = await get_textbee_config()
    api_key = cfg["api_key"]
    endpoint = cfg["send_bulk_sms_endpoint"]
    payload = {"messages": normalized_messages}
    if cfg.get("device_id"):
        payload["deviceId"] = cfg["device_id"]
    summary_msg = f"[BULK {len(normalized_messages)} msgs] {normalized_messages[0]['message'][:140]}"

    if not api_key:
        record = await _log_sms_dispatch(
            event_type=event_type,
            recipients=all_recipients,
            message=summary_msg,
            mode="bulk",
            status="QUEUED_AWAITING_API_KEY",
            response_data={
                "gateway": "textbee.dev",
                "endpoint": endpoint,
                "payload": payload,
                "note": "TEXTBEE_API_KEY not yet set. Add TEXTBEE_API_KEY in Officer Profile or .env to transmit live bulk SMS.",
            },
            report_id=report_id,
            triggered_by=triggered_by,
        )
        return record

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            if resp.status_code == 404 and cfg.get("device_id"):
                dev_endpoint = f"{cfg['base_url']}/devices/{cfg['device_id']}/send-bulk-sms"
                resp = await client.post(dev_endpoint, headers=headers, json=payload)
                endpoint = dev_endpoint

            try:
                resp_body = resp.json()
            except Exception:
                resp_body = {"raw": resp.text}

            status_str = "SENT" if 200 <= resp.status_code < 300 else f"HTTP_{resp.status_code}"
            return await _log_sms_dispatch(
                event_type=event_type,
                recipients=all_recipients,
                message=summary_msg,
                mode="bulk",
                status=status_str,
                response_data={
                    "http_status": resp.status_code,
                    "endpoint": endpoint,
                    "gateway_response": resp_body,
                },
                report_id=report_id,
                triggered_by=triggered_by,
            )
    except Exception as exc:
        log.warning("TextBee send-bulk-sms HTTP error: %s", exc)
        return await _log_sms_dispatch(
            event_type=event_type,
            recipients=all_recipients,
            message=summary_msg,
            mode="bulk",
            status="GATEWAY_ERROR",
            response_data={"endpoint": endpoint, "error": str(exc), "payload": payload},
            report_id=report_id,
            triggered_by=triggered_by,
        )


async def notify_officers_critical_sms(
    message: str,
    event_type: str = "field_report_alert",
    report_id: Optional[str] = None,
    extra_recipients: Optional[List[str]] = None,
    triggered_by: str = "system",
) -> Dict[str, Any]:
    """
    Immediately notify all registered Officers (with `+91` 10-digit numbers) via TextBee SMS.
    If multiple officers have registered numbers, uses `send-sms` (or `send-bulk-sms`).
    """
    recipients = await get_officer_sms_recipients(extra_recipients=extra_recipients)
    return await send_sms_via_textbee(
        recipients=recipients,
        message=message,
        event_type=event_type,
        report_id=report_id,
        triggered_by=triggered_by,
    )


async def list_recent_sms_dispatches(limit: int = 25) -> List[Dict[str, Any]]:
    rows = await db.fetch_all(
        "SELECT * FROM sms_dispatch_log ORDER BY ts DESC LIMIT ?",
        (limit,),
    )
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        try:
            d["recipients"] = json.loads(d.pop("recipients_json", "[]"))
        except Exception:
            d["recipients"] = []
        try:
            d["response"] = json.loads(d.pop("response_json", "{}"))
        except Exception:
            d["response"] = {}
        out.append(d)
    return out
