import type { MaintenanceRule, QuoteInput } from "./types";

// ─────────────────────────────────────────────────────────────
//  硬編碼企業預設資料 (Hardcoded Company Constants)
//  作為後台表單初始值，加速建立報價單
// ─────────────────────────────────────────────────────────────

/** 公司抬頭 */
export const COMPANY_NAME = "西打藍好內容有限公司";

/** 統一編號 */
export const COMPANY_TAX_ID = "93662829";

/** 公司英文 / 品牌識別 */
export const COMPANY_BRAND_EN = "Siddblue Studio";

/** 預設付款帳戶資訊 */
export const DEFAULT_PAYMENT_INFO = [
  "銀行：國泰世華銀行 (013) 基隆分行 (1243)",
  "帳號：1243-3500-9494",
  `戶名：${COMPANY_NAME}`,
].join("\n");

/** 預設維護估價標準 */
export const DEFAULT_MAINTENANCE_RULES: MaintenanceRule[] = [
  {
    level: "大調整",
    description: "整個樣式改變、重新排版，一個區塊層級的重大變動。",
    amount: "5,000 - 10,000 元 / 區塊",
  },
  {
    level: "小調整",
    description:
      "非整體樣式改變，約 1/3 - 1/2 區塊範圍的內容或版位調整。",
    amount: "2,000 - 3,000 元 / 區塊",
  },
  {
    level: "微調整",
    description:
      "更改文字、圖片、連結、顏色、大小，或小幅更動元素位置。",
    amount: "暫不收費",
  },
];

/** 預設流程說明 */
export const DEFAULT_PROCESS_STEPS: string[] = [
  "需求確認：討論並確認網站功能、頁面與規格範圍。",
  "報價與簽約：確認本報價單內容，支付頭期款後正式啟動。",
  "設計與製作：進行視覺設計與前後端開發，過程中提供進度確認。",
  "驗收與上線：完成後交付驗收，確認無誤後正式上線。",
  "教學與交付：提供網站操作說明，協助後續自主維護。",
];

/** 預設補充說明 */
export const DEFAULT_SUPPLEMENTARY_NOTES: string[] = [
  "網站完成的 10 天內，若有需要變更畫面、文字，可以不需收費調整。",
  "網站完成後，我會製作一段網站說明，未來可以自行調整顏色、簡單介面、部落格文字。",
];

/** 預設總價備註 */
export const DEFAULT_SUMMARY_TEXT =
  "以上金額為未稅價。老朋友專案折讓後之報價，簽約時支付 50% 頭期款，驗收上線後支付尾款 50%。";

/** 預設有效期限 */
export const DEFAULT_VALID_PERIOD = "報價日起 30 天內有效";

/** 一份全新的空白報價單 (帶入所有預設值) */
export function buildDefaultQuoteInput(): QuoteInput {
  const today = new Date().toISOString().slice(0, 10);
  return {
    clientName: "",
    quoteDate: today,
    validPeriod: DEFAULT_VALID_PERIOD,
    items: [
      { category: "", description: "", duration: "", amount: 0 },
    ],
    summaryText: DEFAULT_SUMMARY_TEXT,
    paymentInfo: DEFAULT_PAYMENT_INFO,
    processSteps: [...DEFAULT_PROCESS_STEPS],
    maintenanceRules: DEFAULT_MAINTENANCE_RULES.map((r) => ({ ...r })),
    supplementaryNotes: [...DEFAULT_SUPPLEMENTARY_NOTES],
    companyName: COMPANY_NAME,
    taxId: COMPANY_TAX_ID,
  };
}
