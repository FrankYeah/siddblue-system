import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Inspiration,
  InspirationBoard,
  InspirationStatus,
  Todo,
  TodoBoard,
  TodoBucket,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  創作者工作區資料層 (Vercel KV)
//
//  儲存結構 (單一 JSON blob，方便拖曳整體重排、原子寫入)：
//    workspace:inspirations → InspirationBoard  (依欄位分組)
//    workspace:todos        → TodoBoard         (依分區分組)
//
//  沿用 lib/kv.ts 的慣例：讀取一律 noStore()；未設定 KV 時用記憶體後援。
// ─────────────────────────────────────────────────────────────

const INSPIRATIONS_KEY = "workspace:inspirations";
const TODOS_KEY = "workspace:todos";

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// 記憶體後援
let memInspirations: InspirationBoard | null = null;
let memTodos: TodoBoard | null = null;

const INSPIRATION_STATUSES: InspirationStatus[] = [
  "idea",
  "newsletter",
  "shortvideo",
  "archived",
];
const TODO_BUCKETS: TodoBucket[] = ["now", "later", "longterm"];

export function emptyInspirationBoard(): InspirationBoard {
  return { idea: [], newsletter: [], shortvideo: [], archived: [] };
}

export function emptyTodoBoard(): TodoBoard {
  return { now: [], later: [], longterm: [] };
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

export function sanitizeTodoBoard(raw: unknown): TodoBoard {
  const board = emptyTodoBoard();
  const src = (raw ?? {}) as Partial<Record<TodoBucket, unknown>>;
  for (const bucket of TODO_BUCKETS) {
    const list = src[bucket];
    if (Array.isArray(list)) {
      board[bucket] = list.map(sanitizeTodo);
    }
  }
  return board;
}

// ── 靈感看板 ──

export async function getInspirations(): Promise<InspirationBoard> {
  noStore();
  if (KV_ENABLED) {
    const raw = await kv.get<InspirationBoard>(INSPIRATIONS_KEY);
    return sanitizeInspirationBoard(raw);
  }
  return memInspirations ?? emptyInspirationBoard();
}

export async function saveInspirations(
  raw: unknown,
): Promise<InspirationBoard> {
  const board = sanitizeInspirationBoard(raw);
  if (KV_ENABLED) {
    await kv.set(INSPIRATIONS_KEY, board);
  } else {
    memInspirations = board;
  }
  return board;
}

// ── 待辦清單 ──

export async function getTodos(): Promise<TodoBoard> {
  noStore();
  if (KV_ENABLED) {
    const raw = await kv.get<TodoBoard>(TODOS_KEY);
    return sanitizeTodoBoard(raw);
  }
  return memTodos ?? emptyTodoBoard();
}

export async function saveTodos(raw: unknown): Promise<TodoBoard> {
  const board = sanitizeTodoBoard(raw);
  if (KV_ENABLED) {
    await kv.set(TODOS_KEY, board);
  } else {
    memTodos = board;
  }
  return board;
}
