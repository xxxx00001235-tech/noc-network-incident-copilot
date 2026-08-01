from fastapi.testclient import TestClient

from fastapi_app.main import app


client = TestClient(app)
READ_HEADERS = {"X-NOC-Role": "operator"}


def test_operational_apis() -> None:
    device_id = "SW-TP-NG-001"
    routes = (
        "/api/alarms/latest",
        f"/api/topology/{device_id}",
        f"/api/report/{device_id}",
        f"/api/analyze/{device_id}",
        f"/api/maintenance/{device_id}",
    )
    for route in routes:
        response = client.get(route, headers=READ_HEADERS)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "ok"


def test_topology_response_uses_json_serializable_device_objects() -> None:
    response = client.get("/api/topology/SW-TP-NG-001", headers=READ_HEADERS)
    body = response.json()
    assert body["fault_device"]["device_id"] == "SW-TP-NG-001"
    assert body["nodes"]
    assert body["links"]


def test_alarm_websocket_receives_published_alarm() -> None:
    alarm = {
        "device_id": "SW-TP-NG-001",
        "device_name": "SW-TP-NG-001",
        "alarm": "Device Down",
        "status": "DOWN",
        "severity": "Critical",
    }
    with client.websocket_connect("/ws/alarms") as websocket:
        assert websocket.receive_json() == {"type": "connected"}
        response = client.post("/api/alarms", json=alarm, headers=READ_HEADERS)
        assert response.status_code == 202
        message = websocket.receive_json()
        assert message["type"] == "alarm"
        assert message["data"]["alarm"]["device_id"] == alarm["device_id"]


def test_api_without_role_returns_403() -> None:
    response = client.get("/api/alarms/latest")
    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}


def test_device_manager_cannot_operate_alarms() -> None:
    response = client.post("/api/alarms", json={
        "device_id": "SW-001", "device_name": "SW-001", "alarm": "Device Down"
    }, headers={"X-NOC-Role": "engineer"})
    assert response.status_code == 403
