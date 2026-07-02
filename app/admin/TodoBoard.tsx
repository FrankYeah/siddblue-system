"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

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

  function addTodo(bucket: TodoBucket) {
    const title = drafts[bucket].trim();
    if (!title) return;
    const todo: Todo = { id: newId(), title };
    const next: BoardData = { ...board, [bucket]: [...board[bucket], todo] };
    setDrafts((d) => ({ ...d, [bucket]: "" }));
    persist(next);
  }

  function removeTodo(bucket: TodoBucket, id: string) {
    const next: BoardData = {
      ...board,
      [bucket]: board[bucket].filter((t) => t.id !== id),
    };
    persist(next);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">✅ 待辦清單</h2>
          <p className="text-sm text-paper-muted">
            輸入後按 Enter 新增；點右側 🗑️ 直接移除，保持清爽。
          </p>
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" /> 儲存中
          </span>
        )}
      </div>

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

            {/* 新增任務輸入框 */}
            <div className="mb-3 flex items-center gap-2 rounded-lg border-2 border-dashed border-paper-border px-3 py-2 focus-within:border-brand-400">
              <Plus size={18} className="shrink-0 text-brand-500" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-paper-muted"
                placeholder="＋ 新增任務，按 Enter"
                value={drafts[b.key]}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [b.key]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTodo(b.key);
                  }
                }}
              />
            </div>

            {/* 任務清單 */}
            <ul className="space-y-1.5">
              {board[b.key].length === 0 && (
                <li className="px-1 py-3 text-sm text-paper-muted">目前沒有任務。</li>
              )}
              {board[b.key].map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-2 rounded-lg border border-paper-border bg-paper-block/40 px-3 py-2.5 transition hover:bg-paper-block"
                >
                  <span className="flex-1 break-words text-sm text-paper-text">
                    {t.title}
                  </span>
                  <button
                    onClick={() => removeTodo(b.key, t.id)}
                    className="shrink-0 rounded-md p-1.5 text-paper-muted transition hover:bg-red-50 hover:text-red-600"
                    title="完成 / 刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float">
          {toast}
        </div>
      )}
    </div>
  );
}
