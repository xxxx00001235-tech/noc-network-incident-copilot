from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AlarmBase(BaseModel):
    hostname: str
    site: str
    device_name: str
    severity: str
    status: str
    message: str


class AlarmRead(AlarmBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
