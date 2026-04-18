/**
 * @fileoverview 子ども管理ページ
 *
 * 親ユーザーが子アカウントの追加・編集・削除を行う管理画面。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { childrenApi, authApi } from "@/lib/api";

export default function ChildrenManagement() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [user, setUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [form, setForm] = useState({ name: "", age: "", daily_game_limit_minutes: "60", pin: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
    } catch { }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchChildren(); }, [fetchChildren]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAddModal = () => {
    setEditingChild(null);
    setForm({ name: "", age: "", daily_game_limit_minutes: "60", pin: "" });
    setShowModal(true);
  };

  const openEditModal = (child) => {
    setEditingChild(child);
    setForm({
      name: child.name,
      age: child.age?.toString() || "",
      daily_game_limit_minutes: (child.daily_game_limit_minutes || 60).toString(),
      pin: "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("名前を入力してください", "error");
      return;
    }

    try {
      if (editingChild) {
        const data = {
          name: form.name.trim(),
          age: form.age ? parseInt(form.age) : null,
          daily_game_limit_minutes: parseInt(form.daily_game_limit_minutes) || 60,
        };
        if (form.pin) data.pin = form.pin;
        await childrenApi.update(editingChild.id, data);
        showToast("子どもの情報を更新しました");
      } else {
        await childrenApi.create({
          name: form.name.trim(),
          role: "child",
          parent_id: user.id,
          age: form.age ? parseInt(form.age) : null,
          daily_game_limit_minutes: parseInt(form.daily_game_limit_minutes) || 60,
          pin: form.pin || "0000",
        });
        showToast("子どもを追加しました");
      }
      setShowModal(false);
      fetchChildren();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const handleDelete = async (childId) => {
    try {
      await childrenApi.delete(childId);
      showToast("子どもを削除しました");
      setDeleteConfirm(null);
      fetchChildren();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>読み込み中...</div>;

  return (
    <>
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand">🏠 S2A 管理</div>
          <div className="nav-links">
            <a href="/parent/dashboard">ホーム</a>
            <a href="/parent/children" className="active">子ども管理</a>
            <a href="/parent/plans">計画</a>
            <a href="/parent/schedule">週間予定</a>
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        <div className="page-header animate-in">
          <h1>子ども管理</h1>
          <p>お子様のアカウントを追加・編集・削除できます</p>
        </div>

        <div style={{ marginBottom: 20, textAlign: "right" }}>
          <button className="btn btn-primary" onClick={openAddModal}>
            + 子どもを追加
          </button>
        </div>

        {children.length === 0 ? (
          <div className="card animate-in-delay">
            <div className="empty-state" style={{ padding: 40 }}>
              <span className="emoji" style={{ fontSize: "3rem" }}>👶</span>
              <p>まだ子どもが登録されていません</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAddModal}>
                子どもを追加する
              </button>
            </div>
          </div>
        ) : (
          <div className="grid-2 animate-in-delay">
            {children.map((child) => (
              <div key={child.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                      {child.name}
                    </h3>
                    {child.age && (
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        {child.age}歳
                      </span>
                    )}
                  </div>
                  <span className="badge badge-approved">ID: {child.id}</span>
                </div>

                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div className="stat-card" style={{ flex: 1, padding: "12px 16px" }}>
                    <div className="stat-value" style={{ fontSize: "1.2rem" }}>
                      {child.daily_game_limit_minutes || 60}分
                    </div>
                    <div className="stat-label">1日のゲーム許可時間</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEditModal(child)}>
                    編集
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteConfirm(child)}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 追加/編集モーダル */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2>{editingChild ? "子どもの編集" : "子どもを追加"}</h2>
            <div className="form-group">
              <label>名前</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="たろう"
              />
            </div>
            <div className="form-group">
              <label>年齢</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="18"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="8"
              />
            </div>
            <div className="form-group">
              <label>1日のゲーム許可時間（分）</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="480"
                value={form.daily_game_limit_minutes}
                onChange={(e) => setForm({ ...form, daily_game_limit_minutes: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>{editingChild ? "PIN（変更する場合のみ）" : "PIN（4桁）"}</label>
              <input
                className="form-input"
                type="password"
                maxLength={4}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                placeholder={editingChild ? "変更しない場合は空欄" : "0000"}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                {editingChild ? "更新する" : "追加する"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>削除の確認</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              <strong>{deleteConfirm.name}</strong> のアカウントと関連データをすべて削除します。この操作は元に戻せません。
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleDelete(deleteConfirm.id)}>
                削除する
              </button>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
