import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getTodosView, saveTodos } from "@/lib/workspace-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/todos — 讀取待辦清單 (需驗證)；rev 為版本號，PUT 時帶回以防跨裝置互蓋
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const { board, rev } = await getTodosView();
  return NextResponse.json({ board, rev });
}

// PUT /api/todos — 儲存整個待辦清單 (新增 / 刪除皆走此路徑)
// body 帶 rev（讀取時拿到的版本）：與現存不符回 409 + 最新內容，
// 避免舊快照默默蓋掉另一部裝置剛寫入的變更；不帶 rev 維持舊行為（無條件覆寫）。
export async function PUT(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { board?: unknown; rev?: unknown };
    const expectedRev =
      typeof body?.rev === "number" && Number.isInteger(body.rev) && body.rev >= 0
        ? body.rev
        : undefined;
    const result = await saveTodos(body?.board, expectedRev);
    if (!result.ok) {
      return NextResponse.json(
        { error: "版本衝突", board: result.board, rev: result.rev },
        { status: 409 },
      );
    }
    return NextResponse.json({ board: result.board, rev: result.rev });
  } catch (err) {
    console.error("[PUT /api/todos]", err);
    return NextResponse.json({ error: "儲存失敗" }, { status: 500 });
  }
}
