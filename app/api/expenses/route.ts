import { makeCollectionRoutes } from "@/lib/crud-routes";
import { createExpense, getAllExpenses } from "@/lib/expenses-kv";
import type { Expense, ExpenseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/expenses — 列出所有支出 (新→舊，需登入)
// POST /api/expenses — 建立新支出 (需驗證)；欄位清理交給 expenses-kv 的 cleanInput
const routes = makeCollectionRoutes<Expense, ExpenseInput>({
  list: getAllExpenses,
  create: createExpense,
  singular: "expense",
  plural: "expenses",
  label: "支出",
});

export const GET = routes.GET;
export const POST = routes.POST;
