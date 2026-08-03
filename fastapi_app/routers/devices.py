import json

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Device, DeviceHistory, TopologyLink, User
from ..schemas import DeviceCreate, DeviceHistoryResponse, DeviceResponse, DeviceUpdate
from ..services import require_roles


router = APIRouter(prefix="/api/devices", tags=["devices"])
read_roles = require_roles("admin", "engineer", "operator")
write_roles = require_roles("admin", "engineer")
admin_only = require_roles("admin")


def snapshot(device: Device) -> str:
    fields = ("id", "device_id", "device_name", "ip", "device_type", "layer", "region", "site", "location", "status", "owner_user_id", "backup_owner_user_id", "description")
    return json.dumps({key: getattr(device, key) for key in fields}, ensure_ascii=False)


def validate_owners(db: Session, *owner_ids: int | None) -> None:
    for owner_id in owner_ids:
        if owner_id is not None and db.get(User, owner_id) is None:
            raise HTTPException(status_code=422, detail="指定的設備負責人不存在")


def commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="設備代碼或 IP 已存在") from exc


def get_device_or_404(db: Session, device_id: str) -> Device:
    device = db.scalar(select(Device).options(selectinload(Device.owner), selectinload(Device.backup_owner)).where(Device.device_id == device_id))
    if device is None:
        raise HTTPException(status_code=404, detail="找不到設備")
    return device


@router.get("", response_model=list[DeviceResponse])
def list_devices(region: str | None = None, site: str | None = None, status: str | None = None, device_type: str | None = None, keyword: str | None = None, db: Session = Depends(get_db), _: User = Depends(read_roles)) -> list[Device]:
    query = select(Device).options(selectinload(Device.owner), selectinload(Device.backup_owner))
    for field, value in ((Device.region, region), (Device.site, site), (Device.status, status), (Device.device_type, device_type)):
        if value:
            query = query.where(field == value)
    if keyword:
        pattern = f"%{keyword.strip()}%"
        query = query.where(or_(Device.device_id.ilike(pattern), Device.device_name.ilike(pattern), Device.ip.ilike(pattern)))
    return list(db.scalars(query.order_by(Device.device_id)))


@router.get("/{device_id}/history", response_model=list[DeviceHistoryResponse])
def device_history(device_id: str, db: Session = Depends(get_db), _: User = Depends(read_roles)) -> list[DeviceHistory]:
    get_device_or_404(db, device_id)
    return list(db.scalars(select(DeviceHistory).options(selectinload(DeviceHistory.actor)).where(DeviceHistory.device_id == device_id).order_by(DeviceHistory.created_at.desc(), DeviceHistory.id.desc())))


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(device_id: str, db: Session = Depends(get_db), _: User = Depends(read_roles)) -> Device:
    return get_device_or_404(db, device_id)


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(data: DeviceCreate, db: Session = Depends(get_db), actor: User = Depends(write_roles)) -> Device:
    validate_owners(db, data.owner_user_id, data.backup_owner_user_id)
    device = Device(**data.model_dump())
    db.add(device)
    db.flush()
    db.add(DeviceHistory(device_id=device.device_id, action="create", after_data=snapshot(device), actor_user_id=actor.id))
    commit(db)
    return get_device_or_404(db, device.device_id)


@router.patch("/{device_id}", response_model=DeviceResponse)
@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: str, data: DeviceUpdate, db: Session = Depends(get_db), actor: User = Depends(write_roles)) -> Device:
    device = get_device_or_404(db, device_id)
    before = snapshot(device)
    changes = data.model_dump(exclude_unset=True)
    validate_owners(db, changes.get("owner_user_id"), changes.get("backup_owner_user_id"))
    for key, value in changes.items():
        setattr(device, key, value)
    db.flush()
    db.add(DeviceHistory(device_id=device.device_id, action="update", before_data=before, after_data=snapshot(device), actor_user_id=actor.id))
    commit(db)
    return get_device_or_404(db, device_id)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: str, db: Session = Depends(get_db), actor: User = Depends(admin_only)) -> Response:
    device = get_device_or_404(db, device_id)
    before = snapshot(device)
    db.query(TopologyLink).filter(or_(TopologyLink.source_device_id == device_id, TopologyLink.target_device_id == device_id)).delete(synchronize_session=False)
    db.delete(device)
    db.add(DeviceHistory(device_id=device_id, action="delete", before_data=before, actor_user_id=actor.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
