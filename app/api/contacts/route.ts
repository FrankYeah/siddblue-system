import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  createContact,
  getContactsView,
  saveContactsOrder,
} from "@/lib/contacts-kv";
import type { ContactInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/contacts — 列出所有聯絡人 (套用手動排序或預設分組，需驗證)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const { contacts, ordered } = await getContactsView();
  return NextResponse.json({ contacts, ordered });
}

// PUT /api/contacts — 儲存資料表的手動排序 (拖曳/插入後整包覆寫)
// body: { order: string[] }；{ order: null } 清除手動排序 (回到預設分組)
export async function PUT(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { order?: string[] | null };
    if (body.order !== null && !Array.isArray(body.order)) {
      return NextResponse.json({ error: "order 格式錯誤" }, { status: 400 });
    }
    await saveContactsOrder(body.order ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/contacts]", err);
    return NextResponse.json({ error: "儲存排序失敗" }, { status: 500 });
  }
}

// POST /api/contacts — 建立新聯絡人 (需驗證)
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<ContactInput>;
    const contact = await createContact({
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
    return NextResponse.json({ contact }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/contacts]", err);
    return NextResponse.json({ error: "建立失敗" }, { status: 500 });
  }
}
