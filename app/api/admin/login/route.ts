import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, expectedToken, verifyPassword } from "@/lib/auth";
import {
  getClientIp,
  isLoginThrottled,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/login-throttle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/login — 驗證後台密碼並設定 cookie（依 IP 防暴力破解）
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  try {
    const throttle = await isLoginThrottled(ip);
    if (throttle.blocked) {
      return NextResponse.json(
        {
          error: `嘗試次數過多，請 ${Math.ceil(throttle.retryAfterSec / 60)} 分鐘後再試`,
          retryAfterSec: throttle.retryAfterSec,
        },
        { status: 429 },
      );
    }

    const { password } = (await req.json()) as { password?: string };
    if (!verifyPassword(password ?? "")) {
      const fail = await recordLoginFailure(ip);
      return NextResponse.json(
        {
          error: fail.blocked
            ? `密碼錯誤次數過多，請 ${Math.ceil(fail.retryAfterSec / 60)} 分鐘後再試`
            : "密碼錯誤",
          remainingAttempts: fail.remainingAttempts,
        },
        { status: fail.blocked ? 429 : 401 },
      );
    }

    await recordLoginSuccess(ip);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, expectedToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 天
    });
    return res;
  } catch {
    return NextResponse.json({ error: "登入失敗" }, { status: 400 });
  }
}

// DELETE /api/admin/login — 登出
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
