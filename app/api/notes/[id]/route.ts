import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getNote, updateNote, deleteNote } from "@/lib/notes-kv";
import type { NoteInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/notes/[id] — 讀取單筆 (後台用，需驗證；對外分享走 /shared/note/[token])
export async function GET(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const note = await getNote(params.id);
  if (!note) {
    return NextResponse.json({ error: "找不到筆記" }, { status: 404 });
  }
  return NextResponse.json({ note });
}

// PUT /api/notes/[id] — 更新 (需驗證)
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<NoteInput>;
    const note = await updateNote(params.id, {
      title: input?.title ?? "",
      content: input?.content ?? "",
      tags: input?.tags ?? [],
      type: input?.type ?? "general",
      isShared: input?.isShared ?? false,
    });
    if (!note) {
      return NextResponse.json({ error: "找不到筆記" }, { status: 404 });
    }
    return NextResponse.json({ note });
  } catch (err) {
    console.error("[PUT /api/notes/:id]", err);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// DELETE /api/notes/[id] — 刪除 (需驗證)
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const ok = await deleteNote(params.id);
  if (!ok) {
    return NextResponse.json({ error: "找不到筆記" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
