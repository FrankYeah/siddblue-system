import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getNoteByShareToken } from "@/lib/notes-kv";
import { renderMarkdown } from "@/lib/markdown";
import { COMPANY_NAME } from "@/lib/defaults";
import { PaperPlane, SeagullFlock, CodeBraces } from "@/components/BrandDecor";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  });
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const note = await getNoteByShareToken(params.token);
  if (!note || !note.isShared) return { title: "找不到內容" };
  const description =
    note.type === "process"
      ? note.steps.map((s) => s.title).join("、").slice(0, 120)
      : note.content.slice(0, 120);
  return {
    title: `${note.title || "分享筆記"} — ${COMPANY_NAME}`,
    description,
    robots: { index: false, follow: false },
  };
}

export default async function SharedNotePage({
  params,
}: {
  params: { token: string };
}) {
  const note = await getNoteByShareToken(params.token);
  // 找不到、或未開啟對外分享 → 一律 404 (不洩漏筆記是否存在)
  if (!note || !note.isShared) notFound();

  const html = renderMarkdown(note.content);
  const typeLabel =
    note.type === "consulting"
      ? "諮詢紀錄"
      : note.type === "process"
        ? "流程知識"
        : "筆記";

  return (
    <div className="min-h-screen bg-paper-bg pb-20">
      {/* 品牌深藍漸層 Banner */}
      <header className="relative overflow-hidden bg-brand-gradient text-white">
        <SeagullFlock className="absolute inset-0" />
        <PaperPlane
          size={96}
          className="absolute right-[8%] top-[22%] text-white/20 animate-float-plane"
        />
        <div className="relative mx-auto max-w-3xl px-6 py-12 sm:py-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs backdrop-blur">
            <CodeBraces className="text-white/80" /> {typeLabel}分享
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">
            {note.title || "（未命名筆記）"}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
            <span>更新於 {fmtDate(note.updatedAt)}</span>
            <span className="text-white/70">由 {COMPANY_NAME} 分享</span>
          </div>
          {note.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-xs backdrop-blur"
                >
                  # {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* 內容卡片 (唯讀) */}
      <main className="mx-auto max-w-3xl px-6">
        <article className="-mt-6 rounded-2xl border border-paper-border bg-white p-6 shadow-card sm:p-8">
          {note.type === "process" ? (
            note.steps.length > 0 ? (
              <ol className="space-y-4">
                {note.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {s.title && (
                        <div className="font-medium text-paper-text">
                          {s.title}
                        </div>
                      )}
                      {s.description && (
                        <p className="mt-0.5 whitespace-pre-line text-sm text-paper-muted">
                          {s.description}
                        </p>
                      )}
                      {s.links.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {s.links
                            .filter((l) => l.url)
                            .map((l, li) => (
                              <a
                                key={li}
                                href={l.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                              >
                                <ExternalLink size={12} />
                                {l.label || "連結"}
                              </a>
                            ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-paper-muted">此流程目前沒有步驟。</p>
            )
          ) : html.trim() ? (
            <div
              className="md-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-paper-muted">此筆記目前沒有內容。</p>
          )}
        </article>

        <p className="mt-6 text-center text-xs text-paper-muted">
          本頁為唯讀分享頁，內容由 {COMPANY_NAME} 提供。
        </p>
      </main>
    </div>
  );
}
