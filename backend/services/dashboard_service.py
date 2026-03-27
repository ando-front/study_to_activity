"""
Service layer for dashboard-related logic.
"""
from datetime import date

from sqlalchemy.orm import Session

from backend.models import (
    ActivityLog,
    ActivityWallet,
    RewardLog,
    RewardRule,
    StudyPlan,
    StudyTask,
    TaskStatus,
    User,
    UserRole,
)


def get_child_dashboard_data(db: Session, child_id: int):
    """
    Get all data required for the child's dashboard.
    """
    user = (
        db.query(User).filter(User.id == child_id, User.role == UserRole.CHILD).first()
    )
    if not user:
        return None

    today = date.today()

    today_plan = (
        db.query(StudyPlan)
        .filter(
            StudyPlan.child_id == child_id,
            StudyPlan.plan_date == today,
        )
        .first()
    )

    wallet = (
        db.query(ActivityWallet).filter(ActivityWallet.child_id == child_id).first()
    )
    balance = wallet.balance_minutes if wallet else 0
    daily_limit = wallet.daily_limit_minutes if wallet else 120

    reward_logs = (
        db.query(RewardLog)
        .filter(
            RewardLog.child_id == child_id,
            RewardLog.granted_date == today,
        )
        .all()
    )
    today_earned = sum(r.granted_minutes for r in reward_logs)

    activity_logs = (
        db.query(ActivityLog)
        .filter(
            ActivityLog.child_id == child_id,
        )
        .all()
    )
    today_consumed = 0
    for log in activity_logs:
        if log.created_at and log.created_at.date() == today:
            today_consumed += log.consumed_minutes

    tasks_today = []
    if today_plan:
        tasks_today = today_plan.tasks

    pending = sum(
        1
        for t in tasks_today
        if t.status in (TaskStatus.PENDING, TaskStatus.IN_PROGRESS)
    )
    completed = sum(1 for t in tasks_today if t.status == TaskStatus.COMPLETED)
    approved = sum(1 for t in tasks_today if t.status == TaskStatus.APPROVED)

    return {
        "user": user,
        "today_plan": today_plan,
        "wallet_balance": balance,
        "daily_limit": daily_limit,
        "today_earned": today_earned,
        "today_consumed": today_consumed,
        "pending_tasks": pending,
        "completed_tasks": completed,
        "approved_tasks": approved,
    }


def get_parent_dashboard_data(db: Session):
    """
    Get all data required for the parent's dashboard.
    """
    today = date.today()

    children = db.query(User).filter(User.role == UserRole.CHILD).all()

    pending_tasks = (
        db.query(StudyTask)
        .filter(
            StudyTask.status == TaskStatus.COMPLETED,
        )
        .all()
    )

    today_plans = (
        db.query(StudyPlan)
        .filter(
            StudyPlan.plan_date == today,
        )
        .all()
    )

    active_rules = db.query(RewardRule).filter(RewardRule.is_active).all()

    return {
        "children": children,
        "pending_approvals": pending_tasks,
        "today_plans": today_plans,
        "active_rules": active_rules,
    }
