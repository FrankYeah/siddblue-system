// ─────────────────────────────────────────────────────────────
//  極簡、安全的 Markdown → HTML 轉換器 (白名單式)
//
//  設計原則：先「逐段落 / 逐行」做區塊解析，再對每段文字內容
//  先 HTML escape、後套用行內語法 (粗體 / 斜體 / 行內碼 / 連結)。
//  因為所有使用者輸入都先被 escape，且連結 URL 會通過 scheme 白名單，
//  產出的 HTML 可安全地以 dangerouslySetInnerHTML 呈現，不會有 XSS。
//
//  支援語法：# ~ ###### 標題、--- 分隔線、> 引言、- / * / 1. 清單、
//           ``` 程式碼區塊、`行內碼`、**粗體**、*斜體* / _斜體_、[文字](網址)
// ─────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 僅允許安全的連結 scheme；不合法則回傳 null (改以純文字呈現) */
function sanitizeUrl(url: string): string | null {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (u.startsWith("/") || u.startsWith("#")) return u;
  return null;
}

/** 裸網址結尾的標點（中英文）與跳脫後的引號不視為網址的一部分 */
function trimBareUrl(url: string): string {
  let clean = url;
  for (;;) {
    const next = clean
      .replace(/(&quot;|&gt;|&lt;|&amp;)+$/, "")
      .replace(/[)\]}.,;:!?、。，！？…]+$/, "");
    if (next === clean) return clean;
    clean = next;
  }
}

/** 對「已 escape、且不含行內碼」的片段套用圖片 / 連結 / 粗體 / 斜體 */
function applyEmphasis(text: string): string {
  let out = text;

  // 圖片 ![替代文字](網址)、連結 [文字](網址) 與裸網址 (http/https) 以同一個
  // regex 一次處理，避免多段替換互相干擾（圖片需先於連結比對，否則開頭的 !
  // 會被忽略、誤判為一般連結）
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+)/g,
    (
      match,
      imgAlt: string | undefined,
      imgUrl: string | undefined,
      label: string | undefined,
      url: string | undefined,
      bare: string | undefined,
    ) => {
      if (imgUrl !== undefined) {
        const safe = sanitizeUrl(imgUrl);
        return safe
          ? `<img src="${safe}" alt="${imgAlt ?? ""}" loading="lazy">`
          : match;
      }
      if (bare !== undefined) {
        const clean = trimBareUrl(bare);
        const rest = bare.slice(clean.length);
        const safe = clean ? sanitizeUrl(clean) : null;
        return safe
          ? `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">${clean}</a>${rest}`
          : match;
      }
      const safe = sanitizeUrl(url ?? "");
      return safe
        ? `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`
        : (label ?? match);
    },
  );

  // 粗體 → 斜體
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(
    /(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g,
    "<em>$1</em>",
  );

  return out;
}

/** 行內語法：輸入為「尚未 escape」的原始片段 */
function inline(raw: string): string {
  const escaped = escapeHtml(raw);
  // 以行內碼為界切段：split 帶捕獲群組時，奇數索引即為 `...` 內的程式碼內容，
  // 程式碼段落原樣輸出 (不再套用其他語法)，其餘段落才套用連結 / 粗體 / 斜體。
  const parts = escaped.split(/`([^`]+)`/g);
  let result = "";
  for (let idx = 0; idx < parts.length; idx++) {
    result +=
      idx % 2 === 1
        ? `<code>${parts[idx]}</code>`
        : applyEmphasis(parts[idx]);
  }
  return result;
}

/** 將 Markdown 轉為安全的 HTML 字串 */
export function renderMarkdown(md: string): string {
  const lines = (md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br>")}</p>`);
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 程式碼區塊 ```
    if (/^\s*```/.test(line)) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 略過收尾的 ```
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // 空行 → 段落分界
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }

    // 分隔線 ---
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      out.push("<hr>");
      i++;
      continue;
    }

    // 標題 # ~ ######
    const h = /^\s*(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // 引言 >
    if (/^\s*>\s?/.test(line)) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${buf.map(inline).join("<br>")}</blockquote>`);
      continue;
    }

    // 無序清單 - / * / +
    if (/^\s*[-*+]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push(
        `<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    // 有序清單 1.
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        `<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    // 一般段落文字
    para.push(line);
    i++;
  }
  flushPara();

  return out.join("\n");
}
