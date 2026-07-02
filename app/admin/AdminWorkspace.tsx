"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { PaperPlane, CodeBraces } from "@/components/BrandDecor";
import { COMPANY_NAME } from "@/lib/defaults";
import AdminEditor from "./AdminEditor";
import InspirationBoard from "./InspirationBoard";
import TodoBoard from "./TodoBoard";
import type {
  InspirationBoard as InspirationBoardData,
  QuoteSummary,
  TodoBoard as TodoBoardData,
} from "@/lib/types";

type Tab = "quote" | "inspiration" | "todo";

const TABS: { key: Tab; label: string }[] = [
  { key: "quote", label: "💰 報價系統" },
  { key: "inspiration", label: "📝 寫作靈感" },
  { key: "todo", label: "✅ 待辦清單" },
];

export default function AdminWorkspace({
  initialQuotes,
  initialInspirations,
  initialTodos,
  protectedMode,
}: {
  initialQuotes: QuoteSummary[];
  initialInspirations: InspirationBoardData;
  initialTodos: TodoBoardData;
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

          {/* 頁籤 */}
          <nav className="mt-5 flex gap-1">
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
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 面板 (全部掛載，以 hidden 切換 → 保留各自狀態、無需重新載入整頁) */}
      <main>
        <div className={tab === "quote" ? "animate-fade-up" : "hidden"}>
          <AdminEditor initialQuotes={initialQuotes} />
        </div>
        <div className={tab === "inspiration" ? "animate-fade-up" : "hidden"}>
          <InspirationBoard initialBoard={initialInspirations} />
        </div>
        <div className={tab === "todo" ? "animate-fade-up" : "hidden"}>
          <TodoBoard initialBoard={initialTodos} />
        </div>
      </main>
    </div>
  );
}
