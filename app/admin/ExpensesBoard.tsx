"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  X,
  CreditCard,
  Building2,
  UserRound,
  Wallet,
} from "lucide-react";
import { formatNT, formatCurrency } from "@/lib/format";
import type {
  BillingCycle,
  Expense,
  ExpenseCategory,
  ExpenseEntity,
  ExpenseInput,
} from "@/lib/types";
import { adminFetch } from "@/lib/api-client";
import { useBodyScrollLock, useSyncOnFocus } from "./hooks";

// ─────────────────────────────────────────────────────────────
//  💳 金流與支出管理 (Expense Tracking)
//  上方統計區 (公司/個人每月固定支出 Burn Rate) + 下方 Notion 風格
//  資料表（點列彈出 Modal 編輯，仿 CasesBoard 慣例）。
// ─────────────────────────────────────────────────────────────

const EMPTY_DRAFT: ExpenseInput = {
  title: "",
  amount: 0,
  entity: "company",
  category: "one-time",
  billingCycle: "none",
  transactionDate: "",
  note: "",
};

const ENTITY_META: Record<ExpenseEntity, { label: string; chip: string }> = {
  company: { label: "🏢 公司", chip: "bg-sky-100 text-sky-700" },
  personal: { label: "🧑 個人", chip: "bg-amber-100 text-amber-700" },
};

const CATEGORY_META: Record<ExpenseCategory, { label: string; chip: string }> = {
  "one-time": { label: "一次性", chip: "bg-paper-block text-paper-muted" },
  subscription: { label: "訂閱制", chip: "bg-violet-100 text-violet-700" },
  sponsorship: { label: "贊助/捐款", chip: "bg-pink-100 text-pink-700" },
  recurring: { label: "固定週期規費", chip: "bg-emerald-100 text-emerald-700" },
};

const BILLING_META: Record<BillingCycle, string> = {
  none: "不重複",
  monthly: "每月",
  yearly: "每年",
};

/** 資料表欄位樣板：項目名稱 / 歸屬 / 分類 / 週期 / 金額 / 日期 / 備註 */
const GRID =
  "grid grid-cols-[minmax(130px,1.4fr)_76px_112px_60px_96px_90px_minmax(130px,1.5fr)] items-center gap-x-3";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** 此筆支出換算成「每月固定支出」的金額 (Burn Rate 用；一次性/贊助不計入) */
function monthlyEquivalent(e: Pick<Expense, "amount" | "billingCycle">) {
  if (e.billingCycle === "monthly") return e.amount;
  if (e.billingCycle === "yearly") return e.amount / 12;
  return 0;
}

function expenseToDraft(e: Expense): ExpenseInput {
  return {
    title: e.title,
    amount: e.amount,
    entity: e.entity,
    category: e.category,
    billingCycle: e.billingCycle,
    transactionDate: e.transactionDate,
    note: e.note,
  };
}

export default function ExpensesBoard({
  initialExpenses,
  searchQuery = "",
}: {
  initialExpenses: Expense[];
  /** 全域搜尋框（AdminWorkspace）傳入的關鍵字 */
  searchQuery?: string;
}) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [modalId, setModalId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ExpenseInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [entityFilter, setEntityFilter] = useState<ExpenseEntity | "all">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<
    ExpenseCategory | "all"
  >("all");

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  const editingExpense = modalId
    ? (expenses.find((e) => e.id === modalId) ?? null)
    : null;
  const modalOpen = creating || Boolean(editingExpense);
  // Modal 開啟時鎖定背景捲動（iOS scroll chaining）
  useBodyScrollLock(modalOpen);

  // 切回分頁時重新同步（跨裝置編輯 / Router Cache 過期資料）。
  // Modal 開啟或儲存中跳過；10 秒內剛寫入過也跳過。
  const lastMutationAt = useRef(0);
  useSyncOnFocus(async () => {
    if (modalOpen || saving) return;
    if (Date.now() - lastMutationAt.current < 10_000) return;
    const requestedAt = Date.now();
    try {
      const res = await adminFetch("/api/expenses");
      if (!res.ok) return;
      const { expenses: fresh } = (await res.json()) as { expenses: Expense[] };
      // fetch 進行期間若又發生本地寫入，這份回應已是過期快照，不能套用
      if (lastMutationAt.current >= requestedAt) return;
      setExpenses((cur) =>
        JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh,
      );
    } catch {
      /* 同步失敗不打擾使用者，下次 focus 再試 */
    }
  });

  // 🏢🧑 每月固定支出 (Burn Rate)：monthly 全額 + yearly / 12，依歸屬分組
  const burnRate = useMemo(() => {
    let company = 0;
    let personal = 0;
    for (const e of expenses) {
      const monthly = monthlyEquivalent(e);
      if (e.entity === "company") company += monthly;
      else personal += monthly;
    }
    return { company, personal };
  }, [expenses]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((e) => {
      if (entityFilter !== "all" && e.entity !== entityFilter) return false;
      if (categoryFilter !== "all" && e.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) || e.note.toLowerCase().includes(q)
      );
    });
  }, [expenses, entityFilter, categoryFilter, searchQuery]);

  const dirty = editingExpense
    ? JSON.stringify(expenseToDraft(editingExpense)) !== JSON.stringify(draft)
    : JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);

  function openExpense(e: Expense) {
    setDraft(expenseToDraft(e));
    setModalId(e.id);
    setCreating(false);
  }

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT, transactionDate: todayStr() });
    setModalId(null);
    setCreating(true);
  }

  function closeModal(force = false) {
    if (!force && dirty && !window.confirm("尚未儲存的變更將遺失，確定關閉？")) {
      return;
    }
    setModalId(null);
    setCreating(false);
  }

  // Esc 關閉 Modal
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, dirty]);

  async function save() {
    lastMutationAt.current = Date.now();
    setSaving(true);
    try {
      if (creating) {
        const res = await adminFetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error();
        const { expense } = (await res.json()) as { expense: Expense };
        setExpenses((es) => [expense, ...es]);
        flash("已新增");
      } else if (modalId) {
        const res = await adminFetch(`/api/expenses/${modalId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error();
        const { expense } = (await res.json()) as { expense: Expense };
        setExpenses((es) => es.map((e) => (e.id === expense.id ? expense : e)));
        flash("已儲存");
      }
      setModalId(null);
      setCreating(false);
    } catch {
      flash("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("確定刪除這筆支出？此動作無法復原。")) return;
    lastMutationAt.current = Date.now();
    setSaving(true);
    try {
      const res = await adminFetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setExpenses((es) => es.filter((e) => e.id !== id));
      setModalId(null);
      flash("已刪除");
    } catch {
      flash("刪除失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  /** 金額輸入：空字串顯示 placeholder 0，輸入即轉數字 */
  function amountValue(n: number) {
    return n === 0 ? "" : n;
  }
  function parseAmount(v: string) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-paper-text">
            💳 支出紀錄
          </h2>
          <p className="text-sm text-paper-muted">
            公司與個人支出總覽，自動算出每月固定開銷底線。點列可編輯。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-paper-muted">
              <Loader2 size={13} className="animate-spin" /> 儲存中
            </span>
          )}
          <button
            onClick={openCreate}
            className="btn-primary shrink-0 whitespace-nowrap"
          >
            <Plus size={16} /> 新增支出
          </button>
        </div>
      </div>

      {/* 🏢🧑 每月固定支出 (Burn Rate)：手機自動垂直堆疊 */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-sky-800">
            <Building2 size={15} />
            公司每月固定支出 (Burn Rate)
          </div>
          <div className="mt-1.5 text-2xl font-bold text-sky-900">
            {formatNT(Math.round(burnRate.company))}
          </div>
          <p className="mt-1 text-xs text-sky-700/80">
            訂閱制／固定週期規費：每月金額 + 每年金額 ÷ 12
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
            <UserRound size={15} />
            個人每月固定支出
          </div>
          <div className="mt-1.5 text-2xl font-bold text-amber-900">
            {formatNT(Math.round(burnRate.personal))}
          </div>
          <p className="mt-1 text-xs text-amber-700/80">
            訂閱制／固定週期規費：每月金額 + 每年金額 ÷ 12
          </p>
        </div>
      </div>

      {/* 快速篩選：歸屬 + 分類 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-paper-border bg-white p-0.5">
          {(
            [
              ["all", "全部"],
              ["company", ENTITY_META.company.label],
              ["personal", ENTITY_META.personal.label],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setEntityFilter(key)}
              className={`min-h-[36px] rounded-md px-3 py-1 text-sm transition ${
                entityFilter === key
                  ? "bg-brand-600 text-white"
                  : "text-paper-muted hover:text-paper-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="field-input w-auto min-w-[140px]"
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as ExpenseCategory | "all")
          }
          aria-label="依分類篩選"
        >
          <option value="all">全部分類</option>
          {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        <span className="text-xs text-paper-muted">
          {entityFilter !== "all" ||
          categoryFilter !== "all" ||
          searchQuery.trim()
            ? `${visible.length} / ${expenses.length} 筆`
            : `共 ${expenses.length} 筆`}
        </span>
      </div>

      {/* ── 資料表 (手機橫向滾動) ── */}
      <div className="overflow-x-auto rounded-xl border border-paper-border bg-white">
        <div className="min-w-[820px]">
          <div
            className={`${GRID} border-b border-paper-border bg-paper-block/50 px-3 py-2 text-xs font-medium text-paper-muted`}
          >
            <span>項目名稱</span>
            <span>歸屬</span>
            <span>分類</span>
            <span>週期</span>
            <span className="text-right">金額</span>
            <span>日期</span>
            <span>備註</span>
          </div>

          {visible.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-paper-muted">
              {expenses.length === 0 ? (
                <span className="inline-flex items-center gap-2">
                  <Wallet size={16} />
                  還沒有支出紀錄，按「新增支出」建立第一筆。
                </span>
              ) : (
                "沒有符合篩選條件的支出。"
              )}
            </div>
          )}

          {visible.map((e) => (
            <div
              key={e.id}
              onClick={() => openExpense(e)}
              className={`${GRID} min-h-[52px] cursor-pointer border-b border-paper-border/70 px-3 py-2 transition last:border-b-0 hover:bg-paper-block/40`}
            >
              <span className="truncate text-sm font-medium text-paper-text">
                {e.title || (
                  <span className="text-paper-muted">（未命名支出）</span>
                )}
              </span>
              <span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${ENTITY_META[e.entity].chip}`}
                >
                  {ENTITY_META[e.entity].label}
                </span>
              </span>
              <span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CATEGORY_META[e.category].chip}`}
                >
                  {CATEGORY_META[e.category].label}
                </span>
              </span>
              <span className="text-xs text-paper-muted">
                {BILLING_META[e.billingCycle]}
              </span>
              <span className="text-right text-sm tabular-nums text-paper-text">
                {formatCurrency(e.amount)}
              </span>
              <span className="text-xs text-paper-muted">
                {e.transactionDate}
              </span>
              <span
                className="line-clamp-2 whitespace-pre-line break-words text-xs leading-4 text-paper-muted"
                title={e.note || undefined}
              >
                {e.note}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 新增／編輯 Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper-text/40 p-4 backdrop-blur-sm"
          onClick={() => closeModal()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-paper-border bg-white p-5 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="flex items-center gap-1.5 text-base font-semibold text-paper-text">
                <CreditCard size={17} className="text-brand-500" />
                {creating ? "新增支出" : draft.title || "（未命名支出）"}
              </h3>
              <button
                onClick={() => closeModal()}
                className="rounded-lg p-1.5 text-paper-muted transition hover:bg-paper-block hover:text-paper-text"
                aria-label="關閉"
              >
                <X size={18} />
              </button>
            </div>

            <input
              className="field-input mb-3 text-base font-medium"
              placeholder="支出項目名稱（如：Figma 訂閱、單次會計費、捐款）"
              value={draft.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, title: e.target.value }))
              }
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={creating}
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">金額</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="field-input"
                  placeholder="0"
                  value={amountValue(draft.amount)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      amount: parseAmount(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="field-label">交易日期／下次扣款日</label>
                <input
                  type="date"
                  className="field-input"
                  value={draft.transactionDate}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      transactionDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="field-label">歸屬</label>
              <div className="inline-flex rounded-lg border border-paper-border p-0.5">
                {(Object.keys(ENTITY_META) as ExpenseEntity[]).map((ent) => (
                  <button
                    key={ent}
                    onClick={() => setDraft((d) => ({ ...d, entity: ent }))}
                    className={`min-h-[38px] rounded-md px-3 py-1 text-sm transition ${
                      draft.entity === ent
                        ? "bg-brand-600 text-white"
                        : "text-paper-muted hover:text-paper-text"
                    }`}
                  >
                    {ENTITY_META[ent].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">分類</label>
                <select
                  className="field-input"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      category: e.target.value as ExpenseCategory,
                    }))
                  }
                >
                  {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map(
                    (c) => (
                      <option key={c} value={c}>
                        {CATEGORY_META[c].label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className="field-label">扣款週期</label>
                <select
                  className="field-input"
                  value={draft.billingCycle}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      billingCycle: e.target.value as BillingCycle,
                    }))
                  }
                >
                  {(Object.keys(BILLING_META) as BillingCycle[]).map((b) => (
                    <option key={b} value={b}>
                      {BILLING_META[b]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="field-label">備註</label>
              <textarea
                className="field-input min-h-[70px] resize-y"
                placeholder="用途說明、扣款帳戶、聯絡窗口…"
                value={draft.note}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, note: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              {!creating && editingExpense ? (
                <button
                  onClick={() => remove(editingExpense.id)}
                  className="btn-danger"
                  disabled={saving}
                >
                  <Trash2 size={16} /> 刪除
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => closeModal()} className="btn-ghost">
                  取消
                </button>
                <button
                  onClick={save}
                  disabled={saving || (!creating && !dirty)}
                  className="btn-primary"
                >
                  <Save size={16} /> {creating ? "新增" : "儲存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float sm:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
