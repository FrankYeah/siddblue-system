import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
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
//  儲存結構 (仿照 lib/cases-kv.ts)：
//    expense:{id}      → 單筆支出 (JSON)
//    expenses:index    → sorted set，member=id，score=updatedAt(ms)
//                        後台列表用，依更新時間新→舊排序
//
//  未設定 KV 環境變數時 (本機開發未接 KV)，自動改用記憶體儲存。
//  讀取一律 noStore()，避免 Server Component 服務到過期資料。
// ─────────────────────────────────────────────────────────────

const EXPENSE_KEY = (id: string) => `expense:${id}`;
const EXPENSE_INDEX_KEY = "expenses:index";

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ── 記憶體後援 (本機無 KV 時使用) ──
// 掛在 globalThis 上，確保開發模式下 Route Handler 與 Server Component
// 這些分開打包的模組實例共用同一份資料 (正式環境走 KV，不會用到此後援)。
const memStore: Map<string, Expense> = ((
  globalThis as unknown as { __sbExpensesMem?: Map<string, Expense> }
).__sbExpensesMem ??= new Map<string, Expense>());

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

/** 建立新支出 */
export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const now = new Date().toISOString();
  const record: Expense = {
    ...cleanInput(input),
    id: nanoid(10),
    createdAt: now,
    updatedAt: now,
  };

  if (KV_ENABLED) {
    await kv.set(EXPENSE_KEY(record.id), record);
    await kv.zadd(EXPENSE_INDEX_KEY, { score: Date.now(), member: record.id });
  } else {
    memStore.set(record.id, record);
  }
  return record;
}

/** 讀取單筆支出 */
export async function getExpense(id: string): Promise<Expense | null> {
  noStore();
  if (!id) return null;
  if (KV_ENABLED) {
    const record = await kv.get<Expense>(EXPENSE_KEY(id));
    return migrateExpense(record ?? null);
  }
  return migrateExpense(memStore.get(id) ?? null);
}

/** 更新支出 (保留 id / createdAt) */
export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<Expense | null> {
  const existing = await getExpense(id);
  if (!existing) return null;

  const updated: Expense = {
    ...existing,
    ...cleanInput(input),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (KV_ENABLED) {
    await kv.set(EXPENSE_KEY(id), updated);
    await kv.zadd(EXPENSE_INDEX_KEY, { score: Date.now(), member: id });
  } else {
    memStore.set(id, updated);
  }
  return updated;
}

/** 刪除支出 */
export async function deleteExpense(id: string): Promise<boolean> {
  const existing = await getExpense(id);
  if (!existing) return false;

  if (KV_ENABLED) {
    await kv.del(EXPENSE_KEY(id));
    await kv.zrem(EXPENSE_INDEX_KEY, id);
  } else {
    memStore.delete(id);
  }
  return true;
}

/** 取得所有支出 (新 → 舊)，後台初始載入與列表使用 */
export async function getAllExpenses(): Promise<Expense[]> {
  noStore();
  if (KV_ENABLED) {
    const ids = await kv.zrange<string[]>(EXPENSE_INDEX_KEY, 0, -1, {
      rev: true,
    });
    if (!ids || ids.length === 0) return [];
    const records = await Promise.all(ids.map((id) => getExpense(id)));
    return records.filter((e): e is Expense => Boolean(e));
  }
  return Array.from(memStore.values())
    .map((e) => migrateExpense(e))
    .filter((e): e is Expense => Boolean(e))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 完整覆寫支出資料 (備份還原用)：清空現有全部，寫入 snapshot 內容。
 * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
 */
export async function restoreExpensesData(expenses: Expense[]): Promise<void> {
  if (KV_ENABLED) {
    const existingIds =
      (await kv.zrange<string[]>(EXPENSE_INDEX_KEY, 0, -1)) ?? [];
    if (existingIds.length > 0) {
      await Promise.all(existingIds.map((id) => kv.del(EXPENSE_KEY(id))));
      await kv.del(EXPENSE_INDEX_KEY);
    }
    for (const e of expenses) {
      await kv.set(EXPENSE_KEY(e.id), e);
      await kv.zadd(EXPENSE_INDEX_KEY, {
        score: new Date(e.updatedAt).getTime() || Date.now(),
        member: e.id,
      });
    }
  } else {
    memStore.clear();
    expenses.forEach((e) => memStore.set(e.id, e));
  }
}

export { KV_ENABLED };
