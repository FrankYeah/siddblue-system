import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import type { Quote, QuoteInput, QuoteStatus, QuoteSummary } from "./types";
import { computeTotals } from "./format";
import { normalizeProcessSteps, normalizeProjectBrief } from "./normalize";

// ─────────────────────────────────────────────────────────────
//  Vercel KV 資料存取層 (Data Access Layer)
//
//  儲存結構：
//    quote:{id}     → 單筆報價單 (JSON)
//    quotes:index   → sorted set，member=id，score=updatedAt(ms)
//                     用於後台列表，依更新時間新→舊排序
//
//  若未設定 KV 環境變數 (本機開發未接 KV)，自動改用記憶體儲存，
//  讓 `next dev` 可直接跑起來 (資料不持久，重啟即清空)。
// ─────────────────────────────────────────────────────────────

const QUOTE_KEY = (id: string) => `quote:${id}`;
const INDEX_KEY = "quotes:index";

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ── 記憶體後援 (本機無 KV 時使用) ──
// 掛在 globalThis 上，確保開發模式下 Route Handler 與 Server Component
// 這些分開打包的模組實例共用同一份資料 (正式環境走 KV，不會用到此後援)。
const memStore: Map<string, Quote> = ((
  globalThis as unknown as { __sbQuotesMem?: Map<string, Quote> }
).__sbQuotesMem ??= new Map<string, Quote>());

const QUOTE_STATUSES: QuoteStatus[] = ["draft", "sent", "confirmed"];

/** 相容舊資料：補齊 processSteps / projectBrief / taxInclusive / status */
function migrateQuote(q: Quote | null): Quote | null {
  if (!q) return null;
  return {
    ...q,
    projectBrief: normalizeProjectBrief(q.projectBrief),
    processSteps: normalizeProcessSteps(q.processSteps),
    taxInclusive: Boolean(q.taxInclusive),
    // 舊資料無 status：已確認過的視為「已確認」，其餘為「草稿」
    status: QUOTE_STATUSES.includes(q.status)
      ? q.status
      : q.acceptedAt
        ? "confirmed"
        : "draft",
  };
}

function toSummary(q: Quote): QuoteSummary {
  return {
    id: q.id,
    clientName: q.clientName,
    quoteDate: q.quoteDate,
    total: computeTotals(q.items, q.taxInclusive).grandTotal,
    status: q.status,
    updatedAt: q.updatedAt,
    acceptedAt: q.acceptedAt,
  };
}

/** 建立新報價單 */
export async function createQuote(input: QuoteInput): Promise<Quote> {
  const now = new Date().toISOString();
  const quote: Quote = {
    ...input,
    id: nanoid(10),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  if (KV_ENABLED) {
    await kv.set(QUOTE_KEY(quote.id), quote);
    await kv.zadd(INDEX_KEY, { score: Date.now(), member: quote.id });
  } else {
    memStore.set(quote.id, quote);
  }
  return quote;
}

/** 讀取單筆報價單 */
export async function getQuote(id: string): Promise<Quote | null> {
  // 確保 Server Component 每次都讀最新資料，不被 Next.js data cache 快取住
  noStore();
  if (!id) return null;
  if (KV_ENABLED) {
    const quote = await kv.get<Quote>(QUOTE_KEY(id));
    return migrateQuote(quote ?? null);
  }
  return migrateQuote(memStore.get(id) ?? null);
}

/** 更新報價單 (保留原 id / createdAt) */
export async function updateQuote(
  id: string,
  input: QuoteInput,
): Promise<Quote | null> {
  const existing = await getQuote(id);
  if (!existing) return null;

  const updated: Quote = {
    ...existing,
    ...input,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (KV_ENABLED) {
    await kv.set(QUOTE_KEY(id), updated);
    await kv.zadd(INDEX_KEY, { score: Date.now(), member: id });
  } else {
    memStore.set(id, updated);
  }
  return updated;
}

/** 僅更新報價單狀態 (後台列表快速切換，不動其他欄位) */
export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus,
): Promise<Quote | null> {
  const existing = await getQuote(id);
  if (!existing) return null;

  const updated: Quote = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  if (KV_ENABLED) {
    await kv.set(QUOTE_KEY(id), updated);
    await kv.zadd(INDEX_KEY, { score: Date.now(), member: id });
  } else {
    memStore.set(id, updated);
  }
  return updated;
}

/** 客戶線上確認接受報價 (公開操作，不需後台驗證) */
export async function acceptQuote(
  id: string,
  name: string,
): Promise<Quote | null> {
  const existing = await getQuote(id);
  if (!existing) return null;

  // 已確認過就保留首次確認記錄，不覆寫
  if (existing.acceptedAt) return existing;

  const accepted: Quote = {
    ...existing,
    status: "confirmed",
    acceptedAt: new Date().toISOString(),
    acceptedBy: name.trim() || existing.clientName,
    updatedAt: new Date().toISOString(),
  };

  if (KV_ENABLED) {
    await kv.set(QUOTE_KEY(id), accepted);
    await kv.zadd(INDEX_KEY, { score: Date.now(), member: id });
  } else {
    memStore.set(id, accepted);
  }
  return accepted;
}

/** 刪除報價單 */
export async function deleteQuote(id: string): Promise<boolean> {
  const existing = await getQuote(id);
  if (!existing) return false;

  if (KV_ENABLED) {
    await kv.del(QUOTE_KEY(id));
    await kv.zrem(INDEX_KEY, id);
  } else {
    memStore.delete(id);
  }
  return true;
}

/** 列出所有報價單摘要 (新 → 舊) */
export async function listQuotes(): Promise<QuoteSummary[]> {
  const quotes = await getAllQuotesFull();
  return quotes.map(toSummary);
}

/** 取得所有完整報價單 (新 → 舊)，後台列表與備份匯出使用 */
export async function getAllQuotesFull(): Promise<Quote[]> {
  noStore();
  if (KV_ENABLED) {
    const ids = await kv.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
    if (!ids || ids.length === 0) return [];
    // mget 一次讀回全部，避免逐筆 get 的 N+1 round-trip
    // (每筆一個 HTTP 請求，延遲與 Upstash 指令數都隨資料量線性成長)
    const raw = await kv.mget<(Quote | null)[]>(...ids.map(QUOTE_KEY));
    return raw
      .map((q) => migrateQuote(q ?? null))
      .filter((q): q is Quote => Boolean(q));
  }
  return Array.from(memStore.values())
    .map((q) => migrateQuote(q))
    .filter((q): q is Quote => Boolean(q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 完整覆寫報價單資料 (備份還原用)：清空現有全部，寫入 snapshot 內容。
 * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
 */
export async function restoreQuotes(quotes: Quote[]): Promise<void> {
  if (KV_ENABLED) {
    const existingIds = (await kv.zrange<string[]>(INDEX_KEY, 0, -1)) ?? [];
    if (existingIds.length === 0 && quotes.length === 0) return;
    // pipeline 一次送出「清空 + 重寫」：單一 HTTP 請求，
    // 避免逐筆 round-trip 在資料量大時觸發 serverless 超時、留下半空資料庫
    const pipeline = kv.pipeline();
    existingIds.forEach((id) => pipeline.del(QUOTE_KEY(id)));
    if (existingIds.length > 0) pipeline.del(INDEX_KEY);
    for (const q of quotes) {
      pipeline.set(QUOTE_KEY(q.id), q);
      pipeline.zadd(INDEX_KEY, {
        score: new Date(q.updatedAt).getTime() || Date.now(),
        member: q.id,
      });
    }
    await pipeline.exec();
  } else {
    memStore.clear();
    quotes.forEach((q) => memStore.set(q.id, q));
  }
}

export { KV_ENABLED, QUOTE_STATUSES };
