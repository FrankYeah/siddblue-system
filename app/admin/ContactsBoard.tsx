"use client";

import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  ArrowLeft,
  Upload,
  ExternalLink,
  UserRound,
} from "lucide-react";
import { parseContactsCsv } from "@/lib/contacts-csv";
import type {
  Contact,
  ContactInput,
  ContactLevel,
  ContactStatus,
  CooperationType,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────
//  🤝 人脈資料庫 (Connections CRM)
//  CRUD + CSV 整批匯入；左列表 + 右編輯 (手機單欄切換)
// ─────────────────────────────────────────────────────────────

const EMPTY_DRAFT: ContactInput = {
  name: "",
  profession: "",
  contactInfo: "",
  url: "",
  familiarity: "medium",
  ability: "medium",
  price: "medium",
  status: "freelance",
  cooperationType: "project",
  note: "",
};

const LEVEL_META: Record<ContactLevel, { label: string; chip: string }> = {
  high: { label: "高", chip: "bg-emerald-100 text-emerald-700" },
  medium: { label: "中", chip: "bg-amber-100 text-amber-700" },
  low: { label: "低", chip: "bg-paper-block text-paper-muted" },
};

const STATUS_META: Record<ContactStatus, string> = {
  employed: "就業",
  freelance: "接案",
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

function contactToDraft(c: Contact): ContactInput {
  return {
    name: c.name,
    profession: c.profession,
    contactInfo: c.contactInfo,
    url: c.url,
    familiarity: c.familiarity,
    ability: c.ability,
    price: c.price,
    status: c.status,
    cooperationType: c.cooperationType,
    note: c.note,
  };
}

export default function ContactsBoard({
  initialContacts,
  searchQuery = "",
}: {
  initialContacts: Contact[];
  /** 全域搜尋框（AdminWorkspace）傳入的關鍵字 */
  searchQuery?: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContactInput>(EMPTY_DRAFT);
  const [coopFilter, setCoopFilter] = useState<CooperationType | "all">("all");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  }

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      if (coopFilter !== "all" && c.cooperationType !== coopFilter)
        return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.profession.toLowerCase().includes(q) ||
        c.contactInfo.toLowerCase().includes(q) ||
        c.url.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q)
      );
    });
  }, [contacts, coopFilter, searchQuery]);

  const dirty = selected
    ? JSON.stringify(contactToDraft(selected)) !== JSON.stringify(draft)
    : false;

  function selectContact(c: Contact) {
    setSelectedId(c.id);
    setDraft(contactToDraft(c));
  }

  async function newContact() {
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(EMPTY_DRAFT),
      });
      if (!res.ok) throw new Error();
      const { contact } = (await res.json()) as { contact: Contact };
      setContacts((cs) => [contact, ...cs]);
      selectContact(contact);
    } catch {
      flash("建立失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function persist() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const { contact } = (await res.json()) as { contact: Contact };
      setContacts((cs) => cs.map((c) => (c.id === contact.id ? contact : c)));
      setDraft(contactToDraft(contact));
      flash("已儲存");
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
      setContacts((cs) => cs.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
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
      // 伺服器依 CSV 順序遞增時間戳，列表為新→舊，故倒序放最前
      setContacts((cs) => [...created.slice().reverse(), ...cs]);
      flash(`已匯入 ${created.length} 位聯絡人`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "匯入失敗，請確認 CSV 格式");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = ""; // 允許重選同一檔案
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">🤝 人脈庫</h2>
          <p className="text-sm text-paper-muted">
            合作夥伴與業界人脈：熟悉度、能力、價位與合作方向一目了然。
          </p>
        </div>
        {(saving || importing) && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" />
            {importing ? "匯入中" : "儲存中"}
          </span>
        )}
      </div>

      <div className="md:grid md:grid-cols-[320px_minmax(0,1fr)] md:gap-5">
        {/* ───────── 左側：聯絡人列表 ───────── */}
        <aside className={selectedId ? "hidden md:block" : "block"}>
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="btn-ghost flex-1 text-sm"
              title="第一列為表頭：姓名、職業別、聯絡方式、網址、熟悉度、能力值、價格、狀態、合作方向、備註（欄位順序不拘、可缺欄）"
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
            <button
              onClick={newContact}
              className="btn-primary shrink-0 px-3"
              title="新增聯絡人"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* 合作方向篩選 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
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
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  coopFilter === key
                    ? "bg-brand-600 text-white"
                    : "bg-paper-block text-paper-muted hover:bg-paper-border"
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-paper-muted">
              共 {filtered.length} 位
            </span>
          </div>

          <ul className="space-y-2">
            {filtered.length === 0 && (
              <li className="rounded-lg border border-dashed border-paper-border px-3 py-8 text-center text-sm text-paper-muted">
                {contacts.length === 0
                  ? "還沒有聯絡人，按 ＋ 新增或匯入 CSV。"
                  : "沒有符合的聯絡人。"}
              </li>
            )}
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => selectContact(c)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedId === c.id
                      ? "border-brand-300 bg-brand-50"
                      : "border-paper-border bg-white hover:border-brand-200 hover:bg-paper-block/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-paper-text">
                      {c.name || "（未命名）"}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${COOP_META[c.cooperationType].chip}`}
                    >
                      {COOP_META[c.cooperationType].label}
                    </span>
                  </div>
                  {c.profession && (
                    <div className="mt-0.5 truncate text-xs text-paper-muted">
                      {c.profession}
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                    <span
                      className={`rounded px-1.5 py-0.5 ${LEVEL_META[c.familiarity].chip}`}
                    >
                      熟悉 {LEVEL_META[c.familiarity].label}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 ${LEVEL_META[c.ability].chip}`}
                    >
                      能力 {LEVEL_META[c.ability].label}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 ${LEVEL_META[c.price].chip}`}
                    >
                      價格 {LEVEL_META[c.price].label}
                    </span>
                    <span className="rounded bg-paper-block px-1.5 py-0.5 text-paper-muted">
                      {STATUS_META[c.status]}
                    </span>
                  </div>
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
                  />
                </div>
                <div>
                  <label className="field-label">職業別</label>
                  <input
                    className="field-input"
                    placeholder="如：Notion、前端工程師"
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
                        href={draft.url}
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
              </div>

              {/* 評級 (熟悉度 / 能力值 / 價格) */}
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                {(
                  [
                    ["familiarity", "熟悉度"],
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
                    </select>
                  </div>
                ))}
              </div>

              {/* 狀態 + 合作方向 */}
              <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
                <div>
                  <label className="field-label">狀態</label>
                  <div className="inline-flex rounded-lg border border-paper-border p-0.5">
                    {(["employed", "freelance"] as ContactStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setDraft((d) => ({ ...d, status: s }))}
                        className={`min-h-[36px] rounded-md px-3 py-1 text-sm transition ${
                          draft.status === s
                            ? "bg-brand-600 text-white"
                            : "text-paper-muted hover:text-paper-text"
                        }`}
                      >
                        {STATUS_META[s]}
                      </button>
                    ))}
                  </div>
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
                  className="field-input min-h-[80px] resize-y"
                  placeholder="合作紀錄、報價習慣、介紹人…"
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, note: e.target.value }))
                  }
                />
              </div>

              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={() => remove(selected.id)}
                  className="btn-danger"
                >
                  <Trash2 size={16} /> 刪除
                </button>
                <button
                  onClick={persist}
                  disabled={!dirty || saving}
                  className="btn-primary"
                >
                  <Save size={16} /> {dirty ? "儲存" : "已儲存"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-paper-border text-center">
              <UserRound size={32} className="mb-3 text-paper-border" />
              <p className="text-sm text-paper-muted">
                從左側選擇一位聯絡人，或按 ＋ 新增、匯入 CSV。
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
