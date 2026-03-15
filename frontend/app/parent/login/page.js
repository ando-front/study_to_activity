/**
 * @fileoverview 親ダッシュボード ログインページ
 *
 * 親ユーザー向けのログイン画面。Google OAuth または PIN 認証を選択できる。
 * NextAuth.js を使用して認証フローを開始する。
 */
"use client";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";

export default function ParentLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // 認証済みの場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/parent/dashboard");
    }
  }, [status, router]);

  // 親ユーザーの一覧を取得
  useEffect(() => {
    authApi
      .listUsers()
      .then((all) => setUsers(all.filter((u) => u.role === "parent")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // URL パラメータにエラーがある場合は表示
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError("ログインに失敗しました。もう一度お試しください。");
  }, [searchParams]);

  /** Google OAuth でログイン */
  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signIn("google", { callbackUrl: "/parent/dashboard" });
    } catch {
      setError("ログインに失敗しました。もう一度お試しください。");
      setSigningIn(false);
    }
  };

  /** PIN 認証でログイン */
  const handlePinLogin = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSigningIn(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        user_id: selectedUser.id,
        pin,
        redirect: false,
      });
      if (result?.error) {
        setError("PIN が正しくありません。");
        setSigningIn(false);
      } else {
        router.push("/parent/dashboard");
      }
    } catch {
      setError("ログインに失敗しました。");
      setSigningIn(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <div style={{ maxWidth: 440, width: "100%" }} className="animate-in">
        {/* ヘッダー */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "3rem", marginBottom: 8 }}>👨‍👩‍👧</div>
          <h1 style={{
            fontSize: "1.8rem", fontWeight: 800,
            background: "linear-gradient(135deg, var(--primary), var(--secondary))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            親ダッシュボード
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: "0.95rem" }}>
            ログインして管理画面にアクセス
          </p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        {/* Google OAuth ログイン */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 14 }}>
            🌐 OAuth でログイン
          </h2>
          <button
            className="btn btn-primary"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            onClick={handleGoogleLogin}
            disabled={signingIn}
            data-testid="google-login-button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {signingIn ? "ログイン中..." : "Google でログイン"}
          </button>
        </div>

        {/* PIN 認証 */}
        <div className="card">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 14 }}>
            🔑 PIN 認証
          </h2>

          {loading ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>読み込み中...</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: "center", padding: 16, color: "var(--text-secondary)" }}>
              <p>親ユーザーが登録されていません</p>
              <a href="/" className="btn btn-secondary btn-sm" style={{ marginTop: 8, display: "inline-block" }}>
                ユーザー登録へ
              </a>
            </div>
          ) : (
            <form onSubmit={handlePinLogin}>
              <div className="form-group">
                <label>ユーザーを選択</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="card"
                      onClick={() => { setSelectedUser(u); setError(""); }}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        border: selectedUser?.id === u.id ? "2px solid var(--primary)" : "2px solid transparent",
                        padding: "10px 14px",
                      }}
                      data-testid={`user-select-${u.id}`}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1rem", color: "#fff", fontWeight: 700, flexShrink: 0,
                      }}>
                        {u.name.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedUser && (
                <div className="form-group">
                  <label>PIN コード</label>
                  <input
                    className="form-input"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="4桁のPIN（未設定の場合は空欄）"
                    maxLength={4}
                    autoFocus
                    data-testid="pin-input"
                  />
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 8 }}
                disabled={!selectedUser || signingIn}
                data-testid="pin-login-button"
              >
                {signingIn ? "ログイン中..." : "ログイン"}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            ← トップページへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
