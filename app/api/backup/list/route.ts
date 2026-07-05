import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listBackups } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/backup/list — 列出所有備份快照 (新→舊，需登入)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const backups = await listBackups();
  return NextResponse.json({ backups });
}
