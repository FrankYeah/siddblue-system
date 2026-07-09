# 系統架構文件 (Architecture)

> 西打藍好內容有限公司 — 報價單與規格生成工具
> 最後更新：2026-07-06

本文件盤點整個系統的架構，供未來維護與擴充新功能參考。系統由七個模組組成，共用同一套後台外殼與 Vercel KV 資料層：

| 模組 | 用途 | 主要頁面 |
| --- | --- | --- |
| 💰 **報價單** | 建立/編輯報價單、產生對外連結、客戶線上確認、匯出 PDF/Excel/CSV | `/admin`（編輯）、`/quote/[id]`（對外） |
| 💼 **案件管理** | 專案財務：關聯報價單、應收帳款（催款提醒）、合作夥伴費用（外包成本）、稅務代扣 → 自動計算實際淨利 | `/admin`（頁籤） |
| 💳 **支出紀錄** | 公司／個人支出總覽，自動算出每月固定開銷底線 (Burn Rate)；Notion 風格資料表 + 篩選 | `/admin`（頁籤） |
| 📝 **靈感看板** | 四欄看板（靈感池 / 長文電子報 / 短影片 / 已封存），拖曳切換狀態 | `/admin`（頁籤） |
| ✅ **待辦清單** | 四區（立即處理 / 稍後再說 / 長期要做的事 / 外出待辦）極簡待辦 | `/admin`（頁籤） |
| 📚 **知識庫** | 取代 Apple Notes：創業筆記 / 合夥人知識共享 / 客戶諮詢紀錄；支援 Markdown、標籤、諮詢模板，可對外產生唯讀分享連結 | `/admin`（頁籤）、`/shared/note/[token]`（對外） |
| 🤝 **人脈庫** | Connections CRM，**Notion 風格資料表**：點列開 Modal 編輯、拖曳排序（順序持久化）、逐列「＋」插入、職業別/合作方向篩選、預設同職業別分組；支援 CSV 整批匯入 | `/admin`（頁籤） |

另有兩個常駐後台導覽列的全域面板：
- 🏦 **銀行帳戶快捷面板**（`components/BankInfoPanel.tsx`）：個人／公司帳戶資訊一鍵複製（完整匯款資訊、純數字帳號、統編），複製後顯示 Toast。帳戶資訊為靜態常數（本來就是給客戶匯款用），不經 KV。
- 📦 **資料備份與匯出**（`components/BackupPanel.tsx`）：一鍵匯出全部資料為 JSON、手動「立即備份」、還原至過去快照；每日由 Vercel Cron 自動快照一次，保留最近 7 份（見 §5.7）。

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
│   │   ├── ExpensesBoard.tsx     # 💳 支出紀錄（Burn Rate 統計卡 + Notion 風格資料表 + Modal 編輯）
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
│       ├── expenses/route.ts             # GET 列表 / POST 建立支出（需登入）
│       ├── expenses/[id]/route.ts        # GET / PUT / DELETE 單筆支出（需登入）
│       ├── matrix/route.ts               # POST ✨ 內容矩陣引擎：長文 → 短影音腳本（需登入）
│       ├── backup/export/route.ts        # GET 匯出全部資料 JSON（需登入）
│       ├── backup/snapshot/route.ts      # GET 建立備份快照（Cron 或後台手動，見 §5.7）
│       ├── backup/list/route.ts          # GET 列出所有備份快照（需登入）
│       ├── backup/restore/route.ts       # POST 還原至指定快照（危險操作，需登入）
│       ├── admin/login/route.ts          # POST 登入 / DELETE 登出
│       └── test-db/route.ts              # GET KV 連線健檢
│
├── components/
│   ├── BrandDecor.tsx            # 紙飛機 / 海鷗 / { } 程式碼括號 等品牌 SVG 裝飾
│   ├── BankInfoPanel.tsx         # 🏦 銀行帳戶快捷面板（一鍵複製 + Toast，靜態常數）
│   ├── BackupPanel.tsx           # 📦 資料備份與匯出面板（匯出/立即備份/還原）
│   └── Linkify.tsx               # 純文字中的 http(s) 網址轉可點擊連結（React 元素輸出，免疫 XSS）
│
├── lib/                          # 純邏輯層（無 UI）
│   ├── types.ts                  # 所有資料型別（Schema 唯一真實來源）
│   ├── defaults.ts               # 硬編碼企業預設值（抬頭、付款、預設項目/流程…）
│   ├── kv.ts                     # 報價單 KV 存取層（含遷移、狀態、摘要、備份還原用 restoreQuotes）
│   ├── workspace-kv.ts           # 靈感看板 / 待辦清單 KV 存取層
│   ├── notes-kv.ts               # 📚 知識庫 KV 存取層（CRUD + shareToken 反查 + 備份還原）
│   ├── cases-kv.ts               # 💼 案件管理 KV 存取層（CRUD + 索引 + 收付款歷程 + 備份還原）
│   ├── contacts-kv.ts            # 🤝 人脈庫 KV 存取層（CRUD + pipeline 整批匯入 + 手動排序 + 備份還原）
│   ├── contacts-sort.ts          # 人脈庫預設分組排序 + 職業別多值切分（client+server 共用）
│   ├── expenses-kv.ts            # 💳 支出紀錄 KV 存取層（CRUD + 索引 + 備份還原）
│   ├── finance.ts                # 案件財務計算：稅務代扣 + 外包成本 → 淨利 + 待付夥伴款彙總（client+server 共用）
│   ├── contacts-csv.ts           # 人脈庫 CSV 匯入解析（表頭別名對應 + 評級正規化，前端）
│   ├── backup.ts                 # 📦 資料備份：匯出/快照/列表/還原，7 份輪替（見 §5.7）
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
├── vercel.json                   # Vercel Cron 設定（每日呼叫 /api/backup/snapshot）
├── tailwind.config.ts            # 品牌色階、漸層、動畫
└── package.json
```

### 渲染與資料流模型

- **Server Components**（`app/**/page.tsx`）在伺服器端直接呼叫 `lib/kv.ts` / `lib/workspace-kv.ts` / `lib/notes-kv.ts` 讀取資料，並把資料當 props 傳給 Client Component。所有讀取一律呼叫 `unstable_noStore()`，避免 Next.js 快取造成資料過期。
- **Client Components**（編輯器、看板、待辦、對外頁）以 `fetch` 呼叫 `/api/*` 進行寫入。
- **樂觀更新 (Optimistic UI)**：靈感看板與待辦清單在本機先更新畫面，再 `PUT` 整個 board 回 KV，寫入後**不重新讀取**（故 Upstash 讀取複本延遲對使用者無影響）。
- **防寫入亂序（`app/admin/hooks.ts` → `useQueuedSave`）**：整包覆寫 PUT 若併發送出，HTTP 回應順序不保證，舊請求可能最後落地、以舊蓋新。看板的 persist 一律經佇列：同時最多一個請求在途，期間的變更只保留最新酬載、完成後補送一次（序列化＋合併），連續快速拖曳也不會遺失資料。
- **切回分頁重新同步（`useSyncOnFocus`）**：看板資料只在頁面載入時由 Server Component 帶入，之後皆為客戶端狀態；跨裝置編輯或 Client Router Cache 供應過期 RSC payload 時畫面會停留在舊資料。監聽 `focus` / `visibilitychange`，切回分頁時重抓 `GET /api/*` 更新狀態（編輯中、儲存中、或 10 秒內剛改過則跳過，避免讀取複本延遲反而蓋掉新資料）。⚠️ 光是進入 callback 前檢查還不夠——若 focus 事件在 10 秒保護期剛過就觸發、`fetch` 進行期間使用者剛好又新增了一筆，這份回應送達時已經是過期快照，仍會不分青紅皂白蓋掉剛新增的項目（曾在 TodoBoard／InspirationBoard 實際重現：新增後畫面上內容憑空消失，但 KV 其實有存到）。因此兩處呼叫端都在 `fetch` **前**記錄 `requestedAt = Date.now()`，await 結束後若 `lastMutationAt.current >= requestedAt`（代表這段等待期間又有更新）就捨棄這份回應、不套用，而不是只在呼叫前檢查一次。
- **後台頁籤**：`AdminWorkspace` 一次掛載七個面板，以 `hidden` class 切換（非 remount），切換頁籤時各自狀態不流失、不重整整頁。手機底部導覽為 7 欄。
- **全域搜尋**：`AdminWorkspace` 的 🔍 搜尋框（44px 觸控高度、16px 字級防 iOS 聚焦縮放）以 props 傳入當前頁籤的面板即打即過濾——寫作靈感比對標題＋內容（跨四欄），知識庫比對標題＋內容＋標籤（與列表內搜尋 AND 疊加），案件比對名稱＋備註＋夥伴，人脈比對姓名＋職業＋聯絡方式＋網址＋備註，支出比對項目名稱＋備註。**搜尋中拖曳自動暫停**：過濾後的 Draggable index 與原陣列不對齊，放行拖曳會排錯位置，故 `isDragDisabled` 直到清除搜尋。

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
| `expense:{id}` | JSON (string) | 單筆支出 `Expense` | `lib/expenses-kv.ts` |
| `expenses:index` | Sorted Set | 後台列表索引；`member = id`，`score = updatedAt(ms)`，供新→舊排序 | `lib/expenses-kv.ts` |
| `backups:index` | Sorted Set | 備份快照索引；`member = 備份 id`，`score = 建立時間(ms)` | `lib/backup.ts` |
| `backup:meta:{id}` | JSON (string) | 單份備份的輕量摘要（時間 + 各模組筆數），列表用 | `lib/backup.ts` |
| `backup:data:{id}` | JSON (string) | 單份備份的完整資料，只在還原時讀取 | `lib/backup.ts` |
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

- **客戶確認後鎖定編輯（`AdminEditor`）**：一旦 `acceptedAt` 有值，編輯頁預設把整個表單包在 `<fieldset disabled>` 內（原生連動停用所有子層 input/textarea/select/button，含 `react-textarea-autosize`），避免確認後被誤改；需點擊「解鎖編輯」（`window.confirm` 二次確認）才能修改，取消勾選不會回寫任何資料。CSV 匯出／開啟前台頁／複製連結等唯讀動作特意放在 fieldset 外，鎖定時仍可使用，只有「儲存」按鈕會被鎖住。複本（`duplicateQuote`）一律視為全新草稿，不繼承鎖定狀態。

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
type TodoBucket = "now" | "later" | "longterm" | "errand";
// 🔥 立即處理 / ⏳ 稍後再說 / 🎯 長期要做的事 / 🚗 外出待辦

interface Todo {
  id: string;
  title: string;   // 純文字標題，上限 500 字
}

type ReminderFrequency = "weekly" | "monthly" | "yearly" | "once";
// 每週 / 每月 / 每年 / 特定日期（僅一次）

interface Reminder {          // 週期性提醒：與 Todo 不同，不會「做完就刪」
  id: string;
  title: string;               // 提醒內容，上限 300 字
  frequency: ReminderFrequency;
  when: string;                 // 依 frequency 解讀：
                                 //  weekly  → "0"~"6"（星期日=0）
                                 //  monthly → "1"~"31"（每月幾號）
                                 //  yearly  → "MM-DD"
                                 //  once    → "YYYY-MM-DD"
}

interface TodoBoard extends Record<TodoBucket, Todo[]> {
  reminders: Reminder[];        // 獨立於四個「做完就刪」分區的週期提醒清單
}
// = { now: [...], later: [...], longterm: [...], errand: [...], reminders: [...] }
// 舊資料缺少後來新增的分區/欄位，讀取時 sanitizeTodoBoard() 會以
// emptyTodoBoard() 為底補上缺的分區為 []，同一慣例可持續擴充新分區
```

- 四個簡易分區：極簡設計，刪除即從陣列移除並 `PUT` 整個 board，**不保留任何紀錄**（無軟刪除、無時間戳）；新增的項目插在陣列**最前面**（`[todo, ...board[bucket]]`），畫面上剛新增的永遠在最上方，不用捲到最下面找。
- **版面（`TodoBoard.tsx` 的 `grid`）**：四個分區欄位改為**固定寬度（340px）+ 橫向捲動**（`flex overflow-x-auto`），取代原本會被螢幕寬度擠壓的 `grid-cols` 版面，換取任務內容更寬的顯示空間、減少不必要的換行；與 Cases/Contacts/Expenses 等資料表「手機橫向滾動」慣例一致，只是這裡桌機也套用。
- **週期提醒（`reminders`）**：獨立的第五區塊，用於「每週關心學生工作進度」這類重複性提醒，與上方待辦的「做完就刪」邏輯不同——到期不會自動消失，需使用者自行確認後手動刪除。`TodoBoard.tsx` 的 `nextOccurrence()` 依 `frequency`/`when` 即時算出下次發生日期（不落地），用於畫面排序（最近到期排最前）與「今天／明天／N 天後／已過期」的顯示文字；`ReminderWhenInput` 依頻率切換不同輸入控制項（星期下拉／月份數字／MM-DD 日期／完整日期）。
- 讀取時經 `sanitizeTodoBoard()` 清理（同上原則），`when` 值格式不符時退回合理預設，避免壞資料造成排序錯誤。

### 3.4 Note（知識庫筆記）

```ts
type NoteType = "general" | "consulting" | "process";
// 一般筆記 / 諮詢紀錄 / 流程化知識（報稅步驟、諮詢提問流程、網站架設說明…）

interface Note {
  id: string;          // nanoid(10)
  title: string;       // 上限 300 字
  content: string;     // Markdown，上限 100,000 字；type === "process" 時不使用
  tags: string[];      // 每個標籤上限 40 字、去重、至多 30 個
  type: NoteType;
  steps: ProcessStep[]; // 流程步驟；僅 type === "process" 使用，重用報價單的 ProcessStep 結構 (§3.1)
  isShared: boolean;   // 是否對外公開
  shareToken: string;  // nanoid(10)，建立時產生、終生不變（分享連結用，避免以 id 被猜到）
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}
```

- 與報價單相同採**逐筆 CRUD + 索引**：`note:{id}` 存單筆、`notes:index`（Sorted Set）排序、`note:share:{token}` 供對外頁反查。
- **流程化知識（`type === "process"`）**：知識庫的第三種筆記類型，用結構化的「步驟」取代自由 Markdown——每步驟有標題／可多行說明／可多個連結（重用報價單「流程說明」的 `ProcessStep`/`ProcessLink` 結構與 `lib/normalize.ts` 的 `normalizeProcessSteps()`，`lib/notes-kv.ts` 的 `sanitizeSteps()` 在其上再加長度上限）；`NotesBoard` 切到此類型時，原本的 Markdown 編輯區（含預覽切換、圖片上傳）整塊換成步驟編輯器（新增/刪除/上移/下移步驟，每步驟可加連結），UI 與互動邏輯直接仿照 `AdminEditor.tsx` 既有的流程步驟編輯器；`content` 欄位保留但此類型不使用。對外分享頁 (`/shared/note/[token]`) 依 `note.type` 分流渲染：`process` 顯示唯讀步驟列表（樣式同 `QuoteView` 的「交付流程」區塊），其餘類型才走 Markdown 渲染。
- **對外分享**：`/shared/note/[token]` Server Component 以 `getNoteByShareToken()` 反查；找不到或 `isShared === false` 一律 `notFound()`（不洩漏是否存在）。內容經 `lib/markdown.ts` 轉為**白名單 HTML** 後唯讀呈現。
- **Markdown 安全性**（`lib/markdown.ts`）：先逐行做區塊解析，內容一律先 `escapeHtml` 再套用行內語法；連結僅允許 `http(s):` / `mailto:` / 站內相對路徑，其餘（如 `javascript:`）降級為純文字，故可安全 `dangerouslySetInnerHTML`。`[文字](網址)` 與**裸網址**（http/https 自動連結化）以同一個 regex 單趟處理、皆帶 `target="_blank" rel="noopener noreferrer nofollow"`；靈感卡片預覽等純文字情境則用 `components/Linkify.tsx`。圖片語法 `![替代文字](網址)` 需優先於一般連結比對（否則開頭的 `!` 會被忽略、誤判成連結），網址一樣經 `sanitizeUrl()` 白名單，輸出 `<img loading="lazy">`。
- **圖片上傳（Vercel Blob）**：`NotesBoard` 內容編輯區可點擊「上傳圖片」、或直接貼上／拖曳圖片到 textarea，經 `POST /api/notes/upload`（`multipart/form-data`，限 PNG/JPEG/GIF/WebP、單檔 8MB）呼叫 `@vercel/blob` 的 `put()` 上傳並取得公開網址，前端自動組成 `![檔名](網址)` 插入游標位置。**未設定 `BLOB_READ_WRITE_TOKEN` 時回 501 並顯示明確錯誤訊息**，不影響其餘功能（同 `OPENAI_API_KEY`/`CRON_SECRET` 的優雅降級慣例）；設定方式見 §6 環境變數與 `.env.local.example`。上傳的圖片以 Markdown 純文字形式存在 `content` 裡，因此自動納入既有的備份/匯出（`lib/backup.ts`）與對外分享頁渲染，無需額外處理。
- 讀取時經 `migrateNote()` 清理/補齊（缺 `shareToken`/`type` 補預設、標籤去重、超長截斷）。
- **標籤瀏覽器（`NotesBoard` 左側，仿 iPhone 備忘錄）**：標籤即虛擬分類，依使用次數排序（同次數依 zh-Hant 字母序）、每個標籤旁顯示筆記數；固定附「全部筆記」（重置）與「未加標籤」（`tags.length === 0`）兩個虛擬分類，避免筆記量變多後漏標的筆記被淹沒找不到。篩選狀態以 `TagFilter`（`{kind:"all"|"untagged"|"tag"}` 判別式）表示，而非拿字串當哨兵值，避免真實標籤剛好撞名；與列表內搜尋、全域搜尋框皆為 AND 疊加。

### 3.5 Case（案件與財務管理）

```ts
type CaseType = "own" | "invoice"; // 我接的案子 / 幫朋友開發票

type PartnerPayStatus = "unpaid" | "deposit" | "paid"; // 未支付 / 已付訂金 / 已結清

interface PaymentEntry {     // 單筆收/付款紀錄 (Payment Ledger)
  id: string;
  date: string;               // YYYY-MM-DD
  amount: number;
  note: string;                // 備註 (如：頭期款、訂金、尾款)
}

interface PartnerCost {      // 合作夥伴費用 (外包成本，Accounts Payable)
  id: string;
  partnerName: string;       // 夥伴名稱 (人脈庫聯絡人名稱快照，或名單外自由填寫)
  contactId: string;         // 關聯人脈庫聯絡人 id ("" = 未關聯)，供「連過去看詳情」
  role: string;              // 負責項目 (前端、設計…)
  amount: number;            // 應付金額
  paidAmount: number;        // 已付金額 (衍生值 = payments 加總，伺服器計算、前端不可覆寫)
  payments: PaymentEntry[];  // 付款紀錄 (逐筆日期＋金額＋備註，如訂金/分期)
  payStatus: PartnerPayStatus;
}

interface Case {
  id: string;                    // nanoid(10)
  name: string;                  // 專案名稱
  caseType: CaseType;            // 案件型態；舊資料遷移預設 "own"
  quoteId: string;               // 關聯報價單 id ("" = 未關聯)
  totalAmount: number;           // 總應收金額 (AR)
  receivedAmount: number;        // 已收款 (衍生值 = receivedPayments 加總，伺服器計算)
  receivedPayments: PaymentEntry[]; // 收款紀錄 (逐筆日期＋金額＋備註，如頭期款/尾款)
  withholdBusinessTax: boolean;  // 代扣 5% 營業稅
  withholdIncomeTax: boolean;    // 代扣 3% 營所稅
  taxPaid: boolean;              // 是否已將代扣稅款從收款中提列出來 (準備繳納/已繳納)
  taxPaidNote: string;           // 提列/繳納補充註記；僅在有代扣稅務時才有意義
  partnerCosts: PartnerCost[];   // 外包成本 (上限 50 筆)
  note: string;                  // 備註
  closedAt?: string;             // 結案時間 (ISO)，undefined = 進行中
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
}

type CaseInput = Omit<Case, "id" | "createdAt" | "updatedAt">;
```

- **逐筆 CRUD + 索引**（同報價單/知識庫）：`case:{id}` + `cases:index`。
- **案件型態（caseType）**：新增案件時先選「💼 我接的案子」或「🧾 幫朋友開發票」。**稅務代扣（5% 營業稅、代收代扣 3% 營所稅）只屬於代開發票型**——own 型 UI 不顯示且 `cleanInput()`/`migrateCase()` 一律強制兩旗標為 `false`（資料層保證一致）；切成 invoice 時預設兩項開啟（可取消）。舊資料遷移為 `own`。
- **代扣稅務合計 + 已提列旗標（`taxPaid`/`taxPaidNote`）**：有開任一代扣時，編輯區顯示「代扣稅務合計」區塊（直接用 `fin.taxTotal`，即營業稅+營所稅加總）與「已提列稅金？」勾選＋備註輸入——收到全款後應先從中提列稅金另行繳納，避免誤當淨利花掉。`taxPaid`/`taxPaidNote` 只在**有代扣稅務**時才有意義：切回 `own` 型或兩項代扣都關閉時，`cleanInput()`/`migrateCase()` 會強制歸零為 `false`/`""`（同 `withholdBusinessTax`/`withholdIncomeTax` 的一致性保證）。
- **資料表 + Modal UI（`CasesBoard`）**：Notion 風格全寬資料表——每列直接顯示 名稱／型態／總金額／已收／未收／淨利／夥伴／備註（`line-clamp-2`），點列彈出置中 Modal 編輯（取代舊的左列表右面板）；財務數字 `tabular-nums` 對齊、未收與淨利依正負著色；手機 `overflow-x-auto`（min-w 960px）。頂部「新增」先選型態。
- **收付款歷程（Payment Ledger）**：`receivedAmount`／`paidAmount` 不再是可直接編輯的數字，改為 `receivedPayments`／`payments` 逐筆紀錄（日期＋金額＋備註）的加總，**伺服器端強制重新計算、忽略前端送來的舊式數字欄位**（`lib/cases-kv.ts` 的 `deriveReceived()` / `sanitizePartnerCosts()`），避免前端 bug 或亂改導致金額失真。`CasesBoard` 的 `PaymentLedger` 元件為 case 收款（Modal 內常駐顯示）與每筆夥伴付款（收折疊、summary 列常駐顯示已付/未付）共用同一元件。
  - **舊資料相容 (backfill)**：改版前只有單一數字欄位的既有案件，讀取時（`migrateCase()`/`sanitizePartnerCosts()`）若逐筆紀錄為空但舊數字 > 0，自動補一筆「既有已收款／已付金額（系統轉入）」的歷史快照（日期取案件建立時間），確保金額**不因改版被清零**；使用者之後編輯存檔即成為正式紀錄。
- **夥伴名稱串接人脈庫（`PartnerPicker`）**：外包成本的「夥伴名稱」為**可搜尋下拉**——列出人脈庫聯絡人（顯示職業），選取即把 `contactId` 與名稱快照寫入該列；名單外的人可「使用自訂名稱」自由填寫（`contactId=""`）。已關聯（或退回同名比對）時，欄位旁出現 ↗ 按鈕**切到人脈庫並直接開啟該聯絡人的 Modal**（`onOpenContact` 由 `AdminWorkspace` 處理跨頁籤 focus；導頁前先關案件 Modal 以免殘留全域 Esc 監聽）；有匯款資訊時該列一併帶出，付款免切頁。
- **關聯報價單為快照**：在後台選擇報價單時把 `clientName`／`total` 帶入 `name`／`totalAmount`，之後可自行修改；報價單後續變動**不會**回寫案件。
- **衍生值不落地**：未收款餘額、代扣稅額、淨利一律由 `lib/finance.ts` 的 `computeCaseFinance()` 即時計算（見 §5.5），KV 只存輸入值。
- 金額經 `toAmount()` 清理：取整數、擋負值與超過 10 億的離譜值。
- **結案狀態（`closedAt`）**：Modal 標頭有「標記為已結案／重新開啟」按鈕，切換的是 `draft.closedAt`（純前端狀態，仍需按「儲存」才落地，與其餘欄位一致，無獨立 API）；`lib/cases-kv.ts` 的 `sanitizeClosedAt()` 擋非法日期值。已結案案件在資料表**預設隱藏**（表頭有「顯示已結案（N）」勾選可切回），顯示時列樣式淡化（`opacity-55`）並附 ✅ 圖示；**🔔 催款提醒排除已結案案件**（已結案不用再追著客戶收款），但 **💸 待付夥伴款不受影響**（案件結案不代表欠夥伴的錢消失，仍需照付）。

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
- **反向連結：相關案件**（`ContactsBoard` 編輯 Modal）：這位聯絡人以夥伴身分出現在哪些案件的**反向查詢**（`Case.partnerCosts[].contactId === contact.id`），是案件管理「夥伴連過去看詳情」的反方向。`AdminWorkspace` 傳入 `cases`（初始快照，與 `CasesBoard` 收到的 `contacts` 同一慣例——非即時同步，切頁時資料是當次載入的定格）；同案件多筆費用列會合併成一項（金額加總、已付加總、付款狀態取最悲觀者）。點列跳轉邏輯與案件管理的「連過去」對稱：`goToCase()` 先關自身 Modal（避免殘留全域 Esc 監聽）→ `onOpenCase` 切到案件管理頁籤 → `focusCaseId` 觸發 `CasesBoard` 的 `useEffect` 自動開啟該案件 Modal（`onFocusHandled` 清空避免重複開啟），與既有 `focusContactId`/`onOpenContact` 完全對稱的一組 props。

### 3.7 Expense（支出紀錄）

```ts
type ExpenseEntity = "company" | "personal";           // 歸屬：公司支出 / 個人支出
type ExpenseCategory =
  | "one-time" | "subscription" | "sponsorship" | "recurring";
  // 一次性 / 訂閱制 / 贊助・小額捐款 / 固定週期規費 (保險、會計費…)
type BillingCycle = "none" | "monthly" | "yearly";      // 不重複 / 每月 / 每年扣款

interface Expense {
  id: string;                    // nanoid(10)
  title: string;                 // 支出項目名稱 (如：Figma 訂閱、單次會計費、捐款)
  amount: number;
  entity: ExpenseEntity;         // 公司 / 個人
  category: ExpenseCategory;     // 性質分類 (與 billingCycle 為獨立兩軸，互不影響)
  billingCycle: BillingCycle;    // 扣款週期，供 Burn Rate 換算月支出
  transactionDate: string;       // YYYY-MM-DD，交易日期或下次扣款日
  note: string;
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
}

type ExpenseInput = Omit<Expense, "id" | "createdAt" | "updatedAt">;
```

- **逐筆 CRUD + 索引**（同案件/人脈庫）：`expense:{id}` + `expenses:index`。
- **資料表 + Modal UI（`ExpensesBoard`）**：Notion 風格全寬資料表——每列直接顯示 項目名稱／歸屬／分類／週期／金額／日期／備註（`line-clamp-2`），點列彈出置中 Modal 編輯；頂部「新增支出」直接開空白 Modal（沿用 `ContactsBoard` 的慣例：新增模式不依 `dirty` 鎖 Save 按鈕，編輯模式才鎖）。手機 `overflow-x-auto`（min-w 820px），統計卡在 `grid-cols-1 sm:grid-cols-2` 下自動垂直堆疊。
  > ⚠️ 表頭旁的「新增支出」按鈕務必加 `shrink-0 whitespace-nowrap`：手機窄版若標題／說明文字把按鈕擠到極窄，CJK 文字（無空格）會在任意字元間斷行，導致按鈕文字直排——這是本模組實作時抓到並修正過的真實 bug，其他頁籤新增按鈕若照抄此標頭排版務必留意同一陷阱。
- **每月固定支出 (Burn Rate)**：`ExpensesBoard` 內的 `monthlyEquivalent(e)` 依 `entity` 分組加總——`billingCycle === "monthly"` 全額計入、`"yearly"` 除以 12 計入、`"none"`（一次性／贊助）不計入；與 `category` 完全獨立（不因分類是「訂閱制」而自動視為週期扣款，一律看 `billingCycle`）。衍生值不落地，切換頁籤或編輯後即時重算。
- 金額經 `toAmount()` 清理（同 Case/Contact 慣例）：取整數、擋負值與超過 10 億的離譜值；`transactionDate` 非 `YYYY-MM-DD` 格式時退回建立日期或今天。

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
| `POST /api/notes/upload` | 🖼️ 上傳圖片至 Vercel Blob，`multipart/form-data` 欄位 `file`（限 PNG/JPEG/GIF/WebP、≤8MB）→ `{ url }`。未設 `BLOB_READ_WRITE_TOKEN` 回 501 | 需登入 | `put()`（`@vercel/blob`） |
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
| `GET /api/expenses` | 列出所有支出（新→舊） | 需登入 | `getAllExpenses()` |
| `POST /api/expenses` | 建立新支出 | 需登入 | `createExpense()` |
| `GET /api/expenses/[id]` | 讀取單筆支出 | 需登入 | `getExpense()` |
| `PUT /api/expenses/[id]` | 更新支出（保留 `id`/`createdAt`） | 需登入 | `updateExpense()` |
| `DELETE /api/expenses/[id]` | 刪除支出（同時移出 index） | 需登入 | `deleteExpense()` |
| `POST /api/matrix` | ✨ 內容矩陣引擎：body `{ title, content }` → `{ script }`（300 字內短影音腳本）。未設 `OPENAI_API_KEY` 回 503 | 需登入 | `generateText()`（ai + @ai-sdk/openai，`gpt-4o`） |
| `GET /api/backup/export` | 匯出目前全部資料為 JSON 檔（`Content-Disposition: attachment`） | 需登入 | `exportAllData()` |
| `GET /api/backup/snapshot` | 建立一份備份快照，自動輪替只保留最近 7 份 | 需登入 **或** Cron（見 §5.7） | `snapshotBackup()` |
| `GET /api/backup/list` | 列出所有備份快照（新→舊，含各模組筆數摘要） | 需登入 | `listBackups()` |
| `POST /api/backup/restore` | **危險操作**：還原至指定快照，body `{ id }`，會清空並覆寫目前全部資料 | 需登入 | `restoreBackup()` |
| `POST /api/admin/login` | 驗證密碼、設定 `sb_admin` cookie；同 IP 15 分鐘內失敗 5 次鎖定 15 分鐘（回 429） | 公開 | `verifyPassword()` + `lib/login-throttle.ts` |
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
- 使用點：`CasesBoard` 編輯區的即時財務摘要、資料表列（每列 `computeCaseFinance(c)`）、頂部**催款提醒**區塊（列出所有 `unpaidBalance > 0` 的案件，金額大→小，標題顯示未收合計）。
- **單筆夥伴費用已付金額**：`partnerCostPaid(p: PartnerCost): number`（已結清視同付滿全額；其餘取 `paidAmount` 但不超過 `amount`）——`computeCaseFinance()` 與下方 `collectPartnerDues()` 共用同一邏輯，避免兩處算法各自飄移。

**待付夥伴款彙總（`collectPartnerDues()`）**——跨案件彙總「你欠夥伴的錢」，供 `CasesBoard` 的「💸 待付夥伴款」總覽區塊使用：

```ts
interface PartnerDueItem { caseId: string; caseName: string; outstanding: number; }
interface PartnerDue {
  key: string;              // 分組鍵：有 contactId 用它，否則用 `name:{正規化姓名}`
  contactId: string;        // "" = 名單外自訂
  partnerName: string;
  totalOutstanding: number; // 此夥伴橫跨所有案件的應付總額
  items: PartnerDueItem[];  // 各案件明細 (同案件同夥伴的多筆費用列會合併成一項)，金額大→小
}

function collectPartnerDues(cases: Case[]): PartnerDue[];
```

- 依 `contactId`（有關聯人脈庫）或正規化姓名分組；`outstanding <= 0`（已結清）的費用列不計入，故完全付清的夥伴不會出現在總覽中。
- 結果依 `totalOutstanding` 大→小排序，供一眼看出優先該付誰。
- UI：`CasesBoard` 於頂部渲染，每位夥伴可展開看各案件明細（點案件名稱直接開該案 Modal）；有 `contactId` 時額外顯示 ↗ 按鈕，同案件管理頁「連過去看詳情」的邏輯，切到人脈庫並開啟該聯絡人 Modal。

### 5.6 後台驗證（`lib/auth.ts`）

以 `ADMIN_PASSWORD` 環境變數作為單一密碼閘門：

- **開關**：未設定 `ADMIN_PASSWORD` → `isAuthenticated()` 恆為 `true`（開放，利於本機）；設定後才啟用保護。
- **登入**：`POST /api/admin/login` 用 `crypto.timingSafeEqual` 比對密碼（等長才比，避免時序攻擊），通過後種下 cookie。
- **Cookie**：名稱 `sb_admin`，值為 **不可逆令牌** `sha256(ADMIN_PASSWORD + "::siddblue-quote-system")`（不存明碼）；`httpOnly`、`sameSite=lax`、正式環境 `secure`、有效期 30 天。
- **驗證**：`isAuthenticated()` 比對請求 cookie 是否等於 `expectedToken()`。
- **保護範圍**：`/admin` 頁面（`app/admin/page.tsx`）＋所有寫入類 API（quotes 的 POST/PUT/PATCH/DELETE、inspirations/todos 的 GET/PUT）。
- **公開例外**：`GET /api/quotes/[id]` 與 `POST /api/quotes/[id]/accept`（對外報價/確認頁需要）。

> 🔒 安全守則：切勿在程式或紀錄中輸出 `ADMIN_PASSWORD`；`.env.local` 須維持在 `.gitignore`。

**防暴力破解（`lib/login-throttle.ts`）**：`POST /api/admin/login` 依來源 IP（`x-forwarded-for` 標頭，取不到則退回 `req.ip`）限制連續失敗次數——同一 IP 在 15 分鐘內累計失敗達 5 次即鎖定 15 分鐘，鎖定期間即使密碼正確也拒絕（回 `429` 附倒數分鐘數的錯誤訊息）；登入成功立即清除該 IP 的失敗計數。記錄本身以單一 TTL（15 分鐘）隨最後一次失敗延展，久無失敗自然過期歸零，無需額外清理排程；儲存慣例與其餘 `*-kv.ts` 一致（`KV_ENABLED` 判斷、無 KV 時退回 `globalThis` 記憶體）。**密碼顯示切換**：`AdminLogin.tsx` 密碼欄位旁附眼睛圖示，點擊切換 `input type="password"/"text"`，純前端狀態、不影響送出的密碼內容。

### 5.7 資料備份與匯出（`lib/backup.ts`）

系統的所有資料都在同一個 Upstash KV 執行個體，看板類又是整包覆寫——一次寫入錯誤就可能蓋掉全部資料，因此設計了獨立的備份層：

- **匯出（`exportAllData()`）**：平行讀取七個模組的完整資料（報價單、靈感看板、待辦清單、知識庫、案件管理、人脈庫含手動排序、支出紀錄），組成單一 `BackupPayload` JSON 物件。`GET /api/backup/export` 直接回傳此物件並帶 `Content-Disposition: attachment`，後台按「匯出 JSON」即下載。
- **快照（`snapshotBackup()`）**：呼叫 `exportAllData()`，以 `nanoid(12)` 產生備份 id，寫入 `backup:data:{id}`（完整內容）與 `backup:meta:{id}`（時間 + 各模組筆數的輕量摘要），並把 id 存進 `backups:index`（sorted set，score=建立時間）。**輪替**：寫入後檢查 `backups:index` 筆數，超過 7 份即刪除最舊的（`rotateBackups()`）。
- **列表（`listBackups()`）**：只讀取輕量的 `backup:meta:{id}`，不觸碰大型的 `backup:data:{id}`，列表載入快速。
- **還原（`restoreBackup(id)`）**——⚠️ **危險操作**：讀出該快照的完整 payload，平行呼叫七個模組各自的 `restore*()` 函式（`restoreQuotes()` / `saveInspirations()` / `saveTodos()` / `restoreNotesData()` / `restoreCasesData()` / `restoreContactsData()` / `restoreExpensesData()`），每個都是「先清空現有全部 key、再依快照內容重新寫入」，讓還原後的狀態與快照當時**完全一致**（而非合併）。`payload.expenses ?? []` 相容新增支出模組前建立的舊快照（缺此欄位）。UI 層（`BackupPanel`）在呼叫前以 `window.confirm()` 顯示快照時間與各模組筆數，要求使用者二次確認；還原成功後自動重整頁面。
- **每日自動快照（Vercel Cron）**：`vercel.json` 設定 `crons: [{ path: "/api/backup/snapshot", schedule: "0 18 * * *" }]`（UTC 18:00 = 台北 02:00）。Vercel Cron 只送 `GET`；`/api/backup/snapshot` 的 `isCronOrAdmin()` 判斷請求是否帶有 `Authorization: Bearer <CRON_SECRET>`（Vercel 在設定 `CRON_SECRET` 環境變數後會自動附加此標頭），否則退回一般的 `isAuthenticated()` cookie 驗證（供後台「立即備份」手動按鈕使用）。
  > ⚠️ 需在 **Vercel Dashboard → Project → Settings → Environment Variables** 手動設定 `CRON_SECRET`（任意隨機字串，如 `openssl rand -hex 32`）才能讓每日排程通過驗證；未設定前，排程呼叫會被拒絕（401），但手動備份按鈕不受影響。
- **記憶體後援**：本機無 KV 時，快照存於 `globalThis.__sbBackupsMem`（同其餘 `*-kv.ts` 慣例），重啟即清空，方便安全地在本機測試還原流程而不動到正式 KV。

### 5.8 PWA（加到主畫面）

讓手機瀏覽器可將 `/admin` 後台「加到主畫面」，以接近原生 App 的獨立視窗開啟：

- **`app/manifest.ts`**：Next.js 特殊檔案慣例，自動產生 `/manifest.webmanifest` 並在 `<head>` 插入對應 `<link>`（無需手動掛載）。`start_url: "/admin"`、`display: "standalone"`、`theme_color`/`background_color` 對齊品牌識別。
- **圖示（`lib/pwa-icon.tsx` 共用視覺）**：品牌藍色漸層背景 + 白色 `{ }` 括號標記（呼應 `components/BrandDecor.tsx` 的 `CodeBraces`），以 **`next/og` 的 `ImageResponse`** 動態產生 PNG，不需另外準備圖檔。
  - `app/icon.tsx` 用 `generateImageMetadata()` 一次產生 192／512 兩種尺寸（manifest 的最小需求），Next.js 自動路由至 `/icon/192`、`/icon/512` 並插入對應 `<link rel="icon">`。
  - `app/apple-icon.tsx` 產生 180×180 給 iOS 讀取（`<link rel="apple-touch-icon">`）。
  - `app/layout.tsx` 的 `metadata.appleWebApp = { capable: true, ... }` 讓 iOS 加到主畫面後**無 Safari 網址列**（全螢幕獨立視窗）；`viewport.themeColor` 統一分頁/工具列顏色。
- **刻意不加 Service Worker**：本系統所有讀取都經 `noStore()` 強制拿最新資料（見 §5.4），若加上離線快取，Service Worker 攔截 API 請求時很容易讓後台顯示過期的報價/案件/收付款資料——「離線可用」對這個內部工具的價值遠低於「資料一定是最新的」，故只做「加到主畫面＋獨立視窗」，不做任何離線快取。

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
| `CRON_SECRET` | 📦 驗證 Vercel Cron 對 `/api/backup/snapshot` 的每日排程呼叫；未設定時排程會被拒絕，但後台手動「立即備份」不受影響 | 建議設定（見 §5.7） |
| `BLOB_READ_WRITE_TOKEN` | 🖼️ 知識庫圖片上傳（`/api/notes/upload`）呼叫 `@vercel/blob` 所需；未設定時該功能回 501、其餘功能不受影響 | 使用圖片上傳時必填 |

---

## 7. 部署

- Git push 到 `main` → **Vercel 自動部署**。
- 正式網址：`https://siddblue-system.vercel.app`（請以此網域為準；帶部署雜湊的網址會鎖定在舊版建置）。
- KV 環境變數由 Vercel 的 KV 整合自動注入；`ADMIN_PASSWORD` / `CRON_SECRET` 於 Project → Settings → Environment Variables 手動加入。
- **`vercel.json`**：宣告每日備份的 Cron Job（`/api/backup/snapshot`）。Vercel 部署時會自動讀取此檔案並註冊排程，無需額外設定；但驗證用的 `CRON_SECRET` 仍需手動於 Dashboard 設定（見 §5.7）。

---

## 8. 擴充新功能的建議路徑

- **新增報價單欄位**：改 `lib/types.ts`（`Quote` + 視需要調整 `QuoteInput` 的 `Omit`）→ `lib/normalize.ts`（清理）→ `lib/defaults.ts`（預設值）→ `AdminEditor` 表單 + `QuoteView`/`PrintSheet` 呈現 →（如需相容舊資料）`migrateQuote()`。
- **新增工作區模組**：整包看板類仿 `lib/workspace-kv.ts`（`workspace:*` blob + `GET/PUT`）；逐筆實體類仿 `lib/cases-kv.ts` / `lib/contacts-kv.ts`（`{entity}:{id}` + sorted set 索引 + CRUD API），再於 `AdminWorkspace` 增一個頁籤面板（沿用 `hidden` 切換）。
- **金額/稅務調整**：報價單改 `lib/format.ts` 的 `computeTotals()` / `TAX_RATE`；案件淨利改 `lib/finance.ts` 的 `computeCaseFinance()` / 稅率常數，各處會一致套用。
- **保持慣例**：所有 KV 讀取務必 `noStore()`；寫入類 API 一律先 `isAuthenticated()`；不要把路由改成 Edge runtime。
