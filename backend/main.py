"""Study to Activity (S2A) - FastAPI Application Entry Point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, Base
from backend.routers import auth, plans, tasks, rules, wallet

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Study to Activity (S2A)",
    description="学習進捗管理とアクティビティ報酬システム",
    version="0.1.0",
)

# CORS settings (allow frontend dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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


@app.get("/")
def root():
    return {"message": "Study to Activity API is running!", "version": "0.1.0"}


@app.get("/api/health")
def health():
    return {"status": "ok"}
