/**
 * @fileoverview 報酬ルール設定ページ
 *
 * 親ユーザーが報酬ルールの作成・編集・削除・有効/無効切替を行う管理画面。
 *
 * 報酬ルールの仕組み:
 *   - トリガー条件（宿題全完了、学習時間達成、タスク完了、連続達成など）
 *   - 条件を満たした場合に付与されるアクティビティ時間（分）
 *   - バックエンドの reward_engine がタスク承認時に自動評価
 *   - 同一ルールは 1 日 1 回のみ付与（二重付与防止は RewardLog で管理）
 *
 * テンプレート機能:
 *   PRD で定義された標準ルール 4 件を一括登録できる seed-defaults API を提供。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { rulesApi } from "../../lib/api";

/** トリガータイプのコード → 日本語ラベルの対応表 */
const TRIGGER_LABELS = {
  all_homework_done: "宿題すべて完了",
  study_time_reached: "学習時間達成",
  task_completed: "タスク完了",
  streak: "連続達成",
};

export default function RulesPage() {
  const router = useRouter();

  // --- State ---
  const [user, setUser] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // null = 新規作成モード
  const [toast, setToast] = useState(null);

  // ルールフォームの入力値
  const [triggerType, setTriggerType] = useState("all_homework_done");
  const [rewardMinutes, setRewardMinutes] = useState(30);
  const [description, setDescription] = useState("");
  const [condMinutes, setCondMinutes] = useState(60);   // study_time_reached 用
  const [condDays, setCondDays] = useState(7);           // streak 用

  /** 認証ガード */
  useEffect(() => {
    const stored = localStorage.getItem("s2a_user");
    if (!stored) { router.push("/"); return; }
    const u = JSON.parse(stored);
    if (u.role !== "parent") { router.push("/"); return; }
    setUser(u);
  }, [router]);

  /** ルール一覧を取得 */
  const fetchData = useCallback(async () => {
    if (!user) return;
    try { setRules(await rulesApi.list()); } catch { }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** トースト表示ヘルパー */
  const showToast = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  /** フォームをデフォルト値にリセット */
  const resetForm = () => {
    setTriggerType("all_homework_done"); setRewardMinutes(30);
    setDescription(""); setCondMinutes(60); setCondDays(7); setEditing(null);
  };

  /** 新規作成モーダルを開く */
  const openCreate = () => { resetForm(); setShowModal(true); };

  /** 既存ルールの値をフォームに反映して編集モーダルを開く */
  const openEdit = (r) => {
    setEditing(r);
    setTriggerType(r.trigger_type);
    setRewardMinutes(r.reward_minutes);
    setDescription(r.description);
    setCondMinutes(r.trigger_condition?.minutes || 60);
    setCondDays(r.trigger_condition?.days || 7);
    setShowModal(true);
  };

  /**
   * トリガー条件オブジェクトを構築する。
   * トリガータイプに応じて異なるスキーマの JSON を返す。
   * all_homework_done / task_completed は条件不要のため null を返す。
   */
  const buildCondition = () => {
    if (triggerType === "study_time_reached") return { minutes: condMinutes };
    if (triggerType === "streak") return { days: condDays };
    return null;
  };

  /** ルールの作成/更新のサブミットハンドラ */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      trigger_type: triggerType,
      reward_minutes: rewardMinutes,
      description,
      trigger_condition: buildCondition(),
      is_active: true,
    };
    try {
      if (editing) {
        await rulesApi.update(editing.id, data);
        showToast("ルールを更新しました ✅");
      } else {
        await rulesApi.create(data);
        showToast("ルールを作成しました 🎯");
      }
      setShowModal(false); resetForm(); fetchData();
    } catch (e) { showToast(e.message, "error"); }
  };

  /** 確認ダイアログ付きのルール削除 */
  const handleDelete = async (id) => {
    if (!confirm("このルールを削除しますか？")) return;
    try { await rulesApi.delete(id); showToast("削除しました"); fetchData(); }
    catch (e) { showToast(e.message, "error"); }
  };

  /** ルールの有効/無効をトグル（is_active の反転） */
  const handleToggle = async (r) => {
    try { await rulesApi.update(r.id, { is_active: !r.is_active }); fetchData(); } catch { }
  };

  /** PRD 定義のデフォルトルール 4 件を一括登録 */
  const handleSeedDefaults = async () => {
    try { await rulesApi.seedDefaults(); showToast("デフォルトルールを追加しました！🎯"); fetchData(); }
    catch (e) { showToast(e.message, "error"); }
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
            <a href="/parent/rules" className="active">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        {/* ===== ヘッダー + アクションボタン ===== */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h1>🎯 報酬ルール設定</h1>
            <p>学習完了時の報酬ルールを管理</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {rules.length === 0 && (
              <button className="btn btn-secondary" onClick={handleSeedDefaults}>テンプレート追加</button>
            )}
            <button className="btn btn-primary" onClick={openCreate}>＋ 新規作成</button>
          </div>
        </div>

        {/* ===== ルール一覧 ===== */}
        {rules.length === 0 ? (
          <div className="empty-state card">
            <span className="emoji">⚙️</span>
            <p>報酬ルールはまだありません</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={handleSeedDefaults}>テンプレート追加</button>
              <button className="btn btn-primary" onClick={openCreate}>カスタム作成</button>
            </div>
          </div>
        ) : (
          rules.map((r) => (
            /* 無効なルールは半透明で表示し、視覚的に区別する */
            <div key={r.id} className="card animate-in" style={{ marginBottom: 12, opacity: r.is_active ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{r.description}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>🏷 {TRIGGER_LABELS[r.trigger_type] || r.trigger_type}</span>
                    <span className="badge badge-approved">+{r.reward_minutes}分</span>
                    {r.trigger_condition && <span>📋 条件: {JSON.stringify(r.trigger_condition)}</span>}
                    <span className={`badge ${r.is_active ? "badge-approved" : "badge-rejected"}`}>{r.is_active ? "有効" : "無効"}</span>
                  </div>
                </div>
                <div className="task-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(r)}>{r.is_active ? "無効化" : "有効化"}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>編集</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>削除</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== ルール作成/編集モーダル ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "ルールを編集" : "報酬ルールを作成"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>トリガー</label>
                <select className="form-input" value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {/* トリガータイプに応じた条件入力フィールドを動的に表示 */}
              {triggerType === "study_time_reached" && (
                <div className="form-group">
                  <label>目標時間（分）</label>
                  <input type="number" className="form-input" value={condMinutes} onChange={(e) => setCondMinutes(Number(e.target.value))} />
                </div>
              )}
              {triggerType === "streak" && (
                <div className="form-group">
                  <label>連続日数</label>
                  <input type="number" className="form-input" value={condDays} onChange={(e) => setCondDays(Number(e.target.value))} />
                </div>
              )}

              <div className="form-group">
                <label>報酬（分）</label>
                <input type="number" className="form-input" value={rewardMinutes} onChange={(e) => setRewardMinutes(Number(e.target.value))} required />
              </div>
              <div className="form-group">
                <label>説明</label>
                <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: 宿題をすべて完了で30分" required />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editing ? "更新" : "作成"}</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>キャンセル</button>
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
