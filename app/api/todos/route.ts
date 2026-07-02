import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getTodos, saveTodos } from "@/lib/workspace-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/todos — 讀取待辦清單 (需驗證)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const board = await getTodos();
  return NextResponse.json({ board });
}

// PUT /api/todos — 儲存整個待辦清單 (新增 / 刪除皆走此路徑)
export async function PUT(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { board?: unknown };
    const board = await saveTodos(body?.board);
    return NextResponse.json({ board });
  } catch (err) {
    console.error("[PUT /api/todos]", err);
    return NextResponse.json({ error: "儲存失敗" }, { status: 500 });
  }
}
