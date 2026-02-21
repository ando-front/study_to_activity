"""Reward engine: evaluates rules and grants activity time."""
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.models import (
    StudyTask, TaskStatus, RewardRule, TriggerType,
    ActivityWallet, RewardLog, StudyPlan
)


def evaluate_and_grant(db: Session, child_id: int) -> list[dict]:
    """
    Evaluate all active reward rules for a child and grant any earned rewards.
    Returns a list of newly granted rewards.
    """
    today = date.today()
    active_rules = db.query(RewardRule).filter(RewardRule.is_active == True).all()
    granted = []

    for rule in active_rules:
        # Check if already granted today for this rule
        already_granted = db.query(RewardLog).filter(
            RewardLog.child_id == child_id,
            RewardLog.rule_id == rule.id,
            RewardLog.granted_date == today
        ).first()

        if already_granted:
            continue

        if _check_trigger(db, child_id, rule, today):
            # Grant the reward
            wallet = db.query(ActivityWallet).filter(
                ActivityWallet.child_id == child_id
            ).first()

            if not wallet:
                wallet = ActivityWallet(child_id=child_id, balance_minutes=0)
                db.add(wallet)
                db.flush()

            # Apply daily limit
            new_balance = min(
                wallet.balance_minutes + rule.reward_minutes,
                wallet.daily_limit_minutes
            )
            wallet.balance_minutes = new_balance
            wallet.updated_at = datetime.utcnow()

            # Log the grant
            reward_log = RewardLog(
                child_id=child_id,
                rule_id=rule.id,
                granted_minutes=rule.reward_minutes,
                granted_date=today
            )
            db.add(reward_log)

            granted.append({
                "rule_id": rule.id,
                "description": rule.description,
                "granted_minutes": rule.reward_minutes,
                "new_balance": new_balance
            })

    db.commit()
    return granted


def _check_trigger(db: Session, child_id: int, rule: RewardRule, today: date) -> bool:
    """Check if a specific trigger condition is met."""

    if rule.trigger_type == TriggerType.ALL_HOMEWORK_DONE:
        return _check_all_homework_done(db, child_id, today)

    elif rule.trigger_type == TriggerType.STUDY_TIME_REACHED:
        target_minutes = (rule.trigger_condition or {}).get("minutes", 60)
        return _check_study_time_reached(db, child_id, today, target_minutes)

    elif rule.trigger_type == TriggerType.TASK_COMPLETED:
        return _check_task_completed(db, child_id, today)

    elif rule.trigger_type == TriggerType.STREAK:
        streak_days = (rule.trigger_condition or {}).get("days", 7)
        return _check_streak(db, child_id, today, streak_days)

    return False


def _check_all_homework_done(db: Session, child_id: int, today: date) -> bool:
    """Check if all homework tasks for today are approved."""
    plans = db.query(StudyPlan).filter(
        StudyPlan.child_id == child_id,
        StudyPlan.plan_date == today
    ).all()

    if not plans:
        return False

    for plan in plans:
        homework_tasks = [t for t in plan.tasks if t.is_homework]
        if not homework_tasks:
            continue
        if not all(t.status == TaskStatus.APPROVED for t in homework_tasks):
            return False

    # Ensure at least one homework task existed
    total_homework = sum(
        len([t for t in p.tasks if t.is_homework])
        for p in plans
    )
    return total_homework > 0


def _check_study_time_reached(db: Session, child_id: int, today: date, target_minutes: int) -> bool:
    """Check if total approved study time today reaches the target."""
    plans = db.query(StudyPlan).filter(
        StudyPlan.child_id == child_id,
        StudyPlan.plan_date == today
    ).all()

    total_minutes = 0
    for plan in plans:
        for task in plan.tasks:
            if task.status == TaskStatus.APPROVED:
                total_minutes += task.actual_minutes or task.estimated_minutes

    return total_minutes >= target_minutes


def _check_task_completed(db: Session, child_id: int, today: date) -> bool:
    """Check if any task was completed (approved) today."""
    plans = db.query(StudyPlan).filter(
        StudyPlan.child_id == child_id,
        StudyPlan.plan_date == today
    ).all()

    for plan in plans:
        if any(t.status == TaskStatus.APPROVED for t in plan.tasks):
            return True
    return False


def _check_streak(db: Session, child_id: int, today: date, streak_days: int) -> bool:
    """Check if the child has completed all homework for N consecutive days."""
    from datetime import timedelta

    for i in range(streak_days):
        check_date = today - timedelta(days=i)
        if not _check_all_homework_done(db, child_id, check_date):
            return False
    return True
