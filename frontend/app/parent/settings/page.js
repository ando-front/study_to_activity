/**
 * @fileoverview ユーザー管理（設定）ページ
 *
 * 親ユーザーが子供の追加・編集・削除、および自分のプロフィール編集を行う画面。
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { authApi } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [user, setUser] = useState(null);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Child add/edit modal
  const [showChildModal, setShowChildModal] = useState(false);
  const [editingChild, setEditingChild] = useState(null); // null = add mode
  const [childName, setChildName] = useState("");
  const [childPin, setChildPin] = useState("");
  const [saving, setSaving] = useState(false);

  // Parent profile edit modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePin, setProfilePin] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Auth guard
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user) {
      authApi.getUser(session.user.backendId).then(u => {
        setUser(u);
      }).catch(() => {
        setUser({
          id: session.user.backendId,
          name: session.user.name,
          role: "parent",
        });
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

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUsers = useCallback(async () => {
    try {
      const users = await authApi.listUsers();
      setChildren(users.filter(u => u.role === "child"));
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { if (user) fetchUsers(); }, [user, fetchUsers]);

  // --- Child CRUD handlers ---

  const openAddChild = () => {
    setEditingChild(null);
    setChildName("");
    setChildPin("");
    setShowChildModal(true);
  };

  const openEditChild = (child) => {
    setEditingChild(child);
    setChildName(child.name);
    setChildPin("");
    setShowChildModal(true);
  };

  const handleSaveChild = async (e) => {
    e.preventDefault();
    if (!childName.trim()) return;
    setSaving(true);
    try {
      if (editingChild) {
        const data = { name: childName };
        if (childPin) data.pin = childPin;
        await authApi.updateChild(editingChild.id, data);
        showToast(`${childName} の情報を更新しました`);
      } else {
        const data = { name: childName };
        if (childPin) data.pin = childPin;
        await authApi.createChild(data);
        showToast(`${childName} を追加しました`);
      }
      setShowChildModal(false);
      fetchUsers();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async () => {
    if (!deleteTarget) return;
    try {
      await authApi.deleteChild(deleteTarget.id);
      showToast(`${deleteTarget.name} を削除しました`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // --- Parent profile handler ---

  const openProfileEdit = () => {
    setProfileName(user?.name || "");
    setProfileEmail(user?.email || "");
    setProfilePin("");
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {};
      if (profileName && profileName !== user.name) data.name = profileName;
      if (profileEmail !== (user.email || "")) data.email = profileEmail;
      if (profilePin) data.pin = profilePin;

      if (Object.keys(data).length === 0) {
        setShowProfileModal(false);
        setSaving(false);
        return;
      }

      const updated = await authApi.updateProfile(user.id, data);
      setUser(updated);
      localStorage.setItem("s2a_user", JSON.stringify(updated));
      showToast("プロフィールを更新しました");
      setShowProfileModal(false);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>読み込み中...</div>;

  return (
    <>
      {/* Navigation */}
      <nav className="nav-bar">
        <div className="nav-inner">
          <div className="nav-brand">設定</div>
          <div className="nav-links">
            <a href="/parent/dashboard">ホーム</a>
            <a href="/parent/plans">計画</a>
            <a href="/parent/schedule">週間予定</a>
            <a href="/parent/rules">ルール</a>
            <a href="/parent/wallet">ウォレット</a>
            <a href="/parent/settings" className="active">設定</a>
            <a href="/" onClick={async (e) => { e.preventDefault(); localStorage.removeItem("s2a_user"); await signOut({ callbackUrl: "/" }); }}>ログアウト</a>
          </div>
        </div>
      </nav>

      <div className="page-wrapper">
        <div className="page-header animate-in">
          <h1>ユーザー管理</h1>
          <p>子供の追加・編集・削除、プロフィールの変更ができます</p>
        </div>

        {/* Parent profile */}
        <div className="card animate-in-delay" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            👨‍👩‍👧 親アカウント
          </h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{user?.name}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{user?.email || "メール未設定"}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={openProfileEdit}>編集</button>
          </div>
        </div>

        {/* Children list */}
        <div className="card animate-in-delay" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              👧 子供アカウント
              <span className="badge badge-approved">{children.length}人</span>
            </h2>
            <button className="btn btn-primary btn-sm" onClick={openAddChild}>＋ 追加</button>
          </div>

          {children.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <span className="emoji" style={{ fontSize: "2rem" }}>👶</span>
              <p>まだ子供が登録されていません</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={openAddChild}>最初の子供を追加</button>
            </div>
          ) : (
            children.map((child) => (
              <div key={child.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--accent-pink), var(--accent-orange))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1rem", color: "#fff", fontWeight: 700,
                  }}>
                    {child.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{child.name}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>ID: {child.id}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditChild(child)}>編集</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(child)}>削除</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Child add/edit modal */}
      {showChildModal && (
        <div className="modal-overlay" onClick={() => { if (!saving) setShowChildModal(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingChild ? `${editingChild.name} を編集` : "子供を追加"}</h2>
            <form onSubmit={handleSaveChild}>
              <div className="form-group">
                <label>名前</label>
                <input className="form-input" value={childName}
                  onChange={(e) => setChildName(e.target.value)} placeholder="名前を入力" required disabled={saving} />
              </div>
              <div className="form-group">
                <label>PIN（任意）{editingChild && "— 空欄なら変更なし"}</label>
                <input className="form-input" type="password" value={childPin}
                  onChange={(e) => setChildPin(e.target.value)} placeholder="4桁のPIN" maxLength={4} disabled={saving} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? "保存中..." : (editingChild ? "更新" : "追加")}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowChildModal(false)} disabled={saving}>
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parent profile edit modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { if (!saving) setShowProfileModal(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>プロフィール編集</h2>
            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>名前</label>
                <input className="form-input" value={profileName}
                  onChange={(e) => setProfileName(e.target.value)} placeholder="名前" required disabled={saving} />
              </div>
              <div className="form-group">
                <label>メールアドレス（Google ログイン用）</label>
                <input className="form-input" type="email" value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)} placeholder="例: parent@example.com" disabled={saving} />
              </div>
              <div className="form-group">
                <label>PIN（空欄なら変更なし）</label>
                <input className="form-input" type="password" value={profilePin}
                  onChange={(e) => setProfilePin(e.target.value)} placeholder="4桁のPIN" maxLength={4} disabled={saving} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? "保存中..." : "更新"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)} disabled={saving}>
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ color: "var(--danger, #dc2626)" }}>削除の確認</h2>
            <p style={{ margin: "12px 0 20px", color: "var(--text-secondary)" }}>
              <strong>{deleteTarget.name}</strong> を削除しますか？この操作は取り消せません。ウォレット残高やログも削除されます。
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteChild}>削除する</button>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
