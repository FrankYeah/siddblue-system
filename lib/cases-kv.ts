import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import type { Case, CaseInput, PartnerCost, PartnerPayStatus } from "./types";

// ─────────────────────────────────────────────────────────────
//  案件與財務管理資料存取層 (Vercel KV)
//
//  儲存結構 (仿照 lib/notes-kv.ts)：
//    case:{id}      → 單筆案件 (JSON)
//    cases:index    → sorted set，member=id，score=updatedAt(ms)
//                     後台列表用，依更新時間新→舊排序
//
//  金額 (totalAmount / receivedAmount / partnerCosts[].amount) 一律存數字；
//  未收款餘額、代扣稅額、淨利皆為衍生值 (lib/finance.ts 計算)，不落地。
//
//  未設定 KV 環境變數時 (本機開發未接 KV)，自動改用記憶體儲存。
//  讀取一律 noStore()，避免 Server Component 服務到過期資料。
// ─────────────────────────────────────────────────────────────

const CASE_KEY = (id: string) => `case:${id}`;
const CASE_INDEX_KEY = "cases:index";

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ── 記憶體後援 (本機無 KV 時使用) ──
// 掛在 globalThis 上，確保開發模式下 Route Handler 與 Server Component
// 這些分開打包的模組實例共用同一份資料 (正式環境走 KV，不會用到此後援)。
const memStore: Map<string, Case> = ((
  globalThis as unknown as { __sbCasesMem?: Map<string, Case> }
).__sbCasesMem ??= new Map<string, Case>());

const PAY_STATUSES: PartnerPayStatus[] = ["unpaid", "deposit", "paid"];

// ── 清理 / 補齊 (防止壞資料，並相容缺欄位的舊資料) ──
function toAmount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  // 金額取整數、擋掉負值與離譜大數 (10 億)
  return Math.min(Math.max(Math.round(n), 0), 1_000_000_000);
}

function sanitizePartnerCosts(raw: unknown): PartnerCost[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((p) => {
    const amount = toAmount(p?.amount);
    return {
      id: String(p?.id || nanoid(10)),
      partnerName: String(p?.partnerName ?? "").slice(0, 100),
      role: String(p?.role ?? "").slice(0, 100),
      amount,
      // 已付金額不得超過應付金額 (舊資料缺欄位時補 0)
      paidAmount: Math.min(toAmount(p?.paidAmount), amount),
      payStatus: PAY_STATUSES.includes(p?.payStatus) ? p.payStatus : "unpaid",
    };
  });
}

function migrateCase(raw: Case | null): Case | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    name: String(raw.name ?? "").slice(0, 300),
    quoteId: String(raw.quoteId ?? ""),
    totalAmount: toAmount(raw.totalAmount),
    receivedAmount: toAmount(raw.receivedAmount),
    withholdBusinessTax: Boolean(raw.withholdBusinessTax),
    withholdIncomeTax: Boolean(raw.withholdIncomeTax),
    partnerCosts: sanitizePartnerCosts(raw.partnerCosts),
    note: String(raw.note ?? "").slice(0, 5000),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

/** 僅取表單允許的欄位，並清理內容 */
function cleanInput(input: CaseInput): CaseInput {
  return {
    name: String(input?.name ?? "").slice(0, 300),
    quoteId: String(input?.quoteId ?? ""),
    totalAmount: toAmount(input?.totalAmount),
    receivedAmount: toAmount(input?.receivedAmount),
    withholdBusinessTax: Boolean(input?.withholdBusinessTax),
    withholdIncomeTax: Boolean(input?.withholdIncomeTax),
    partnerCosts: sanitizePartnerCosts(input?.partnerCosts),
    note: String(input?.note ?? "").slice(0, 5000),
  };
}

/** 建立新案件 */
export async function createCase(input: CaseInput): Promise<Case> {
  const now = new Date().toISOString();
  const record: Case = {
    ...cleanInput(input),
    id: nanoid(10),
    createdAt: now,
    updatedAt: now,
  };

  if (KV_ENABLED) {
    await kv.set(CASE_KEY(record.id), record);
    await kv.zadd(CASE_INDEX_KEY, { score: Date.now(), member: record.id });
  } else {
    memStore.set(record.id, record);
  }
  return record;
}

/** 讀取單筆案件 */
export async function getCase(id: string): Promise<Case | null> {
  noStore();
  if (!id) return null;
  if (KV_ENABLED) {
    const record = await kv.get<Case>(CASE_KEY(id));
    return migrateCase(record ?? null);
  }
  return migrateCase(memStore.get(id) ?? null);
}

/** 更新案件 (保留 id / createdAt) */
export async function updateCase(
  id: string,
  input: CaseInput,
): Promise<Case | null> {
  const existing = await getCase(id);
  if (!existing) return null;

  const updated: Case = {
    ...existing,
    ...cleanInput(input),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (KV_ENABLED) {
    await kv.set(CASE_KEY(id), updated);
    await kv.zadd(CASE_INDEX_KEY, { score: Date.now(), member: id });
  } else {
    memStore.set(id, updated);
  }
  return updated;
}

/** 刪除案件 */
export async function deleteCase(id: string): Promise<boolean> {
  const existing = await getCase(id);
  if (!existing) return false;

  if (KV_ENABLED) {
    await kv.del(CASE_KEY(id));
    await kv.zrem(CASE_INDEX_KEY, id);
  } else {
    memStore.delete(id);
  }
  return true;
}

/** 取得所有案件 (新 → 舊)，後台初始載入與列表使用 */
export async function getAllCases(): Promise<Case[]> {
  noStore();
  if (KV_ENABLED) {
    const ids = await kv.zrange<string[]>(CASE_INDEX_KEY, 0, -1, { rev: true });
    if (!ids || ids.length === 0) return [];
    const records = await Promise.all(ids.map((id) => getCase(id)));
    return records.filter((c): c is Case => Boolean(c));
  }
  return Array.from(memStore.values())
    .map((c) => migrateCase(c))
    .filter((c): c is Case => Boolean(c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export { KV_ENABLED };
