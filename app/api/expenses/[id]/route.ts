import { makeItemRoutes } from "@/lib/crud-routes";
import { deleteExpense, getExpense, updateExpense } from "@/lib/expenses-kv";
import type { Expense, ExpenseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET / PUT / DELETE /api/expenses/[id] — 單筆支出 (需驗證)
const routes = makeItemRoutes<Expense, ExpenseInput>({
  get: getExpense,
  update: updateExpense,
  remove: deleteExpense,
  singular: "expense",
  label: "支出",
});

export const GET = routes.GET;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
