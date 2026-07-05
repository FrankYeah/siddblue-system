import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createExpense, getAllExpenses } from "@/lib/expenses-kv";
import type { ExpenseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/expenses — 列出所有支出（新→舊，需登入）
export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const expenses = await getAllExpenses();
  return NextResponse.json({ expenses });
}

// POST /api/expenses — 建立新支出（需登入）
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const input = (await req.json()) as Partial<ExpenseInput>;
    const record = await createExpense({
      title: input?.title ?? "",
      amount: input?.amount ?? 0,
      entity: input?.entity ?? "company",
      category: input?.category ?? "one-time",
      billingCycle: input?.billingCycle ?? "none",
      transactionDate: input?.transactionDate ?? "",
      note: input?.note ?? "",
    });
    return NextResponse.json({ expense: record }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/expenses]", err);
    return NextResponse.json({ error: "建立失敗" }, { status: 500 });
  }
}
