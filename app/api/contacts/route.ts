import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createContact, getAllContacts } from "@/lib/contacts-kv";
import type { ContactInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/contacts — 列出所有聯絡人 (後台用，需驗證)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const contacts = await getAllContacts();
  return NextResponse.json({ contacts });
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
