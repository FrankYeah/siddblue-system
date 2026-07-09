"use client";

import { useEffect, useRef, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus, Trash2, Loader2, GripVertical, Repeat } from "lucide-react";
import { useQueuedSave, useSyncOnFocus } from "./hooks";
import type {
  Reminder,
  ReminderFrequency,
  Todo,
  TodoBoard as BoardData,
  TodoBucket,
} from "@/lib/types";

const BUCKETS: { key: TodoBucket; title: string; accent: string }[] = [
  { key: "now", title: "🔥 立即處理", accent: "border-t-red-400" },
  { key: "later", title: "⏳ 稍後再說", accent: "border-t-brand-400" },
  { key: "longterm", title: "🎯 長期要做的事", accent: "border-t-emerald-400" },
  { key: "errand", title: "🚗 外出待辦", accent: "border-t-violet-400" },
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  weekly: "每週",
  monthly: "每月",
  yearly: "每年",
  once: "特定日期（僅一次）",
};

function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

/** 依頻率給預設 when 值 (今天對應的星期/幾號/月日) */
function defaultReminderWhen(frequency: ReminderFrequency): string {
  const today = new Date();
  if (frequency === "weekly") return String(today.getDay());
  if (frequency === "monthly") return String(today.getDate());
  if (frequency === "yearly") {
    return `${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;
  }
  return today.toISOString().slice(0, 10);
}

/** 提醒的排程說明文字，如「每週三」「每月 15 號」「每年 3/15」「2026-08-01」 */
function reminderScheduleLabel(r: Reminder): string {
  if (r.frequency === "weekly") {
    return `每週${WEEKDAY_LABELS[Number(r.when)] ?? ""}`;
  }
  if (r.frequency === "monthly") return `每月 ${r.when} 號`;
  if (r.frequency === "yearly") {
    const [m, d] = r.when.split("-");
    return `每年 ${Number(m)}/${Number(d)}`;
  }
  return r.when;
}

/** 下一次發生的日期 (供排序 / 顯示「還有幾天」使用) */
function nextOccurrence(r: Reminder, today: Date): Date {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (r.frequency === "once") {
    const d = new Date(`${r.when}T00:00:00`);
    return Number.isNaN(d.getTime()) ? base : d;
  }
  if (r.frequency === "weekly") {
    const target = Number(r.when);
    const diff = (target - base.getDay() + 7) % 7;
    const d = new Date(base);
    d.setDate(d.getDate() + diff);
    return d;
  }
  if (r.frequency === "monthly") {
    const day = Number(r.when);
    let d = new Date(base.getFullYear(), base.getMonth(), day);
    if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, day);
    return d;
  }
  // yearly
  const [mm, dd] = r.when.split("-").map(Number);
  let d = new Date(base.getFullYear(), (mm || 1) - 1, dd || 1);
  if (d < base) d = new Date(base.getFullYear() + 1, (mm || 1) - 1, dd || 1);
  return d;
}

/** 距下次發生還有幾天的顯示文字 */
function daysUntilLabel(r: Reminder, today: Date): string {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = nextOccurrence(r, today);
  const days = Math.round((next.getTime() - base.getTime()) / 86_400_000);
  if (r.frequency === "once" && days < 0) return "已過期";
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天後`;
}

/** 依頻率切換不同的「when」輸入控制項 (星期選單 / 日期數字 / 月日 / 完整日期) */
function ReminderWhenInput({
  frequency,
  value,
  onChange,
}: {
  frequency: ReminderFrequency;
  value: string;
  onChange: (v: string) => void;
}) {
  if (frequency === "weekly") {
    return (
      <select
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <option key={label} value={String(i)}>
            星期{label}
          </option>
        ))}
      </select>
    );
  }
  if (frequency === "monthly") {
    return (
      <input
        type="number"
        min={1}
        max={31}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (frequency === "yearly") {
    return (
      <input
        type="date"
        className="field-input"
        value={`2000-${value || "01-01"}`}
        onChange={(e) => onChange(e.target.value.slice(5))}
      />
    );
  }
  return (
    <input
      type="date"
      className="field-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
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
    longterm: "",
    errand: "",
  });
  const [editing, setEditing] = useState<{ bucket: TodoBucket; id: string } | null>(
    null,
  );
  const [editText, setEditText] = useState("");
  const [toast, setToast] = useState("");

  // ── 週期提醒 ──
  const [reminderDraft, setReminderDraft] = useState<{
    title: string;
    frequency: ReminderFrequency;
    when: string;
  }>({ title: "", frequency: "weekly", when: defaultReminderWhen("weekly") });
  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null,
  );
  const [reminderEditDraft, setReminderEditDraft] = useState<{
    title: string;
    frequency: ReminderFrequency;
    when: string;
  }>({ title: "", frequency: "weekly", when: "1" });
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
        const res = await fetch("/api/todos", {
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
    if (editing || editingReminderId || isBusy()) return;
    if (Date.now() - lastMutationAt.current < 10_000) return;
    const requestedAt = Date.now();
    try {
      const res = await fetch("/api/todos");
      if (!res.ok) return;
      const { board: fresh } = (await res.json()) as { board: BoardData };
      // fetch 進行期間若又發生本地變更（例如剛新增任務），這份回應已經是
      // 過期快照，不能覆蓋，否則會把剛新增的項目蓋掉
      if (lastMutationAt.current >= requestedAt) return;
      setBoard((cur) =>
        JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh,
      );
    } catch {
      /* 同步失敗不打擾使用者，下次 focus 再試 */
    }
  });

  // 只有點擊「新增」按鈕才會加入（不再以 Enter 自動提交，避免誤觸）
  function addTodo(bucket: TodoBucket) {
    const title = drafts[bucket].trim();
    if (!title) return;
    const todo: Todo = { id: newId(), title };
    // 新項目放最前面，符合「剛加的先看到」的習慣
    const next: BoardData = { ...board, [bucket]: [todo, ...board[bucket]] };
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
    const next: BoardData = {
      now: [...board.now],
      later: [...board.later],
      longterm: [...board.longterm],
      errand: [...board.errand],
      reminders: board.reminders,
    };
    const [moved] = next[from].splice(source.index, 1);
    if (!moved) return;
    next[to].splice(destination.index, 0, moved);
    persist(next);
  }

  // ── 週期提醒：新增 / 移除 / 編輯 ──
  function addReminder() {
    const title = reminderDraft.title.trim();
    if (!title) return;
    const reminder: Reminder = {
      id: newId(),
      title,
      frequency: reminderDraft.frequency,
      when: reminderDraft.when,
    };
    persist({ ...board, reminders: [...board.reminders, reminder] });
    setReminderDraft((d) => ({ ...d, title: "" }));
  }

  function removeReminder(id: string) {
    if (editingReminderId === id) setEditingReminderId(null);
    persist({
      ...board,
      reminders: board.reminders.filter((r) => r.id !== id),
    });
  }

  function startEditReminder(r: Reminder) {
    setEditingReminderId(r.id);
    setReminderEditDraft({
      title: r.title,
      frequency: r.frequency,
      when: r.when,
    });
  }

  function saveEditReminder() {
    if (!editingReminderId) return;
    const id = editingReminderId;
    const title = reminderEditDraft.title.trim();
    setEditingReminderId(null);
    if (!title) return;
    persist({
      ...board,
      reminders: board.reminders.map((r) =>
        r.id === id
          ? {
              ...r,
              title,
              frequency: reminderEditDraft.frequency,
              when: reminderEditDraft.when,
            }
          : r,
      ),
    });
  }

  const grid = (
    // 固定寬度 + 橫向捲動：比照其餘看板的手機慣例，換取每欄更寬敞的文字空間，
    // 避免任務內容在窄欄位裡太容易換行
    <div className="flex gap-4 overflow-x-auto pb-2">
      {BUCKETS.map((b) => (
        <div
          key={b.key}
          className={`w-[340px] shrink-0 rounded-xl border border-t-4 border-paper-border bg-white p-4 shadow-sm ${b.accent}`}
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
    <div className="mx-auto max-w-6xl px-6 py-6">
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

      {/* 週期提醒：每週/每月/每年/特定日期重複出現的提醒事項，與上方「做完就刪」的待辦分開管理 */}
      <div className="mt-6 rounded-xl border border-t-4 border-t-amber-400 border-paper-border bg-white p-4 shadow-sm">
        <h3 className="mb-1 flex items-center gap-1.5 text-base font-semibold text-paper-text">
          <Repeat size={17} className="text-amber-500" /> 週期提醒
          <span className="ml-1 text-xs font-normal text-paper-muted">
            {board.reminders.length}
          </span>
        </h3>
        <p className="mb-3 text-sm text-paper-muted">
          每週／每月／每年或特定日期重複出現的提醒，如「每週關心學生工作進度」，到期不會自動消失，請自行確認後刪除。
        </p>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
          <input
            className="field-input text-base"
            placeholder="提醒內容，如：關心學生工作進度"
            value={reminderDraft.title}
            onChange={(e) =>
              setReminderDraft((d) => ({ ...d, title: e.target.value }))
            }
          />
          <select
            className="field-input"
            value={reminderDraft.frequency}
            onChange={(e) => {
              const frequency = e.target.value as ReminderFrequency;
              setReminderDraft({
                title: reminderDraft.title,
                frequency,
                when: defaultReminderWhen(frequency),
              });
            }}
          >
            {(Object.keys(FREQUENCY_LABELS) as ReminderFrequency[]).map(
              (f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ),
            )}
          </select>
          <ReminderWhenInput
            frequency={reminderDraft.frequency}
            value={reminderDraft.when}
            onChange={(when) => setReminderDraft((d) => ({ ...d, when }))}
          />
          <button
            onClick={addReminder}
            disabled={!reminderDraft.title.trim()}
            className="btn-primary shrink-0 px-4"
            title="新增提醒"
          >
            <Plus size={18} /> 新增
          </button>
        </div>

        {board.reminders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-paper-border px-3 py-4 text-center text-sm text-paper-muted">
            目前沒有週期提醒。
          </p>
        ) : (
          <ul className="space-y-2">
            {[...board.reminders]
              .map((r) => ({ r, next: nextOccurrence(r, new Date()) }))
              .sort((a, b) => a.next.getTime() - b.next.getTime())
              .map(({ r }) => {
                const isEditing = editingReminderId === r.id;
                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-paper-border bg-paper-block/40 p-3"
                  >
                    {isEditing ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
                        <input
                          autoFocus
                          className="field-input text-base"
                          value={reminderEditDraft.title}
                          onChange={(e) =>
                            setReminderEditDraft((d) => ({
                              ...d,
                              title: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditReminder();
                            else if (e.key === "Escape")
                              setEditingReminderId(null);
                          }}
                        />
                        <select
                          className="field-input"
                          value={reminderEditDraft.frequency}
                          onChange={(e) => {
                            const frequency = e.target
                              .value as ReminderFrequency;
                            setReminderEditDraft((d) => ({
                              title: d.title,
                              frequency,
                              when: defaultReminderWhen(frequency),
                            }));
                          }}
                        >
                          {(
                            Object.keys(FREQUENCY_LABELS) as ReminderFrequency[]
                          ).map((f) => (
                            <option key={f} value={f}>
                              {FREQUENCY_LABELS[f]}
                            </option>
                          ))}
                        </select>
                        <ReminderWhenInput
                          frequency={reminderEditDraft.frequency}
                          value={reminderEditDraft.when}
                          onChange={(when) =>
                            setReminderEditDraft((d) => ({ ...d, when }))
                          }
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEditReminder}
                            className="btn-primary shrink-0 px-3"
                          >
                            儲存
                          </button>
                          <button
                            onClick={() => setEditingReminderId(null)}
                            className="btn-ghost shrink-0 px-3"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          onClick={() => startEditReminder(r)}
                          className="min-w-0 flex-1 cursor-pointer break-words text-base text-paper-text"
                          title="點擊編輯"
                        >
                          {r.title}
                        </span>
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          {reminderScheduleLabel(r)}
                        </span>
                        <span className="shrink-0 text-xs text-paper-muted">
                          {daysUntilLabel(r, new Date())}
                        </span>
                        <button
                          onClick={() => removeReminder(r.id)}
                          className="shrink-0 rounded-md p-2 text-paper-muted transition hover:bg-red-50 hover:text-red-600"
                          title="刪除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>

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

  // 卡片內容（編輯中 → 原地輸入框；否則 → 把手圖示 + 可點擊標題 + 刪除）
  // 整張卡片皆為拖曳把手（dragHandleProps 綁在外層 <li>），此處標題改用
  // 非互動的 <div>，讓「點擊 = 編輯、拖曳 = 排序」在整張卡片上都成立。
  function cardBody(t: Todo) {
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
        <span className="shrink-0 text-paper-muted" aria-hidden="true">
          <GripVertical size={18} />
        </span>
        <div
          onClick={() => onStartEdit(t)}
          className="min-w-0 flex-1 break-words text-base text-paper-text"
          title="點擊編輯"
        >
          {t.title}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(t.id);
          }}
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
            <Draggable
              draggableId={t.id}
              index={index}
              key={t.id}
              isDragDisabled={editingId === t.id}
            >
              {(dp, ds) => (
                <li
                  ref={dp.innerRef}
                  {...dp.draggableProps}
                  {...dp.dragHandleProps}
                  className={`flex min-h-[64px] items-center gap-2 rounded-xl border border-paper-border p-4 transition ${
                    editingId === t.id ? "" : "cursor-grab active:cursor-grabbing"
                  } ${
                    ds.isDragging
                      ? "bg-white shadow-float ring-2 ring-brand-300"
                      : "bg-paper-block/40 hover:bg-paper-block"
                  }`}
                >
                  {cardBody(t)}
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
