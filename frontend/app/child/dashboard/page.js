/**
 * @fileoverview 子供ダッシュボード
 *
 * ログイン中の子供ユーザーに対して以下を表示する:
 * - ウォレット残高ヒーローカード（獲得/消費/上限の概要）
 * - 今日の学習進捗（承認済みタスクの割合）
 * - タスク一覧と操作ボタン（開始 / 完了 / やり直す）
 *
 * データはバックエンドの childDashboard API から一括取得し、
 * タスク操作後にデータを再取得して画面を即座に反映する。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { tasksApi } from "@/app/lib/api";

export default function ChildDashboard() {
  const router = useRouter();

  // --- State ---
  const [user, setUser] = useState(null);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  /**
   * 認証チェック: localStorage にユーザー情報がなければトップへリダイレクト。
   * 子供ロール以外のユーザーもトップへ戻す。
   */
  useEffect(() => {
    const stored = localStorage.getItem("s2a_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored);
    if (u.role !== "child") { router.push("/"); return; }
    setUser(u);
  }, [router]);

  /**
   * ダッシュボードデータの取得。
   * useCallback でメモ化し、タスク操作後の再取得にも使い回す。
   */
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const d = await tasksApi.childDashboard(user.id);
      setDash(d);
    } catch { }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /**
   * トースト通知を表示し、3 秒後に自動消去する。
   * @param {string} msg - 表示するメッセージ
   * @param {"success"|"error"} type - トーストのスタイル
   */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /** タスク開始: ステータスを PENDING → IN_PROGRESS に遷移させる */
  const handleStart = async (taskId) => {
    try {
      await tasksApi.start(taskId);
      showToast("学習を開始しました！💪");
      fetchData();
    } catch (e) { showToast(e.message, "error"); }
  };

  /** タスク完了: ステータスを IN_PROGRESS → COMPLETED に遷移させ、親の承認を待つ */
  const handleComplete = async (taskId) => {
    try {
      await tasksApi.complete(taskId);
      showToast("完了しました！🎉");
      fetchData();
    } catch (e) { showToast(e.message, "error"); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>読み込み中...</div>;

  // --- 派生データ ---
  const plan = dash?.today_plan;
  const tasks = plan?.tasks || [];
  /** 進捗率: 承認済みタスク数 ÷ 全タスク数（0除算をガード） */
  const pct = tasks.length > 0 ? Math.round(((dash?.approved_tasks || 0) / tasks.length) * 100) : 0;

  /** ステータス文字列を日本語ラベルに変換する */
  const statusLabel = (s) => {
    const map = { pending: "未着手", in_progress: "進行中", completed: "承認待ち", approved: "承認済み", rejected: "差し戻し" };
    return map[s] || s;
  };

  /** ステータスに応じた CSS クラス名を返す */
  const statusClass = (s) => {
    const map = { pending: "badge-pending", in_progress: "badge-progress", completed: "badge-completed", approved: "badge-approved", rejected: "badge-rejected" };
    return map[s] || "";
  };

  return (
    <>
      {/* ===== ナビゲーションバー ===== */}
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand">📚 <span>{user?.name}のページ</span></div>
          <div className="nav-links">
            <a data-testid="logout-link" href="/" onClick={(e) => { e.preventDefault(); localStorage.removeItem("s2a_user"); router.push("/"); }}>ログアウト</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        {/* ===== ウォレット残高ヒーロー ===== */}
        <div className="wallet-hero animate-in" style={{ marginBottom: 24 }}>
          <div className="wallet-balance">{dash?.wallet_balance || 0}<span style={{ fontSize: "1.2rem", fontWeight: 400 }}>分</span></div>
          <div className="wallet-label">アクティビティ残高</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 14, fontSize: "0.85rem", opacity: 0.85 }}>
            <span>📈 今日 +{dash?.today_earned || 0}分</span>
            <span>🎮 消費 {dash?.today_consumed || 0}分</span>
            <span>📊 上限 {dash?.daily_limit || 120}分/日</span>
          </div>
        </div>

        {/* ===== サマリー統計カード ===== */}
        <div className="grid-3 animate-in-delay" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-value">{dash?.pending_tasks || 0}</div>
            <div className="stat-label">残りタスク</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dash?.completed_tasks || 0}</div>
            <div className="stat-label">承認待ち</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{dash?.approved_tasks || 0}</div>
            <div className="stat-label">承認済み</div>
          </div>
        </div>

        {/* ===== 進捗バー ===== */}
        <div className="card animate-in-delay" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>今日の進捗</span>
            <span style={{ fontWeight: 700, color: "var(--primary)" }}>{pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }}></div>
          </div>
        </div>

        {/* ===== タスク一覧 ===== */}
        <div className="page-header">
          <h1>{plan ? plan.title : "今日の学習"}</h1>
          <p>{plan ? `${plan.plan_date} の学習計画` : "今日の計画はまだありません"}</p>
        </div>

        {tasks.length === 0 ? (
          <div className="empty-state">
            <span className="emoji">📝</span>
            <p>今日のタスクはまだありません。</p>
            <p style={{ fontSize: "0.85rem", marginTop: 4 }}>親に学習計画を作成してもらおう！</p>
          </div>
        ) : (
          <div>
            {tasks.map((t, i) => (
              <div key={t.id} className="task-item animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                {/* タスク番号 / ステータスアイコン */}
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: t.status === "approved" ? "var(--accent-green)" :
                    t.status === "in_progress" ? "var(--primary)" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: "0.85rem", fontWeight: 700, flexShrink: 0,
                }}>
                  {t.status === "approved" ? "✓" : t.status === "in_progress" ? "▶" : i + 1}
                </div>

                {/* タスク詳細 */}
                <div className="task-info">
                  <div className="task-subject">{t.subject}</div>
                  <div className="task-meta">
                    <span>⏱ {t.estimated_minutes}分</span>
                    {t.is_homework && <span>📋 宿題</span>}
                    <span className={`badge ${statusClass(t.status)}`}>{statusLabel(t.status)}</span>
                  </div>
                </div>

                {/* 操作ボタン: ステータスに応じた次のアクションのみ表示 */}
                <div className="task-actions">
                  {t.status === "pending" && (
                    <button data-testid="task-start-button" className="btn btn-primary btn-sm" onClick={() => handleStart(t.id)}>開始</button>
                  )}
                  {t.status === "in_progress" && (
                    <button data-testid="task-complete-button" className="btn btn-success btn-sm" onClick={() => handleComplete(t.id)}>完了</button>
                  )}
                  {t.status === "rejected" && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleStart(t.id)}>やり直す</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== トースト通知 ===== */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
