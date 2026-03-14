/**
 * @fileoverview S2A API クライアント
 *
 * バックエンド（FastAPI）の全エンドポイントをラップする HTTP クライアント。
 * 各ドメイン（認証、計画、タスク、ルール、ウォレット）ごとに
 * オブジェクトとしてエクスポートし、呼び出し側でのインポートを明確にする。
 *
 * 使用例:
 *   import { authApi, plansApi } from "./lib/api";
 *   const users = await authApi.listUsers();
 */

/** バックエンド API のベース URL（環境変数で上書き可能） */
const DEFAULT_API_BASE =
  typeof window !== "undefined" &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "https://s2a-backend.onrender.com/api"
    : "http://localhost:8000/api";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE).replace(
  /\/$/,
  ""
);

/**
 * 共通の HTTP リクエスト関数。
 * - レスポンスが非 2xx の場合、サーバーのエラーメッセージを含む Error をスローする。
 * - Content-Type は JSON をデフォルトとする。
 *
 * @param {string} path - API_BASE からの相対パス（例: "/auth/users"）
 * @param {RequestInit} options - fetch に渡すオプション
 * @returns {Promise<any>} パース済みの JSON レスポンス
 * @throws {Error} API がエラーレスポンスを返した場合
 */
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API Error");
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// 認証 API
// ---------------------------------------------------------------------------

/** ユーザー登録・ログイン・一覧取得を行う認証関連のエンドポイント */
export const authApi = {
  /** 新規ユーザーを登録し、作成されたユーザーを返す */
  register: (data) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  /** PIN 認証でログインし、ユーザー情報とメッセージを返す */
  login: (data) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  /** 全ユーザー一覧を取得（ロール選択画面で使用） */
  listUsers: () => request("/auth/users"),

  /** 指定 ID のユーザー情報を取得 */
  getUser: (id) => request(`/auth/users/${id}`),
};

// ---------------------------------------------------------------------------
// 学習計画 API
// ---------------------------------------------------------------------------

/** 学習計画の CRUD を行うエンドポイント */
export const plansApi = {
  /**
   * 計画を新規作成する。タスクも同時に登録可能。
   * @param {Object} data - { child_id, plan_date, title, tasks[] }
   */
  create: (data) =>
    request("/plans/", { method: "POST", body: JSON.stringify(data) }),

  /**
   * 計画一覧を取得する。child_id / plan_date でフィルタ可能。
   * @param {Object} params - オプションの { child_id, plan_date }
   */
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.child_id) q.set("child_id", params.child_id);
    if (params.plan_date) q.set("plan_date", params.plan_date);
    return request(`/plans/?${q.toString()}`);
  },

  /** 指定 ID の計画をタスク付きで取得 */
  get: (id) => request(`/plans/${id}`),

  /** 指定 ID の計画を削除（紐づくタスクもカスケード削除） */
  delete: (id) => request(`/plans/${id}`, { method: "DELETE" }),

  /** 既存の計画にタスクを追加 */
  addTask: (planId, taskData) =>
    request(`/plans/${planId}/tasks`, {
      method: "POST",
      body: JSON.stringify(taskData),
    }),
};

// ---------------------------------------------------------------------------
// タスク API
// ---------------------------------------------------------------------------

/** タスクのライフサイクル管理（開始→完了→承認/差し戻し）とダッシュボード取得 */
export const tasksApi = {
  /** 指定 ID のタスク詳細を取得 */
  get: (id) => request(`/tasks/${id}`),

  /** タスクのフィールドを部分更新（教科名、時間など） */
  update: (id, data) =>
    request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  /** タスクを「進行中」に遷移させる（子供が学習開始時に呼ぶ） */
  start: (id) => request(`/tasks/${id}/start`, { method: "POST" }),

  /**
   * タスクを「完了」に遷移させる。
   * actualMinutes を渡さなければ、タイマー開始からの経過時間が自動計算される。
   */
  complete: (id, actualMinutes) => {
    const q = actualMinutes != null ? `?actual_minutes=${actualMinutes}` : "";
    return request(`/tasks/${id}/complete${q}`, { method: "POST" });
  },

  /**
   * タスクを承認する（親のみ実行可能）。
   * 承認後に報酬エンジンが自動評価され、条件を満たせばウォレットに時間が付与される。
   */
  approve: (id, parentId) =>
    request(`/tasks/${id}/approve?parent_id=${parentId}`, { method: "POST" }),

  /** タスクを差し戻す（子供に再度取り組んでもらう） */
  reject: (id) => request(`/tasks/${id}/reject`, { method: "POST" }),

  /** 子供のダッシュボードデータ（今日の計画、ウォレット残高、タスク進捗）を一括取得 */
  childDashboard: (childId) =>
    request(`/tasks/dashboard/child/${childId}`),

  /** 親のダッシュボードデータ（承認待ち、今日の計画、有効ルール）を一括取得 */
  parentDashboard: () => request("/tasks/dashboard/parent"),
};

// ---------------------------------------------------------------------------
// 報酬ルール API
// ---------------------------------------------------------------------------

/** 報酬ルールの CRUD とデフォルトテンプレートの一括登録 */
export const rulesApi = {
  /** 新しいルールを作成 */
  create: (data) =>
    request("/rules/", { method: "POST", body: JSON.stringify(data) }),

  /** ルール一覧を取得（activeOnly=true でアクティブのみ） */
  list: (activeOnly = false) =>
    request(`/rules/?active_only=${activeOnly}`),

  /** 指定 ID のルールを取得 */
  get: (id) => request(`/rules/${id}`),

  /** ルールを部分更新（有効/無効の切替にも使用） */
  update: (id, data) =>
    request(`/rules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  /** ルールを削除 */
  delete: (id) => request(`/rules/${id}`, { method: "DELETE" }),

  /** PRD 準拠のデフォルト報酬ルール 4 件を一括登録 */
  seedDefaults: () => request("/rules/seed-defaults", { method: "POST" }),
};

// ---------------------------------------------------------------------------
// ウォレット API
// ---------------------------------------------------------------------------

/** アクティビティ残高の照会・調整・消費記録・ログ取得 */
export const walletApi = {
  /** 子供のウォレット残高・設定を取得 */
  get: (childId) => request(`/wallet/${childId}`),

  /**
   * 残高を手動調整する（親が使用）。
   * minutes が正なら加算、負なら減算。reason は必須。
   */
  adjust: (childId, data) =>
    request(`/wallet/${childId}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** ウォレット設定（1 日上限、翌日繰越）を更新 */
  updateSettings: (childId, data) =>
    request(`/wallet/${childId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /** アクティビティ時間を消費し、残高から差し引く */
  consume: (childId, data) =>
    request(`/wallet/${childId}/consume`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** 消費ログ一覧を取得（新しい順） */
  getLogs: (childId) => request(`/wallet/${childId}/logs`),

  /** 報酬付与ログを取得（日付フィルタ任意） */
  getRewards: (childId, date) => {
    const q = date ? `?granted_date=${date}` : "";
    return request(`/wallet/${childId}/rewards${q}`);
  },
};

// ---------------------------------------------------------------------------
// Switch 連携 API
// ---------------------------------------------------------------------------

export const switchApi = {
  /** 連携開始用の URL を取得 */
  getAuthUrl: () => request("/switch/auth-url"),

  /** 連携を完了（URL/コードを送信） */
  connect: (data) =>
    request("/switch/connect", { method: "POST", body: JSON.stringify(data) }),

  /** 連携済みデバイス一覧を取得 */
  listDevices: (userId) => request(`/switch/devices/${userId}`),

  /** 現在の残高を Switch に同期 */
  sync: (userId) => request(`/switch/sync/${userId}`, { method: "POST" }),
};
