/**
 * @fileoverview ウォレット管理ページ
 *
 * 親ユーザーが子供のアクティビティウォレットを管理するための画面。
 *
 * 主要機能:
 *   - 子供セレクタ（複数の子供がいる場合）
 *   - ウォレット残高のヒーロー表示
 *   - 残高の手動調整（ボーナス追加やペナルティ減算）
 *   - アクティビティ消費の記録（Switch / タブレット / その他）
 *   - 報酬付与履歴・消費ログの表示
 *
 * ウォレットへの自動付与は reward_engine が担うが、
 * 手動調整はこの画面から直接実行する。
 * 消費記録は将来的にデバイス連携で自動化される予定。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { walletApi, authApi } from "@/lib/api";

export default function WalletPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // --- State ---
  const [user, setUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [logs, setLogs] = useState([]);     // アクティビティ消費ログ
  const [rewards, setRewards] = useState([]); // 報酬付与ログ
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // 残高調整モーダルの入力値
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustMin, setAdjustMin] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  // 消費記録モーダルの入力値
  const [showConsume, setShowConsume] = useState(false);
  const [consumeMin, setConsumeMin] = useState(30);
  const [consumeType, setConsumeType] = useState("switch");
  const [consumeDesc, setConsumeDesc] = useState("");

  /** 認証ガード */
  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && session?.user) {
      setUser({ id: session.user.backendId, name: session.user.name, role: "parent" });
      return;
    }
    const stored = localStorage.getItem("s2a_user");
    if (stored) {
      const u = JSON.parse(stored);
      if (u.role === "parent") { setUser(u); return; }
    }
    router.push("/parent/login");
  }, [status, session, router]);

  /** 子供ユーザー一覧を取得し、最初の子供をデフォルト選択にする */
  useEffect(() => {
    if (!user) return;
    authApi.listUsers().then(users => {
      const c = users.filter(u => u.role === "child");
      setChildren(c);
      if (c.length > 0) setSelectedChild(c[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  /**
   * 選択中の子供のウォレット・ログを並行取得。
   * selectedChild が変わるたびに再取得される。
   */
  const fetchChild = useCallback(async () => {
    if (!selectedChild) return;
    try {
      const [w, l, r] = await Promise.all([
        walletApi.get(selectedChild.id),
        walletApi.getLogs(selectedChild.id),
        walletApi.getRewards(selectedChild.id),
      ]);
      setWallet(w); setLogs(l); setRewards(r);
    } catch { }
  }, [selectedChild]);

  useEffect(() => { fetchChild(); }, [fetchChild]);

  /** トースト表示ヘルパー */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  /**
   * 残高手動調整ハンドラ。
   * minutes > 0 で加算（ボーナス）、< 0 で減算（ペナルティ）。
   * reason は ActivityLog にも記録されるため、後から理由を追跡できる。
   */
  const handleAdjust = async (e) => {
    e.preventDefault();
    try {
      await walletApi.adjust(selectedChild.id, { minutes: adjustMin, reason: adjustReason });
      showToast(`残高を ${adjustMin > 0 ? "+" : ""}${adjustMin}分 調整しました`);
      setShowAdjust(false); setAdjustMin(0); setAdjustReason(""); fetchChild();
    } catch (e) { showToast(e.message, "error"); }
  };

  /**
   * アクティビティ消費記録ハンドラ。
   * ウォレット残高から消費分を差し引き、ActivityLog に記録する。
   * 残高不足の場合はバックエンドがエラーを返す。
   */
  const handleConsume = async (e) => {
    e.preventDefault();
    try {
      await walletApi.consume(selectedChild.id, { activity_type: consumeType, description: consumeDesc, consumed_minutes: consumeMin });
      showToast(`${consumeMin}分を消費しました 🎮`);
      setShowConsume(false); setConsumeMin(30); setConsumeDesc(""); fetchChild();
    } catch (e) { showToast(e.message, "error"); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>読み込み中...</div>;

  return (
    <>
      {/* ===== ナビゲーション ===== */}
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand">🏠 S2A 管理</div>
          <div className="nav-links">
            <a href="/parent/dashboard">ホーム</a>
            <a href="/parent/plans">計画</a>
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet" className="active">ウォレット</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        <div className="page-header animate-in">
          <h1>💰 ウォレット管理</h1>
          <p>アクティビティ残高の確認と管理</p>
        </div>

        {/* ===== 子供セレクタ（2人以上の場合のみ表示） ===== */}
        {children.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {children.map((c) => (
              <button key={c.id} className={`btn ${selectedChild?.id === c.id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedChild(c)}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {!selectedChild ? (
          <div className="empty-state card"><span className="emoji">👶</span><p>子供ユーザーが登録されていません</p></div>
        ) : (
          <>
            {/* ===== ウォレット残高ヒーロー ===== */}
            <div className="wallet-hero animate-in" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: "0.9rem", opacity: 0.8, marginBottom: 4 }}>{selectedChild.name}のウォレット</div>
              <div className="wallet-balance">{wallet?.balance_minutes || 0}<span style={{ fontSize: "1.2rem", fontWeight: 400 }}>分</span></div>
              <div className="wallet-label">アクティビティ残高</div>
              {/* 操作ボタン: 半透明の白で Hero カード上に配置 */}
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 14 }}>
                <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }} onClick={() => setShowAdjust(true)}>±調整</button>
                <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }} onClick={() => setShowConsume(true)}>🎮消費</button>
              </div>
            </div>

            {/* ===== ウォレット設定サマリー ===== */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-value">{wallet?.daily_limit_minutes || 120}</div>
                <div className="stat-label">1日の上限（分）</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{wallet?.carry_over ? "ON" : "OFF"}</div>
                <div className="stat-label">翌日繰越</div>
              </div>
            </div>

            {/* ===== 報酬付与履歴 ===== */}
            <div className="card animate-in-delay" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>📈 報酬履歴</h2>
              {rewards.length === 0 ? (
                <div className="empty-state" style={{ padding: 16 }}><p>まだ報酬はありません</p></div>
              ) : (
                rewards.slice(0, 10).map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: "0.9rem" }}>ルール #{r.rule_id}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.granted_date}</div>
                    </div>
                    <span className="badge badge-approved">+{r.granted_minutes}分</span>
                  </div>
                ))
              )}
            </div>

            {/* ===== アクティビティ消費ログ ===== */}
            <div className="card animate-in-delay">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>📋 利用ログ</h2>
              {logs.length === 0 ? (
                <div className="empty-state" style={{ padding: 16 }}><p>記録はありません</p></div>
              ) : (
                logs.slice(0, 10).map((l) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: "0.9rem" }}>
                        {/* アクティビティタイプに応じた絵文字で直感的に識別 */}
                        {l.activity_type === "switch" ? "🎮" : l.activity_type === "tablet" ? "📱" : "🎯"}{" "}
                        {l.description || l.activity_type}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{l.source}</div>
                    </div>
                    {/* consumed_minutes > 0 は消費（赤）、<= 0 は加算（緑）で表示を分ける */}
                    <span className={`badge ${l.consumed_minutes > 0 ? "badge-rejected" : "badge-approved"}`}>
                      {l.consumed_minutes > 0 ? `-${l.consumed_minutes}分` : `+${Math.abs(l.consumed_minutes)}分`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== 残高調整モーダル ===== */}
      {showAdjust && (
        <div className="modal-overlay" onClick={() => setShowAdjust(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>残高を手動調整</h2>
            <form onSubmit={handleAdjust}>
              <div className="form-group">
                <label>増減（分） ※マイナスで減算</label>
                <input type="number" className="form-input" value={adjustMin} onChange={(e) => setAdjustMin(Number(e.target.value))} required />
              </div>
              <div className="form-group">
                <label>理由</label>
                <input className="form-input" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="例: お手伝いのボーナス" required />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>調整</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjust(false)}>キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== 消費記録モーダル ===== */}
      {showConsume && (
        <div className="modal-overlay" onClick={() => setShowConsume(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>アクティビティ時間を消費</h2>
            <form onSubmit={handleConsume}>
              <div className="form-group">
                <label>アクティビティ</label>
                <select className="form-input" value={consumeType} onChange={(e) => setConsumeType(e.target.value)}>
                  <option value="switch">🎮 Nintendo Switch</option>
                  <option value="tablet">📱 タブレット</option>
                  <option value="other">🎯 その他</option>
                </select>
              </div>
              <div className="form-group">
                <label>消費時間（分）</label>
                <input type="number" className="form-input" value={consumeMin} onChange={(e) => setConsumeMin(Number(e.target.value))} min={1} required />
              </div>
              <div className="form-group">
                <label>メモ（任意）</label>
                <input className="form-input" value={consumeDesc} onChange={(e) => setConsumeDesc(e.target.value)} placeholder="例: マリオカート" />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>消費する</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowConsume(false)}>キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== トースト通知 ===== */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
