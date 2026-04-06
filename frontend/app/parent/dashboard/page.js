/**
 * @fileoverview 親ダッシュボード
 *
 * 親ユーザー向けのメイン画面。以下のセクションで構成される:
 * 1. サマリー統計（子供数、承認待ち、今日の計画数、有効ルール数）
 * 2. 承認待ちタスク一覧（承認/差し戻しアクション付き）
 * 3. 今日の学習計画の概要
 * 4. 有効な報酬ルールの一覧
 *
 * タスク承認時にはバックエンドの報酬エンジンが自動評価され、
 * 条件を満たした場合はウォレットへの時間付与が即座にフィードバックされる。
 *
 * 認証: NextAuth セッションを優先し、フォールバックとして localStorage を使用する。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { tasksApi, switchApi, authApi } from "@/lib/api";

export default function ParentDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // --- State ---
  const [user, setUser] = useState(null);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchUrl, setSwitchUrl] = useState("");
  const [switchVerifier, setSwitchVerifier] = useState("");
  const [switchState, setSwitchState] = useState("");
  const [responseUrl, setResponseUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [switchConnecting, setSwitchConnecting] = useState(false);

  /**
   * 認証ガード: NextAuth セッションまたは localStorage でユーザーを確認する。
   * どちらも存在しない場合はログインページへリダイレクトする。
   */
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      // NextAuth セッションからユーザー情報を取得
      authApi.getUser(session.user.backendId).then(u => {
        setUser(u);
      }).catch(() => {
        setUser({
          id: session.user.backendId,
          name: session.user.name,
          role: "parent",
          is_nintendo_linked: false,
        });
      });
      return;
    }

    // フォールバック: localStorage を確認（PIN 認証後の場合）
    const stored = localStorage.getItem("s2a_user");
    if (stored) {
      const u = JSON.parse(stored);
      if (u.role === "parent") {
        setUser(u);
        return;
      }
    }

    router.push("/parent/login");
  }, [status, session, router]);

  /** 親ダッシュボードデータの一括取得 */
  const fetchData = useCallback(async () => {
    if (!user) return;
    try { setDash(await tasksApi.parentDashboard()); } catch { }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** トースト表示（3 秒後に自動消去） */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * タスク承認ハンドラ。
   * 承認成功後、報酬エンジンの結果（付与された分数）をトーストで通知する。
   * これにより親は承認 → 報酬付与のフローを一画面で完結できる。
   */
  const handleApprove = async (taskId) => {
    if (!user?.id) {
      showToast("ユーザー情報が取得できませんでした。再ログインしてください。", "error");
      return;
    }
    try {
      const res = await tasksApi.approve(taskId, user.id);
      const rewards = res.rewards_granted || [];
      if (rewards.length > 0) {
        showToast(`承認しました！${rewards.map(r => `+${r.granted_minutes}分`).join(", ")} 付与 🎉`);
      } else {
        showToast("承認しました！✅");
      }
      fetchData();
    } catch (e) { showToast(e.message, "error"); }
  };

  /** タスク差し戻しハンドラ: 子供に再度取り組んでもらう */
  const handleReject = async (taskId) => {
    try {
      await tasksApi.reject(taskId);
      showToast("差し戻しました");
      fetchData();
    } catch (e) { showToast(e.message, "error"); }
  };

  /** Nintendo Account 連携開始 */
  const startSwitchConnect = async () => {
    if (!user?.id) {
      showToast("ユーザー情報が取得できませんでした。再ログインしてください。", "error");
      return;
    }
    try {
      const { url, verifier, state } = await switchApi.getAuthUrl();
      setSwitchUrl(url);
      setSwitchVerifier(verifier);
      setSwitchState(state || "");
      setResponseUrl("");
      setShowSwitchModal(true);
      // callback ページが使えるよう pending 情報を保存
      sessionStorage.setItem("s2a_switch_pending", JSON.stringify({ userId: user.id, verifier, state }));
      window.open(url, '_blank');
    } catch (e) {
      showToast(e?.message || "Nintendo 認証URLの取得に失敗しました。しばらく待ってから再試���してください。", "error");
    }
  };

  /** Nintendo Account 連携完了 */
  const completeSwitchConnect = async () => {
    const input = responseUrl.trim();
    if (!input) return;
    setSwitchConnecting(true);
    try {
      // /callback エンドポイントはフル URL・フラグメント・生コードすべてを受け付ける
      await switchApi.callback({
        user_id: user.id,
        session_token_code: input,
        verifier: switchVerifier,
        state: switchState || undefined,
      });

      const updatedUser = await authApi.getUser(user.id);
      localStorage.setItem("s2a_user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      sessionStorage.removeItem("s2a_switch_pending");
      showToast("Nintendo Account と連携しました！🎮");
      setShowSwitchModal(false);
      setSwitchVerifier("");
      setSwitchState("");
      setResponseUrl("");
      fetchData();
    } catch (e) {
      const msg = e?.message || "予期しないエラーが発生しました";
      showToast(msg, "error");
    } finally {
      setSwitchConnecting(false);
    }
  };

  /** Switch への同期実行 */
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await switchApi.sync(user.id);
      if (!res.synced_devices || res.synced_devices.length === 0) {
        showToast("同期できたデバイスがありません", "error");
      } else {
        showToast(`${res.synced_devices.join(", ")} へ同期完了！`);
      }
    } catch (e) {
      showToast(e?.message || "Switch への同期に失敗しました", "error");
    } finally { setSyncing(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>読み込み中...</div>;

  return (
    <>
      {/* ===== ナビゲーション ===== */}
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand">🏠 S2A 管理</div>
          <div className="nav-links">
            <a href="/parent/dashboard" className="active">ホーム</a>
            <a href="/parent/plans">計画</a>
            <a href="/parent/schedule">週間予定</a>
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
            <a data-testid="logout-link" href="/" onClick={async (e) => { e.preventDefault(); localStorage.removeItem("s2a_user"); await signOut({ callbackUrl: "/" }); }}>ログアウト</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        {/* ===== ウェルカムヘッダー ===== */}
        <div className="page-header animate-in">
          <h1>こんにちは、{user?.name}さん 👋</h1>
          <p>お子様の学習状況を確認しましょう</p>
        </div>

        {/* ===== サマリー統計カード ===== */}
        <div className="grid-4 animate-in-delay" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-value">{dash?.children?.length || 0}</div>
            <div className="stat-label">こども</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dash?.pending_approvals?.length || 0}</div>
            <div className="stat-label">承認待ち</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dash?.today_plans?.length || 0}</div>
            <div className="stat-label">今日の計画</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dash?.active_rules?.length || 0}</div>
            <div className="stat-label">有効ルール</div>
          </div>
        </div>

        {/* ===== デバイス連携 (Switch) ===== */}
        <div className="card animate-in-delay" style={{ marginBottom: 24, background: "linear-gradient(135deg, #e60012, #ff4b2b)", color: "#fff" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8, color: "#fff" }}>
            🎮 Nintendo Switch 連携
          </h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.9)" }}>
              {user?.is_nintendo_linked ? "連携済みです" : "アカウントを連携して、みまもり設定を自動更新しましょう"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {user?.is_nintendo_linked ? (
                <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
                  {syncing ? "同期中..." : "今すぐ同期"}
                </button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={startSwitchConnect}>
                  連携する
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===== 承認待ちタスク ===== */}
        <div className="card animate-in-delay" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            ⏳ 承認待ちタスク
            {(dash?.pending_approvals?.length || 0) > 0 && (
              <span className="badge badge-pending">{dash.pending_approvals.length}</span>
            )}
          </h2>
          {(!dash?.pending_approvals || dash.pending_approvals.length === 0) ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <span className="emoji" style={{ fontSize: "2rem" }}>✨</span>
              <p>承認待ちのタスクはありません</p>
            </div>
          ) : (
            dash.pending_approvals.map((t) => (
              <div key={t.id} className="task-item">
                <div className="task-info">
                  <div className="task-subject">{t.subject}</div>
                  <div className="task-meta">
                    {/* actual_minutes があればそちらを優先表示（実績 vs 見積） */}
                    <span>⏱ {t.actual_minutes || t.estimated_minutes}分</span>
                    {t.is_homework && <span>📋 宿題</span>}
                  </div>
                </div>
                <div className="task-actions">
                  <button className="btn btn-success btn-sm" onClick={() => handleApprove(t.id)}>承認</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleReject(t.id)}>差し戻し</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ===== 今日の学習計画 ===== */}
        <div className="card animate-in-delay" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>📅 今日の学習計画</h2>
          {(!dash?.today_plans || dash.today_plans.length === 0) ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <span className="emoji" style={{ fontSize: "2rem" }}>📝</span>
              <p>今日の計画はまだありません</p>
              <a href="/parent/plans" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>計画を確認</a>
            </div>
          ) : (
            dash.today_plans.map((p) => (
              <div key={p.id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4 }}>
                  タスク数: {p.tasks.length} | 完了: {p.tasks.filter(t => t.status === "approved").length}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ===== 有効ルール一覧 ===== */}
        <div className="card animate-in-delay">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>🎯 有効な報酬ルール</h2>
          {(!dash?.active_rules || dash.active_rules.length === 0) ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <span className="emoji" style={{ fontSize: "2rem" }}>⚙️</span>
              <p>ルールが設定されていません</p>
              <a href="/parent/rules" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>ルールを設定</a>
            </div>
          ) : (
            dash.active_rules.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{r.description}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.trigger_type}</div>
                </div>
                <span className="badge badge-approved">+{r.reward_minutes}分</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== Switch 連携モーダル ===== */}
      {showSwitchModal && (
        <div className="modal-overlay" onClick={() => { if (!switchConnecting) setShowSwitchModal(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ marginBottom: 4 }}>Nintendo Account 連携</h2>

            {/* ステップ説明 */}
            <ol style={{ fontSize: "0.88rem", color: "var(--text-secondary)", paddingLeft: 18, margin: "12px 0 16px" }}>
              <li style={{ marginBottom: 8 }}>
                任天堂サイトでログインしてください。タブが開かなかった場合は
                <a href={switchUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>こちら</a>。
              </li>
              <li style={{ marginBottom: 8 }}>
                ログイン後、<b>「この人にする」ボタンのリンクをコピー</b>してください。
                <ul style={{ marginTop: 6, paddingLeft: 16, color: "var(--text-muted)" }}>
                  <li><b>Mac / Windows:</b> 右クリック →「リンクのアドレスをコピー」</li>
                  <li><b>iPhone (Safari):</b> みまもりSwitchアプリが自動起動する場合は、アプリをアンインストールして再試行 → Safariのアドレスバーに表示されるURLをコピー</li>
                </ul>
              </li>
              <li>コピーしたURL（または <code>session_token_code=</code> 以降の値のみ）を下に貼り付けてください。</li>
            </ol>

            <div className="form-group">
              <label style={{ fontWeight: 600 }}>コピーしたURL / コード</label>
              <input
                className="form-input"
                value={responseUrl}
                onChange={(e) => setResponseUrl(e.target.value)}
                placeholder="npf54789befb391a838://auth#session_token_code=..."
                disabled={switchConnecting}
                style={{ fontFamily: "monospace", fontSize: "0.82rem" }}
              />
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                フルURL・フラグメント（#以降）・生のコードどれでも可
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={completeSwitchConnect}
                disabled={switchConnecting || !responseUrl.trim()}
              >
                {switchConnecting ? "連携中..." : "連携を完了する"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSwitchModal(false)}
                disabled={switchConnecting}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== トースト通知 ===== */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
