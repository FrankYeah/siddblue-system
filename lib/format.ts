import type { Quote, QuoteInput, QuoteItem } from "./types";

// ─────────────────────────────────────────────────────────────
//  共用格式化工具 (client + server 皆可安全 import，
//  不得引入 @vercel/kv 等 server-only 模組)
// ─────────────────────────────────────────────────────────────

/** 加總所有項目費用 */
export function itemsTotal(items: QuoteItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
}

/** 台灣營業稅率 */
export const TAX_RATE = 0.05;

/** 報價金額分解 (未稅小計 / 稅金 / 最終應付) */
export interface QuoteTotals {
  /** 未稅小計 (= 各項目金額加總) */
  subtotal: number;
  /** 營業稅 (含稅時 = 小計 × 5%，四捨五入至整數；未稅時為 0) */
  tax: number;
  /** 最終應付總計 (含稅時 = 小計 + 稅金；未稅時 = 小計) */
  grandTotal: number;
  /** 是否含稅 */
  taxInclusive: boolean;
}

/** 依「含稅 / 未稅」計算報價金額分解 */
export function computeTotals(
  items: QuoteItem[],
  taxInclusive: boolean,
): QuoteTotals {
  const subtotal = itemsTotal(items);
  const tax = taxInclusive ? Math.round(subtotal * TAX_RATE) : 0;
  return { subtotal, tax, grandTotal: subtotal + tax, taxInclusive };
}

/**
 * ISO 時間 → 台北時間字串（全站唯一的日期時間格式化入口）。
 *
 * 手動 UTC+8、只用 getUTC*、不經 Intl/toLocaleString：
 * SSR（伺服器多為 UTC）與客戶端的輸出「逐字元一致」，
 * 避免 hydration mismatch（各板過去自刻 fmt、時區策略不一，正是這類 bug 的溫床）。
 */
export function fmtDateTimeTW(iso: string, opts?: { year?: boolean }): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const md = `${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())}`;
  const hm = `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
  return opts?.year ? `${t.getUTCFullYear()}/${md} ${hm}` : `${md} ${hm}`;
}

/** ISO 時間 → 台北日期 "YYYY/MM/DD"（同上，SSR-safe） */
export function fmtDateTW(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}/${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())}`;
}

/** 千分位金額 (無小數) */
export function formatCurrency(amount: number): string {
  const n = Number(amount) || 0;
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 0 });
}

/** 帶 NT$ 前綴的金額 */
export function formatNT(amount: number): string {
  return `NT$ ${formatCurrency(amount)}`;
}

/** 從完整報價單取出可編輯的表單欄位 (去除系統欄位) */
export function quoteToInput(q: Quote): QuoteInput {
  return {
    clientName: q.clientName,
    quoteDate: q.quoteDate,
    validPeriod: q.validPeriod,
    items: q.items,
    projectBrief: q.projectBrief,
    summaryText: q.summaryText,
    taxInclusive: q.taxInclusive,
    paymentInfo: q.paymentInfo,
    processSteps: q.processSteps,
    maintenanceRules: q.maintenanceRules,
    supplementaryNotes: q.supplementaryNotes,
    companyName: q.companyName,
    taxId: q.taxId,
  };
}
