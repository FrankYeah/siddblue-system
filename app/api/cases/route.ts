import { makeCollectionRoutes } from "@/lib/crud-routes";
import { createCase, getAllCases } from "@/lib/cases-kv";
import type { Case, CaseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/cases — 列出所有案件 (後台用，需驗證)
// POST /api/cases — 建立新案件 (需驗證)；欄位清理交給 cases-kv 的 cleanInput
const routes = makeCollectionRoutes<Case, CaseInput>({
  list: getAllCases,
  create: createCase,
  singular: "case",
  plural: "cases",
  label: "案件",
});

export const GET = routes.GET;
export const POST = routes.POST;
