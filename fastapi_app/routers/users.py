from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DeviceHistory, Incident, Timeline, User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserCreate, UserResponse, UserUpdate
from ..services import create_access_token, find_user, get_current_user, hash_password, require_roles, verify_password


router = APIRouter(prefix="/api", tags=["users"])
admin_only = require_roles("admin")


def commit_user(db: Session, user: User) -> User:
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username or email already exists")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> User:
    if find_user(db, data.username) or find_user(db, str(data.email)):
        raise HTTPException(status_code=409, detail="Username or email already exists")
    values = data.model_dump(exclude={"password"})
    values["email"] = str(data.email).lower()
    return commit_user(db, User(**values, password_hash=hash_password(data.password), role="operator", status="pending"))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = find_user(db, data.username)
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")
    if user.status != "approved":
        raise HTTPException(status_code=403, detail=f"Account is {user.status}")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/users", response_model=list[UserResponse])
def list_users(
    q: str | None = None, role: str | None = None, status_filter: str | None = Query(default=None, alias="status"),
    include_deleted: bool = False, db: Session = Depends(get_db), _: User = Depends(admin_only),
) -> list[User]:
    query = select(User)
    if not include_deleted:
        query = query.where(User.deleted_at.is_(None))
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(User.username.ilike(term), User.email.ilike(term), User.name.ilike(term), User.employee_id.ilike(term)))
    if role:
        query = query.where(User.role == role)
    if status_filter:
        query = query.where(User.status == status_filter)
    return list(db.scalars(query.order_by(User.id)))


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    values = data.model_dump(exclude={"password"})
    values["email"] = str(data.email).lower()
    return commit_user(db, User(**values, password_hash=hash_password(data.password)))


@router.get("/users/pending", response_model=list[UserResponse])
@router.get("/pending-users", response_model=list[UserResponse])
def pending_users(db: Session = Depends(get_db), _: User = Depends(admin_only)) -> list[User]:
    return list(db.scalars(select(User).where(User.status == "pending").order_by(User.created_at)))


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(data: UserUpdate, user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    changes = data.model_dump(exclude_unset=True)
    password = changes.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
    if "email" in changes:
        changes["email"] = str(changes["email"]).lower()
    for key, value in changes.items():
        setattr(user, key, value)
    return commit_user(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(admin_only)) -> Response:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Administrators cannot delete their own account")
    has_history = any((
        db.scalar(select(Incident.id).where(or_(Incident.operator_id == user.id, Incident.engineer_id == user.id)).limit(1)),
        db.scalar(select(Timeline.id).where(Timeline.actor_user_id == user.id).limit(1)),
        db.scalar(select(DeviceHistory.id).where(DeviceHistory.actor_user_id == user.id).limit(1)),
    ))
    if has_history:
        user.status = "disabled"
        user.deleted_at = datetime.now(timezone.utc)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"X-Delete-Mode": "soft"})
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def set_status(user_id: int, value: str, db: Session) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = value
    return commit_user(db, user)


@router.post("/admin/users/{user_id}/approve", response_model=UserResponse)
def approve_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    return set_status(user_id, "approved", db)


@router.post("/admin/users/{user_id}/reject", response_model=UserResponse)
def reject_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    return set_status(user_id, "rejected", db)


@router.post("/admin/users/{user_id}/disable", response_model=UserResponse)
def disable_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    return set_status(user_id, "disabled", db)


@router.post("/admin/users/{user_id}/restore", response_model=UserResponse)
def restore_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "approved"
    user.deleted_at = None
    return commit_user(db, user)
