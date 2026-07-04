"use client";

import { useEffect, useRef, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus, Trash2, X, Loader2, Sparkles } from "lucide-react";
import Linkify from "@/components/Linkify";
import { useQueuedSave, useSyncOnFocus } from "./hooks";
import type {
  Inspiration,
  InspirationBoard as BoardData,
  InspirationStatus,
} from "@/lib/types";

const COLUMNS: {
  key: InspirationStatus;
  title: string;
  hint: string;
}[] = [
  { key: "idea", title: "💡 靈感池", hint: "隨手記錄的想法" },
  { key: "newsletter", title: "📰 長文電子報", hint: "每週電子報主題" },
  { key: "shortvideo", title: "🎬 短影片", hint: "精簡核心邏輯腳本" },
  { key: "archived", title: "📦 已封存", hint: "已發布 / 錄製完畢" },
];

function nowIso() {
  return new Date().toISOString();
}
function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export default function InspirationBoard({
  initialBoard,
  searchQuery = "",
}: {
  initialBoard: BoardData;
  /** 全域搜尋框（AdminWorkspace）傳入的關鍵字，即打即過濾 */
  searchQuery?: string;
}) {
  const [board, setBoard] = useState<BoardData>(initialBoard);
  const query = searchQuery.trim().toLowerCase();
  const searching = query.length > 0;
  const matchesQuery = (c: Inspiration) =>
    c.title.toLowerCase().includes(query) ||
    c.content.toLowerCase().includes(query);
  const [editing, setEditing] = useState<{
    status: InspirationStatus;
    id: string;
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [toast, setToast] = useState("");
  const [generating, setGenerating] = useState(false);
  // 掛載後才渲染拖曳元件，避開 SSR / StrictMode 的 mounting 問題
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  // 寫回 KV：經佇列序列化＋合併，避免連續拖曳時 PUT 亂序（舊蓋新）
  const { enqueue, saving, isBusy } = useQueuedSave<BoardData>(
    async (payload) => {
      try {
        const res = await fetch("/api/inspirations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board: payload }),
        });
        if (!res.ok) throw new Error();
      } catch {
        flash("儲存失敗，請稍後再試");
      }
    },
  );

  // 每次變更：畫面先更新（樂觀），再排入儲存佇列
  const lastMutationAt = useRef(0);
  function persist(next: BoardData) {
    setBoard(next);
    lastMutationAt.current = Date.now();
    enqueue(next);
  }

  // 切回分頁時重新同步（跨裝置編輯 / Router Cache 過期資料）。
  // 編輯中、儲存中、或 10 秒內剛改過（避免讀取複本延遲蓋掉新資料）則跳過。
  useSyncOnFocus(async () => {
    if (editing || isBusy()) return;
    if (Date.now() - lastMutationAt.current < 10_000) return;
    try {
      const res = await fetch("/api/inspirations");
      if (!res.ok) return;
      const { board: fresh } = (await res.json()) as { board: BoardData };
      setBoard((cur) =>
        JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh,
      );
    } catch {
      /* 同步失敗不打擾使用者，下次 focus 再試 */
    }
  });

  function onDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    const from = source.droppableId as InspirationStatus;
    const to = destination.droppableId as InspirationStatus;
    const next: BoardData = {
      idea: [...board.idea],
      newsletter: [...board.newsletter],
      shortvideo: [...board.shortvideo],
      archived: [...board.archived],
    };
    const [moved] = next[from].splice(source.index, 1);
    if (!moved) return;
    next[to].splice(destination.index, 0, moved);
    persist(next);
  }

  function addCard(status: InspirationStatus) {
    const card: Inspiration = {
      id: newId(),
      title: "",
      content: "",
      updatedAt: nowIso(),
    };
    const next: BoardData = { ...board, [status]: [card, ...board[status]] };
    persist(next);
    openEditor(status, card);
  }

  function openEditor(status: InspirationStatus, card: Inspiration) {
    setEditing({ status, id: card.id });
    setDraftTitle(card.title);
    setDraftContent(card.content);
  }

  function saveEditor() {
    if (!editing) return;
    const { status, id } = editing;
    const next: BoardData = {
      ...board,
      [status]: board[status].map((c) =>
        c.id === id
          ? { ...c, title: draftTitle, content: draftContent, updatedAt: nowIso() }
          : c,
      ),
    };
    persist(next);
    setEditing(null);
  }

  function deleteCard(status: InspirationStatus, id: string) {
    const next: BoardData = {
      ...board,
      [status]: board[status].filter((c) => c.id !== id),
    };
    persist(next);
    if (editing?.id === id) setEditing(null);
  }

  // ✨ 內容矩陣引擎：長文電子報 → 短影音腳本，自動建卡到「🎬 短影片」欄
  async function generateShortVideo() {
    if (!editing || generating) return;
    const content = draftContent.trim();
    if (!content) {
      flash("內容是空的，請先貼上長文再生成");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle, content }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        script?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error || "生成失敗，請稍後再試");
      const script = String(data.script ?? "").trim();
      if (!script) throw new Error("生成結果為空，請再試一次");

      const card: Inspiration = {
        id: newId(),
        title: `🎬 ${draftTitle || "短影音腳本"}`,
        content: script,
        updatedAt: nowIso(),
      };
      // 以最新 board 為底加卡（不動使用者尚未儲存的 Modal 草稿）
      const next: BoardData = {
        ...board,
        shortvideo: [card, ...board.shortvideo],
      };
      persist(next);
      flash("已生成短影音腳本，放進「🎬 短影片」欄");
    } catch (e) {
      flash(e instanceof Error && e.message ? e.message : "生成失敗，請稍後再試");
    } finally {
      setGenerating(false);
    }
  }

  // 尚未掛載前不渲染拖曳樹（面板初始為 hidden，使用者切到本頁時早已掛載完成）
  if (!mounted) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">📝 寫作靈感庫</h2>
          <p className="text-sm text-paper-muted">
            拖曳卡片切換狀態，點擊卡片可展開編輯內容。
          </p>
          {searching && (
            <p className="mt-0.5 text-xs text-amber-600">
              🔍 搜尋過濾中，拖曳排序暫停；清除搜尋後恢復。
            </p>
          )}
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" /> 儲存中
          </span>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            // 搜尋時只顯示符合的卡片；拖曳同時停用（過濾後的 index 與
            // 原陣列不對齊，若允許拖曳會把卡片排錯位置）
            const cards = searching
              ? board[col.key].filter(matchesQuery)
              : board[col.key];
            return (
            <Droppable droppableId={col.key} key={col.key}>
              {(provided, snapshot) => (
                <div
                  className={`flex min-h-[200px] flex-col rounded-xl border p-3 transition ${
                    snapshot.isDraggingOver
                      ? "border-brand-300 bg-brand-50"
                      : "border-paper-border bg-paper-block/60"
                  }`}
                >
                  <div className="mb-3 flex items-baseline justify-between px-1">
                    <div>
                      <div className="text-sm font-semibold text-paper-text">
                        {col.title}
                        <span className="ml-1.5 text-xs font-normal text-paper-muted">
                          {searching
                            ? `${cards.length}/${board[col.key].length}`
                            : board[col.key].length}
                        </span>
                      </div>
                      <div className="text-[11px] text-paper-muted">{col.hint}</div>
                    </div>
                    <button
                      onClick={() => addCard(col.key)}
                      className="rounded-md p-1 text-paper-muted transition hover:bg-white hover:text-brand-600"
                      title="新增靈感"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex flex-1 flex-col gap-2"
                  >
                    {cards.map((card, index) => (
                      <Draggable
                        draggableId={card.id}
                        index={index}
                        key={card.id}
                        isDragDisabled={searching}
                      >
                        {(dp, ds) => (
                          // 用 <div> 而非 <button>：@hello-pangea/dnd 不會從互動元素
                          // (button/a/input…) 啟動拖曳，卡片若是 button 會出現抓取游標
                          // 卻完全拖不動。改成 div 後，點擊 = 開編輯、拖曳 = 排序/跨欄。
                          <div
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            onClick={() => openEditor(col.key, card)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                openEditor(col.key, card);
                              }
                            }}
                            className={`group w-full rounded-lg border border-paper-border bg-white p-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow-card ${
                              searching
                                ? ""
                                : "cursor-grab active:cursor-grabbing"
                            } ${
                              ds.isDragging ? "shadow-float ring-2 ring-brand-300" : ""
                            } ${col.key === "archived" ? "opacity-60" : ""}`}
                          >
                            {/* 標題完整顯示：多行向下展開，不截斷 */}
                            <div className="whitespace-normal break-words text-sm font-medium text-paper-text">
                              {card.title || (
                                <span className="text-paper-muted">（未命名靈感）</span>
                              )}
                            </div>
                            {card.content && (
                              <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-xs text-paper-muted">
                                <Linkify text={card.content} />
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[10px] text-paper-muted">
                                {fmt(card.updatedAt)}
                              </span>
                              <span
                                role="button"
                                tabIndex={-1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCard(col.key, card.id);
                                }}
                                className="rounded p-1 text-paper-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                                title="刪除"
                              >
                                <Trash2 size={13} />
                              </span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      {/* 編輯 Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-paper-text">編輯靈感</h3>
              <button
                onClick={() => setEditing(null)}
                className="rounded-md p-1 text-paper-muted hover:bg-paper-block"
              >
                <X size={18} />
              </button>
            </div>

            <label className="field-label">標題</label>
            <input
              autoFocus
              className="field-input mb-4"
              placeholder="一句話標題"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />

            <label className="field-label">
              內容（支援多行 / 基本 Markdown，適合口述重點）
            </label>
            <textarea
              className="field-input min-h-[220px] resize-y font-mono text-sm leading-relaxed"
              placeholder="在這裡記錄靈感、語音口述的重點、腳本…"
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
            />

            {/* ✨ 內容矩陣引擎：只在「長文電子報」欄的卡片顯示 */}
            {editing.status === "newsletter" && (
              <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 text-xs text-paper-muted">
                    以 AI 萃取本文精華，生成 300 字內短影音腳本
                    <br />
                    （Hook → 核心邏輯 → CTA），自動放入「🎬 短影片」欄。
                  </div>
                  <button
                    onClick={generateShortVideo}
                    disabled={generating || !draftContent.trim()}
                    className="btn-primary shrink-0"
                    title="矩陣生成：轉短影音"
                  >
                    {generating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> 生成中…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> 矩陣生成：轉短影音
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => deleteCard(editing.status, editing.id)}
                className="btn-danger"
              >
                <Trash2 size={16} /> 刪除
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="btn-ghost">
                  取消
                </button>
                <button onClick={saveEditor} className="btn-primary">
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float">
          {toast}
        </div>
      )}
    </div>
  );
}
