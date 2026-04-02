/**
 * @fileoverview NextAuth.js 設定
 *
 * Google OAuth プロバイダーと Credentials プロバイダー（PIN 認証）を設定する。
 * Google OAuth でログインした際はバックエンド API でユーザーを照合し、
 * 親ロールのユーザーのみダッシュボードへのアクセスを許可する。
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const API_BASE = (
  (process.env.BACKEND_URL
    ? process.env.BACKEND_URL.replace(/\/$/, "") + "/api"
    : null) ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://s2a-backend.onrender.com/api"
    : "http://localhost:8000/api")
).replace(/\/$/, "");

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "PIN",
      credentials: {
        user_id: { label: "ユーザーID", type: "number" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.user_id) return null;
        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: Number(credentials.user_id),
              pin: credentials.pin || "",
            }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          const user = data.user || data;
          if (user?.role !== "parent") return null;
          return { id: String(user.id), name: user.name, role: user.role, backendId: user.id };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    /**
     * Google OAuth でログインした場合はバックエンドのユーザー一覧と照合する。
     * email が一致する親ユーザーが存在する場合のみログインを許可する。
     * バックエンドDBに未登録でも ALLOWED_EMAILS 環境変数に含まれていれば許可する。
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const allowedEmails = [
          "angie07.inet@gmail.com",
          ...(process.env.ALLOWED_EMAILS || "")
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean),
        ];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch(`${API_BASE}/auth/users`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!res.ok) {
            // バックエンドエラー時は ALLOWED_EMAILS でフォールバック
            return allowedEmails.includes(user.email) || "/parent/login?error=BackendUnavailable";
          }
          const users = await res.json();
          const matched = users.find(
            (u) => u.role === "parent" && u.email === user.email
          );
          if (matched) {
            user.backendId = matched.id;
            user.role = matched.role;
            return true;
          }
          // DBに未登録の場合は ALLOWED_EMAILS でフォールバック
          if (allowedEmails.includes(user.email)) {
            user.role = "parent";
            return true;
          }
          return false; // 未登録かつ ALLOWED_EMAILS にもない場合はアクセスを拒否
        } catch (err) {
          clearTimeout(timeoutId);
          // タイムアウトまたはバックエンド接続不可 → ALLOWED_EMAILS でフォールバック
          if (allowedEmails.includes(user.email)) return true;
          return "/parent/login?error=BackendUnavailable";
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.backendId = user.backendId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.backendId = token.backendId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/parent/login",
  },
});
