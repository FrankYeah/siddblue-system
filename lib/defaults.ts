import type {
  MaintenanceRule,
  ProcessStep,
  ProjectBrief,
  QuoteInput,
  QuoteItem,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  硬編碼企業預設資料 (Hardcoded Company Constants)
//  以「西打藍實際網站案報價單」為藍本，作為後台表單初始值，
//  加速建立報價單 — 通常只需修改頁面數量、風格與服務說明。
// ─────────────────────────────────────────────────────────────

/** 公司抬頭 */
export const COMPANY_NAME = "西打藍好內容有限公司";

/** 統一編號 */
export const COMPANY_TAX_ID = "93662829";

/** 公司英文 / 品牌識別 */
export const COMPANY_BRAND_EN = "Siddblue Studio";

/** 預設付款帳戶資訊 (帳號經確認為 1240-3500-9494；分行代碼為 1243) */
export const DEFAULT_PAYMENT_INFO = [
  "國泰世華銀行 (013) 基隆分行 (1243)",
  "帳號：1240-3500-9494",
  `統編：${COMPANY_TAX_ID}`,
  `戶名：${COMPANY_NAME}`,
].join("\n");

/**
 * 預設報價項目 — 網站案的標準組合。
 * 前 6 項為每案必備；後 3 項 (關鍵字 / 網站文 / 媒體文) 為偶爾加入，
 * 一併預填以省去重複輸入，不需要時直接刪除該列即可。
 */
export const DEFAULT_ITEMS: QuoteItem[] = [
  {
    category: "視覺風格",
    description: "規劃整體視覺風格、調性。",
    duration: "3 天",
    amount: 2000,
  },
  {
    category: "設計規範",
    description: "定義顏色功能與用途、字型與規格、中文字體。",
    duration: "2 天",
    amount: 3000,
  },
  {
    category: "網站畫面",
    description:
      "設計首頁、服務（買賣、回收、其他）、關於＋聯絡、產品、文章頁面「電腦版」畫面。",
    duration: "15 天",
    amount: 20000,
  },
  {
    category: "響應式設計",
    description:
      "設計首頁、服務（買賣、回收、其他）、關於＋聯絡、產品、文章頁面「手機版」畫面。",
    duration: "10 天",
    amount: 10000,
  },
  {
    category: "網站工程開發",
    description: "程式開發電腦版頁面。",
    duration: "18 天",
    amount: 25000,
  },
  {
    category: "響應式工程開發",
    description:
      "程式開發手機版頁面。\n※ 補充：電腦版為電腦螢幕看到的網站畫面；手機版為手機看到的網站畫面，兩者版面不同。",
    duration: "10 天",
    amount: 20000,
  },
  {
    category: "網站關鍵字",
    description: "SEO 關鍵字佈局表。",
    duration: "14 天",
    amount: 45000,
  },
  {
    category: "網站文",
    description:
      "8 篇 SEO 文，每篇包含企劃、採訪、撰文、編輯、上稿。後續會根據數據增修內容。（一篇約 5,000 元）",
    duration: "2 個月",
    amount: 40000,
  },
  {
    category: "媒體文",
    description:
      "4 篇部落文，分別來自不同部落客。會協助部落客的聯繫、撰文、採訪，以及上稿內容檢核。（一篇約 6,000 元）",
    duration: "1 個月",
    amount: 24000,
  },
];

/** 預設維護估價標準 */
export const DEFAULT_MAINTENANCE_RULES: MaintenanceRule[] = [
  {
    level: "大調整",
    description: "例如整個樣式改變、重新排版（一個區塊層級的重大變動）。",
    amount: "5,000 - 10,000 元 / 區塊",
  },
  {
    level: "小調整",
    description: "非整個樣式改變，約 1/3 - 1/2 區塊範圍的調整。",
    amount: "2,000 - 3,000 元 / 區塊",
  },
  {
    level: "微調整",
    description: "暫不收費：改文字、圖片、連結、顏色、大小、小幅更動元素位置。",
    amount: "暫不收費",
  },
];

/** 預設流程說明 (階段 + 說明 + 連結；連結預留位置供貼上雲端資料夾 / 設計稿) */
export const DEFAULT_PROCESS_STEPS: ProcessStep[] = [
  {
    title: "第一次會議討論",
    description:
      "1. 製作頁面數\n2. 頁面內容\n3. 其他需求\n會議後提供報價單，收款後開始執行。",
    links: [],
  },
  {
    title: "網站素材",
    description:
      "請協助整理網站可以使用的「圖像素材」、「影片素材」，放置於雲端資料夾。",
    links: [{ label: "雲端資料夾", url: "" }],
  },
  {
    title: "討論風格確認",
    description:
      "請團隊確認網站風格，包含：\n- 配色（白、木、金？）\n- 風格方向（如白淨的專業感、豐富的歷史感等）\n- 帶給人的情緒感受（溫暖的、專業的等）\n- 若有想參考的網站也可提供相關連結",
    links: [],
  },
  {
    title: "選定網站風格",
    description: "網站設計師提供適合的風格範例，確認後開始設計版面。",
    links: [],
  },
  {
    title: "準備網站資料",
    description: "請將資料放入「雲端資料夾－網站頁面文案」。",
    links: [{ label: "雲端資料夾－網站頁面文案", url: "" }],
  },
  {
    title: "第一版風格確認",
    description: "設計師先製作首頁版型，和你們討論調整，呈現參考如下：",
    links: [
      { label: "設計稿呈現 1", url: "" },
      { label: "設計稿呈現 2", url: "" },
    ],
  },
  {
    title: "後續製作",
    description:
      "首頁確認後，設計師往下製作其他頁，逐一和你們確認。設計稿都確認後，輪到網站工程師製作，並逐一交付測試，直至結案。",
    links: [],
  },
];

/** 預設補充說明 */
export const DEFAULT_SUPPLEMENTARY_NOTES: string[] = [
  "網站完成的 10 天內，若有需要更動畫面、文字，可以不需收費調整。",
  "網站完成後，我會製作一段網站說明，未來可以自行調整顏色、簡單介面、部落格文字。",
];

/** 預設專案需求整理 (每案填寫；頁面結構預填常用範本) */
export const DEFAULT_PROJECT_BRIEF: ProjectBrief = {
  serviceDescription: "",
  siteStyle: "未定",
  sitePages: [
    "客製化網站：",
    "首頁",
    "服務頁",
    "關於頁 + 聯絡頁",
    "產品頁",
    "文章總覽頁 + 文章內頁",
  ].join("\n"),
};

/** 預設總價備註 */
export const DEFAULT_SUMMARY_TEXT =
  "以上為網頁總價（未稅）。老朋友案子扣尾數優惠後報價，1/3 頭期款後開始執行，尾款於驗收上線後結清。";

/** 預設有效期限 */
export const DEFAULT_VALID_PERIOD = "報價日起 30 天內有效";

/** 一份全新的空白報價單 (帶入所有預設值) */
export function buildDefaultQuoteInput(): QuoteInput {
  const today = new Date().toISOString().slice(0, 10);
  return {
    clientName: "",
    quoteDate: today,
    validPeriod: DEFAULT_VALID_PERIOD,
    items: DEFAULT_ITEMS.map((it) => ({ ...it })),
    projectBrief: { ...DEFAULT_PROJECT_BRIEF },
    summaryText: DEFAULT_SUMMARY_TEXT,
    paymentInfo: DEFAULT_PAYMENT_INFO,
    processSteps: DEFAULT_PROCESS_STEPS.map((s) => ({
      ...s,
      links: s.links.map((l) => ({ ...l })),
    })),
    maintenanceRules: DEFAULT_MAINTENANCE_RULES.map((r) => ({ ...r })),
    supplementaryNotes: [...DEFAULT_SUPPLEMENTARY_NOTES],
    companyName: COMPANY_NAME,
    taxId: COMPANY_TAX_ID,
  };
}
