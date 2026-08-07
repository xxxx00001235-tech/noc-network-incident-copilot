from fastapi.testclient import TestClient

from fastapi_app.main import app


client = TestClient(app)
HEADERS = {"X-NOC-Role": "operator"}
DEVICE_ID = "SW-TP-NG-DIST-001"


def test_ai_diagnosis_and_root_cause_contract() -> None:
    response = client.get(f"/api/ai/diagnosis/{DEVICE_ID}", headers=HEADERS)
    assert response.status_code == 200
    diagnosis = response.json()["diagnosis"]
    assert diagnosis["root_cause"]
    assert 0 <= diagnosis["confidence"] <= 1
    assert isinstance(diagnosis["impacted_devices"], list)
    assert len(diagnosis["suggested_actions"]) >= 1


def test_ai_timeline_has_required_stages() -> None:
    response = client.get(f"/api/ai/timeline/{DEVICE_ID}", headers=HEADERS)
    assert response.status_code == 200
    assert [event["stage"] for event in response.json()["events"]] == [
        "收到告警", "AI 初步分析", "開始查測", "設備管理員確認", "產生初報",
        "更新處理", "產生續報", "恢復", "產生結報",
    ]


def test_teams_report_generator_is_copy_ready() -> None:
    response = client.post(
        f"/api/ai/teams-report/{DEVICE_ID}",
        headers=HEADERS,
        json={"report_type": "initial"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["report_type"] == "initial"
    assert "NOC 網路事件初報" in body["report"]
    assert "AI 初判" in body["report"]


def test_alarm_websocket_includes_realtime_ai_diagnosis() -> None:
    with client.websocket_connect("/ws/alarms") as websocket:
        assert websocket.receive_json()["type"] == "connected"
        response = client.post(
            "/api/alarms",
            headers=HEADERS,
            json={"device_id": DEVICE_ID, "device_name": "ignored", "alarm": "Optical LOS", "status": "DOWN"},
        )
        assert response.status_code == 202
        message = websocket.receive_json()
        assert message["type"] == "alarm.created"
        assert message["ai_diagnosis"]["device_id"] == DEVICE_ID
        assert message["ai_diagnosis"]["root_cause"]
    client.post("/api/alarms", headers=HEADERS, json={"device_id": DEVICE_ID, "device_name": "ignored", "alarm": "Optical LOS", "status": "UP", "severity": "Normal"})


def test_ai_apis_keep_rbac() -> None:
    assert client.get(f"/api/ai/diagnosis/{DEVICE_ID}").status_code == 403
    assert client.get(f"/api/ai/timeline/{DEVICE_ID}").status_code == 403
    assert client.post(f"/api/ai/teams-report/{DEVICE_ID}", json={}).status_code == 403
