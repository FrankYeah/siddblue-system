"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
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
}: {
  initialBoard: BoardData;
}) {
  const [board, setBoard] = useState<BoardData>(initialBoard);
  const [editing, setEditing] = useState<{
    status: InspirationStatus;
    id: string;
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  // 每次變更都把整個看板寫回 KV
  async function persist(next: BoardData) {
    setBoard(next);
    setSaving(true);
    try {
      const res = await fetch("/api/inspirations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      flash("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">📝 寫作靈感庫</h2>
          <p className="text-sm text-paper-muted">
            拖曳卡片切換狀態，點擊卡片可展開編輯內容。
          </p>
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" /> 儲存中
          </span>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
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
                          {board[col.key].length}
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
                    {board[col.key].map((card, index) => (
                      <Draggable draggableId={card.id} index={index} key={card.id}>
                        {(dp, ds) => (
                          <button
                            ref={dp.innerRef}
                            {...dp.draggableProps}
                            {...dp.dragHandleProps}
                            onClick={() => openEditor(col.key, card)}
                            className={`group w-full rounded-lg border border-paper-border bg-white p-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow-card ${
                              ds.isDragging ? "shadow-float ring-2 ring-brand-300" : ""
                            } ${col.key === "archived" ? "opacity-60" : ""}`}
                          >
                            <div className="truncate text-sm font-medium text-paper-text">
                              {card.title || (
                                <span className="text-paper-muted">（未命名靈感）</span>
                              )}
                            </div>
                            {card.content && (
                              <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-paper-muted">
                                {card.content}
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
                          </button>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* 編輯 Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-float"
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
