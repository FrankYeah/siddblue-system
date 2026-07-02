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

/** 流程步驟中的連結 (雲端資料夾、設計稿參考等) */
export interface ProcessLink {
  /** 顯示文字，如「雲端資料夾」 */
  label: string;
  /** 連結網址 (可留空，事後再貼) */
  url: string;
}

/** 流程步驟 (階段標題 + 說明 + 可選連結) */
export interface ProcessStep {
  /** 階段名稱，如「網站素材」 */
  title: string;
  /** 說明 (支援多行) */
  description: string;
  /** 相關連結 (雲端資料夾、設計稿…) */
  links: ProcessLink[];
}

/** 專案需求整理 (初次討論所聽到的需求與網站設定) */
export interface ProjectBrief {
  /** 服務說明 (製作網站目的、目標、導流方式…) */
  serviceDescription: string;
  /** 網站風格 (如：未定 / 白、木、金) */
  siteStyle: string;
  /** 網站頁面 (客製化網站的頁面結構，支援多行) */
  sitePages: string;
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
  /** 專案需求整理 (初次討論的需求與網站設定) */
  projectBrief: ProjectBrief;
  /** 總價與款項特殊備註 (老朋友折讓、未稅/含稅、頭期款比例等) */
  summaryText: string;
  /** 付款資訊 (預設帶入，可修改) */
  paymentInfo: string;
  /** 流程說明 (階段 + 說明 + 連結，可動態增刪) */
  processSteps: ProcessStep[];
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

  // ── 客戶線上確認 (規格確認流程) ──
  /** 客戶確認接受報價的時間 (ISO 字串)，未確認則為空 */
  acceptedAt?: string;
  /** 確認人姓名 */
  acceptedBy?: string;
}

/** 後台列表使用的精簡摘要 */
export interface QuoteSummary {
  id: string;
  clientName: string;
  quoteDate: string;
  total: number;
  updatedAt: string;
  acceptedAt?: string;
}

/** 表單輸入 (不含系統欄位與客戶確認狀態) */
export type QuoteInput = Omit<
  Quote,
  "id" | "createdAt" | "updatedAt" | "acceptedAt" | "acceptedBy"
>;

// ═════════════════════════════════════════════════════════════
//  創作者工作區 (Creator Workspace)
// ═════════════════════════════════════════════════════════════

/** 寫作靈感看板的欄位狀態 */
export type InspirationStatus =
  | "idea" // 💡 靈感池
  | "newsletter" // 📰 長文電子報
  | "shortvideo" // 🎬 短影片
  | "archived"; // 📦 已封存

/** 靈感卡片 */
export interface Inspiration {
  id: string;
  title: string;
  /** 內容 (支援多行 / 基本 Markdown) */
  content: string;
  updatedAt: string;
}

/** 靈感看板：依欄位分組，陣列順序即卡片顯示順序 */
export type InspirationBoard = Record<InspirationStatus, Inspiration[]>;

/** 待辦清單分區 */
export type TodoBucket = "now" | "later"; // 🔥 立即處理 / ⏳ 稍後再說

/** 待辦任務 (極簡：僅純文字標題) */
export interface Todo {
  id: string;
  title: string;
}

/** 待辦清單：依分區分組 */
export type TodoBoard = Record<TodoBucket, Todo[]>;
