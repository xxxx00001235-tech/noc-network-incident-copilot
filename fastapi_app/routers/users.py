from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
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
    return commit_user(db, User(
        username=data.username, email=str(data.email).lower(), password_hash=hash_password(data.password),
        role="operator", status="pending",
    ))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = find_user(db, data.username)
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")
    if user.status != "approved":
        raise HTTPException(status_code=403, detail=f"Account is {user.status}")
    return TokenResponse(access_token=create_access_token(user), user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), _: User = Depends(admin_only)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Session = Depends(get_db), _: User = Depends(admin_only)) -> User:
    return commit_user(db, User(
        username=data.username, email=str(data.email).lower(), password_hash=hash_password(data.password),
        role=data.role, status=data.status,
    ))


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
