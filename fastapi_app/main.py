from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import os
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="NOC Alarm API")
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

DEVICES: dict[str, dict[str, Any]] = {
    "RTR-CORE-001": {"device_name": "RTR-CORE-001", "ip": "10.0.0.1", "device_type": "Router", "status": "normal", "region": "台北", "site": "南港"},
    "SW-TP-NG-001": {"device_name": "SW-TP-NG-001", "ip": "10.10.1.1", "device_type": "Core Switch", "status": "incident", "region": "台北", "site": "南港"},
    "SW-NG-DIST-01": {"device_name": "SW-NG-DIST-01", "ip": "10.10.2.1", "device_type": "Distribution Switch", "status": "normal", "region": "台北", "site": "南港"},
    "SW-NG-DIST-02": {"device_name": "SW-NG-DIST-02", "ip": "10.10.2.2", "device_type": "Distribution Switch", "status": "normal", "region": "台北", "site": "南港"},
    "AP-NG-01": {"device_name": "AP-NG-01", "ip": "10.10.3.1", "device_type": "Access Point", "status": "normal", "region": "台北", "site": "南港"},
    "RTR-TP-XY-001": {"device_name": "RTR-TP-XY-001", "ip": "10.20.1.1", "device_type": "Router", "status": "maintenance", "region": "台北", "site": "信義"},
}

TOPOLOGY_LINKS = [
    {"id": "l1", "source": "RTR-CORE-001", "target": "SW-TP-NG-001"},
    {"id": "l2", "source": "SW-TP-NG-001", "target": "SW-NG-DIST-01"},
    {"id": "l3", "source": "SW-TP-NG-001", "target": "SW-NG-DIST-02"},
    {"id": "l4", "source": "SW-NG-DIST-01", "target": "AP-NG-01"},
    {"id": "l5", "source": "RTR-TP-XY-001", "target": "SW-TP-NG-001", "backup": True},
]


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
    data = alarm.model_dump()
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
            "device_id": "NOC-DEMO-001",
            "device_name": "NOC-DEMO-001",
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
    under_maintenance = device_id == "RTR-TP-XY-001"
    maintenance = None
    if under_maintenance:
        maintenance = {
            "status": "scheduled",
            "start_time": "2026-08-01T01:00:00+08:00",
            "end_time": "2026-08-01T03:00:00+08:00",
            "description": "例行韌體安全更新",
            "owner": {"username": "Amy Chen", "email": "amy.chen@example.com"},
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
