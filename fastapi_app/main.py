from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel


app = FastAPI(title="NOC Alarm API")
clients: set[WebSocket] = set()
latest_alarm: dict[str, Any] | None = None


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
