"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  Copy,
  Check,
  Eye,
  FileText,
  ArrowLeft,
  Pencil,
  Save,
  Share2,
  ExternalLink,
  X,
  ImagePlus,
  ChevronUp,
  ChevronDown,
  Link as LinkIcon,
  Folder,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { renderMarkdown } from "@/lib/markdown";
import { fmtDateTimeTW as fmt } from "@/lib/format";
import type { Note, NoteType, ProcessStep } from "@/lib/types";
import { adminFetch } from "@/lib/api-client";
import { useSyncOnFocus } from "./hooks";

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
  steps: ProcessStep[];
};

/**
 * 標籤瀏覽器的篩選狀態（仿 iPhone 備忘錄：標籤＝虛擬分類）。
 * 用 kind 分辨而非以字串當哨兵值，避免真實標籤剛好撞名。
 */
type TagFilter =
  | { kind: "all" }
  | { kind: "untagged" }
  | { kind: "tag"; tag: string };

const EMPTY_DRAFT: Draft = {
  title: "",
  content: "",
  tags: [],
  type: "general",
  isShared: false,
  steps: [],
};

/** 深拷貝流程步驟，避免編輯時意外改到 notes 陣列裡的原始物件 */
function cloneSteps(steps: ProcessStep[]): ProcessStep[] {
  return steps.map((s) => ({ ...s, links: s.links.map((l) => ({ ...l })) }));
}


export default function NotesBoard({
  initialNotes,
  searchQuery = "",
}: {
  initialNotes: Note[];
  /** 全域搜尋框（AdminWorkspace）傳入的關鍵字，與列表內搜尋 / Tag 篩選以 AND 疊加 */
  searchQuery?: string;
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<TagFilter>({ kind: "all" });
  // 手機版三欄側欄導覽（資料夾 → 筆記列表 → 內容），桌機版三欄同時顯示、不受此狀態影響
  const [mobileStep, setMobileStep] = useState<"folders" | "list" | "editor">(
    "folders",
  );
  const [tagInput, setTagInput] = useState("");
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false); // 內容：編輯 ↔ 預覽（網址可點擊）
  const [origin, setOrigin] = useState("");
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 最後一次寫入的時間戳：focus 重新同步時避免過期回應蓋掉剛寫入的內容
  const lastMutationAt = useRef(0);

  useEffect(() => setOrigin(window.location.origin), []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  // 上傳圖片至 Vercel Blob，插入游標位置（textarea 未取得焦點時改為插在結尾）
  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await adminFetch("/api/notes/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "上傳失敗");

      const markdown = `![${file.name.replace(/\.[^.]+$/, "")}](${data.url})`;
      const el = contentRef.current;
      const cur = draft.content;
      if (el && el.selectionStart != null) {
        const start = el.selectionStart;
        const end = el.selectionEnd ?? start;
        const next = cur.slice(0, start) + markdown + cur.slice(end);
        setDraft((d) => ({ ...d, content: next }));
        // 插入後把游標移到新插入內容之後，方便繼續輸入
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + markdown.length;
          el.setSelectionRange(pos, pos);
        });
      } else {
        setDraft((d) => ({
          ...d,
          content: d.content ? `${d.content}\n${markdown}` : markdown,
        }));
      }
      flash("圖片已上傳並插入內容");
    } catch (err) {
      flash(err instanceof Error ? err.message : "上傳失敗，請稍後再試");
    } finally {
      setUploading(false);
    }
  }

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const shareLink = selected
    ? `${origin}/shared/note/${selected.shareToken}`
    : "";

  // 標籤瀏覽器：依使用次數排序（同次數依字母排序），量變多時常用標籤永遠在前面
  const sortedTags = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((n) => n.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"),
    );
  }, [notes]);

  const untaggedCount = useMemo(
    () => notes.filter((n) => n.tags.length === 0).length,
    [notes],
  );

  // 標籤下拉選單：從所有筆記已用過的標籤挑選，排除目前筆記已加的，並隨輸入文字即時篩選
  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    return sortedTags
      .map(([t]) => t)
      .filter((t) => !draft.tags.includes(t))
      .filter((t) => !q || t.toLowerCase().includes(q));
  }, [sortedTags, draft.tags, tagInput]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const gq = searchQuery.trim().toLowerCase(); // 全域搜尋框關鍵字
    const matches = (n: Note, needle: string) =>
      n.title.toLowerCase().includes(needle) ||
      n.content.toLowerCase().includes(needle) ||
      n.tags.some((t) => t.toLowerCase().includes(needle));
    return notes.filter((n) => {
      if (tagFilter.kind === "tag" && !n.tags.includes(tagFilter.tag)) {
        return false;
      }
      if (tagFilter.kind === "untagged" && n.tags.length > 0) return false;
      if (gq && !matches(n, gq)) return false;
      if (q && !matches(n, q)) return false;
      return true;
    });
  }, [notes, query, tagFilter, searchQuery]);

  const dirty = selected
    ? draft.title !== selected.title ||
      draft.content !== selected.content ||
      draft.type !== selected.type ||
      draft.isShared !== selected.isShared ||
      draft.tags.join("") !== selected.tags.join("") ||
      JSON.stringify(draft.steps) !== JSON.stringify(selected.steps)
    : false;

  // 切回分頁時重新同步（跨裝置編輯 / Router Cache 過期資料）。
  // 儲存/上傳/改名中、或正在編輯且有未存變更時跳過；10 秒內剛寫入過也跳過。
  useSyncOnFocus(async () => {
    if (saving || uploading || renamingTag !== null) return;
    if (selected && dirty) return;
    if (Date.now() - lastMutationAt.current < 10_000) return;
    const requestedAt = Date.now();
    try {
      const res = await adminFetch("/api/notes?full=1");
      if (!res.ok) return;
      const { notes: fresh } = (await res.json()) as { notes: Note[] };
      // fetch 進行期間若又發生本地寫入，這份回應已是過期快照，不能套用
      if (lastMutationAt.current >= requestedAt) return;
      setNotes((cur) =>
        JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh,
      );
      // 正在檢視的筆記（無未存變更）也同步 draft——否則 dirty 會誤判成
      // 「有變更」，下一次儲存就把另一部裝置的編輯蓋回舊內容
      if (selectedId) {
        const freshSelected = fresh.find((n) => n.id === selectedId);
        if (!freshSelected) {
          // 筆記在別處被刪除：退回列表，避免編輯一筆已不存在的資料
          setSelectedId(null);
          setMobileStep("list");
        } else {
          setDraft({
            title: freshSelected.title,
            content: freshSelected.content,
            tags: [...freshSelected.tags],
            type: freshSelected.type,
            isShared: freshSelected.isShared,
            steps: cloneSteps(freshSelected.steps),
          });
        }
      }
    } catch {
      /* 同步失敗不打擾使用者，下次 focus 再試 */
    }
  });

  function selectNote(n: Note) {
    setSelectedId(n.id);
    setDraft({
      title: n.title,
      content: n.content,
      tags: [...n.tags],
      type: n.type,
      isShared: n.isShared,
      steps: cloneSteps(n.steps),
    });
    setTagInput("");
    setMobileStep("editor");
  }

  /** 側欄選擇資料夾（標籤）：套用篩選並在手機版切到筆記列表 */
  function chooseFolder(f: TagFilter) {
    setTagFilter(f);
    setMobileStep("list");
  }

  function startRenameTag(tag: string) {
    setRenamingTag(tag);
    setRenameValue(tag);
  }

  /** 全站重新命名標籤：套用到所有含此標籤的筆記，並同步目前的篩選條件與編輯中的 draft */
  async function commitRenameTag() {
    const from = renamingTag;
    const to = renameValue.trim();
    setRenamingTag(null);
    if (!from || !to || to === from) return;
    lastMutationAt.current = Date.now();
    setSaving(true);
    try {
      const res = await adminFetch("/api/notes/tags/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!res.ok) throw new Error();
      const { notes: changed } = (await res.json()) as { notes: Note[] };
      const changedMap = new Map(changed.map((n) => [n.id, n]));
      setNotes((ns) => ns.map((n) => changedMap.get(n.id) ?? n));
      // 正在編輯的筆記若剛好被改到，draft 也要同步，避免之後儲存時把新標籤覆寫回舊的
      if (selectedId && changedMap.has(selectedId)) {
        const n = changedMap.get(selectedId)!;
        setDraft((d) => ({ ...d, tags: [...n.tags] }));
      }
      // 若正在篩選這個標籤，篩選條件也要跟著換成新名字，避免畫面突然變回「全部筆記」
      if (tagFilter.kind === "tag" && tagFilter.tag === from) {
        setTagFilter({ kind: "tag", tag: to });
      }
      flash(`已將標籤「${from}」重新命名為「${to}」`);
    } catch {
      flash("重新命名失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function newNote() {
    lastMutationAt.current = Date.now();
    setSaving(true);
    try {
      const res = await adminFetch("/api/notes", {
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
    lastMutationAt.current = Date.now();
    const payload = { ...draft, ...patch };
    setSaving(true);
    try {
      const res = await adminFetch(`/api/notes/${selectedId}`, {
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
        steps: cloneSteps(note.steps),
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
    lastMutationAt.current = Date.now();
    setSaving(true);
    try {
      const res = await adminFetch(`/api/notes/${id}`, { method: "DELETE" });
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

  // ── 流程步驟 (ProcessStep[])：type === "process" 的知識用逐步驟記錄，
  //    如報稅步驟、諮詢提問流程、網站架設說明，同一組件仿報價單「流程說明」的操作方式 ──
  function addStep() {
    setDraft((d) => ({
      ...d,
      steps: [...d.steps, { title: "", description: "", links: [] }],
    }));
  }
  function updateStep(i: number, key: "title" | "description", value: string) {
    setDraft((d) => {
      const steps = [...d.steps];
      steps[i] = { ...steps[i], [key]: value };
      return { ...d, steps };
    });
  }
  function removeStep(i: number) {
    setDraft((d) => ({ ...d, steps: d.steps.filter((_, idx) => idx !== i) }));
  }
  function moveStep(i: number, dir: -1 | 1) {
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.steps.length) return d;
      const steps = [...d.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });
  }
  function addStepLink(stepIdx: number) {
    setDraft((d) => {
      const steps = [...d.steps];
      steps[stepIdx] = {
        ...steps[stepIdx],
        links: [...steps[stepIdx].links, { label: "", url: "" }],
      };
      return { ...d, steps };
    });
  }
  function updateStepLink(
    stepIdx: number,
    linkIdx: number,
    key: "label" | "url",
    value: string,
  ) {
    setDraft((d) => {
      const steps = [...d.steps];
      const links = [...steps[stepIdx].links];
      links[linkIdx] = { ...links[linkIdx], [key]: value };
      steps[stepIdx] = { ...steps[stepIdx], links };
      return { ...d, steps };
    });
  }
  function removeStepLink(stepIdx: number, linkIdx: number) {
    setDraft((d) => {
      const steps = [...d.steps];
      steps[stepIdx] = {
        ...steps[stepIdx],
        links: steps[stepIdx].links.filter((_, idx) => idx !== linkIdx),
      };
      return { ...d, steps };
    });
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    setTagInput("");
    if (draft.tags.includes(t)) return;
    setDraft((d) => ({ ...d, tags: [...d.tags, t] }));
  }

  /** 從下拉選單挑選既有標籤，避免手動輸入打錯字造成同義但不同字的標籤 */
  function selectExistingTag(t: string) {
    setTagInput("");
    setTagMenuOpen(false);
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

      <div className="md:grid md:grid-cols-[168px_264px_minmax(0,1fr)] md:gap-5">
        {/* ───────── 左側：資料夾側欄（標籤即虛擬資料夾，仿 macOS 備忘錄）─────────
            依使用次數排序，量變多時常用分類永遠在最前面；「未加標籤」避免漏標的筆記被淹沒找不到。 */}
        <aside className={mobileStep === "folders" ? "block" : "hidden md:block"}>
          <div className="space-y-0.5">
            <button
              onClick={() => chooseFolder({ kind: "all" })}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                tagFilter.kind === "all"
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-paper-text hover:bg-paper-block/60"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText size={15} className="shrink-0 text-paper-muted" />
                <span className="truncate">全部筆記</span>
              </span>
              <span className="shrink-0 text-xs text-paper-muted">
                {notes.length}
              </span>
            </button>
            {sortedTags.map(([tag, count]) => {
              const active = tagFilter.kind === "tag" && tagFilter.tag === tag;
              if (renamingTag === tag) {
                return (
                  <div
                    key={tag}
                    className="flex items-center gap-2 rounded-lg border border-brand-300 bg-white px-2.5 py-1.5"
                  >
                    <Folder size={15} className="shrink-0 text-paper-muted" />
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRenameTag();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setRenamingTag(null);
                        }
                      }}
                      onBlur={commitRenameTag}
                      className="min-w-0 flex-1 rounded border border-paper-border px-1.5 py-0.5 text-sm outline-none focus:border-brand-500"
                    />
                  </div>
                );
              }
              return (
                <div
                  key={tag}
                  className={`flex items-center rounded-lg transition ${
                    active ? "bg-brand-50" : "hover:bg-paper-block/60"
                  }`}
                >
                  <button
                    onClick={() =>
                      chooseFolder(active ? { kind: "all" } : { kind: "tag", tag })
                    }
                    className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm ${
                      active ? "font-medium text-brand-700" : "text-paper-text"
                    }`}
                  >
                    <Folder size={15} className="shrink-0 text-paper-muted" />
                    <span className="truncate">{tag}</span>
                  </button>
                  <button
                    onClick={() => startRenameTag(tag)}
                    className="shrink-0 rounded p-1 text-paper-muted/70 transition hover:text-brand-600"
                    title="重新命名標籤"
                  >
                    <Pencil size={12} />
                  </button>
                  <span className="shrink-0 pr-3 text-xs text-paper-muted">
                    {count}
                  </span>
                </div>
              );
            })}
            {untaggedCount > 0 && (
              <button
                onClick={() =>
                  chooseFolder(
                    tagFilter.kind === "untagged"
                      ? { kind: "all" }
                      : { kind: "untagged" },
                  )
                }
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  tagFilter.kind === "untagged"
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-paper-text hover:bg-paper-block/60"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Folder size={15} className="shrink-0 text-paper-muted" />
                  <span className="truncate">未加標籤</span>
                </span>
                <span className="shrink-0 text-xs text-paper-muted">
                  {untaggedCount}
                </span>
              </button>
            )}
          </div>
        </aside>

        {/* ───────── 中間：筆記列表 ───────── */}
        <aside className={mobileStep === "list" ? "block" : "hidden md:block"}>
          <button
            onClick={() => setMobileStep("folders")}
            className="mb-3 inline-flex items-center gap-1 text-sm text-paper-muted md:hidden"
          >
            <ArrowLeft size={16} /> 資料夾
          </button>
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
        <section className={mobileStep === "editor" ? "block" : "hidden md:block"}>
          {selected ? (
            <div className="rounded-xl border border-paper-border bg-white p-4 sm:p-5">
              <button
                onClick={() => {
                  setSelectedId(null);
                  setMobileStep("list");
                }}
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
                  {(["general", "consulting", "process"] as NoteType[]).map(
                    (tp) => (
                      <button
                        key={tp}
                        onClick={() => setDraft((d) => ({ ...d, type: tp }))}
                        className={`rounded-md px-3 py-1 text-sm transition ${
                          draft.type === tp
                            ? "bg-brand-600 text-white"
                            : "text-paper-muted hover:text-paper-text"
                        }`}
                      >
                        {tp === "consulting"
                          ? "諮詢紀錄"
                          : tp === "process"
                            ? "流程知識"
                            : "一般筆記"}
                      </button>
                    ),
                  )}
                </div>
                {draft.type === "consulting" && (
                  <button onClick={loadTemplate} className="btn-ghost text-sm">
                    <FileText size={15} /> 載入諮詢模板
                  </button>
                )}
              </div>

              {draft.type === "process" ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-paper-muted">
                      流程步驟
                    </span>
                  </div>
                  <div className="space-y-3">
                    {draft.steps.map((s, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-paper-border bg-paper-block/40 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <input
                              className="field-input font-medium"
                              placeholder="步驟名稱（如：準備扣繳憑單）"
                              value={s.title}
                              onChange={(e) =>
                                updateStep(i, "title", e.target.value)
                              }
                            />
                            <TextareaAutosize
                              minRows={3}
                              className="field-input resize-none"
                              placeholder="說明（可多行）"
                              value={s.description}
                              onChange={(e) =>
                                updateStep(i, "description", e.target.value)
                              }
                            />
                            {s.links.map((l, li) => (
                              <div key={li} className="flex gap-2">
                                <input
                                  className="field-input sm:max-w-[190px]"
                                  placeholder="連結文字（如：財政部網站）"
                                  value={l.label}
                                  onChange={(e) =>
                                    updateStepLink(
                                      i,
                                      li,
                                      "label",
                                      e.target.value,
                                    )
                                  }
                                />
                                <input
                                  className="field-input"
                                  placeholder="https://…（可事後再貼）"
                                  value={l.url}
                                  onChange={(e) =>
                                    updateStepLink(i, li, "url", e.target.value)
                                  }
                                />
                                <button
                                  onClick={() => removeStepLink(i, li)}
                                  className="btn-danger px-2"
                                  title="刪除連結"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addStepLink(i)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              <LinkIcon size={13} /> 新增連結
                            </button>
                          </div>
                          <div className="flex shrink-0 flex-col items-center gap-0.5">
                            <button
                              onClick={() => moveStep(i, -1)}
                              disabled={i === 0}
                              className="rounded p-0.5 text-paper-muted hover:text-brand-600 disabled:opacity-30"
                              title="上移"
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              onClick={() => moveStep(i, 1)}
                              disabled={i === draft.steps.length - 1}
                              className="rounded p-0.5 text-paper-muted hover:text-brand-600 disabled:opacity-30"
                              title="下移"
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              onClick={() => removeStep(i)}
                              className="rounded p-1 text-paper-muted hover:bg-red-50 hover:text-red-600"
                              title="刪除步驟"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {draft.steps.length === 0 && (
                      <p className="rounded-lg border border-dashed border-paper-border px-3 py-4 text-center text-sm text-paper-muted">
                        尚無步驟，按下方「新增步驟」開始記錄。
                      </p>
                    )}
                  </div>
                  <button onClick={addStep} className="btn-ghost mt-2">
                    <Plus size={16} /> 新增步驟
                  </button>
                </div>
              ) : (
                <>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-paper-muted">
                  內容（支援 Markdown）
                </span>
                <div className="flex items-center gap-1">
                  {!preview && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-paper-muted transition hover:bg-paper-block hover:text-brand-600 disabled:opacity-50"
                      title="上傳圖片，插入到游標位置"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> 上傳中
                        </>
                      ) : (
                        <>
                          <ImagePlus size={13} /> 上傳圖片
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = ""; // 允許連續選同一檔案也能觸發 onChange
                      if (file) uploadImage(file);
                    }}
                  />
                  <button
                    onClick={() => setPreview((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-paper-muted transition hover:bg-paper-block hover:text-brand-600"
                    title={preview ? "回到編輯" : "預覽（網址可點擊）"}
                  >
                    {preview ? (
                      <>
                        <Pencil size={13} /> 編輯
                      </>
                    ) : (
                      <>
                        <Eye size={13} /> 預覽
                      </>
                    )}
                  </button>
                </div>
              </div>
              {preview ? (
                <div className="min-h-[300px] rounded-lg border border-paper-border bg-paper-block/30 px-4 py-3">
                  {draft.content.trim() ? (
                    <div
                      className="md-content"
                      // renderMarkdown 為白名單轉換（先 escape、連結 scheme 白名單），可安全注入
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(draft.content),
                      }}
                    />
                  ) : (
                    <p className="text-sm text-paper-muted">（沒有內容）</p>
                  )}
                </div>
              ) : (
                <textarea
                  ref={contentRef}
                  className="field-input min-h-[300px] resize-y font-mono text-sm leading-relaxed"
                  placeholder="以 Markdown 撰寫內容，例如 ## 標題、- 清單、**粗體**…（也可直接貼上或拖入圖片）"
                  value={draft.content}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, content: e.target.value }))
                  }
                  onPaste={(e) => {
                    const file = Array.from(e.clipboardData.files).find((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (file) {
                      e.preventDefault();
                      uploadImage(file);
                    }
                  }}
                  onDrop={(e) => {
                    const file = Array.from(e.dataTransfer.files).find((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (file) {
                      e.preventDefault();
                      uploadImage(file);
                    }
                  }}
                />
              )}
                </>
              )}

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
                  <div className="relative min-w-[140px] flex-1">
                    <div className="flex items-center rounded-md border border-paper-border pr-1 transition focus-within:border-brand-500">
                      <input
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          setTagMenuOpen(true);
                        }}
                        onFocus={() => setTagMenuOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                            setTagMenuOpen(false);
                          }
                          if (e.key === "Escape") setTagMenuOpen(false);
                        }}
                        onBlur={() => {
                          addTag();
                          setTagMenuOpen(false);
                        }}
                        className="min-w-0 flex-1 rounded-md px-2 py-1 text-sm outline-none"
                        placeholder="輸入或選擇標籤"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setTagMenuOpen((v) => !v)}
                        className="shrink-0 rounded p-0.5 text-paper-muted transition hover:text-brand-600"
                        title="選擇既有標籤"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    {tagMenuOpen && (
                      <ul
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute left-0 top-full z-10 mt-1 max-h-48 w-full min-w-[160px] overflow-y-auto rounded-lg border border-paper-border bg-white py-1 shadow-float"
                      >
                        {tagSuggestions.length > 0 ? (
                          tagSuggestions.map((t) => (
                            <li key={t}>
                              <button
                                type="button"
                                onClick={() => selectExistingTag(t)}
                                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-paper-text transition hover:bg-paper-block"
                              >
                                # {t}
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-1.5 text-sm text-paper-muted">
                            {tagInput.trim()
                              ? "沒有符合的標籤，按 Enter 新增"
                              : "沒有其他標籤"}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
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
