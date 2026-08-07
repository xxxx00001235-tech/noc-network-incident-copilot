import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .database import get_db
from .models import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)
JWT_SECRET = os.getenv("JWT_SECRET_KEY", "change-this-development-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_initial_admin(db: Session) -> None:
    """Create the first admin only when all bootstrap environment values are set."""
    username = os.getenv("NOC_INITIAL_ADMIN_USERNAME")
    email = os.getenv("NOC_INITIAL_ADMIN_EMAIL")
    password = os.getenv("NOC_INITIAL_ADMIN_PASSWORD")
    if not all((username, email, password)) or db.scalar(select(User.id).limit(1)) is not None:
        return
    db.add(User(
        username=username, email=email.lower(), password_hash=hash_password(password),
        role="admin", status="approved",
    ))
    db.commit()


def create_local_users(db: Session) -> None:
    """Bootstrap authenticated local Compose users only when explicitly enabled."""
    if os.getenv("NOC_BOOTSTRAP_LOCAL_USERS", "false").lower() not in {"1", "true", "yes"}:
        return
    password = os.getenv("NOC_LOCAL_USER_PASSWORD")
    if not password or len(password) < 8:
        return
    for username, role in (("operator", "operator"), ("engineer", "engineer"), ("admin", "admin")):
        user = find_user(db, username)
        if user is None:
            db.add(User(username=username, email=f"{username}@example.com", password_hash=hash_password(password), role=role, status="approved"))
        else:
            user.email = f"{username}@example.com"
            user.password_hash = hash_password(password)
            user.role = role
            user.status = "approved"
    db.commit()


def find_user(db: Session, identity: str) -> User | None:
    return db.scalar(select(User).where(or_(User.username == identity, User.email == identity)))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub", ""))
    except (JWTError, TypeError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if user is None or user.status != "approved":
        raise unauthorized
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return dependency
