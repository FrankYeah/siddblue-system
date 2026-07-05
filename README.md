# 西打藍好內容有限公司 — 報價單與規格生成工具

> Next.js (App Router) + Tailwind CSS + Vercel KV
> 數位專案的「報價 → 規格確認 → 正式報價單 (含大小章)」一站式工具。

---

## ✨ 功能總覽

| 路由 | 說明 |
| --- | --- |
| `/` | 品牌首頁（深藍漸層 + 紙飛機 / 海鷗微動畫） |
| `/admin` | 後台管理：動態項目、即時加總、一鍵範本、CSV 匯出、儲存生成連結 |
| `/quote/[id]` | 對外規格確認頁（Notion 風格）＋ 客戶線上確認 ＋ 一鍵匯出企業級 Excel 報價單 (自動押大小章) |
| `/api/quotes` | `GET` 列表 / `POST` 建立 |
| `/api/quotes/[id]` | `GET` 讀取 / `PUT` 更新 / `PATCH` 切換狀態 / `DELETE` 刪除 |
| `/api/quotes/[id]/accept` | `POST` 客戶線上確認接受報價（公開，首次確認後鎖定） |
| `/api/inspirations` | `GET` 讀取靈感看板 / `PUT` 儲存整個看板（需登入） |
| `/api/todos` | `GET` 讀取待辦清單 / `PUT` 儲存整個清單（需登入） |
| `/api/notes` `(/[id])` | 📚 知識庫筆記 CRUD（需登入）；`/shared/note/[token]` 為對外唯讀分享頁 |
| `/api/cases` `(/[id])` | 💼 案件與財務管理 CRUD（需登入） |
| `/api/contacts` `(/[id])` | 🤝 人脈庫 CRUD（需登入） |
| `/api/contacts/import` | `POST` 人脈庫 CSV 整批匯入（需登入，單批 ≤ 500 筆） |
| `/api/matrix` | `POST` ✨ 內容矩陣引擎：長文 → 短影音腳本（需登入 + `OPENAI_API_KEY`） |
| `/api/backup/export` | `GET` 📦 匯出全部資料為 JSON 檔（需登入） |
| `/api/backup/snapshot` | `GET` 建立備份快照，最多保留 7 份（需登入或 Cron） |
| `/api/backup/list` | `GET` 列出所有備份快照（需登入） |
| `/api/backup/restore` | `POST` 還原至指定快照（**危險操作**，需登入） |
| `/api/admin/login` | `POST` 登入 / `DELETE` 登出 |
| `/api/test-db` | `GET` Vercel KV 連線健檢（寫入→讀回→比對；`?keep=1` 保留） |

### 創作者工作區 (Creator Workspace)
`/admin` 以頁籤切換六個工具（純前端切換、不重整、各自保留狀態）：
- **💰 報價系統**：原有報價單功能。
- **💼 案件管理**：專案財務中心，**Notion 風格資料表**——每列直接顯示
  名稱 / 型態 / 總金額 / 已收 / 未收 / 淨利 / 夥伴 / 備註，點列彈出 Modal 編輯。
  **兩種案件型態**（💼 我接的案子 / 🧾 幫朋友開發票，新增時先選；只有代開發票才有
  「代扣 5% 營業稅」「代收代扣 3% 營所稅」開關）、關聯報價單（自動帶入名稱與總金額）、
  應收帳款（頂部**催款提醒**列出所有未收款案件與未收合計，收款改為**逐筆收款紀錄**
  ——日期＋金額＋備註，如「頭期款」「尾款」，Modal 內常駐顯示、新增/刪除即時重算）、
  合作夥伴費用（夥伴名稱為**可搜尋下拉選單串接人脈庫**，選取後可一鍵**連過去看該人詳情**、
  帶出匯款資訊 / 負責項目 / 應付金額 / **逐筆付款紀錄**（訂金/分期，折疊顯示、
  摘要列常駐已付/未付）/ 付款狀態），自動算出**實際淨利 (Net Profit)**；
  頂部另有 💸 **待付夥伴款**總覽（跨案件彙總你欠每位夥伴多少，展開看各案件明細）。
- **📝 寫作靈感**：四欄看板（💡靈感池 / 📰長文電子報 / 🎬短影片 / 📦已封存），
  以 `@hello-pangea/dnd` 拖曳切換狀態，點卡片開 Modal 編輯（多行 / 基本 Markdown）；
  已封存欄卡片淡化。每次變更即存回 KV（`workspace:inspirations` 單一 JSON blob）。
- **✅ 待辦清單**：四區（🔥立即處理 / ⏳稍後再說 / 🎯長期要做的事 / 🚗外出待辦），
  點「新增」加入、🗑️ 直接刪除，存於 `workspace:todos`。
- **📚 知識庫**：取代 Apple Notes 的筆記中心（Markdown、標籤、諮詢模板、
  編輯/預覽切換、一鍵開對外唯讀分享連結 `/shared/note/[token]`）。
- **🤝 人脈庫**：Connections CRM，**Notion 風格資料表**——每列直接顯示
  姓名 / **職業別彩色標籤**（同職業同色、相鄰分組必不同色）/ 合作方向 / 狀態 /
  熟悉・能力・價格徽章 / **網址連結圖示** / 備註（兩行截斷）；
  **點任一儲存格的值即套用該值篩選**（再點一次取消，可疊加），點列彈出 Modal 編輯完整欄位
  （職業別為**下拉多選**、聯絡方式、網址、匯款資訊、喜好度、備註…）；**拖曳排序**
  （`@hello-pangea/dnd`，順序整包存回 KV）、每列 Hover「＋」**插入於該列下方**、
  職業別＋狀態＋合作方向快速篩選；
  未手動排序時預設「同合作方向、同職業別」分組相鄰，「重新分組」一鍵還原；
  手機橫向滾動。支援**匯入 CSV**（第一列表頭、欄位順序不拘，
  高/中/低/不確定與就業/接案/創業/學生自動正規化，相容 Notion 匯出格式）。
- **🏦 銀行資訊快捷面板**：導覽列常駐——個人（台新 812 敦南 0023）與
  公司（國泰世華 013 基隆 1243 + 統編）帳戶，一鍵複製完整匯款資訊或純數字帳號（Toast 提示）。
- **📦 資料備份與匯出**：導覽列常駐——「匯出 JSON」下載目前全部資料；「立即備份」
  手動建立快照；每日由 Vercel Cron 自動快照一次，最近 7 份可一鍵「還原」（危險操作，
  會覆寫目前所有資料，需二次確認）。
- **🔍 全域搜尋框**：導覽列下方的即打即搜（寫作靈感、知識庫、案件、人脈皆支援）；
  44px 觸控高度、16px 字級防 iOS 聚焦縮放；搜尋中拖曳自動暫停。
- **🔗 自動連結化 (Auto-Linkify)**：靈感卡片與筆記內容中的 `http(s)://` 網址
  自動轉為可點擊連結（另開新分頁、品牌色 + hover），分享頁與後台預覽皆適用。

### ✨ 內容矩陣引擎 (Content Matrix Engine)
在「📝 寫作靈感 → 長文電子報」欄的卡片 Modal 中，按 **「✨ 矩陣生成：轉短影音」**：
- 後端 `/api/matrix` 以 **Vercel AI SDK（`ai` + `@ai-sdk/openai`，模型 `gpt-4o`）**
  扮演資深內容總監，把長文萃取成 300 字內的短影音腳本
  （黃金前 3 秒 Hook → 核心邏輯推演 → 強而有力 CTA）。
- 生成結果自動建立成新卡片、放入「🎬 短影片」欄並即時同步 KV。
- 需設定環境變數 `OPENAI_API_KEY`（見 `.env.local.example`）；
  未設定時按鈕會回覆明確錯誤提示，其餘功能不受影響。

### 亮點
- **內建網站案範本**：9 項標準報價、專案需求、7 階段流程與雲端/設計稿連結欄位皆預設好，開新報價幾乎只需填客戶名與頁數。
- **報價單狀態管理**：後台列表每份報價單附狀態徽章（草稿=灰 / 已發送=藍 / 已確認=綠），點擊即可切換並同步 KV；客戶線上確認後自動標記為「已確認」。
- **營業稅自動計算**：編輯頁可切換「未稅 / 含稅 (+5%)」（預設未稅）。含稅時自動顯示「未稅金額 / 稅金 5% / 含稅總計」，前台頁與匯出的 PDF/Excel/CSV 皆同步呈現最終金額。
- **手機優先 (Mobile-first)**：輸入框字級 16px 避免 iOS 聚焦放大、按鈕與輸入至少 44px 觸控高度；報價項目在手機改為卡片式堆疊；後台頁籤在手機改為底部導覽列。
- **即時加總**：編輯項目費用時，總計金額即時更新。
- **項目排序 / 複製報價單**：項目與流程步驟可上下移動；既有報價可一鍵複製為新草稿。
- **一鍵帶入預設範本**：維護級距（大/小/微）、交付流程、付款帳戶、補充說明一次填好。
- **CSV 匯出**：帶 UTF-8 BOM，Excel 開啟中文不亂碼。
- **客戶線上確認**：客戶於 `/quote/[id]` 填名確認後，記錄時間與姓名到 KV，後台列表與正式報價單皆顯示已確認章記；首次確認後鎖定，防止竄改。
- **雙版面**：螢幕 = 品牌 Notion 風格；列印 / PDF = 無邊框、方格線的嚴謹 Excel 報價單。
- **電子大小章**：正式報價單自動載入 `public/assets/company-stamps.png`。
- **後台密碼保護**：設定 `ADMIN_PASSWORD` 後 `/admin` 與寫入 API 需登入。

---

## 🚀 快速開始

> 需求：**Node.js 18.17+**（本專案使用 Next.js 14）。

```bash
# 1. 安裝相依套件
npm install

# 2. 設定環境變數
cp .env.local.example .env.local
#   → 填入 Vercel KV 金鑰（見下方）

# 3. 啟動開發伺服器
npm run dev
# 打開 http://localhost:3000/admin
```

> 💡 **本機沒接 KV 也能跑**：若未設定 `KV_REST_API_URL`，系統會自動改用
> 記憶體儲存（重啟即清空），方便先試 UI；正式上線請務必接上 Vercel KV。

---

## 🛠️ 開發指令 (Scripts)

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動開發伺服器（http://localhost:3000） |
| `npm run build` | 產生正式建置（含型別檢查與 lint） |
| `npm run lint` | ESLint（`eslint-config-next`） |
| `npm run typecheck` | TypeScript 型別檢查（`tsc --noEmit`，不產出檔案） |
| `npm run check` | **一鍵品質檢查**：依序跑 lint + typecheck（`npm-run-all`） |
| `npm run format` | Prettier 全案自動格式化（設定見 `.prettierrc`；`*.md`、`public/` 已排除） |
| `npm run format:check` | 只檢查格式、不改檔案（適合 CI） |

> 建議在 commit 前跑 `npm run check`；`npm run format` 為選用（新程式碼已符合 prettier 風格，跑一次即可統一舊檔）。

---

## 🔑 Vercel KV 設定

1. Vercel Dashboard → 你的專案 → **Storage** → **Create Database** → 選 **KV (Upstash Redis)**。
2. 建立後進入該 KV 的 **`.env.local`** 分頁，複製以下金鑰到你的 `.env.local`：

```env
KV_URL="..."
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."

ADMIN_PASSWORD="你的後台密碼"
NEXT_PUBLIC_SITE_URL="https://your-project.vercel.app"

# ✨ 內容矩陣引擎（選用；未設定則僅該功能停用）
OPENAI_API_KEY="sk-..."

# 📦 資料備份每日自動快照（選用；未設定則排程會被拒絕，手動備份不受影響）
CRON_SECRET="任意隨機字串，如 openssl rand -hex 32"
```

3. 部署到 Vercel 時，這些變數會由 KV 整合自動注入（或於 Project Settings → Environment Variables 手動加入 `ADMIN_PASSWORD` / `CRON_SECRET`）。

### 資料儲存結構
```
quote:{id}       → 單筆報價單 (JSON)
quotes:index     → sorted set，score = 更新時間，供後台列表新→舊排序
note:{id}        → 單筆知識庫筆記；notes:index 同上；note:share:{token} 反查
case:{id}        → 單筆案件（財務，含收/付款逐筆紀錄）；cases:index 同上
contact:{id}     → 單筆人脈聯絡人；contacts:index 同上
workspace:*      → 靈感看板 / 待辦清單（整包 JSON blob）
backups:index    → 備份快照索引；backup:meta:{id} 摘要、backup:data:{id} 完整內容（最多 7 份）
```

---

## 🖨️ 匯出正式報價單（PDF / 列印）

前台 `/quote/[id]` 點擊 **「匯出正式報價單」**：
- 透過 `window.print()` 觸發瀏覽器列印。
- CSS `@media print` 會**隱藏 Banner 與所有按鈕**，自動切換為
  **無邊框、帶格線的 Excel 企業排版**，並帶入公司大小章。
- 在列印對話框選「另存為 PDF」即可得到 PDF 檔。
- 想先在螢幕上預覽此版面，可按 **「預覽 Excel 版」** 切換。

> 需要程式化產生 PDF（免手動列印）時，可加裝 `html2pdf.js` 對
> `.print-sheet` 節點呼叫匯出；目前預設採 CSS 列印方案，零額外相依、排版最穩定。

### 放置大小章
把去背 PNG 命名為 `company-stamps.png` 放到 `public/assets/`（詳見該資料夾的 README）。

---

## 🎨 視覺識別
- 主色深藍漸層：`#0052D4 → #4364F7 → #6FB1FC`（海洋與天空）。
- 紙飛機 / 白色海鷗：`components/BrandDecor.tsx` 內的 SVG + 微動畫。
- 程式碼括號 `{ }` 點綴，呼應工程質感。
- 前台採 Notion 風格：淡米色 / 淺灰區塊、細緻邊框、清晰黑字。

---

## 📁 專案結構
```
app/
  layout.tsx            全域版型 / 字型
  page.tsx              品牌首頁
  globals.css           Tailwind + 列印 Excel 樣式
  admin/
    page.tsx            後台 (server，含驗證)
    AdminLogin.tsx      密碼登入
    AdminEditor.tsx     報價編輯器 (主功能)
  quote/[id]/
    page.tsx            前台 (server，抓資料)
    QuoteView.tsx       品牌頁 + 列印 Excel 報價單
    not-found.tsx       404
  api/
    quotes/route.ts         列表 / 建立
    quotes/[id]/route.ts    讀取 / 更新 / 刪除
    backup/export/route.ts    匯出 JSON
    backup/snapshot/route.ts  建立快照 (Cron 或手動)
    backup/list/route.ts      列出快照
    backup/restore/route.ts   還原快照
    admin/login/route.ts    登入 / 登出
lib/
  types.ts        型別 (Schema)
  defaults.ts     硬編碼企業預設值
  kv.ts           Vercel KV 存取層 (+記憶體後援)
  backup.ts       📦 資料備份：匯出/快照/列表/還原
  format.ts       金額 / 加總 (client+server 共用)
  csv.ts          CSV 匯出
  normalize.ts    輸入清理
  auth.ts         後台密碼保護
components/
  BrandDecor.tsx  紙飛機 / 海鷗 / { } 裝飾
  BackupPanel.tsx 📦 資料備份與匯出面板
public/assets/    company-stamps.png (大小章)
vercel.json       Cron 排程設定 (每日備份)
```

---

## 🏢 已硬編碼的企業預設值（`lib/defaults.ts`）
以「西打藍實際網站案報價單」為藍本，新建報價單時自動帶入，通常只需改頁面數量、風格與服務說明：

- 公司抬頭：**西打藍好內容有限公司**、統一編號 **93662829**
- 付款帳戶：國泰世華銀行 (013) 基隆分行 (1243)，帳號 **1240-3500-9494**（已確認）
- **預設報價項目（9 項）**：視覺風格、設計規範、網站畫面、響應式設計、網站工程開發、響應式工程開發（前 6 項每案必備）＋ 網站關鍵字、網站文、媒體文（偶爾加入，預填省得重打，不需要就刪該列）。可用「帶入預設項目」重置。
- **專案需求（projectBrief）**：服務說明、網站風格（預設「未定」）、網站頁面（預填常用頁面結構）。
- **流程說明（結構化）**：7 個階段（第一次會議討論 → 網站素材 → 討論風格確認 → 選定網站風格 → 準備網站資料 → 第一版風格確認 → 後續製作），每階段含標題、說明與**連結欄位**；雲端資料夾、設計稿位置已預留，貼上網址即成客戶可點連結。
- 維護級距：大調整 5,000–10,000 / 小調整 2,000–3,000 / 微調整 暫不收費
- 補充說明：10 天內免費微調、交付網站操作說明

需調整預設值，直接編輯 `lib/defaults.ts` 即可。舊資料（流程為純文字、無專案需求）在讀取時會自動相容升級。
