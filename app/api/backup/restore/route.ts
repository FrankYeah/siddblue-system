import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { restoreBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 還原 = 還原前自動快照 + 七模組清空重寫，資料量大時可能超過預設 10 秒上限
export const maxDuration = 60;

// POST /api/backup/restore — 還原到指定快照 (危險操作，覆寫目前全部資料；需登入)
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { id?: string };
    if (!body?.id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }
    const result = await restoreBackup(body.id);
    if (!result) {
      return NextResponse.json({ error: "找不到該備份" }, { status: 404 });
    }
    return NextResponse.json({ restored: result });
  } catch (err) {
    console.error("[POST /api/backup/restore]", err);
    return NextResponse.json({ error: "還原失敗" }, { status: 500 });
  }
}
