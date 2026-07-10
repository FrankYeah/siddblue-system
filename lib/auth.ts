import { cookies } from "next/headers";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────
//  後台簡易密碼保護
//  設定 ADMIN_PASSWORD 後，/admin 與寫入 API 需登入；
//  未設定則預設開放 (方便本機開發)。
//
//  令牌格式：`${到期時間ms}.${HMAC(到期時間ms)}`
//  - 帶到期時間：cookie 被竊也只在效期內有效，不再是「永久通行證」
//    (舊版令牌是密碼雜湊的常數，洩漏一次 = 永久有效直到改密碼)
//  - HMAC 金鑰由 ADMIN_PASSWORD 推導：改密碼即讓所有既存令牌立即失效
//  - 比對一律 timingSafeEqual，避免時序側信道
// ─────────────────────────────────────────────────────────────

export const ADMIN_COOKIE = "sb_admin";

/** 令牌效期（與 cookie maxAge 對齊） */
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天

export function adminPasswordSet(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** 由密碼推導的 HMAC 簽章金鑰（不存明碼；改密碼 = 全令牌失效） */
function signingKey(): Buffer {
  const pw = process.env.ADMIN_PASSWORD || "";
  return crypto
    .createHash("sha256")
    .update(`${pw}::siddblue-quote-system`)
    .digest();
}

function signExpiry(expiresAtMs: number): string {
  return crypto
    .createHmac("sha256", signingKey())
    .update(String(expiresAtMs))
    .digest("hex");
}

/** 簽發登入令牌（登入成功時呼叫） */
export function issueToken(): string {
  const expiresAtMs = Date.now() + TOKEN_TTL_SECONDS * 1000;
  return `${expiresAtMs}.${signExpiry(expiresAtMs)}`;
}

/** 驗證令牌：格式、效期、簽章（timingSafeEqual）缺一不可 */
function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresAtMs = Number(token.slice(0, dot));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signExpiry(expiresAtMs));
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(given, expected);
}

/** 目前請求是否已通過後台驗證 */
export function isAuthenticated(): boolean {
  if (!adminPasswordSet()) return true;
  return verifyToken(cookies().get(ADMIN_COOKIE)?.value);
}

/** 密碼是否正確 */
export function verifyPassword(input: string): boolean {
  if (!adminPasswordSet()) return true;
  const a = Buffer.from(input || "");
  const b = Buffer.from(process.env.ADMIN_PASSWORD || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
