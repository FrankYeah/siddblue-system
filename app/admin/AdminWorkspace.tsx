"use client";

import { useState } from "react";
import { LogOut, Search, X } from "lucide-react";
import { PaperPlane, CodeBraces } from "@/components/BrandDecor";
import BankInfoPanel from "@/components/BankInfoPanel";
import BackupPanel from "@/components/BackupPanel";
import { COMPANY_NAME } from "@/lib/defaults";
import AdminEditor from "./AdminEditor";
import InspirationBoard from "./InspirationBoard";
import TodoBoard from "./TodoBoard";
import NotesBoard from "./NotesBoard";
import CasesBoard from "./CasesBoard";
import ContactsBoard from "./ContactsBoard";
import ExpensesBoard from "./ExpensesBoard";
import type {
  Case,
  Contact,
  Expense,
  InspirationBoard as InspirationBoardData,
  Note,
  QuoteSummary,
  TodoBoard as TodoBoardData,
} from "@/lib/types";

type Tab =
  | "quote"
  | "inspiration"
  | "todo"
  | "knowledge"
  | "cases"
  | "contacts"
  | "expenses";

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "todo", icon: "✅", label: "待辦清單" },
  { key: "quote", icon: "💰", label: "報價系統" },
  { key: "cases", icon: "💼", label: "案件管理" },
  { key: "expenses", icon: "💳", label: "支出紀錄" },
  { key: "inspiration", icon: "📝", label: "寫作靈感" },
  { key: "knowledge", icon: "📚", label: "知識庫" },
  { key: "contacts", icon: "🤝", label: "人脈庫" },
];

/** 各頁籤的搜尋提示 (undefined = 該頁籤不支援全域搜尋) */
const SEARCH_PLACEHOLDER: Partial<Record<Tab, string>> = {
  inspiration: "搜尋卡片標題或內容…",
  knowledge: "搜尋筆記標題、內容或標籤…",
  cases: "搜尋案件名稱、備註或夥伴…",
  contacts: "搜尋姓名、職業、聯絡方式或備註…",
  expenses: "搜尋支出名稱或備註…",
};

export default function AdminWorkspace({
  initialQuotes,
  initialInspirations,
  initialTodos,
  initialNotes,
  initialCases,
  initialContacts,
  initialContactsOrdered,
  initialExpenses,
  protectedMode,
}: {
  initialQuotes: QuoteSummary[];
  initialInspirations: InspirationBoardData;
  initialTodos: TodoBoardData;
  initialNotes: Note[];
  initialCases: Case[];
  initialContacts: Contact[];
  initialContactsOrdered: boolean;
  initialExpenses: Expense[];
  protectedMode: boolean;
}) {
  const [tab, setTab] = useState<Tab>("todo");
  // 全域搜尋：即打即過濾當前頁籤的資料（寫作靈感 / 知識庫 / 案件 / 人脈）
  const [search, setSearch] = useState("");
  const searchable = Boolean(SEARCH_PLACEHOLDER[tab]);
  // 跨頁籤：案件的夥伴「連過去看詳情」→ 切到人脈庫並打開該聯絡人的 Modal
  const [focusContactId, setFocusContactId] = useState<string | null>(null);
  // 跨頁籤（反向）：人脈的「相關案件」→ 切到案件管理並打開該案件的 Modal
  const [focusCaseId, setFocusCaseId] = useState<string | null>(null);

  function openContact(id: string) {
    setSearch("");
    setTab("contacts");
    setFocusContactId(id);
  }

  function openCase(id: string) {
    setSearch("");
    setTab("cases");
    setFocusCaseId(id);
  }

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

          {/* 🏦 銀行帳戶快捷面板（全域常駐，一鍵複製給客戶） */}
          <BankInfoPanel />

          {/* 📦 資料備份與匯出（全域常駐：匯出 JSON / 立即備份 / 還原） */}
          <BackupPanel />

          {/* 🔍 全域搜尋框（導覽列下方、頁籤上方；僅支援搜尋的頁籤顯示）
              手機 UX：min-h 44px 觸控高度、text-base(16px) 防 iOS 聚焦自動縮放、w-full 不被擠壓 */}
          {searchable && (
            <div className="relative mb-5 mt-4 sm:mb-0">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={SEARCH_PLACEHOLDER[tab]}
                aria-label="全域搜尋"
                className="min-h-[44px] w-full rounded-xl border border-white/25 bg-white/15 pl-10 pr-11 text-base text-white placeholder-white/60 outline-none backdrop-blur transition focus:border-white/60 focus:bg-white/25"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70 transition hover:bg-white/15 hover:text-white"
                  title="清除搜尋"
                  aria-label="清除搜尋"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

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
        <div className={tab === "cases" ? "animate-fade-in" : "hidden"}>
          <CasesBoard
            initialCases={initialCases}
            quotes={initialQuotes}
            contacts={initialContacts}
            onOpenContact={openContact}
            focusCaseId={focusCaseId}
            onFocusHandled={() => setFocusCaseId(null)}
            searchQuery={tab === "cases" ? search : ""}
          />
        </div>
        <div className={tab === "inspiration" ? "animate-fade-in" : "hidden"}>
          <InspirationBoard
            initialBoard={initialInspirations}
            searchQuery={tab === "inspiration" ? search : ""}
          />
        </div>
        <div className={tab === "todo" ? "animate-fade-in" : "hidden"}>
          <TodoBoard initialBoard={initialTodos} />
        </div>
        <div className={tab === "knowledge" ? "animate-fade-in" : "hidden"}>
          <NotesBoard
            initialNotes={initialNotes}
            searchQuery={tab === "knowledge" ? search : ""}
          />
        </div>
        <div className={tab === "contacts" ? "animate-fade-in" : "hidden"}>
          <ContactsBoard
            initialContacts={initialContacts}
            initialOrdered={initialContactsOrdered}
            cases={initialCases}
            onOpenCase={openCase}
            focusContactId={focusContactId}
            onFocusHandled={() => setFocusContactId(null)}
            searchQuery={tab === "contacts" ? search : ""}
          />
        </div>
        <div className={tab === "expenses" ? "animate-fade-in" : "hidden"}>
          <ExpensesBoard
            initialExpenses={initialExpenses}
            searchQuery={tab === "expenses" ? search : ""}
          />
        </div>
      </main>

      {/* 手機版底部導覽 (Bottom Navigation)：7 個頁籤，字級縮小避免擠壓 */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-paper-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur sm:hidden"
        aria-label="主要功能"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
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
