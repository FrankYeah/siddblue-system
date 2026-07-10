import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Case,
  CaseInput,
  CaseType,
  PartnerCost,
  PartnerPayStatus,
  PaymentEntry,
} from "./types";

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
const CASE_TYPES: CaseType[] = ["own", "invoice"];

// ── 清理 / 補齊 (防止壞資料，並相容缺欄位的舊資料) ──
function toAmount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  // 金額取整數、擋掉負值與離譜大數 (10 億)
  return Math.min(Math.max(Math.round(n), 0), 1_000_000_000);
}

/** 日期清理：非法/空值一律退回 fallbackDate (YYYY-MM-DD) */
function toDateStr(raw: unknown, fallbackDate: string): string {
  const s = String(raw ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallbackDate;
}

/** 結案時間清理：非法值一律視為「未結案」(undefined)，避免壞資料卡在已結案狀態 */
function sanitizeClosedAt(raw: unknown): string | undefined {
  if (!raw) return undefined;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function sanitizePaymentEntries(
  raw: unknown,
  fallbackDate: string,
): PaymentEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((e) => ({
    id: String(e?.id || nanoid(10)),
    date: toDateStr(e?.date, fallbackDate),
    amount: toAmount(e?.amount),
    note: String(e?.note ?? "").slice(0, 200),
  }));
}

function paymentsTotal(entries: PaymentEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * 合作夥伴費用：payments 為新的收付款歷程來源，paidAmount 一律由此加總衍生。
 * 相容舊資料 —— 曾以單一「已付金額」記錄、尚無逐筆紀錄時，
 * 自動轉為一筆「既有已付金額」的歷史快照，確保金額不會被這次改版清零。
 */
function sanitizePartnerCosts(
  raw: unknown,
  fallbackDate: string,
): PartnerCost[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((p) => {
    const amount = toAmount(p?.amount);
    let payments = sanitizePaymentEntries(p?.payments, fallbackDate);
    if (payments.length === 0) {
      const legacyPaid = toAmount(p?.paidAmount);
      if (legacyPaid > 0) {
        payments = [
          {
            id: nanoid(10),
            date: fallbackDate,
            amount: legacyPaid,
            note: "既有已付金額（系統轉入）",
          },
        ];
      }
    }
    return {
      id: String(p?.id || nanoid(10)),
      partnerName: String(p?.partnerName ?? "").slice(0, 100),
      contactId: String(p?.contactId ?? ""),
      role: String(p?.role ?? "").slice(0, 100),
      amount,
      payments,
      // 已付金額不得超過應付金額，一律由 payments 加總衍生 (不可由前端覆寫)
      paidAmount: Math.min(paymentsTotal(payments), amount),
      payStatus: PAY_STATUSES.includes(p?.payStatus) ? p.payStatus : "unpaid",
    };
  });
}

/**
 * 收款紀錄：receivedPayments 為新的收付款歷程來源，receivedAmount 一律由此加總衍生。
 * 相容舊資料 —— 曾以單一「已收款」記錄、尚無逐筆紀錄時，
 * 自動轉為一筆「既有已收款」的歷史快照，確保金額不會被這次改版清零。
 */
function deriveReceived(
  rawReceivedPayments: unknown,
  legacyReceivedAmount: unknown,
  fallbackDate: string,
): { receivedAmount: number; receivedPayments: PaymentEntry[] } {
  let receivedPayments = sanitizePaymentEntries(
    rawReceivedPayments,
    fallbackDate,
  );
  if (receivedPayments.length === 0) {
    const legacy = toAmount(legacyReceivedAmount);
    if (legacy > 0) {
      receivedPayments = [
        {
          id: nanoid(10),
          date: fallbackDate,
          amount: legacy,
          note: "既有已收款（系統轉入）",
        },
      ];
    }
  }
  return {
    receivedAmount: paymentsTotal(receivedPayments),
    receivedPayments,
  };
}

function migrateCase(raw: Case | null): Case | null {
  if (!raw) return null;
  // 舊資料無 caseType → 視為「我接的案子」；own 型不該有稅務代扣
  const caseType: CaseType = CASE_TYPES.includes(raw.caseType)
    ? raw.caseType
    : "own";
  const isInvoice = caseType === "invoice";
  const createdAt = String(raw.createdAt || new Date().toISOString());
  const fallbackDate = createdAt.slice(0, 10);
  const { receivedAmount, receivedPayments } = deriveReceived(
    raw.receivedPayments,
    raw.receivedAmount,
    fallbackDate,
  );
  const withholdBusinessTax = isInvoice && Boolean(raw.withholdBusinessTax);
  const withholdIncomeTax = isInvoice && Boolean(raw.withholdIncomeTax);
  const hasWithholding = withholdBusinessTax || withholdIncomeTax;
  return {
    id: String(raw.id),
    name: String(raw.name ?? "").slice(0, 300),
    caseType,
    quoteId: String(raw.quoteId ?? ""),
    totalAmount: toAmount(raw.totalAmount),
    receivedAmount,
    receivedPayments,
    withholdBusinessTax,
    withholdIncomeTax,
    // 已提列稅金的旗標/註記只在有代扣稅務時才有意義，否則強制歸零
    taxPaid: hasWithholding && Boolean(raw.taxPaid),
    taxPaidNote: hasWithholding ? String(raw.taxPaidNote ?? "").slice(0, 500) : "",
    partnerCosts: sanitizePartnerCosts(raw.partnerCosts, fallbackDate),
    note: String(raw.note ?? "").slice(0, 5000),
    closedAt: sanitizeClosedAt(raw.closedAt),
    createdAt,
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

/** 僅取表單允許的欄位，並清理內容 */
function cleanInput(input: CaseInput): CaseInput {
  const caseType: CaseType = CASE_TYPES.includes(input?.caseType)
    ? input.caseType
    : "own";
  const isInvoice = caseType === "invoice";
  const today = new Date().toISOString().slice(0, 10);
  const { receivedAmount, receivedPayments } = deriveReceived(
    input?.receivedPayments,
    input?.receivedAmount,
    today,
  );
  // 稅務代扣只屬於「幫朋友開發票」型；own 型一律 false
  const withholdBusinessTax = isInvoice && Boolean(input?.withholdBusinessTax);
  const withholdIncomeTax = isInvoice && Boolean(input?.withholdIncomeTax);
  const hasWithholding = withholdBusinessTax || withholdIncomeTax;
  return {
    name: String(input?.name ?? "").slice(0, 300),
    caseType,
    quoteId: String(input?.quoteId ?? ""),
    totalAmount: toAmount(input?.totalAmount),
    receivedAmount,
    receivedPayments,
    withholdBusinessTax,
    withholdIncomeTax,
    // 已提列稅金的旗標/註記只在有代扣稅務時才有意義，否則強制歸零
    taxPaid: hasWithholding && Boolean(input?.taxPaid),
    taxPaidNote: hasWithholding
      ? String(input?.taxPaidNote ?? "").slice(0, 500)
      : "",
    partnerCosts: sanitizePartnerCosts(input?.partnerCosts, today),
    note: String(input?.note ?? "").slice(0, 5000),
    closedAt: sanitizeClosedAt(input?.closedAt),
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
    // mget 一次讀回全部，避免逐筆 get 的 N+1 round-trip
    const raw = await kv.mget<(Case | null)[]>(...ids.map(CASE_KEY));
    return raw
      .map((c) => migrateCase(c ?? null))
      .filter((c): c is Case => Boolean(c));
  }
  return Array.from(memStore.values())
    .map((c) => migrateCase(c))
    .filter((c): c is Case => Boolean(c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 完整覆寫案件資料 (備份還原用)：清空現有全部，寫入 snapshot 內容。
 * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
 */
export async function restoreCasesData(cases: Case[]): Promise<void> {
  if (KV_ENABLED) {
    const existingIds =
      (await kv.zrange<string[]>(CASE_INDEX_KEY, 0, -1)) ?? [];
    if (existingIds.length === 0 && cases.length === 0) return;
    // pipeline 一次送出「清空 + 重寫」：單一 HTTP 請求，
    // 避免逐筆 round-trip 在資料量大時觸發 serverless 超時、留下半空資料庫
    const pipeline = kv.pipeline();
    existingIds.forEach((id) => pipeline.del(CASE_KEY(id)));
    if (existingIds.length > 0) pipeline.del(CASE_INDEX_KEY);
    for (const c of cases) {
      pipeline.set(CASE_KEY(c.id), c);
      pipeline.zadd(CASE_INDEX_KEY, {
        score: new Date(c.updatedAt).getTime() || Date.now(),
        member: c.id,
      });
    }
    await pipeline.exec();
  } else {
    memStore.clear();
    cases.forEach((c) => memStore.set(c.id, c));
  }
}

export { KV_ENABLED };
