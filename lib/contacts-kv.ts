import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import { groupSortContacts } from "./contacts-sort";
import type {
  Contact,
  ContactInput,
  ContactLevel,
  ContactStatus,
  CooperationType,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  人脈資料庫存取層 (Vercel KV)
//
//  儲存結構 (仿照 lib/notes-kv.ts)：
//    contact:{id}      → 單筆聯絡人 (JSON)
//    contacts:index    → sorted set，member=id，score=updatedAt(ms)
//                        依更新時間新→舊 (資料表的後備排序)
//    contacts:order    → JSON string[]，手動拖曳後的顯示順序 (id 陣列)；
//                        不存在 = 未手動排序，改用預設分組排序
//                        (lib/contacts-sort.ts groupSortContacts)
//
//  未設定 KV 環境變數時 (本機開發未接 KV)，自動改用記憶體儲存。
//  讀取一律 noStore()，避免 Server Component 服務到過期資料。
// ─────────────────────────────────────────────────────────────

const CONTACT_KEY = (id: string) => `contact:${id}`;
const CONTACT_INDEX_KEY = "contacts:index";
const CONTACT_ORDER_KEY = "contacts:order";

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

// ── 記憶體後援 (本機無 KV 時使用) ──
// 掛在 globalThis 上，確保開發模式下 Route Handler 與 Server Component
// 這些分開打包的模組實例共用同一份資料 (正式環境走 KV，不會用到此後援)。
const memStore: Map<string, Contact> = ((
  globalThis as unknown as { __sbContactsMem?: Map<string, Contact> }
).__sbContactsMem ??= new Map<string, Contact>());

// 手動排序的記憶體後援 (同樣掛 globalThis，跨模組實例共用)
const memOrder = ((
  globalThis as unknown as {
    __sbContactsOrderMem?: { value: string[] | null };
  }
).__sbContactsOrderMem ??= { value: null });

const LEVELS: ContactLevel[] = ["high", "medium", "low", "unknown"];
const STATUSES: ContactStatus[] = [
  "employed",
  "freelance",
  "startup",
  "student",
  "unknown",
];
const COOPERATION_TYPES: CooperationType[] = ["project", "industry"];

// ── 清理 / 補齊 (防止壞資料，並相容缺欄位的舊資料) ──
function toLevel(raw: unknown): ContactLevel {
  return LEVELS.includes(raw as ContactLevel)
    ? (raw as ContactLevel)
    : "unknown";
}

function migrateContact(raw: Contact | null): Contact | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    name: String(raw.name ?? "").slice(0, 100),
    profession: String(raw.profession ?? "").slice(0, 200),
    contactInfo: String(raw.contactInfo ?? "").slice(0, 500),
    url: String(raw.url ?? "").slice(0, 1000),
    familiarity: toLevel(raw.familiarity),
    liking: toLevel(raw.liking),
    ability: toLevel(raw.ability),
    price: toLevel(raw.price),
    status: STATUSES.includes(raw.status) ? raw.status : "unknown",
    cooperationType: COOPERATION_TYPES.includes(raw.cooperationType)
      ? raw.cooperationType
      : "project",
    transferInfo: String(raw.transferInfo ?? "").slice(0, 500),
    note: String(raw.note ?? "").slice(0, 5000),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

/** 僅取表單允許的欄位，並清理內容 */
function cleanInput(input: ContactInput): ContactInput {
  return {
    name: String(input?.name ?? "").slice(0, 100),
    profession: String(input?.profession ?? "").slice(0, 200),
    contactInfo: String(input?.contactInfo ?? "").slice(0, 500),
    url: String(input?.url ?? "").slice(0, 1000),
    familiarity: toLevel(input?.familiarity),
    liking: toLevel(input?.liking),
    ability: toLevel(input?.ability),
    price: toLevel(input?.price),
    status: STATUSES.includes(input?.status) ? input.status : "unknown",
    cooperationType: COOPERATION_TYPES.includes(input?.cooperationType)
      ? input.cooperationType
      : "project",
    transferInfo: String(input?.transferInfo ?? "").slice(0, 500),
    note: String(input?.note ?? "").slice(0, 5000),
  };
}

/** 建立新聯絡人 */
export async function createContact(input: ContactInput): Promise<Contact> {
  const now = new Date().toISOString();
  const contact: Contact = {
    ...cleanInput(input),
    id: nanoid(10),
    createdAt: now,
    updatedAt: now,
  };

  if (KV_ENABLED) {
    await kv.set(CONTACT_KEY(contact.id), contact);
    await kv.zadd(CONTACT_INDEX_KEY, { score: Date.now(), member: contact.id });
  } else {
    memStore.set(contact.id, contact);
  }
  return contact;
}

/** 整批匯入聯絡人 (CSV 匯入用)，回傳成功建立的筆數 */
export async function importContacts(
  inputs: ContactInput[],
): Promise<Contact[]> {
  const now = Date.now();
  const contacts: Contact[] = inputs.map((input, i) => ({
    ...cleanInput(input),
    id: nanoid(10),
    // 依序遞增毫秒，確保 index 排序穩定 (CSV 由上而下 = 新→舊倒序寫入)
    createdAt: new Date(now + i).toISOString(),
    updatedAt: new Date(now + i).toISOString(),
  }));

  if (KV_ENABLED) {
    // pipeline 一次寫入，避免上百筆時逐筆 round-trip
    const pipeline = kv.pipeline();
    contacts.forEach((c, i) => {
      pipeline.set(CONTACT_KEY(c.id), c);
      pipeline.zadd(CONTACT_INDEX_KEY, { score: now + i, member: c.id });
    });
    await pipeline.exec();
  } else {
    contacts.forEach((c) => memStore.set(c.id, c));
  }
  return contacts;
}

/** 讀取單筆聯絡人 */
export async function getContact(id: string): Promise<Contact | null> {
  noStore();
  if (!id) return null;
  if (KV_ENABLED) {
    const contact = await kv.get<Contact>(CONTACT_KEY(id));
    return migrateContact(contact ?? null);
  }
  return migrateContact(memStore.get(id) ?? null);
}

/** 更新聯絡人 (保留 id / createdAt) */
export async function updateContact(
  id: string,
  input: ContactInput,
): Promise<Contact | null> {
  const existing = await getContact(id);
  if (!existing) return null;

  const updated: Contact = {
    ...existing,
    ...cleanInput(input),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  if (KV_ENABLED) {
    await kv.set(CONTACT_KEY(id), updated);
    await kv.zadd(CONTACT_INDEX_KEY, { score: Date.now(), member: id });
  } else {
    memStore.set(id, updated);
  }
  return updated;
}

/** 刪除聯絡人 */
export async function deleteContact(id: string): Promise<boolean> {
  const existing = await getContact(id);
  if (!existing) return false;

  if (KV_ENABLED) {
    await kv.del(CONTACT_KEY(id));
    await kv.zrem(CONTACT_INDEX_KEY, id);
  } else {
    memStore.delete(id);
  }
  return true;
}

/** 取得所有聯絡人 (依更新時間新 → 舊；不套用手動排序) */
export async function getAllContacts(): Promise<Contact[]> {
  noStore();
  if (KV_ENABLED) {
    const ids = await kv.zrange<string[]>(CONTACT_INDEX_KEY, 0, -1, {
      rev: true,
    });
    if (!ids || ids.length === 0) return [];
    // mget 一次讀回全部，避免逐筆 get 的 N+1 round-trip
    const raw = await kv.mget<(Contact | null)[]>(...ids.map(CONTACT_KEY));
    return raw
      .map((c) => migrateContact(c ?? null))
      .filter((c): c is Contact => Boolean(c));
  }
  return Array.from(memStore.values())
    .map((c) => migrateContact(c))
    .filter((c): c is Contact => Boolean(c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 讀取手動排序 (id 陣列)；null = 未手動排序 */
export async function getContactsOrder(): Promise<string[] | null> {
  noStore();
  if (KV_ENABLED) {
    const order = await kv.get<string[]>(CONTACT_ORDER_KEY);
    return Array.isArray(order) ? order.map(String) : null;
  }
  return memOrder.value;
}

/** 儲存手動排序；傳 null 清除 (回到預設分組排序) */
export async function saveContactsOrder(
  order: string[] | null,
): Promise<void> {
  if (order === null) {
    if (KV_ENABLED) await kv.del(CONTACT_ORDER_KEY);
    else memOrder.value = null;
    return;
  }
  const clean = order
    .filter((id) => typeof id === "string" && id)
    .slice(0, 5000)
    .map(String);
  if (KV_ENABLED) await kv.set(CONTACT_ORDER_KEY, clean);
  else memOrder.value = clean;
}

/**
 * 資料表檢視：套用手動排序 (有的話)，否則依 合作方向→職業別 分組排序。
 * 不在手動順序中的 id (匯入/他處新增) 附加在最後。
 */
export async function getContactsView(): Promise<{
  contacts: Contact[];
  ordered: boolean;
}> {
  noStore();
  const [contacts, order] = await Promise.all([
    getAllContacts(),
    getContactsOrder(),
  ]);
  if (!order) {
    return { contacts: groupSortContacts(contacts), ordered: false };
  }
  const pos = new Map(order.map((id, i) => [id, i] as const));
  const inOrder = contacts
    .filter((c) => pos.has(c.id))
    .sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  const rest = contacts.filter((c) => !pos.has(c.id));
  return { contacts: [...inOrder, ...rest], ordered: true };
}

/**
 * 完整覆寫聯絡人資料與手動排序 (備份還原用)：清空現有全部，寫入 snapshot 內容。
 * 危險操作，僅供 lib/backup.ts 的 restoreBackup() 呼叫。
 */
export async function restoreContactsData(
  contacts: Contact[],
  order: string[] | null,
): Promise<void> {
  if (KV_ENABLED) {
    const existingIds =
      (await kv.zrange<string[]>(CONTACT_INDEX_KEY, 0, -1)) ?? [];
    if (existingIds.length > 0) {
      await Promise.all(existingIds.map((id) => kv.del(CONTACT_KEY(id))));
      await kv.del(CONTACT_INDEX_KEY);
    }
    for (const c of contacts) {
      await kv.set(CONTACT_KEY(c.id), c);
      await kv.zadd(CONTACT_INDEX_KEY, {
        score: new Date(c.updatedAt).getTime() || Date.now(),
        member: c.id,
      });
    }
  } else {
    memStore.clear();
    contacts.forEach((c) => memStore.set(c.id, c));
  }
  await saveContactsOrder(order);
}

export { KV_ENABLED };
