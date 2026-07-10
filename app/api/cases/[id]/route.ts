import { makeItemRoutes } from "@/lib/crud-routes";
import { deleteCase, getCase, updateCase } from "@/lib/cases-kv";
import type { Case, CaseInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET / PUT / DELETE /api/cases/[id] — 單筆案件 (需驗證)
const routes = makeItemRoutes<Case, CaseInput>({
  get: getCase,
  update: updateCase,
  remove: deleteCase,
  singular: "case",
  label: "案件",
});

export const GET = routes.GET;
export const PUT = routes.PUT;
export const DELETE = routes.DELETE;
