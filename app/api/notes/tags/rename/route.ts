import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { renameTag } from "@/lib/notes-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/notes/tags/rename — 全站重新命名標籤（知識庫資料夾側欄用），回傳有異動的筆記
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const { from, to } = (await req.json()) as { from?: string; to?: string };
    if (!from?.trim() || !to?.trim()) {
      return NextResponse.json({ error: "標籤名稱不可為空" }, { status: 400 });
    }
    const notes = await renameTag(from, to);
    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[POST /api/notes/tags/rename]", err);
    return NextResponse.json({ error: "重新命名失敗" }, { status: 500 });
  }
}
