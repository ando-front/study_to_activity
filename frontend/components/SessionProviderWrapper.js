/**
 * @fileoverview NextAuth SessionProvider ラッパー
 *
 * Server Component である RootLayout から SessionProvider（Client Component）を
 * 利用するためのブリッジコンポーネント。
 */
"use client";
import { SessionProvider } from "next-auth/react";

export default function SessionProviderWrapper({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
