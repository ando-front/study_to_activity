/**
 * @fileoverview S2A アプリケーションのルートレイアウト
 *
 * Next.js App Router の最上位レイアウト。
 * - Google Fonts「Outfit」を読み込み、CSS カスタムプロパティとして適用
 * - 全ページ共通の <html lang="ja"> と SEO メタデータを設定
 * - 全ページ右下にマニュアルへのフローティングリンクを表示
 */

import Link from "next/link";
import { Outfit } from "next/font/google";
import "./globals.css";

/**
 * Outfit フォント設定。
 * デザインシステム（globals.css）の --font と連動し、
 * 子供にもわかりやすい丸みのあるモダンなフォントを採用。
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

/** SEO メタデータ（全ページに適用される） */
export const metadata = {
  title: "S2A | Study to Activity",
  description: "学習の成果をアクティビティ時間に変えよう！",
};

/**
 * 全ページを包むルートレイアウト。
 * - lang="ja" で日本語コンテンツであることを明示
 * - Outfit フォントの CSS 変数をルート要素に注入
 */
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className={outfit.variable}>
        {children}
        {/* マニュアルへのフローティングリンク（全ページ共通） */}
        <Link
          href="/manual"
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            zIndex: 9999,
            background: "var(--primary)",
            color: "#fff",
            textDecoration: "none",
            padding: "8px 14px",
            borderRadius: 9999,
            fontSize: "0.82rem",
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          aria-label="ユーザーマニュアルを開く"
        >
          📖 マニュアル
        </Link>
      </body>
    </html>
  );
}
