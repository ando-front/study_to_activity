"""Study history router - view completed study records."""

from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import RewardLog, StudyPlan, StudyTask, TaskStatus, User, UserRole
from backend.schemas import StudyHistoryEntry, StudyHistoryResponse, UserOut

router = APIRouter()


@router.get("/{child_id}", response_model=StudyHistoryResponse)
def get_study_history(  # noqa: C901
    child_id: int,
    db: Annotated[Session, Depends(get_db)],
    date_from: Optional[date] = Query(None, description="Start date filter"),  # noqa: B008
    date_to: Optional[date] = Query(None, description="End date filter"),  # noqa: B008
    limit: int = Query(50, ge=1, le=200),  # noqa: B008
):
    """Get study history for a child."""
    child = (
        db.query(User).filter(User.id == child_id, User.role == UserRole.CHILD).first()
    )
    if not child:
        raise HTTPException(status_code=404, detail="子供ユーザーが見つかりません")

    q = (
        db.query(StudyTask, StudyPlan)
        .join(StudyPlan, StudyTask.plan_id == StudyPlan.id)
        .filter(StudyPlan.child_id == child_id)
        .filter(StudyTask.status.in_([TaskStatus.COMPLETED, TaskStatus.APPROVED]))
    )

    if date_from:
        q = q.filter(StudyPlan.plan_date >= date_from)
    if date_to:
        q = q.filter(StudyPlan.plan_date <= date_to)

    q = q.order_by(StudyPlan.plan_date.desc(), StudyTask.completed_at.desc())
    results = q.limit(limit).all()

    # Get reward info for approved tasks
    reward_map = {}
    if results:
        task_dates = set()
        for task, _ in results:
            if task.status == TaskStatus.APPROVED and task.approved_at:
                task_dates.add(task.approved_at.date())

        if task_dates:
            reward_logs = (
                db.query(RewardLog)
                .filter(
                    RewardLog.child_id == child_id,
                    RewardLog.granted_date.in_(list(task_dates)),
                )
                .all()
            )
            for rl in reward_logs:
                reward_map.setdefault(rl.granted_date, 0)
                reward_map[rl.granted_date] += rl.granted_minutes

    entries = []
    total_study = 0
    total_reward = 0

    for task, plan in results:
        minutes = task.actual_minutes or task.estimated_minutes
        total_study += minutes

        reward_mins = 0
        if task.status == TaskStatus.APPROVED and task.approved_at:
            reward_mins = reward_map.get(task.approved_at.date(), 0)

        entries.append(
            StudyHistoryEntry(
                task_id=task.id,
                subject=task.subject,
                description=task.description,
                estimated_minutes=task.estimated_minutes,
                actual_minutes=task.actual_minutes,
                is_homework=task.is_homework,
                status=task.status.value,
                started_at=task.started_at,
                completed_at=task.completed_at,
                approved_at=task.approved_at,
                plan_date=plan.plan_date,
                plan_title=plan.title,
                reward_minutes=reward_mins,
            )
        )
        total_reward += reward_mins

    return StudyHistoryResponse(
        child=UserOut.model_validate(child),
        entries=entries,
        total_study_minutes=total_study,
        total_reward_minutes=total_reward,
    )
