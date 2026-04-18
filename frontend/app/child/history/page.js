/**
 * @fileoverview 学習履歴ページ（子ども向け）
 *
 * 自分の学習記録を一覧で確認できる。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { historyApi } from "@/lib/api";

export default function ChildHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("s2a_user");
    if (stored) {
      const u = JSON.parse(stored);
      if (u.role === "child") { setUser(u); return; }
    }
    router.push("/");
  }, [router]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      const data = await historyApi.get(user.id);
      setHistory(data);
    } catch { }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>読み込み中...</div>;

  return (
    <>
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand" style={{ fontSize: "1.2rem" }}>📚 がくしゅう</div>
          <div className="nav-links">
            <a href="/child/dashboard">ホーム</a>
            <a href="/child/history" className="active">きろく</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        <div className="page-header animate-in">
          <h1>{user?.name}のがくしゅうきろく</h1>
          <p>いままでのがんばりを見てみよう！</p>
        </div>

        {/* サマリー */}
        {history && (
          <div className="grid-3 animate-in-delay" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-value">{history.entries.length}</div>
              <div className="stat-label">がくしゅう回数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{history.total_study_minutes}分</div>
              <div className="stat-label">がくしゅう時間</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{history.total_reward_minutes}分</div>
              <div className="stat-label">もらったゲーム時間</div>
            </div>
          </div>
        )}

        {/* 履歴一覧 */}
        <div className="card animate-in-delay">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>
            きろくいちらん
          </h2>
          {!history || history.entries.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <span className="emoji" style={{ fontSize: "3rem" }}>🌟</span>
              <p>まだきろくがないよ。がくしゅうをはじめよう！</p>
              <a href="/child/dashboard" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                ダッシュボードへ
              </a>
            </div>
          ) : (
            history.entries.map((entry) => (
              <div key={entry.task_id} className="task-item">
                <div className="task-info">
                  <div className="task-subject">
                    {entry.subject}
                    {entry.is_homework && <span className="badge badge-pending" style={{ marginLeft: 6, fontSize: "0.7rem" }}>しゅくだい</span>}
                  </div>
                  <div className="task-meta">
                    <span>{entry.plan_date}</span>
                    <span>⏱ {entry.actual_minutes || entry.estimated_minutes}分</span>
                    {entry.reward_minutes > 0 && (
                      <span style={{ color: "var(--accent-success)" }}>🎮 +{entry.reward_minutes}分</span>
                    )}
                  </div>
                </div>
                <span className={`badge badge-${entry.status === "approved" ? "approved" : "pending"}`}>
                  {entry.status === "approved" ? "OK!" : "まち"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
