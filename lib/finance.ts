import type { Case, PartnerCost } from "./types";

// ─────────────────────────────────────────────────────────────
//  案件財務計算 (client + server 共用，
//  不得引入 @vercel/kv 等 server-only 模組)
//
//  淨利公式：
//    實際淨利 = 總應收金額 − 代扣稅務 − 所有合作夥伴費用
//    代扣稅務 = 總應收 × 5% (營業稅，開關) + 總應收 × 3% (營所稅，開關)
//  稅金各自四捨五入至整數 (與報價單營業稅計算慣例一致)。
// ─────────────────────────────────────────────────────────────

/** 代扣營業稅率 (5%) */
export const BUSINESS_TAX_RATE = 0.05;
/** 代扣營所稅率 (3%) */
export const INCOME_TAX_RATE = 0.03;

/** 案件財務分解 (由 computeCaseFinance 計算，不落地儲存) */
export interface CaseFinance {
  /** 總應收金額 */
  totalAmount: number;
  /** 已收款 */
  receivedAmount: number;
  /** 未收款餘額 = 總應收 − 已收款 */
  unpaidBalance: number;
  /** 代扣 5% 營業稅 (未開啟為 0) */
  businessTax: number;
  /** 代扣 3% 營所稅 (未開啟為 0) */
  incomeTax: number;
  /** 代扣稅務合計 */
  taxTotal: number;
  /** 合作夥伴費用合計 (外包成本) */
  partnerTotal: number;
  /** 已支付給夥伴的金額 (已結清視同全額 + 其餘列的已付金額) */
  partnerPaid: number;
  /** 尚未結清的夥伴費用 = 各列「應付 − 已付」(已結清列為 0)，供催付參考 */
  partnerOutstanding: number;
  /** 實際淨利 = 總應收 − 代扣稅務 − 夥伴費用合計 */
  netProfit: number;
}

/** 夥伴費用加總 */
export function partnerCostsTotal(costs: PartnerCost[]): number {
  return costs.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

/** 單筆夥伴費用「已付金額」(已結清視同付滿全額；其餘依付款紀錄加總，不超過應付金額) */
export function partnerCostPaid(p: PartnerCost): number {
  const amount = Number(p.amount) || 0;
  if (p.payStatus === "paid") return amount;
  return Math.min(Number(p.paidAmount) || 0, amount);
}

/** 依案件欄位計算完整財務分解 (唯一計算入口，前後端一致) */
export function computeCaseFinance(
  c: Pick<
    Case,
    | "totalAmount"
    | "receivedAmount"
    | "withholdBusinessTax"
    | "withholdIncomeTax"
    | "partnerCosts"
  >,
): CaseFinance {
  const totalAmount = Number(c.totalAmount) || 0;
  const receivedAmount = Number(c.receivedAmount) || 0;
  const businessTax = c.withholdBusinessTax
    ? Math.round(totalAmount * BUSINESS_TAX_RATE)
    : 0;
  const incomeTax = c.withholdIncomeTax
    ? Math.round(totalAmount * INCOME_TAX_RATE)
    : 0;
  const partnerTotal = partnerCostsTotal(c.partnerCosts);
  let partnerPaid = 0;
  let partnerOutstanding = 0;
  for (const p of c.partnerCosts) {
    const amount = Number(p.amount) || 0;
    const paid = partnerCostPaid(p);
    partnerPaid += paid;
    partnerOutstanding += amount - paid;
  }
  const taxTotal = businessTax + incomeTax;
  return {
    totalAmount,
    receivedAmount,
    unpaidBalance: totalAmount - receivedAmount,
    businessTax,
    incomeTax,
    taxTotal,
    partnerTotal,
    partnerPaid,
    partnerOutstanding,
    netProfit: totalAmount - taxTotal - partnerTotal,
  };
}

/** 待付某夥伴的其中一個案件的應付餘額 */
export interface PartnerDueItem {
  caseId: string;
  caseName: string;
  outstanding: number;
}

/** 跨案件彙總的「待付夥伴款」(Accounts Payable 總覽) */
export interface PartnerDue {
  /** 分組鍵：有 contactId 用它，否則用正規化後的姓名 (name: 開頭) */
  key: string;
  /** 關聯的人脈庫聯絡人 id ("" = 名單外自訂) */
  contactId: string;
  /** 顯示用夥伴名稱 */
  partnerName: string;
  /** 此夥伴橫跨所有案件的應付總額 */
  totalOutstanding: number;
  /** 各案件的應付明細 (金額大→小) */
  items: PartnerDueItem[];
}

/**
 * 彙總所有案件中「尚未結清」的合作夥伴費用，依夥伴分組
 * (同 contactId 視為同一人；未關聯人脈庫則以姓名分組)。
 * 供案件管理頁「💸 待付夥伴款」總覽使用，金額大→小排序。
 */
export function collectPartnerDues(cases: Case[]): PartnerDue[] {
  const map = new Map<string, PartnerDue>();
  for (const c of cases) {
    for (const p of c.partnerCosts) {
      const amount = Number(p.amount) || 0;
      const outstanding = amount - partnerCostPaid(p);
      if (outstanding <= 0) continue;
      const name = p.partnerName.trim() || "（未命名夥伴）";
      const key = p.contactId || `name:${name.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalOutstanding += outstanding;
        // 同一夥伴在同一案件內可能有多筆費用列 (如多次追加設計費)，合併為一筆案件明細
        const sameCase = existing.items.find((i) => i.caseId === c.id);
        if (sameCase) sameCase.outstanding += outstanding;
        else {
          existing.items.push({
            caseId: c.id,
            caseName: c.name || "（未命名案件）",
            outstanding,
          });
        }
      } else {
        map.set(key, {
          key,
          contactId: p.contactId,
          partnerName: name,
          totalOutstanding: outstanding,
          items: [
            {
              caseId: c.id,
              caseName: c.name || "（未命名案件）",
              outstanding,
            },
          ],
        });
      }
    }
  }
  return Array.from(map.values())
    .map((d) => ({
      ...d,
      items: d.items.sort((a, b) => b.outstanding - a.outstanding),
    }))
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}
