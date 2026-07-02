"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd";
import { Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import type { Todo, TodoBoard as BoardData, TodoBucket } from "@/lib/types";

const BUCKETS: { key: TodoBucket; title: string; accent: string }[] = [
  { key: "now", title: "🔥 立即處理", accent: "border-t-red-400" },
  { key: "later", title: "⏳ 稍後再說", accent: "border-t-brand-400" },
];

function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

export default function TodoBoard({
  initialBoard,
}: {
  initialBoard: BoardData;
}) {
  const [board, setBoard] = useState<BoardData>(initialBoard);
  const [drafts, setDrafts] = useState<Record<TodoBucket, string>>({
    now: "",
    later: "",
  });
  const [editing, setEditing] = useState<{ bucket: TodoBucket; id: string } | null>(
    null,
  );
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  // 掛載後才渲染拖曳元件，避開 SSR / StrictMode 的 mounting 問題
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function persist(next: BoardData) {
    setBoard(next);
    setSaving(true);
    try {
      const res = await fetch("/api/todos", {
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

  // 只有點擊「新增」按鈕才會加入（不再以 Enter 自動提交，避免誤觸）
  function addTodo(bucket: TodoBucket) {
    const title = drafts[bucket].trim();
    if (!title) return;
    const todo: Todo = { id: newId(), title };
    const next: BoardData = { ...board, [bucket]: [...board[bucket], todo] };
    setDrafts((d) => ({ ...d, [bucket]: "" }));
    persist(next);
  }

  function removeTodo(bucket: TodoBucket, id: string) {
    if (editing?.id === id) setEditing(null);
    const next: BoardData = {
      ...board,
      [bucket]: board[bucket].filter((t) => t.id !== id),
    };
    persist(next);
  }

  function startEdit(bucket: TodoBucket, t: Todo) {
    setEditing({ bucket, id: t.id });
    setEditText(t.title);
  }

  function saveEdit() {
    if (!editing) return;
    const { bucket, id } = editing;
    const title = editText.trim();
    setEditing(null);
    const cur = board[bucket].find((t) => t.id === id);
    // 空白或未變更 → 不寫入（保留原標題）
    if (!cur || !title || title === cur.title) return;
    const next: BoardData = {
      ...board,
      [bucket]: board[bucket].map((t) => (t.id === id ? { ...t, title } : t)),
    };
    persist(next);
  }

  // 同欄重新排序 (reorder) 與跨欄移動 (move) 皆由此處理
  function onDragEnd(result: DropResult) {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    const from = source.droppableId as TodoBucket;
    const to = destination.droppableId as TodoBucket;
    const next: BoardData = { now: [...board.now], later: [...board.later] };
    const [moved] = next[from].splice(source.index, 1);
    if (!moved) return;
    next[to].splice(destination.index, 0, moved);
    persist(next);
  }

  const grid = (
    <div className="grid gap-4 md:grid-cols-2">
      {BUCKETS.map((b) => (
        <div
          key={b.key}
          className={`rounded-xl border border-t-4 border-paper-border bg-white p-4 shadow-sm ${b.accent}`}
        >
          <h3 className="mb-3 text-base font-semibold text-paper-text">
            {b.title}
            <span className="ml-1.5 text-xs font-normal text-paper-muted">
              {board[b.key].length}
            </span>
          </h3>

          {/* 新增任務：輸入 + 明確「新增」按鈕（不以 Enter 提交） */}
          <div className="mb-3 flex items-stretch gap-2">
            <input
              className="field-input flex-1 text-base"
              placeholder="輸入任務內容…"
              value={drafts[b.key]}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [b.key]: e.target.value }))
              }
            />
            <button
              onClick={() => addTodo(b.key)}
              disabled={!drafts[b.key].trim()}
              className="btn-primary shrink-0 px-4"
              title="新增任務"
            >
              <Plus size={18} /> 新增
            </button>
          </div>

          {/* 任務清單（可拖曳排序 / 跨欄移動） */}
          <TodoList
            bucket={b.key}
            items={board[b.key]}
            mounted={mounted}
            editingId={editing?.id ?? null}
            editText={editText}
            onStartEdit={(t) => startEdit(b.key, t)}
            onEditTextChange={setEditText}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditing(null)}
            onRemove={(id) => removeTodo(b.key, id)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">✅ 待辦清單</h2>
          <p className="text-sm text-paper-muted">
            點卡片可編輯標題、拖曳可排序或跨欄移動；🗑️ 直接移除。
          </p>
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" /> 儲存中
          </span>
        )}
      </div>

      {mounted ? (
        <DragDropContext onDragEnd={onDragEnd}>{grid}</DragDropContext>
      ) : (
        grid
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float sm:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  單欄清單：掛載後渲染 Droppable/Draggable，否則靜態列表
// ─────────────────────────────────────────────────────────────
function TodoList({
  bucket,
  items,
  mounted,
  editingId,
  editText,
  onStartEdit,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
  onRemove,
}: {
  bucket: TodoBucket;
  items: Todo[];
  mounted: boolean;
  editingId: string | null;
  editText: string;
  onStartEdit: (t: Todo) => void;
  onEditTextChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: (id: string) => void;
}) {
  const empty = items.length === 0;

  // 卡片內容（編輯中 → 原地輸入框；否則 → 拖曳把手 + 可點擊標題 + 刪除）
  function cardBody(
    t: Todo,
    dragHandleProps?: DraggableProvidedDragHandleProps | null,
  ) {
    if (editingId === t.id) {
      return (
        <input
          autoFocus
          className="field-input flex-1 text-base"
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          onBlur={onSaveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSaveEdit();
            } else if (e.key === "Escape") {
              onCancelEdit();
            }
          }}
        />
      );
    }
    return (
      <>
        <span
          {...dragHandleProps}
          className="shrink-0 cursor-grab touch-none text-paper-muted active:cursor-grabbing"
          title="拖曳排序"
          aria-label="拖曳排序"
        >
          <GripVertical size={18} />
        </span>
        <button
          onClick={() => onStartEdit(t)}
          className="min-w-0 flex-1 break-words text-left text-base text-paper-text"
          title="點擊編輯"
        >
          {t.title}
        </button>
        <button
          onClick={() => onRemove(t.id)}
          className="shrink-0 rounded-md p-2 text-paper-muted transition hover:bg-red-50 hover:text-red-600"
          title="刪除"
        >
          <Trash2 size={18} />
        </button>
      </>
    );
  }

  // 掛載前：靜態列表（保留版面，不可拖曳）
  if (!mounted) {
    return (
      <ul className="space-y-2 p-1">
        {empty && (
          <li className="px-1 py-4 text-sm text-paper-muted">目前沒有任務。</li>
        )}
        {items.map((t) => (
          <li
            key={t.id}
            className="flex min-h-[64px] items-center gap-2 rounded-xl border border-paper-border bg-paper-block/40 p-4"
          >
            <span className="shrink-0 text-paper-muted">
              <GripVertical size={18} />
            </span>
            <span className="min-w-0 flex-1 break-words text-base text-paper-text">
              {t.title}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Droppable droppableId={bucket}>
      {(provided, snapshot) => (
        <ul
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`min-h-[64px] space-y-2 rounded-lg p-1 transition ${
            snapshot.isDraggingOver ? "bg-brand-50" : ""
          }`}
        >
          {empty && (
            <li className="px-1 py-4 text-sm text-paper-muted">目前沒有任務。</li>
          )}
          {items.map((t, index) => (
            <Draggable draggableId={t.id} index={index} key={t.id}>
              {(dp, ds) => (
                <li
                  ref={dp.innerRef}
                  {...dp.draggableProps}
                  className={`flex min-h-[64px] items-center gap-2 rounded-xl border border-paper-border p-4 transition ${
                    ds.isDragging
                      ? "bg-white shadow-float ring-2 ring-brand-300"
                      : "bg-paper-block/40 hover:bg-paper-block"
                  }`}
                >
                  {cardBody(t, dp.dragHandleProps)}
                </li>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </ul>
      )}
    </Droppable>
  );
}
