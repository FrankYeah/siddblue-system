import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  clearBackupError,
  recordBackupError,
  snapshotBackup,
} from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 全量匯出 + 寫入快照在資料量大時可能超過預設 10 秒上限
export const maxDuration = 60;

/**
 * Vercel Cron 只送 GET，且若專案設定了 CRON_SECRET 環境變數，
 * Vercel 會自動在請求帶上 `Authorization: Bearer <CRON_SECRET>`。
 * 未設定 CRON_SECRET 時，僅接受已登入的後台管理者手動觸發。
 */
function isCronOrAdmin(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) {
    return true;
  }
  return isAuthenticated();
}

// GET /api/backup/snapshot — 建立一份備份快照 (Cron 每日排程 或 後台手動「立即備份」)
export async function GET(req: NextRequest) {
  if (!isCronOrAdmin(req)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const meta = await snapshotBackup();
    // 成功即清除失敗紀錄；失敗則記錄下來，後台面板會顯示告警
    await clearBackupError();
    return NextResponse.json({ backup: meta });
  } catch (err) {
    console.error("[GET /api/backup/snapshot]", err);
    await recordBackupError(
      err instanceof Error ? err.message : String(err),
    ).catch(() => {});
    return NextResponse.json({ error: "備份失敗" }, { status: 500 });
  }
}
