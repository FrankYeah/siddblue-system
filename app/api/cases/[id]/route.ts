import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getCase, updateCase, deleteCase } from "@/lib/cases-kv";
import type { CaseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/cases/[id] — 讀取單筆案件 (需驗證)
export async function GET(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const record = await getCase(params.id);
  if (!record) {
    return NextResponse.json({ error: "找不到案件" }, { status: 404 });
  }
  return NextResponse.json({ case: record });
}

// PUT /api/cases/[id] — 更新案件 (需驗證)
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<CaseInput>;
    const record = await updateCase(params.id, {
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
    });
    if (!record) {
      return NextResponse.json({ error: "找不到案件" }, { status: 404 });
    }
    return NextResponse.json({ case: record });
  } catch (err) {
    console.error("[PUT /api/cases/:id]", err);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// DELETE /api/cases/[id] — 刪除案件 (需驗證)
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const ok = await deleteCase(params.id);
  if (!ok) {
    return NextResponse.json({ error: "找不到案件" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
