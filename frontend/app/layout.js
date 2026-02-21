/**
 * @fileoverview S2A アプリケーションのルートレイアウト
 *
 * Next.js App Router の最上位レイアウト。
 * - Google Fonts「Outfit」を読み込み、CSS カスタムプロパティとして適用
 * - 全ページ共通の <html lang="ja"> と SEO メタデータを設定
 */

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
      <body className={outfit.variable}>{children}</body>
    </html>
  );
}
