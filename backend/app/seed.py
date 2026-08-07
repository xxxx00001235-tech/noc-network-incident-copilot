from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.alarm import Alarm


DEMO_ALARMS = (
    {
        "hostname": "TP-CORE-01",
        "site": "Taipei",
        "device_name": "Core Router",
        "severity": "Critical",
        "status": "OPEN",
        "message": "Ping timeout",
    },
    {
        "hostname": "TP-DIST-01",
        "site": "Taipei",
        "device_name": "Distribution Switch",
        "severity": "Major",
        "status": "OPEN",
        "message": "CPU High",
    },
    {
        "hostname": "TP-OLT-01",
        "site": "Taipei",
        "device_name": "OLT",
        "severity": "Minor",
        "status": "ACK",
        "message": "Optical power low",
    },
)


def seed_demo_alarms(db: Session) -> int:
    inserted = 0

    for alarm_data in DEMO_ALARMS:
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
        inserted = seed_demo_alarms(db)
    print(f"Demo alarms inserted: {inserted}")


if __name__ == "__main__":
    main()
