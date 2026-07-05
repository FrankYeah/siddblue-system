"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Briefcase,
  BellRing,
  HandCoins,
  Link2,
  Users,
  X,
  ChevronDown,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  computeCaseFinance,
  collectPartnerDues,
  partnerCostPaid,
} from "@/lib/finance";
import { formatNT, formatCurrency } from "@/lib/format";
import type {
  Case,
  CaseInput,
  CaseType,
  Contact,
  PartnerCost,
  PartnerPayStatus,
  PaymentEntry,
  QuoteSummary,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────
//  💼 案件與財務管理 (Case & Finance Management)
//  Notion 風格資料表：多數資訊 (含備註) 直接顯示，點列彈出 Modal 編輯。
//  應收帳款 (催款提醒) + 合作夥伴費用 (外包成本) + 稅務代扣 → 淨利
// ─────────────────────────────────────────────────────────────

const EMPTY_DRAFT: CaseInput = {
  name: "",
  caseType: "own",
  quoteId: "",
  totalAmount: 0,
  receivedAmount: 0,
  receivedPayments: [],
  withholdBusinessTax: false,
  withholdIncomeTax: false,
  partnerCosts: [],
  note: "",
};

const CASE_TYPE_META: Record<
  CaseType,
  { label: string; short: string; hint: string; chip: string }
> = {
  own: {
    label: "💼 我接的案子",
    short: "接案",
    hint: "一般接案，無稅務代扣",
    chip: "bg-paper-block text-paper-muted",
  },
  invoice: {
    label: "🧾 幫朋友開發票",
    short: "🧾 代開發票",
    hint: "代開發票：代扣 5% 營業稅、代收代扣 3% 營所稅",
    chip: "bg-violet-100 text-violet-700",
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

/** 資料表欄位樣板 (表頭與每一列共用)：
    名稱 / 型態 / 總金額 / 已收 / 未收 / 淨利 / 夥伴 / 備註 */
const GRID =
  "grid grid-cols-[minmax(120px,1.3fr)_84px_96px_96px_100px_108px_minmax(110px,1fr)_minmax(150px,1.5fr)] items-center gap-x-3";

function caseToDraft(c: Case): CaseInput {
  return {
    name: c.name,
    caseType: c.caseType,
    quoteId: c.quoteId,
    totalAmount: c.totalAmount,
    receivedAmount: c.receivedAmount,
    receivedPayments: c.receivedPayments.map((e) => ({ ...e })),
    withholdBusinessTax: c.withholdBusinessTax,
    withholdIncomeTax: c.withholdIncomeTax,
    partnerCosts: c.partnerCosts.map((p) => ({
      ...p,
      payments: p.payments.map((e) => ({ ...e })),
    })),
    note: c.note,
  };
}

// ─────────────────────────────────────────────────────────────
//  收/付款紀錄 (Payment Ledger)：取代單一數字，逐筆記錄日期＋金額＋備註。
//  case 收款與夥伴付款共用同一元件；onChange 回傳新陣列，呼叫端自行加總。
// ─────────────────────────────────────────────────────────────
function PaymentLedger({
  entries,
  onChange,
  addLabel,
}: {
  entries: PaymentEntry[];
  onChange: (next: PaymentEntry[]) => void;
  addLabel: string;
}) {
  function add() {
    onChange([
      ...entries,
      {
        id: nanoid(10),
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        note: "",
      },
    ]);
  }
  function patch(id: string, patch: Partial<PaymentEntry>) {
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function remove(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }
  const total = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div>
      {entries.length > 0 && (
        <div className="mb-1.5 space-y-1.5">
          {entries
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <div key={e.id} className="flex items-center gap-1.5">
                <input
                  type="date"
                  className="field-input min-w-0 flex-[1.2] text-xs"
                  value={e.date}
                  onChange={(ev) => patch(e.id, { date: ev.target.value })}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="field-input min-w-0 flex-1 text-xs"
                  placeholder="金額"
                  value={e.amount === 0 ? "" : e.amount}
                  onChange={(ev) => {
                    const n = Number(ev.target.value);
                    patch(e.id, {
                      amount: Number.isFinite(n) && n > 0 ? Math.round(n) : 0,
                    });
                  }}
                />
                <input
                  className="field-input min-w-0 flex-[1.4] text-xs"
                  placeholder="備註（如：頭期款）"
                  value={e.note}
                  onChange={(ev) => patch(e.id, { note: ev.target.value })}
                />
                <button
                  onClick={() => remove(e.id)}
                  className="shrink-0 rounded-md p-1.5 text-paper-muted transition hover:bg-red-50 hover:text-red-600"
                  title="移除此筆紀錄"
                  aria-label="移除此筆紀錄"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <button
          onClick={add}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition hover:text-brand-700"
        >
          <Plus size={13} /> {addLabel}
        </button>
        <span className="text-xs text-paper-muted">
          合計{" "}
          <span className="font-semibold text-paper-text">
            {formatNT(total)}
          </span>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  夥伴選擇器：可搜尋的人脈庫下拉 + 保留名單外自由填寫 + 連過去看詳情
// ─────────────────────────────────────────────────────────────
function PartnerPicker({
  value,
  contactId,
  contacts,
  onChange,
  onOpenContact,
}: {
  value: string;
  contactId: string;
  contacts: Contact[];
  onChange: (name: string, contactId: string) => void;
  onOpenContact?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 連結對象：優先用 contactId，其次退回同名比對 (相容尚未關聯的舊資料)
  const linked =
    (contactId ? contacts.find((c) => c.id === contactId) : undefined) ??
    (value.trim()
      ? contacts.find((c) => c.name === value.trim())
      : undefined) ??
    null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(s) ||
            c.profession.toLowerCase().includes(s),
        )
      : contacts;
    return list.slice(0, 50);
  }, [contacts, q]);

  const canAddFree = q.trim() && !contacts.some((c) => c.name === q.trim());

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="field-input flex min-h-[42px] flex-1 items-center gap-1 text-left"
        >
          <span
            className={value ? "truncate" : "truncate text-paper-muted"}
          >
            {value || "選擇夥伴…"}
          </span>
          {linked && (
            <Link2 size={12} className="shrink-0 text-brand-500" />
          )}
          <ChevronDown
            size={14}
            className={`ml-auto shrink-0 text-paper-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {linked && onOpenContact && (
          <button
            type="button"
            onClick={() => onOpenContact(linked.id)}
            className="btn-ghost shrink-0 px-2.5"
            title={`到人脈庫看「${linked.name}」的詳情`}
            aria-label="到人脈庫看詳情"
          >
            <ExternalLink size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-paper-border bg-white p-2 shadow-float">
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋人脈庫姓名 / 職業…"
            className="field-input mb-1.5 text-sm"
          />
          <div className="max-h-52 overflow-y-auto">
            {canAddFree && (
              <button
                type="button"
                onClick={() => {
                  onChange(q.trim(), "");
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-paper-block"
              >
                <Plus size={13} className="text-paper-muted" />
                使用「{q.trim()}」（名單外自訂）
              </button>
            )}
            {filtered.length === 0 && !canAddFree && (
              <p className="px-2 py-2 text-xs text-paper-muted">
                {contacts.length === 0
                  ? "人脈庫尚無聯絡人"
                  : "查無符合的聯絡人"}
              </p>
            )}
            {filtered.map((c) => {
              const on = contactId ? c.id === contactId : c.name === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.name, c.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-paper-block"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      on
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-paper-border"
                    }`}
                  >
                    {on && <Check size={10} />}
                  </span>
                  <span className="truncate text-sm text-paper-text">
                    {c.name}
                  </span>
                  {c.profession && (
                    <span className="ml-auto shrink-0 truncate text-[11px] text-paper-muted">
                      {c.profession}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {value && (
            <div className="mt-1 border-t border-paper-border pt-1.5">
              <button
                type="button"
                onClick={() => {
                  onChange("", "");
                  setOpen(false);
                  setQ("");
                }}
                className="rounded-md px-2 py-1 text-xs text-paper-muted transition hover:text-red-600"
              >
                清除選擇
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CasesBoard({
  initialCases,
  quotes,
  contacts,
  onOpenContact,
  searchQuery = "",
}: {
  initialCases: Case[];
  /** 供「關聯報價單」下拉選擇 (自動帶入名稱與總金額) */
  quotes: QuoteSummary[];
  /** 🤝 人脈庫聯絡人：夥伴下拉選擇 + 帶出匯款資訊 + 連過去看詳情 */
  contacts: Contact[];
  /** 點夥伴「連過去」→ 切到人脈庫並開啟該聯絡人 Modal */
  onOpenContact?: (id: string) => void;
  /** 全域搜尋框（AdminWorkspace）傳入的關鍵字 */
  searchQuery?: string;
}) {
  const [cases, setCases] = useState<Case[]>(initialCases);
  const [modalId, setModalId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CaseInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [toast, setToast] = useState("");
  // 展開狀態：夥伴付款紀錄 (Modal 內，key=partnerCost id)、待付夥伴款明細 (key=PartnerDue.key)
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(
    new Set(),
  );
  const [expandedDues, setExpandedDues] = useState<Set<string>>(new Set());

  function togglePaymentsExpanded(id: string) {
    setExpandedPayments((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDueExpanded(key: string) {
    setExpandedDues((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  const editingCase = modalId
    ? (cases.find((c) => c.id === modalId) ?? null)
    : null;

  // 🔔 催款提醒：所有「有未收款餘額」的案件 (金額大 → 小)
  const unpaidCases = useMemo(
    () =>
      cases
        .map((c) => ({ c, fin: computeCaseFinance(c) }))
        .filter(({ fin }) => fin.unpaidBalance > 0)
        .sort((a, b) => b.fin.unpaidBalance - a.fin.unpaidBalance),
    [cases],
  );

  // 💸 待付夥伴款：跨案件彙總尚未結清的合作夥伴費用 (依夥伴分組)
  const partnerDues = useMemo(() => collectPartnerDues(cases), [cases]);

  const visible = useMemo(() => {
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

  // Modal 內即時財務分解 (打字即更新)
  const fin = computeCaseFinance(draft);

  const dirty = editingCase
    ? JSON.stringify(caseToDraft(editingCase)) !== JSON.stringify(draft)
    : JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);

  function openCase(c: Case) {
    setDraft(caseToDraft(c));
    setModalId(c.id);
  }

  function closeModal(force = false) {
    if (!force && dirty && !window.confirm("尚未儲存的變更將遺失，確定關閉？")) {
      return;
    }
    setModalId(null);
  }

  /** 夥伴「連過去看詳情」：先關案件 Modal (避免切頁後殘留的全域 Esc 監聽)，再導向人脈庫 */
  function goToContact(id: string) {
    if (dirty && !window.confirm("尚未儲存的變更將遺失，仍要前往人脈庫？")) {
      return;
    }
    setModalId(null);
    onOpenContact?.(id);
  }

  // Esc 關閉 Modal
  useEffect(() => {
    if (!modalId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalId, dirty]);

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
      openCase(record);
    } catch {
      flash("建立失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function persist() {
    if (!modalId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${modalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error();
      const { case: record } = (await res.json()) as { case: Case };
      setCases((cs) => cs.map((c) => (c.id === record.id ? record : c)));
      setDraft(caseToDraft(record));
      flash("已儲存");
      setModalId(null);
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
      setModalId(null);
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
          contactId: "",
          role: "",
          amount: 0,
          paidAmount: 0,
          payments: [],
          payStatus: "unpaid" as PartnerPayStatus,
        },
      ],
    }));
  }

  /** 案件收款紀錄變更：同步更新 receivedAmount 供即時財務計算使用 */
  function setReceivedPayments(next: PaymentEntry[]) {
    const total = next.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    setDraft((d) => ({ ...d, receivedPayments: next, receivedAmount: total }));
  }

  /** 夥伴付款紀錄變更：同步更新該列 paidAmount 供即時財務計算使用 */
  function setPartnerPayments(id: string, next: PaymentEntry[]) {
    const total = next.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    patchPartnerCost(id, { payments: next, paidAmount: total });
  }

  function patchPartnerCost(id: string, patch: Partial<PartnerCost>) {
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

  /** 夥伴費用列 → 對應的人脈庫聯絡人 (優先 contactId，退回同名) */
  function linkedContact(p: PartnerCost): Contact | null {
    if (p.contactId) return contacts.find((c) => c.id === p.contactId) ?? null;
    const n = p.partnerName.trim();
    return n ? (contacts.find((c) => c.name === n) ?? null) : null;
  }

  /** 金額輸入：空字串顯示 placeholder 0，輸入即轉數字 */
  function amountValue(n: number) {
    return n === 0 ? "" : n;
  }
  function parseAmount(v: string) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  /** 夥伴摘要文字 (資料表用)：名稱優先，退回角色 */
  function partnerLabels(c: Case): string[] {
    return c.partnerCosts.map((p) => p.partnerName || p.role || "夥伴");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-paper-text">💼 案件管理</h2>
          <p className="text-sm text-paper-muted">
            應收帳款、合作夥伴費用與稅務代扣，自動算出每個專案的實際淨利。點列可編輯。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-paper-muted">
              <Loader2 size={13} className="animate-spin" /> 儲存中
            </span>
          )}
          {/* 新增時先選型態：自接案 / 代開發票 (決定是否有稅務代扣) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setAddMenu((v) => !v)}
              aria-expanded={addMenu}
              className="btn-primary"
              title="新增案件"
            >
              <Plus size={16} /> 新增
            </button>
            {addMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setAddMenu(false)}
                />
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
              </>
            )}
          </div>
        </div>
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
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {unpaidCases.map(({ c, fin: f }) => (
              <li key={c.id}>
                <button
                  onClick={() => openCase(c)}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-sm transition hover:bg-white"
                >
                  <span className="font-medium text-paper-text">
                    {c.name || "（未命名案件）"}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    未收 {formatNT(f.unpaidBalance)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 💸 待付夥伴款：跨案件彙總「你欠夥伴的錢」，依夥伴分組展開看明細 */}
      {partnerDues.length > 0 && (
        <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-sky-800">
            <HandCoins size={16} />
            待付夥伴款：{partnerDues.length} 位夥伴尚有應付款，合計{" "}
            {formatNT(
              partnerDues.reduce((sum, d) => sum + d.totalOutstanding, 0),
            )}
          </div>
          <ul className="mt-2 space-y-1">
            {partnerDues.map((d) => {
              const expanded = expandedDues.has(d.key);
              return (
                <li key={d.key} className="rounded-lg bg-white/70">
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <button
                      onClick={() => toggleDueExpanded(d.key)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                    >
                      <ChevronDown
                        size={13}
                        className={`shrink-0 text-paper-muted transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-paper-text">
                        {d.partnerName}
                      </span>
                      {d.items.length > 1 && (
                        <span className="shrink-0 text-xs text-paper-muted">
                          {d.items.length} 個案件
                        </span>
                      )}
                    </button>
                    {d.contactId && (
                      <button
                        onClick={() => goToContact(d.contactId)}
                        className="shrink-0 rounded-md p-1 text-paper-muted transition hover:bg-paper-block hover:text-brand-600"
                        title="到人脈庫看詳情"
                        aria-label="到人脈庫看詳情"
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                    <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                      {formatNT(d.totalOutstanding)}
                    </span>
                  </div>
                  {expanded && (
                    <ul className="space-y-0.5 px-3 pb-2">
                      {d.items.map((item) => {
                        const target = cases.find((x) => x.id === item.caseId);
                        return (
                          <li key={item.caseId}>
                            <button
                              onClick={() => target && openCase(target)}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition hover:bg-paper-block"
                            >
                              <span className="truncate text-paper-muted">
                                {item.caseName}
                              </span>
                              <span className="shrink-0 font-medium text-sky-700">
                                {formatNT(item.outstanding)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mb-2 text-xs text-paper-muted">
        {searchQuery.trim()
          ? `${visible.length} / ${cases.length} 個案件`
          : `共 ${cases.length} 個案件`}
      </div>

      {/* ── 資料表 (手機橫向滾動) ── */}
      <div className="overflow-x-auto rounded-xl border border-paper-border bg-white">
        <div className="min-w-[960px]">
          {/* 表頭 */}
          <div
            className={`${GRID} border-b border-paper-border bg-paper-block/50 px-3 py-2 text-xs font-medium text-paper-muted`}
          >
            <span>案件名稱</span>
            <span>型態</span>
            <span className="text-right">總金額</span>
            <span className="text-right">已收</span>
            <span className="text-right">未收</span>
            <span className="text-right">淨利</span>
            <span>夥伴</span>
            <span>備註</span>
          </div>

          {visible.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-paper-muted">
              {cases.length === 0 ? (
                <span className="inline-flex items-center gap-2">
                  <Briefcase size={16} />
                  還沒有案件，按「新增」建立第一個。
                </span>
              ) : (
                "沒有符合搜尋的案件。"
              )}
            </div>
          )}

          {visible.map((c) => {
            const f = computeCaseFinance(c);
            const labels = partnerLabels(c);
            return (
              <div
                key={c.id}
                onClick={() => openCase(c)}
                className={`${GRID} min-h-[52px] cursor-pointer border-b border-paper-border/70 px-3 py-2 transition last:border-b-0 hover:bg-paper-block/40`}
              >
                <span className="truncate text-sm font-medium text-paper-text">
                  {c.name || (
                    <span className="text-paper-muted">（未命名案件）</span>
                  )}
                </span>

                <span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${CASE_TYPE_META[c.caseType].chip}`}
                  >
                    {CASE_TYPE_META[c.caseType].short}
                  </span>
                </span>

                <span className="text-right text-sm tabular-nums text-paper-text">
                  {formatCurrency(f.totalAmount)}
                </span>
                <span className="text-right text-sm tabular-nums text-paper-muted">
                  {formatCurrency(f.receivedAmount)}
                </span>
                <span className="text-right text-sm tabular-nums">
                  {f.unpaidBalance > 0 ? (
                    <span className="font-semibold text-amber-700">
                      {formatCurrency(f.unpaidBalance)}
                    </span>
                  ) : (
                    <span className="text-emerald-600">已收齊</span>
                  )}
                </span>
                <span
                  className={`text-right text-sm font-semibold tabular-nums ${
                    f.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(f.netProfit)}
                </span>

                <span className="flex min-w-0 items-center gap-1 text-xs text-paper-muted">
                  {labels.length === 0 ? (
                    <span className="text-paper-muted/60">–</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Users size={12} className="shrink-0" />
                      <span className="truncate">
                        {labels.slice(0, 2).join("、")}
                        {labels.length > 2 ? ` +${labels.length - 2}` : ""}
                      </span>
                    </span>
                  )}
                </span>

                <span
                  className="line-clamp-2 whitespace-pre-line break-words text-xs leading-4 text-paper-muted"
                  title={c.note || undefined}
                >
                  {c.note}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 編輯 Modal ── */}
      {editingCase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper-text/40 p-4 backdrop-blur-sm"
          onClick={() => closeModal()}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-paper-border bg-white p-5 shadow-float"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-paper-text">
                {draft.name || "（未命名案件）"}
              </h3>
              <button
                onClick={() => closeModal()}
                className="rounded-lg p-1.5 text-paper-muted transition hover:bg-paper-block hover:text-paper-text"
                aria-label="關閉"
              >
                <X size={18} />
              </button>
            </div>

            <input
              className="field-input mb-3 text-base font-medium"
              placeholder="專案名稱"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
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
            <div className="mb-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="mt-3">
                <label className="field-label">
                  收款紀錄（已收 {formatNT(fin.receivedAmount)}）
                </label>
                <div className="rounded-lg border border-paper-border bg-paper-block/30 p-2.5">
                  <PaymentLedger
                    entries={draft.receivedPayments}
                    onChange={setReceivedPayments}
                    addLabel="新增收款紀錄"
                  />
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
                      <div className="grid grid-cols-1 gap-2 pr-8 sm:grid-cols-2">
                        <div>
                          <label className="field-label text-xs">
                            夥伴名稱（人脈庫）
                          </label>
                          <PartnerPicker
                            value={p.partnerName}
                            contactId={p.contactId}
                            contacts={contacts}
                            onChange={(name, contactId) =>
                              patchPartnerCost(p.id, {
                                partnerName: name,
                                contactId,
                              })
                            }
                            onOpenContact={goToContact}
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
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 pr-8 sm:pr-9">
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
                            付款狀態
                          </label>
                          <select
                            className="field-input"
                            value={p.payStatus}
                            onChange={(e) =>
                              patchPartnerCost(p.id, {
                                payStatus: e.target.value as PartnerPayStatus,
                              })
                            }
                          >
                            {(
                              Object.keys(PAY_STATUS_META) as PartnerPayStatus[]
                            ).map((s) => (
                              <option key={s} value={s}>
                                {PAY_STATUS_META[s].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* 付款紀錄：折疊顯示，摘要列一律可見（已付／未付一眼看到） */}
                      <div className="mt-2 pr-8 sm:pr-9">
                        <button
                          type="button"
                          onClick={() => togglePaymentsExpanded(p.id)}
                          className="flex w-full items-center justify-between rounded-md bg-white/70 px-2.5 py-1.5 text-xs transition hover:bg-white"
                        >
                          <span className="inline-flex items-center gap-1.5 text-paper-muted">
                            <HandCoins size={13} />
                            付款紀錄（{p.payments.length} 筆）
                            <span
                              className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${PAY_STATUS_META[p.payStatus].badge}`}
                            >
                              {PAY_STATUS_META[p.payStatus].label}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span
                              className={
                                p.amount - partnerCostPaid(p) > 0
                                  ? "font-medium text-amber-700"
                                  : "font-medium text-emerald-600"
                              }
                            >
                              已付 {formatNT(partnerCostPaid(p))}
                              {p.amount - partnerCostPaid(p) > 0
                                ? `・未付 ${formatNT(p.amount - partnerCostPaid(p))}`
                                : ""}
                            </span>
                            <ChevronDown
                              size={13}
                              className={`text-paper-muted transition-transform ${
                                expandedPayments.has(p.id) ? "rotate-180" : ""
                              }`}
                            />
                          </span>
                        </button>
                        {expandedPayments.has(p.id) && (
                          <div className="mt-1.5 rounded-md border border-paper-border bg-white/70 p-2.5">
                            <PaymentLedger
                              entries={p.payments}
                              onChange={(next) =>
                                setPartnerPayments(p.id, next)
                              }
                              addLabel="新增付款紀錄"
                            />
                          </div>
                        )}
                      </div>

                      {/* 對到人脈庫時帶出匯款資訊，付款免翻頁 */}
                      {(() => {
                        const m = linkedContact(p);
                        if (!m || !m.transferInfo) return null;
                        return (
                          <div className="mt-1.5 flex items-center gap-1 pr-8 text-[11px] text-paper-muted sm:pr-9">
                            <Link2 size={11} className="text-brand-500" />
                            匯款：{m.transferInfo}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 備註 */}
            <div className="mb-4">
              <label className="field-label">備註</label>
              <textarea
                className="field-input min-h-[80px] resize-y"
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
                    <dt className="text-paper-muted">代收代扣 3% 營所稅</dt>
                    <dd className="text-red-600">
                      − {formatNT(fin.incomeTax)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-paper-muted">
                    合作夥伴費用（{draft.partnerCosts.length} 筆）
                  </dt>
                  <dd className="text-red-600">− {formatNT(fin.partnerTotal)}</dd>
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
                onClick={() => remove(editingCase.id)}
                className="btn-danger"
                disabled={saving}
              >
                <Trash2 size={16} /> 刪除
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => closeModal()} className="btn-ghost">
                  取消
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
