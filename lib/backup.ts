import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import { getAllQuotesFull, restoreQuotes } from "./kv";
import {
  getInspirations,
  getTodos,
  saveInspirations,
  saveTodos,
} from "./workspace-kv";
import { getAllNotes, restoreNotesData } from "./notes-kv";
import { getAllCases, restoreCasesData } from "./cases-kv";
import {
  getAllContacts,
  getContactsOrder,
  restoreContactsData,
} from "./contacts-kv";
import { getAllExpenses, restoreExpensesData } from "./expenses-kv";
import type {
  Case,
  Contact,
  Expense,
  InspirationBoard,
  Note,
  Quote,
  TodoBoard,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  📦 資料備份與匯出 (Backup & Export)
//
//  匯出/快照涵蓋所有模組的完整資料：報價單、靈感看板、待辦清單、
//  知識庫、案件管理、人脈庫 (含手動排序)、支出紀錄。
//
//  儲存結構：
//    backups:index      → sorted set，member=備份 id，score=建立時間(ms)
//    backup:meta:{id}   → 輕量摘要 (時間 + 各模組筆數)，供列表快速讀取
//    backup:data:{id}   → 完整資料 (還原時才讀取)
//    最多保留 BACKUP_KEEP 份，超過自動輪替刪除最舊的。
//
//  還原 (restoreBackup) 為危險操作：會清空並覆寫目前所有資料，
//  只在 UI 層以明確警告文字二次確認後才呼叫。
// ─────────────────────────────────────────────────────────────

export const BACKUP_VERSION = 1;
const BACKUP_KEEP = 7;

const BACKUP_INDEX_KEY = "backups:index";
const BACKUP_META_KEY = (id: string) => `backup:meta:${id}`;
const BACKUP_DATA_KEY = (id: string) => `backup:data:${id}`;
const BACKUP_ERROR_KEY = "backup:lastError";

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// 記憶體後援 (本機無 KV 時使用)
const mem = ((
  globalThis as unknown as {
    __sbBackupsMem?: {
      order: string[];
      meta: Map<string, BackupMeta>;
      data: Map<string, BackupPayload>;
    };
  }
).__sbBackupsMem ??= {
  order: [] as string[],
  meta: new Map<string, BackupMeta>(),
  data: new Map<string, BackupPayload>(),
});

// 失敗紀錄的記憶體後援獨立掛載，避免動到既有 __sbBackupsMem 的形狀
const memError = ((
  globalThis as unknown as { __sbBackupErrMem?: { value: BackupError | null } }
).__sbBackupErrMem ??= { value: null });

export interface BackupCounts {
  quotes: number;
  cases: number;
  contacts: number;
  notes: number;
  inspirations: number;
  todos: number;
  expenses: number;
}

export interface BackupMeta {
  id: string;
  exportedAt: string;
  counts: BackupCounts;
  /** 選填註記，如「還原前自動快照」；列表顯示用 */
  note?: string;
}

/** 最近一次備份失敗的紀錄；成功時清除。供後台顯示告警，避免 Cron 默默失敗數月無人知 */
export interface BackupError {
  at: string;
  message: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  quotes: Quote[];
  inspirations: InspirationBoard;
  todos: TodoBoard;
  notes: Note[];
  cases: Case[];
  contacts: Contact[];
  contactsOrder: string[] | null;
  expenses: Expense[];
}

function countBoard(board: InspirationBoard): number {
  return Object.values(board).reduce((sum, list) => sum + list.length, 0);
}
function countTodos(board: TodoBoard): number {
  return Object.values(board).reduce((sum, list) => sum + list.length, 0);
}

function toCounts(p: BackupPayload): BackupCounts {
  return {
    quotes: p.quotes.length,
    cases: p.cases.length,
    contacts: p.contacts.length,
    notes: p.notes.length,
    inspirations: countBoard(p.inspirations),
    todos: countTodos(p.todos),
    expenses: p.expenses.length,
  };
}

/** 匯出目前全部資料 (供「匯出 JSON」與快照共用) */
export async function exportAllData(): Promise<BackupPayload> {
  noStore();
  const [
    quotes,
    inspirations,
    todos,
    notes,
    cases,
    contacts,
    contactsOrder,
    expenses,
  ] = await Promise.all([
    getAllQuotesFull(),
    getInspirations(),
    getTodos(),
    getAllNotes(),
    getAllCases(),
    getAllContacts(),
    getContactsOrder(),
    getAllExpenses(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    quotes,
    inspirations,
    todos,
    notes,
    cases,
    contacts,
    contactsOrder,
    expenses,
  };
}

async function rotateBackups(): Promise<void> {
  const ids = (await kv.zrange<string[]>(BACKUP_INDEX_KEY, 0, -1)) ?? [];
  if (ids.length <= BACKUP_KEEP) return;
  const toDrop = ids.slice(0, ids.length - BACKUP_KEEP);
  await Promise.all(
    toDrop.map(async (id) => {
      await kv.del(BACKUP_DATA_KEY(id));
      await kv.del(BACKUP_META_KEY(id));
      await kv.zrem(BACKUP_INDEX_KEY, id);
    }),
  );
}

/** 記錄最近一次備份失敗（成功時清除）。供後台顯示告警，避免每日 Cron 默默失敗數月無人知 */
export async function recordBackupError(message: string): Promise<void> {
  const err: BackupError = {
    at: new Date().toISOString(),
    message: String(message ?? "未知錯誤").slice(0, 500),
  };
  if (KV_ENABLED) {
    await kv.set(BACKUP_ERROR_KEY, err);
  } else {
    memError.value = err;
  }
}

export async function clearBackupError(): Promise<void> {
  if (KV_ENABLED) {
    await kv.del(BACKUP_ERROR_KEY);
  } else {
    memError.value = null;
  }
}

export async function getBackupError(): Promise<BackupError | null> {
  noStore();
  if (KV_ENABLED) {
    return (await kv.get<BackupError>(BACKUP_ERROR_KEY)) ?? null;
  }
  return memError.value;
}

/** 建立一份快照，並輪替至只保留最近 BACKUP_KEEP 份 */
export async function snapshotBackup(note?: string): Promise<BackupMeta> {
  const payload = await exportAllData();
  const id = nanoid(12);
  const meta: BackupMeta = {
    id,
    exportedAt: payload.exportedAt,
    counts: toCounts(payload),
    ...(note ? { note } : {}),
  };

  if (KV_ENABLED) {
    await kv.set(BACKUP_DATA_KEY(id), payload);
    await kv.set(BACKUP_META_KEY(id), meta);
    await kv.zadd(BACKUP_INDEX_KEY, { score: Date.now(), member: id });
    await rotateBackups();
  } else {
    mem.data.set(id, payload);
    mem.meta.set(id, meta);
    mem.order.push(id);
    if (mem.order.length > BACKUP_KEEP) {
      const drop = mem.order.splice(0, mem.order.length - BACKUP_KEEP);
      drop.forEach((dropId) => {
        mem.data.delete(dropId);
        mem.meta.delete(dropId);
      });
    }
  }
  return meta;
}

/** 列出所有快照 (新 → 舊) */
export async function listBackups(): Promise<BackupMeta[]> {
  noStore();
  if (KV_ENABLED) {
    const ids = await kv.zrange<string[]>(BACKUP_INDEX_KEY, 0, -1, {
      rev: true,
    });
    if (!ids || ids.length === 0) return [];
    const metas = await Promise.all(
      ids.map((id) => kv.get<BackupMeta>(BACKUP_META_KEY(id))),
    );
    return metas.filter((m): m is BackupMeta => Boolean(m));
  }
  return [...mem.order]
    .reverse()
    .map((id) => mem.meta.get(id))
    .filter((m): m is BackupMeta => Boolean(m));
}

/**
 * 由快照完整還原全部資料 (危險操作：覆寫目前所有內容)。
 * UI 層須先以明確警告文字二次確認，這裡不做額外攔阻。
 */
export async function restoreBackup(id: string): Promise<BackupMeta | null> {
  const payload = KV_ENABLED
    ? await kv.get<BackupPayload>(BACKUP_DATA_KEY(id))
    : mem.data.get(id) ?? null;
  if (!payload) return null;

  // 還原前先把「當下」狀態快照起來（fail-closed：快照失敗即中止還原）——
  // 誤按還原到舊快照時才有後悔藥。payload 已讀進記憶體，
  // 即使這次快照的輪替把最舊的備份（可能正是還原來源）刪掉也不影響本次還原。
  await snapshotBackup("還原前自動快照");

  await Promise.all([
    restoreQuotes(payload.quotes),
    saveInspirations(payload.inspirations),
    saveTodos(payload.todos),
    restoreNotesData(payload.notes),
    restoreCasesData(payload.cases),
    restoreContactsData(payload.contacts, payload.contactsOrder),
    restoreExpensesData(payload.expenses ?? []),
  ]);

  return { id, exportedAt: payload.exportedAt, counts: toCounts(payload) };
}
