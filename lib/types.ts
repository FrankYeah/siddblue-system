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

/** 報價單狀態 (生命週期) */
export type QuoteStatus =
  | "draft" // 草稿
  | "sent" // 已發送
  | "confirmed"; // 已確認

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
  /** 是否含 5% 營業稅 (true=項目金額另加 5% 稅金；false=未稅) */
  taxInclusive: boolean;
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

  /** 報價單狀態 (草稿 / 已發送 / 已確認)，系統管理，經列表切換或客戶確認更新 */
  status: QuoteStatus;

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
  /** 最終應付金額 (含稅則為含稅總計) */
  total: number;
  status: QuoteStatus;
  updatedAt: string;
  acceptedAt?: string;
}

/** 表單輸入 (不含系統欄位、狀態與客戶確認狀態) */
export type QuoteInput = Omit<
  Quote,
  "id" | "createdAt" | "updatedAt" | "acceptedAt" | "acceptedBy" | "status"
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
export type TodoBucket = "now" | "later" | "longterm"; // 🔥 立即處理 / ⏳ 稍後再說 / 🎯 長期要做的事

/** 待辦任務 (極簡：僅純文字標題) */
export interface Todo {
  id: string;
  title: string;
}

/** 待辦清單：依分區分組 */
export type TodoBoard = Record<TodoBucket, Todo[]>;

// ═════════════════════════════════════════════════════════════
//  知識庫 (Knowledge Base) — 取代 Apple Notes
//  個人創業筆記 / 合夥人知識共享 / 客戶諮詢紀錄
// ═════════════════════════════════════════════════════════════

/** 筆記類型 */
export type NoteType =
  | "general" // 一般筆記
  | "consulting"; // 諮詢紀錄

/** 知識庫筆記 */
export interface Note {
  /** 唯一識別碼 (nanoid 10) */
  id: string;
  /** 標題 */
  title: string;
  /** 內容 (支援 Markdown) */
  content: string;
  /** 標籤 (如「一次性諮詢」「創業想法」) */
  tags: string[];
  /** 類型：一般筆記 / 諮詢紀錄 */
  type: NoteType;
  /** 是否對外公開共享 */
  isShared: boolean;
  /** 對外連結專屬 token (避免以 id 被猜到)，建立時產生、終生不變 */
  shareToken: string;
  /** 建立時間 (ISO 字串) */
  createdAt: string;
  /** 最後更新時間 (ISO 字串) */
  updatedAt: string;
}

/** 後台列表使用的精簡摘要 (不含 content) */
export interface NoteSummary {
  id: string;
  title: string;
  tags: string[];
  type: NoteType;
  isShared: boolean;
  updatedAt: string;
}

/** 表單輸入 (不含系統欄位 id / shareToken / createdAt / updatedAt) */
export interface NoteInput {
  title: string;
  content: string;
  tags: string[];
  type: NoteType;
  isShared: boolean;
}

// ═════════════════════════════════════════════════════════════
//  案件與財務管理 (Case & Finance Management)
//  應收帳款 (AR) + 合作夥伴費用 (AP) + 稅務代扣 → 專案淨利
// ═════════════════════════════════════════════════════════════

/** 案件型態：自己接的案 / 幫朋友開發票 (代開發票才有稅務代扣) */
export type CaseType =
  | "own" // 我接的案子
  | "invoice"; // 幫朋友開發票

/** 合作夥伴款項的付款狀態 */
export type PartnerPayStatus =
  | "unpaid" // 未支付
  | "deposit" // 已付訂金
  | "paid"; // 已結清

/**
 * 單筆收/付款紀錄 (Payment Ledger)。
 * 取代單一數字欄位，記錄每一筆實際入帳/出帳的時間點，
 * 可回答「這筆錢是什麼時候付的」，也是月報/年報的資料地基。
 */
export interface PaymentEntry {
  id: string;
  /** 日期 (YYYY-MM-DD) */
  date: string;
  /** 金額 */
  amount: number;
  /** 備註 (如：頭期款、訂金、尾款) */
  note: string;
}

/** 單筆合作夥伴費用 (外包成本，Accounts Payable) */
export interface PartnerCost {
  id: string;
  /** 夥伴名稱 (可為人脈庫聯絡人名稱快照，或自由填寫的名單外人選) */
  partnerName: string;
  /** 關聯的人脈庫聯絡人 id (空字串 = 未關聯/名單外)，供「連過去看詳情」精準對應 */
  contactId: string;
  /** 負責項目 (如：前端、設計) */
  role: string;
  /** 應付金額 */
  amount: number;
  /** 已付金額 (衍生值 = payments 加總；「已結清」時視同全額，伺服器端計算，不可由前端覆寫) */
  paidAmount: number;
  /** 付款紀錄 (逐筆日期＋金額＋備註，如訂金/分期) */
  payments: PaymentEntry[];
  /** 付款狀態 */
  payStatus: PartnerPayStatus;
}

/** 案件 (專案財務管理的核心實體) */
export interface Case {
  /** 唯一識別碼 (nanoid 10) */
  id: string;
  /** 專案名稱 */
  name: string;
  /** 案件型態 (我接的案子 / 幫朋友開發票)；只有代開發票才有稅務代扣 */
  caseType: CaseType;
  /** 關聯的報價單 id (空字串 = 未關聯)；關聯時自動帶入名稱與總金額(快照，之後可自行修改) */
  quoteId: string;
  /** 總應收金額 (Accounts Receivable) */
  totalAmount: number;
  /** 已收款 (衍生值 = receivedPayments 加總，伺服器端計算，不可由前端覆寫) */
  receivedAmount: number;
  /** 收款紀錄 (逐筆日期＋金額＋備註，如頭期款/尾款) */
  receivedPayments: PaymentEntry[];
  /** 代扣 5% 營業稅 (僅 caseType = invoice) */
  withholdBusinessTax: boolean;
  /** 代收代扣 3% 營所稅 (僅 caseType = invoice) */
  withholdIncomeTax: boolean;
  /** 合作夥伴費用 (外包成本) */
  partnerCosts: PartnerCost[];
  /** 備註 */
  note: string;
  /** 建立時間 (ISO 字串) */
  createdAt: string;
  /** 最後更新時間 (ISO 字串) */
  updatedAt: string;
}

/** 表單輸入 (不含系統欄位 id / createdAt / updatedAt) */
export type CaseInput = Omit<Case, "id" | "createdAt" | "updatedAt">;

// ═════════════════════════════════════════════════════════════
//  人脈資料庫 (Connections CRM)
// ═════════════════════════════════════════════════════════════

/** 評級 (熟悉度 / 能力值 / 價格 / 喜好度)；unknown = 不確定/未填 */
export type ContactLevel = "high" | "medium" | "low" | "unknown"; // 高 / 中 / 低 / 不確定

/** 就業狀態 (對齊 Notion 人脈庫既有分類) */
export type ContactStatus =
  | "employed" // 就業
  | "freelance" // 接案
  | "startup" // 創業
  | "student" // 學生
  | "unknown"; // 未知/未填

/** 合作方向分類 */
export type CooperationType =
  | "project" // 專案合作 (外包、合夥)
  | "industry"; // 業界合作 (網紅、互惠合作)

/** 人脈聯絡人 */
export interface Contact {
  /** 唯一識別碼 (nanoid 10) */
  id: string;
  /** 姓名 */
  name: string;
  /** 職業別 (如：Notion、前端工程師) */
  profession: string;
  /** 聯絡方式 (Line / IG / Email) */
  contactInfo: string;
  /** 網址 (作品集、社群…) */
  url: string;
  /** 熟悉度 */
  familiarity: ContactLevel;
  /** 喜好度 */
  liking: ContactLevel;
  /** 能力值 */
  ability: ContactLevel;
  /** 價格 */
  price: ContactLevel;
  /** 狀態 (就業 / 接案 / 創業 / 學生) */
  status: ContactStatus;
  /** 合作方向 (專案合作 / 業界合作) */
  cooperationType: CooperationType;
  /** 匯款資訊 (銀行/帳號，支付外包款用) */
  transferInfo: string;
  /** 備註 */
  note: string;
  /** 建立時間 (ISO 字串) */
  createdAt: string;
  /** 最後更新時間 (ISO 字串) */
  updatedAt: string;
}

/** 表單輸入 (不含系統欄位 id / createdAt / updatedAt) */
export type ContactInput = Omit<Contact, "id" | "createdAt" | "updatedAt">;
