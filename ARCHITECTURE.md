# 系統架構文件 (Architecture)

> 西打藍好內容有限公司 — 報價單與規格生成工具
> 最後更新：2026-07-04

本文件盤點整個系統的架構，供未來維護與擴充新功能參考。系統由六個模組組成，共用同一套後台外殼與 Vercel KV 資料層：

| 模組 | 用途 | 主要頁面 |
| --- | --- | --- |
| 💰 **報價單** | 建立/編輯報價單、產生對外連結、客戶線上確認、匯出 PDF/Excel/CSV | `/admin`（編輯）、`/quote/[id]`（對外） |
| 💼 **案件管理** | 專案財務：關聯報價單、應收帳款（催款提醒）、合作夥伴費用（外包成本）、稅務代扣 → 自動計算實際淨利 | `/admin`（頁籤） |
| 📝 **靈感看板** | 四欄看板（靈感池 / 長文電子報 / 短影片 / 已封存），拖曳切換狀態 | `/admin`（頁籤） |
| ✅ **待辦清單** | 三區（立即處理 / 稍後再說 / 長期要做的事）極簡待辦 | `/admin`（頁籤） |
| 📚 **知識庫** | 取代 Apple Notes：創業筆記 / 合夥人知識共享 / 客戶諮詢紀錄；支援 Markdown、標籤、諮詢模板，可對外產生唯讀分享連結 | `/admin`（頁籤）、`/shared/note/[token]`（對外） |
| 🤝 **人脈庫** | Connections CRM，**Notion 風格資料表**：點列開 Modal 編輯、拖曳排序（順序持久化）、逐列「＋」插入、職業別/合作方向篩選、預設同職業別分組；支援 CSV 整批匯入 | `/admin`（頁籤） |

另有 🏦 **銀行帳戶快捷面板**（`components/BankInfoPanel.tsx`）常駐後台導覽列：個人／公司帳戶資訊一鍵複製（完整匯款資訊、純數字帳號、統編），複製後顯示 Toast。帳戶資訊為靜態常數（本來就是給客戶匯款用），不經 KV。

---

## 1. 技術棧 (Tech Stack)

| 類別 | 技術 | 版本 | 備註 |
| --- | --- | --- | --- |
| 框架 | **Next.js** | `14.2.35` | App Router；所有 API 與動態頁固定 `runtime = "nodejs"`（Serverless），**非 Edge** |
| UI 函式庫 | **React** / **React DOM** | `^18.3.1` | Server Components + Client Components 混用 |
| 語言 | **TypeScript** | `^5.6.2` | `strict` 模式 |
| 樣式 | **Tailwind CSS** | `^3.4.13` | 品牌深藍漸層、Notion 風格；`@media print` 切換 Excel 排版 |
| 資料庫 | **@vercel/kv** | `^2.0.0` | 底層為 Upstash Redis（走 HTTP REST） |
| 拖曳 | **@hello-pangea/dnd** | `^18.0.1` | `react-beautiful-dnd` 的 StrictMode-safe fork，用於靈感看板 |
| AI | **ai (Vercel AI SDK)** + **@ai-sdk/openai** | `^6.0` / `^3.0` | ✨ 內容矩陣引擎（`/api/matrix`，模型 `gpt-4o`）；需 `OPENAI_API_KEY` |
| 圖示 | **lucide-react** | `^0.454.0` | |
| ID 產生 | **nanoid** | `^5.0.7` | 報價單 `nanoid(10)`、卡片/待辦 fallback id |
| 建置工具 | postcss `^8.4` / autoprefixer `^10.4` / eslint `8.57` + `eslint-config-next` / prettier `^3.9` / npm-run-all | | `npm run check` = lint + typecheck |

**執行環境**：`engines.node >= 18.17.0`。開發機請以 **Node 20**（`nvm use 20`）建置，系統預設的舊版 Node 無法建置。

> ⚠️ **為何固定 Node.js runtime 而非 Edge**：後台驗證 `lib/auth.ts` 使用 Node 內建 `crypto`（`createHash` / `timingSafeEqual`），Edge runtime 不支援，故所有路由統一 `nodejs`。

---

## 2. 專案目錄結構 (Directory Structure)

```
siddblue-system/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 全域版型、字型、viewport（手機縮放設定）
│   ├── page.tsx                  # 品牌首頁
│   ├── globals.css               # Tailwind + 元件樣式 + 列印 Excel 樣式 + 手機觸控優化
│   │
│   ├── admin/                    # 後台（創作者工作區）
│   │   ├── page.tsx              # Server Component：驗證 + 讀 KV（報價/靈感/待辦/筆記）
│   │   ├── AdminLogin.tsx        # 密碼登入（未通過驗證時顯示）
│   │   ├── AdminWorkspace.tsx    # 客戶端頁籤外殼（桌機頂部頁籤 / 手機底部導覽）＋ 🔍 全域搜尋框
│   │   ├── AdminEditor.tsx       # 💰 報價單編輯器（含狀態切換、營業稅切換）
│   │   ├── InspirationBoard.tsx  # 📝 靈感看板（@hello-pangea/dnd 拖曳；✨ 矩陣生成按鈕）
│   │   ├── TodoBoard.tsx         # ✅ 待辦清單
│   │   ├── NotesBoard.tsx        # 📚 知識庫（左列表 + 右編輯；手機單欄切換）
│   │   ├── CasesBoard.tsx        # 💼 案件管理（催款提醒 + 應收/應付 + 稅務 → 淨利）
│   │   ├── ContactsBoard.tsx     # 🤝 人脈庫（Notion 風格資料表：dnd 排序 + Modal 編輯 + 逐列插入 + 篩選 + CSV 匯入）
│   │   └── hooks.ts              # useQueuedSave（防 PUT 亂序）/ useSyncOnFocus（切回分頁重新同步）
│   │
│   ├── quote/[id]/               # 對外報價/規格確認頁
│   │   ├── page.tsx              # Server Component：依 id 讀 KV
│   │   ├── QuoteView.tsx         # 品牌 Notion 版 + 列印 Excel 版（PrintSheet）
│   │   └── not-found.tsx         # 404
│   │
│   ├── shared/note/[token]/      # 對外唯讀筆記分享頁
│   │   ├── page.tsx              # Server Component：依 shareToken 讀 KV，未分享→404
│   │   └── not-found.tsx         # 404
│   │
│   └── api/                      # 所有 API 路由（Route Handlers）
│       ├── quotes/route.ts               # GET 列表 / POST 建立
│       ├── quotes/[id]/route.ts          # GET / PUT / PATCH（狀態）/ DELETE
│       ├── quotes/[id]/accept/route.ts   # POST 客戶線上確認（公開）
│       ├── inspirations/route.ts         # GET / PUT 靈感看板（需登入）
│       ├── todos/route.ts                # GET / PUT 待辦清單（需登入）
│       ├── notes/route.ts                # GET 列表 / POST 建立筆記（需登入）
│       ├── notes/[id]/route.ts           # GET / PUT / DELETE 單筆筆記（需登入）
│       ├── cases/route.ts                # GET 列表 / POST 建立案件（需登入）
│       ├── cases/[id]/route.ts           # GET / PUT / DELETE 單筆案件（需登入）
│       ├── contacts/route.ts             # GET 列表 / POST 建立聯絡人（需登入）
│       ├── contacts/[id]/route.ts        # GET / PUT / DELETE 單筆聯絡人（需登入）
│       ├── contacts/import/route.ts      # POST 整批匯入聯絡人（CSV，需登入）
│       ├── matrix/route.ts               # POST ✨ 內容矩陣引擎：長文 → 短影音腳本（需登入）
│       ├── admin/login/route.ts          # POST 登入 / DELETE 登出
│       └── test-db/route.ts              # GET KV 連線健檢
│
├── components/
│   ├── BrandDecor.tsx            # 紙飛機 / 海鷗 / { } 程式碼括號 等品牌 SVG 裝飾
│   ├── BankInfoPanel.tsx         # 🏦 銀行帳戶快捷面板（一鍵複製 + Toast，靜態常數）
│   └── Linkify.tsx               # 純文字中的 http(s) 網址轉可點擊連結（React 元素輸出，免疫 XSS）
│
├── lib/                          # 純邏輯層（無 UI）
│   ├── types.ts                  # 所有資料型別（Schema 唯一真實來源）
│   ├── defaults.ts               # 硬編碼企業預設值（抬頭、付款、預設項目/流程…）
│   ├── kv.ts                     # 報價單 KV 存取層（含遷移、狀態、摘要）
│   ├── workspace-kv.ts           # 靈感看板 / 待辦清單 KV 存取層
│   ├── notes-kv.ts               # 📚 知識庫 KV 存取層（CRUD + shareToken 反查）
│   ├── cases-kv.ts               # 💼 案件管理 KV 存取層（CRUD + 索引）
│   ├── contacts-kv.ts            # 🤝 人脈庫 KV 存取層（CRUD + pipeline 整批匯入 + 手動排序）
│   ├── contacts-sort.ts          # 人脈庫預設分組排序 + 職業別多值切分（client+server 共用）
│   ├── finance.ts                # 案件財務計算：稅務代扣 + 外包成本 → 淨利（client+server 共用）
│   ├── contacts-csv.ts           # 人脈庫 CSV 匯入解析（表頭別名對應 + 評級正規化，前端）
│   ├── markdown.ts               # 安全的白名單 Markdown → HTML（對外分享頁用）
│   ├── format.ts                 # 金額格式化、營業稅計算（client+server 共用）
│   ├── normalize.ts              # 輸入清理/補齊 + 舊資料相容
│   ├── csv.ts                    # CSV 匯出（前端）
│   └── auth.ts                   # 後台密碼保護（cookie / hash）
│
├── public/assets/
│   └── stamp.jpg                 # 電子大小章（列印報價單自動載入）
│
├── ARCHITECTURE.md               # ← 本文件
├── README.md                     # 使用說明
├── tailwind.config.ts            # 品牌色階、漸層、動畫
└── package.json
```

### 渲染與資料流模型

- **Server Components**（`app/**/page.tsx`）在伺服器端直接呼叫 `lib/kv.ts` / `lib/workspace-kv.ts` / `lib/notes-kv.ts` 讀取資料，並把資料當 props 傳給 Client Component。所有讀取一律呼叫 `unstable_noStore()`，避免 Next.js 快取造成資料過期。
- **Client Components**（編輯器、看板、待辦、對外頁）以 `fetch` 呼叫 `/api/*` 進行寫入。
- **樂觀更新 (Optimistic UI)**：靈感看板與待辦清單在本機先更新畫面，再 `PUT` 整個 board 回 KV，寫入後**不重新讀取**（故 Upstash 讀取複本延遲對使用者無影響）。
- **防寫入亂序（`app/admin/hooks.ts` → `useQueuedSave`）**：整包覆寫 PUT 若併發送出，HTTP 回應順序不保證，舊請求可能最後落地、以舊蓋新。看板的 persist 一律經佇列：同時最多一個請求在途，期間的變更只保留最新酬載、完成後補送一次（序列化＋合併），連續快速拖曳也不會遺失資料。
- **切回分頁重新同步（`useSyncOnFocus`）**：看板資料只在頁面載入時由 Server Component 帶入，之後皆為客戶端狀態；跨裝置編輯或 Client Router Cache 供應過期 RSC payload 時畫面會停留在舊資料。監聽 `focus` / `visibilitychange`，切回分頁時重抓 `GET /api/*` 更新狀態（編輯中、儲存中、或 10 秒內剛改過則跳過，避免讀取複本延遲反而蓋掉新資料）。
- **後台頁籤**：`AdminWorkspace` 一次掛載六個面板，以 `hidden` class 切換（非 remount），切換頁籤時各自狀態不流失、不重整整頁。手機底部導覽為 6 欄。
- **全域搜尋**：`AdminWorkspace` 的 🔍 搜尋框（44px 觸控高度、16px 字級防 iOS 聚焦縮放）以 props 傳入當前頁籤的面板即打即過濾——寫作靈感比對標題＋內容（跨四欄），知識庫比對標題＋內容＋標籤（與列表內搜尋 AND 疊加），案件比對名稱＋備註＋夥伴，人脈比對姓名＋職業＋聯絡方式＋網址＋備註。**搜尋中拖曳自動暫停**：過濾後的 Draggable index 與原陣列不對齊，放行拖曳會排錯位置，故 `isDragDisabled` 直到清除搜尋。

---

## 3. 資料庫結構 (Database Schema)

Vercel KV（Upstash Redis）中的所有 key：

| Key | 型別 | 內容 | 定義於 |
| --- | --- | --- | --- |
| `quote:{id}` | JSON (string) | 單筆報價單 `Quote` | `lib/kv.ts` |
| `quotes:index` | Sorted Set | 後台列表索引；`member = id`，`score = updatedAt(ms)`，供新→舊排序 | `lib/kv.ts` |
| `workspace:inspirations` | JSON (string) | 整個靈感看板 `InspirationBoard`（單一 blob） | `lib/workspace-kv.ts` |
| `workspace:todos` | JSON (string) | 整個待辦清單 `TodoBoard`（單一 blob） | `lib/workspace-kv.ts` |
| `note:{id}` | JSON (string) | 單筆知識庫筆記 `Note` | `lib/notes-kv.ts` |
| `notes:index` | Sorted Set | 後台列表索引；`member = id`，`score = updatedAt(ms)`，供新→舊排序 | `lib/notes-kv.ts` |
| `note:share:{token}` | string | `shareToken → id` 反查對應，供對外分享頁 O(1) 查詢；刪除筆記時一併移除 | `lib/notes-kv.ts` |
| `case:{id}` | JSON (string) | 單筆案件 `Case`（含夥伴費用陣列） | `lib/cases-kv.ts` |
| `cases:index` | Sorted Set | 後台列表索引；`member = id`，`score = updatedAt(ms)`，供新→舊排序 | `lib/cases-kv.ts` |
| `contact:{id}` | JSON (string) | 單筆聯絡人 `Contact` | `lib/contacts-kv.ts` |
| `contacts:index` | Sorted Set | 索引；`member = id`，`score = updatedAt(ms)`（資料表的後備排序） | `lib/contacts-kv.ts` |
| `contacts:order` | JSON (string[]) | 資料表**手動拖曳後的顯示順序**（id 陣列，整包覆寫）；不存在 = 未手動排序，套用預設分組排序 | `lib/contacts-kv.ts` |
| `test:siddblue` | JSON (string) | 連線健檢暫存資料，讀回後即刪除（除非 `?keep=1`） | `app/api/test-db/route.ts` |

> 型別的唯一真實來源是 `lib/types.ts`。以下定義與該檔一致。

### 3.1 Quote（報價單）

```ts
type QuoteStatus = "draft" | "sent" | "confirmed";   // 草稿 / 已發送 / 已確認

interface QuoteItem {
  category: string;      // 功能名稱
  description: string;   // 功能說明（支援多行）
  duration: string;      // 工時（允許文字，如「3 天」「1 個月」）
  amount: number;        // 費用（未稅小計的組成，數字）
}

interface ProcessLink { label: string; url: string; }         // 流程步驟的連結
interface ProcessStep {                                        // 交付流程的一個階段
  title: string;
  description: string;   // 支援多行
  links: ProcessLink[];  // 雲端資料夾、設計稿參考…
}

interface ProjectBrief {           // 專案需求整理
  serviceDescription: string;      // 服務說明
  siteStyle: string;               // 網站風格（預設「未定」）
  sitePages: string;               // 網站頁面（多行）
}

interface MaintenanceRule {        // 維護費估價級距
  level: string;                   // 級距名稱（大/小/微調整）
  description: string;
  amount: string;                  // 允許區間文字，如「5,000 - 10,000 元」
}

interface Quote {
  id: string;                      // nanoid(10)
  clientName: string;              // 客戶 / 專案名稱
  quoteDate: string;               // YYYY-MM-DD
  validPeriod: string;             // 有效期限
  items: QuoteItem[];              // 報價項目
  projectBrief: ProjectBrief;      // 專案需求整理
  summaryText: string;             // 總價與款項特殊備註
  taxInclusive: boolean;           // ★ 是否含 5% 營業稅（true=加稅；false=未稅，預設 false）
  paymentInfo: string;             // 付款資訊（預設帶入，可改）
  processSteps: ProcessStep[];     // 交付流程
  maintenanceRules: MaintenanceRule[];
  supplementaryNotes: string[];    // 補充說明
  companyName: string;             // 公司抬頭（預設西打藍）
  taxId: string;                   // 統一編號

  status: QuoteStatus;             // ★ 生命週期狀態（系統管理，見 §5.1）

  createdAt: string;               // ISO 建立時間
  updatedAt: string;               // ISO 最後更新時間

  acceptedAt?: string;             // 客戶線上確認時間（未確認為空）
  acceptedBy?: string;             // 確認人姓名
}
```

**衍生型別：**

```ts
// 後台列表用的精簡摘要（listQuotes 回傳）
interface QuoteSummary {
  id: string;
  clientName: string;
  quoteDate: string;
  total: number;         // 最終應付金額（含稅則為含稅總計，見 §5.2）
  status: QuoteStatus;
  updatedAt: string;
  acceptedAt?: string;
}

// 表單輸入（前端送出的內容）— 不含系統欄位、狀態與確認狀態
type QuoteInput = Omit<Quote,
  "id" | "createdAt" | "updatedAt" | "acceptedAt" | "acceptedBy" | "status">;
```

> `status` 與 `acceptedAt/By` **不在** `QuoteInput` 中，因此一般的 `PUT` 更新**不會覆寫**狀態；狀態只透過 `PATCH`（後台切換）與 `accept`（客戶確認）改變。

### 3.2 InspirationBoard（靈感看板）

```ts
type InspirationStatus =
  | "idea"        // 💡 靈感池
  | "newsletter"  // 📰 長文電子報
  | "shortvideo"  // 🎬 短影片
  | "archived";   // 📦 已封存（UI 上淡化顯示）

interface Inspiration {
  id: string;
  title: string;      // 上限 300 字（sanitize 時截斷）
  content: string;    // 支援多行 / 基本 Markdown，上限 20000 字
  updatedAt: string;  // ISO
}

// 看板本體：依「狀態欄位」分組，陣列順序即卡片顯示順序
type InspirationBoard = Record<InspirationStatus, Inspiration[]>;
// = { idea: [...], newsletter: [...], shortvideo: [...], archived: [...] }
```

- **狀態欄位（status）即欄位分組的 key**：卡片拖曳到哪一欄，就存進 `InspirationBoard` 對應的陣列。狀態變更＝把卡片從一個陣列 `splice` 出、插入另一個陣列，再 `PUT` 整個 board。
- 讀取時經 `sanitizeInspirationBoard()` 清理：非陣列欄位補空、缺 id 補 `nanoid(10)`、缺 `updatedAt` 補現在時間、標題/內容超長截斷。

### 3.3 TodoBoard（待辦清單）

```ts
type TodoBucket = "now" | "later" | "longterm";
// 🔥 立即處理 / ⏳ 稍後再說 / 🎯 長期要做的事

interface Todo {
  id: string;
  title: string;   // 純文字標題，上限 500 字
}

type TodoBoard = Record<TodoBucket, Todo[]>;
// = { now: [...], later: [...], longterm: [...] }
// 舊資料只有 now/later，讀取時 sanitizeTodoBoard() 會以 emptyTodoBoard() 為底補上 longterm: []
```

- 極簡設計：刪除即從陣列移除並 `PUT` 整個 board，**不保留任何紀錄**（無軟刪除、無時間戳）。
- 讀取時經 `sanitizeTodoBoard()` 清理（同上原則）。

### 3.4 Note（知識庫筆記）

```ts
type NoteType = "general" | "consulting";   // 一般筆記 / 諮詢紀錄

interface Note {
  id: string;          // nanoid(10)
  title: string;       // 上限 300 字
  content: string;     // Markdown，上限 100,000 字
  tags: string[];      // 每個標籤上限 40 字、去重、至多 30 個
  type: NoteType;
  isShared: boolean;   // 是否對外公開
  shareToken: string;  // nanoid(10)，建立時產生、終生不變（分享連結用，避免以 id 被猜到）
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}
```

- 與報價單相同採**逐筆 CRUD + 索引**：`note:{id}` 存單筆、`notes:index`（Sorted Set）排序、`note:share:{token}` 供對外頁反查。
- **對外分享**：`/shared/note/[token]` Server Component 以 `getNoteByShareToken()` 反查；找不到或 `isShared === false` 一律 `notFound()`（不洩漏是否存在）。內容經 `lib/markdown.ts` 轉為**白名單 HTML** 後唯讀呈現。
- **Markdown 安全性**（`lib/markdown.ts`）：先逐行做區塊解析，內容一律先 `escapeHtml` 再套用行內語法；連結僅允許 `http(s):` / `mailto:` / 站內相對路徑，其餘（如 `javascript:`）降級為純文字，故可安全 `dangerouslySetInnerHTML`。`[文字](網址)` 與**裸網址**（http/https 自動連結化）以同一個 regex 單趟處理、皆帶 `target="_blank" rel="noopener noreferrer nofollow"`；靈感卡片預覽等純文字情境則用 `components/Linkify.tsx`。
- 讀取時經 `migrateNote()` 清理/補齊（缺 `shareToken`/`type` 補預設、標籤去重、超長截斷）。

### 3.5 Case（案件與財務管理）

```ts
type CaseType = "own" | "invoice"; // 我接的案子 / 幫朋友開發票

type PartnerPayStatus = "unpaid" | "deposit" | "paid"; // 未支付 / 已付訂金 / 已結清

interface PartnerCost {      // 合作夥伴費用 (外包成本，Accounts Payable)
  id: string;
  partnerName: string;       // 夥伴名稱
  role: string;              // 負責項目 (前端、設計…)
  amount: number;            // 應付金額
  paidAmount: number;        // 已付金額 (訂金/分期實付；「已結清」視同全額)
  payStatus: PartnerPayStatus;
}

interface Case {
  id: string;                    // nanoid(10)
  name: string;                  // 專案名稱
  caseType: CaseType;            // 案件型態；舊資料遷移預設 "own"
  quoteId: string;               // 關聯報價單 id ("" = 未關聯)
  totalAmount: number;           // 總應收金額 (AR)
  receivedAmount: number;        // 已收款
  withholdBusinessTax: boolean;  // 代扣 5% 營業稅
  withholdIncomeTax: boolean;    // 代扣 3% 營所稅
  partnerCosts: PartnerCost[];   // 外包成本 (上限 50 筆)
  note: string;                  // 備註
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
}

type CaseInput = Omit<Case, "id" | "createdAt" | "updatedAt">;
```

- **逐筆 CRUD + 索引**（同報價單/知識庫）：`case:{id}` + `cases:index`。
- **案件型態（caseType）**：新增案件時先選「💼 我接的案子」或「🧾 幫朋友開發票」。**稅務代扣（5% 營業稅、代收代扣 3% 營所稅）只屬於代開發票型**——own 型 UI 不顯示且 `cleanInput()`/`migrateCase()` 一律強制兩旗標為 `false`（資料層保證一致）；切成 invoice 時預設兩項開啟（可取消）。舊資料遷移為 `own`。
- **夥伴名稱串接人脈庫**：外包成本的「夥伴名稱」輸入框掛原生 `<datalist>`（人脈庫全部聯絡人，仍可自由填寫）；名稱與聯絡人**完全同名**時，該列自動帶出人脈庫的匯款資訊（無則顯示聯絡方式），付款免切頁查找。
- **關聯報價單為快照**：在後台選擇報價單時把 `clientName`／`total` 帶入 `name`／`totalAmount`，之後可自行修改；報價單後續變動**不會**回寫案件。
- **衍生值不落地**：未收款餘額、代扣稅額、淨利一律由 `lib/finance.ts` 的 `computeCaseFinance()` 即時計算（見 §5.5），KV 只存輸入值。
- 金額經 `toAmount()` 清理：取整數、擋負值與超過 10 億的離譜值。

### 3.6 Contact（人脈資料庫）

```ts
type ContactLevel = "high" | "medium" | "low" | "unknown"; // 高 / 中 / 低 / 不確定
type ContactStatus =                                   // 對齊 Notion 人脈庫既有分類
  | "employed" | "freelance" | "startup" | "student" | "unknown";
  // 就業 / 接案 / 創業 / 學生 / 未知
type CooperationType = "project" | "industry";        // 專案合作(外包、合夥) / 業界合作(網紅、互惠)

interface Contact {
  id: string;                    // nanoid(10)
  name: string;                  // 姓名
  profession: string;            // 職業別 (Notion、前端工程師…；可逗號多值)
  contactInfo: string;           // 聯絡方式 (Line / IG / Email)
  url: string;                   // 網址 (可多行多連結)
  familiarity: ContactLevel;     // 熟悉度
  liking: ContactLevel;          // 喜好度
  ability: ContactLevel;         // 能力值
  price: ContactLevel;           // 價格
  status: ContactStatus;         // 就業 / 接案 / 創業 / 學生 / 未知
  cooperationType: CooperationType; // 合作方向
  transferInfo: string;          // 匯款資訊 (支付外包款用)
  note: string;                  // 備註
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
}

type ContactInput = Omit<Contact, "id" | "createdAt" | "updatedAt">;
```

- **逐筆 CRUD + 索引**：`contact:{id}` + `contacts:index`。
- **資料表排序（`contacts:order`）**：後台為 Notion 風格資料表（`ContactsBoard`），以 `@hello-pangea/dnd` 拖曳排序。拖曳/逐列插入/刪除後把**整個 id 陣列** `PUT /api/contacts` 覆寫（經 `useQueuedSave` 序列化，不會舊蓋新）。`order: null` 清除手動排序（「重新分組」按鈕）。⚠️ `useQueuedSave` 以 `null` 為佇列空值哨兵，酬載須包成 `{ order }` 物件。
- **預設分組排序（`lib/contacts-sort.ts` `groupSortContacts`）**：未手動排序時，依 合作方向（專案→業界）→ 職業別 → 姓名 排序，同領域人脈相鄰；不在手動順序中的 id（匯入/他處新增）附加在最後。**篩選/搜尋中拖曳自動停用**（過濾後 index 與原陣列不對齊）。
- **點值即篩選 (click-to-filter)**：資料表每列的 職業別 chip／合作方向徽章／狀態／熟悉・能力・價格徽章都可點擊，點一下套用該值篩選（篩選列同步、可疊加），再點一次或按「清除篩選」取消；點擊經 `stopPropagation`，不會誤開該列的編輯 Modal。**備註**直接顯示於資料表（`line-clamp-2`，完整內容進 Modal）。
- **職業別彩色標籤**（`buildProfessionColorMap`）：獨特標籤依 zh-Hant 排序後**循環指派 12 色調色盤**——同標籤永遠同色、分組排序下相鄰職業必不同色（雜湊取色會撞色，僅作為未入表新標籤的後備）。編輯 Modal 的職業別為**下拉多選**（勾選既有標籤＋輸入新增），底層仍以逗號串接存於 `profession` 字串，完全相容 CSV 匯入與舊資料。
- **網址欄**：不顯示網址全文，只列**可點擊圖示**（前 2 個連結 + 「+N」溢出提示，`stopPropagation` 不觸發列編輯）。
- **CSV 匯入**（`lib/contacts-csv.ts` 前端解析 → `POST /api/contacts/import` 整批寫入）：
  - RFC 4180 風格解析（引號欄位、欄內逗號/換行、`""` 跳脫、BOM）。
  - 第一列為表頭，以**別名包含比對**對應欄位（姓名/職業別/聯絡方式/網址/熟悉度/喜好度/能力值/價格/狀態/合作方向/匯款資訊/備註，順序不拘、可缺欄）；找不到「姓名」欄即報錯。
  - 值正規化：`高/中/低/不確定`→`high/medium/low/unknown`（複合值如「中, 高」取較明確者：高 > 低 > 中；未填/無法辨識→`unknown`）、`就業/接案/創業/學生`→`employed/freelance/startup/student`（未填→`unknown`）、含「業界/網紅/互惠」→`industry`（預設 `project`）。缺姓名的資料列略過。
  - 伺服器端以 **KV pipeline** 一次寫入（單批上限 500 筆），依 CSV 順序遞增時間戳確保索引排序穩定。

---

## 4. API Endpoints

所有動態路由皆 `export const dynamic = "force-dynamic"`、`runtime = "nodejs"`。「需登入」代表 `isAuthenticated()` 未過會回 `401`（未設定 `ADMIN_PASSWORD` 時視為開放）。

| Method + Path | 功能 | 授權 | 對應邏輯 |
| --- | --- | --- | --- |
| `GET /api/quotes` | 列出所有報價單摘要（新→舊） | 需登入 | `listQuotes()` |
| `POST /api/quotes` | 建立新報價單（`status` 預設 `draft`） | 需登入 | `createQuote()` |
| `GET /api/quotes/[id]` | 讀取單筆報價單 | **公開**（對外頁需要） | `getQuote()` |
| `PUT /api/quotes/[id]` | 更新報價單內容（不動 `status`/確認狀態） | 需登入 | `updateQuote()` |
| `PATCH /api/quotes/[id]` | **僅切換狀態**，body `{ status }`；非法值回 `400` | 需登入 | `updateQuoteStatus()` |
| `DELETE /api/quotes/[id]` | 刪除報價單（同時移出 index） | 需登入 | `deleteQuote()` |
| `POST /api/quotes/[id]/accept` | 客戶線上確認，body `{ name }`；首次確認後鎖定，並將 `status` 設為 `confirmed` | **公開** | `acceptQuote()` |
| `GET /api/inspirations` | 讀取整個靈感看板 `{ board }` | 需登入 | `getInspirations()` |
| `PUT /api/inspirations` | 覆寫整個靈感看板，body `{ board }` | 需登入 | `saveInspirations()` |
| `GET /api/todos` | 讀取整個待辦清單 `{ board }` | 需登入 | `getTodos()` |
| `PUT /api/todos` | 覆寫整個待辦清單，body `{ board }` | 需登入 | `saveTodos()` |
| `GET /api/notes` | 列出所有筆記摘要（新→舊，不含 content） | 需登入 | `listNotes()` |
| `POST /api/notes` | 建立新筆記（自動產生 `shareToken`） | 需登入 | `createNote()` |
| `GET /api/notes/[id]` | 讀取單筆筆記（後台用） | 需登入 | `getNote()` |
| `PUT /api/notes/[id]` | 更新筆記（保留 `id`/`shareToken`/`createdAt`） | 需登入 | `updateNote()` |
| `DELETE /api/notes/[id]` | 刪除筆記（同時移出 index 與 share 對應） | 需登入 | `deleteNote()` |
| `GET /api/cases` | 列出所有案件（完整內容，新→舊） | 需登入 | `getAllCases()` |
| `POST /api/cases` | 建立新案件 | 需登入 | `createCase()` |
| `GET /api/cases/[id]` | 讀取單筆案件 | 需登入 | `getCase()` |
| `PUT /api/cases/[id]` | 更新案件（保留 `id`/`createdAt`） | 需登入 | `updateCase()` |
| `DELETE /api/cases/[id]` | 刪除案件（同時移出 index） | 需登入 | `deleteCase()` |
| `GET /api/contacts` | 列出所有聯絡人（套用手動排序或預設分組），回 `{ contacts, ordered }` | 需登入 | `getContactsView()` |
| `PUT /api/contacts` | 儲存資料表手動排序，body `{ order: string[] }`；`{ order: null }` 清除 | 需登入 | `saveContactsOrder()` |
| `POST /api/contacts` | 建立新聯絡人 | 需登入 | `createContact()` |
| `GET /api/contacts/[id]` | 讀取單筆聯絡人 | 需登入 | `getContact()` |
| `PUT /api/contacts/[id]` | 更新聯絡人（保留 `id`/`createdAt`） | 需登入 | `updateContact()` |
| `DELETE /api/contacts/[id]` | 刪除聯絡人（同時移出 index） | 需登入 | `deleteContact()` |
| `POST /api/contacts/import` | 整批匯入聯絡人，body `{ contacts: ContactInput[] }`（單批 ≤ 500 筆，KV pipeline 寫入） | 需登入 | `importContacts()` |
| `POST /api/matrix` | ✨ 內容矩陣引擎：body `{ title, content }` → `{ script }`（300 字內短影音腳本）。未設 `OPENAI_API_KEY` 回 503 | 需登入 | `generateText()`（ai + @ai-sdk/openai，`gpt-4o`） |
| `POST /api/admin/login` | 驗證密碼、設定 `sb_admin` cookie | 公開 | `verifyPassword()` + `expectedToken()` |
| `DELETE /api/admin/login` | 登出（清 cookie） | 公開 | — |
| `GET /api/test-db` | KV 連線健檢（寫→讀→比對→刪）；`?keep=1` 保留 | 公開 | 直接呼叫 `kv` |

**設計慣例**：看板/清單採「整包覆寫（whole-board PUT）」而非逐項增刪，讓拖曳重排成為原子操作、前端邏輯單純；報價單與知識庫則採逐筆 CRUD + 索引 Sorted Set（單筆內容較大、需獨立分享連結）。

---

## 5. 核心商業邏輯 (Core Logic)

### 5.1 報價單狀態機（`lib/kv.ts`）

狀態 `draft → sent → confirmed`（可任意方向切換）：

- **建立**：`createQuote()` 一律設 `status: "draft"`。
- **後台切換**：`PATCH /api/quotes/[id]` → `updateQuoteStatus()` 只改 `status` 與 `updatedAt`，其餘欄位不動。前端（`AdminEditor`）以樂觀更新即時反映徽章顏色（灰/藍/綠）。
- **客戶確認**：`acceptQuote()` 於首次確認時把 `status` 設為 `confirmed` 並寫入 `acceptedAt/By`；已確認過則保留原紀錄不覆寫（防竄改）。
- **舊資料遷移**（`migrateQuote()`，讀取時自動執行）：
  - 有合法 `status` → 保留；
  - 無 `status` 但有 `acceptedAt` → 視為 `confirmed`；
  - 其餘 → `draft`。
  - 同時補 `taxInclusive`（缺 → `false`）、`projectBrief`、`processSteps`（相容舊的純字串流程）。

### 5.2 營業稅自動計算（`lib/format.ts`）

單一函式 `computeTotals()` 為前後端共用的唯一計算入口：

```ts
export const TAX_RATE = 0.05;

interface QuoteTotals {
  subtotal: number;      // 未稅小計 = 各項目 amount 加總
  tax: number;           // 含稅時 = Math.round(subtotal * 0.05)；未稅時 = 0
  grandTotal: number;    // 含稅時 = subtotal + tax；未稅時 = subtotal
  taxInclusive: boolean;
}

function computeTotals(items: QuoteItem[], taxInclusive: boolean): QuoteTotals;
```

- 項目金額 `amount` 一律視為**未稅**；`taxInclusive` 為開關（預設 `false`）。
- 稅金**四捨五入至整數**（`Math.round`）。
- 使用點：
  - `AdminEditor` — 編輯頁「未稅 / 含稅 (+5%)」切換，含稅時顯示「未稅金額 / 營業稅 (5%) / 含稅總計」。
  - `QuoteView` — 對外頁的合計區塊與列印 `PrintSheet` 表尾。
  - `lib/csv.ts` — CSV 依 `taxInclusive` 輸出對應列。
  - `lib/kv.ts` `toSummary()` — 後台列表 `total` 顯示**最終應付**（含稅則為含稅總計）。

### 5.3 匯出：PDF / Excel / CSV

**PDF / Excel — 純 CSS 列印方案，無任何 PDF 套件**（排版最穩、零相依）：

- `QuoteView` 同時輸出兩個版面：
  - **螢幕**：品牌 Notion 風格頁（`.no-print`，列印時隱藏）。
  - **列印/PDF**：`PrintSheet` 元件（`.print-sheet`），以 `.excel-table` 呈現無邊框、帶格線的正式報價單。
- `globals.css` 的 `@media print` 隱藏 Banner 與所有按鈕、切換為 A4 直式 Excel 排版，並以 `print-color-adjust: exact` 保留底色。
- 使用者按「匯出正式報價單」→ `window.print()` → 於列印對話框「另存為 PDF」。畫面上可按「預覽 Excel 版」以 `.excel-preview` class 在螢幕預覽同一版面。
- **電子大小章**：`PrintSheet` 載入 `/public/assets/stamp.jpg`；圖檔缺漏時 `onError` 隱藏破圖、改顯示虛線「用印處」框。
- 客戶已線上確認時，報價單「客戶簽章」欄自動帶入確認人姓名與時間。

**CSV（`lib/csv.ts`）**：純字串組裝，加 **UTF-8 BOM** 避免 Excel 中文亂碼；以 `Blob` + 動態 `<a download>` 觸發下載，檔名為「報價單_客戶_日期.csv」。含稅時輸出「未稅金額 / 營業稅 5% / 含稅總計」三列，否則單列「合計」。

### 5.4 Vercel KV 連線（`lib/kv.ts` / `lib/workspace-kv.ts`）

- 透過 `@vercel/kv` 的 `kv` 單例（底層 Upstash Redis，走 HTTP，故 Node/Edge 皆可；本專案固定 Node）。
- **啟用判斷**：`KV_ENABLED = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN)`。
- **記憶體後援**：未設定 KV 時自動改用 in-memory Map / 變數，`next dev` 可直接跑（重啟即清空），方便先試 UI。
- **防過期**：每個讀取 helper 開頭都呼叫 `unstable_noStore()`，強制不進 Next.js data cache（否則 Server Component 會服務到舊資料）。
- **健檢**：`GET /api/test-db` 會偵測環境變數是否存在（不外洩內容）、寫入→讀回→比對，並針對 `Unauthorized` / 網路錯誤給出對應提示。

> ⚠️ 本機開發預設連的是**線上正式 KV**。跑測試腳本務必自行清除測試資料。

### 5.5 案件財務計算（`lib/finance.ts`）

`computeCaseFinance()` 為前後端共用的唯一計算入口（案件的衍生金額一律即時計算、不落地）：

```ts
export const BUSINESS_TAX_RATE = 0.05; // 代扣營業稅
export const INCOME_TAX_RATE = 0.03;   // 代扣營所稅

interface CaseFinance {
  totalAmount: number;        // 總應收金額
  receivedAmount: number;     // 已收款
  unpaidBalance: number;      // 未收款餘額 = 總應收 − 已收款
  businessTax: number;        // 開啟時 = round(總應收 × 5%)
  incomeTax: number;          // 開啟時 = round(總應收 × 3%)
  taxTotal: number;           // 稅務合計
  partnerTotal: number;       // 夥伴費用合計
  partnerPaid: number;        // 已支付夥伴金額 (已結清視同全額 + 其餘列的 paidAmount)
  partnerOutstanding: number; // 尚未結清 = Σ(應付 − 已付)，已結清列為 0
  netProfit: number;          // 實際淨利 = 總應收 − 稅務 − 夥伴費用
}
```

- 稅金各自**四捨五入至整數**（與報價單 `computeTotals()` 慣例一致）。
- 使用點：`CasesBoard` 編輯區的即時財務摘要、左列表徽章、頂部**催款提醒**區塊（列出所有 `unpaidBalance > 0` 的案件，金額大→小，標題顯示未收合計）。

### 5.6 後台驗證（`lib/auth.ts`）

以 `ADMIN_PASSWORD` 環境變數作為單一密碼閘門：

- **開關**：未設定 `ADMIN_PASSWORD` → `isAuthenticated()` 恆為 `true`（開放，利於本機）；設定後才啟用保護。
- **登入**：`POST /api/admin/login` 用 `crypto.timingSafeEqual` 比對密碼（等長才比，避免時序攻擊），通過後種下 cookie。
- **Cookie**：名稱 `sb_admin`，值為 **不可逆令牌** `sha256(ADMIN_PASSWORD + "::siddblue-quote-system")`（不存明碼）；`httpOnly`、`sameSite=lax`、正式環境 `secure`、有效期 30 天。
- **驗證**：`isAuthenticated()` 比對請求 cookie 是否等於 `expectedToken()`。
- **保護範圍**：`/admin` 頁面（`app/admin/page.tsx`）＋所有寫入類 API（quotes 的 POST/PUT/PATCH/DELETE、inspirations/todos 的 GET/PUT）。
- **公開例外**：`GET /api/quotes/[id]` 與 `POST /api/quotes/[id]/accept`（對外報價/確認頁需要）。

> 🔒 安全守則：切勿在程式或紀錄中輸出 `ADMIN_PASSWORD`；`.env.local` 須維持在 `.gitignore`。

---

## 6. 環境變數

| 變數 | 用途 | 必填 |
| --- | --- | --- |
| `KV_REST_API_URL` | Vercel KV REST 端點 | 正式環境必填（否則走記憶體） |
| `KV_REST_API_TOKEN` | Vercel KV 讀寫 token | 正式環境必填 |
| `KV_REST_API_READ_ONLY_TOKEN` | 唯讀 token（KV 整合附帶） | 選填 |
| `KV_URL` | Redis 連線字串（KV 整合附帶） | 選填 |
| `ADMIN_PASSWORD` | 後台密碼；未設定則後台開放 | 建議設定 |
| `NEXT_PUBLIC_SITE_URL` | 產生對外連結的基底網址 | 選填 |
| `OPENAI_API_KEY` | ✨ 內容矩陣引擎（`/api/matrix`）呼叫 gpt-4o 所需；未設定時該功能回 503、其餘功能不受影響 | 使用矩陣生成時必填 |

---

## 7. 部署

- Git push 到 `main` → **Vercel 自動部署**。
- 正式網址：`https://siddblue-system.vercel.app`（請以此網域為準；帶部署雜湊的網址會鎖定在舊版建置）。
- KV 環境變數由 Vercel 的 KV 整合自動注入；`ADMIN_PASSWORD` 於 Project → Settings → Environment Variables 手動加入。

---

## 8. 擴充新功能的建議路徑

- **新增報價單欄位**：改 `lib/types.ts`（`Quote` + 視需要調整 `QuoteInput` 的 `Omit`）→ `lib/normalize.ts`（清理）→ `lib/defaults.ts`（預設值）→ `AdminEditor` 表單 + `QuoteView`/`PrintSheet` 呈現 →（如需相容舊資料）`migrateQuote()`。
- **新增工作區模組**：整包看板類仿 `lib/workspace-kv.ts`（`workspace:*` blob + `GET/PUT`）；逐筆實體類仿 `lib/cases-kv.ts` / `lib/contacts-kv.ts`（`{entity}:{id}` + sorted set 索引 + CRUD API），再於 `AdminWorkspace` 增一個頁籤面板（沿用 `hidden` 切換）。
- **金額/稅務調整**：報價單改 `lib/format.ts` 的 `computeTotals()` / `TAX_RATE`；案件淨利改 `lib/finance.ts` 的 `computeCaseFinance()` / 稅率常數，各處會一致套用。
- **保持慣例**：所有 KV 讀取務必 `noStore()`；寫入類 API 一律先 `isAuthenticated()`；不要把路由改成 Edge runtime。
