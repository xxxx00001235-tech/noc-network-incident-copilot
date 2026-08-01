from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="NOC Alarm API")

ROLE_PERMISSIONS = {
    "admin": {"read", "operate", "manage_devices", "manage_access"},
    "operator": {"read", "operate"},
    "engineer": {"read", "manage_devices"},
}


def required_permission(method: str, path: str) -> str | None:
    if not path.startswith("/api/"):
        return None
    if method == "POST" and path == "/api/alarms":
        return "operate"
    return "read"


@app.middleware("http")
async def permission_middleware(request: Request, call_next):
    permission = required_permission(request.method, request.url.path)
    if permission is not None:
        role = request.headers.get("X-NOC-Role", "")
        if role not in ROLE_PERMISSIONS or permission not in ROLE_PERMISSIONS[role]:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
        request.state.role = role
    return await call_next(request)
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FASTAPI_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,"
        "https://noc-network-incident-copilot.pages.dev,"
        "https://xxxx00001235-tech.github.io",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
clients: set[WebSocket] = set()
latest_alarm: dict[str, Any] | None = None

INVENTORY_PATH = Path(__file__).resolve().parents[1] / "inventory" / "device-inventory.json"
INVENTORY = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
DEVICES: dict[str, dict[str, Any]] = {
    item["id"]: {
        "device_name": item["name"], "ip": item["ip"],
        "device_type": item["type"], "status": item["status"],
        "region": item["region"], "site": item["site"],
        **({"maintenance": item["maintenance"]} if "maintenance" in item else {}),
    }
    for item in INVENTORY["devices"]
}
TOPOLOGY_LINKS = INVENTORY["links"]


def device_node(device_id: str) -> dict[str, Any]:
    details = DEVICES.get(device_id, {})
    return {"device_id": device_id, **details}


def alarm_for(device_id: str) -> dict[str, Any]:
    if latest_alarm and latest_alarm["alarm"].get("device_id") == device_id:
        return latest_alarm["alarm"]
    details = DEVICES.get(device_id, {})
    return {
        "device_id": device_id,
        "device_name": details.get("device_name", device_id),
        "alarm": "Device Down" if details.get("status") == "incident" else "Device status check",
        "status": "DOWN" if details.get("status") == "incident" else "UP",
        "severity": "Critical" if details.get("status") == "incident" else "Normal",
    }


@app.get("/api/inventory")
async def get_inventory() -> dict[str, Any]:
    return {"status": "ok", **INVENTORY}


class AlarmInput(BaseModel):
    device_id: str
    device_name: str
    alarm: str
    status: str = "DOWN"
    time: str | None = None
    location: str | None = None
    ip: str | None = None
    device_type: str | None = None
    severity: str | None = None
    owner: str | None = None
    email: str | None = None


async def broadcast(message: dict[str, Any]) -> None:
    stale: list[WebSocket] = []
    for client in tuple(clients):
        try:
            await client.send_json(message)
        except Exception:
            stale.append(client)
    for client in stale:
        clients.discard(client)


@app.post("/api/alarms", status_code=202)
async def publish_alarm(alarm: AlarmInput) -> dict[str, Any]:
    global latest_alarm
    if alarm.device_id not in DEVICES:
        return JSONResponse(status_code=422, content={"detail": "Unknown device_id"})
    data = alarm.model_dump()
    device = DEVICES[alarm.device_id]
    data.update({"device_name": device["device_name"], "ip": device["ip"], "device_type": device["device_type"]})
    data["time"] = data["time"] or datetime.now(timezone.utc).isoformat()
    latest_alarm = {"status": "ok", "alarm": data}
    await broadcast({"type": "alarm", "data": latest_alarm})
    return {"status": "accepted", "connections": len(clients), "alarm": data}


@app.get("/api/alarms/latest")
async def get_latest_alarm() -> dict[str, Any]:
    if latest_alarm is not None:
        return latest_alarm
    return {
        "status": "ok",
        "alarm": {
            "device_id": "SW-TP-NG-001",
            "device_name": "SW-TP-NG-001",
            "alarm": "WebSocket service ready",
            "status": "UP",
            "severity": "Normal",
            "time": datetime.now(timezone.utc).isoformat(),
        },
    }


@app.get("/api/topology/{device_id}")
async def get_topology(device_id: str) -> dict[str, Any]:
    upstream_ids = [link["source"] for link in TOPOLOGY_LINKS if link["target"] == device_id]
    downstream_ids = [link["target"] for link in TOPOLOGY_LINKS if link["source"] == device_id]
    affected_ids = downstream_ids if device_id == "SW-TP-NG-001" else []
    node_ids = set(DEVICES)
    node_ids.add(device_id)
    return {
        "status": "ok",
        "fault_device": device_node(device_id),
        "upstream": [device_node(item) for item in upstream_ids],
        "downstream": [device_node(item) for item in downstream_ids],
        "affected_device_ids": affected_ids,
        "nodes": [device_node(item) for item in sorted(node_ids)],
        "links": TOPOLOGY_LINKS,
    }


@app.get("/api/maintenance/{device_id}")
async def get_maintenance(device_id: str) -> dict[str, Any]:
    device_maintenance = DEVICES.get(device_id, {}).get("maintenance")
    under_maintenance = device_maintenance is not None
    maintenance = None
    if device_maintenance:
        maintenance = {
            "status": "scheduled",
            "start_time": "2026-08-01T01:00:00+08:00",
            "end_time": "2026-08-01T03:00:00+08:00",
            "description": device_maintenance["content"],
            "owner": {"username": device_maintenance["owner"], "email": "amy.chen@example.com"},
        }
    return {"status": "ok", "device_id": device_id, "under_maintenance": under_maintenance, "maintenance": maintenance}


@app.get("/api/analyze/{device_id}")
async def get_analysis(device_id: str) -> dict[str, Any]:
    alarm = alarm_for(device_id)
    topology = await get_topology(device_id)
    maintenance = await get_maintenance(device_id)
    return {
        "status": "ok",
        "device_id": device_id,
        "alarm": alarm,
        "diagnosis": {
            "likely_cause": alarm["alarm"],
            "confidence": 0.92,
            "recommendation": ["確認設備電源與管理介面", "檢查上游連線狀態"],
        },
        "maintenance": maintenance["maintenance"],
        "topology": topology,
    }


@app.get("/api/report/{device_id}")
async def get_report(device_id: str) -> dict[str, Any]:
    analysis = await get_analysis(device_id)
    alarm = analysis["alarm"]
    report = (
        f"【事件初報】\n設備：{alarm['device_name']}（{device_id}）\n"
        f"告警：{alarm['alarm']}\n狀態：{alarm['status']}\n"
        f"初步研判：{analysis['diagnosis']['likely_cause']}"
    )
    return {"status": "ok", "device_id": device_id, "report": report, "analysis": analysis}


@app.websocket("/ws/alarms")
async def alarm_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    clients.add(websocket)
    await websocket.send_json({"type": "connected"})
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=25)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(websocket)
