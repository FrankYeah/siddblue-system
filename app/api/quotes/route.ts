import { NextRequest, NextResponse } from "next/server";
import { createQuote, listQuotes } from "@/lib/kv";
import { isAuthenticated } from "@/lib/auth";
import { normalizeQuoteInput } from "@/lib/normalize";
import type { QuoteInput } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/quotes — 列出所有報價單摘要 (後台用，需驗證)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const quotes = await listQuotes();
  return NextResponse.json({ quotes });
}

// POST /api/quotes — 建立新報價單
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as QuoteInput;
    if (!input || typeof input !== "object") {
      return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
    }
    const quote = await createQuote(normalizeQuoteInput(input));
    return NextResponse.json({ quote }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/quotes]", err);
    return NextResponse.json({ error: "建立失敗" }, { status: 500 });
  }
}
