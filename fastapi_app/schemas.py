from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


Role = Literal["admin", "engineer", "operator"]
Status = Literal["pending", "approved", "rejected"]
DeviceStatus = Literal["normal", "incident", "maintenance", "unknown"]
DeviceLayer = Literal["Core", "Distribution", "Access"]


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(RegisterRequest):
    role: Role = "operator"
    status: Status = "pending"


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)
    role: Role | None = None
    status: Status | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    role: Role
    status: Status
    created_at: datetime
    updated_at: datetime


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
