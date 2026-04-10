"""Authentication router - simple PIN-based auth for family use."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ActivityWallet, User, UserRole
from backend.schemas import (
    ChildCreate,
    LoginRequest,
    LoginResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)
from backend.security import hash_pin, verify_pin

router = APIRouter()


@router.post("/register", response_model=UserOut)
def register_user(data: UserCreate, db: Annotated[Session, Depends(get_db)]):
    """Register a new parent or child user."""
    # Normalize empty / whitespace-only email to None to avoid unique constraint issues
    email = data.email.strip() if data.email else None
    email = email or None

    user = User(
        name=data.name,
        role=UserRole(data.role),
        pin=hash_pin(data.pin),
        email=email,
    )
    db.add(user)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="このメールアドレスは既に登録されています",
        ) from None

    # Auto-create wallet for child users
    if user.role == UserRole.CHILD:
        wallet = ActivityWallet(child_id=user.id, balance_minutes=0)
        db.add(wallet)

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    """Login with user ID and optional PIN."""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    if user.pin and not verify_pin(data.pin, user.pin):
        raise HTTPException(status_code=401, detail="PINが正しくありません")

    return LoginResponse(user=UserOut.model_validate(user), message="ログイン成功")


@router.get("/users", response_model=list[UserOut])
def list_users(db: Annotated[Session, Depends(get_db)]):
    """List all users (for family member selection)."""
    return db.query(User).all()


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Annotated[Session, Depends(get_db)]):
    """Get a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    return user


# --- User Management (children CRUD + parent profile) ---


@router.post("/users/children", response_model=UserOut)
def create_child(data: ChildCreate, db: Annotated[Session, Depends(get_db)]):
    """Add a new child user with auto-created wallet."""
    child = User(
        name=data.name,
        role=UserRole.CHILD,
        pin=hash_pin(data.pin),
    )
    db.add(child)
    db.flush()

    wallet = ActivityWallet(child_id=child.id, balance_minutes=0)
    db.add(wallet)
    db.commit()
    db.refresh(child)
    return child


@router.put("/users/children/{child_id}", response_model=UserOut)
def update_child(
    child_id: int, data: UserUpdate, db: Annotated[Session, Depends(get_db)]
):
    """Edit a child user's name or PIN."""
    child = (
        db.query(User)
        .filter(User.id == child_id, User.role == UserRole.CHILD)
        .first()
    )
    if not child:
        raise HTTPException(status_code=404, detail="子供ユーザーが見つかりません")

    if data.name is not None:
        child.name = data.name
    if data.pin is not None:
        child.pin = hash_pin(data.pin)

    db.commit()
    db.refresh(child)
    return child


@router.delete("/users/children/{child_id}")
def delete_child(child_id: int, db: Annotated[Session, Depends(get_db)]):
    """Delete a child user and their wallet."""
    child = (
        db.query(User)
        .filter(User.id == child_id, User.role == UserRole.CHILD)
        .first()
    )
    if not child:
        raise HTTPException(status_code=404, detail="子供ユーザーが見つかりません")

    # Delete wallet first
    if child.wallet:
        db.delete(child.wallet)

    db.delete(child)
    db.commit()
    return {"message": f"{child.name} を削除しました"}


@router.put("/users/profile", response_model=UserOut)
def update_profile(
    data: UserUpdate, db: Annotated[Session, Depends(get_db)], user_id: int = 0
):
    """Edit the current parent user's profile (name, PIN, email)."""
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id パラメータが必要です")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    if data.name is not None:
        user.name = data.name
    if data.pin is not None:
        user.pin = hash_pin(data.pin)
    if data.email is not None:
        email = data.email.strip() or None
        user.email = email

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="このメールアドレスは既に登録されています",
        ) from None

    db.refresh(user)
    return user
