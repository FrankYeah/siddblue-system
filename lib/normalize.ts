import type {
  ProcessStep,
  ProjectBrief,
  QuoteInput,
} from "./types";
import { DEFAULT_PROJECT_BRIEF } from "./defaults";

/** 將流程步驟正規化為 ProcessStep[]，並相容舊格式 (string[]) */
export function normalizeProcessSteps(input: unknown): ProcessStep[] {
  if (!Array.isArray(input)) return [];
  return input.map((step): ProcessStep => {
    // 舊格式：純字串
    if (typeof step === "string") {
      return { title: "", description: step, links: [] };
    }
    const s = step as Partial<ProcessStep>;
    return {
      title: String(s.title ?? ""),
      description: String(s.description ?? ""),
      links: Array.isArray(s.links)
        ? s.links.map((l) => ({
            label: String(l?.label ?? ""),
            url: String(l?.url ?? ""),
          }))
        : [],
    };
  });
}

/** 正規化專案需求整理 */
export function normalizeProjectBrief(input: unknown): ProjectBrief {
  const b = (input ?? {}) as Partial<ProjectBrief>;
  return {
    serviceDescription: String(
      b.serviceDescription ?? DEFAULT_PROJECT_BRIEF.serviceDescription,
    ),
    siteStyle: String(b.siteStyle ?? DEFAULT_PROJECT_BRIEF.siteStyle),
    sitePages: String(b.sitePages ?? DEFAULT_PROJECT_BRIEF.sitePages),
  };
}

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
    projectBrief: normalizeProjectBrief(input.projectBrief),
    summaryText: String(input.summaryText ?? ""),
    taxInclusive: Boolean(input.taxInclusive),
    paymentInfo: String(input.paymentInfo ?? ""),
    processSteps: normalizeProcessSteps(input.processSteps),
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
