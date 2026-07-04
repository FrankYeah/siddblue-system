"use client";

import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  ArrowLeft,
  Briefcase,
  BellRing,
  Link2,
  Users,
} from "lucide-react";
import { computeCaseFinance } from "@/lib/finance";
import { formatNT } from "@/lib/format";
import type {
  Case,
  CaseInput,
  CaseType,
  Contact,
  PartnerPayStatus,
  QuoteSummary,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────
//  💼 案件與財務管理 (Case & Finance Management)
//  應收帳款 (催款提醒) + 合作夥伴費用 (外包成本) + 稅務代扣 → 淨利
//  左列表 + 右編輯 (手機單欄切換)，persist 模式仿 NotesBoard
// ─────────────────────────────────────────────────────────────

const EMPTY_DRAFT: CaseInput = {
  name: "",
  caseType: "own",
  quoteId: "",
  totalAmount: 0,
  receivedAmount: 0,
  withholdBusinessTax: false,
  withholdIncomeTax: false,
  partnerCosts: [],
  note: "",
};

const CASE_TYPE_META: Record<CaseType, { label: string; hint: string }> = {
  own: { label: "💼 我接的案子", hint: "一般接案，無稅務代扣" },
  invoice: {
    label: "🧾 幫朋友開發票",
    hint: "代開發票：代扣 5% 營業稅、代收代扣 3% 營所稅",
  },
};

const PAY_STATUS_META: Record<
  PartnerPayStatus,
  { label: string; badge: string }
> = {
  unpaid: { label: "未支付", badge: "bg-red-100 text-red-700" },
  deposit: { label: "已付訂金", badge: "bg-amber-100 text-amber-700" },
  paid: { label: "已結清", badge: "bg-emerald-100 text-emerald-700" },
};

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 以 UTC+8 手動格式化 (只用 getUTC*)，確保 SSR 與客戶端逐字元一致
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(
    t.getUTCHours(),
  )}:${p(t.getUTCMinutes())}`;
}

function caseToDraft(c: Case): CaseInput {
  return {
    name: c.name,
    caseType: c.caseType,
    quoteId: c.quoteId,
    totalAmount: c.totalAmount,
    receivedAmount: c.receivedAmount,
    withholdBusinessTax: c.withholdBusinessTax,
    withholdIncomeTax: c.withholdIncomeTax,
    partnerCosts: c.partnerCosts.map((p) => ({ ...p })),
    note: c.note,
  };
}

export default function CasesBoard({
  initialCases,
  quotes,
  contacts,
  searchQuery = "",
}: {
  initialCases: Case[];
  /** 供「關聯報價單」下拉選擇 (自動帶入名稱與總金額) */
  quotes: QuoteSummary[];
  /** 🤝 人脈庫聯絡人：夥伴名稱自動建議 + 帶出匯款資訊 */
  contacts: Contact[];
  /** 全域搜尋框（AdminWorkspace）傳入的關鍵字 */
  searchQuery?: string;
}) {
  const [cases, setCases] = useState<Case[]>(initialCases);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CaseInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [toast, setToast] = useState("");

  /** 夥伴名稱 → 人脈庫聯絡人 (完全同名才視為對應) */
  function contactByName(name: string): Contact | undefined {
    const n = name.trim();
    if (!n) return undefined;
    return contacts.find((ct) => ct.name === n);
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  const selected = cases.find((c) => c.id === selectedId) ?? null;

  // 🔔 催款提醒：所有「有未收款餘額」的案件 (金額大 → 小)
  const unpaidCases = useMemo(
    () =>
      cases
        .map((c) => ({ c, fin: computeCaseFinance(c) }))
        .filter(({ fin }) => fin.unpaidBalance > 0)
        .sort((a, b) => b.fin.unpaidBalance - a.fin.unpaidBalance),
    [cases],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q) ||
        c.partnerCosts.some(
          (p) =>
            p.partnerName.toLowerCase().includes(q) ||
            p.role.toLowerCase().includes(q),
        ),
    );
  }, [cases, searchQuery]);

  // 編輯區的即時財務分解 (打字即更新)
  const fin = computeCaseFinance(draft);

  const dirty = selected
    ? JSON.stringify(caseToDraft(selected)) !== JSON.stringify(draft)
    : false;

  function selectCase(c: Case) {
    setSelectedId(c.id);
    setDraft(caseToDraft(c));
  }

  async function newCase(type: CaseType) {
    setSaving(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...EMPTY_DRAFT,
          caseType: type,
          // 代開發票預設開啟兩項代扣 (可再取消)；自接案無稅務代扣
          withholdBusinessTax: type === "invoice",
          withholdIncomeTax: type === "invoice",
        }),
      });
      if (!res.ok) throw new Error();
      const { case: record } = (await res.json()) as { case: Case };
      setCases((cs) => [record, ...cs]);
      selectCase(record);
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
      const res = await fetch(`/api/cases/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const { case: record } = (await res.json()) as { case: Case };
      setCases((cs) => cs.map((c) => (c.id === record.id ? record : c)));
      setDraft(caseToDraft(record));
      flash("已儲存");
    } catch {
      flash("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("確定刪除這個案件？此動作無法復原。")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCases((cs) => cs.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
      flash("已刪除");
    } catch {
      flash("刪除失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  /** 切換案件型態：自接案 ↔ 代開發票 (稅務代扣只屬於代開發票) */
  function setCaseType(t: CaseType) {
    setDraft((d) => {
      if (d.caseType === t) return d;
      return {
        ...d,
        caseType: t,
        withholdBusinessTax: t === "invoice",
        withholdIncomeTax: t === "invoice",
      };
    });
  }

  /** 關聯報價單：自動帶入專案名稱與總金額 (快照，可再修改) */
  function linkQuote(quoteId: string) {
    if (!quoteId) {
      setDraft((d) => ({ ...d, quoteId: "" }));
      return;
    }
    const q = quotes.find((x) => x.id === quoteId);
    setDraft((d) => ({
      ...d,
      quoteId,
      name: q ? q.clientName : d.name,
      totalAmount: q ? q.total : d.totalAmount,
    }));
  }

  function addPartnerCost() {
    setDraft((d) => ({
      ...d,
      partnerCosts: [
        ...d.partnerCosts,
        {
          id: nanoid(10),
          partnerName: "",
          role: "",
          amount: 0,
          paidAmount: 0,
          payStatus: "unpaid" as PartnerPayStatus,
        },
      ],
    }));
  }

  function patchPartnerCost(
    id: string,
    patch: Partial<CaseInput["partnerCosts"][number]>,
  ) {
    setDraft((d) => ({
      ...d,
      partnerCosts: d.partnerCosts.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  }

  function removePartnerCost(id: string) {
    setDraft((d) => ({
      ...d,
      partnerCosts: d.partnerCosts.filter((p) => p.id !== id),
    }));
  }

  /** 金額輸入：空字串顯示 placeholder 0，輸入即轉數字 */
  function amountValue(n: number) {
    return n === 0 ? "" : n;
  }
  function parseAmount(v: string) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">💼 案件管理</h2>
          <p className="text-sm text-paper-muted">
            應收帳款、合作夥伴費用與稅務代扣，自動算出每個專案的實際淨利。
          </p>
        </div>
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-paper-muted">
            <Loader2 size={13} className="animate-spin" /> 儲存中
          </span>
        )}
      </div>

      {/* 🔔 催款提醒：有未收款餘額的案件 */}
      {unpaidCases.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-amber-800">
            <BellRing size={16} />
            催款提醒：{unpaidCases.length} 個案件尚有未收款，合計{" "}
            {formatNT(
              unpaidCases.reduce((sum, u) => sum + u.fin.unpaidBalance, 0),
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {unpaidCases.map(({ c, fin: f }) => (
              <li key={c.id}>
                <button
                  onClick={() => selectCase(c)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-left text-sm transition hover:bg-white"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-paper-text">
                    {c.name || "（未命名案件）"}
                  </span>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    未收 {formatNT(f.unpaidBalance)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="md:grid md:grid-cols-[300px_minmax(0,1fr)] md:gap-5">
        {/* ───────── 左側：案件列表 ───────── */}
        <aside className={selectedId ? "hidden md:block" : "block"}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm text-paper-muted">
              共 {filtered.length} 個案件
            </span>
            {/* 新增時先選型態：自接案 / 代開發票 (決定是否有稅務代扣) */}
            <div className="relative shrink-0">
              <button
                onClick={() => setAddMenu((v) => !v)}
                aria-expanded={addMenu}
                className="btn-primary px-3"
                title="新增案件"
              >
                <Plus size={18} />
              </button>
              {addMenu && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-paper-border bg-white p-1 shadow-float">
                  {(Object.keys(CASE_TYPE_META) as CaseType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setAddMenu(false);
                        newCase(t);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-paper-block"
                    >
                      <span className="block text-sm font-medium text-paper-text">
                        {CASE_TYPE_META[t].label}
                      </span>
                      <span className="block text-[11px] text-paper-muted">
                        {CASE_TYPE_META[t].hint}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ul className="space-y-2">
            {filtered.length === 0 && (
              <li className="rounded-lg border border-dashed border-paper-border px-3 py-8 text-center text-sm text-paper-muted">
                {cases.length === 0
                  ? "還沒有案件，按 ＋ 新增第一個。"
                  : "沒有符合的案件。"}
              </li>
            )}
            {filtered.map((c) => {
              const f = computeCaseFinance(c);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => selectCase(c)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedId === c.id
                        ? "border-brand-300 bg-brand-50"
                        : "border-paper-border bg-white hover:border-brand-200 hover:bg-paper-block/40"
                    }`}
                  >
                    <div className="whitespace-normal break-words text-sm font-medium text-paper-text">
                      {c.name || (
                        <span className="text-paper-muted">（未命名案件）</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {c.caseType === "invoice" && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">
                          🧾 代開發票
                        </span>
                      )}
                      <span className="rounded bg-paper-block px-1.5 py-0.5 text-paper-muted">
                        {formatNT(f.totalAmount)}
                      </span>
                      {f.unpaidBalance > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                          未收 {formatNT(f.unpaidBalance)}
                        </span>
                      ) : (
                        f.totalAmount > 0 && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                            已收齊
                          </span>
                        )
                      )}
                      {c.partnerCosts.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-paper-block px-1.5 py-0.5 text-paper-muted">
                          <Users size={11} /> {c.partnerCosts.length}
                        </span>
                      )}
                      <span className="text-paper-muted">
                        {fmt(c.updatedAt)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
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
                placeholder="專案名稱"
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />

              {/* (a) 報價單關聯 */}
              <div className="mb-4">
                <label className="field-label">
                  <Link2 size={13} className="mr-1 inline" />
                  關聯報價單（選擇後自動帶入專案名稱與總金額）
                </label>
                <select
                  className="field-input"
                  value={draft.quoteId}
                  onChange={(e) => linkQuote(e.target.value)}
                >
                  <option value="">— 不關聯 —</option>
                  {quotes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.clientName || "（未命名報價單）"}｜{formatNT(q.total)}｜
                      {q.quoteDate}
                    </option>
                  ))}
                </select>
              </div>

              {/* (b) 應收帳款 */}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="field-label">總金額 (應收)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="field-input"
                    placeholder="0"
                    value={amountValue(draft.totalAmount)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        totalAmount: parseAmount(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="field-label">已收款</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="field-input"
                    placeholder="0"
                    value={amountValue(draft.receivedAmount)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        receivedAmount: parseAmount(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="field-label">未收款餘額（自動）</label>
                  <div
                    className={`flex min-h-[42px] items-center rounded-lg border px-3 text-sm font-semibold ${
                      fin.unpaidBalance > 0
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {formatNT(fin.unpaidBalance)}
                  </div>
                </div>
              </div>

              {/* 案件型態：自接案 / 代開發票 (只有代開發票才有稅務代扣) */}
              <div className="mb-4">
                <label className="field-label">案件型態</label>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-paper-border p-0.5">
                    {(Object.keys(CASE_TYPE_META) as CaseType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setCaseType(t)}
                        className={`min-h-[38px] rounded-md px-3 py-1 text-sm transition ${
                          draft.caseType === t
                            ? "bg-brand-600 text-white"
                            : "text-paper-muted hover:text-paper-text"
                        }`}
                        title={CASE_TYPE_META[t].hint}
                      >
                        {CASE_TYPE_META[t].label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-paper-muted">
                    {CASE_TYPE_META[draft.caseType].hint}
                  </span>
                </div>
              </div>

              {/* (d) 稅務代扣開關 — 僅「幫朋友開發票」型顯示 */}
              {draft.caseType === "invoice" && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {(
                    [
                      ["withholdBusinessTax", "代扣 5% 營業稅"],
                      ["withholdIncomeTax", "代收代扣 3% 營所稅"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        draft[key]
                          ? "border-brand-300 bg-brand-50 text-brand-700"
                          : "border-paper-border text-paper-muted hover:bg-paper-block/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={draft[key]}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [key]: e.target.checked }))
                        }
                        className="h-4 w-4 accent-brand-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}

              {/* (c) 合作夥伴費用 (外包成本) */}
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-paper-muted">
                    合作夥伴費用（外包成本）
                  </span>
                  <button onClick={addPartnerCost} className="btn-ghost text-sm">
                    <Plus size={15} /> 新增
                  </button>
                </div>
                {draft.partnerCosts.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-paper-border px-3 py-4 text-center text-sm text-paper-muted">
                    尚無外包成本。
                  </p>
                ) : (
                  <div className="space-y-2">
                    {draft.partnerCosts.map((p) => (
                      <div
                        key={p.id}
                        className="relative rounded-lg border border-paper-border bg-paper-block/30 p-3"
                      >
                        <button
                          onClick={() => removePartnerCost(p.id)}
                          className="absolute right-2 top-2 rounded-md p-1.5 text-paper-muted transition hover:bg-red-50 hover:text-red-600"
                          title="移除此筆"
                          aria-label="移除此筆外包成本"
                        >
                          <Trash2 size={14} />
                        </button>
                        <div className="grid grid-cols-2 gap-2 pr-8 sm:grid-cols-5 sm:pr-9">
                          <div>
                            <label className="field-label text-xs">
                              夥伴名稱
                            </label>
                            <input
                              className="field-input"
                              placeholder="輸入即搜尋人脈庫…"
                              list="partner-contacts-list"
                              value={p.partnerName}
                              onChange={(e) =>
                                patchPartnerCost(p.id, {
                                  partnerName: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="field-label text-xs">
                              負責項目
                            </label>
                            <input
                              className="field-input"
                              placeholder="如：前端、設計"
                              value={p.role}
                              onChange={(e) =>
                                patchPartnerCost(p.id, { role: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="field-label text-xs">
                              應付金額
                            </label>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              className="field-input"
                              placeholder="0"
                              value={amountValue(p.amount)}
                              onChange={(e) =>
                                patchPartnerCost(p.id, {
                                  amount: parseAmount(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="field-label text-xs">
                              已付金額
                            </label>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              className="field-input"
                              placeholder="0"
                              value={amountValue(p.paidAmount)}
                              onChange={(e) =>
                                patchPartnerCost(p.id, {
                                  paidAmount: parseAmount(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="field-label text-xs">
                              付款狀態
                            </label>
                            <select
                              className="field-input"
                              value={p.payStatus}
                              onChange={(e) =>
                                patchPartnerCost(p.id, {
                                  payStatus: e.target
                                    .value as PartnerPayStatus,
                                })
                              }
                            >
                              {(
                                Object.keys(
                                  PAY_STATUS_META,
                                ) as PartnerPayStatus[]
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {PAY_STATUS_META[s].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${PAY_STATUS_META[p.payStatus].badge}`}
                          >
                            {PAY_STATUS_META[p.payStatus].label}
                          </span>
                          {/* 訂金/分期：顯示剩餘應付，一眼看出還欠夥伴多少 */}
                          {p.payStatus !== "paid" && p.paidAmount > 0 && (
                            <span className="text-[11px] text-amber-700">
                              已付 {formatNT(Math.min(p.paidAmount, p.amount))}
                              ・未付{" "}
                              {formatNT(
                                Math.max(p.amount - p.paidAmount, 0),
                              )}
                            </span>
                          )}
                          {/* 名稱對到人脈庫時，帶出匯款/聯絡資訊，付款免翻頁 */}
                          {(() => {
                            const m = contactByName(p.partnerName);
                            if (!m) return null;
                            return (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-paper-muted"
                                title={`已對應人脈庫：${m.name}`}
                              >
                                <Link2 size={11} className="text-brand-500" />
                                {m.transferInfo
                                  ? `匯款：${m.transferInfo}`
                                  : m.contactInfo || "人脈庫聯絡人"}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 備註 */}
              <div className="mb-4">
                <label className="field-label">備註</label>
                <textarea
                  className="field-input min-h-[60px] resize-y"
                  placeholder="付款約定、發票開立、其他提醒…"
                  value={draft.note}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, note: e.target.value }))
                  }
                />
              </div>

              {/* 財務摘要：實際淨利 */}
              <div className="mb-5 rounded-xl border border-paper-border bg-paper-block/40 p-4">
                <div className="text-sm font-semibold text-paper-text">
                  財務摘要
                </div>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-paper-muted">總應收金額</dt>
                    <dd className="font-medium">{formatNT(fin.totalAmount)}</dd>
                  </div>
                  {fin.businessTax > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-paper-muted">代扣 5% 營業稅</dt>
                      <dd className="text-red-600">
                        − {formatNT(fin.businessTax)}
                      </dd>
                    </div>
                  )}
                  {fin.incomeTax > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-paper-muted">代扣 3% 營所稅</dt>
                      <dd className="text-red-600">
                        − {formatNT(fin.incomeTax)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-paper-muted">
                      合作夥伴費用（{draft.partnerCosts.length} 筆）
                    </dt>
                    <dd className="text-red-600">
                      − {formatNT(fin.partnerTotal)}
                    </dd>
                  </div>
                  {fin.partnerOutstanding > 0 && (
                    <div className="flex justify-between text-xs">
                      <dt className="text-paper-muted">
                        └ 已付 {formatNT(fin.partnerPaid)}，尚未結清
                      </dt>
                      <dd className="text-amber-700">
                        {formatNT(fin.partnerOutstanding)}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-paper-border pt-2">
                    <dt className="font-semibold text-paper-text">
                      實際淨利 (Net Profit)
                    </dt>
                    <dd
                      className={`text-lg font-bold ${
                        fin.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatNT(fin.netProfit)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex items-center justify-between">
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
              <Briefcase size={32} className="mb-3 text-paper-border" />
              <p className="text-sm text-paper-muted">
                從左側選擇一個案件，或按 ＋ 新增。
              </p>
            </div>
          )}
        </section>
      </div>

      {/* 夥伴名稱自動完成：人脈庫全部聯絡人 (原生 datalist，仍可自由填寫) */}
      <datalist id="partner-contacts-list">
        {contacts.map((ct) =>
          ct.name ? <option key={ct.id} value={ct.name} /> : null,
        )}
      </datalist>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float sm:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
