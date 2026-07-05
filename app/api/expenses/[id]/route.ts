import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getExpense, updateExpense, deleteExpense } from "@/lib/expenses-kv";
import type { ExpenseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/expenses/[id] — 讀取單筆支出（需登入）
export async function GET(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const record = await getExpense(params.id);
  if (!record) {
    return NextResponse.json({ error: "找不到支出" }, { status: 404 });
  }
  return NextResponse.json({ expense: record });
}

// PUT /api/expenses/[id] — 更新支出（需登入）
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<ExpenseInput>;
    const record = await updateExpense(params.id, {
      title: input?.title ?? "",
      amount: input?.amount ?? 0,
      entity: input?.entity ?? "company",
      category: input?.category ?? "one-time",
      billingCycle: input?.billingCycle ?? "none",
      transactionDate: input?.transactionDate ?? "",
      note: input?.note ?? "",
    });
    if (!record) {
      return NextResponse.json({ error: "找不到支出" }, { status: 404 });
    }
    return NextResponse.json({ expense: record });
  } catch (err) {
    console.error("[PUT /api/expenses/:id]", err);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] — 刪除支出（需登入）
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const ok = await deleteExpense(params.id);
  if (!ok) {
    return NextResponse.json({ error: "找不到支出" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
