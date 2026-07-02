"use client";

import { useState } from "react";
import {
  Printer,
  FileDown,
  Clock,
  CalendarDays,
  Wallet,
  Wrench,
  ListChecks,
  Info,
  Table2,
  Eye,
  BadgeCheck,
  Loader2,
  ClipboardList,
  ExternalLink,
} from "lucide-react";
import { PaperPlane, SeagullFlock, CodeBraces } from "@/components/BrandDecor";
import { itemsTotal, formatNT, formatCurrency } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { Quote } from "@/lib/types";

function fmtDateTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function QuoteView({ quote }: { quote: Quote }) {
  const [excelPreview, setExcelPreview] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | undefined>(
    quote.acceptedAt,
  );
  const [acceptedBy, setAcceptedBy] = useState<string | undefined>(
    quote.acceptedBy,
  );
  const [name, setName] = useState("");
  const [accepting, setAccepting] = useState(false);
  const total = itemsTotal(quote.items);

  function print() {
    window.print();
  }

  async function confirmAccept() {
    setAccepting(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const { quote: q } = (await res.json()) as {
          quote: { acceptedAt?: string; acceptedBy?: string };
        };
        setAcceptedAt(q.acceptedAt);
        setAcceptedBy(q.acceptedBy);
      }
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className={excelPreview ? "excel-preview" : ""}>
      {/* ══════════════ 螢幕：品牌 Notion 風格頁 ══════════════ */}
      <div className="no-print bg-paper-bg pb-20">
        {/* 頂部 Banner */}
        <header
          className={`relative overflow-hidden bg-brand-gradient text-white ${
            excelPreview ? "hidden" : ""
          }`}
        >
          <SeagullFlock className="absolute inset-0" />
          <PaperPlane
            size={110}
            className="absolute right-[8%] top-[18%] text-white/20 animate-float-plane"
          />
          <div className="relative mx-auto max-w-3xl px-6 py-14">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs backdrop-blur">
              <CodeBraces className="text-white/80" /> 專案報價與規格確認
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{quote.clientName}</h1>
            <p className="mt-2 text-white/85">
              由 {quote.companyName} 為您規劃
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={15} /> 報價日期：{quote.quoteDate}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={15} /> {quote.validPeriod}
              </span>
            </div>
          </div>
        </header>

        {/* 動作列 */}
        <div className="sticky top-0 z-20 border-b border-paper-border bg-paper-bg/85 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-6 py-3">
            <button onClick={print} className="btn-primary">
              <Printer size={16} /> 匯出正式報價單
            </button>
            <button onClick={() => downloadCsv(quote)} className="btn-ghost">
              <FileDown size={16} /> 下載 CSV
            </button>
            <button
              onClick={() => setExcelPreview((v) => !v)}
              className="btn-ghost"
            >
              {excelPreview ? <Eye size={16} /> : <Table2 size={16} />}
              {excelPreview ? "回到品牌版" : "預覽 Excel 版"}
            </button>
          </div>
        </div>

        {excelPreview && (
          <div className="mx-auto max-w-3xl px-6 pt-6">
            <p className="rounded-lg border border-paper-border bg-paper-block px-4 py-3 text-sm text-paper-muted">
              以下為列印 / PDF 匯出的正式報價單預覽（Excel 嚴謹排版）。實際列印時將自動隱藏上方按鈕與品牌 Banner。
            </p>
          </div>
        )}

        <main
          className={`mx-auto max-w-3xl space-y-6 px-6 py-8 ${
            excelPreview ? "hidden" : ""
          }`}
        >
          {/* 已確認狀態橫幅 */}
          {acceptedAt && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
              <BadgeCheck size={22} className="shrink-0" />
              <div className="text-sm">
                <div className="font-semibold">此報價已確認</div>
                <div className="text-emerald-700">
                  由 {acceptedBy} 於 {fmtDateTime(acceptedAt)} 線上確認接受
                </div>
              </div>
            </div>
          )}

          {/* 專案需求 */}
          {(quote.projectBrief.serviceDescription ||
            quote.projectBrief.siteStyle ||
            quote.projectBrief.sitePages) && (
            <section className="notion-block">
              <h2 className="section-title mb-4">
                <ClipboardList size={18} className="text-brand-500" /> 專案需求
              </h2>
              <div className="space-y-4">
                {quote.projectBrief.serviceDescription && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-paper-muted">
                      服務說明
                    </div>
                    <p className="whitespace-pre-line text-sm text-paper-text">
                      {quote.projectBrief.serviceDescription}
                    </p>
                  </div>
                )}
                {quote.projectBrief.siteStyle && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-paper-muted">
                      網站風格
                    </div>
                    <p className="whitespace-pre-line text-sm text-paper-text">
                      {quote.projectBrief.siteStyle}
                    </p>
                  </div>
                )}
                {quote.projectBrief.sitePages && (
                  <div>
                    <div className="mb-1 text-xs font-medium text-paper-muted">
                      網站頁面
                    </div>
                    <p className="whitespace-pre-line rounded-lg bg-paper-block px-4 py-3 text-sm text-paper-text">
                      {quote.projectBrief.sitePages}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 規格明細 */}
          <section className="notion-block">
            <h2 className="section-title mb-4">
              <ListChecks size={18} className="text-brand-500" /> 規格明細
            </h2>
            <div className="space-y-3">
              {quote.items.map((it, i) => (
                <div
                  key={i}
                  className="notion-callout flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-paper-text">
                      {it.category || "—"}
                    </div>
                    {it.description && (
                      <p className="mt-1 whitespace-pre-line text-sm text-paper-muted">
                        {it.description}
                      </p>
                    )}
                    {it.duration && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs text-paper-muted ring-1 ring-paper-border">
                        <Clock size={12} /> 工時 {it.duration}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right font-semibold text-paper-text sm:min-w-[120px]">
                    {formatNT(it.amount)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-lg bg-brand-gradient px-5 py-4 text-white">
              <span className="text-sm font-medium">合計</span>
              <span className="text-2xl font-bold">{formatNT(total)}</span>
            </div>

            {quote.summaryText && (
              <p className="mt-4 whitespace-pre-line rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {quote.summaryText}
              </p>
            )}
          </section>

          {/* 付款資訊 */}
          {quote.paymentInfo && (
            <section className="notion-block">
              <h2 className="section-title mb-3">
                <Wallet size={18} className="text-brand-500" /> 付款資訊
              </h2>
              <div className="notion-callout whitespace-pre-line font-mono text-sm text-paper-text">
                {quote.paymentInfo}
              </div>
            </section>
          )}

          {/* 流程說明 */}
          {quote.processSteps.length > 0 && (
            <section className="notion-block">
              <h2 className="section-title mb-4">
                <ListChecks size={18} className="text-brand-500" /> 交付流程
              </h2>
              <ol className="space-y-4">
                {quote.processSteps.map((s, i) => (
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
                          {s.links.map((l, li) =>
                            l.url ? (
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
                            ) : (
                              <span
                                key={li}
                                className="inline-flex items-center gap-1 rounded-md border border-dashed border-paper-border px-2.5 py-1 text-xs text-paper-muted"
                              >
                                {l.label || "連結"}（待補）
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 維護說明 */}
          {quote.maintenanceRules.length > 0 && (
            <section className="notion-block">
              <h2 className="section-title mb-4">
                <Wrench size={18} className="text-brand-500" /> 後續維護級距
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {quote.maintenanceRules.map((r, i) => (
                  <div key={i} className="notion-callout">
                    <div className="font-semibold text-paper-text">{r.level}</div>
                    <div className="mt-1 text-sm font-medium text-brand-600">
                      {r.amount}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-paper-muted">
                      {r.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 補充說明 */}
          {quote.supplementaryNotes.length > 0 && (
            <section className="notion-block">
              <h2 className="section-title mb-3">
                <Info size={18} className="text-brand-500" /> 補充說明
              </h2>
              <ul className="space-y-2">
                {quote.supplementaryNotes.map((s, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-paper-text"
                  >
                    <span className="text-brand-500">•</span>
                    <span className="whitespace-pre-line">{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 線上確認 (規格確認流程) */}
          {!acceptedAt && (
            <section className="notion-block border-brand-200 bg-brand-50/60">
              <h2 className="section-title mb-2">
                <BadgeCheck size={18} className="text-brand-500" /> 確認此報價
              </h2>
              <p className="mb-4 text-sm text-paper-muted">
                若以上規格與費用皆無誤，請填寫您的姓名並點擊確認，我們將依此展開專案。
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="field-input sm:max-w-xs"
                  placeholder="您的姓名 / 公司名稱"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  onClick={confirmAccept}
                  className="btn-primary"
                  disabled={accepting || !name.trim()}
                >
                  {accepting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <BadgeCheck size={16} />
                  )}
                  確認並接受此報價
                </button>
              </div>
            </section>
          )}

          <footer className="pt-4 text-center text-xs text-paper-muted">
            {quote.companyName} · 統一編號 {quote.taxId} ·{" "}
            <CodeBraces className="text-brand-400" /> Siddblue Studio
          </footer>
        </main>
      </div>

      {/* ══════════════ 列印 / PDF：企業級 Excel 嚴謹報價單 ══════════════ */}
      <PrintSheet
        quote={quote}
        total={total}
        acceptedAt={acceptedAt}
        acceptedBy={acceptedBy}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  正式報價單 (Excel 方格排版) — 螢幕隱藏，列印 / 預覽時顯示
// ─────────────────────────────────────────────────────────────
function PrintSheet({
  quote,
  total,
  acceptedAt,
  acceptedBy,
}: {
  quote: Quote;
  total: number;
  acceptedAt?: string;
  acceptedBy?: string;
}) {
  return (
    <div className="print-sheet mx-auto max-w-[820px] bg-white p-8 text-black">
      {/* 抬頭 */}
      <div className="avoid-break mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">{quote.companyName}</h1>
          <div className="mt-1 text-xs">統一編號：{quote.taxId}</div>
        </div>
        <div className="text-right">
          <div className="inline-block border border-black px-6 py-2 text-xl font-bold tracking-[0.3em]">
            報　價　單
          </div>
          <div className="mt-1 text-xs">單號：{quote.id}</div>
        </div>
      </div>

      {/* 基本資料格 */}
      <table className="excel-table avoid-break mb-3">
        <tbody>
          <tr>
            <th className="w-28">專案 / 客戶</th>
            <td>{quote.clientName}</td>
            <th className="w-24">報價日期</th>
            <td className="w-32">{quote.quoteDate}</td>
          </tr>
          <tr>
            <th>有效期限</th>
            <td colSpan={3}>{quote.validPeriod}</td>
          </tr>
        </tbody>
      </table>

      {/* 專案需求 */}
      {(quote.projectBrief.serviceDescription ||
        quote.projectBrief.siteStyle ||
        quote.projectBrief.sitePages) && (
        <table className="excel-table avoid-break mb-3">
          <tbody>
            {quote.projectBrief.serviceDescription && (
              <tr>
                <th className="w-24">服務說明</th>
                <td colSpan={3} style={{ whiteSpace: "pre-line" }}>
                  {quote.projectBrief.serviceDescription}
                </td>
              </tr>
            )}
            {quote.projectBrief.siteStyle && (
              <tr>
                <th>網站風格</th>
                <td colSpan={3} style={{ whiteSpace: "pre-line" }}>
                  {quote.projectBrief.siteStyle}
                </td>
              </tr>
            )}
            {quote.projectBrief.sitePages && (
              <tr>
                <th>網站頁面</th>
                <td colSpan={3} style={{ whiteSpace: "pre-line" }}>
                  {quote.projectBrief.sitePages}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* 明細方格表 */}
      <table className="excel-table avoid-break">
        <thead>
          <tr>
            <th className="w-8">項次</th>
            <th className="w-36">功能名稱</th>
            <th>功能說明</th>
            <th className="w-20">工時</th>
            <th className="w-28">費用 (NT$)</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((it, i) => (
            <tr key={i}>
              <td className="center">{i + 1}</td>
              <td>{it.category}</td>
              <td style={{ whiteSpace: "pre-line" }}>{it.description}</td>
              <td className="center">{it.duration}</td>
              <td className="num">{formatCurrency(it.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className="center" colSpan={4} style={{ fontWeight: 700 }}>
              合計 (NT$)
            </td>
            <td className="num" style={{ fontWeight: 700 }}>
              {formatCurrency(total)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 備註 / 付款 */}
      {(quote.summaryText || quote.paymentInfo) && (
        <table className="excel-table avoid-break mt-3">
          <tbody>
            {quote.summaryText && (
              <tr>
                <th className="w-24">款項備註</th>
                <td style={{ whiteSpace: "pre-line" }}>{quote.summaryText}</td>
              </tr>
            )}
            {quote.paymentInfo && (
              <tr>
                <th>付款資訊</th>
                <td style={{ whiteSpace: "pre-line" }}>{quote.paymentInfo}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* 維護級距 */}
      {quote.maintenanceRules.length > 0 && (
        <table className="excel-table avoid-break mt-3">
          <thead>
            <tr>
              <th className="w-24">維護級距</th>
              <th>說明</th>
              <th className="w-40">費用</th>
            </tr>
          </thead>
          <tbody>
            {quote.maintenanceRules.map((r, i) => (
              <tr key={i}>
                <td className="center">{r.level}</td>
                <td>{r.description}</td>
                <td>{r.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 流程 / 補充說明 */}
      {(quote.processSteps.length > 0 ||
        quote.supplementaryNotes.length > 0) && (
        <table className="excel-table avoid-break mt-3">
          <tbody>
            {quote.processSteps.length > 0 && (
              <tr>
                <th className="w-24">交付流程</th>
                <td>
                  <ol style={{ margin: 0, paddingLeft: "1.2em" }}>
                    {quote.processSteps.map((s, i) => (
                      <li key={i} style={{ marginBottom: 2 }}>
                        {s.title && (
                          <span style={{ fontWeight: 700 }}>{s.title}</span>
                        )}
                        {s.title && s.description ? "：" : ""}
                        <span style={{ whiteSpace: "pre-line" }}>
                          {s.description}
                        </span>
                        {s.links
                          .filter((l) => l.url)
                          .map((l, li) => (
                            <span key={li}>
                              {" "}
                              [{l.label || "連結"}：{l.url}]
                            </span>
                          ))}
                      </li>
                    ))}
                  </ol>
                </td>
              </tr>
            )}
            {quote.supplementaryNotes.length > 0 && (
              <tr>
                <th>補充說明</th>
                <td>
                  <ol style={{ margin: 0, paddingLeft: "1.2em" }}>
                    {quote.supplementaryNotes.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* 簽署 / 電子大小章 */}
      <table className="excel-table avoid-break mt-3">
        <tbody>
          <tr>
            <th className="w-28" style={{ height: 120, verticalAlign: "middle" }}>
              廠商用印
            </th>
            <td style={{ position: "relative", height: 120 }}>
              {/* 電子大小章：圖檔放置於 /public/assets/stamp.jpg */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/stamp.jpg"
                alt="公司大小章"
                onError={(e) => {
                  // 圖檔尚未放置時，隱藏破圖並顯示提示邊框
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const hint = el.nextElementSibling as HTMLElement | null;
                  if (hint) hint.style.display = "flex";
                }}
                style={{
                  position: "absolute",
                  right: 24,
                  top: "50%",
                  transform: "translateY(-50%)",
                  maxHeight: 100,
                  maxWidth: 220,
                  objectFit: "contain",
                }}
              />
              <span
                style={{
                  display: "none",
                  position: "absolute",
                  right: 24,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: 88,
                  width: 88,
                  border: "1px dashed #888",
                  borderRadius: 4,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: "#888",
                  textAlign: "center",
                }}
              >
                用印處
              </span>
            </td>
            <th className="w-28">客戶簽章</th>
            <td style={{ width: 180, verticalAlign: "middle" }}>
              {acceptedAt && (
                <div style={{ fontSize: 10, lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700 }}>{acceptedBy}</div>
                  <div>已於線上確認</div>
                  <div>{fmtDateTime(acceptedAt)}</div>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="avoid-break mt-4 text-center text-[10px] text-black">
        {quote.companyName}　統一編號 {quote.taxId}　本報價單經雙方確認後生效
      </div>
    </div>
  );
}
