/**
 * @fileoverview NextAuth.js ルートハンドラ
 *
 * Next.js App Router 用の認証エンドポイント。
 * /api/auth/* へのリクエストをすべて NextAuth が処理する。
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
