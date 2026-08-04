from fastapi.testclient import TestClient
from sqlalchemy import select

from fastapi_app.database import SessionLocal
from fastapi_app.main import app
from fastapi_app.models import AlarmHistory, Device


client = TestClient(app)
HEADERS = {"X-NOC-Role": "operator"}
DEVICE_ID = "SW-TP-NG-DIST-001"


def inject(status: str, severity: str) -> dict:
    response = client.post(
        "/api/alarms",
        headers=HEADERS,
        json={
            "device_id": DEVICE_ID,
            "device_name": "ignored-client-value",
            "alarm": "Sprint 6 integration test",
            "status": status,
            "severity": severity,
        },
    )
    assert response.status_code == 202, response.text
    return response.json()


def test_alarm_updates_sqlite_device_status_and_history() -> None:
    inject("DOWN", "Critical")

    status = client.get(f"/api/devices/{DEVICE_ID}/status", headers=HEADERS)
    assert status.status_code == 200
    assert status.json()["status"] == "incident"

    history = client.get(
        "/api/alarms/history", headers=HEADERS, params={"device_id": DEVICE_ID, "limit": 1}
    )
    assert history.status_code == 200
    assert history.json()[0]["device_status"] == "incident"
    with SessionLocal() as db:
        assert db.scalar(select(Device).where(Device.device_id == DEVICE_ID)).status == "incident"
        assert db.scalar(
            select(AlarmHistory).where(AlarmHistory.device_id == DEVICE_ID).order_by(AlarmHistory.id.desc())
        ) is not None

    inject("UP", "Normal")
    assert client.get(f"/api/devices/{DEVICE_ID}/status", headers=HEADERS).json()["status"] == "normal"


def test_dashboard_statistics_reflect_latest_alarm() -> None:
    inject("DOWN", "Critical")
    statistics = client.get("/api/dashboard/statistics", headers=HEADERS)
    assert statistics.status_code == 200
    body = statistics.json()
    assert body["total_devices"] >= 1
    assert body["incident_devices"] >= 1
    assert body["total_alarms"] >= 1
    assert body["active_alarms"] >= 1
    inject("UP", "Normal")


def test_websocket_broadcast_contains_realtime_noc_snapshot() -> None:
    with client.websocket_connect("/ws/alarms") as websocket:
        assert websocket.receive_json() == {"type": "connected"}
        inject("DOWN", "Critical")
        message = websocket.receive_json()
        assert message["type"] == "alarm"
        assert message["device_status"]["device_id"] == DEVICE_ID
        assert message["device_status"]["status"] == "incident"
        assert message["dashboard"]["incident_devices"] >= 1
        assert isinstance(message["history_id"], int)
    inject("UP", "Normal")


def test_new_read_apis_keep_rbac() -> None:
    for path in (
        f"/api/devices/{DEVICE_ID}/status",
        "/api/alarms/history",
        "/api/dashboard/statistics",
    ):
        assert client.get(path).status_code == 403
