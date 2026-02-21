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
import { authApi } from "./lib/api";

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
   * localStorage に選択ユーザーを保存し、ロールに応じたダッシュボードへ遷移する。
   */
  const handleSelect = (user) => {
    localStorage.setItem("s2a_user", JSON.stringify(user));
    if (user.role === "parent") {
      router.push("/parent/dashboard");
    } else {
      router.push("/child/dashboard");
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
      const user = await authApi.register(data);
      setUsers((prev) => [...prev, user]);
      setShowRegister(false);
      setRegisterName("");
      setRegisterPin("");
    } catch (err) {
      alert(err.message);
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
              </div>
            )}

            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setShowRegister(true)}>
              ＋ ユーザーを追加
            </button>
          </>
        )}

        {/* ===== ユーザー登録モーダル ===== */}
        {showRegister && (
          <div className="modal-overlay" onClick={() => setShowRegister(false)}>
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
                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>登録</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRegister(false)}>キャンセル</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
