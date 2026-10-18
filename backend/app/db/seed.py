import os
from backend.app.db.database import db
from backend.app.core.security import hash_password, now_iso, new_id

SEED_USERS = [
    ("admin", os.environ.get("ADMIN_EMAIL", "admin@bhuraksha.demo"), os.environ.get("ADMIN_PASSWORD", "Admin@RESQ26"), "SSDMA Regional Admin"),
    ("approver", os.environ.get("APPROVER_EMAIL", "collector@bhuraksha.demo"), os.environ.get("APPROVER_PASSWORD", "Approve@RESQ26"), "District Collector (Authorized Approver)"),
    ("operator", os.environ.get("OPERATOR_EMAIL", "operator@bhuraksha.demo"), os.environ.get("OPERATOR_PASSWORD", "Operate@RESQ26"), "District EOC Duty Officer"),
    ("field_officer", os.environ.get("FIELD_EMAIL", "field@bhuraksha.demo"), os.environ.get("FIELD_PASSWORD", "Field@RESQ26"), "Field Geotech Surveyor"),
    ("analyst", "analyst@bhuraksha.demo", "Analyst@RESQ26", "Disaster Data Analyst"),
    ("citizen", "citizen@bhuraksha.demo", "Citizen@RESQ26", "Community Volunteer"),
]

async def seed_users():
    for role, email, password, name in SEED_USERS:
        existing = await db.fetch_one("SELECT id FROM users WHERE email = ?", (email,))
        if not existing:
            await db.execute(
                """
                INSERT INTO users (id, email, name, role, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (new_id(), email, name, role, hash_password(password), now_iso())
            )
        else:
            # Update password hash if needed
            await db.execute(
                "UPDATE users SET password_hash = ? WHERE email = ?",
                (hash_password(password), email)
            )
