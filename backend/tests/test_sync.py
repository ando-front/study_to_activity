from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from backend.sync_utils import trigger_switch_sync


@pytest.mark.asyncio
async def test_sync_skips_gracefully_when_parent_has_no_nintendo_token(db_session):
    """
    親ユーザーが Nintendo トークンを持っていない場合、
    trigger_switch_sync が例外を発生させずにスキップすること。

    修正前のバグ: `User.nintendo_session_token is not None` は常に True と評価され
    トークン未設定の親が返り、decrypt_token(None) で例外が発生していた。
    """

    from backend.models import (
        ActivityWallet,
        User,
        UserRole,
    )

    # 親ユーザーを作成 (Nintendo トークンなし)
    parent = User(name="Parent No Token", role=UserRole.PARENT)
    parent.pin = "hashed"
    db_session.add(parent)

    # 子ユーザーとウォレットを作成
    child = User(name="Child", role=UserRole.CHILD)
    child.pin = "hashed"
    db_session.add(child)
    db_session.flush()

    wallet = ActivityWallet(child_id=child.id, balance_minutes=30, daily_limit_minutes=120)
    db_session.add(wallet)
    db_session.commit()

    # Nintendo トークン未設定の状態で同期を呼び出しても例外が出ないこと
    await trigger_switch_sync(db_session, child.id)

    # ウォレット残高は変化しないこと
    db_session.refresh(wallet)
    assert wallet.balance_minutes == 30


@pytest.mark.asyncio
async def test_sync_skips_when_no_parent_with_token_exists(db_session):
    """
    Nintendo トークンを持つ親が一人もいない場合、同期がスキップされること。
    修正した IS NOT NULL フィルターが正しく機能するかを確認する。
    """
    from backend.models import ActivityWallet, User, UserRole

    # トークンなしの親と子を作成
    parent = User(name="Parent", role=UserRole.PARENT)
    parent.pin = "hashed"
    parent.nintendo_session_token = None  # 明示的に None
    db_session.add(parent)

    child = User(name="Child", role=UserRole.CHILD)
    child.pin = "hashed"
    db_session.add(child)
    db_session.flush()

    wallet = ActivityWallet(child_id=child.id, balance_minutes=60, daily_limit_minutes=120)
    db_session.add(wallet)
    db_session.commit()

    # 例外なくスキップされること
    await trigger_switch_sync(db_session, child.id)

    # ウォレット残高は変化しない
    db_session.refresh(wallet)
    assert wallet.balance_minutes == 60


def test_approve_task_triggers_background_sync(client):
    """タスク承認時にバックグラウンド同期が呼び出されることを確認するテスト"""
    # 1. ユーザー作成
    parent_resp = client.post(
        "/api/auth/register", json={"name": "P", "role": "parent", "pin": "1234"}
    )
    child_resp = client.post(
        "/api/auth/register", json={"name": "C", "role": "child", "pin": "1234"}
    )
    parent_id = parent_resp.json()["id"]
    child_id = child_resp.json()["id"]

    # 親にトークンをセット (同期条件)
    # 実際はAPI経由だが、ここではDBを直接触るか、あるいはモックで同期処理自体を乗っ取る
    # 今回は sync_utils.trigger_switch_sync 自体をモックする

    # 2. 報酬ルール作成
    client.post(
        "/api/rules/",
        json={
            "description": "Rule for sync test",
            "reward_minutes": 30,
            "trigger_type": "all_homework_done",
            "trigger_condition": {},
            "is_active": True,
        },
    )

    # 3. 学習計画作成
    plan_resp = client.post(
        "/api/plans/",
        json={
            "child_id": child_id,
            "plan_date": str(date.today()),
            "title": "Sync Test Plan",
            "tasks": [
                {"subject": "Math", "estimated_minutes": 30, "is_homework": True}
            ],
        },
    )
    task_id = plan_resp.json()["tasks"][0]["id"]
    client.post(f"/api/tasks/{task_id}/complete")

    # 4. 承認時に同期ユーティリティが呼ばれるかパッチを当てる
    with patch("backend.routers.tasks.trigger_switch_sync") as mock_sync:
        # AsyncMockとして設定
        mock_sync.side_effect = AsyncMock()

        response = client.post(f"/api/tasks/{task_id}/approve?parent_id={parent_id}")
        assert response.status_code == 200
        assert len(response.json()["rewards_granted"]) > 0

        # TestClient はレスポンス返却後にバックグラウンドタスクを実行する
        # そのため、ここでモックの呼び出しを確認できる
        mock_sync.assert_called_once()
        # 引数の確認 (db_session, child_id)
        # 第1引数は Session オブジェクトなので型チェック
        args, _ = mock_sync.call_args
        assert args[1] == child_id
