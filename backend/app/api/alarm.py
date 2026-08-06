from fastapi import APIRouter

from app.schemas.alarm import AlarmBase


router = APIRouter(prefix="/alarms", tags=["alarms"])


@router.get("", response_model=list[AlarmBase])
def get_alarms() -> list[AlarmBase]:
    return [
        AlarmBase(
            hostname="TP-CORE-01",
            site="台北",
            device_name="Core Router",
            severity="Critical",
            status="OPEN",
            message="Ping timeout",
        ),
        AlarmBase(
            hostname="TP-DIST-01",
            site="台北",
            device_name="Distribution Switch",
            severity="Major",
            status="OPEN",
            message="CPU High",
        ),
        AlarmBase(
            hostname="TP-OLT-01",
            site="台北",
            device_name="OLT",
            severity="Minor",
            status="ACK",
            message="Optical power low",
        ),
    ]
