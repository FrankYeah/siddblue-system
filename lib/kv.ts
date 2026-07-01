import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import type { Quote, QuoteInput, QuoteSummary } from "./types";
import { itemsTotal } from "./format";

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
const memStore = new Map<string, Quote>();

function toSummary(q: Quote): QuoteSummary {
  return {
    id: q.id,
    clientName: q.clientName,
    quoteDate: q.quoteDate,
    total: itemsTotal(q.items),
    updatedAt: q.updatedAt,
  };
}

/** 建立新報價單 */
export async function createQuote(input: QuoteInput): Promise<Quote> {
  const now = new Date().toISOString();
  const quote: Quote = {
    ...input,
    id: nanoid(10),
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
  if (!id) return null;
  if (KV_ENABLED) {
    const quote = await kv.get<Quote>(QUOTE_KEY(id));
    return quote ?? null;
  }
  return memStore.get(id) ?? null;
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
  if (KV_ENABLED) {
    const ids = await kv.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
    if (!ids || ids.length === 0) return [];
    // 批次讀取
    const quotes = await Promise.all(ids.map((id) => getQuote(id)));
    return quotes
      .filter((q): q is Quote => Boolean(q))
      .map(toSummary);
  }

  return Array.from(memStore.values())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toSummary);
}

export { KV_ENABLED };
