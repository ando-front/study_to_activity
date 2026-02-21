"""Study plans router - CRUD for daily/weekly study plans."""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import StudyPlan, StudyTask, User, UserRole
from backend.schemas import StudyPlanCreate, StudyPlanOut

router = APIRouter()


@router.post("/", response_model=StudyPlanOut)
def create_plan(data: StudyPlanCreate, db: Session = Depends(get_db)):
    """Create a new study plan with tasks."""
    # Verify child exists
    child = db.query(User).filter(
        User.id == data.child_id, User.role == UserRole.CHILD
    ).first()
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


@router.get("/", response_model=list[StudyPlanOut])
def list_plans(
    child_id: int | None = Query(None),
    plan_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    """List study plans, optionally filtered by child and/or date."""
    query = db.query(StudyPlan)
    if child_id is not None:
        query = query.filter(StudyPlan.child_id == child_id)
    if plan_date is not None:
        query = query.filter(StudyPlan.plan_date == plan_date)
    return query.order_by(StudyPlan.plan_date.desc()).all()


@router.get("/{plan_id}", response_model=StudyPlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    """Get a specific study plan with its tasks."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")
    return plan


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    """Delete a study plan (cascades to tasks)."""
    plan = db.query(StudyPlan).filter(StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="学習計画が見つかりません")
    db.delete(plan)
    db.commit()
    return {"message": "学習計画を削除しました"}


@router.post("/{plan_id}/tasks", response_model=StudyPlanOut)
def add_task_to_plan(plan_id: int, task_data: dict, db: Session = Depends(get_db)):
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
