import { nanoid } from "nanoid";
import { createEntityStore } from "./entity-store";
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
//  儲存結構：
//    case:{id}      → 單筆案件 (JSON)
//    cases:index    → sorted set，member=id，score=updatedAt(ms)
//
//  金額 (totalAmount / receivedAmount / partnerCosts[].amount) 一律存數字；
//  未收款餘額、代扣稅額、淨利皆為衍生值 (lib/finance.ts 計算)，不落地。
//
//  CRUD 骨架（KV_ENABLED / 記憶體後援 / mget 批次讀 / pipeline 還原）
//  由 lib/entity-store.ts 工廠提供，本檔只負責純函式的清理與遷移。
// ─────────────────────────────────────────────────────────────

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

const store = createEntityStore<Case, CaseInput>({
  keyPrefix: "case",
  indexKey: "cases:index",
  memGlobalKey: "__sbCasesMem",
  migrate: migrateCase,
  cleanInput,
});

/** 建立新案件 */
export const createCase = store.create;
/** 讀取單筆案件 */
export const getCase = store.get;
/** 更新案件 (保留 id / createdAt) */
export const updateCase = store.update;
/** 刪除案件 */
export const deleteCase = store.remove;
/** 取得所有案件 (新 → 舊)，後台初始載入與列表使用 */
export const getAllCases = store.getAll;
/**
 * 完整覆寫案件資料 (備份還原用)：清空現有全部，寫入 snapshot 內容。
 * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
 */
export const restoreCasesData = store.restoreAll;

export const KV_ENABLED = store.KV_ENABLED;
