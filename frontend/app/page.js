/**
 * @fileoverview ロール選択ページ（トップページ）
 *
 * アプリケーションのエントリーポイント。
 * 登録済みユーザーをロール別（子供 / 親）に一覧表示し、
 * タップで localStorage にユーザー情報を保存してダッシュボードへ遷移する。
 *
 * 家庭内利用を想定し、トークン認証ではなくシンプルな
 * ユーザー選択 + オプション PIN 方式を採用している。
 */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { authApi, isNetworkError } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  // --- State ---
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  // 新規登録フォームの入力値
  const [registerName, setRegisterName] = useState("");
  const [registerRole, setRegisterRole] = useState("child");
  const [registerPin, setRegisterPin] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");

  // PIN ダイアログ（PIN 付き親ユーザー用）
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);

  /** 初回マウント時に登録済みユーザーを取得 */
  useEffect(() => {
    authApi
      .listUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /**
   * ユーザーカードをタップしたときの処理。
   * - 親ユーザーはバックエンドの PIN 認証を経由して localStorage に保存しダッシュボードへ遷移する
   * - 子供ユーザーは localStorage に選択ユーザーを保存してダッシュボードへ遷移する
   */
  const handleSelect = async (user) => {
    if (user.role === "parent") {
      // PIN なしでログインを試みる（PIN 未設定ユーザーはそのまま成功）
      try {
        const result = await authApi.login({ user_id: user.id, pin: "" });
        localStorage.setItem("s2a_user", JSON.stringify(result.user));
        router.push("/parent/dashboard");
      } catch (err) {
        if (isNetworkError(err)) {
          alert("サーバーに接続できません。しばらく待ってからもう一度お試しください。");
        } else {
          // PIN が必要な場合はダイアログを表示
          setSelectedParent(user);
          setPinInput("");
          setPinError("");
          setShowPinDialog(true);
        }
      }
    } else {
      localStorage.setItem("s2a_user", JSON.stringify(user));
      router.push("/child/dashboard");
    }
  };

  /** PIN ダイアログのサブミットハンドラ */
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinLoading(true);
    setPinError("");
    try {
      const result = await authApi.login({ user_id: selectedParent.id, pin: pinInput });
      localStorage.setItem("s2a_user", JSON.stringify(result.user));
      setShowPinDialog(false);
      router.push("/parent/dashboard");
    } catch (err) {
      if (isNetworkError(err)) {
        setPinError("サーバーに接続できません。しばらく待ってからもう一度お試しください。");
      } else {
        setPinError("PINが正しくありません");
      }
    } finally {
      setPinLoading(false);
    }
  };

  /**
   * 新規ユーザー登録フォームのサブミットハンドラ。
   * 登録成功後、一覧を即座に更新してモーダルを閉じる。
   */
  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const data = { name: registerName, role: registerRole };
      if (registerPin) data.pin = registerPin;
      if (registerEmail) data.email = registerEmail;
      const user = await authApi.register(data);
      setUsers((prev) => [...prev, user]);
      setShowRegister(false);
      setRegisterName("");
      setRegisterPin("");
      setRegisterEmail("");
    } catch (err) {
      if (isNetworkError(err)) {
        alert("サーバーに接続できません。しばらく待ってからもう一度お試しください。");
      } else {
        alert(err.message);
      }
    }
  };

  // ロールごとにユーザーを分類（表示セクション用）
  const parents = users.filter((u) => u.role === "parent");
  const children = users.filter((u) => u.role === "child");

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ maxWidth: 480, width: "100%" }} className="animate-in">
        {/* ===== ヒーローセクション ===== */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: "3.5rem", marginBottom: 8 }}>📚✨</div>
          <h1 style={{
            fontSize: "2rem", fontWeight: 800, lineHeight: 1.2,
            background: "linear-gradient(135deg, var(--primary), var(--secondary))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Study to Activity
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: "0.95rem" }}>
            学習の成果をアクティビティ時間に変えよう！
          </p>
        </div>

        {/* ===== コンテンツ: ローディング / 空 / ユーザー一覧 ===== */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>読み込み中...</div>
        ) : users.length === 0 ? (
          /* 初回利用時: 最初のユーザー登録を促す */
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>👋</div>
            <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>まだユーザーが登録されていません</p>
            <button className="btn btn-primary btn-lg" onClick={() => setShowRegister(true)}>
              最初のユーザーを登録
            </button>
          </div>
        ) : (
          <>
            {/* --- 子供ユーザー一覧 --- */}
            {children.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  👧 こども
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {children.map((u) => (
                    <button key={u.id} className="card" onClick={() => handleSelect(u)}
                      style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", border: "2px solid transparent" }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = "transparent"}
                    >
                      {/* アバター: 名前の頭文字をグラデーション円で表示 */}
                      <div style={{
                        width: 48, height: 48, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent-pink), var(--accent-orange))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", color: "#fff", fontWeight: 700,
                      }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{u.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>タップしてログイン</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* --- 親ユーザー一覧 --- */}
            {parents.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  👨‍👩‍👧 おや
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {parents.map((u) => (
                    <button key={u.id} className="card" onClick={() => handleSelect(u)}
                      style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", border: "2px solid transparent" }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = "transparent"}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", color: "#fff", fontWeight: 700,
                      }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{u.name}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>管理者ログイン</div>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Google ログイン — PIN ダイアログを経由せず常に表示 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 10px" }}>
                  <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--border)" }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>または</span>
                  <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--border)" }} />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                  disabled={signingInGoogle}
                  onClick={async () => {
                    setSigningInGoogle(true);
                    try {
                      await signIn("google", { callbackUrl: "/parent/dashboard" });
                    } catch {
                      setSigningInGoogle(false);
                    }
                  }}
                  data-testid="google-login-button"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {signingInGoogle ? "ログイン中..." : "Google でログイン"}
                </button>
              </div>
            )}

            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setShowRegister(true)}>
              ＋ ユーザーを追加
            </button>
          </>
        )}

        {/* ===== ユーザー登録モーダル ===== */}
        {showRegister && (
          <div className="modal-overlay" onClick={() => { setShowRegister(false); setRegisterEmail(""); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>ユーザー登録</h2>
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label>名前</label>
                  <input className="form-input" value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)} placeholder="名前を入力" required />
                </div>
                <div className="form-group">
                  <label>ロール</label>
                  <select className="form-input" value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value)}>
                    <option value="child">こども</option>
                    <option value="parent">おや</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>PIN（任意）</label>
                  <input className="form-input" type="password" value={registerPin}
                    onChange={(e) => setRegisterPin(e.target.value)} placeholder="4桁のPIN" maxLength={4} />
                </div>
                {registerRole === "parent" && (
                  <div className="form-group">
                    <label htmlFor="registerEmail">メールアドレス（Google ログイン用・任意）</label>
                    <input id="registerEmail" className="form-input" type="email" value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)} placeholder="例: parent@example.com" />
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>登録</button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowRegister(false); setRegisterEmail(""); }}>キャンセル</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== PIN 認証ダイアログ（PIN 付き親ユーザー用） ===== */}
        {showPinDialog && selectedParent && (
          <div className="modal-overlay" onClick={() => setShowPinDialog(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>PIN を入力</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: "0.95rem" }}>
                {selectedParent.name} さんの PIN コードを入力してください
              </p>
              {pinError && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 12, color: "#dc2626", fontSize: "0.9rem" }}>
                  {pinError}
                </div>
              )}
              <form onSubmit={handlePinSubmit}>
                <div className="form-group">
                  <input
                    className="form-input"
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="4桁のPIN"
                    maxLength={4}
                    autoFocus
                    data-testid="pin-input"
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={pinLoading || signingInGoogle}>
                    {pinLoading ? "確認中..." : "ログイン"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPinDialog(false)} disabled={pinLoading || signingInGoogle}>
                    キャンセル
                  </button>
                </div>
              </form>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 12px" }}>
                <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--border)" }} />
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>または</span>
                <hr style={{ flex: 1, border: "none", borderTop: "1px solid var(--border)" }} />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                disabled={pinLoading || signingInGoogle}
                onClick={async () => {
                  setSigningInGoogle(true);
                  try {
                    await signIn("google", { callbackUrl: "/parent/dashboard" });
                  } catch {
                    setSigningInGoogle(false);
                  }
                }}
                data-testid="google-login-button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {signingInGoogle ? "ログイン中..." : "Google でログイン"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
