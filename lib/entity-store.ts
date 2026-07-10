import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";

// ─────────────────────────────────────────────────────────────
//  泛用「逐筆實體」KV 存取層工廠
//
//  cases / contacts / expenses 三個模組的資料層是同一模式的複製貼上：
//    {prefix}:{id}  → 單筆 JSON
//    {indexKey}     → sorted set (member=id, score=updatedAt ms)
//  外加 KV_ENABLED 判斷、globalThis 記憶體後援、mget 批次讀取、
//  pipeline 化的備份還原。此工廠把共通骨架收攏成一份，
//  各模組只需提供純函式的 migrate / cleanInput。
//
//  ⚠️ notes（分享 token 反查）與 quotes（狀態機/客戶確認）有真實的
//  特例邏輯，維持獨立實作；新增「標準」實體模組請用本工廠。
// ─────────────────────────────────────────────────────────────

interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface EntityStoreConfig<T extends BaseRecord, TInput> {
  /** KV key 前綴，如 "case" → `case:{id}` */
  keyPrefix: string;
  /** sorted set 索引 key，如 "cases:index" */
  indexKey: string;
  /** globalThis 記憶體後援的掛載名，如 "__sbCasesMem"（沿用既有值，開發模式資料不中斷） */
  memGlobalKey: string;
  /** 讀取時清理/補齊（相容舊資料）；null 透傳 */
  migrate: (raw: T | null) => T | null;
  /** 寫入時只取表單允許的欄位並清理（須能處理 Partial/undefined 輸入） */
  cleanInput: (input: TInput) => TInput;
}

export function createEntityStore<T extends BaseRecord, TInput>(
  cfg: EntityStoreConfig<T, TInput>,
) {
  const KEY = (id: string) => `${cfg.keyPrefix}:${id}`;
  const KV_ENABLED = Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );

  // 記憶體後援 (本機無 KV 時使用)：掛在 globalThis，確保開發模式下
  // Route Handler 與 Server Component 分開打包的模組實例共用同一份資料
  const g = globalThis as unknown as Record<string, Map<string, T>>;
  const memStore: Map<string, T> = (g[cfg.memGlobalKey] ??= new Map<
    string,
    T
  >());

  async function create(input: TInput): Promise<T> {
    const now = new Date().toISOString();
    // TInput = Omit<T, 系統欄位>，補回系統欄位即為完整 T
    const record = {
      ...cfg.cleanInput(input),
      id: nanoid(10),
      createdAt: now,
      updatedAt: now,
    } as unknown as T;

    if (KV_ENABLED) {
      await kv.set(KEY(record.id), record);
      await kv.zadd(cfg.indexKey, { score: Date.now(), member: record.id });
    } else {
      memStore.set(record.id, record);
    }
    return record;
  }

  async function get(id: string): Promise<T | null> {
    noStore();
    if (!id) return null;
    if (KV_ENABLED) {
      const raw = await kv.get<T>(KEY(id));
      return cfg.migrate(raw ?? null);
    }
    return cfg.migrate(memStore.get(id) ?? null);
  }

  async function update(id: string, input: TInput): Promise<T | null> {
    const existing = await get(id);
    if (!existing) return null;

    const updated: T = {
      ...existing,
      ...cfg.cleanInput(input),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    if (KV_ENABLED) {
      await kv.set(KEY(id), updated);
      await kv.zadd(cfg.indexKey, { score: Date.now(), member: id });
    } else {
      memStore.set(id, updated);
    }
    return updated;
  }

  async function remove(id: string): Promise<boolean> {
    const existing = await get(id);
    if (!existing) return false;

    if (KV_ENABLED) {
      await kv.del(KEY(id));
      await kv.zrem(cfg.indexKey, id);
    } else {
      memStore.delete(id);
    }
    return true;
  }

  /** 取得全部 (新 → 舊)：zrange 拿 id 後以單一 mget 批次讀取（勿逐筆 get，見 §5.4） */
  async function getAll(): Promise<T[]> {
    noStore();
    if (KV_ENABLED) {
      const ids = await kv.zrange<string[]>(cfg.indexKey, 0, -1, {
        rev: true,
      });
      if (!ids || ids.length === 0) return [];
      const raw = await kv.mget<(T | null)[]>(...ids.map(KEY));
      return raw
        .map((r) => cfg.migrate(r ?? null))
        .filter((r): r is T => Boolean(r));
    }
    return Array.from(memStore.values())
      .map((r) => cfg.migrate(r))
      .filter((r): r is T => Boolean(r))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /**
   * 完整覆寫 (備份還原用)：pipeline 一次送出「清空 + 重寫」——
   * 單一 HTTP 請求、近原子，避免逐筆 round-trip 觸發 serverless 超時。
   * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
   */
  async function restoreAll(records: T[]): Promise<void> {
    if (KV_ENABLED) {
      const existingIds =
        (await kv.zrange<string[]>(cfg.indexKey, 0, -1)) ?? [];
      if (existingIds.length === 0 && records.length === 0) return;
      const pipeline = kv.pipeline();
      existingIds.forEach((id) => pipeline.del(KEY(id)));
      if (existingIds.length > 0) pipeline.del(cfg.indexKey);
      for (const r of records) {
        pipeline.set(KEY(r.id), r);
        pipeline.zadd(cfg.indexKey, {
          score: new Date(r.updatedAt).getTime() || Date.now(),
          member: r.id,
        });
      }
      await pipeline.exec();
    } else {
      memStore.clear();
      records.forEach((r) => memStore.set(r.id, r));
    }
  }

  return { create, get, update, remove, getAll, restoreAll, KV_ENABLED, memStore, KEY };
}
