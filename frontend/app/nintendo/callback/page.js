/**
 * @fileoverview Nintendo Account 認証コールバックページ
 *
 * Nintendo の認証後リダイレクトを受け取り、session_token_code を自動送信する。
 *
 * 【技術的背景】
 * Nintendo の redirect_uri は `npf54789befb391a838://auth` (カスタムURLスキーム) に
 * 固定されており、このページへの自動リダイレクトは現在サポートされていない。
 * ただし将来的に redirect_uri の変更が可能になった場合、または何らかの手段で
 * このページに `#session_token_code=...&state=...` が渡された場合に自動処理する。
 *
 * 【現在の動作】
 * - URL フラグメントに session_token_code が含まれていれば自動送信
 * - 含まれていなければ手動入力フォームを表示してダッシュボードへ誘導
 */
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { switchApi, authApi } from "@/lib/api";

export default function NintendoCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("processing"); // "processing" | "success" | "error" | "manual"
  const [errorMsg, setErrorMsg] = useState("");
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash.replace(/^#/, "");
    const search = window.location.search.replace(/^\?/, "");

    // Parse params from either fragment or query string
    const params = {};
    for (const part of (hash || search).split("&")) {
      if (part.includes("=")) {
        const [k, v] = part.split("=", 2);
        params[k] = v;
      }
    }

    const sessionTokenCode = params["session_token_code"];
    const state = params["state"];

    if (!sessionTokenCode) {
      setStatus("manual");
      return;
    }

    // Retrieve stored auth info from sessionStorage (set during startSwitchConnect)
    const stored = (() => {
      try {
        return JSON.parse(sessionStorage.getItem("s2a_switch_pending") || "null");
      } catch {
        return null;
      }
    })();

    const userId = stored?.userId;
    const verifier = stored?.verifier;

    if (!userId || !verifier) {
      setStatus("manual");
      return;
    }

    switchApi
      .callback({ user_id: userId, session_token_code: sessionTokenCode, verifier, state })
      .then(() => authApi.getUser(userId))
      .then((updatedUser) => {
        localStorage.setItem("s2a_user", JSON.stringify(updatedUser));
        sessionStorage.removeItem("s2a_switch_pending");
        setStatus("success");
        setTimeout(() => router.push("/parent/dashboard"), 1500);
      })
      .catch((e) => {
        let msg;
        if (typeof e?.message === "string" && e.message.length > 0) {
          msg = e.message;
        } else if (typeof e === "string") {
          msg = e;
        } else {
          msg = "Nintendo Account の認証に失敗しました。ダッシュボードから再度お試しください。";
        }
        setErrorMsg(msg);
        setStatus("error");
      });
  }, [router]);

  if (status === "processing") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        <p style={{ fontSize: "1.2rem", marginBottom: 8 }}>Nintendo Account 連携中...</p>
        <p style={{ fontSize: "0.9rem" }}>しばらくお待ちください</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontSize: "1.4rem", marginBottom: 8 }}>連携完了！</p>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>ダッシュボードへ移動します...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontSize: "1.2rem", color: "var(--danger)", marginBottom: 8 }}>連携に失敗しました</p>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 20 }}>{errorMsg}</p>
        <a href="/parent/dashboard" className="btn btn-primary">ダッシュボードへ戻る</a>
      </div>
    );
  }

  // "manual" — no session_token_code in URL, guide user back to dashboard
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ fontSize: "1.1rem", marginBottom: 8 }}>URLにコードが見つかりませんでした</p>
      <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 20 }}>
        ダッシュボードに戻り、コピーしたURLを貼り付けてください。
      </p>
      <a href="/parent/dashboard" className="btn btn-primary">ダッシュボードへ戻る</a>
    </div>
  );
}
