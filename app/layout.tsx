import type { Metadata } from "next";
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
