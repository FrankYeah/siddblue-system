import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { importContacts } from "@/lib/contacts-kv";
import type { ContactInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 單批上限：CSV 匯入一次最多 500 筆，超過請分批 */
const MAX_BATCH = 500;

// POST /api/contacts/import — 整批匯入聯絡人 (CSV 匯入用，需驗證)
// body: { contacts: ContactInput[] } → { contacts: Contact[], count }
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { contacts?: Partial<ContactInput>[] };
    const rows = Array.isArray(body?.contacts) ? body.contacts : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "沒有可匯入的資料" }, { status: 400 });
    }
    if (rows.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `一次最多匯入 ${MAX_BATCH} 筆，請分批匯入` },
        { status: 400 },
      );
    }
    const inputs: ContactInput[] = rows.map((r) => ({
      name: r?.name ?? "",
      profession: r?.profession ?? "",
      contactInfo: r?.contactInfo ?? "",
      url: r?.url ?? "",
      familiarity: r?.familiarity ?? "medium",
      ability: r?.ability ?? "medium",
      price: r?.price ?? "medium",
      status: r?.status ?? "freelance",
      cooperationType: r?.cooperationType ?? "project",
      note: r?.note ?? "",
    }));
    const contacts = await importContacts(inputs);
    return NextResponse.json(
      { contacts, count: contacts.length },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/contacts/import]", err);
    return NextResponse.json({ error: "匯入失敗" }, { status: 500 });
  }
}
