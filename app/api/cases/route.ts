import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createCase, getAllCases } from "@/lib/cases-kv";
import type { CaseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cases — 列出所有案件 (後台用，需驗證)
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const cases = await getAllCases();
  return NextResponse.json({ cases });
}

// POST /api/cases — 建立新案件 (需驗證)
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<CaseInput>;
    const record = await createCase({
      name: input?.name ?? "",
      caseType: input?.caseType ?? "own",
      quoteId: input?.quoteId ?? "",
      totalAmount: input?.totalAmount ?? 0,
      receivedAmount: input?.receivedAmount ?? 0,
      receivedPayments: input?.receivedPayments ?? [],
      withholdBusinessTax: input?.withholdBusinessTax ?? false,
      withholdIncomeTax: input?.withholdIncomeTax ?? false,
      taxPaid: input?.taxPaid ?? false,
      taxPaidNote: input?.taxPaidNote ?? "",
      partnerCosts: input?.partnerCosts ?? [],
      note: input?.note ?? "",
      closedAt: input?.closedAt,
    });
    return NextResponse.json({ case: record }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cases]", err);
    return NextResponse.json({ error: "建立失敗" }, { status: 500 });
  }
}
