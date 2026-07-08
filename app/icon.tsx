import { ImageResponse } from "next/og";
import { brandIconElement } from "@/lib/pwa-icon";

export const runtime = "nodejs";

// 192 / 512：符合 PWA manifest 常見的最小圖示尺寸要求，同一份視覺兩種尺寸皆產生，
// Next.js 會自動加上對應的 <link rel="icon" sizes="..."> 分頁圖示標籤。
const SIZES = [192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png" as const,
  }));
}

export default function Icon({ id }: { id: string }) {
  const size = Number(id) || 512;
  return new ImageResponse(brandIconElement(size), {
    width: size,
    height: size,
  });
}
