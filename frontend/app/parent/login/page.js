"use client";
import { Suspense } from "react";
import ParentLoginContent from "./ParentLoginContent";

export default function ParentLogin() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>読み込み中...</div>
      </div>
    }>
      <ParentLoginContent />
    </Suspense>
  );
}
