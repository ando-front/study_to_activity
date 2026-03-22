/**
 * @fileoverview 週間スケジュールページ
 *
 * 親子が常時共有できる週間学習カレンダー。
 * 月〜日の7カラムで各日の学習計画とタスクの進捗を一覧表示する。
 * 前週・次週へのナビゲーションと、子供フィルタに対応する。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { plansApi, authApi } from "@/lib/api";

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];
const DAY_COLORS = {
  月: "#6366f1",
  火: "#f59e0b",
  水: "#10b981",
  木: "#f97316",
  金: "#3b82f6",
  土: "#ec4899",
  日: "#ef4444",
};

/** YYYY-MM-DD 形式の日付文字列を返す */
function toDateStr(d) {
  return d.toISOString().split("T")[0];
}

/**
 * 週の月曜日を返す。
 * Week boundary: 月曜〜日曜（ISO 8601 週）。
 *   getDay() returns 0=日, 1=月, ..., 6=土
 *   日曜は「現在の週の最終日（7日目）」として扱う。
 *   例: 日曜 3/22 → 月曜 3/16 を週の開始日として返す。
 */
function getMondayOf(d) {
  const day = new Date(d);
  // Sunday (0) → go back 6 days to reach the Monday of this Mon–Sun week
  const diff = day.getDay() === 0 ? -6 : 1 - day.getDay();
  day.setDate(day.getDate() + diff);
  return day;
}

/** タスクステータスに対応する表示ラベル */
function StatusBadge({ status }) {
  const map = {
    approved: { label: "✓ 承認済", color: "#10b981" },
    completed: { label: "⏳ 確認待", color: "#f59e0b" },
    in_progress: { label: "▶ 進行中", color: "#6366f1" },
    pending: { label: "○ 未着手", color: "#9ca3af" },
    rejected: { label: "✗ 差戻し", color: "#ef4444" },
  };
  const s = map[status] || { label: status, color: "#9ca3af" };
  return (
    <span
      style={{
        fontSize: "0.65rem",
        padding: "1px 5px",
        borderRadius: 4,
        background: s.color + "22",
        color: s.color,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [user, setUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [childId, setChildId] = useState(null);
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // 認証ガード
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

  // 子供一覧の取得
  useEffect(() => {
    if (!user) return;
    authApi.listUsers()
      .then((all) => {
        const c = all.filter((u) => u.role === "child");
        setChildren(c);
        if (c.length > 0 && childId === null) setChildId(c[0].id);
      })
      .catch(() => {});
  }, [user, childId]);

  // 週間スケジュールの取得
  const fetchSchedule = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params = { week_start: toDateStr(weekStart) };
      if (childId) params.child_id = childId;
      const data = await plansApi.weekly(params);
      setSchedule(data);
    } catch {
      setToast({ msg: "スケジュールの取得に失敗しました", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [user, weekStart, childId]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const goToday = () => setWeekStart(getMondayOf(new Date()));

  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const formatWeekRange = () =>
    `${weekStart.getFullYear()}年 ${weekStart.getMonth() + 1}月${weekStart.getDate()}日 〜 ${weekEndDate.getMonth() + 1}月${weekEndDate.getDate()}日`;

  // 今日の曜日ラベル（週内にある場合だけハイライトする）
  // getDay(): 0=日, 1=月, ..., 6=土 → 月(0)〜日(6) のインデックスに変換
  const todayDayLabel = (() => {
    const today = new Date();
    const isSameWeek = today >= weekStart && today <= weekEndDate;
    if (!isSameWeek) return null;
    // Sunday (getDay=0) → index 6 ("日"), Monday (1) → 0 ("月"), …
    const idx = today.getDay() === 0 ? 6 : today.getDay() - 1;
    return DAY_LABELS[idx];
  })();

  return (
    <>
      {/* ===== ナビゲーション ===== */}
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand">🏠 S2A 管理</div>
          <div className="nav-links">
            <a href="/parent/dashboard">ホーム</a>
            <a href="/parent/plans">計画</a>
            <a href="/parent/schedule" className="active">週間予定</a>
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
            <a
              data-testid="logout-link"
              href="/"
              onClick={async (e) => {
                e.preventDefault();
                localStorage.removeItem("s2a_user");
                await signOut({ callbackUrl: "/" });
              }}
            >
              ログアウト
            </a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        {/* ===== ヘッダー ===== */}
        <div className="page-header animate-in" style={{ marginBottom: 16 }}>
          <h1>📅 週間スケジュール</h1>
          <p>親子で共有する1週間の学習予定表</p>
        </div>

        {/* ===== コントロールバー ===== */}
        <div
          className="card animate-in"
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            padding: "12px 16px",
          }}
        >
          {/* 週ナビゲーション */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={prevWeek}>
              ◀
            </button>
            <span style={{ fontWeight: 700, minWidth: 240, textAlign: "center" }}>
              {formatWeekRange()}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={nextWeek}>
              ▶
            </button>
            <button className="btn btn-secondary btn-sm" onClick={goToday}>
              今週
            </button>
          </div>

          {/* 子供フィルタ */}
          {children.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>表示：</label>
              <select
                className="form-input"
                style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                value={childId ?? ""}
                onChange={(e) =>
                  setChildId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">全員</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={() => router.push("/parent/plans")}
          >
            ＋ 計画を追加
          </button>
        </div>

        {/* ===== 週間グリッド ===== */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            読み込み中...
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 8,
              overflowX: "auto",
            }}
          >
            {DAY_LABELS.map((day, idx) => {
              const plans = schedule?.days?.[day] ?? [];
              const isToday = day === todayDayLabel;
              const colDate = new Date(weekStart);
              colDate.setDate(colDate.getDate() + idx);

              return (
                <div
                  key={day}
                  style={{
                    minWidth: 120,
                    borderRadius: "var(--radius)",
                    overflow: "hidden",
                    border: isToday
                      ? `2px solid ${DAY_COLORS[day]}`
                      : "2px solid var(--border)",
                    boxShadow: isToday ? `0 0 0 3px ${DAY_COLORS[day]}33` : undefined,
                  }}
                >
                  {/* 曜日ヘッダー */}
                  <div
                    style={{
                      background: DAY_COLORS[day],
                      color: "#fff",
                      textAlign: "center",
                      padding: "8px 4px",
                      fontWeight: 800,
                      fontSize: "1rem",
                    }}
                  >
                    <div>{day}曜日</div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.9, fontWeight: 400 }}>
                      {colDate.getMonth() + 1}/{colDate.getDate()}
                    </div>
                  </div>

                  {/* 計画リスト */}
                  <div
                    style={{
                      background: "var(--surface)",
                      minHeight: 140,
                      padding: 6,
                    }}
                  >
                    {plans.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontSize: "0.75rem",
                          padding: "20px 0",
                        }}
                      >
                        予定なし
                      </div>
                    ) : (
                      plans.map((plan) => (
                        <div
                          key={plan.id}
                          style={{
                            marginBottom: 6,
                            padding: "6px 8px",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              marginBottom: 4,
                              lineHeight: 1.3,
                            }}
                          >
                            {plan.title}
                          </div>
                          {/* タスク一覧 */}
                          {plan.tasks.map((task) => (
                            <div
                              key={task.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 4,
                                padding: "2px 0",
                                borderTop: "1px solid var(--border)",
                              }}
                            >
                              <span
                                style={{ fontSize: "0.7rem", flex: 1, lineHeight: 1.4 }}
                              >
                                {task.is_homework && (
                                  <span
                                    style={{
                                      fontSize: "0.6rem",
                                      background: "var(--accent-orange)",
                                      color: "#fff",
                                      padding: "0 3px",
                                      borderRadius: 3,
                                      marginRight: 3,
                                    }}
                                  >
                                    宿題
                                  </span>
                                )}
                                {task.subject}
                              </span>
                              <StatusBadge status={task.status} />
                            </div>
                          ))}
                          {/* 子供名（全員表示時） */}
                          {!childId && children.length > 1 && (
                            <div
                              style={{
                                fontSize: "0.65rem",
                                color: "var(--text-muted)",
                                marginTop: 4,
                              }}
                            >
                              👤{" "}
                              {children.find((c) => c.id === plan.child_id)?.name ??
                                `ID:${plan.child_id}`}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== トースト ===== */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
