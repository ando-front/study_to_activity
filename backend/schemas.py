"""Pydantic schemas for request/response serialization."""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel


# --- User ---

class UserCreate(BaseModel):
    name: str
    role: str  # "parent" or "child"
    pin: Optional[str] = None


class UserOut(BaseModel):
    id: int
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    user_id: int
    pin: Optional[str] = None


class LoginResponse(BaseModel):
    user: UserOut
    message: str


# --- Study Plan ---

class StudyTaskCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    estimated_minutes: int = 30
    is_homework: bool = False


class StudyTaskOut(BaseModel):
    id: int
    plan_id: int
    subject: str
    description: Optional[str]
    estimated_minutes: int
    actual_minutes: Optional[int]
    is_homework: bool
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    approved_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class StudyTaskUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    estimated_minutes: Optional[int] = None
    is_homework: Optional[bool] = None


class StudyPlanCreate(BaseModel):
    child_id: int
    plan_date: date
    title: str
    tasks: list[StudyTaskCreate] = []


class StudyPlanOut(BaseModel):
    id: int
    child_id: int
    plan_date: date
    title: str
    tasks: list[StudyTaskOut]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Reward Rule ---

class RewardRuleCreate(BaseModel):
    trigger_type: str
    trigger_condition: Optional[dict] = None
    reward_minutes: int
    description: str
    is_active: bool = True


class RewardRuleOut(BaseModel):
    id: int
    trigger_type: str
    trigger_condition: Optional[dict]
    reward_minutes: int
    description: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RewardRuleUpdate(BaseModel):
    trigger_type: Optional[str] = None
    trigger_condition: Optional[dict] = None
    reward_minutes: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# --- Activity Wallet ---

class WalletOut(BaseModel):
    id: int
    child_id: int
    balance_minutes: int
    daily_limit_minutes: int
    carry_over: bool
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class WalletAdjust(BaseModel):
    minutes: int  # positive to add, negative to subtract
    reason: str


class WalletSettingsUpdate(BaseModel):
    daily_limit_minutes: Optional[int] = None
    carry_over: Optional[bool] = None


# --- Activity Log ---

class ActivityLogCreate(BaseModel):
    activity_type: str = "other"  # "switch", "tablet", "other"
    description: Optional[str] = None
    consumed_minutes: int


class ActivityLogOut(BaseModel):
    id: int
    child_id: int
    activity_type: str
    description: Optional[str]
    consumed_minutes: int
    source: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Dashboard ---

class ChildDashboard(BaseModel):
    user: UserOut
    today_plan: Optional[StudyPlanOut]
    wallet_balance: int
    daily_limit: int
    today_earned: int
    today_consumed: int
    pending_tasks: int
    completed_tasks: int
    approved_tasks: int


class ParentDashboard(BaseModel):
    children: list[UserOut]
    pending_approvals: list[StudyTaskOut]
    today_plans: list[StudyPlanOut]
    active_rules: list[RewardRuleOut]


# --- Reward Log ---

class RewardLogOut(BaseModel):
    id: int
    child_id: int
    rule_id: int
    granted_minutes: int
    granted_date: date
    created_at: datetime

    model_config = {"from_attributes": True}
