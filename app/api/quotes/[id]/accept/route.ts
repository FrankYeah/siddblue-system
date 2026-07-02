import { NextRequest, NextResponse } from "next/server";
import { acceptQuote } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/quotes/[id]/accept — 客戶線上確認接受報價 (公開，不需後台密碼)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { name } = (await req.json().catch(() => ({}))) as { name?: string };
    const quote = await acceptQuote(params.id, String(name ?? ""));
    if (!quote) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }
    return NextResponse.json({
      quote: {
        id: quote.id,
        status: quote.status,
        acceptedAt: quote.acceptedAt,
        acceptedBy: quote.acceptedBy,
      },
    });
  } catch (err) {
    console.error("[POST /api/quotes/:id/accept]", err);
    return NextResponse.json({ error: "確認失敗" }, { status: 500 });
  }
}
