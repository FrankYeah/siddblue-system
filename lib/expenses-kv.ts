import { createEntityStore } from "./entity-store";
import type {
  BillingCycle,
  Expense,
  ExpenseCategory,
  ExpenseEntity,
  ExpenseInput,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  💳 金流與支出管理資料存取層 (Vercel KV)
//
//  儲存結構：
//    expense:{id}      → 單筆支出 (JSON)
//    expenses:index    → sorted set，member=id，score=updatedAt(ms)
//
//  CRUD 骨架（KV_ENABLED / 記憶體後援 / mget 批次讀 / pipeline 還原）
//  由 lib/entity-store.ts 工廠提供，本檔只負責純函式的清理與遷移。
// ─────────────────────────────────────────────────────────────

const ENTITIES: ExpenseEntity[] = ["company", "personal"];
const CATEGORIES: ExpenseCategory[] = [
  "one-time",
  "subscription",
  "sponsorship",
  "recurring",
];
const BILLING_CYCLES: BillingCycle[] = ["none", "monthly", "yearly"];

// ── 清理 / 補齊 (防止壞資料，並相容缺欄位的舊資料) ──
function toAmount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  // 金額取整數、擋掉負值與離譜大數 (10 億)
  return Math.min(Math.max(Math.round(n), 0), 1_000_000_000);
}

function toDateStr(raw: unknown, fallbackDate: string): string {
  const s = String(raw ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallbackDate;
}

function migrateExpense(raw: Expense | null): Expense | null {
  if (!raw) return null;
  const createdAt = String(raw.createdAt || new Date().toISOString());
  return {
    id: String(raw.id),
    title: String(raw.title ?? "").slice(0, 200),
    amount: toAmount(raw.amount),
    entity: ENTITIES.includes(raw.entity) ? raw.entity : "company",
    category: CATEGORIES.includes(raw.category) ? raw.category : "one-time",
    billingCycle: BILLING_CYCLES.includes(raw.billingCycle)
      ? raw.billingCycle
      : "none",
    transactionDate: toDateStr(raw.transactionDate, createdAt.slice(0, 10)),
    note: String(raw.note ?? "").slice(0, 2000),
    createdAt,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

/** 僅取表單允許的欄位，並清理內容 */
function cleanInput(input: ExpenseInput): ExpenseInput {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: String(input?.title ?? "").slice(0, 200),
    amount: toAmount(input?.amount),
    entity: ENTITIES.includes(input?.entity) ? input.entity : "company",
    category: CATEGORIES.includes(input?.category)
      ? input.category
      : "one-time",
    billingCycle: BILLING_CYCLES.includes(input?.billingCycle)
      ? input.billingCycle
      : "none",
    transactionDate: toDateStr(input?.transactionDate, today),
    note: String(input?.note ?? "").slice(0, 2000),
  };
}

const store = createEntityStore<Expense, ExpenseInput>({
  keyPrefix: "expense",
  indexKey: "expenses:index",
  memGlobalKey: "__sbExpensesMem",
  migrate: migrateExpense,
  cleanInput,
});

/** 建立新支出 */
export const createExpense = store.create;
/** 讀取單筆支出 */
export const getExpense = store.get;
/** 更新支出 (保留 id / createdAt) */
export const updateExpense = store.update;
/** 刪除支出 */
export const deleteExpense = store.remove;
/** 取得所有支出 (新 → 舊)，後台初始載入與列表使用 */
export const getAllExpenses = store.getAll;
/**
 * 完整覆寫支出資料 (備份還原用)：清空現有全部，寫入 snapshot 內容。
 * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
 */
export const restoreExpensesData = store.restoreAll;

export const KV_ENABLED = store.KV_ENABLED;
