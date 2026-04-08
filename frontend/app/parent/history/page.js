/**
 * @fileoverview 学習履歴ページ（親向���）
 *
 * 子どもごとの学習記録を一覧表示する。
 * 日時・科目・時間・獲得ゲーム時間を確認できる。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { historyApi, childrenApi, authApi } from "@/lib/api";

export default function ParentHistoryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [user, setUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && session?.user) {
      authApi.getUser(session.user.backendId).then(setUser).catch(() => {
        setUser({ id: session.user.backendId, name: session.user.name, role: "parent" });
      });
      return;
    }
    const stored = localStorage.getItem("s2a_user");
    if (stored) {
      const u = JSON.parse(stored);
      if (u.role === "parent") { setUser(u); return; }
    }
    router.push("/parent/login");
  }, [status, session, router]);

  const fetchChildren = useCallback(async () => {
    if (!user) return;
    try {
      const data = await childrenApi.list();
      setChildren(data);
      if (data.length > 0 && !selectedChild) {
        setSelectedChild(data[0].id);
      }
    } catch { }
    setLoading(false);
  }, [user, selectedChild]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  const fetchHistory = useCallback(async () => {
    if (!selectedChild) return;
    try {
      const data = await historyApi.get(selectedChild);
      setHistory(data);
    } catch { }
  }, [selectedChild]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>���み込み中...</div>;

  return (
    <>
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand">🏠 S2A 管理</div>
          <div className="nav-links">
            <a href="/parent/dashboard">ホーム</a>
            <a href="/parent/children">子ども管理</a>
            <a href="/parent/plans">計画</a>
            <a href="/parent/history" className="active">学習履歴</a>
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        <div className="page-header animate-in">
          <h1>学習履歴</h1>
          <p>お子様の学習記録を確認できます</p>
        </div>

        {/* 子ども選択 */}
        {children.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {children.map((c) => (
                <button
                  key={c.id}
                  className={`btn btn-sm ${selectedChild === c.id ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setSelectedChild(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* サマリー */}
        {history && (
          <div className="grid-3 animate-in-delay" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-value">{history.entries.length}</div>
              <div className="stat-label">学習回数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{history.total_study_minutes}分</div>
              <div className="stat-label">合計学習時間</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{history.total_reward_minutes}分</div>
              <div className="stat-label">獲得ゲーム時間</div>
            </div>
          </div>
        )}

        {/* 履歴一覧 */}
        <div className="card animate-in-delay">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14 }}>
            📖 学習記録
          </h2>
          {!history || history.entries.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <span className="emoji" style={{ fontSize: "2rem" }}>📚</span>
              <p>まだ学習記録がありません</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)" }}>日付</th>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)" }}>科目</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)" }}>学���時間</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)" }}>ステータス</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)" }}>獲得時間</th>
                  </tr>
                </thead>
                <tbody>
                  {history.entries.map((entry) => (
                    <tr key={entry.task_id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 12px" }}>{entry.plan_date}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {entry.subject}
                        {entry.is_homework && <span className="badge badge-pending" style={{ marginLeft: 6, fontSize: "0.7rem" }}>宿題</span>}
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 12px" }}>
                        {entry.actual_minutes || entry.estimated_minutes}分
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 12px" }}>
                        <span className={`badge badge-${entry.status === "approved" ? "approved" : "pending"}`}>
                          {entry.status === "approved" ? "承認済み" : "完��"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center", padding: "10px 12px" }}>
                        {entry.reward_minutes > 0 ? (
                          <span style={{ color: "var(--accent-success)", fontWeight: 600 }}>+{entry.reward_minutes}分</span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
