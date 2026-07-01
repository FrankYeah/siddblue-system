import Link from "next/link";
import { ArrowRight, FileSpreadsheet, LayoutDashboard } from "lucide-react";
import { PaperPlane, SeagullFlock, CodeBraces } from "@/components/BrandDecor";
import { COMPANY_NAME, COMPANY_BRAND_EN } from "@/lib/defaults";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-gradient text-white">
      <SeagullFlock className="absolute inset-0" />

      {/* 漂浮紙飛機 */}
      <PaperPlane
        size={120}
        className="absolute right-[8%] top-[14%] text-white/20 animate-float-plane"
      />
      <PaperPlane
        size={56}
        className="absolute left-[12%] bottom-[18%] text-white/15 animate-float-plane [animation-delay:-3s]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm backdrop-blur">
          <CodeBraces className="text-white/80" />
          <span className="tracking-wide">{COMPANY_BRAND_EN}</span>
        </div>

        <h1 className="animate-fade-up text-4xl font-bold leading-tight sm:text-5xl">
          {COMPANY_NAME}
        </h1>
        <p className="animate-fade-up mt-4 max-w-xl text-lg text-white/85 [animation-delay:0.1s]">
          報價單與規格生成工具 — 讓每一份數位專案報價，
          <br className="hidden sm:block" />
          兼具海洋般的遼闊視野與工程的嚴謹細節。
        </p>

        <div className="animate-fade-up mt-10 flex flex-col gap-3 sm:flex-row [animation-delay:0.2s]">
          <Link
            href="/admin"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 shadow-float transition hover:bg-brand-50"
          >
            <LayoutDashboard size={18} />
            進入後台管理
            <ArrowRight
              size={18}
              className="transition group-hover:translate-x-1"
            />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            <FileSpreadsheet size={18} />
            了解功能
          </a>
        </div>

        <div
          id="features"
          className="animate-fade-up mt-16 grid w-full gap-4 sm:grid-cols-3 [animation-delay:0.3s]"
        >
          {[
            {
              t: "動態報價編輯",
              d: "即時加總、一鍵帶入預設範本、CSV 匯出。",
            },
            {
              t: "品牌規格頁",
              d: "Notion 風格區塊，對外分享專屬確認連結。",
            },
            {
              t: "企業級 PDF",
              d: "一鍵切換 Excel 方格排版，自動押公司大小章。",
            },
          ].map((f) => (
            <div
              key={f.t}
              className="rounded-2xl border border-white/20 bg-white/10 p-5 text-left backdrop-blur"
            >
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-1.5 text-sm text-white/80">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
