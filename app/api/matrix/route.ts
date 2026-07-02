import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// AI 生成可能超過預設 10 秒，放寬 serverless function 上限
export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────
//  內容矩陣引擎 (Content Matrix Engine)
//  長文（電子報 / 商業分析 / 顧問紀錄）→ 300 字內短影音腳本
//  模型：claude-opus-4-8（@ai-sdk/anthropic 會自動讀 ANTHROPIC_API_KEY）
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是「西打藍好內容有限公司」的資深內容總監，擅長將深度的商業模式分析、長篇書籍架構或顧問輔導紀錄，萃取成高轉化率的短影音腳本。

你的任務：把使用者提供的長文內容，改寫成一支繁體中文短影音口播腳本。

腳本必須包含三個部分（依序輸出，不要加小標題以外的裝飾）：

【Hook】黃金前 3 秒——用一句反直覺、具體、或戳中痛點的話抓住注意力。不要用「大家好」「今天要講」開場。

【核心邏輯】從原文萃取「一個」最有價值的核心觀點，用口語化的因果推演展開（因為 A → 所以 B → 這代表 C）。捨棄次要細節，寧可深挖一點、不要淺談十點。

【CTA】強而有力的行動呼籲——具體告訴觀眾下一步做什麼（追蹤、留言關鍵字、私訊、收藏），一句話收尾。

硬性規則：
- 全文（含標記）限制在 300 字以內。
- 使用台灣慣用的繁體中文口語，句子短，適合口播。
- 直接輸出腳本本身，不要任何前言、說明或註解。`;

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "尚未設定 ANTHROPIC_API_KEY，請於環境變數加入後重新部署" },
      { status: 503 },
    );
  }
  try {
    const body = (await req.json()) as { title?: unknown; content?: unknown };
    const title = String(body?.title ?? "").slice(0, 300);
    const content = String(body?.content ?? "").trim();
    if (!content) {
      return NextResponse.json(
        { error: "請提供要轉譯的長文內容" },
        { status: 400 },
      );
    }

    const { text } = await generateText({
      model: anthropic("claude-opus-4-8"),
      system: SYSTEM_PROMPT,
      // 內容超長時截斷（20000 字已遠超電子報長度，避免異常輸入撐爆請求）
      prompt: `標題：${title || "（未命名）"}\n\n【原始長文內容】\n${content.slice(0, 20000)}`,
      maxOutputTokens: 1024,
    });

    const script = text.trim();
    if (!script) {
      return NextResponse.json({ error: "生成結果為空，請再試一次" }, { status: 502 });
    }
    return NextResponse.json({ script });
  } catch (err) {
    console.error("[POST /api/matrix]", err);
    return NextResponse.json(
      { error: "生成失敗，請稍後再試" },
      { status: 500 },
    );
  }
}
