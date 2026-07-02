# 系統架構文件 (Architecture)

> 西打藍好內容有限公司 — 報價單與規格生成工具
> 最後更新：2026-07-02

本文件盤點整個系統的架構，供未來維護與擴充新功能參考。系統由四個模組組成，共用同一套後台外殼與 Vercel KV 資料層：

| 模組 | 用途 | 主要頁面 |
| --- | --- | --- |
| 💰 **報價單** | 建立/編輯報價單、產生對外連結、客戶線上確認、匯出 PDF/Excel/CSV | `/admin`（編輯）、`/quote/[id]`（對外） |
| 📝 **靈感看板** | 四欄看板（靈感池 / 長文電子報 / 短影片 / 已封存），拖曳切換狀態 | `/admin`（頁籤） |
| ✅ **待辦清單** | 三區（立即處理 / 稍後再說 / 長期要做的事）極簡待辦 | `/admin`（頁籤） |
| 📚 **知識庫** | 取代 Apple Notes：創業筆記 / 合夥人知識共享 / 客戶諮詢紀錄；支援 Markdown、標籤、諮詢模板，可對外產生唯讀分享連結 | `/admin`（頁籤）、`/shared/note/[token]`（對外） |

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
│   │   ├── AdminWorkspace.tsx    # 客戶端頁籤外殼（桌機頂部頁籤 / 手機底部導覽）
│   │   ├── AdminEditor.tsx       # 💰 報價單編輯器（含狀態切換、營業稅切換）
│   │   ├── InspirationBoard.tsx  # 📝 靈感看板（@hello-pangea/dnd 拖曳；✨ 矩陣生成按鈕）
│   │   ├── TodoBoard.tsx         # ✅ 待辦清單
│   │   ├── NotesBoard.tsx        # 📚 知識庫（左列表 + 右編輯；手機單欄切換）
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
│       ├── matrix/route.ts               # POST ✨ 內容矩陣引擎：長文 → 短影音腳本（需登入）
│       ├── admin/login/route.ts          # POST 登入 / DELETE 登出
│       └── test-db/route.ts              # GET KV 連線健檢
│
├── components/
│   └── BrandDecor.tsx            # 紙飛機 / 海鷗 / { } 程式碼括號 等品牌 SVG 裝飾
│
├── lib/                          # 純邏輯層（無 UI）
│   ├── types.ts                  # 所有資料型別（Schema 唯一真實來源）
│   ├── defaults.ts               # 硬編碼企業預設值（抬頭、付款、預設項目/流程…）
│   ├── kv.ts                     # 報價單 KV 存取層（含遷移、狀態、摘要）
│   ├── workspace-kv.ts           # 靈感看板 / 待辦清單 KV 存取層
│   ├── notes-kv.ts               # 📚 知識庫 KV 存取層（CRUD + shareToken 反查）
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
- **後台頁籤**：`AdminWorkspace` 一次掛載四個面板，以 `hidden` class 切換（非 remount），切換頁籤時各自狀態不流失、不重整整頁。

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
- **Markdown 安全性**（`lib/markdown.ts`）：先逐行做區塊解析，內容一律先 `escapeHtml` 再套用行內語法；連結僅允許 `http(s):` / `mailto:` / 站內相對路徑，其餘（如 `javascript:`）降級為純文字，故可安全 `dangerouslySetInnerHTML`。
- 讀取時經 `migrateNote()` 清理/補齊（缺 `shareToken`/`type` 補預設、標籤去重、超長截斷）。

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

### 5.5 後台驗證（`lib/auth.ts`）

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
- **新增工作區模組**：仿 `lib/workspace-kv.ts` 建立新的 `workspace:*` blob 與 sanitizer，加一組 `GET/PUT` API，再於 `AdminWorkspace` 增一個頁籤面板（沿用 `hidden` 切換 + 樂觀更新）。
- **金額/稅務調整**：只改 `lib/format.ts` 的 `computeTotals()` / `TAX_RATE`，各處會一致套用。
- **保持慣例**：所有 KV 讀取務必 `noStore()`；寫入類 API 一律先 `isAuthenticated()`；不要把路由改成 Edge runtime。
