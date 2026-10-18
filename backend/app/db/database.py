import aiosqlite
import json
import logging
from typing import Any, Optional
from backend.app.core.config import settings

log = logging.getLogger("db")

CREATE_TABLES_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
    identifier TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    last_attempt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_ledger (
    seq INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    incident_id TEXT,
    data TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    hash TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    aoi TEXT NOT NULL,
    aoi_name TEXT NOT NULL,
    status TEXT NOT NULL,
    trigger TEXT NOT NULL,
    scenario_json TEXT NOT NULL,
    sim_overrides_json TEXT NOT NULL,
    plans_json TEXT NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 0,
    assumptions_json TEXT NOT NULL,
    agent_status_json TEXT NOT NULL,
    state_json TEXT NOT NULL DEFAULT '{}',
    busy INTEGER NOT NULL DEFAULT 0,
    correlation_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    ts TEXT NOT NULL,
    agent TEXT NOT NULL,
    type TEXT NOT NULL,
    plan_version INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_events_incident ON agent_events(incident_id, seq);

CREATE TABLE IF NOT EXISTS bus_events (
    event_id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    published_at TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    source TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim_runs (
    id TEXT PRIMARY KEY,
    incident_id TEXT,
    config_hash TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim_frames (
    run_id TEXT PRIMARY KEY,
    frames_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS field_reports (
    id TEXT PRIMARY KEY,
    client_id TEXT UNIQUE NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    aoi TEXT,
    photo_path TEXT,
    by_user TEXT NOT NULL,
    role TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_ts REAL NOT NULL,
    duplicate_of TEXT,
    triage_json TEXT NOT NULL,
    verification TEXT NOT NULL DEFAULT 'UNVERIFIED',
    verified_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_field_reports_aoi ON field_reports(aoi);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    aoi TEXT NOT NULL,
    plan_version INTEGER NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    channels_json TEXT NOT NULL,
    audience_json TEXT NOT NULL,
    messages_json TEXT NOT NULL,
    translation_source TEXT NOT NULL,
    needs_human_review INTEGER NOT NULL DEFAULT 1,
    history_json TEXT NOT NULL,
    receipts_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path

    async def init(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(CREATE_TABLES_SQL)
            try:
                await db.execute("ALTER TABLE incidents ADD COLUMN state_json TEXT DEFAULT '{}'")
            except Exception:
                pass
            await db.commit()
            log.info("Database schemas initialized at %s", self.db_path)

    async def get_connection(self) -> aiosqlite.Connection:
        conn = await aiosqlite.connect(self.db_path)
        conn.row_factory = aiosqlite.Row
        return conn

    async def execute(self, query: str, params: tuple = ()) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute(query, params)
            await db.commit()
            return cur.rowcount

    async def fetch_one(self, query: str, params: tuple = ()) -> Optional[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(query, params) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def fetch_all(self, query: str, params: tuple = ()) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]

db = Database(settings.DATABASE_PATH)
