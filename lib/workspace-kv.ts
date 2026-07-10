import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Inspiration,
  InspirationBoard,
  InspirationStatus,
  Reminder,
  ReminderFrequency,
  Todo,
  TodoBoard,
  TodoBucket,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  創作者工作區資料層 (Vercel KV)
//
//  儲存結構 (單一 JSON blob，方便拖曳整體重排、原子寫入)：
//    workspace:inspirations → { board: InspirationBoard, rev: number }
//    workspace:todos        → { board: TodoBoard,        rev: number }
//
//  rev 為遞增版本號，防「跨裝置/跨分頁互蓋」：整包覆寫 PUT 若帶上
//  expectedRev 且與現存不符，代表另一個裝置在這期間寫入過 ——
//  拒絕寫入並回傳最新內容，而不是默默用舊快照蓋掉對方的變更。
//  （useQueuedSave 只能序列化「同一個分頁」內的請求，跨裝置管不到）
//  版本與資料存在同一個 key，單次 SET 原子落地、不會 split-brain。
//  舊資料是裸看板（無包裝），讀取時視為 rev 0，無需遷移。
//
//  沿用 lib/kv.ts 的慣例：讀取一律 noStore()；未設定 KV 時用記憶體後援。
// ─────────────────────────────────────────────────────────────

const INSPIRATIONS_KEY = "workspace:inspirations";
const TODOS_KEY = "workspace:todos";

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// 記憶體後援
// 掛在 globalThis 上，確保開發模式下 Route Handler 與 Server Component
// 這些分開打包的模組實例共用同一份資料 (正式環境走 KV，不會用到此後援)。
const mem = ((
  globalThis as unknown as {
    __sbWorkspaceMem?: {
      inspirations: InspirationBoard | null;
      todos: TodoBoard | null;
    };
  }
).__sbWorkspaceMem ??= { inspirations: null, todos: null });

// 版本號的記憶體後援獨立掛載，避免動到既有 __sbWorkspaceMem 的形狀
const memRev = ((
  globalThis as unknown as {
    __sbWorkspaceRevMem?: { inspirations: number; todos: number };
  }
).__sbWorkspaceRevMem ??= { inspirations: 0, todos: 0 });

const INSPIRATION_STATUSES: InspirationStatus[] = [
  "idea",
  "newsletter",
  "shortvideo",
  "archived",
];
const TODO_BUCKETS: TodoBucket[] = ["now", "later", "longterm", "errand"];
const REMINDER_FREQUENCIES: ReminderFrequency[] = [
  "weekly",
  "monthly",
  "yearly",
  "once",
];

export function emptyInspirationBoard(): InspirationBoard {
  return { idea: [], newsletter: [], shortvideo: [], archived: [] };
}

export function emptyTodoBoard(): TodoBoard {
  return { now: [], later: [], longterm: [], errand: [], reminders: [] };
}

// ── 清理 / 補齊 (防止壞資料) ──

function sanitizeInspiration(raw: unknown): Inspiration {
  const c = (raw ?? {}) as Partial<Inspiration>;
  return {
    id: String(c.id || nanoid(10)),
    title: String(c.title ?? "").slice(0, 300),
    content: String(c.content ?? "").slice(0, 20000),
    updatedAt: String(c.updatedAt || new Date().toISOString()),
  };
}

export function sanitizeInspirationBoard(raw: unknown): InspirationBoard {
  const board = emptyInspirationBoard();
  const src = (raw ?? {}) as Partial<Record<InspirationStatus, unknown>>;
  for (const status of INSPIRATION_STATUSES) {
    const list = src[status];
    if (Array.isArray(list)) {
      board[status] = list.map(sanitizeInspiration);
    }
  }
  return board;
}

function sanitizeTodo(raw: unknown): Todo {
  const t = (raw ?? {}) as Partial<Todo>;
  return {
    id: String(t.id || nanoid(10)),
    title: String(t.title ?? "").slice(0, 500),
  };
}

/** 依 frequency 清理 when 值，格式不符時退回合理預設，避免壞資料造成排序/顯示錯誤 */
function sanitizeReminderWhen(frequency: ReminderFrequency, raw: unknown): string {
  const s = String(raw ?? "");
  if (frequency === "weekly") {
    const n = Number(s);
    return Number.isInteger(n) && n >= 0 && n <= 6 ? String(n) : "1";
  }
  if (frequency === "monthly") {
    const n = Number(s);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? String(n) : "1";
  }
  if (frequency === "yearly") {
    return /^\d{2}-\d{2}$/.test(s) ? s : "01-01";
  }
  // once
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? s
    : new Date().toISOString().slice(0, 10);
}

function sanitizeReminder(raw: unknown): Reminder {
  const r = (raw ?? {}) as Partial<Reminder>;
  const frequency = REMINDER_FREQUENCIES.includes(
    r.frequency as ReminderFrequency,
  )
    ? (r.frequency as ReminderFrequency)
    : "weekly";
  return {
    id: String(r.id || nanoid(10)),
    title: String(r.title ?? "").slice(0, 300),
    frequency,
    when: sanitizeReminderWhen(frequency, r.when),
  };
}

export function sanitizeTodoBoard(raw: unknown): TodoBoard {
  const board = emptyTodoBoard();
  const src = (raw ?? {}) as Partial<TodoBoard>;
  for (const bucket of TODO_BUCKETS) {
    const list = src[bucket];
    if (Array.isArray(list)) {
      board[bucket] = list.map(sanitizeTodo);
    }
  }
  if (Array.isArray(src.reminders)) {
    board.reminders = src.reminders.slice(0, 300).map(sanitizeReminder);
  }
  return board;
}

// ── 版本包裝 ──

/** 拆開 { board, rev } 包裝；舊資料是裸看板 → 視為 rev 0 */
function unwrapStored(raw: unknown): { board: unknown; rev: number } {
  if (
    raw &&
    typeof raw === "object" &&
    "board" in (raw as Record<string, unknown>) &&
    "rev" in (raw as Record<string, unknown>)
  ) {
    const w = raw as { board: unknown; rev: unknown };
    const rev = Number(w.rev);
    return {
      board: w.board,
      rev: Number.isInteger(rev) && rev >= 0 ? rev : 0,
    };
  }
  return { board: raw, rev: 0 };
}

/** 版本化寫入的結果：ok=false 代表版本衝突，附上最新內容供呼叫端同步 */
export type SaveBoardResult<T> = { ok: boolean; board: T; rev: number };

// ── 靈感看板 ──

export async function getInspirationsView(): Promise<{
  board: InspirationBoard;
  rev: number;
}> {
  noStore();
  if (KV_ENABLED) {
    const raw = await kv.get(INSPIRATIONS_KEY);
    const { board, rev } = unwrapStored(raw);
    return { board: sanitizeInspirationBoard(board), rev };
  }
  return {
    board: mem.inspirations ?? emptyInspirationBoard(),
    rev: memRev.inspirations,
  };
}

export async function getInspirations(): Promise<InspirationBoard> {
  return (await getInspirationsView()).board;
}

/**
 * 儲存靈感看板。expectedRev 有值且與現存版本不符時拒絕（回 ok:false 與最新內容）；
 * 未帶 expectedRev（舊 client / 備份還原）維持無條件覆寫。
 */
export async function saveInspirations(
  raw: unknown,
  expectedRev?: number,
): Promise<SaveBoardResult<InspirationBoard>> {
  const board = sanitizeInspirationBoard(raw);
  const current = await getInspirationsView();
  if (expectedRev !== undefined && expectedRev !== current.rev) {
    return { ok: false, board: current.board, rev: current.rev };
  }
  const rev = current.rev + 1;
  if (KV_ENABLED) {
    await kv.set(INSPIRATIONS_KEY, { board, rev });
  } else {
    mem.inspirations = board;
    memRev.inspirations = rev;
  }
  return { ok: true, board, rev };
}

// ── 待辦清單 ──

export async function getTodosView(): Promise<{
  board: TodoBoard;
  rev: number;
}> {
  noStore();
  if (KV_ENABLED) {
    const raw = await kv.get(TODOS_KEY);
    const { board, rev } = unwrapStored(raw);
    return { board: sanitizeTodoBoard(board), rev };
  }
  return { board: mem.todos ?? emptyTodoBoard(), rev: memRev.todos };
}

export async function getTodos(): Promise<TodoBoard> {
  return (await getTodosView()).board;
}

/**
 * 儲存待辦清單。expectedRev 有值且與現存版本不符時拒絕（回 ok:false 與最新內容）；
 * 未帶 expectedRev（舊 client / 備份還原）維持無條件覆寫。
 */
export async function saveTodos(
  raw: unknown,
  expectedRev?: number,
): Promise<SaveBoardResult<TodoBoard>> {
  const board = sanitizeTodoBoard(raw);
  const current = await getTodosView();
  if (expectedRev !== undefined && expectedRev !== current.rev) {
    return { ok: false, board: current.board, rev: current.rev };
  }
  const rev = current.rev + 1;
  if (KV_ENABLED) {
    await kv.set(TODOS_KEY, { board, rev });
  } else {
    mem.todos = board;
    memRev.todos = rev;
  }
  return { ok: true, board, rev };
}
