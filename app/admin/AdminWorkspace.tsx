"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { PaperPlane, CodeBraces } from "@/components/BrandDecor";
import { COMPANY_NAME } from "@/lib/defaults";
import AdminEditor from "./AdminEditor";
import InspirationBoard from "./InspirationBoard";
import TodoBoard from "./TodoBoard";
import NotesBoard from "./NotesBoard";
import type {
  InspirationBoard as InspirationBoardData,
  Note,
  QuoteSummary,
  TodoBoard as TodoBoardData,
} from "@/lib/types";

type Tab = "quote" | "inspiration" | "todo" | "knowledge";

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "quote", icon: "💰", label: "報價系統" },
  { key: "inspiration", icon: "📝", label: "寫作靈感" },
  { key: "todo", icon: "✅", label: "待辦清單" },
  { key: "knowledge", icon: "📚", label: "知識庫" },
];

export default function AdminWorkspace({
  initialQuotes,
  initialInspirations,
  initialTodos,
  initialNotes,
  protectedMode,
}: {
  initialQuotes: QuoteSummary[];
  initialInspirations: InspirationBoardData;
  initialTodos: TodoBoardData;
  initialNotes: Note[];
  protectedMode: boolean;
}) {
  const [tab, setTab] = useState<Tab>("quote");

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-paper-bg">
      {/* 全局導覽列 */}
      <header className="relative overflow-hidden bg-brand-gradient text-white">
        <PaperPlane
          size={64}
          className="absolute right-6 top-4 text-white/20 animate-float-plane"
        />
        <div className="mx-auto max-w-6xl px-6 pb-0 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <CodeBraces className="text-white/80" /> 創作者工作區
              </div>
              <h1 className="text-xl font-bold">{COMPANY_NAME}</h1>
            </div>
            {protectedMode && (
              <button
                onClick={logout}
                className="btn bg-white/15 text-white hover:bg-white/25"
              >
                <LogOut size={16} /> 登出
              </button>
            )}
          </div>

          {/* 頁籤 (桌機：頂部；手機改用下方底部導覽) */}
          <nav className="mt-5 hidden gap-1 sm:flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                  tab === t.key
                    ? "bg-paper-bg text-brand-700 shadow-sm"
                    : "text-white/85 hover:bg-white/10"
                }`}
                aria-current={tab === t.key ? "page" : undefined}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 面板 (全部掛載，以 hidden 切換 → 保留各自狀態、無需重新載入整頁)
          手機底部留白，避免內容被固定底部導覽遮住 */}
      <main className="pb-24 sm:pb-0">
        <div className={tab === "quote" ? "animate-fade-in" : "hidden"}>
          <AdminEditor initialQuotes={initialQuotes} />
        </div>
        <div className={tab === "inspiration" ? "animate-fade-in" : "hidden"}>
          <InspirationBoard initialBoard={initialInspirations} />
        </div>
        <div className={tab === "todo" ? "animate-fade-in" : "hidden"}>
          <TodoBoard initialBoard={initialTodos} />
        </div>
        <div className={tab === "knowledge" ? "animate-fade-in" : "hidden"}>
          <NotesBoard initialNotes={initialNotes} />
        </div>
      </main>

      {/* 手機版底部導覽 (Bottom Navigation) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-paper-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur sm:hidden"
        aria-label="主要功能"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-medium transition ${
              tab === t.key ? "text-brand-600" : "text-paper-muted"
            }`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
