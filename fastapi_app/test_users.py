from uuid import uuid4

from fastapi.testclient import TestClient

from fastapi_app.database import SessionLocal
from fastapi_app.main import app
from fastapi_app.models import User
from fastapi_app.services import create_access_token, hash_password


client = TestClient(app)


def test_registration_approval_login_me_and_roles() -> None:
    suffix = uuid4().hex[:8]
    admin = User(
        username=f"admin-{suffix}", email=f"admin-{suffix}@example.com",
        password_hash=hash_password("AdminPass123!"), role="admin", status="approved",
    )
    with SessionLocal() as db:
        db.add(admin)
        db.commit()
        db.refresh(admin)
        admin_id = admin.id
        admin_token = create_access_token(admin)

    headers = {"Authorization": f"Bearer {admin_token}"}
    registration = client.post("/api/register", json={
        "username": f"operator-{suffix}", "email": f"operator-{suffix}@example.com",
        "password": "OperatorPass123!",
    })
    assert registration.status_code == 201
    registered = registration.json()
    assert registered["status"] == "pending"
    assert registered["role"] == "operator"
    assert "password" not in registered and "password_hash" not in registered

    assert client.post("/api/login", json={
        "username": f"operator-{suffix}", "password": "OperatorPass123!",
    }).status_code == 403
    pending = client.get("/api/pending-users", headers=headers)
    assert pending.status_code == 200
    assert any(user["id"] == registered["id"] for user in pending.json())
    assert client.post(f"/api/admin/users/{registered['id']}/reject", headers=headers).json()["status"] == "rejected"
    assert client.post(f"/api/admin/users/{registered['id']}/approve", headers=headers).status_code == 200

    login = client.post("/api/login", json={
        "username": f"operator-{suffix}", "password": "OperatorPass123!",
    })
    assert login.status_code == 200
    operator_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/me", headers=operator_headers).json()["username"] == f"operator-{suffix}"
    assert client.get("/api/users", headers=operator_headers).status_code == 403
    assert client.get("/api/alarms/latest", headers=operator_headers).status_code == 200

    created = client.post("/api/users", headers=headers, json={
        "username": f"engineer-{suffix}", "email": f"engineer-{suffix}@example.com",
        "password": "EngineerPass123!", "role": "engineer", "status": "approved",
    })
    assert created.status_code == 201
    engineer_id = created.json()["id"]
    assert client.get(f"/api/users/{engineer_id}", headers=headers).status_code == 200
    updated = client.patch(f"/api/users/{engineer_id}", headers=headers, json={"role": "operator"})
    assert updated.json()["role"] == "operator"
    assert client.delete(f"/api/users/{engineer_id}", headers=headers).status_code == 204

    with SessionLocal() as db:
        db.query(User).filter(User.id.in_([admin_id, registered["id"], engineer_id])).delete(synchronize_session=False)
        db.commit()
