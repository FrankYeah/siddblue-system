import type { MetadataRoute } from "next";
import { COMPANY_NAME } from "@/lib/defaults";

// ─────────────────────────────────────────────────────────────
//  PWA Web App Manifest — 讓手機瀏覽器能「加到主畫面」，
//  以近似原生 App 的獨立視窗 (standalone) 開啟 /admin 後台。
//
//  刻意不加 Service Worker：本系統所有資料都即時讀 Vercel KV
//  (見 lib/kv.ts 等的 noStore() 慣例)，離線快取 API 回應容易讓
//  後台顯示過期的報價/案件/收付款資料，風險大於「離線可用」的好處。
// ─────────────────────────────────────────────────────────────
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${COMPANY_NAME} 創作者工作區`,
    short_name: COMPANY_NAME,
    description: "報價單、案件財務、知識庫等內部管理後台",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#F7F5F0",
    theme_color: "#0052D4",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
