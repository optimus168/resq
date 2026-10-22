# BhuRaksha Model Context Protocol (MCP) Server

**Standard:** Anthropic Model Context Protocol (MCP) JSON-RPC 2.0  
**Endpoint:** `python -m backend.app.mcp.server` (stdio) or HTTP SSE bridge  
**Key Value Proposition:** *"Any external agentic AI client can invoke our landslide digital twin as an authoritative tool."*

---

## 1. Exposed Tool Catalogue

| Tool Name | Scope | Permission | Description |
|---|---|---|---|
| `risk_assess` | Geotechnical / ML | `READ_ONLY` | Evaluates deterministic multi-criteria risk score, Caine I–D threshold, and geomorphic drivers for an AOI. |
| `sim_run` | Digital Twin Physics | `READ_ONLY` | Runs coupled 3D simulation (unsaturated infiltration $\to$ infinite-slope FS $\to$ D8 runout $\to$ asset exposure). |
| `gis_exposure` | Infrastructure | `READ_ONLY` | Returns exposed road segments (NH10, NH6), settlements, hospitals, and designated shelters. |
| `report_triage` | Security / Vision | `READ_ONLY` | Scans field reports for prompt-injection attacks and assigns credibility flags. |
| `alert_dispatch` | Consequential Action | `APPROVAL_REQUIRED` | **Blocked for autonomous agents.** Returns `APPROVAL_REQUIRED`; must be authorized by a human District Collector. |

---

## 2. Configuration for Claude Desktop / Cursor / External Clients

Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bhuraksha": {
      "command": "/home/aero/RESQ/.venv/bin/python3",
      "args": ["-m", "backend.app.mcp.server"],
      "cwd": "/home/aero/RESQ",
      "env": {
        "PYTHONPATH": "."
      }
    }
  }
}
```

---

## 3. Human Gate & Security Enforcement

When an external agent invokes `alert_dispatch`, the MCP server strictly enforces Rule 4:
```json
{
  "status": "APPROVAL_REQUIRED",
  "error": "Autonomous action blocked by Human-in-the-Loop Gate",
  "detail": "Public evacuation alerts require authenticated authorization by District Collector (COLLECTOR role) bound to an active plan version."
}
```
Autonomous agents cannot bypass the human gate over MCP.
