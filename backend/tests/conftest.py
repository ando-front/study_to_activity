import os

import pytest

# テスト用の暗号化キーを設定（backend.security のインポート前に必要）
if not os.getenv("ENCRYPTION_KEY"):
    from cryptography.fernet import Fernet

    os.environ["ENCRYPTION_KEY"] = Fernet.generate_key().decode()

# 修正されたインポートパス
from backend.database import Base, get_db
from backend.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# テスト用データベースURL (メモリ内SQLite)
# StaticPool を使用して、同じスレッド内で単一の接続を維持する
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """テストセッション開始時にテーブルを作成する"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    """各テストごとに独立したDBセッションを提供する"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    """FastAPI TestClient。DBセッションをオーバーライドする。"""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
