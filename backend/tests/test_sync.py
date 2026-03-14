from datetime import date
from unittest.mock import AsyncMock, patch


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
