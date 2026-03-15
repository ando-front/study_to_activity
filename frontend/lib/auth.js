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

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
  : "http://localhost:8000/api";

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
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const res = await fetch(`${API_BASE}/auth/users`);
          if (!res.ok) return false; // バックエンドエラー時はアクセスを拒否
          const users = await res.json();
          const matched = users.find(
            (u) => u.role === "parent" && u.email === user.email
          );
          if (!matched) return false; // 未登録ユーザーはアクセスを拒否
          user.backendId = matched.id;
          user.role = matched.role;
        } catch {
          return false; // バックエンドに接続できない場合はアクセスを拒否
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
