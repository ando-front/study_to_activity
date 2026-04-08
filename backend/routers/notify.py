"""Notification router - game timeout and other notifications."""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, UserRole

router = APIRouter()


@router.post("/game-timeout/{child_id}")
def notify_game_timeout(
    child_id: int,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
):
    """Send LINE notification to parent(s) when child's game time expires."""
    child = (
        db.query(User)
        .filter(User.id == child_id, User.role == UserRole.CHILD)
        .first()
    )
    if not child:
        raise HTTPException(status_code=404, detail="子供ユーザーが見つかりません")

    from backend.services.line_notify import notify_game_timeout as _notify

    # Find parent(s)
    if child.parent_id:
        parents = db.query(User).filter(User.id == child.parent_id).all()
    else:
        parents = db.query(User).filter(User.role == UserRole.PARENT).all()

    notified = []
    for parent in parents:
        if parent.line_notify_token:
            background_tasks.add_task(_notify, parent.line_notify_token, child.name)
            notified.append(parent.name)

    return {
        "message": f"ゲーム時間終了通知を送信しました",
        "notified_parents": notified,
    }
