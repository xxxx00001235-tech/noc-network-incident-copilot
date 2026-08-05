from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


Role = Literal["admin", "engineer", "operator"]
Status = Literal["pending", "approved", "rejected", "disabled"]
IncidentStatus = Literal["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RECOVERED", "CLOSED"]
DeviceStatus = Literal["normal", "incident", "maintenance", "unknown"]
DeviceLayer = Literal["Core", "Distribution", "Access"]


class RegisterRequest(BaseModel):
    employee_id: str | None = Field(default=None, max_length=64)
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    name: str | None = Field(default=None, max_length=128)
    teams: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    department: str | None = Field(default=None, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(RegisterRequest):
    role: Role = "operator"
    status: Status = "pending"


class UserUpdate(BaseModel):
    employee_id: str | None = Field(default=None, max_length=64)
    username: str | None = Field(default=None, min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)
    role: Role | None = None
    status: Status | None = None
    name: str | None = Field(default=None, max_length=128)
    teams: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    department: str | None = Field(default=None, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: str | None
    username: str
    email: EmailStr
    role: Role
    status: Status
    name: str | None
    teams: str | None
    phone: str | None
    department: str | None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None
    deleted_at: datetime | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr


class DeviceBase(BaseModel):
    device_id: str = Field(min_length=1, max_length=128, pattern=r".*\S.*")
    device_name: str = Field(min_length=1, max_length=255, pattern=r".*\S.*")
    ip: str = Field(min_length=1, max_length=64, pattern=r".*\S.*")
    device_type: str = Field(min_length=1, max_length=64, pattern=r".*\S.*")
    layer: DeviceLayer
    region: str = Field(min_length=1, max_length=64, pattern=r".*\S.*")
    site: str = Field(min_length=1, max_length=64, pattern=r".*\S.*")
    location: str | None = None
    status: DeviceStatus = "unknown"
    owner_user_id: int | None = None
    backup_owner_user_id: int | None = None
    description: str | None = None


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    device_name: str | None = Field(default=None, min_length=1, max_length=255, pattern=r".*\S.*")
    ip: str | None = Field(default=None, min_length=1, max_length=64, pattern=r".*\S.*")
    device_type: str | None = Field(default=None, min_length=1, max_length=64, pattern=r".*\S.*")
    layer: DeviceLayer | None = None
    region: str | None = Field(default=None, min_length=1, max_length=64, pattern=r".*\S.*")
    site: str | None = Field(default=None, min_length=1, max_length=64, pattern=r".*\S.*")
    location: str | None = None
    status: DeviceStatus | None = None
    owner_user_id: int | None = None
    backup_owner_user_id: int | None = None
    description: str | None = None


class DeviceResponse(DeviceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner: UserSummary | None = None
    backup_owner: UserSummary | None = None
    created_at: datetime
    updated_at: datetime


class DeviceHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: str
    action: str
    before_data: str | None
    after_data: str | None
    actor_user_id: int | None
    actor: UserSummary | None = None
    created_at: datetime


class DeviceStatusResponse(BaseModel):
    device_id: str
    status: DeviceStatus
    updated_at: datetime


class AlarmHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_id: str
    alarm: str
    status: str
    severity: str
    device_status: DeviceStatus
    start_time: datetime
    end_time: datetime | None
    duration: int | None
    created_at: datetime

    @field_validator("start_time", "end_time", mode="after")
    @classmethod
    def attach_utc_to_sqlite_datetimes(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class DashboardStatisticsResponse(BaseModel):
    total_devices: int
    normal_devices: int
    incident_devices: int
    maintenance_devices: int
    unknown_devices: int
    total_alarms: int
    active_alarms: int
    critical_alarms: int


class IncidentUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    name: str | None


class TimelineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_type: str
    from_status: str | None
    to_status: str
    actor_user_id: int | None
    actor: IncidentUserResponse | None
    note: str | None
    created_at: datetime


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    incident_id: str
    device_id: str
    alarm_type: str
    severity: str
    status: IncidentStatus
    start_time: datetime
    acknowledged_time: datetime | None
    recovered_time: datetime | None
    closed_time: datetime | None
    duration_seconds: int | None
    operator_id: int | None
    engineer_id: int | None
    operator: IncidentUserResponse | None
    engineer: IncidentUserResponse | None
    root_cause: str | None
    resolution: str | None
    created_at: datetime
    updated_at: datetime
    timeline: list[TimelineResponse] = []


class IncidentUpdate(BaseModel):
    status: IncidentStatus
    operator_id: int | None = None
    engineer_id: int | None = None
    root_cause: str | None = None
    resolution: str | None = None
    note: str | None = None
