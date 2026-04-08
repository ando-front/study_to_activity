"""
データベース接続とセッション管理。

SQLAlchemy を使用してデータベース接続を構成する。
環境変数 DATABASE_URL で接続先を切り替え可能（デフォルトは SQLite）。
本番環境では PostgreSQL への移行を想定している。

使用例（FastAPI の依存性注入）::

    @app.get("/items")
    def list_items(db: Session = Depends(get_db)):
        return db.query(Item).all()
"""

import logging
import os

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger(__name__)

# 環境変数からデータベースURLを取得。未設定の場合はローカル SQLite をフォールバックに使用
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./s2a.db")

# SQLite はマルチスレッドアクセスに check_same_thread=False が必要。
# PostgreSQL 等の本番 DB では不要なため、SQLite 使用時のみ設定する。
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """全モデルの基底クラス。SQLAlchemy の宣言的マッピングに使用。"""

    pass


def ensure_schema_compatibility():
    """Apply lightweight compatibility fixes for deployed databases.

    This project currently doesn't use Alembic migrations, so we patch the
    small number of production schema mismatches that can break runtime.
    """
    if "postgresql" not in DATABASE_URL:
        return

    try:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ALTER COLUMN pin TYPE VARCHAR(255)"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS nintendo_session_token TEXT"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES users(id)"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_game_limit_minutes INTEGER DEFAULT 60"))
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS line_notify_token VARCHAR(255)"))
    except SQLAlchemyError as exc:
        # Column type is already compatible, or a non-fatal DB error occurred.
        # Log and continue rather than crashing the application on startup.
        logger.warning("ensure_schema_compatibility: skipped – %s", exc)


def get_db():
    """
    データベースセッションを提供する FastAPI 依存関数。

    リクエストごとにセッションを生成し、処理完了後に確実にクローズする。
    Yields:
        Session: SQLAlchemy データベースセッション
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
