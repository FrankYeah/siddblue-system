import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { exportAllData } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/backup/export — 匯出目前全部資料為 JSON 檔 (需登入)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const payload = await exportAllData();
  const filename = `siddblue-backup-${payload.exportedAt.slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
