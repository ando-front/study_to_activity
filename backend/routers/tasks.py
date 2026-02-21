"""Tasks router - manage study task lifecycle (start, complete, approve)."""
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import StudyTask, TaskStatus, StudyPlan
from schemas import StudyTaskOut, StudyTaskUpdate, ChildDashboard, ParentDashboard
from schemas import UserOut, StudyPlanOut, RewardRuleOut
from models import User, UserRole, ActivityWallet, RewardRule, ActivityLog, RewardLog
from reward_engine import evaluate_and_grant

router = APIRouter()


@router.get("/{task_id}", response_model=StudyTaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a specific task."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    return task


@router.patch("/{task_id}", response_model=StudyTaskOut)
def update_task(task_id: int, data: StudyTaskUpdate, db: Session = Depends(get_db)):
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
def start_task(task_id: int, db: Session = Depends(get_db)):
    """Mark a task as in-progress (child starts studying)."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status != TaskStatus.PENDING:
        raise HTTPException(status_code=400, detail="このタスクは開始できません")

    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/complete", response_model=StudyTaskOut)
def complete_task(
    task_id: int,
    actual_minutes: int | None = None,
    db: Session = Depends(get_db),
):
    """Mark a task as completed (child finished studying)."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status not in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS):
        raise HTTPException(status_code=400, detail="このタスクは完了できません")

    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.utcnow()

    if actual_minutes is not None:
        task.actual_minutes = actual_minutes
    elif task.started_at:
        # Auto-calculate from timer
        elapsed = (datetime.utcnow() - task.started_at).total_seconds() / 60
        task.actual_minutes = int(elapsed)

    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/approve", response_model=dict)
def approve_task(
    task_id: int,
    parent_id: int,
    db: Session = Depends(get_db),
):
    """Approve a completed task (parent action). Triggers reward evaluation."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="完了済みのタスクのみ承認できます")

    # Verify parent
    parent = db.query(User).filter(
        User.id == parent_id, User.role == UserRole.PARENT
    ).first()
    if not parent:
        raise HTTPException(status_code=403, detail="親ユーザーのみ承認できます")

    task.status = TaskStatus.APPROVED
    task.approved_at = datetime.utcnow()
    task.approved_by = parent_id
    db.commit()

    # Evaluate reward rules after approval
    child_id = task.plan.child_id
    granted = evaluate_and_grant(db, child_id)

    return {
        "task": StudyTaskOut.model_validate(task),
        "rewards_granted": granted,
    }


@router.post("/{task_id}/reject", response_model=StudyTaskOut)
def reject_task(task_id: int, db: Session = Depends(get_db)):
    """Reject a completed task (send back to child)."""
    task = db.query(StudyTask).filter(StudyTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")

    if task.status != TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="完了済みのタスクのみ差し戻しできます")

    task.status = TaskStatus.REJECTED
    db.commit()
    db.refresh(task)
    return task


# --- Dashboard endpoints ---

@router.get("/dashboard/child/{child_id}", response_model=ChildDashboard)
def child_dashboard(child_id: int, db: Session = Depends(get_db)):
    """Get child's dashboard data for today."""
    user = db.query(User).filter(User.id == child_id, User.role == UserRole.CHILD).first()
    if not user:
        raise HTTPException(status_code=404, detail="子供ユーザーが見つかりません")

    today = date.today()

    # Today's plan
    today_plan = db.query(StudyPlan).filter(
        StudyPlan.child_id == child_id,
        StudyPlan.plan_date == today,
    ).first()

    # Wallet
    wallet = db.query(ActivityWallet).filter(ActivityWallet.child_id == child_id).first()
    balance = wallet.balance_minutes if wallet else 0
    daily_limit = wallet.daily_limit_minutes if wallet else 120

    # Today's reward logs
    today_earned = 0
    reward_logs = db.query(RewardLog).filter(
        RewardLog.child_id == child_id,
        RewardLog.granted_date == today,
    ).all()
    today_earned = sum(r.granted_minutes for r in reward_logs)

    # Today's activity logs
    today_consumed = 0
    activity_logs = db.query(ActivityLog).filter(
        ActivityLog.child_id == child_id,
    ).all()
    # Filter to today's logs
    for log in activity_logs:
        if log.created_at and log.created_at.date() == today:
            today_consumed += log.consumed_minutes

    # Task counts
    tasks_today = []
    if today_plan:
        tasks_today = today_plan.tasks

    pending = sum(1 for t in tasks_today if t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS))
    completed = sum(1 for t in tasks_today if t.status == TaskStatus.COMPLETED)
    approved = sum(1 for t in tasks_today if t.status == TaskStatus.APPROVED)

    return ChildDashboard(
        user=UserOut.model_validate(user),
        today_plan=StudyPlanOut.model_validate(today_plan) if today_plan else None,
        wallet_balance=balance,
        daily_limit=daily_limit,
        today_earned=today_earned,
        today_consumed=today_consumed,
        pending_tasks=pending,
        completed_tasks=completed,
        approved_tasks=approved,
    )


@router.get("/dashboard/parent", response_model=ParentDashboard)
def parent_dashboard(db: Session = Depends(get_db)):
    """Get parent's dashboard data."""
    today = date.today()

    children = db.query(User).filter(User.role == UserRole.CHILD).all()

    # Pending approval tasks
    pending_tasks = db.query(StudyTask).filter(
        StudyTask.status == TaskStatus.COMPLETED,
    ).all()

    # Today's plans for all children
    today_plans = db.query(StudyPlan).filter(
        StudyPlan.plan_date == today,
    ).all()

    # Active rules
    active_rules = db.query(RewardRule).filter(RewardRule.is_active == True).all()

    return ParentDashboard(
        children=[UserOut.model_validate(c) for c in children],
        pending_approvals=[StudyTaskOut.model_validate(t) for t in pending_tasks],
        today_plans=[StudyPlanOut.model_validate(p) for p in today_plans],
        active_rules=[RewardRuleOut.model_validate(r) for r in active_rules],
    )
