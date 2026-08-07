from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.alarm import Alarm


INITIAL_ALARMS = (
    {
        "hostname": "RTR-TP-NG-CORE-001",
        "site": "台北／南港",
        "device_name": "台北南港核心路由器",
        "severity": "Critical",
        "status": "OPEN",
        "message": "Ping timeout",
    },
    {
        "hostname": "SW-TP-NG-DIST-001",
        "site": "台北／南港",
        "device_name": "台北南港匯聚交換器",
        "severity": "Major",
        "status": "OPEN",
        "message": "CPU High",
    },
    {
        "hostname": "OLT-TP-NG-ACCESS-001",
        "site": "台北／南港",
        "device_name": "台北南港接取設備",
        "severity": "Minor",
        "status": "ACK",
        "message": "Optical power low",
    },
)


def seed_initial_alarms(db: Session) -> int:
    inserted = 0
    legacy_ids = {"TP-CORE-01": "RTR-TP-NG-CORE-001", "TP-DIST-01": "SW-TP-NG-DIST-001", "TP-OLT-01": "OLT-TP-NG-ACCESS-001"}
    for legacy_id, canonical_id in legacy_ids.items():
        legacy = db.scalar(select(Alarm).where(Alarm.hostname == legacy_id))
        canonical = db.scalar(select(Alarm).where(Alarm.hostname == canonical_id))
        if legacy is not None and canonical is None:
            legacy.hostname = canonical_id
    db.flush()
    for alarm_data in INITIAL_ALARMS:
        existing_id = db.scalar(
            select(Alarm.id).where(Alarm.hostname == alarm_data["hostname"])
        )
        if existing_id is None:
            db.add(Alarm(**alarm_data))
            inserted += 1

    db.commit()
    return inserted


def main() -> None:
    with SessionLocal() as db:
        inserted = seed_initial_alarms(db)
    print(f"Initial alarms inserted: {inserted}")


if __name__ == "__main__":
    main()
