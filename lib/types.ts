// ─────────────────────────────────────────────────────────────
//  報價單資料型別定義 (Data Schema)
// ─────────────────────────────────────────────────────────────

/** 報價項目 (Line Item) */
export interface QuoteItem {
  /** 功能名稱 */
  category: string;
  /** 功能說明 (支援多行) */
  description: string;
  /** 工時 (天數或月數，允許文字如「3 天」「1 個月」) */
  duration: string;
  /** 費用 (數字，未稅或含稅由 summaryText 說明) */
  amount: number;
}

/** 維護費估價定義 (大 / 小 / 微調整) */
export interface MaintenanceRule {
  /** 級距名稱，如「大調整」 */
  level: string;
  /** 說明 */
  description: string;
  /** 金額或級距 (允許區間文字，如「5,000 - 10,000 元」) */
  amount: string;
}

/** 完整報價單 */
export interface Quote {
  /** 唯一識別碼 */
  id: string;
  /** 客戶名稱 / 專案名稱 */
  clientName: string;
  /** 報價日期 (YYYY-MM-DD) */
  quoteDate: string;
  /** 有效期限 */
  validPeriod: string;
  /** 報價項目陣列 */
  items: QuoteItem[];
  /** 總價與款項特殊備註 (老朋友折讓、未稅/含稅、頭期款比例等) */
  summaryText: string;
  /** 付款資訊 (預設帶入，可修改) */
  paymentInfo: string;
  /** 流程說明 (可動態增刪) */
  processSteps: string[];
  /** 維護費估價定義 */
  maintenanceRules: MaintenanceRule[];
  /** 補充說明 (可動態增刪) */
  supplementaryNotes: string[];

  // ── 公司抬頭資訊 (可覆寫，預設為西打藍) ──
  companyName: string;
  taxId: string;

  /** 建立時間 (ISO 字串) */
  createdAt: string;
  /** 最後更新時間 (ISO 字串) */
  updatedAt: string;
}

/** 後台列表使用的精簡摘要 */
export interface QuoteSummary {
  id: string;
  clientName: string;
  quoteDate: string;
  total: number;
  updatedAt: string;
}

/** 表單輸入 (尚未含系統欄位) */
export type QuoteInput = Omit<Quote, "id" | "createdAt" | "updatedAt">;
