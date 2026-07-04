import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getContact, updateContact, deleteContact } from "@/lib/contacts-kv";
import type { ContactInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/contacts/[id] — 讀取單筆聯絡人 (需驗證)
export async function GET(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const contact = await getContact(params.id);
  if (!contact) {
    return NextResponse.json({ error: "找不到聯絡人" }, { status: 404 });
  }
  return NextResponse.json({ contact });
}

// PUT /api/contacts/[id] — 更新聯絡人 (需驗證)
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<ContactInput>;
    const contact = await updateContact(params.id, {
      name: input?.name ?? "",
      profession: input?.profession ?? "",
      contactInfo: input?.contactInfo ?? "",
      url: input?.url ?? "",
      familiarity: input?.familiarity ?? "unknown",
      liking: input?.liking ?? "unknown",
      ability: input?.ability ?? "unknown",
      price: input?.price ?? "unknown",
      status: input?.status ?? "unknown",
      cooperationType: input?.cooperationType ?? "project",
      transferInfo: input?.transferInfo ?? "",
      note: input?.note ?? "",
    });
    if (!contact) {
      return NextResponse.json({ error: "找不到聯絡人" }, { status: 404 });
    }
    return NextResponse.json({ contact });
  } catch (err) {
    console.error("[PUT /api/contacts/:id]", err);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// DELETE /api/contacts/[id] — 刪除聯絡人 (需驗證)
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const ok = await deleteContact(params.id);
  if (!ok) {
    return NextResponse.json({ error: "找不到聯絡人" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
