import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { COMPANY_NAME } from "@/lib/defaults";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${COMPANY_NAME} — 報價單與規格生成工具`,
  description: "數位專案報價與規格確認流程工具",
  robots: { index: false, follow: false },
  // iOS「加到主畫面」以獨立視窗開啟（無 Safari 網址列）
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: COMPANY_NAME,
  },
};

// 手機版：跟隨裝置寬度，允許使用者縮放（維持無障礙），
// 由 globals.css 將輸入框字級設為 16px 以避免 iOS 聚焦時自動放大。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0052D4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
