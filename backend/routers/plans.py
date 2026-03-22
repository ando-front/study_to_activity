from __future__ import annotations
"""Study plans router - CRUD for daily/weekly study plans."""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import StudyPlan, StudyTask, User, UserRole
from backend.schemas import StudyPlanCreate, StudyPlanOut, WeeklySchedule

router = APIRouter()


@router.post("/", response_model=StudyPlanOut)
def create_plan(data: StudyPlanCreate, db: Annotated[Session, Depends(get_db)]):
    """Create a new study plan with tasks."""
    # Verify child exists
    child = (
        db.query(User)
        .filter(User.id == data.child_id, User.role == UserRole.CHILD)
        .first()
    )
    if not child:
        raise HTTPException(status_code=404, detail="子供ユーザーが見つかりません")

    plan = StudyPlan(
        child_id=data.child_id,
        plan_date=data.plan_date,
        title=data.title,
    )
    db.add(plan)
    db.flush()

    # Add tasks
    for task_data in data.tasks:
        task = StudyTask(
            plan_id=plan.id,
            subject=task_data.subject,
            description=task_data.description,
            estimated_minutes=task_data.estimated_minutes,
            is_homework=task_data.is_homework,
        )
        db.add(task)

    db.commit()
    db.refresh(plan)
    return plan


@router.get("/weekly", response_model=WeeklySchedule)
def get_weekly_schedule(
    db: Annotated[Session, Depends(get_db)],
    child_id: Annotated[int | None, Query()] = None,
    week_start: Annotated[date | None, Query()] = None,
):
    """Return a week's worth of study plans (Mon–Sun) for the given child.

    If ``week_start`` is omitted, the current week's Monday is used.
    """
    today = date.today()
    if week_start is None:
        # Default to the Monday of the current week
        week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    query = db.query(StudyPlan).filter(
        StudyPlan.plan_date >= week_start,
        StudyPlan.plan_date <= week_end,
    )
    if child_id is not None:
        query = query.filter(StudyPlan.child_id == child_id)

    plans = query.order_by(StudyPlan.plan_date.asc()).all()

    # Group by day-of-week label
    DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"]
    days: dict[str, list] = {label: [] for label in DAY_LABELS}
    for plan in plans:
        weekday = plan.plan_date.weekday()  # 0=Mon … 6=Sun
        days[DAY_LABELS[weekday]].append(StudyPlanOut.model_validate(plan))

    return WeeklySchedule(
        week_start=week_start,
        week_end=week_end,
        days=days,
    )


@router.get("/", response_model=list[StudyPlanOut])
def list_plans(
    db: Annotated[Session, Depends(get_db)],
    child_id: Annotated[int | None, Query()] = None,
    plan_date: Annotated[date | None, Query()] = None,
):
    """List study plans, optionally filtered by child and/or date."""
    query = db.query(StudyPlan)
    if child_id is not None:
        query = query.filter(StudyPlan.child_id == child_id)
    if plan_date is not None:
        query = query.filter(StudyPlan.plan_date == plan_date)
    return query.order_by(StudyPlan.plan_date.desc()).all()


@router.get("/{plan_id}", response_model=StudyPlanOut)
def get_plan(plan_id: int, db: Annotated[Session, Depends(get_db)]):
    """Get a specific study plan with its tasks."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")
    return plan


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Annotated[Session, Depends(get_db)]):
    """Delete a study plan (cascades to tasks)."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")
    db.delete(plan)
    db.commit()
    return {"message": "学習計画を削除しました"}


@router.post("/{plan_id}/tasks", response_model=StudyPlanOut)
def add_task_to_plan(
    plan_id: int, task_data: dict, db: Annotated[Session, Depends(get_db)]
):
    """Add a new task to an existing plan."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")

    task = StudyTask(
        plan_id=plan.id,
        subject=task_data.get("subject", ""),
        description=task_data.get("description"),
        estimated_minutes=task_data.get("estimated_minutes", 30),
        is_homework=task_data.get("is_homework", False),
    )
    db.add(task)
    db.commit()
    db.refresh(plan)
    return plan
