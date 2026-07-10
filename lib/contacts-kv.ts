import { kv } from "@vercel/kv";
import { nanoid } from "nanoid";
import { unstable_noStore as noStore } from "next/cache";
import { createEntityStore } from "./entity-store";
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
//  儲存結構：
//    contact:{id}      → 單筆聯絡人 (JSON)
//    contacts:index    → sorted set，member=id，score=updatedAt(ms)
//    contacts:order    → JSON string[]，手動拖曳後的顯示順序 (id 陣列)；
//                        不存在 = 未手動排序，改用預設分組排序
//                        (lib/contacts-sort.ts groupSortContacts)
//
//  CRUD 骨架由 lib/entity-store.ts 工廠提供；
//  手動排序 (order) 與 CSV 整批匯入為本模組特有，維持本地實作。
// ─────────────────────────────────────────────────────────────

const CONTACT_ORDER_KEY = "contacts:order";

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

const store = createEntityStore<Contact, ContactInput>({
  keyPrefix: "contact",
  indexKey: "contacts:index",
  memGlobalKey: "__sbContactsMem",
  migrate: migrateContact,
  cleanInput,
});

const KV_ENABLED = store.KV_ENABLED;

/** 建立新聯絡人 */
export const createContact = store.create;
/** 讀取單筆聯絡人 */
export const getContact = store.get;
/** 更新聯絡人 (保留 id / createdAt) */
export const updateContact = store.update;
/** 刪除聯絡人 */
export const deleteContact = store.remove;
/** 取得所有聯絡人 (依更新時間新 → 舊；不套用手動排序) */
export const getAllContacts = store.getAll;

// ── 手動排序的記憶體後援 (同樣掛 globalThis，跨模組實例共用) ──
const memOrder = ((
  globalThis as unknown as {
    __sbContactsOrderMem?: { value: string[] | null };
  }
).__sbContactsOrderMem ??= { value: null });

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
      pipeline.set(store.KEY(c.id), c);
      pipeline.zadd("contacts:index", { score: now + i, member: c.id });
    });
    await pipeline.exec();
  } else {
    contacts.forEach((c) => store.memStore.set(c.id, c));
  }
  return contacts;
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
  await store.restoreAll(contacts);
  await saveContactsOrder(order);
}

export { KV_ENABLED };
