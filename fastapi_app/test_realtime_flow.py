from fastapi.testclient import TestClient
from sqlalchemy import select

from fastapi_app.database import SessionLocal
from fastapi_app.main import app
from fastapi_app.models import AlarmHistory, Device, Incident


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
        assert message["type"] == "alarm.created"
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


def test_down_up_closes_same_incident_with_complete_timing() -> None:
    inject("UP", "Normal")
    down_time = "2026-08-05T01:00:00+00:00"
    up_time = "2026-08-05T01:02:30+00:00"
    down = client.post("/api/alarms", headers=HEADERS, json={
        "device_id": DEVICE_ID, "device_name": "ignored", "alarm": "VM Device DOWN",
        "status": "DOWN", "severity": "Critical", "time": down_time,
    })
    assert down.status_code == 202
    duplicate = client.post("/api/alarms", headers=HEADERS, json={
        "device_id": DEVICE_ID, "device_name": "ignored", "alarm": "VM Device DOWN",
        "status": "DOWN", "severity": "Critical", "time": down_time,
    })
    assert duplicate.status_code == 202
    active = client.get("/api/incidents/active", headers=HEADERS, params={"device_id": DEVICE_ID}).json()
    assert len(active) == 1
    incident_id = active[0]["incident_id"]

    up = client.post("/api/alarms", headers=HEADERS, json={
        "device_id": DEVICE_ID, "device_name": "ignored", "alarm": "VM Device UP",
        "status": "UP", "severity": "Normal", "time": up_time,
    })
    assert up.status_code == 202

    history = client.get(
        "/api/alarms/history", headers=HEADERS, params={"device_id": DEVICE_ID, "limit": 1}
    ).json()[0]
    assert history["status"] == "CLOSED"
    assert history["start_time"] == "2026-08-05T01:00:00Z"
    assert history["end_time"] == "2026-08-05T01:02:30Z"
    assert history["duration"] == 150
    assert history["device_status"] == "normal"
    assert client.get("/api/incidents/active", headers=HEADERS, params={"device_id": DEVICE_ID}).json() == []
    incident_history = client.get("/api/incidents/history", headers=HEADERS, params={"device_id": DEVICE_ID}).json()
    closed_incident = next(item for item in incident_history if item["incident_id"] == incident_id)
    assert closed_incident["status"] == "CLOSED"
    assert [event["to_status"] for event in closed_incident["timeline"]][-2:] == ["RECOVERED", "CLOSED"]

    with SessionLocal() as db:
        alarm_history = db.get(AlarmHistory, history["id"])
        incident = db.scalar(select(Incident).where(Incident.alarm_history_id == alarm_history.id))
        assert incident is not None
        assert incident.status == "CLOSED"
        assert incident.duration_seconds == 150
