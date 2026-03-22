/**
 * @fileoverview 学習計画管理ページ
 *
 * 親ユーザーが子供の学習計画を作成・閲覧・削除するための管理画面。
 *
 * 計画作成フロー:
 *   1. モーダルを開く
 *   2. テンプレートを選択するか、手動で入力
 *   3. 対象の子供・日付・タイトルを入力
 *   4. タスク（教科・見積時間・宿題フラグ）を動的に追加
 *   5. サブミットで計画 + タスクを一括作成
 *
 * タスクはバックエンド側でカスケード削除されるため、
 * 計画削除時にタスクの個別削除は不要。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { plansApi, authApi } from "@/lib/api";

/**
 * 計画立てが苦手な子供向けのテンプレート集。
 * 各テンプレートには title とタスク一覧が含まれる。
 */
const PLAN_TEMPLATES = [
  {
    id: "elementary_basic",
    label: "📚 小学生・基本セット",
    title: "今日の勉強",
    tasks: [
      { subject: "国語", estimated_minutes: 20, is_homework: true, description: "教科書を読む・漢字練習" },
      { subject: "算数", estimated_minutes: 30, is_homework: true, description: "計算ドリル" },
      { subject: "読書", estimated_minutes: 15, is_homework: false, description: "好きな本を読む" },
    ],
  },
  {
    id: "homework_only",
    label: "✏️ 宿題だけコース",
    title: "宿題をやろう",
    tasks: [
      { subject: "国語の宿題", estimated_minutes: 20, is_homework: true, description: "" },
      { subject: "算数の宿題", estimated_minutes: 20, is_homework: true, description: "" },
    ],
  },
  {
    id: "test_prep",
    label: "📝 テスト前対策",
    title: "テスト勉強",
    tasks: [
      { subject: "テスト範囲の見直し", estimated_minutes: 30, is_homework: false, description: "教科書・ノートを読む" },
      { subject: "問題を解く", estimated_minutes: 30, is_homework: false, description: "問題集・プリント" },
      { subject: "間違えた問題の確認", estimated_minutes: 15, is_homework: false, description: "答え合わせ・復習" },
    ],
  },
  {
    id: "short_daily",
    label: "⏱️ 短時間・毎日コース",
    title: "毎日の学習",
    tasks: [
      { subject: "計算練習", estimated_minutes: 10, is_homework: false, description: "計算カード・ドリル" },
      { subject: "漢字練習", estimated_minutes: 10, is_homework: false, description: "漢字ドリル" },
      { subject: "英単語", estimated_minutes: 10, is_homework: false, description: "単語カード" },
    ],
  },
];

export default function PlansPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // --- State ---
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  // 計画作成フォームの入力値
  const [childId, setChildId] = useState("");
  const [planDate, setPlanDate] = useState(new Date().toISOString().split("T")[0]);
  const [title, setTitle] = useState("");

  /**
   * タスクフォーム配列。
   * 動的に追加/削除でき、各要素が 1 つのタスク定義を表す。
   * subject が空のタスクはサブミット時にフィルタされる。
   */
  const [tasks, setTasks] = useState([
    { subject: "", estimated_minutes: 30, is_homework: false, description: "" },
  ]);

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

  /**
   * 計画一覧と子供ユーザーを並行取得。
   * 子供セレクタのデフォルト値は最初の子供に設定する。
   */
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [p, u] = await Promise.all([plansApi.list(), authApi.listUsers()]);
      setPlans(p);
      const c = u.filter((x) => x.role === "child");
      setChildren(c);
      if (c.length > 0 && !childId) setChildId(String(c[0].id));
    } catch { }
    setLoading(false);
  }, [user, childId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** トースト表示ヘルパー */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  // --- タスクフォーム操作 ---
  /** タスク入力フィールドを 1 行追加 */
  const addTaskField = () =>
    setTasks([...tasks, { subject: "", estimated_minutes: 30, is_homework: false, description: "" }]);

  /** 指定インデックスのタスクのフィールドを更新（イミュータブルに操作） */
  const updateTask = (i, field, val) => {
    const copy = [...tasks]; copy[i] = { ...copy[i], [field]: val }; setTasks(copy);
  };

  /** 最低 1 行は残すようにタスク行を削除 */
  const removeTask = (i) => { if (tasks.length > 1) setTasks(tasks.filter((_, idx) => idx !== i)); };

  /** テンプレートを適用してタイトルとタスクを上書きする */
  const applyTemplate = (templateId) => {
    if (!templateId) return;
    const tpl = PLAN_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setTitle(tpl.title);
    setTasks(tpl.tasks.map((t) => ({ ...t })));
  };

  /** 計画を作成し、成功後にフォームをリセットして一覧を再取得 */
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await plansApi.create({
        child_id: Number(childId),
        plan_date: planDate,
        title,
        tasks: tasks.filter((t) => t.subject.trim()), // 空のタスクは除外
      });
      showToast("学習計画を作成しました！📚");
      setShowModal(false);
      setTitle(""); setTasks([{ subject: "", estimated_minutes: 30, is_homework: false, description: "" }]);
      fetchData();
    } catch (e) { showToast(e.message, "error"); }
  };

  /** 確認ダイアログ付きの計画削除 */
  const handleDelete = async (id) => {
    if (!confirm("この計画を削除しますか？")) return;
    try {
      await plansApi.delete(id);
      showToast("削除しました");
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
            <a href="/parent/dashboard">ホーム</a>
            <a href="/parent/plans" className="active">計画</a>
            <a href="/parent/schedule">週間予定</a>
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
            <a data-testid="logout-link" href="/" onClick={async (e) => { e.preventDefault(); localStorage.removeItem("s2a_user"); await signOut({ callbackUrl: "/" }); }}>ログアウト</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        {/* ===== ヘッダー + 新規作成ボタン ===== */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h1>📅 学習計画管理</h1>
            <p>お子様の学習計画を作成・管理</p>
          </div>
          <button data-testid="create-plan-button" className="btn btn-primary" onClick={() => setShowModal(true)}>＋ 新規作成</button>
        </div>

        {/* ===== 計画一覧 ===== */}
        {plans.length === 0 ? (
          <div className="empty-state card">
            <span className="emoji">📝</span>
            <p>学習計画はまだありません</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>最初の計画を作成</button>
          </div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="card animate-in" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{p.title}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 2 }}>
                    📆 {p.plan_date} | 👤 ID:{p.child_id} | タスク: {p.tasks.length}件
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>削除</button>
              </div>
              {/* インラインタスク一覧: ステータスアイコンで進捗を直感的に表示 */}
              {p.tasks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {p.tasks.map((t) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <span className={`badge ${t.status === "approved" ? "badge-approved" : t.status === "completed" ? "badge-completed" : "badge-pending"}`}>
                        {t.status === "approved" ? "✓" : t.status === "completed" ? "⏳" : "○"}
                      </span>
                      <span style={{ flex: 1, fontSize: "0.9rem" }}>{t.subject}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{t.estimated_minutes}分</span>
                      {t.is_homework && <span style={{ fontSize: "0.7rem", background: "var(--accent-orange)", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>宿題</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ===== 計画作成モーダル ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
            <h2>📚 学習計画を作成</h2>
            <form onSubmit={handleCreate}>
              {/* テンプレート選択 */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600 }}>🗂️ テンプレートから始める（任意）</label>
                <select
                  className="form-input"
                  defaultValue=""
                  onChange={(e) => applyTemplate(e.target.value)}
                  data-testid="template-select"
                >
                  <option value="">-- テンプレートを選択 --</option>
                  {PLAN_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.label}</option>
                  ))}
                </select>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
                  選択するとタイトルとタスクが自動で入力されます。後から編集できます。
                </p>
              </div>

              {/* 基本情報: 子供セレクタ + 日付 */}
              <div className="grid-2">
                <div className="form-group">
                  <label>お子様</label>
                  <select data-testid="child-select" className="form-input" value={childId} onChange={(e) => setChildId(e.target.value)} required>
                    {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>日付</label>
                  <input type="date" className="form-input" value={planDate} onChange={(e) => setPlanDate(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label>計画タイトル</label>
                <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 月曜日の学習" required />
              </div>

              {/* 動的タスクフォーム: 行の追加/削除が可能 */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <label style={{ fontWeight: 600 }}>タスク</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addTaskField}>＋ 追加</button>
                </div>
                {tasks.map((t, i) => (
                  <div key={i} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", marginBottom: 8 }}>
                    <div className="grid-2">
                      <div className="form-group">
                        <label>教科</label>
                        <input data-testid="task-subject-input" className="form-input" value={t.subject} onChange={(e) => updateTask(i, "subject", e.target.value)} placeholder="例: 算数" />
                      </div>
                      <div className="form-group">
                        <label>時間（分）</label>
                        <input type="number" className="form-input" value={t.estimated_minutes} onChange={(e) => updateTask(i, "estimated_minutes", Number(e.target.value))} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={t.is_homework} onChange={(e) => updateTask(i, "is_homework", e.target.checked)} /> 宿題
                      </label>
                      {tasks.length > 1 && (
                        <button type="button" style={{ fontSize: "0.8rem", color: "var(--accent-red)", background: "none", border: "none", cursor: "pointer" }} onClick={() => removeTask(i)}>削除</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button data-testid="submit-plan-button" type="submit" className="btn btn-primary" style={{ flex: 1 }}>作成</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>キャンセル</button>
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
