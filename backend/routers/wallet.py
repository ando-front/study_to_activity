"""Wallet router - activity time balance management and consumption tracking."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import ActivityWallet, ActivityLog, RewardLog, User, UserRole
from backend.schemas import (
    WalletOut, WalletAdjust, WalletSettingsUpdate,
    ActivityLogCreate, ActivityLogOut, RewardLogOut,
)

router = APIRouter()


@router.get("/{child_id}", response_model=WalletOut)
def get_wallet(child_id: int, db: Session = Depends(get_db)):
    """Get a child's activity wallet."""
    wallet = db.query(ActivityWallet).filter(
        ActivityWallet.child_id == child_id
    ).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ウォレットが見つかりません")
    return wallet


@router.post("/{child_id}/adjust", response_model=WalletOut)
def adjust_balance(
    child_id: int, data: WalletAdjust, db: Session = Depends(get_db)
):
    """Manually adjust wallet balance (parent action). Positive to add, negative to subtract."""
    wallet = db.query(ActivityWallet).filter(
        ActivityWallet.child_id == child_id
    ).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ウォレットが見つかりません")

    new_balance = wallet.balance_minutes + data.minutes
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="残高が不足しています")

    wallet.balance_minutes = new_balance

    # Log the manual adjustment
    log = ActivityLog(
        child_id=child_id,
        activity_type="other",
        description=f"手動調整: {data.reason}",
        consumed_minutes=-data.minutes,  # Negative consumed = added time
        source="manual",
    )
    db.add(log)
    db.commit()
    db.refresh(wallet)
    return wallet


@router.patch("/{child_id}/settings", response_model=WalletOut)
def update_wallet_settings(
    child_id: int, data: WalletSettingsUpdate, db: Session = Depends(get_db)
):
    """Update wallet settings (daily limit, carry over)."""
    wallet = db.query(ActivityWallet).filter(
        ActivityWallet.child_id == child_id
    ).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ウォレットが見つかりません")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(wallet, field, value)

    db.commit()
    db.refresh(wallet)
    return wallet


@router.post("/{child_id}/consume", response_model=ActivityLogOut)
def consume_activity(
    child_id: int, data: ActivityLogCreate, db: Session = Depends(get_db)
):
    """Record activity consumption (e.g. 30 min Switch play)."""
    wallet = db.query(ActivityWallet).filter(
        ActivityWallet.child_id == child_id
    ).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="ウォレットが見つかりません")

    if wallet.balance_minutes < data.consumed_minutes:
        raise HTTPException(
            status_code=400,
            detail=f"残高不足です（残高: {wallet.balance_minutes}分, 消費: {data.consumed_minutes}分）",
        )

    wallet.balance_minutes -= data.consumed_minutes

    log = ActivityLog(
        child_id=child_id,
        activity_type=data.activity_type,
        description=data.description,
        consumed_minutes=data.consumed_minutes,
        source="consumption",
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/{child_id}/logs", response_model=list[ActivityLogOut])
def get_activity_logs(
    child_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Get activity consumption logs for a child."""
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.child_id == child_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{child_id}/rewards", response_model=list[RewardLogOut])
def get_reward_logs(
    child_id: int,
    granted_date: date | None = None,
    db: Session = Depends(get_db),
):
    """Get reward grant history for a child."""
    query = db.query(RewardLog).filter(RewardLog.child_id == child_id)
    if granted_date:
        query = query.filter(RewardLog.granted_date == granted_date)
    return query.order_by(RewardLog.created_at.desc()).all()
