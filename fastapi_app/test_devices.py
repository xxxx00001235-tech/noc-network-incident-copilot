from uuid import uuid4

from fastapi.testclient import TestClient

from fastapi_app.database import SessionLocal
from fastapi_app.main import app
from fastapi_app.models import User
from fastapi_app.services import create_access_token, hash_password


client = TestClient(app)


def make_user(role: str) -> tuple[User, dict[str, str]]:
    suffix = uuid4().hex[:8]
    user = User(username=f"{role}-{suffix}", email=f"{role}-{suffix}@example.com", password_hash=hash_password("DevicePass123!"), role=role, status="approved")
    with SessionLocal() as db:
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token(user)
        db.expunge(user)
    return user, {"Authorization": f"Bearer {token}"}


def test_device_crud_history_and_role_permissions() -> None:
    admin, admin_headers = make_user("admin")
    engineer, engineer_headers = make_user("engineer")
    operator, operator_headers = make_user("operator")
    device_id = f"TEST-{uuid4().hex[:8]}"
    payload = {"device_id": device_id, "device_name": "測試設備", "ip": f"198.51.100.{int(uuid4().hex[:2], 16)}", "device_type": "Access Switch", "layer": "Access", "region": "台北", "site": "測試站", "status": "normal", "owner_user_id": engineer.id}

    assert client.get("/api/devices").status_code in (401, 403)
    assert client.post("/api/devices", headers=operator_headers, json=payload).status_code == 403
    created = client.post("/api/devices", headers=engineer_headers, json=payload)
    assert created.status_code == 201, created.text
    assert created.json()["owner"]["username"] == engineer.username
    assert "password_hash" not in created.text
    assert client.get(f"/api/devices/{device_id}", headers=operator_headers).status_code == 200

    updated = client.patch(f"/api/devices/{device_id}", headers=engineer_headers, json={"status": "maintenance"})
    assert updated.status_code == 200 and updated.json()["status"] == "maintenance"
    assert client.delete(f"/api/devices/{device_id}", headers=engineer_headers).status_code == 403
    history = client.get(f"/api/devices/{device_id}/history", headers=operator_headers).json()
    assert [entry["action"] for entry in history] == ["update", "create"]
    assert client.delete(f"/api/devices/{device_id}", headers=admin_headers).status_code == 204

    with SessionLocal() as db:
        db.query(User).filter(User.id.in_([admin.id, engineer.id, operator.id])).delete(synchronize_session=False)
        db.commit()


def test_device_filters_and_database_topology() -> None:
    operator, headers = make_user("operator")
    response = client.get("/api/devices", headers=headers, params={"region": "台北", "site": "南港", "device_type": "Core Router", "keyword": "CORE"})
    assert response.status_code == 200
    assert any(device["device_id"] == "RTR-TP-NG-CORE-001" for device in response.json())
    topology = client.get("/api/topology/RTR-TP-NG-CORE-001", headers=headers).json()
    assert "SW-TP-NG-DIST-001" in [item["device_id"] for item in topology["downstream"]]
    assert "OLT-TP-NG-ACCESS-001" in topology["affected_device_ids"]
    assert not any(link.get("backup") for link in topology["links"])
    with SessionLocal() as db:
        db.delete(db.get(User, operator.id))
        db.commit()
