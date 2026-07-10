import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createNote, getAllNotes, listNotes } from "@/lib/notes-kv";
import type { NoteInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/notes — 列出所有筆記摘要 (後台用，需驗證)
// ?full=1 回傳完整筆記（含 content/steps），供 NotesBoard 切回分頁時重新同步
export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const full = req.nextUrl.searchParams.get("full") === "1";
  const notes = full ? await getAllNotes() : await listNotes();
  return NextResponse.json({ notes });
}

// POST /api/notes — 建立新筆記 (需驗證)
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<NoteInput>;
    const note = await createNote({
      title: input?.title ?? "",
      content: input?.content ?? "",
      tags: input?.tags ?? [],
      type: input?.type ?? "general",
      steps: input?.steps ?? [],
      isShared: input?.isShared ?? false,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/notes]", err);
    return NextResponse.json({ error: "建立失敗" }, { status: 500 });
  }
}
