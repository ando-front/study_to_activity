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
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { tasksApi } from "../../lib/api";

export default function ParentDashboard() {
  const router = useRouter();

  // --- State ---
  const [user, setUser] = useState(null);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  /** 認証ガード: 親ロール以外はトップへリダイレクト */
  useEffect(() => {
    const stored = localStorage.getItem("s2a_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored);
    if (u.role !== "parent") { router.push("/"); return; }
    setUser(u);
  }, [router]);

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
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
            <a href="/" onClick={(e) => { e.preventDefault(); localStorage.removeItem("s2a_user"); router.push("/"); }}>ログアウト</a>
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
              <a href="/parent/plans" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>計画を作成</a>
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

      {/* ===== トースト通知 ===== */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
