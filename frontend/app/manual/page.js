/**
 * @fileoverview ユーザーマニュアルページ
 *
 * docs/prd.md のマークダウンを react-markdown で HTML としてレンダリングする
 * サーバーコンポーネント。ファイルはビルド時・実行時に
 * public/manual.md から fs.readFileSync で読み込む。
 */

import fs from "fs";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

/** SEO メタデータ */
export const metadata = {
  title: "ユーザーマニュアル | S2A",
  description: "Study to Activity の使い方ガイドです。",
};

/**
 * マニュアルページコンポーネント。
 * public/manual.md を読み込んで Markdown → HTML でレンダリングする。
 */
export default function ManualPage() {
  const filePath = path.join(process.cwd(), "public", "manual.md");
  const content = fs.readFileSync(filePath, "utf8");

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        padding: "0 0 60px",
      }}
    >
      {/* ナビゲーションバー */}
      <nav
        style={{
          background: "var(--card-bg)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Link
          href="/"
          style={{
            color: "var(--primary)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← ホームへ戻る
        </Link>
        <span style={{ color: "var(--border)", fontSize: "1rem" }}>|</span>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>
          📖 ユーザーマニュアル
        </span>
      </nav>

      {/* マークダウン本文 */}
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "40px 24px",
          color: "var(--text)",
          lineHeight: 1.8,
        }}
        className="manual-content"
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
