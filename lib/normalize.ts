import type { QuoteInput } from "./types";

/** 清理 / 補齊報價單輸入，確保型別正確 (server 端使用) */
export function normalizeQuoteInput(input: QuoteInput): QuoteInput {
  return {
    clientName: String(input.clientName ?? ""),
    quoteDate: String(input.quoteDate ?? ""),
    validPeriod: String(input.validPeriod ?? ""),
    items: Array.isArray(input.items)
      ? input.items.map((it) => ({
          category: String(it.category ?? ""),
          description: String(it.description ?? ""),
          duration: String(it.duration ?? ""),
          amount: Number(it.amount) || 0,
        }))
      : [],
    summaryText: String(input.summaryText ?? ""),
    paymentInfo: String(input.paymentInfo ?? ""),
    processSteps: Array.isArray(input.processSteps)
      ? input.processSteps.map(String)
      : [],
    maintenanceRules: Array.isArray(input.maintenanceRules)
      ? input.maintenanceRules.map((r) => ({
          level: String(r.level ?? ""),
          description: String(r.description ?? ""),
          amount: String(r.amount ?? ""),
        }))
      : [],
    supplementaryNotes: Array.isArray(input.supplementaryNotes)
      ? input.supplementaryNotes.map(String)
      : [],
    companyName: String(input.companyName ?? ""),
    taxId: String(input.taxId ?? ""),
  };
}
