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
from sqlalchemy import select

from fastapi_app.database import Base, SessionLocal, engine
from fastapi_app.models import Device, TopologyLink, User
from fastapi_app.routers.devices import router as devices_router
from fastapi_app.routers.users import router as users_router
from fastapi_app.services import JWT_ALGORITHM, JWT_SECRET, create_initial_admin
from jose import JWTError, jwt


app = FastAPI(title="NOC Alarm API")

ROLE_PERMISSIONS = {
    "admin": {"read", "operate", "manage_devices", "manage_access"},
    "operator": {"read", "operate"},
    "engineer": {"read", "manage_devices"},
}


def required_permission(method: str, path: str) -> str | None:
    if path in {"/api/register", "/api/login", "/api/me"} or path.startswith("/api/users") or path.startswith("/api/admin/") or path == "/api/pending-users":
        return None
    if not path.startswith("/api/"):
        return None
    if method == "POST" and path == "/api/alarms":
        return "operate"
    return "read"


@app.middleware("http")
async def permission_middleware(request: Request, call_next):
    permission = required_permission(request.method, request.url.path)
    if permission is not None:
        role = ""
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            try:
                payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
                with SessionLocal() as db:
                    user = db.get(User, int(payload.get("sub", "")))
                    if user is None or user.status != "approved":
                        raise ValueError
                    role = user.role
            except (JWTError, TypeError, ValueError):
                return JSONResponse(status_code=401, content={"detail": "Invalid authentication token"})
        else:
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
clients: set[WebSocket] = set()
latest_alarm: dict[str, Any] | None = None

INVENTORY_PATH = Path(__file__).resolve().parents[1] / "inventory" / "device-inventory.json"
INVENTORY = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))

DEMO_OVERRIDES = {
    "RTR-TP-NG-CORE-001": {"device_name": "台北南港核心路由器", "ip": "192.168.176.10", "device_type": "Core Router", "layer": "Core", "region": "台北", "site": "南港", "status": "normal"},
    "SW-TP-NG-DIST-001": {"device_name": "台北南港匯聚交換器", "ip": "192.168.176.20", "device_type": "Distribution Switch", "layer": "Distribution", "region": "台北", "site": "南港", "status": "normal"},
    "OLT-TP-NG-ACCESS-001": {"device_name": "台北南港接取設備", "ip": "192.168.176.30", "device_type": "OLT", "layer": "Access", "region": "台北", "site": "南港", "status": "normal"},
}
DEVICE_ID_ALIASES = {"RTR-CORE-001": "RTR-TP-NG-CORE-001", "SW-TP-NG-001": "SW-TP-NG-DIST-001", "OLT-HC-001": "OLT-TP-NG-ACCESS-001", "RTR-TP-XY-001": "RTR-TP-NG-BACKUP-001"}


def infer_layer(device_type: str) -> str:
    lowered = device_type.lower()
    if "core" in lowered or "internet" in lowered or device_type == "Router":
        return "Core"
    if "distribution" in lowered:
        return "Distribution"
    return "Access"


def seed_devices(db) -> None:
    if db.scalar(select(Device.id).limit(1)) is not None:
        return
    for item in INVENTORY["devices"]:
        values = {"device_id": item["id"], "device_name": item["name"], "ip": item["ip"], "device_type": item["type"], "layer": infer_layer(item["type"]), "region": item["region"], "site": item["site"], "status": item["status"]}
        values.update(DEMO_OVERRIDES.get(item["id"], {}))
        db.add(Device(**values))
    db.flush()
    for link in INVENTORY["links"]:
        db.add(TopologyLink(source_device_id=link["source"], target_device_id=link["target"], link_type="backup" if link.get("backup") else "primary", status="normal"))
    db.commit()


Base.metadata.create_all(bind=engine)
with SessionLocal() as startup_db:
    create_initial_admin(startup_db)
    seed_devices(startup_db)
app.include_router(users_router)
app.include_router(devices_router)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


def db_devices() -> dict[str, dict[str, Any]]:
    with SessionLocal() as db:
        return {item.device_id: {"device_name": item.device_name, "ip": item.ip, "device_type": item.device_type, "status": item.status, "region": item.region, "site": item.site, "location": item.location} for item in db.scalars(select(Device))}


def db_links() -> list[dict[str, Any]]:
    with SessionLocal() as db:
        return [{"id": str(link.id), "source": link.source_device_id, "target": link.target_device_id, **({"backup": True} if link.link_type == "backup" else {}), "link_type": link.link_type, "status": link.status} for link in db.scalars(select(TopologyLink))]


def device_node(device_id: str) -> dict[str, Any]:
    details = db_devices().get(DEVICE_ID_ALIASES.get(device_id, device_id), {})
    return {"device_id": device_id, **details}


def alarm_for(device_id: str) -> dict[str, Any]:
    if latest_alarm and latest_alarm["alarm"].get("device_id") == device_id:
        return latest_alarm["alarm"]
    details = db_devices().get(device_id, {})
    return {
        "device_id": device_id,
        "device_name": details.get("device_name", device_id),
        "alarm": "Device Down" if details.get("status") == "incident" else "Device status check",
        "status": "DOWN" if details.get("status") == "incident" else "UP",
        "severity": "Critical" if details.get("status") == "incident" else "Normal",
    }


@app.get("/api/inventory")
async def get_inventory() -> dict[str, Any]:
    devices = [{"id": key, "name": value["device_name"], "type": value["device_type"], **{field: value.get(field) for field in ("ip", "status", "region", "site")}} for key, value in db_devices().items()]
    return {"status": "ok", "version": INVENTORY.get("version", 1), "devices": devices, "links": db_links(), "topology": INVENTORY.get("topology", [])}


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
    devices = db_devices()
    if alarm.device_id not in devices:
        return JSONResponse(status_code=422, content={"detail": "Unknown device_id"})
    data = alarm.model_dump()
    device = devices[alarm.device_id]
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
    devices, links = db_devices(), db_links()
    canonical_id = DEVICE_ID_ALIASES.get(device_id, device_id)
    if canonical_id not in devices:
        return JSONResponse(status_code=404, content={"detail": "找不到設備"})
    upstream_ids = [link["source"] for link in links if link["target"] == canonical_id]
    downstream_ids = [link["target"] for link in links if link["source"] == canonical_id]
    affected: set[str] = set()
    pending = list(downstream_ids)
    while pending:
        item = pending.pop()
        if item in affected:
            continue
        affected.add(item)
        pending.extend(link["target"] for link in links if link["source"] == item)
    node_ids = set(devices)
    node_ids.add(device_id)
    return {
        "status": "ok",
        "fault_device": device_node(device_id),
        "upstream": [device_node(item) for item in upstream_ids],
        "downstream": [device_node(item) for item in downstream_ids],
        "affected_device_ids": sorted(affected),
        "nodes": [device_node(item) for item in sorted(node_ids)],
        "links": links,
    }


@app.get("/api/maintenance/{device_id}")
async def get_maintenance(device_id: str) -> dict[str, Any]:
    inventory_device = next((item for item in INVENTORY["devices"] if item["id"] == device_id), {})
    device_maintenance = inventory_device.get("maintenance")
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
