import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getBackupError, listBackups } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/backup/list — 列出所有備份快照 (新→舊，需登入)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const [backups, lastError] = await Promise.all([
    listBackups(),
    getBackupError(),
  ]);
  return NextResponse.json({ backups, lastError });
}
