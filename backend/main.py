"""Study to Activity (S2A) - FastAPI Application Entry Point."""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
from backend import database
from backend.database import engine, Base
from backend.routers import auth, plans, tasks, rules, wallet, switch

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Study to Activity (S2A)",
    description="学習進捗管理とアクティビティ報酬システム",
    version="0.1.0",
)

# ENV mode
IS_PROD = os.getenv("ENV") == "production"

# CORS settings
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
def reset_database(db: Session = Depends(database.get_db)):
    if IS_PROD:
        return {"error": "Reset not allowed in production"}, 403
    from backend.models import StudyTask, StudyPlan, ActivityLog, RewardLog, ActivityWallet
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
