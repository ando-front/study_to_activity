"""Tasks router - manage study task lifecycle (start, complete, approve)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import (
    StudyTask,
    TaskStatus,
    User,
    UserRole,
)
from backend.reward_engine import evaluate_and_grant
from backend.schemas import (
    ChildDashboard,
    ParentDashboard,
    RewardRuleOut,
    StudyPlanOut,
    StudyTaskOut,
    StudyTaskUpdate,
    UserOut,
)
from backend.services import dashboard_service
from backend.sync_utils import trigger_switch_sync

router = APIRouter()


@router.get("/{task_id}", response_model=StudyTaskOut)
def get_task(task_id: int, db: Annotated[Session, Depends(get_db)]):
    """Get a specific task."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    return task


@router.patch("/{task_id}", response_model=StudyTaskOut)
def update_task(
    task_id: int, data: StudyTaskUpdate, db: Annotated[Session, Depends(get_db)]
):
    """Update task details (subject, description, etc.)."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/start", response_model=StudyTaskOut)
def start_task(task_id: int, db: Annotated[Session, Depends(get_db)]):
    """Mark a task as in-progress (child starts studying)."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status != TaskStatus.PENDING:
        raise HTTPException(status_code=400, detail="このタスクは開始できません")

    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.now(UTC)
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/complete", response_model=StudyTaskOut)
def complete_task(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
    actual_minutes: int | None = None,
):
    """Mark a task as completed (child finished studying)."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status not in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS):
        raise HTTPException(status_code=400, detail="このタスクは完了できません")

    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now(UTC)

    if actual_minutes is not None:
        task.actual_minutes = actual_minutes
    elif task.started_at:
        # Auto-calculate from timer
        elapsed = (datetime.now(UTC) - task.started_at).total_seconds() / 60
        task.actual_minutes = int(elapsed)

    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/approve", response_model=dict)
def approve_task(
    task_id: int,
    parent_id: int,
    background_tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
):
    """Approve a completed task (parent action). Triggers reward evaluation."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="完了済みのタスクのみ承認できます")

    # Verify parent
    parent = (
        db.query(User)
        .filter(User.id == parent_id, User.role == UserRole.PARENT)
        .first()
    )
    if not parent:
        raise HTTPException(status_code=403, detail="親ユーザーのみ承認できます")

    task.status = TaskStatus.APPROVED
    task.approved_at = datetime.now(UTC)
    task.approved_by = parent_id
    db.commit()

    # Evaluate reward rules after approval
    child_id = task.plan.child_id
    granted = evaluate_and_grant(db, child_id)

    # If rewards were granted, trigger Switch sync in background
    if granted:
        background_tasks.add_task(trigger_switch_sync, db, child_id)

    return {
        "task": StudyTaskOut.model_validate(task),
        "rewards_granted": granted,
    }


@router.post("/{task_id}/reject", response_model=StudyTaskOut)
def reject_task(task_id: int, db: Annotated[Session, Depends(get_db)]):
    """Reject a completed task (send back to child)."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(
            status_code=400, detail="完了済みのタスクのみ差し戻しできます"
        )

    task.status = TaskStatus.REJECTED
    db.commit()
    db.refresh(task)
    return task


# --- Dashboard endpoints ---


@router.get("/dashboard/child/{child_id}", response_model=ChildDashboard)
def child_dashboard(child_id: int, db: Annotated[Session, Depends(get_db)]):
    """Get child's dashboard data for today."""
    data = dashboard_service.get_child_dashboard_data(db, child_id)
    if not data:
        raise HTTPException(status_code=404, detail="子供ユーザーが見つかりません")

    return ChildDashboard(
        user=UserOut.model_validate(data["user"]),
        today_plan=(
            StudyPlanOut.model_validate(data["today_plan"])
            if data["today_plan"]
            else None
        ),
        wallet_balance=data["wallet_balance"],
        daily_limit=data["daily_limit"],
        today_earned=data["today_earned"],
        today_consumed=data["today_consumed"],
        pending_tasks=data["pending_tasks"],
        completed_tasks=data["completed_tasks"],
        approved_tasks=data["approved_tasks"],
    )


@router.get("/dashboard/parent", response_model=ParentDashboard)
def parent_dashboard(db: Annotated[Session, Depends(get_db)]):
    """Get parent's dashboard data."""
    data = dashboard_service.get_parent_dashboard_data(db)
    return ParentDashboard(
        children=[UserOut.model_validate(c) for c in data["children"]],
        pending_approvals=[
            StudyTaskOut.model_validate(t) for t in data["pending_approvals"]
        ],
        today_plans=[StudyPlanOut.model_validate(p) for p in data["today_plans"]],
        active_rules=[RewardRuleOut.model_validate(r) for r in data["active_rules"]],
    )
