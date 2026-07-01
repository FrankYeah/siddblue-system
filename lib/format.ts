import type { Quote, QuoteInput, QuoteItem } from "./types";

// ─────────────────────────────────────────────────────────────
//  共用格式化工具 (client + server 皆可安全 import，
//  不得引入 @vercel/kv 等 server-only 模組)
// ─────────────────────────────────────────────────────────────

/** 加總所有項目費用 */
export function itemsTotal(items: QuoteItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
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
    summaryText: q.summaryText,
    paymentInfo: q.paymentInfo,
    processSteps: q.processSteps,
    maintenanceRules: q.maintenanceRules,
    supplementaryNotes: q.supplementaryNotes,
    companyName: q.companyName,
    taxId: q.taxId,
  };
}
