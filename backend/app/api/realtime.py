import asyncio
from typing import Literal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect


router = APIRouter(tags=["realtime"])
clients: set[WebSocket] = set()

AlarmEventType = Literal["alarm.changed", "alarm.created", "alarm.updated"]


async def broadcast_alarm_event(
    event_type: AlarmEventType = "alarm.changed", alarm_id: int | None = None
) -> None:
    message: dict[str, str | int] = {"type": event_type}
    if alarm_id is not None:
        message["alarm_id"] = alarm_id

    stale: list[WebSocket] = []
    for client in tuple(clients):
        try:
            await client.send_json(message)
        except Exception:
            stale.append(client)
    for client in stale:
        clients.discard(client)


@router.websocket("/ws/alarms")
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
