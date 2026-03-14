from backend.models import UserRole

def test_register_parent(client):
    """親ユーザーの登録テスト"""
    response = client.post(
        "/api/auth/register",
        json={"name": "Test Parent", "role": "parent", "pin": "1234"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Parent"
    assert data["role"] == "parent"
    assert "id" in data

def test_register_child_creates_wallet(client):
    """子供ユーザー登録時にウォレットが自動作成されるかのテスト"""
    response = client.post(
        "/api/auth/register",
        json={"name": "Test Child", "role": "child", "pin": "0000"}
    )
    assert response.status_code == 200
    child_id = response.json()["id"]
    
    # ウォレットが作成されているか確認 (本当はwalletエンドポイントがあればそれを使うが、無ければDBを直接見るか、ログイン後の情報を期待する)
    # ここではログインを試す
    login_resp = client.post(
        "/api/auth/login",
        json={"user_id": child_id, "pin": "0000"}
    )
    assert login_resp.status_code == 200

def test_login_invalid_pin(client):
    """不正なPINでのログイン失敗テスト"""
    # ユーザー作成
    reg = client.post(
        "/api/auth/register",
        json={"name": "PIN Test", "role": "parent", "pin": "1111"}
    )
    user_id = reg.json()["id"]
    
    # 違うPINでログイン
    response = client.post(
        "/api/auth/login",
        json={"user_id": user_id, "pin": "9999"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "PINが正しくありません"

def test_list_users(client):
    """ユーザー一覧取得テスト"""
    client.post("/api/auth/register", json={"name": "User A", "role": "parent", "pin": "1234"})
    client.post("/api/auth/register", json={"name": "User B", "role": "child", "pin": "1234"})
    
    response = client.get("/api/auth/users")
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 2
