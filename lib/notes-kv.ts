import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import type { Note, NoteInput, NoteSummary, NoteType } from "./types";

// ─────────────────────────────────────────────────────────────
//  知識庫資料存取層 (Vercel KV)
//
//  儲存結構 (仿照 lib/kv.ts 報價單的做法)：
//    note:{id}            → 單筆筆記 (JSON)
//    notes:index          → sorted set，member=id，score=updatedAt(ms)
//                           後台列表用，依更新時間新→舊排序
//    note:share:{token}   → id (字串)，供對外分享頁以 shareToken 反查
//                           token 於建立時產生、終生不變，刪除筆記時一併移除
//
//  未設定 KV 環境變數時 (本機開發未接 KV)，自動改用記憶體儲存。
//  讀取一律 noStore()，避免 Server Component 服務到過期資料。
// ─────────────────────────────────────────────────────────────

const NOTE_KEY = (id: string) => `note:${id}`;
const NOTE_INDEX_KEY = "notes:index";
const SHARE_KEY = (token: string) => `note:share:${token}`;

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ── 記憶體後援 (本機無 KV 時使用) ──
// 掛在 globalThis 上，確保開發模式下 Route Handler 與 Server Component
// 這些分開打包的模組實例共用同一份資料 (正式環境走 KV，不會用到此後援)。
const memStore: Map<string, Note> = ((
  globalThis as unknown as { __sbNotesMem?: Map<string, Note> }
).__sbNotesMem ??= new Map<string, Note>());

const NOTE_TYPES: NoteType[] = ["general", "consulting"];

// ── 清理 / 補齊 (防止壞資料，並相容缺欄位的舊資料) ──
function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tag = String(t ?? "").trim().slice(0, 40);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
    if (out.length >= 30) break;
  }
  return out;
}

function migrateNote(raw: Note | null): Note | null {
  if (!raw) return null;
  const type: NoteType = NOTE_TYPES.includes(raw.type) ? raw.type : "general";
  return {
    id: String(raw.id),
    title: String(raw.title ?? "").slice(0, 300),
    content: String(raw.content ?? "").slice(0, 100000),
    tags: sanitizeTags(raw.tags),
    type,
    isShared: Boolean(raw.isShared),
    shareToken: String(raw.shareToken || nanoid(10)),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

/** 僅取表單允許的欄位，並清理內容 */
function cleanInput(input: NoteInput): NoteInput {
  return {
    title: String(input?.title ?? "").slice(0, 300),
    content: String(input?.content ?? "").slice(0, 100000),
    tags: sanitizeTags(input?.tags),
    type: NOTE_TYPES.includes(input?.type) ? input.type : "general",
    isShared: Boolean(input?.isShared),
  };
}

function toSummary(n: Note): NoteSummary {
  return {
    id: n.id,
    title: n.title,
    tags: n.tags,
    type: n.type,
    isShared: n.isShared,
    updatedAt: n.updatedAt,
  };
}

/** 建立新筆記 */
export async function createNote(input: NoteInput): Promise<Note> {
  const now = new Date().toISOString();
  const clean = cleanInput(input);
  const note: Note = {
    ...clean,
    id: nanoid(10),
    shareToken: nanoid(10),
    createdAt: now,
    updatedAt: now,
  };

  if (KV_ENABLED) {
    await kv.set(NOTE_KEY(note.id), note);
    await kv.zadd(NOTE_INDEX_KEY, { score: Date.now(), member: note.id });
    await kv.set(SHARE_KEY(note.shareToken), note.id);
  } else {
    memStore.set(note.id, note);
  }
  return note;
}

/** 讀取單筆筆記 (以 id) */
export async function getNote(id: string): Promise<Note | null> {
  noStore();
  if (!id) return null;
  if (KV_ENABLED) {
    const note = await kv.get<Note>(NOTE_KEY(id));
    return migrateNote(note ?? null);
  }
  return migrateNote(memStore.get(id) ?? null);
}

/** 以對外分享 token 反查筆記 (對外分享頁使用) */
export async function getNoteByShareToken(token: string): Promise<Note | null> {
  noStore();
  if (!token) return null;
  if (KV_ENABLED) {
    const id = await kv.get<string>(SHARE_KEY(token));
    if (!id) return null;
    return getNote(id);
  }
  const hit = Array.from(memStore.values()).find(
    (note) => note.shareToken === token,
  );
  return hit ? migrateNote(hit) : null;
}

/** 更新筆記 (保留 id / shareToken / createdAt) */
export async function updateNote(
  id: string,
  input: NoteInput,
): Promise<Note | null> {
  const existing = await getNote(id);
  if (!existing) return null;

  const updated: Note = {
    ...existing,
    ...cleanInput(input),
    id: existing.id,
    shareToken: existing.shareToken,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (KV_ENABLED) {
    await kv.set(NOTE_KEY(id), updated);
    await kv.zadd(NOTE_INDEX_KEY, { score: Date.now(), member: id });
    // token 不變，維持反查對應 (冪等，確保對應存在)
    await kv.set(SHARE_KEY(updated.shareToken), id);
  } else {
    memStore.set(id, updated);
  }
  return updated;
}

/** 刪除筆記 */
export async function deleteNote(id: string): Promise<boolean> {
  const existing = await getNote(id);
  if (!existing) return false;

  if (KV_ENABLED) {
    await kv.del(NOTE_KEY(id));
    await kv.zrem(NOTE_INDEX_KEY, id);
    await kv.del(SHARE_KEY(existing.shareToken));
  } else {
    memStore.delete(id);
  }
  return true;
}

/** 列出所有筆記摘要 (新 → 舊) */
export async function listNotes(): Promise<NoteSummary[]> {
  noStore();
  const notes = await getAllNotes();
  return notes.map(toSummary);
}

/** 取得所有完整筆記 (新 → 舊)，後台初始載入使用 */
export async function getAllNotes(): Promise<Note[]> {
  noStore();
  if (KV_ENABLED) {
    const ids = await kv.zrange<string[]>(NOTE_INDEX_KEY, 0, -1, { rev: true });
    if (!ids || ids.length === 0) return [];
    const notes = await Promise.all(ids.map((id) => getNote(id)));
    return notes.filter((n): n is Note => Boolean(n));
  }
  return Array.from(memStore.values())
    .map((n) => migrateNote(n))
    .filter((n): n is Note => Boolean(n))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 完整覆寫筆記資料 (備份還原用)：清空現有全部 (含分享 token 對應)，寫入 snapshot 內容。
 * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
 */
export async function restoreNotesData(notes: Note[]): Promise<void> {
  if (KV_ENABLED) {
    const existingIds =
      (await kv.zrange<string[]>(NOTE_INDEX_KEY, 0, -1)) ?? [];
    for (const id of existingIds) {
      const existing = await kv.get<Note>(NOTE_KEY(id));
      await kv.del(NOTE_KEY(id));
      if (existing?.shareToken) await kv.del(SHARE_KEY(existing.shareToken));
    }
    if (existingIds.length > 0) await kv.del(NOTE_INDEX_KEY);
    for (const n of notes) {
      await kv.set(NOTE_KEY(n.id), n);
      await kv.zadd(NOTE_INDEX_KEY, {
        score: new Date(n.updatedAt).getTime() || Date.now(),
        member: n.id,
      });
      await kv.set(SHARE_KEY(n.shareToken), n.id);
    }
  } else {
    memStore.clear();
    notes.forEach((n) => memStore.set(n.id, n));
  }
}

export { KV_ENABLED, NOTE_TYPES };
