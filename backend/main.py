"""Study to Activity (S2A) - FastAPI Application Entry Point."""

import os
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend import database
from backend.database import Base, engine
from backend.routers import auth, plans, rules, switch, tasks, wallet
from backend.seed import seed as _auto_seed

# Create all tables
Base.metadata.create_all(bind=engine)
database.ensure_schema_compatibility()

# Auto-seed initial data when the database is empty (e.g. fresh CI run or first launch)
_auto_seed()

app = FastAPI(
    title="Study to Activity (S2A)",
    description="学習進捗管理とアクティビティ報酬システム",
    version="0.1.0",
)

# ENV mode
IS_PROD = os.getenv("ENV") == "production"

# CORS settings
origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]
# In production (PostgreSQL), default to allowing all HTTPS origins so the
# deployed frontend (e.g. Vercel / Render) can reach the backend without
# requiring ALLOWED_ORIGIN_REGEX to be explicitly set.
# For tighter security, set ALLOWED_ORIGIN_REGEX to a specific pattern
# (e.g. "https://(app\.yourdomain\.com)") in the production environment.
_db_url = os.getenv("DATABASE_URL", "")
_default_origin_regex = "https://[^/]+" if "postgresql" in _db_url else None
origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX", _default_origin_regex)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router, prefix="/api/auth", tags=["認証"])
app.include_router(plans.router, prefix="/api/plans", tags=["学習計画"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["タスク"])
app.include_router(rules.router, prefix="/api/rules", tags=["報酬ルール"])
app.include_router(wallet.router, prefix="/api/wallet", tags=["ウォレット"])
app.include_router(switch.router, prefix="/api/switch", tags=["Nintendo Switch"])


@app.get("/")
def root():
    return {"message": "Study to Activity API is running!", "version": "0.1.0"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Test-only endpoint (DISABLED in production)
@app.post("/api/test/reset")
def reset_database(db: Annotated[Session, Depends(database.get_db)]):
    if IS_PROD:
        return {"error": "Reset not allowed in production"}, 403
    from backend.models import (
        ActivityLog,
        ActivityWallet,
        RewardLog,
        StudyPlan,
        StudyTask,
    )

    db.query(ActivityLog).delete()
    db.query(RewardLog).delete()
    db.query(StudyTask).delete()
    db.query(StudyPlan).delete()
    db.query(ActivityWallet).delete()
    db.commit()
    return {"message": "Database reset for testing"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
