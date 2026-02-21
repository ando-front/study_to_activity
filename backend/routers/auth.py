"""Authentication router - simple PIN-based auth for family use."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserRole, ActivityWallet
from schemas import UserCreate, UserOut, LoginRequest, LoginResponse

router = APIRouter()


@router.post("/register", response_model=UserOut)
def register_user(data: UserCreate, db: Session = Depends(get_db)):
    """Register a new parent or child user."""
    user = User(
        name=data.name,
        role=UserRole(data.role),
        pin=data.pin,
    )
    db.add(user)
    db.flush()

    # Auto-create wallet for child users
    if user.role == UserRole.CHILD:
        wallet = ActivityWallet(child_id=user.id, balance_minutes=0)
        db.add(wallet)

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login with user ID and optional PIN."""
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    if user.pin and user.pin != data.pin:
        raise HTTPException(status_code=401, detail="PINが正しくありません")

    return LoginResponse(user=UserOut.model_validate(user), message="ログイン成功")


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    """List all users (for family member selection)."""
    return db.query(User).all()


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    return user
