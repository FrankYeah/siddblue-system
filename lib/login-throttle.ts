import { kv } from "@vercel/kv";

// ─────────────────────────────────────────────────────────────
//  登入防暴力破解：依來源 IP 限制連續失敗次數
//
//  規則：同一 IP 在 WINDOW 內累計失敗達 MAX_ATTEMPTS 次 → 鎖定 LOCKOUT，
//  期間內即使密碼正確也拒絕嘗試 (回覆倒數秒數)；成功登入立即清除計數。
//  記錄本身帶 TTL = LOCKOUT，久無失敗會自然過期重置，無需額外清理排程。
//
//  未設定 KV 環境變數時 (本機開發未接 KV)，自動改用記憶體儲存 (globalThis)。
// ─────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 分鐘

const KV_ENABLED = Boolean(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
);

interface ThrottleState {
  count: number;
  /** 鎖定解除時間 (ms epoch)；0 = 未鎖定 */
  lockedUntil: number;
}

const THROTTLE_KEY = (ip: string) => `login:throttle:${ip}`;

// 記憶體後援：掛在 globalThis，重啟即清空 (僅本機開發使用)
const mem: Map<string, ThrottleState> = ((
  globalThis as unknown as { __sbLoginThrottleMem?: Map<string, ThrottleState> }
).__sbLoginThrottleMem ??= new Map<string, ThrottleState>());

async function getState(ip: string): Promise<ThrottleState> {
  if (KV_ENABLED) {
    const v = await kv.get<ThrottleState>(THROTTLE_KEY(ip));
    return v ?? { count: 0, lockedUntil: 0 };
  }
  return mem.get(ip) ?? { count: 0, lockedUntil: 0 };
}

async function setState(ip: string, state: ThrottleState): Promise<void> {
  if (KV_ENABLED) {
    await kv.set(THROTTLE_KEY(ip), state, { ex: LOCKOUT_SECONDS });
  } else {
    mem.set(ip, state);
  }
}

/** 由請求標頭萃取來源 IP（Vercel 會附加 x-forwarded-for）；取不到則退回固定值 */
export function getClientIp(req: {
  headers: { get(name: string): string | null };
  ip?: string;
}): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.ip || "unknown";
}

/** 登入前檢查：目前是否處於鎖定中 */
export async function isLoginThrottled(
  ip: string,
): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const state = await getState(ip);
  if (state.lockedUntil > Date.now()) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((state.lockedUntil - Date.now()) / 1000),
    };
  }
  return { blocked: false, retryAfterSec: 0 };
}

/** 密碼錯誤時呼叫：累計失敗次數，達門檻即鎖定 */
export async function recordLoginFailure(ip: string): Promise<{
  blocked: boolean;
  remainingAttempts: number;
  retryAfterSec: number;
}> {
  const prev = await getState(ip);
  const count = prev.count + 1;
  const lockedUntil =
    count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_SECONDS * 1000 : prev.lockedUntil;
  await setState(ip, { count, lockedUntil });
  const blocked = lockedUntil > Date.now();
  return {
    blocked,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - count),
    retryAfterSec: blocked ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0,
  };
}

/** 密碼正確時呼叫：清除該 IP 的失敗紀錄 */
export async function recordLoginSuccess(ip: string): Promise<void> {
  if (KV_ENABLED) {
    await kv.del(THROTTLE_KEY(ip));
  } else {
    mem.delete(ip);
  }
}
