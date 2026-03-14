from datetime import date


def test_reward_assignment_on_approval(client):
    """タスク承認時にウォレット残高が増加するかのテスト"""
    # 1. ユーザー作成
    parent_resp = client.post(
        "/api/auth/register", json={"name": "P", "role": "parent", "pin": "1234"}
    )
    child_resp = client.post(
        "/api/auth/register", json={"name": "C", "role": "child", "pin": "1234"}
    )
    parent_id = parent_resp.json()["id"]
    child_id = child_resp.json()["id"]

    # 2. 報酬ルール作成 (宿題完了で30分)
    # trigger_type="all_homework_done"
    client.post(
        "/api/rules/",
        json={
            "description": "All HW Done",
            "reward_minutes": 30,
            "trigger_type": "all_homework_done",
            "trigger_condition": {},
            "is_active": True,
        },
    )

    # 3. 学習計画作成
    # plan_date, title が必須
    plan_resp = client.post(
        "/api/plans/",
        json={
            "child_id": child_id,
            "plan_date": str(date.today()),
            "title": "Today's Plan",
            "tasks": [
                {"subject": "Math", "estimated_minutes": 30, "is_homework": True}
            ],
        },
    )
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()
    task_id = plan_data["tasks"][0]["id"]

    # 4. タスク完了
    client.post(f"/api/tasks/{task_id}/complete")

    # 5. 親が承認
    approve_resp = client.post(f"/api/tasks/{task_id}/approve?parent_id={parent_id}")
    assert approve_resp.status_code == 200

    # 6. ウォレットの確認 (Dashboard経由)
    dash_resp = client.get(f"/api/tasks/dashboard/child/{child_id}")
    assert dash_resp.status_code == 200
    assert dash_resp.json()["wallet_balance"] == 30


def test_wallet_initial_balance(client):
    """新規ユーザーのウォレット初期残高が0であるテスト"""
    resp = client.post(
        "/api/auth/register", json={"name": "Zero", "role": "child", "pin": "0000"}
    )
    child_id = resp.json()["id"]

    dash_resp = client.get(f"/api/tasks/dashboard/child/{child_id}")
    assert dash_resp.status_code == 200
    assert dash_resp.json()["wallet_balance"] == 0
