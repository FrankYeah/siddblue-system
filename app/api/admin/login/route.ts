import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, expectedToken, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/admin/login — 驗證後台密碼並設定 cookie
export async function POST(req: NextRequest) {
  try {
    const { password } = (await req.json()) as { password?: string };
    if (!verifyPassword(password ?? "")) {
      return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
    }
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
