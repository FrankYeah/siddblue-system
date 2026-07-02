import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getInspirations, saveInspirations } from "@/lib/workspace-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/inspirations — 讀取靈感看板 (需驗證)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const board = await getInspirations();
  return NextResponse.json({ board });
}

// PUT /api/inspirations — 儲存整個看板 (新增 / 編輯 / 拖曳重排皆走此路徑)
export async function PUT(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { board?: unknown };
    const board = await saveInspirations(body?.board);
    return NextResponse.json({ board });
  } catch (err) {
    console.error("[PUT /api/inspirations]", err);
    return NextResponse.json({ error: "儲存失敗" }, { status: 500 });
  }
}
