from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import selectinload

from fastapi_app.database import Base, SessionLocal, engine
from fastapi_app.models import AlarmHistory, Device, Incident, Timeline, TopologyLink, User
from fastapi_app.schemas import (
    AlarmHistoryResponse,
    DashboardStatisticsResponse,
    DeviceStatusResponse,
    IncidentResponse,
    IncidentUpdate,
)
from fastapi_app.routers.devices import router as devices_router
from fastapi_app.routers.users import router as users_router
from fastapi_app.services import JWT_ALGORITHM, JWT_SECRET, create_initial_admin, require_roles
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


def migrate_alarm_lifecycle_columns() -> None:
    """Keep existing SQLite databases compatible with the incident lifecycle."""
    columns = {column["name"] for column in inspect(engine).get_columns("alarm_history")}
    statements = []
    if "start_time" not in columns:
        statements.append("ALTER TABLE alarm_history ADD COLUMN start_time DATETIME")
    if "end_time" not in columns:
        statements.append("ALTER TABLE alarm_history ADD COLUMN end_time DATETIME")
    if "duration" not in columns:
        statements.append("ALTER TABLE alarm_history ADD COLUMN duration INTEGER")
    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))
            connection.execute(text("UPDATE alarm_history SET start_time = created_at WHERE start_time IS NULL"))


def migrate_account_incident_columns() -> None:
    """Additive SQLite migration; ORM fields remain portable to PostgreSQL migrations."""
    inspector = inspect(engine)
    additions = {
        "users": {
            "employee_id": "VARCHAR(64)", "name": "VARCHAR(128)", "teams": "VARCHAR(255)",
            "phone": "VARCHAR(64)", "department": "VARCHAR(128)", "last_login_at": "DATETIME",
            "deleted_at": "DATETIME",
        },
        "incidents": {
            "incident_id": "VARCHAR(64)", "alarm_type": "VARCHAR(255)", "severity": "VARCHAR(32)",
            "acknowledged_time": "DATETIME", "recovered_time": "DATETIME", "closed_time": "DATETIME",
            "duration_seconds": "INTEGER", "operator_id": "INTEGER", "engineer_id": "INTEGER",
            "root_cause": "TEXT", "resolution": "TEXT",
        },
    }
    with engine.begin() as connection:
        for table_name, definitions in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, sql_type in definitions.items():
                if column_name not in existing:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {sql_type}"))
        connection.execute(text("UPDATE incidents SET incident_id = 'INC-' || printf('%06d', id) WHERE incident_id IS NULL"))
        connection.execute(text("UPDATE incidents SET alarm_type = COALESCE((SELECT alarm FROM alarm_history WHERE alarm_history.id = incidents.alarm_history_id), 'Device alarm') WHERE alarm_type IS NULL"))
        connection.execute(text("UPDATE incidents SET severity = COALESCE((SELECT severity FROM alarm_history WHERE alarm_history.id = incidents.alarm_history_id), 'Critical') WHERE severity IS NULL"))
        incident_columns = {column["name"] for column in inspect(engine).get_columns("incidents")}
        if "end_time" in incident_columns:
            connection.execute(text("UPDATE incidents SET recovered_time = end_time WHERE recovered_time IS NULL AND end_time IS NOT NULL"))
            connection.execute(text("UPDATE incidents SET closed_time = end_time WHERE closed_time IS NULL AND end_time IS NOT NULL"))
        if "duration" in incident_columns:
            connection.execute(text("UPDATE incidents SET duration_seconds = duration WHERE duration_seconds IS NULL AND duration IS NOT NULL"))


Base.metadata.create_all(bind=engine)
migrate_alarm_lifecycle_columns()
migrate_account_incident_columns()
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


def dashboard_statistics(db) -> dict[str, int]:
    device_counts = dict(db.execute(select(Device.status, func.count()).group_by(Device.status)).all())
    total_alarms = db.scalar(select(func.count(AlarmHistory.id))) or 0
    active_alarms = db.scalar(
        select(func.count(AlarmHistory.id)).where(func.upper(AlarmHistory.status) == "OPEN")
    ) or 0
    critical_alarms = db.scalar(
        select(func.count(AlarmHistory.id)).where(func.lower(AlarmHistory.severity) == "critical")
    ) or 0
    return {
        "total_devices": sum(device_counts.values()),
        "normal_devices": device_counts.get("normal", 0),
        "incident_devices": device_counts.get("incident", 0),
        "maintenance_devices": device_counts.get("maintenance", 0),
        "unknown_devices": device_counts.get("unknown", 0),
        "total_alarms": total_alarms,
        "active_alarms": active_alarms,
        "critical_alarms": critical_alarms,
    }


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


class TeamsReportInput(BaseModel):
    report_type: str = "initial"


def build_ai_diagnosis(device_id: str, alarm: dict[str, Any] | None = None) -> dict[str, Any]:
    alarm = alarm or alarm_for(device_id)
    text = str(alarm.get("alarm", "")).lower()
    status = str(alarm.get("status", "DOWN")).upper()
    if status == "UP":
        root_cause, confidence = "服務已恢復，持續觀察設備穩定度", 0.98
        actions = ["確認告警已清除", "驗證上下游連線", "完成事件結報"]
    elif "cpu" in text:
        root_cause, confidence = "設備 CPU 資源耗盡或異常程序占用", 0.86
        actions = ["確認高負載程序", "檢查近期設定變更", "必要時切換備援路徑"]
    elif any(keyword in text for keyword in ("optical", "los", "fiber")):
        root_cause, confidence = "上游光纖或光模組訊號異常", 0.91
        actions = ["檢查介面光功率", "確認 SFP 模組狀態", "聯絡線路維運人員"]
    else:
        root_cause, confidence = "設備連線或上游介面異常", 0.82
        actions = ["確認設備可達性", "檢查上游介面", "比對近期維護與設定變更"]
    links = db_links()
    affected: set[str] = set()
    pending = [device_id]
    while pending:
        source = pending.pop()
        for link in links:
            if link["source"] == source and link["target"] not in affected:
                affected.add(link["target"])
                pending.append(link["target"])
    return {"device_id": device_id, "root_cause": root_cause, "likely_cause": root_cause,
            "confidence": confidence, "impacted_devices": sorted(affected),
            "suggested_actions": actions, "recommendation": actions,
            "generated_at": datetime.now(timezone.utc).isoformat()}


def build_ai_timeline(device_id: str, alarm: dict[str, Any] | None = None) -> list[dict[str, str]]:
    alarm = alarm or alarm_for(device_id)
    diagnosis = build_ai_diagnosis(device_id, alarm)
    timestamp = str(alarm.get("time") or datetime.now(timezone.utc).isoformat())
    recovered = str(alarm.get("status", "")).upper() == "UP"
    return [
        {"stage": "Alarm", "actor": "Monitoring", "time": timestamp, "detail": str(alarm.get("alarm", "Alarm received"))},
        {"stage": "AI Analysis", "actor": "AI Copilot", "time": diagnosis["generated_at"], "detail": diagnosis["root_cause"]},
        {"stage": "Operator", "actor": "NOC Operator", "time": diagnosis["generated_at"], "detail": "確認告警並執行初步查測"},
        {"stage": "Engineer", "actor": "Network Engineer", "time": diagnosis["generated_at"], "detail": "檢查設備與上游連線"},
        {"stage": "Recovery", "actor": "Monitoring", "time": diagnosis["generated_at"], "detail": "服務已恢復" if recovered else "等待服務恢復"},
    ]


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
    with SessionLocal() as db:
        device = db.scalar(select(Device).where(Device.device_id == alarm.device_id))
        if device is None:
            return JSONResponse(status_code=422, content={"detail": "Unknown device_id"})
        data = alarm.model_dump()
        data.update({"device_name": device.device_name, "ip": device.ip, "device_type": device.device_type})
        event_time = datetime.fromisoformat(alarm.time.replace("Z", "+00:00")) if alarm.time else datetime.now(timezone.utc)
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)
        data["time"] = event_time.isoformat()
        recovered = alarm.status.upper() == "UP"
        device.status = "normal" if recovered else "incident"
        severity = alarm.severity or ("Normal" if device.status == "normal" else "Critical")
        data["severity"] = severity
        history = db.scalar(
            select(AlarmHistory)
            .where(AlarmHistory.device_id == device.device_id, AlarmHistory.status == "OPEN")
            .order_by(AlarmHistory.start_time.desc(), AlarmHistory.id.desc())
        )
        if recovered and history is not None:
            start_time = history.start_time
            if start_time.tzinfo is None:
                start_time = start_time.replace(tzinfo=timezone.utc)
            history.status = "CLOSED"
            history.end_time = event_time
            history.duration = max(0, int((event_time - start_time).total_seconds()))
            history.device_status = device.status
            history.payload = json.dumps(data, ensure_ascii=False)
            incident = db.scalar(select(Incident).where(Incident.alarm_history_id == history.id))
            if incident is not None:
                incident.status = "CLOSED"
                incident.recovered_time = event_time
                incident.closed_time = event_time
                incident.duration_seconds = history.duration
                db.add(Timeline(incident_id=incident.id, event_type="recovery", from_status="OPEN", to_status="RECOVERED", note="Device UP"))
                db.add(Timeline(incident_id=incident.id, event_type="closure", from_status="RECOVERED", to_status="CLOSED", note="Incident automatically closed after recovery"))
        elif not recovered and history is None:
            history = AlarmHistory(
                device_id=device.device_id, alarm=alarm.alarm, status="OPEN",
                severity=severity, device_status=device.status,
                payload=json.dumps(data, ensure_ascii=False), start_time=event_time,
            )
            db.add(history)
            db.flush()
            incident = Incident(
                incident_id=f"INC-{uuid4().hex[:12].upper()}",
                device_id=device.device_id, alarm_history_id=history.id,
                alarm_type=alarm.alarm, severity=severity, status="OPEN", start_time=event_time,
            )
            db.add(incident)
            db.flush()
            db.add(Timeline(incident_id=incident.id, event_type="created", to_status="OPEN", note="Device DOWN"))
        elif not recovered and history is not None:
            history.alarm = alarm.alarm
            history.severity = severity
            history.payload = json.dumps(data, ensure_ascii=False)
            incident = db.scalar(select(Incident).where(Incident.alarm_history_id == history.id))
            if incident is not None:
                incident.alarm_type = alarm.alarm
                incident.severity = severity
        db.commit()
        db.refresh(device)
        if history is not None:
            db.refresh(history)
        device_status = {
            "device_id": device.device_id,
            "status": device.status,
            "updated_at": device.updated_at.isoformat(),
        }
        statistics = dashboard_statistics(db)
        history_id = history.id if history is not None else None
    latest_alarm = {"status": "ok", "alarm": data, "device_status": device_status}
    ai_diagnosis = build_ai_diagnosis(alarm.device_id, data)
    await broadcast({
        "type": "alarm",
        "data": latest_alarm,
        "ai_diagnosis": ai_diagnosis,
        "device_status": device_status,
        "dashboard": statistics,
        "history_id": history_id,
    })
    return {"status": "accepted", "connections": len(clients), "alarm": data}


@app.get("/api/devices/{device_id}/status", response_model=DeviceStatusResponse)
async def get_device_status(device_id: str) -> DeviceStatusResponse:
    with SessionLocal() as db:
        device = db.scalar(select(Device).where(Device.device_id == device_id))
        if device is None:
            return JSONResponse(status_code=404, content={"detail": "Device not found"})
        return DeviceStatusResponse(
            device_id=device.device_id, status=device.status, updated_at=device.updated_at
        )


@app.get("/api/alarms/history", response_model=list[AlarmHistoryResponse])
async def get_alarm_history(device_id: str | None = None, limit: int = 100):
    safe_limit = max(1, min(limit, 500))
    with SessionLocal() as db:
        query = select(AlarmHistory).order_by(AlarmHistory.created_at.desc(), AlarmHistory.id.desc())
        if device_id:
            query = query.where(AlarmHistory.device_id == device_id)
        return list(db.scalars(query.limit(safe_limit)))


def parse_query_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Dates must be ISO 8601") from exc
    return parsed.replace(tzinfo=parsed.tzinfo or timezone.utc)


def incident_query(device_id: str | None, status_value: str | None, date_from: str | None, date_to: str | None):
    query = select(Incident).options(
        selectinload(Incident.operator), selectinload(Incident.engineer),
        selectinload(Incident.timeline).selectinload(Timeline.actor),
    )
    if device_id:
        query = query.where(Incident.device_id == device_id)
    if status_value:
        query = query.where(Incident.status == status_value.upper())
    if start := parse_query_datetime(date_from):
        query = query.where(Incident.start_time >= start)
    if end := parse_query_datetime(date_to):
        query = query.where(Incident.start_time <= end)
    return query.order_by(Incident.start_time.desc(), Incident.id.desc())


@app.get("/api/incidents/active", response_model=list[IncidentResponse])
async def get_active_incidents(device_id: str | None = None, status: str | None = None, date_from: str | None = None, date_to: str | None = None):
    with SessionLocal() as db:
        query = incident_query(device_id, status, date_from, date_to).where(
            Incident.status.in_(("OPEN", "ACKNOWLEDGED", "IN_PROGRESS"))
        )
        return list(db.scalars(query))


@app.get("/api/incidents/history", response_model=list[IncidentResponse])
async def get_incident_history(device_id: str | None = None, status: str | None = None, date_from: str | None = None, date_to: str | None = None):
    with SessionLocal() as db:
        query = incident_query(device_id, status, date_from, date_to)
        if status is None:
            query = query.where(Incident.status.in_(("RECOVERED", "CLOSED")))
        return list(db.scalars(query))


@app.patch("/api/incidents/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: str, data: IncidentUpdate, db_user: User = Depends(require_roles("admin", "engineer", "operator")),
):
    transitions = {
        "OPEN": {"ACKNOWLEDGED"}, "ACKNOWLEDGED": {"IN_PROGRESS"},
        "IN_PROGRESS": {"RECOVERED"}, "RECOVERED": {"CLOSED"}, "CLOSED": set(),
    }
    with SessionLocal() as db:
        incident = db.scalar(select(Incident).where(Incident.incident_id == incident_id))
        if incident is None:
            raise HTTPException(status_code=404, detail="Incident not found")
        if data.status != incident.status and data.status not in transitions[incident.status]:
            raise HTTPException(status_code=409, detail=f"Invalid transition {incident.status} -> {data.status}")
        previous = incident.status
        values = data.model_dump(exclude={"status", "note"}, exclude_unset=True)
        for key, value in values.items():
            setattr(incident, key, value)
        now = datetime.now(timezone.utc)
        incident.status = data.status
        if data.status == "ACKNOWLEDGED":
            incident.acknowledged_time = now
            incident.operator_id = incident.operator_id or db_user.id
        elif data.status == "RECOVERED":
            incident.recovered_time = now
            incident.duration_seconds = max(0, int((now - incident.start_time.replace(tzinfo=incident.start_time.tzinfo or timezone.utc)).total_seconds()))
        elif data.status == "CLOSED":
            incident.closed_time = now
        db.add(Timeline(incident_id=incident.id, event_type="status_change", from_status=previous, to_status=data.status, actor_user_id=db_user.id, note=data.note))
        db.commit()
        return db.scalar(incident_query(None, None, None, None).where(Incident.id == incident.id))


@app.get("/api/dashboard/statistics", response_model=DashboardStatisticsResponse)
async def get_dashboard_statistics() -> DashboardStatisticsResponse:
    with SessionLocal() as db:
        return DashboardStatisticsResponse(**dashboard_statistics(db))


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
        "diagnosis": build_ai_diagnosis(device_id, alarm),
        "maintenance": maintenance["maintenance"],
        "topology": topology,
    }


@app.get("/api/ai/diagnosis/{device_id}")
async def get_ai_diagnosis(device_id: str) -> dict[str, Any]:
    canonical_id = DEVICE_ID_ALIASES.get(device_id, device_id)
    if canonical_id not in db_devices():
        return JSONResponse(status_code=404, content={"detail": "Device not found"})
    return {"status": "ok", "diagnosis": build_ai_diagnosis(canonical_id)}


@app.get("/api/ai/timeline/{device_id}")
async def get_ai_timeline(device_id: str) -> dict[str, Any]:
    canonical_id = DEVICE_ID_ALIASES.get(device_id, device_id)
    if canonical_id not in db_devices():
        return JSONResponse(status_code=404, content={"detail": "Device not found"})
    return {"status": "ok", "device_id": canonical_id, "events": build_ai_timeline(canonical_id)}


def teams_initial_report(device_id: str) -> tuple[str, dict[str, Any]]:
    alarm = alarm_for(device_id)
    diagnosis = build_ai_diagnosis(device_id, alarm)
    impacted = "、".join(diagnosis["impacted_devices"]) or "目前未發現下游設備"
    report = (
        f"【NOC 網路事件初報】\n設備：{alarm.get('device_name', device_id)}（{device_id}）\n"
        f"告警：{alarm.get('alarm')}\n狀態：{alarm.get('status')}\n"
        f"AI 初判：{diagnosis['root_cause']}\n信心值：{round(diagnosis['confidence'] * 100)}%\n"
        f"影響設備：{impacted}\n建議處置：{'；'.join(diagnosis['suggested_actions'])}"
    )
    return report, diagnosis


@app.post("/api/ai/teams-report/{device_id}")
async def generate_teams_report(device_id: str, payload: TeamsReportInput) -> dict[str, Any]:
    canonical_id = DEVICE_ID_ALIASES.get(device_id, device_id)
    if canonical_id not in db_devices():
        return JSONResponse(status_code=404, content={"detail": "Device not found"})
    report, diagnosis = teams_initial_report(canonical_id)
    return {"status": "ok", "device_id": canonical_id, "report_type": payload.report_type,
            "report": report, "diagnosis": diagnosis}


@app.get("/api/report/{device_id}")
async def get_report(device_id: str) -> dict[str, Any]:
    analysis = await get_analysis(device_id)
    report, _ = teams_initial_report(device_id)
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
