"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  Copy,
  Check,
  FileText,
  ArrowLeft,
  Save,
  Share2,
  ExternalLink,
  X,
} from "lucide-react";
import type { Note, NoteType } from "@/lib/types";

// 「載入諮詢模板」填入的 Markdown 結構
const CONSULTING_TEMPLATE = `## 諮詢提問
- 你今天來找我諮詢的最大原因是什麼？
- 目前有哪些選項可以走？你怎麼選？
- 嘗試的情況為何？痛點/進步的地方是什麼？
- 下一步行動：

---
## 諮詢紀錄
- 服務特色：
- 客戶輪廓：
- 方案/報價：`;

type Draft = {
  title: string;
  content: string;
  tags: string[];
  type: NoteType;
  isShared: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  content: "",
  tags: [],
  type: "general",
  isShared: false,
};

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 以 UTC+8 (台北) 手動格式化，只用 getUTC*，不經 Intl；
  // 確保 SSR (伺服器多為 UTC) 與客戶端輸出「逐字元一致」，避免 hydration mismatch。
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(
    t.getUTCHours(),
  )}:${p(t.getUTCMinutes())}`;
}

export default function NotesBoard({
  initialNotes,
}: {
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const shareLink = selected
    ? `${origin}/shared/note/${selected.shareToken}`
    : "";

  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, query, activeTag]);

  const dirty = selected
    ? draft.title !== selected.title ||
      draft.content !== selected.content ||
      draft.type !== selected.type ||
      draft.isShared !== selected.isShared ||
      draft.tags.join("") !== selected.tags.join("")
    : false;

  function selectNote(n: Note) {
    setSelectedId(n.id);
    setDraft({
      title: n.title,
      content: n.content,
      tags: [...n.tags],
      type: n.type,
      isShared: n.isShared,
    });
    setTagInput("");
  }

  async function newNote() {
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(EMPTY_DRAFT),
      });
      if (!res.ok) throw new Error();
      const { note } = (await res.json()) as { note: Note };
      setNotes((ns) => [note, ...ns]);
      selectNote(note);
    } catch {
      flash("建立失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  // patch 可覆寫 draft（供分享開關立即存檔使用）
  async function persist(patch?: Partial<Draft>) {
    if (!selectedId) return;
    const payload = { ...draft, ...patch };
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const { note } = (await res.json()) as { note: Note };
      setNotes((ns) => ns.map((n) => (n.id === note.id ? note : n)));
      setDraft({
        title: note.title,
        content: note.content,
        tags: [...note.tags],
        type: note.type,
        isShared: note.isShared,
      });
      flash("已儲存");
    } catch {
      flash("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("確定刪除這則筆記？此動作無法復原。")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotes((ns) => ns.filter((n) => n.id !== id));
      if (selectedId === id) setSelectedId(null);
      flash("已刪除");
    } catch {
      flash("刪除失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  function toggleShare() {
    const next = !draft.isShared;
    setDraft((d) => ({ ...d, isShared: next }));
    persist({ isShared: next }); // 立即存檔，確保連結即時可用
  }

  function loadTemplate() {
    if (draft.content.trim() !== "") {
      flash("內容已有文字，未載入模板");
      return;
    }
    setDraft((d) => ({ ...d, content: CONSULTING_TEMPLATE, type: "consulting" }));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    setTagInput("");
    if (draft.tags.includes(t)) return;
    setDraft((d) => ({ ...d, tags: [...d.tags, t] }));
  }

  function removeTag(t: string) {
    setDraft((d) => ({ ...d, tags: d.tags.filter((x) => x !== t) }));
  }

  function copyLink() {
    if (!shareLink) return;
    navigator.clipboard?.writeText(shareLink).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => flash("複製失敗，請手動複製"),
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">📚 知識庫</h2>
          <p className="text-sm text-paper-muted">
            創業筆記、合夥人知識共享與客戶諮詢紀錄，可對外產生唯讀分享連結。
          </p>
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" /> 儲存中
          </span>
        )}
      </div>

      <div className="md:grid md:grid-cols-[300px_minmax(0,1fr)] md:gap-5">
        {/* ───────── 左側：筆記列表 ───────── */}
        <aside className={selectedId ? "hidden md:block" : "block"}>
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-paper-muted"
              />
              <input
                className="field-input pl-8"
                placeholder="搜尋標題 / 內容 / 標籤…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              onClick={newNote}
              className="btn-primary shrink-0 px-3"
              title="新增筆記"
            >
              <Plus size={18} />
            </button>
          </div>

          {allTags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setActiveTag((a) => (a === tag ? null : tag))
                  }
                  className={`rounded-full px-2.5 py-0.5 text-xs transition ${
                    activeTag === tag
                      ? "bg-brand-600 text-white"
                      : "bg-paper-block text-paper-muted hover:bg-paper-border"
                  }`}
                >
                  # {tag}
                </button>
              ))}
            </div>
          )}

          <ul className="space-y-2">
            {filtered.length === 0 && (
              <li className="rounded-lg border border-dashed border-paper-border px-3 py-8 text-center text-sm text-paper-muted">
                {notes.length === 0 ? "還沒有筆記，按 ＋ 新增第一則。" : "沒有符合的筆記。"}
              </li>
            )}
            {filtered.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => selectNote(n)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedId === n.id
                      ? "border-brand-300 bg-brand-50"
                      : "border-paper-border bg-white hover:border-brand-200 hover:bg-paper-block/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-paper-text">
                      {n.title || "（未命名筆記）"}
                    </span>
                    {n.isShared && (
                      <Share2
                        size={13}
                        className="shrink-0 text-brand-500"
                        aria-label="已開啟分享"
                      />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-paper-muted">
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        n.type === "consulting"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-paper-block text-paper-muted"
                      }`}
                    >
                      {n.type === "consulting" ? "諮詢" : "筆記"}
                    </span>
                    <span>{fmt(n.updatedAt)}</span>
                  </div>
                  {n.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {n.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-paper-block px-1.5 py-0.5 text-[10px] text-paper-muted"
                        >
                          # {t}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* ───────── 右側：編輯區 ───────── */}
        <section className={selectedId ? "block" : "hidden md:block"}>
          {selected ? (
            <div className="rounded-xl border border-paper-border bg-white p-4 sm:p-5">
              <button
                onClick={() => setSelectedId(null)}
                className="mb-3 inline-flex items-center gap-1 text-sm text-paper-muted md:hidden"
              >
                <ArrowLeft size={16} /> 返回列表
              </button>

              <input
                className="field-input mb-3 text-base font-medium"
                placeholder="筆記標題"
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
              />

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-paper-border p-0.5">
                  {(["general", "consulting"] as NoteType[]).map((tp) => (
                    <button
                      key={tp}
                      onClick={() => setDraft((d) => ({ ...d, type: tp }))}
                      className={`rounded-md px-3 py-1 text-sm transition ${
                        draft.type === tp
                          ? "bg-brand-600 text-white"
                          : "text-paper-muted hover:text-paper-text"
                      }`}
                    >
                      {tp === "consulting" ? "諮詢紀錄" : "一般筆記"}
                    </button>
                  ))}
                </div>
                <button onClick={loadTemplate} className="btn-ghost text-sm">
                  <FileText size={15} /> 載入諮詢模板
                </button>
              </div>

              <label className="field-label">內容（支援 Markdown）</label>
              <textarea
                className="field-input min-h-[300px] resize-y font-mono text-sm leading-relaxed"
                placeholder="以 Markdown 撰寫內容，例如 ## 標題、- 清單、**粗體**…"
                value={draft.content}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, content: e.target.value }))
                }
              />

              <div className="mt-4">
                <label className="field-label">標籤</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {draft.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
                    >
                      # {t}
                      <button
                        onClick={() => removeTag(t)}
                        className="text-brand-400 transition hover:text-red-600"
                        title="移除標籤"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    className="min-w-[140px] flex-1 rounded-md border border-paper-border px-2 py-1 text-sm outline-none transition focus:border-brand-500"
                    placeholder="輸入標籤後按 Enter"
                  />
                </div>
              </div>

              {/* 分享設定 */}
              <div className="mt-4 rounded-lg border border-paper-border bg-paper-block/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-paper-text">
                      對外分享
                    </div>
                    <div className="text-xs text-paper-muted">
                      開啟後，持有連結者即可唯讀檢視此筆記。
                    </div>
                  </div>
                  <button
                    onClick={toggleShare}
                    role="switch"
                    aria-checked={draft.isShared}
                    aria-label="開啟對外分享"
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      draft.isShared ? "bg-brand-600" : "bg-paper-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        draft.isShared ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                {draft.isShared && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={shareLink}
                      onFocus={(e) => e.currentTarget.select()}
                      className="field-input min-w-0 flex-1 text-xs"
                    />
                    <button
                      onClick={copyLink}
                      className="btn-ghost shrink-0 px-3"
                      title="複製連結"
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                    <a
                      href={shareLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost shrink-0 px-3"
                      title="開啟分享頁"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={() => remove(selected.id)}
                  className="btn-danger"
                >
                  <Trash2 size={16} /> 刪除
                </button>
                <button
                  onClick={() => persist()}
                  disabled={!dirty || saving}
                  className="btn-primary"
                >
                  <Save size={16} /> {dirty ? "儲存" : "已儲存"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-paper-border text-center">
              <FileText size={32} className="mb-3 text-paper-border" />
              <p className="text-sm text-paper-muted">
                從左側選擇一則筆記，或按 ＋ 新增。
              </p>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float sm:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
