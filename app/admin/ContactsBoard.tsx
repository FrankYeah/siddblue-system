"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Upload,
  ExternalLink,
  UserRound,
  X,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { parseContactsCsv } from "@/lib/contacts-csv";
import { groupSortContacts, professionTokens } from "@/lib/contacts-sort";
import { useQueuedSave } from "./hooks";
import type {
  Contact,
  ContactInput,
  ContactLevel,
  ContactStatus,
  CooperationType,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────
//  🤝 人脈資料庫 (Connections CRM) — Notion 風格資料表
//  滿版 Grid 列 + 點列開啟編輯 Modal + @hello-pangea/dnd 拖曳排序
//  + 逐列「＋」插入 + 職業別/合作方向篩選 + CSV 整批匯入
//
//  排序持久化：拖曳/插入後把整個 id 陣列 PUT 回 contacts:order
//  (經 useQueuedSave 序列化，不會舊蓋新)；未手動排序前，
//  伺服器以 groupSortContacts 分組排序 (同職業別/合作方向相鄰)。
// ─────────────────────────────────────────────────────────────

const EMPTY_DRAFT: ContactInput = {
  name: "",
  profession: "",
  contactInfo: "",
  url: "",
  familiarity: "unknown",
  liking: "unknown",
  ability: "unknown",
  price: "unknown",
  status: "unknown",
  cooperationType: "project",
  transferInfo: "",
  note: "",
};

const LEVEL_META: Record<ContactLevel, { label: string; chip: string }> = {
  high: { label: "高", chip: "bg-emerald-100 text-emerald-700" },
  medium: { label: "中", chip: "bg-amber-100 text-amber-700" },
  low: { label: "低", chip: "bg-slate-200/70 text-slate-600" },
  unknown: { label: "–", chip: "text-paper-muted/60" },
};

const STATUS_META: Record<ContactStatus, string> = {
  employed: "就業",
  freelance: "接案",
  startup: "創業",
  student: "學生",
  unknown: "–",
};

const COOP_META: Record<
  CooperationType,
  { label: string; hint: string; chip: string }
> = {
  project: {
    label: "專案合作",
    hint: "外包、合夥",
    chip: "bg-brand-50 text-brand-700",
  },
  industry: {
    label: "業界合作",
    hint: "網紅、互惠合作",
    chip: "bg-purple-100 text-purple-700",
  },
};

/** 資料表欄位樣板 (表頭與每一列共用，確保對齊)：
    ⠿ / 姓名 / 職業別 / 合作方向 / 狀態 / 熟悉 / 能力 / 價格 / 備註 / ＋ */
const GRID =
  "grid grid-cols-[30px_minmax(100px,1.1fr)_minmax(130px,1.4fr)_96px_56px_48px_48px_48px_minmax(170px,1.9fr)_40px] items-center gap-x-2";

/** 評級欄位的顯示名稱 (點徽章篩選時的提示用) */
const LEVEL_FIELD_LABEL = {
  familiarity: "熟悉",
  ability: "能力",
  price: "價格",
} as const;

type LevelFieldKey = keyof typeof LEVEL_FIELD_LABEL;

/** 篩選 chip 上的評級文字 (unknown 顯示「不確定」而非表格的「–」) */
const levelText = (lv: ContactLevel) =>
  lv === "unknown" ? "不確定" : LEVEL_META[lv].label;

type ModalState =
  | { mode: "edit"; id: string }
  | { mode: "create"; afterId: string | null };

function contactToDraft(c: Contact): ContactInput {
  return {
    name: c.name,
    profession: c.profession,
    contactInfo: c.contactInfo,
    url: c.url,
    familiarity: c.familiarity,
    liking: c.liking,
    ability: c.ability,
    price: c.price,
    status: c.status,
    cooperationType: c.cooperationType,
    transferInfo: c.transferInfo,
    note: c.note,
  };
}

export default function ContactsBoard({
  initialContacts,
  initialOrdered,
  searchQuery = "",
}: {
  initialContacts: Contact[];
  /** 伺服器端是否已套用手動排序 (contacts:order 存在) */
  initialOrdered: boolean;
  /** 全域搜尋框（AdminWorkspace）傳入的關鍵字 */
  searchQuery?: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [ordered, setOrdered] = useState(initialOrdered);
  const [coopFilter, setCoopFilter] = useState<CooperationType | "all">("all");
  const [profFilter, setProfFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">(
    "all",
  );
  const [levelFilter, setLevelFilter] = useState<{
    key: LevelFieldKey;
    value: ContactLevel;
  } | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [draft, setDraft] = useState<ContactInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  }

  // 排序整包覆寫 (id 陣列)：序列化＋合併，快速連拖不會舊蓋新。
  // 注意：useQueuedSave 以 null 作為「佇列已清空」哨兵，
  // 故酬載必須包成物件，order: null (清除排序) 才送得出去。
  const { enqueue: enqueueOrder, saving: orderSaving } = useQueuedSave<{
    order: string[] | null;
  }>(async ({ order }) => {
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error();
    } catch {
      flash("排序儲存失敗，請稍後再試");
    }
  });

  /** 套用新顯示順序並持久化 (拖曳 / 插入 / 刪除後) */
  function applyManualOrder(next: Contact[]) {
    setContacts(next);
    setOrdered(true);
    enqueueOrder({ order: next.map((c) => c.id) });
  }

  /** 回到預設分組排序 (同職業別/合作方向相鄰)，清除手動順序 */
  function regroup() {
    setContacts((cs) => groupSortContacts(cs));
    setOrdered(false);
    enqueueOrder({ order: null });
    flash("已依 合作方向 → 職業別 重新分組");
  }

  // ── 篩選 ──
  const professions = useMemo(() => {
    const count = new Map<string, number>();
    contacts.forEach((c) =>
      professionTokens(c.profession).forEach((t) =>
        count.set(t, (count.get(t) ?? 0) + 1),
      ),
    );
    return Array.from(count.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "zh-Hant"),
    );
  }, [contacts]);

  /** 本地篩選 (不含全域搜尋)，「清除篩選」按鈕只清這些 */
  const localFiltering =
    coopFilter !== "all" ||
    profFilter !== "all" ||
    statusFilter !== "all" ||
    levelFilter !== null;
  const filtering = localFiltering || searchQuery.trim() !== "";

  // ── 點儲存格值即篩選 (再點一次同值 = 取消) ──
  function toggleProf(t: string) {
    setProfFilter((p) => (p === t ? "all" : t));
  }
  function toggleCoop(t: CooperationType) {
    setCoopFilter((p) => (p === t ? "all" : t));
  }
  function toggleStatus(s: ContactStatus) {
    setStatusFilter((p) => (p === s ? "all" : s));
  }
  function toggleLevel(key: LevelFieldKey, value: ContactLevel) {
    setLevelFilter((p) =>
      p && p.key === key && p.value === value ? null : { key, value },
    );
  }
  function clearFilters() {
    setCoopFilter("all");
    setProfFilter("all");
    setStatusFilter("all");
    setLevelFilter(null);
  }

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      if (coopFilter !== "all" && c.cooperationType !== coopFilter)
        return false;
      if (
        profFilter !== "all" &&
        !professionTokens(c.profession).includes(profFilter)
      )
        return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (levelFilter && c[levelFilter.key] !== levelFilter.value)
        return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.profession.toLowerCase().includes(q) ||
        c.contactInfo.toLowerCase().includes(q) ||
        c.url.toLowerCase().includes(q) ||
        c.transferInfo.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q)
      );
    });
  }, [contacts, coopFilter, profFilter, statusFilter, levelFilter, searchQuery]);

  // ── 拖曳排序 (篩選中暫停：過濾後 index 與原陣列不對齊) ──
  function onDragEnd(result: DropResult) {
    if (!result.destination || filtering) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const next = [...contacts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyManualOrder(next);
  }

  // ── Modal ──
  const editingContact =
    modal?.mode === "edit"
      ? (contacts.find((c) => c.id === modal.id) ?? null)
      : null;
  const afterContact =
    modal?.mode === "create" && modal.afterId
      ? (contacts.find((c) => c.id === modal.afterId) ?? null)
      : null;

  const dirty = modal
    ? modal.mode === "create"
      ? JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT)
      : editingContact
        ? JSON.stringify(contactToDraft(editingContact)) !==
          JSON.stringify(draft)
        : false
    : false;

  function openEdit(c: Contact) {
    setDraft(contactToDraft(c));
    setModal({ mode: "edit", id: c.id });
  }

  function openCreate(afterId: string | null) {
    setDraft(EMPTY_DRAFT);
    setModal({ mode: "create", afterId });
  }

  function closeModal(force = false) {
    if (
      !force &&
      dirty &&
      !window.confirm("尚未儲存的變更將遺失，確定關閉？")
    ) {
      return;
    }
    setModal(null);
  }

  // Esc 關閉 Modal
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, dirty]);

  async function save() {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.mode === "edit") {
        const res = await fetch(`/api/contacts/${modal.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error();
        const { contact } = (await res.json()) as { contact: Contact };
        setContacts((cs) =>
          cs.map((c) => (c.id === contact.id ? contact : c)),
        );
        flash("已儲存");
      } else {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error();
        const { contact } = (await res.json()) as { contact: Contact };
        // 安插位置：指定列的正下方；未指定 (工具列新增) 則放最上方
        const next = [...contacts];
        const at = modal.afterId
          ? next.findIndex((c) => c.id === modal.afterId)
          : -1;
        if (at >= 0) next.splice(at + 1, 0, contact);
        else next.unshift(contact);
        applyManualOrder(next);
        flash("已新增");
      }
      setModal(null);
    } catch {
      flash("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("確定刪除這位聯絡人？此動作無法復原。")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const next = contacts.filter((c) => c.id !== id);
      setContacts(next);
      if (ordered) enqueueOrder({ order: next.map((c) => c.id) });
      setModal(null);
      flash("已刪除");
    } catch {
      flash("刪除失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  // ── CSV 整批匯入 ──
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const { contacts: rows, skipped } = parseContactsCsv(text);
      if (rows.length === 0) {
        flash("CSV 中沒有可匯入的資料（每列需要姓名）");
        return;
      }
      const detail = skipped > 0 ? `（另有 ${skipped} 列缺姓名將略過）` : "";
      if (!window.confirm(`將匯入 ${rows.length} 位聯絡人${detail}，確定？`)) {
        return;
      }
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: rows }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "匯入失敗");
      }
      const { contacts: created } = (await res.json()) as {
        contacts: Contact[];
      };
      if (ordered) {
        // 已有手動順序：附加在最後並更新順序
        applyManualOrder([...contacts, ...created]);
      } else {
        // 預設分組模式：就地重新分組 (與伺服器下次載入結果一致)
        setContacts((cs) => groupSortContacts([...cs, ...created]));
      }
      flash(`已匯入 ${created.length} 位聯絡人`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "匯入失敗，請確認 CSV 格式");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = ""; // 允許重選同一檔案
    }
  }

  const busy = saving || importing || orderSaving;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">🤝 人脈庫</h2>
          <p className="text-sm text-paper-muted">
            Notion 風格資料表：點列編輯、拖曳排序、逐列插入；同職業別預設相鄰。
          </p>
        </div>
        {busy && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" />
            {importing ? "匯入中" : orderSaving ? "排序同步中" : "儲存中"}
          </span>
        )}
      </div>

      {/* ── 快速篩選列 (Filter Bar) ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="field-input w-auto min-w-[140px]"
          value={profFilter}
          onChange={(e) => setProfFilter(e.target.value)}
          aria-label="依職業別篩選"
        >
          <option value="all">全部職業別</option>
          {professions.map(([token, n]) => (
            <option key={token} value={token}>
              {token}（{n}）
            </option>
          ))}
        </select>

        <select
          className="field-input w-auto min-w-[110px]"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ContactStatus | "all")
          }
          aria-label="依狀態篩選"
        >
          <option value="all">全部狀態</option>
          <option value="employed">就業</option>
          <option value="freelance">接案</option>
          <option value="startup">創業</option>
          <option value="student">學生</option>
          <option value="unknown">未知</option>
        </select>

        <div className="inline-flex rounded-lg border border-paper-border bg-white p-0.5">
          {(
            [
              ["all", "全部"],
              ["project", COOP_META.project.label],
              ["industry", COOP_META.industry.label],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCoopFilter(key)}
              className={`min-h-[36px] rounded-md px-3 py-1 text-sm transition ${
                coopFilter === key
                  ? "bg-brand-600 text-white"
                  : "text-paper-muted hover:text-paper-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 點表格評級徽章產生的篩選 chip */}
        {levelFilter && (
          <button
            onClick={() => setLevelFilter(null)}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
            title="清除此篩選"
          >
            {LEVEL_FIELD_LABEL[levelFilter.key]}：{levelText(levelFilter.value)}
            <X size={12} />
          </button>
        )}

        {localFiltering && (
          <button
            onClick={clearFilters}
            className="text-xs text-paper-muted underline underline-offset-2 transition hover:text-brand-600"
          >
            清除篩選
          </button>
        )}

        <span className="text-xs text-paper-muted">
          {filtering ? `${visible.length} / ${contacts.length} 位` : `共 ${contacts.length} 位`}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {ordered && (
            <button
              onClick={regroup}
              className="btn-ghost text-sm"
              title="清除手動排序，回到「合作方向 → 職業別」分組"
            >
              <RotateCcw size={14} /> 重新分組
            </button>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn-ghost text-sm"
            title="第一列為表頭：姓名、職業別、聯絡方式、網址、熟悉度、喜好度、能力值、價格、狀態、合作方向、匯款資訊、備註（欄位順序不拘、可缺欄；高/中/低/不確定、就業/接案/創業/學生 自動辨識）"
          >
            <Upload size={15} /> 匯入 CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
            }}
          />
          <button onClick={() => openCreate(null)} className="btn-primary">
            <Plus size={16} /> 新增
          </button>
        </div>
      </div>

      {filtering && (
        <p className="mb-2 text-xs text-paper-muted">
          🔍 篩選/搜尋中，拖曳排序暫停；清除篩選後恢復。
        </p>
      )}

      {/* ── 資料表 (手機橫向滾動) ── */}
      <div className="overflow-x-auto rounded-xl border border-paper-border bg-white">
        <div className="min-w-[940px]">
          {/* 表頭 */}
          <div
            className={`${GRID} border-b border-paper-border bg-paper-block/50 px-2 py-2 text-xs font-medium text-paper-muted`}
          >
            <span />
            <span>姓名</span>
            <span>職業別</span>
            <span>合作方向</span>
            <span>狀態</span>
            <span className="text-center">熟悉</span>
            <span className="text-center">能力</span>
            <span className="text-center">價格</span>
            <span>備註</span>
            <span />
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="contacts-table">
              {(dropProv) => (
                <div ref={dropProv.innerRef} {...dropProv.droppableProps}>
                  {visible.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm text-paper-muted">
                      {contacts.length === 0 ? (
                        <span className="inline-flex items-center gap-2">
                          <UserRound size={16} />
                          還沒有聯絡人，按「新增」或匯入 CSV。
                        </span>
                      ) : (
                        "沒有符合篩選條件的聯絡人。"
                      )}
                    </div>
                  )}
                  {visible.map((c, i) => (
                    <Draggable
                      key={c.id}
                      draggableId={c.id}
                      index={i}
                      isDragDisabled={filtering}
                    >
                      {(prov, snapshot) => (
                        <div
                          ref={prov.innerRef}
                          {...prov.draggableProps}
                          onClick={() => openEdit(c)}
                          className={`${GRID} group min-h-[46px] cursor-pointer border-b border-paper-border/70 px-2 py-1.5 transition last:border-b-0 ${
                            snapshot.isDragging
                              ? "rounded-lg border border-brand-300 bg-white shadow-float"
                              : "bg-white hover:bg-paper-block/40"
                          }`}
                        >
                          {/* 拖曳把手 */}
                          <span
                            {...prov.dragHandleProps}
                            onClick={(e) => e.stopPropagation()}
                            className={`flex justify-center text-paper-muted/50 ${
                              filtering
                                ? "cursor-not-allowed opacity-30"
                                : "cursor-grab hover:text-paper-muted active:cursor-grabbing"
                            }`}
                            title={filtering ? "篩選中無法拖曳" : "拖曳排序"}
                            aria-label="拖曳排序"
                          >
                            <GripVertical size={15} />
                          </span>

                          <span className="truncate text-sm font-medium text-paper-text">
                            {c.name || (
                              <span className="text-paper-muted">
                                （未命名）
                              </span>
                            )}
                          </span>

                          {/* 儲存格的值皆可點擊 → 即套用/取消該值的篩選 */}
                          <span className="flex flex-wrap gap-1 py-0.5">
                            {professionTokens(c.profession).length > 0 ? (
                              professionTokens(c.profession).map((t) => (
                                <button
                                  key={t}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProf(t);
                                  }}
                                  className={`rounded bg-paper-block px-1.5 py-0.5 text-[11px] text-paper-muted transition hover:bg-paper-border hover:text-paper-text ${
                                    profFilter === t
                                      ? "ring-1 ring-brand-500"
                                      : ""
                                  }`}
                                  title={`篩選職業別：${t}`}
                                >
                                  {t}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-paper-muted/60">
                                –
                              </span>
                            )}
                          </span>

                          <span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCoop(c.cooperationType);
                              }}
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition hover:brightness-95 ${COOP_META[c.cooperationType].chip} ${
                                coopFilter === c.cooperationType
                                  ? "ring-1 ring-brand-500"
                                  : ""
                              }`}
                              title={`篩選合作方向：${COOP_META[c.cooperationType].label}`}
                            >
                              {COOP_META[c.cooperationType].label}
                            </button>
                          </span>

                          <span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStatus(c.status);
                              }}
                              className={`rounded px-1.5 py-0.5 text-xs transition hover:bg-paper-block ${
                                c.status === "unknown"
                                  ? "text-paper-muted/60"
                                  : "text-paper-text"
                              } ${
                                statusFilter === c.status
                                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                                  : ""
                              }`}
                              title={`篩選狀態：${c.status === "unknown" ? "未知" : STATUS_META[c.status]}`}
                            >
                              {STATUS_META[c.status]}
                            </button>
                          </span>

                          {(["familiarity", "ability", "price"] as const).map(
                            (key) => (
                              <span key={key} className="text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLevel(key, c[key]);
                                  }}
                                  className={`inline-block min-w-[24px] rounded px-1 py-0.5 text-[11px] font-medium transition hover:brightness-95 ${LEVEL_META[c[key]].chip} ${
                                    levelFilter?.key === key &&
                                    levelFilter.value === c[key]
                                      ? "ring-1 ring-brand-500"
                                      : ""
                                  }`}
                                  title={`篩選${LEVEL_FIELD_LABEL[key]}：${levelText(c[key])}`}
                                >
                                  {LEVEL_META[c[key]].label}
                                </button>
                              </span>
                            ),
                          )}

                          {/* 備註：直接呈現，最多兩行 (完整內容進列點開的 Modal) */}
                          <span
                            className="line-clamp-2 whitespace-pre-line break-words py-0.5 text-xs leading-4 text-paper-muted"
                            title={c.note || undefined}
                          >
                            {c.note}
                          </span>

                          {/* Hover 顯示：在此列下方插入 */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreate(c.id);
                            }}
                            className="flex h-7 w-7 items-center justify-center justify-self-center rounded-md text-paper-muted transition hover:bg-brand-50 hover:text-brand-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                            title="在此列下方插入聯絡人"
                            aria-label={`在 ${c.name || "此列"} 下方插入聯絡人`}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {dropProv.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>

      {/* ── 編輯 / 新增 Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper-text/40 p-4 backdrop-blur-sm"
          onClick={() => closeModal()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-paper-border bg-white p-5 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-paper-text">
                  {modal.mode === "edit" ? "編輯聯絡人" : "新增聯絡人"}
                </h3>
                {modal.mode === "create" && afterContact && (
                  <p className="text-xs text-paper-muted">
                    將插入於「{afterContact.name || "未命名"}」下方
                  </p>
                )}
              </div>
              <button
                onClick={() => closeModal()}
                className="rounded-lg p-1.5 text-paper-muted transition hover:bg-paper-block hover:text-paper-text"
                aria-label="關閉"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">姓名</label>
                <input
                  className="field-input"
                  placeholder="姓名"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={modal.mode === "create"}
                />
              </div>
              <div>
                <label className="field-label">職業別（逗號分隔可多個）</label>
                <input
                  className="field-input"
                  placeholder="如：Notion, 網站設計師"
                  value={draft.profession}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, profession: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="field-label">聯絡方式 (Line / IG / Email)</label>
                <input
                  className="field-input"
                  placeholder="如：Line: xxx、IG: @xxx"
                  value={draft.contactInfo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, contactInfo: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="field-label">網址</label>
                <div className="flex gap-2">
                  <input
                    className="field-input min-w-0 flex-1"
                    placeholder="https://…"
                    value={draft.url}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, url: e.target.value }))
                    }
                  />
                  {/^https?:\/\//.test(draft.url) && (
                    <a
                      href={draft.url.split(/\s/)[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost shrink-0 px-3"
                      title="開啟網址"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label">匯款資訊（支付外包款用）</label>
                <input
                  className="field-input"
                  placeholder="如：台新 812 / 帳號 xxxxxxxxx"
                  value={draft.transferInfo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, transferInfo: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* 評級 (熟悉度 / 喜好度 / 能力值 / 價格) */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {(
                [
                  ["familiarity", "熟悉度"],
                  ["liking", "喜好度"],
                  ["ability", "能力值"],
                  ["price", "價格"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="field-label">{label}</label>
                  <select
                    className="field-input"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [key]: e.target.value as ContactLevel,
                      }))
                    }
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                    <option value="unknown">不確定</option>
                  </select>
                </div>
              ))}
            </div>

            {/* 狀態 + 合作方向 */}
            <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
              <div>
                <label className="field-label">狀態</label>
                <select
                  className="field-input w-auto min-w-[110px]"
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value as ContactStatus,
                    }))
                  }
                >
                  <option value="employed">就業</option>
                  <option value="freelance">接案</option>
                  <option value="startup">創業</option>
                  <option value="student">學生</option>
                  <option value="unknown">未知</option>
                </select>
              </div>
              <div>
                <label className="field-label">合作方向</label>
                <div className="inline-flex rounded-lg border border-paper-border p-0.5">
                  {(["project", "industry"] as CooperationType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        setDraft((d) => ({ ...d, cooperationType: t }))
                      }
                      className={`min-h-[36px] rounded-md px-3 py-1 text-sm transition ${
                        draft.cooperationType === t
                          ? "bg-brand-600 text-white"
                          : "text-paper-muted hover:text-paper-text"
                      }`}
                      title={COOP_META[t].hint}
                    >
                      {COOP_META[t].label}
                    </button>
                  ))}
                </div>
                <span className="ml-2 align-middle text-xs text-paper-muted">
                  {COOP_META[draft.cooperationType].hint}
                </span>
              </div>
            </div>

            {/* 備註 */}
            <div className="mt-4">
              <label className="field-label">備註</label>
              <textarea
                className="field-input min-h-[100px] resize-y"
                placeholder="合作紀錄、報價習慣、介紹人…"
                value={draft.note}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, note: e.target.value }))
                }
              />
            </div>

            <div className="mt-5 flex items-center justify-between">
              {modal.mode === "edit" ? (
                <button
                  onClick={() => remove(modal.id)}
                  className="btn-danger"
                  disabled={saving}
                >
                  <Trash2 size={16} /> 刪除
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => closeModal()} className="btn-ghost">
                  取消
                </button>
                <button
                  onClick={save}
                  disabled={saving || (modal.mode === "edit" && !dirty)}
                  className="btn-primary"
                >
                  <Save size={16} />
                  {modal.mode === "edit" ? (dirty ? "儲存" : "已儲存") : "新增"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float sm:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
