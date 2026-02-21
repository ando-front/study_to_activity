"""SQLAlchemy models for Study to Activity."""
import enum
from datetime import datetime, date, time

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, Time,
    ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from backend.database import Base


# --- Enums ---

class UserRole(str, enum.Enum):
    PARENT = "parent"
    CHILD = "child"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"        # 未着手
    IN_PROGRESS = "in_progress"  # 進行中
    COMPLETED = "completed"    # 完了（承認待ち）
    APPROVED = "approved"      # 親が承認済み
    REJECTED = "rejected"      # 差し戻し


class TriggerType(str, enum.Enum):
    ALL_HOMEWORK_DONE = "all_homework_done"     # 当日の宿題すべて完了
    STUDY_TIME_REACHED = "study_time_reached"   # 学習時間が条件を達成
    TASK_COMPLETED = "task_completed"            # 特定タスク完了
    STREAK = "streak"                            # 連続達成


class ActivityType(str, enum.Enum):
    SWITCH = "switch"
    TABLET = "tablet"
    OTHER = "other"


# --- Models ---

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)
    pin = Column(String(10), nullable=True)  # Simple PIN auth
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    study_plans = relationship("StudyPlan", back_populates="child")
    wallet = relationship("ActivityWallet", back_populates="child", uselist=False)
    activity_logs = relationship("ActivityLog", back_populates="child")


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plan_date = Column(Date, nullable=False)
    title = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    child = relationship("User", back_populates="study_plans")
    tasks = relationship("StudyTask", back_populates="plan", cascade="all, delete-orphan")


class StudyTask(Base):
    __tablename__ = "study_tasks"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("study_plans.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    estimated_minutes = Column(Integer, nullable=False, default=30)
    actual_minutes = Column(Integer, nullable=True)
    is_homework = Column(Boolean, default=False)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    plan = relationship("StudyPlan", back_populates="tasks")


class RewardRule(Base):
    __tablename__ = "reward_rules"

    id = Column(Integer, primary_key=True, index=True)
    trigger_type = Column(SAEnum(TriggerType), nullable=False)
    trigger_condition = Column(JSON, nullable=True)  # e.g. {"minutes": 60}
    reward_minutes = Column(Integer, nullable=False)
    description = Column(String(300), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ActivityWallet(Base):
    __tablename__ = "activity_wallets"

    id = Column(Integer, primary_key=True, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    balance_minutes = Column(Integer, default=0)
    daily_limit_minutes = Column(Integer, default=120)  # 1日最大2時間
    carry_over = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    child = relationship("User", back_populates="wallet")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(SAEnum(ActivityType), default=ActivityType.OTHER)
    description = Column(String(200), nullable=True)
    consumed_minutes = Column(Integer, nullable=False)
    source = Column(String(100), nullable=True)  # Which rule granted this, or "manual"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    child = relationship("User", back_populates="activity_logs")


class RewardLog(Base):
    """Tracks which rewards were already granted to avoid double-granting."""
    __tablename__ = "reward_logs"

    id = Column(Integer, primary_key=True, index=True)
    child_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("reward_rules.id"), nullable=False)
    granted_minutes = Column(Integer, nullable=False)
    granted_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
