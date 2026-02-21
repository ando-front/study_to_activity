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
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

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
