from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alarm import Alarm
from app.schemas.alarm import AlarmRead


router = APIRouter(prefix="/alarms", tags=["alarms"])


@router.get("", response_model=list[AlarmRead])
def get_alarms(db: Annotated[Session, Depends(get_db)]) -> list[Alarm]:
    return list(db.scalars(select(Alarm).order_by(Alarm.id)).all())
