import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

// POST /api/notes/upload — 上傳圖片至 Vercel Blob，回傳可公開存取的網址 (需驗證)
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  // 未設定 Blob 儲存空間時明確告知，而非讓 put() 拋出難懂的錯誤
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "尚未設定圖片儲存空間，請見 README「知識庫圖片上傳」設定說明" },
      { status: 501 },
    );
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "僅支援 PNG / JPEG / GIF / WebP 圖片" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "檔案過大（上限 8MB）" },
        { status: 400 },
      );
    }
    // 檔名僅取安全字元，避免路徑跳脫；addRandomSuffix 確保同名檔案不互相覆蓋
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const blob = await put(`notes/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[POST /api/notes/upload]", err);
    return NextResponse.json({ error: "上傳失敗" }, { status: 500 });
  }
}
