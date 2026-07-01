import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// 明確使用 Node.js (Serverless) runtime；@vercel/kv 走 HTTP，
// 於 Edge / Serverless 皆可運作，此處固定 nodejs 以與其他路由一致。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
//  GET /api/test-db
//  Vercel KV 連線健檢：寫入一筆「西打藍測試報價單」→ 立即讀回 → 比對
//  ?keep=1 保留測試資料；預設讀回後即刪除，不污染資料庫。
// ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const keep = new URL(request.url).searchParams.get("keep") === "1";

  // 1) 環境變數偵測 (只回報是否存在，不外洩內容)
  const envDetected = {
    KV_REST_API_URL: Boolean(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: Boolean(process.env.KV_REST_API_TOKEN),
    KV_URL: Boolean(process.env.KV_URL),
  };

  if (!envDetected.KV_REST_API_URL || !envDetected.KV_REST_API_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        stage: "env-check",
        error: "找不到 KV_REST_API_URL 或 KV_REST_API_TOKEN 環境變數",
        hint: "確認 .env.local 已填入且已重啟 dev server；線上請於 Vercel → Project → Settings → Environment Variables 綁定 KV。",
        envDetected,
      },
      { status: 500 },
    );
  }

  // 2) 準備測試資料
  const testKey = "test:siddblue";
  const sample = {
    id: "test-" + Date.now(),
    clientName: "西打藍測試報價單",
    quoteDate: new Date().toISOString().slice(0, 10),
    total: 88000,
    note: "這是一筆用於 KV 連線健檢的假資料。",
    stampedAt: new Date().toISOString(),
  };

  const started = Date.now();
  try {
    // 3) 寫入
    await kv.set(testKey, sample);

    // 4) 立即讀回
    const readBack = await kv.get<typeof sample>(testKey);

    const latencyMs = Date.now() - started;
    const match =
      Boolean(readBack) && readBack?.id === sample.id;

    // 5) 清理 (除非 ?keep=1)
    if (!keep) {
      await kv.del(testKey);
    }

    return NextResponse.json({
      ok: match,
      stage: "read-write",
      message: match
        ? "✅ Vercel KV 連線成功：寫入與讀取皆正常"
        : "⚠️ 已連線但讀回資料與寫入不一致",
      envDetected,
      latencyMs,
      kept: keep,
      wrote: sample,
      readBack,
    });
  } catch (err) {
    // 6) 錯誤除錯 (常見：Unauthorized / token 錯誤 / URL 錯誤)
    const message = err instanceof Error ? err.message : String(err);
    let hint = "請確認 KV_REST_API_URL 與 KV_REST_API_TOKEN 是否正確且互相對應。";
    if (/unauthorized|401/i.test(message)) {
      hint =
        "Unauthorized：KV_REST_API_TOKEN 不正確，或與 KV_REST_API_URL 不是同一個資料庫。請至 Vercel KV 的 .env.local 分頁重新複製。";
    } else if (/fetch failed|ENOTFOUND|network/i.test(message)) {
      hint = "連線失敗：KV_REST_API_URL 可能有誤，或網路無法連到 Upstash。";
    }
    return NextResponse.json(
      { ok: false, stage: "read-write", error: message, hint, envDetected },
      { status: 500 },
    );
  }
}
