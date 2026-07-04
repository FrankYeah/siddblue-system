import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────
//  Linkify — 純文字中的 http(s) 網址自動轉為可點擊連結
//
//  用於「純文字 + 保留換行」的呈現情境（如靈感卡片預覽），
//  不解析其他 Markdown。以 React 元素輸出（非 innerHTML），
//  文字部分原樣保留，天生免疫 XSS。
//  連結一律另開新分頁（target="_blank" rel="noopener noreferrer"），
//  並以 stopPropagation 避免觸發外層卡片的 onClick（開編輯 Modal）。
// ─────────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s<>"'）】」』〕]+/g;

/** 網址結尾的中英文標點不視為網址的一部分 */
function trimTrailingPunct(url: string): string {
  return url.replace(/[)\]}.,;:!?、。，！？…]+$/, "");
}

export default function Linkify({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const m of Array.from(text.matchAll(URL_RE))) {
    const start = m.index ?? 0;
    const url = trimTrailingPunct(m[0]);
    if (!url) continue;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <a
        key={`${start}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="break-all text-brand-600 underline decoration-brand-300 underline-offset-2 transition hover:text-brand-700 hover:decoration-brand-500"
      >
        {url}
      </a>,
    );
    cursor = start + url.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
