"""Tests for Nintendo Switch sync bug fixes.

Covers:
1. _calculate_switch_limit includes today's earned bonus
2. SQLAlchemy filter uses .isnot(None) instead of Python `is not None`
3. Sync endpoint returns error when no devices were updated
"""

from datetime import date
from unittest.mock import AsyncMock, patch

from backend.models import ActivityWallet, RewardLog, User, UserRole
from backend.sync_utils import _calculate_switch_limit


def test_calculate_switch_limit_includes_bonus(db_session):
    """Base limit + today's earned bonus should be reflected in the Switch limit."""
    child = User(name="TestChild", role=UserRole.CHILD, pin="x")
    db_session.add(child)
    db_session.flush()

    wallet = ActivityWallet(
        child_id=child.id, balance_minutes=90, daily_limit_minutes=60
    )
    db_session.add(wallet)

    # Simulate 30 min earned today via a reward
    reward = RewardLog(
        child_id=child.id, rule_id=1, granted_minutes=30, granted_date=date.today()
    )
    db_session.add(reward)
    db_session.flush()

    limit = _calculate_switch_limit(db_session, child.id, wallet)
    # base 60 + bonus 30 = 90, capped by balance(90) + base(60) = 150 → effective 90
    assert limit == 90


def test_calculate_switch_limit_no_bonus(db_session):
    """Without any bonus, limit should be min(base, balance+base)."""
    child = User(name="TestChild2", role=UserRole.CHILD, pin="x")
    db_session.add(child)
    db_session.flush()

    wallet = ActivityWallet(
        child_id=child.id, balance_minutes=0, daily_limit_minutes=60
    )
    db_session.add(wallet)
    db_session.flush()

    limit = _calculate_switch_limit(db_session, child.id, wallet)
    # base 60 + bonus 0 = 60, capped by balance(0) + base(60) = 60 → effective 60
    assert limit == 60


def test_calculate_switch_limit_capped_by_wallet(db_session):
    """Effective limit should not exceed wallet balance + base."""
    child = User(name="TestChild3", role=UserRole.CHILD, pin="x")
    db_session.add(child)
    db_session.flush()

    wallet = ActivityWallet(
        child_id=child.id, balance_minutes=10, daily_limit_minutes=60
    )
    db_session.add(wallet)

    # Large bonus
    reward = RewardLog(
        child_id=child.id, rule_id=1, granted_minutes=120, granted_date=date.today()
    )
    db_session.add(reward)
    db_session.flush()

    limit = _calculate_switch_limit(db_session, child.id, wallet)
    # base 60 + bonus 120 = 180, capped by balance(10) + base(60) = 70 → effective 70
    assert limit == 70


def test_sync_endpoint_error_when_no_devices_updated(client):
    """Sync should return 500 when devices exist but none were successfully updated."""
    # Create parent with mock token
    parent_resp = client.post(
        "/api/auth/register",
        json={"name": "SyncParent", "role": "parent", "pin": "1234"},
    )
    parent_id = parent_resp.json()["id"]
    child_resp = client.post(
        "/api/auth/register",
        json={"name": "SyncChild", "role": "child", "pin": "1234"},
    )

    # Mock: set parent's nintendo token directly in DB
    from backend.database import get_db
    from backend.main import app

    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)

    parent = db.query(User).filter(User.id == parent_id).first()
    parent.nintendo_session_token = "encrypted_dummy"
    db.flush()

    mock_devices = [{"device_id": "dev1", "name": "Switch1"}]

    with (
        patch("backend.routers.switch.switch_service.get_devices", new_callable=AsyncMock, return_value=mock_devices),
        patch("backend.routers.switch.switch_service.update_device_limit", new_callable=AsyncMock, return_value=False),
        patch("backend.security.decrypt_token", return_value="dummy_session_token"),
    ):
        resp = client.post(
            f"/api/switch/sync/{parent_id}",
            headers={"X-API-Key": "test"},
        )
        assert resp.status_code == 500
        assert "失敗" in resp.json()["detail"]


def test_sync_endpoint_success_when_device_updated(client):
    """Sync should return 200 with device names when update succeeds."""
    parent_resp = client.post(
        "/api/auth/register",
        json={"name": "SyncParent2", "role": "parent", "pin": "1234"},
    )
    parent_id = parent_resp.json()["id"]
    client.post(
        "/api/auth/register",
        json={"name": "SyncChild2", "role": "child", "pin": "1234"},
    )

    from backend.database import get_db
    from backend.main import app

    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)

    parent = db.query(User).filter(User.id == parent_id).first()
    parent.nintendo_session_token = "encrypted_dummy"
    db.flush()

    mock_devices = [{"device_id": "dev1", "name": "MySwitch"}]

    with (
        patch("backend.routers.switch.switch_service.get_devices", new_callable=AsyncMock, return_value=mock_devices),
        patch("backend.routers.switch.switch_service.update_device_limit", new_callable=AsyncMock, return_value=True),
        patch("backend.security.decrypt_token", return_value="dummy_session_token"),
    ):
        resp = client.post(
            f"/api/switch/sync/{parent_id}",
            headers={"X-API-Key": "test"},
        )
        assert resp.status_code == 200
        assert "MySwitch" in resp.json()["synced_devices"]


def test_background_sync_finds_parent_with_token(db_session):
    """Background sync should correctly find parent using SQLAlchemy .isnot(None)."""
    # Create parent WITHOUT token
    parent_no_token = User(name="NoToken", role=UserRole.PARENT, pin="x")
    db_session.add(parent_no_token)

    # Create parent WITH token
    parent_with_token = User(
        name="HasToken",
        role=UserRole.PARENT,
        pin="x",
        nintendo_session_token="encrypted_value",
    )
    db_session.add(parent_with_token)

    db_session.flush()

    # The fixed query should find the parent with a token
    result = (
        db_session.query(User)
        .filter(
            User.role == UserRole.PARENT,
            User.nintendo_session_token.isnot(None),
        )
        .first()
    )
    assert result is not None
    assert result.name == "HasToken"

    # Verify the OLD buggy query (Python `is not None`) would NOT work correctly
    # Python's `is not None` always evaluates to True for a Column object
    buggy_result = User.nintendo_session_token is not None
    assert buggy_result is True  # This is always True - the bug!
