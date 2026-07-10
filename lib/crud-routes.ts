import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

// ─────────────────────────────────────────────────────────────
//  泛用「逐筆實體」CRUD Route Handler 工廠
//
//  cases / expenses / notes 等實體的 route.ts 幾乎逐字同構：
//  驗證 → 呼叫資料層 → 統一的回應形狀與錯誤訊息。
//  此工廠收攏骨架；欄位預設值與清理一律交給資料層的 cleanInput
//  （各 store 的 cleanInput 本就處理 Partial/undefined 輸入，
//  過去 route 內逐欄 `?? 預設值` 與其重複）。
//
//  回應形狀與既有 route 完全一致：
//    GET  集合   → { [plural]: T[] }
//    POST 集合   → { [singular]: T }, 201
//    GET  單筆   → { [singular]: T } / 404 { error: "找不到{label}" }
//    PUT  單筆   → { [singular]: T } / 404
//    DELETE 單筆 → { ok: true } / 404
// ─────────────────────────────────────────────────────────────

type Params = { params: { id: string } };

export function makeCollectionRoutes<T, TInput>(opts: {
  list: () => Promise<T[]>;
  create: (input: TInput) => Promise<T>;
  /** 回應物件的單數 key，如 "case" */
  singular: string;
  /** 回應物件的複數 key，如 "cases" */
  plural: string;
  /** 錯誤訊息用的中文名稱，如 "案件" */
  label: string;
}) {
  async function GET() {
    if (!isAuthenticated()) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const records = await opts.list();
    return NextResponse.json({ [opts.plural]: records });
  }

  async function POST(req: NextRequest) {
    if (!isAuthenticated()) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    try {
      const input = (await req.json()) as TInput;
      const record = await opts.create(input);
      return NextResponse.json({ [opts.singular]: record }, { status: 201 });
    } catch (err) {
      console.error(`[POST ${opts.plural}]`, err);
      return NextResponse.json({ error: "建立失敗" }, { status: 500 });
    }
  }

  return { GET, POST };
}

export function makeItemRoutes<T, TInput>(opts: {
  get: (id: string) => Promise<T | null>;
  update: (id: string, input: TInput) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  singular: string;
  label: string;
}) {
  const notFound = () =>
    NextResponse.json({ error: `找不到${opts.label}` }, { status: 404 });

  async function GET(_req: NextRequest, { params }: Params) {
    if (!isAuthenticated()) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const record = await opts.get(params.id);
    if (!record) return notFound();
    return NextResponse.json({ [opts.singular]: record });
  }

  async function PUT(req: NextRequest, { params }: Params) {
    if (!isAuthenticated()) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    try {
      const input = (await req.json()) as TInput;
      const record = await opts.update(params.id, input);
      if (!record) return notFound();
      return NextResponse.json({ [opts.singular]: record });
    } catch (err) {
      console.error(`[PUT ${opts.singular}/:id]`, err);
      return NextResponse.json({ error: "更新失敗" }, { status: 500 });
    }
  }

  async function DELETE(_req: NextRequest, { params }: Params) {
    if (!isAuthenticated()) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const ok = await opts.remove(params.id);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  }

  return { GET, PUT, DELETE };
}
