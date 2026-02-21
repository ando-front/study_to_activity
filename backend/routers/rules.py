"""Reward rules router - CRUD for reward rule configuration."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import RewardRule
from backend.schemas import RewardRuleCreate, RewardRuleOut, RewardRuleUpdate

router = APIRouter()


@router.post("/", response_model=RewardRuleOut)
def create_rule(data: RewardRuleCreate, db: Session = Depends(get_db)):
    """Create a new reward rule."""
    rule = RewardRule(
        trigger_type=data.trigger_type,
        trigger_condition=data.trigger_condition,
        reward_minutes=data.reward_minutes,
        description=data.description,
        is_active=data.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/", response_model=list[RewardRuleOut])
def list_rules(active_only: bool = False, db: Session = Depends(get_db)):
    """List all reward rules, optionally only active ones."""
    query = db.query(RewardRule)
    if active_only:
        query = query.filter(RewardRule.is_active == True)
    return query.all()


@router.get("/{rule_id}", response_model=RewardRuleOut)
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    """Get a specific reward rule."""
    rule = db.query(RewardRule).filter(RewardRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="報酬ルールが見つかりません")
    return rule


@router.patch("/{rule_id}", response_model=RewardRuleOut)
def update_rule(rule_id: int, data: RewardRuleUpdate, db: Session = Depends(get_db)):
    """Update a reward rule."""
    rule = db.query(RewardRule).filter(RewardRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="報酬ルールが見つかりません")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a reward rule."""
    rule = db.query(RewardRule).filter(RewardRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="報酬ルールが見つかりません")
    db.delete(rule)
    db.commit()
    return {"message": "報酬ルールを削除しました"}


@router.post("/seed-defaults", response_model=list[RewardRuleOut])
def seed_default_rules(db: Session = Depends(get_db)):
    """Create default reward rules (PRDのデフォルトテンプレート)."""
    defaults = [
        RewardRule(
            trigger_type="all_homework_done",
            trigger_condition=None,
            reward_minutes=30,
            description="当日の宿題をすべて完了",
            is_active=True,
        ),
        RewardRule(
            trigger_type="study_time_reached",
            trigger_condition={"minutes": 60},
            reward_minutes=30,
            description="学習計画を1時間分実施",
            is_active=True,
        ),
        RewardRule(
            trigger_type="task_completed",
            trigger_condition=None,
            reward_minutes=15,
            description="タスクを1つ完了",
            is_active=True,
        ),
        RewardRule(
            trigger_type="streak",
            trigger_condition={"days": 7},
            reward_minutes=120,
            description="1週間連続で計画達成 (週末ボーナス)",
            is_active=True,
        ),
    ]

    for rule in defaults:
        db.add(rule)
    db.commit()

    return db.query(RewardRule).all()
