import { NextRequest, NextResponse } from "next/server";
import {
  getQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  QUOTE_STATUSES,
} from "@/lib/kv";
import { isAuthenticated } from "@/lib/auth";
import { normalizeQuoteInput } from "@/lib/normalize";
import type { QuoteInput, QuoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/quotes/[id] — 讀取單筆 (前台公開)
export async function GET(_req: NextRequest, { params }: Params) {
  const quote = await getQuote(params.id);
  if (!quote) {
    return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
  }
  return NextResponse.json({ quote });
}

// PUT /api/quotes/[id] — 更新 (需驗證)
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as QuoteInput;
    const quote = await updateQuote(params.id, normalizeQuoteInput(input));
    if (!quote) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }
    return NextResponse.json({ quote });
  } catch (err) {
    console.error("[PUT /api/quotes/:id]", err);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// PATCH /api/quotes/[id] — 僅更新狀態 (草稿 / 已發送 / 已確認，需驗證)
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const { status } = (await req.json()) as { status?: QuoteStatus };
    if (!status || !QUOTE_STATUSES.includes(status)) {
      return NextResponse.json({ error: "狀態值不合法" }, { status: 400 });
    }
    const quote = await updateQuoteStatus(params.id, status);
    if (!quote) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }
    return NextResponse.json({ quote });
  } catch (err) {
    console.error("[PATCH /api/quotes/:id]", err);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// DELETE /api/quotes/[id] — 刪除 (需驗證)
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const ok = await deleteQuote(params.id);
  if (!ok) {
    return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
