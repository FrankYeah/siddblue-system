"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  FileDown,
  Link as LinkIcon,
  Copy,
  CopyPlus,
  Check,
  Sparkles,
  FilePlus2,
  Loader2,
  LogOut,
  ExternalLink,
  ClipboardList,
  BadgeCheck,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { PaperPlane, CodeBraces } from "@/components/BrandDecor";
import {
  buildDefaultQuoteInput,
  DEFAULT_MAINTENANCE_RULES,
  DEFAULT_PROCESS_STEPS,
  DEFAULT_SUPPLEMENTARY_NOTES,
  DEFAULT_PAYMENT_INFO,
  DEFAULT_SUMMARY_TEXT,
  COMPANY_NAME,
} from "@/lib/defaults";
import { itemsTotal, formatNT, quoteToInput } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import type { Quote, QuoteInput, QuoteItem, QuoteSummary } from "@/lib/types";

export default function AdminEditor({
  initialQuotes,
  protectedMode,
}: {
  initialQuotes: QuoteSummary[];
  protectedMode: boolean;
}) {
  const [quotes, setQuotes] = useState<QuoteSummary[]>(initialQuotes);
  const [form, setForm] = useState<QuoteInput>(buildDefaultQuoteInput());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedLink, setSavedLink] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string>("");

  const total = useMemo(() => itemsTotal(form.items), [form.items]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  }

  // ── 通用欄位更新 ──
  function setField<K extends keyof QuoteInput>(key: K, value: QuoteInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ── 報價項目 ──
  function addItem() {
    setForm((f) => ({
      ...f,
      items: [...f.items, { category: "", description: "", duration: "", amount: 0 }],
    }));
  }
  function updateItem(i: number, key: keyof QuoteItem, value: string) {
    setForm((f) => {
      const items = f.items.map((it, idx) => {
        if (idx !== i) return it;
        if (key === "amount") return { ...it, amount: Number(value) || 0 };
        return { ...it, [key]: value };
      });
      return { ...f, items };
    });
  }
  function removeItem(i: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  }
  function moveItem(i: number, dir: -1 | 1) {
    setForm((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.items.length) return f;
      const items = [...f.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...f, items };
    });
  }

  // ── 動態陣列 (流程 / 補充說明) ──
  function addStringItem(key: "processSteps" | "supplementaryNotes") {
    setForm((f) => ({ ...f, [key]: [...f[key], ""] }));
  }
  function updateStringItem(
    key: "processSteps" | "supplementaryNotes",
    i: number,
    value: string,
  ) {
    setForm((f) => {
      const arr = [...f[key]];
      arr[i] = value;
      return { ...f, [key]: arr };
    });
  }
  function removeStringItem(key: "processSteps" | "supplementaryNotes", i: number) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));
  }

  // ── 維護規則 ──
  function addRule() {
    setForm((f) => ({
      ...f,
      maintenanceRules: [
        ...f.maintenanceRules,
        { level: "", description: "", amount: "" },
      ],
    }));
  }
  function updateRule(i: number, key: "level" | "description" | "amount", value: string) {
    setForm((f) => {
      const rules = [...f.maintenanceRules];
      rules[i] = { ...rules[i], [key]: value };
      return { ...f, maintenanceRules: rules };
    });
  }
  function removeRule(i: number) {
    setForm((f) => ({
      ...f,
      maintenanceRules: f.maintenanceRules.filter((_, idx) => idx !== i),
    }));
  }

  // ── 一鍵帶入預設範本 ──
  function loadTemplate() {
    setForm((f) => ({
      ...f,
      paymentInfo: DEFAULT_PAYMENT_INFO,
      summaryText: DEFAULT_SUMMARY_TEXT,
      processSteps: [...DEFAULT_PROCESS_STEPS],
      maintenanceRules: DEFAULT_MAINTENANCE_RULES.map((r) => ({ ...r })),
      supplementaryNotes: [...DEFAULT_SUPPLEMENTARY_NOTES],
    }));
    notify("已帶入預設維護與流程範本");
  }

  // ── 新增空白報價單 ──
  function newQuote() {
    setForm(buildDefaultQuoteInput());
    setCurrentId(null);
    setSavedLink("");
    notify("已建立新報價單");
  }

  // ── 載入既有報價單編輯 ──
  async function editQuote(id: string) {
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error();
      const { quote } = (await res.json()) as { quote: Quote };
      setForm(quoteToInput(quote));
      setCurrentId(id);
      setSavedLink(`${window.location.origin}/quote/${id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      notify("讀取報價單失敗");
    }
  }

  // ── 複製為新報價單 (載入資料，存檔時建立副本) ──
  async function duplicateQuote(id: string) {
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) throw new Error();
      const { quote } = (await res.json()) as { quote: Quote };
      const input = quoteToInput(quote);
      input.clientName = `${input.clientName} (複本)`;
      input.quoteDate = new Date().toISOString().slice(0, 10);
      setForm(input);
      setCurrentId(null);
      setSavedLink("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      notify("已載入複本，按「儲存並生成連結」即可建立新報價單");
    } catch {
      notify("複製失敗");
    }
  }

  // ── 刪除 ──
  async function removeQuote(id: string) {
    if (!confirm("確定要刪除這份報價單嗎？此動作無法復原。")) return;
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setQuotes((qs) => qs.filter((q) => q.id !== id));
      if (currentId === id) newQuote();
      notify("已刪除");
    } else {
      notify("刪除失敗");
    }
  }

  // ── 儲存並生成連結 ──
  async function save() {
    if (!form.clientName.trim()) {
      notify("請先填寫專案 / 客戶名稱");
      return;
    }
    setSaving(true);
    try {
      const url = currentId ? `/api/quotes/${currentId}` : "/api/quotes";
      const method = currentId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const { quote } = (await res.json()) as { quote: Quote };
      setCurrentId(quote.id);
      const link = `${window.location.origin}/quote/${quote.id}`;
      setSavedLink(link);

      // 更新列表
      setQuotes((qs) => {
        const summary: QuoteSummary = {
          id: quote.id,
          clientName: quote.clientName,
          quoteDate: quote.quoteDate,
          total: itemsTotal(quote.items),
          updatedAt: quote.updatedAt,
        };
        const others = qs.filter((q) => q.id !== quote.id);
        return [summary, ...others];
      });
      notify(currentId ? "已更新並重新生成連結" : "已儲存並生成前台連結");
    } catch {
      notify("儲存失敗，請確認 KV 設定");
    } finally {
      setSaving(false);
    }
  }

  // ── 匯出 CSV ──
  function exportCsv() {
    const quote: Quote = {
      ...form,
      id: currentId ?? "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    downloadCsv(quote);
    notify("已匯出 CSV");
  }

  async function copyLink() {
    if (!savedLink) return;
    await navigator.clipboard.writeText(savedLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-paper-bg">
      {/* 頂部品牌列 */}
      <header className="relative overflow-hidden bg-brand-gradient text-white">
        <PaperPlane
          size={70}
          className="absolute right-6 top-4 text-white/20 animate-float-plane"
        />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <CodeBraces className="text-white/80" />
              報價後台
            </div>
            <h1 className="text-xl font-bold">{COMPANY_NAME}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={newQuote} className="btn bg-white/15 text-white hover:bg-white/25">
              <FilePlus2 size={16} /> 新報價單
            </button>
            {protectedMode && (
              <button onClick={logout} className="btn bg-white/15 text-white hover:bg-white/25">
                <LogOut size={16} /> 登出
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[260px_1fr]">
        {/* 側欄：已儲存報價單 */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="notion-block !p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-paper-muted">
              <ClipboardList size={16} /> 已儲存報價單 ({quotes.length})
            </h2>
            <div className="space-y-1.5">
              {quotes.length === 0 && (
                <p className="px-1 py-4 text-sm text-paper-muted">
                  尚無報價單，右側編輯後按「儲存並生成連結」。
                </p>
              )}
              {quotes.map((q) => (
                <div
                  key={q.id}
                  className={`group flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                    currentId === q.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-transparent hover:bg-paper-block"
                  }`}
                >
                  <button
                    onClick={() => editQuote(q.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-paper-text">
                        {q.clientName || "(未命名)"}
                      </span>
                      {q.acceptedAt && (
                        <BadgeCheck
                          size={14}
                          className="shrink-0 text-emerald-600"
                          aria-label="已確認"
                        />
                      )}
                    </div>
                    <div className="text-xs text-paper-muted">
                      {q.quoteDate} · {formatNT(q.total)}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => duplicateQuote(q.id)}
                      className="rounded p-1 text-paper-muted hover:text-brand-600"
                      title="複製為新報價單"
                    >
                      <CopyPlus size={14} />
                    </button>
                    <a
                      href={`/quote/${q.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-paper-muted hover:text-brand-600"
                      title="開啟前台頁"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      onClick={() => removeQuote(q.id)}
                      className="rounded p-1 text-paper-muted hover:text-red-600"
                      title="刪除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* 主編輯區 */}
        <main className="space-y-6">
          {/* 關鍵資料 */}
          <section className="notion-block">
            <h2 className="section-title mb-4">
              <CodeBraces className="text-brand-500" /> 關鍵資料
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="field-label">專案名稱 / 客戶名稱 *</label>
                <input
                  className="field-input"
                  placeholder="例：星光咖啡 品牌形象官網"
                  value={form.clientName}
                  onChange={(e) => setField("clientName", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">報價日期</label>
                <input
                  type="date"
                  className="field-input"
                  value={form.quoteDate}
                  onChange={(e) => setField("quoteDate", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">有效期限</label>
                <input
                  className="field-input"
                  value={form.validPeriod}
                  onChange={(e) => setField("validPeriod", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">公司抬頭</label>
                <input
                  className="field-input"
                  value={form.companyName}
                  onChange={(e) => setField("companyName", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">統一編號</label>
                <input
                  className="field-input"
                  value={form.taxId}
                  onChange={(e) => setField("taxId", e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* 動態項目表格 */}
          <section className="notion-block">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">
                <CodeBraces className="text-brand-500" /> 報價項目
              </h2>
              <div className="text-right">
                <div className="text-xs text-paper-muted">總計金額</div>
                <div className="text-xl font-bold text-brand-600">
                  {formatNT(total)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs text-paper-muted">
                    <th className="px-2 font-medium">功能名稱</th>
                    <th className="px-2 font-medium">功能說明</th>
                    <th className="w-24 px-2 font-medium">工時</th>
                    <th className="w-32 px-2 font-medium">費用 (NT$)</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-1">
                        <input
                          className="field-input"
                          placeholder="功能名稱"
                          value={it.category}
                          onChange={(e) => updateItem(i, "category", e.target.value)}
                        />
                      </td>
                      <td className="px-1">
                        <textarea
                          className="field-input min-h-[42px] resize-y"
                          rows={1}
                          placeholder="功能說明 (可多行)"
                          value={it.description}
                          onChange={(e) => updateItem(i, "description", e.target.value)}
                        />
                      </td>
                      <td className="px-1">
                        <input
                          className="field-input"
                          placeholder="3 天"
                          value={it.duration}
                          onChange={(e) => updateItem(i, "duration", e.target.value)}
                        />
                      </td>
                      <td className="px-1">
                        <input
                          type="number"
                          className="field-input text-right"
                          placeholder="0"
                          value={it.amount || ""}
                          onChange={(e) => updateItem(i, "amount", e.target.value)}
                        />
                      </td>
                      <td className="px-1 pt-1.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveItem(i, -1)}
                              disabled={i === 0}
                              className="rounded p-0.5 text-paper-muted hover:text-brand-600 disabled:opacity-30"
                              title="上移"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => moveItem(i, 1)}
                              disabled={i === form.items.length - 1}
                              className="rounded p-0.5 text-paper-muted hover:text-brand-600 disabled:opacity-30"
                              title="下移"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <button
                            onClick={() => removeItem(i)}
                            className="rounded p-1.5 text-paper-muted hover:bg-red-50 hover:text-red-600"
                            title="刪除項目"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={addItem} className="btn-ghost mt-2">
              <Plus size={16} /> 新增項目
            </button>
          </section>

          {/* 維護與流程備註 */}
          <section className="notion-block">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">
                <CodeBraces className="text-brand-500" /> 維護與流程備註
              </h2>
              <button onClick={loadTemplate} className="btn-ghost">
                <Sparkles size={16} /> 一鍵帶入預設範本
              </button>
            </div>

            {/* 維護規則 */}
            <h3 className="field-label !text-paper-text">維護費估價定義</h3>
            <div className="space-y-2">
              {form.maintenanceRules.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[110px_1fr_150px_auto]">
                  <input
                    className="field-input"
                    placeholder="級距"
                    value={r.level}
                    onChange={(e) => updateRule(i, "level", e.target.value)}
                  />
                  <input
                    className="field-input"
                    placeholder="說明"
                    value={r.description}
                    onChange={(e) => updateRule(i, "description", e.target.value)}
                  />
                  <input
                    className="field-input"
                    placeholder="金額"
                    value={r.amount}
                    onChange={(e) => updateRule(i, "amount", e.target.value)}
                  />
                  <button
                    onClick={() => removeRule(i)}
                    className="btn-danger px-2"
                    title="刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addRule} className="btn-ghost mt-2">
              <Plus size={16} /> 新增維護級距
            </button>

            {/* 流程說明 */}
            <h3 className="field-label !text-paper-text mt-6">流程說明</h3>
            <div className="space-y-2">
              {form.processSteps.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-2 w-6 shrink-0 text-center text-sm font-semibold text-brand-500">
                    {i + 1}
                  </span>
                  <input
                    className="field-input"
                    value={s}
                    onChange={(e) => updateStringItem("processSteps", i, e.target.value)}
                  />
                  <button
                    onClick={() => removeStringItem("processSteps", i)}
                    className="btn-danger px-2"
                    title="刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addStringItem("processSteps")}
              className="btn-ghost mt-2"
            >
              <Plus size={16} /> 新增流程
            </button>
          </section>

          {/* 款項與付款資訊 */}
          <section className="notion-block">
            <h2 className="section-title mb-4">
              <CodeBraces className="text-brand-500" /> 款項與付款資訊
            </h2>
            <div className="grid gap-4">
              <div>
                <label className="field-label">總價與款項特殊備註</label>
                <textarea
                  className="field-input min-h-[80px] resize-y"
                  placeholder="老朋友折讓、未稅/含稅、頭期款比例…"
                  value={form.summaryText}
                  onChange={(e) => setField("summaryText", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">付款資訊 (預設帶入，可修改)</label>
                <textarea
                  className="field-input min-h-[80px] resize-y font-mono text-xs"
                  value={form.paymentInfo}
                  onChange={(e) => setField("paymentInfo", e.target.value)}
                />
              </div>
            </div>

            {/* 補充說明 */}
            <h3 className="field-label !text-paper-text mt-6">補充說明</h3>
            <div className="space-y-2">
              {form.supplementaryNotes.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <span className="mt-2 w-6 shrink-0 text-center text-sm font-semibold text-brand-500">
                    {i + 1}
                  </span>
                  <textarea
                    className="field-input min-h-[42px] resize-y"
                    rows={1}
                    value={s}
                    onChange={(e) =>
                      updateStringItem("supplementaryNotes", i, e.target.value)
                    }
                  />
                  <button
                    onClick={() => removeStringItem("supplementaryNotes", i)}
                    className="btn-danger px-2"
                    title="刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => addStringItem("supplementaryNotes")}
              className="btn-ghost mt-2"
            >
              <Plus size={16} /> 新增補充說明
            </button>
          </section>

          {/* 動作列 */}
          <section className="notion-block sticky bottom-4 z-10 flex flex-wrap items-center gap-3 shadow-float">
            <button onClick={save} className="btn-primary" disabled={saving}>
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {currentId ? "更新並重新生成連結" : "儲存並生成連結"}
            </button>
            <button onClick={exportCsv} className="btn-ghost">
              <FileDown size={16} /> 匯出 CSV
            </button>
            {savedLink && (
              <a href={savedLink} target="_blank" rel="noreferrer" className="btn-ghost">
                <ExternalLink size={16} /> 開啟前台頁
              </a>
            )}

            {savedLink && (
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                <LinkIcon size={16} className="shrink-0 text-brand-600" />
                <span className="truncate text-sm text-brand-700">{savedLink}</span>
                <button
                  onClick={copyLink}
                  className="ml-auto shrink-0 rounded p-1.5 text-brand-600 hover:bg-brand-100"
                  title="複製連結"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float">
          {toast}
        </div>
      )}
    </div>
  );
}
