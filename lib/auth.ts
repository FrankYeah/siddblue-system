import { cookies } from "next/headers";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────
//  後台簡易密碼保護
//  設定 ADMIN_PASSWORD 後，/admin 與寫入 API 需登入；
//  未設定則預設開放 (方便本機開發)。
// ─────────────────────────────────────────────────────────────

export const ADMIN_COOKIE = "sb_admin";

export function adminPasswordSet(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** 由密碼推導出的 cookie 令牌 (非明碼儲存) */
export function expectedToken(): string {
  const pw = process.env.ADMIN_PASSWORD || "";
  return crypto
    .createHash("sha256")
    .update(`${pw}::siddblue-quote-system`)
    .digest("hex");
}

/** 目前請求是否已通過後台驗證 */
export function isAuthenticated(): boolean {
  if (!adminPasswordSet()) return true;
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return token === expectedToken();
}

/** 密碼是否正確 */
export function verifyPassword(input: string): boolean {
  if (!adminPasswordSet()) return true;
  const a = Buffer.from(input || "");
  const b = Buffer.from(process.env.ADMIN_PASSWORD || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
