import type { Quote } from "./types";
import { computeTotals } from "./format";

// ─────────────────────────────────────────────────────────────
//  CSV 匯出工具 (前端使用)
//  加上 UTF-8 BOM，確保 Excel 開啟中文不亂碼
// ─────────────────────────────────────────────────────────────

/** 將單一欄位跳脫為合法 CSV 值 */
function esc(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 產生報價單 CSV 字串 */
export function quoteToCsv(quote: Quote): string {
  const rows: string[][] = [];

  rows.push([quote.companyName]);
  rows.push([`統一編號：${quote.taxId}`]);
  rows.push([`專案 / 客戶：${quote.clientName}`]);
  rows.push([`報價日期：${quote.quoteDate}`, `有效期限：${quote.validPeriod}`]);
  rows.push([]);

  // 明細表頭
  rows.push(["功能名稱", "功能說明", "工時", "費用 (NT$)"]);
  quote.items.forEach((it) => {
    rows.push([
      it.category,
      it.description,
      it.duration,
      String(Number(it.amount) || 0),
    ]);
  });

  rows.push([]);
  const { subtotal, tax, grandTotal } = computeTotals(
    quote.items,
    quote.taxInclusive,
  );
  if (quote.taxInclusive) {
    rows.push(["", "", "未稅金額 (NT$)", String(subtotal)]);
    rows.push(["", "", "營業稅 5% (NT$)", String(tax)]);
    rows.push(["", "", "含稅總計 (NT$)", String(grandTotal)]);
  } else {
    rows.push(["", "", "合計 (NT$)", String(subtotal)]);
  }
  rows.push([]);

  if (quote.summaryText) {
    rows.push(["備註", quote.summaryText]);
  }
  if (quote.paymentInfo) {
    rows.push(["付款資訊", quote.paymentInfo.replace(/\n/g, " / ")]);
  }

  const body = rows
    .map((cols) => cols.map(esc).join(","))
    .join("\r\n");

  // UTF-8 BOM，避免 Excel 中文亂碼
  return "﻿" + body;
}

/** 觸發瀏覽器下載 CSV */
export function downloadCsv(quote: Quote): void {
  const csv = quoteToCsv(quote);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (quote.clientName || "quote").replace(/[\\/:*?"<>|]/g, "_");
  link.href = url;
  link.download = `報價單_${safeName}_${quote.quoteDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
