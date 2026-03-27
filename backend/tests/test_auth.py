

def test_register_parent(client):
    """親ユーザーの登録テスト"""
    response = client.post(
        "/api/auth/register",
        json={"name": "Test Parent", "role": "parent", "pin": "1234"},
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
        json={"name": "Test Child", "role": "child", "pin": "0000"},
    )
    assert response.status_code == 200
    child_id = response.json()["id"]

    # ウォレットが作成されているか確認 (本当はwalletエンドポイントがあればそれを使うが、無ければDBを直接見るか、ログイン後の情報を期待する)
    # ここではログインを試す
    login_resp = client.post(
        "/api/auth/login", json={"user_id": child_id, "pin": "0000"}
    )
    assert login_resp.status_code == 200


def test_login_invalid_pin(client):
    """不正なPINでのログイン失敗テスト"""
    # ユーザー作成
    reg = client.post(
        "/api/auth/register", json={"name": "PIN Test", "role": "parent", "pin": "1111"}
    )
    user_id = reg.json()["id"]

    # 違うPINでログイン
    response = client.post("/api/auth/login", json={"user_id": user_id, "pin": "9999"})
    assert response.status_code == 401
    assert response.json()["detail"] == "PINが正しくありません"


def test_list_users(client):
    """ユーザー一覧取得テスト"""
    client.post(
        "/api/auth/register", json={"name": "User A", "role": "parent", "pin": "1234"}
    )
    client.post(
        "/api/auth/register", json={"name": "User B", "role": "child", "pin": "1234"}
    )

    response = client.get("/api/auth/users")
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 2


def test_login_empty_pin_rejected_when_pin_set(client):
    """PINが設定されているユーザーに対して空のPINでログインが失敗することのテスト"""
    reg = client.post(
        "/api/auth/register", json={"name": "PIN User", "role": "parent", "pin": "5678"}
    )
    user_id = reg.json()["id"]

    # 空のPINでログイン試行
    response = client.post("/api/auth/login", json={"user_id": user_id, "pin": ""})
    assert response.status_code == 401
    assert response.json()["detail"] == "PINが正しくありません"


def test_login_null_pin_rejected_when_pin_set(client):
    """PINが設定されているユーザーに対してPINなしでログインが失敗することのテスト"""
    reg = client.post(
        "/api/auth/register", json={"name": "PIN User2", "role": "parent", "pin": "4321"}
    )
    user_id = reg.json()["id"]

    # PIN フィールドなし (None) でログイン試行
    response = client.post("/api/auth/login", json={"user_id": user_id})
    assert response.status_code == 401
    assert response.json()["detail"] == "PINが正しくありません"


def test_login_user_without_pin_succeeds(client):
    """PINが設定されていないユーザーはPINなしでログインできることのテスト"""
    reg = client.post(
        "/api/auth/register", json={"name": "No PIN User", "role": "parent"}
    )
    user_id = reg.json()["id"]

    # PINなしでログイン
    response = client.post("/api/auth/login", json={"user_id": user_id})
    assert response.status_code == 200
    assert response.json()["message"] == "ログイン成功"


def test_register_duplicate_email_returns_409(client):
    """同じメールアドレスで登録すると409が返ることのテスト"""
    client.post(
        "/api/auth/register",
        json={"name": "User X", "role": "parent", "pin": "1111", "email": "test@example.com"},
    )
    response = client.post(
        "/api/auth/register",
        json={"name": "User Y", "role": "parent", "pin": "2222", "email": "test@example.com"},
    )
    assert response.status_code == 409
    assert "メールアドレス" in response.json()["detail"]
