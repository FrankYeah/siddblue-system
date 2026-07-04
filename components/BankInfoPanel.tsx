"use client";

import { useState } from "react";
import { Landmark, Copy, Check, ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  🏦 銀行帳戶快捷面板 (Quick Bank Info Widget)
//  常駐後台導覽列的極簡卡片：個人 / 公司帳戶一鍵複製給客戶。
//  資訊為靜態常數 (非機密——本來就是要給客戶匯款用的資訊)。
// ─────────────────────────────────────────────────────────────

interface BankAccount {
  key: string;
  /** 卡片標題 */
  label: string;
  /** 戶名 */
  holder: string;
  /** 銀行 (代碼) 分行 (代碼) */
  bank: string;
  /** 顯示用帳號 (可含分隔符) */
  account: string;
  /** 統一編號 (公司帳戶) */
  taxId?: string;
}

const ACCOUNTS: BankAccount[] = [
  {
    key: "personal",
    label: "個人帳戶",
    holder: "葉奕緯",
    bank: "台新銀行 (812) 敦南分行 (0023)",
    account: "28881009063527",
  },
  {
    key: "company",
    label: "公司帳戶",
    holder: "西打藍好內容有限公司",
    bank: "國泰世華銀行 (013) 基隆分行 (1243)",
    account: "1240-3500-9494",
    taxId: "93662829",
  },
];

/** 組出「貼給客戶」的完整匯款資訊文字 */
function fullInfo(a: BankAccount): string {
  const lines = [`戶名：${a.holder}`, a.bank, `帳號：${a.account}`];
  if (a.taxId) lines.push(`統一編號：${a.taxId}`);
  return lines.join("\n");
}

/** 複製文字 (clipboard API + 舊瀏覽器 fallback) */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 降級走 execCommand
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function BankInfoPanel() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  async function copy(key: string, text: string, what: string) {
    const ok = await copyText(text);
    setToast(ok ? `已複製${what}` : "複製失敗，請手動複製");
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1500);
    }
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    // 置於導覽列內、標題列下方：展開時以正常文流把搜尋框/頁籤往下推，
    // 不用 absolute（header 有 overflow-hidden 會裁切下拉面板）
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
        title="銀行帳戶資訊（一鍵複製）"
      >
        <Landmark size={15} />
        銀行資訊
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2">
          <div className="grid gap-3 rounded-2xl border border-white/20 bg-white/95 p-4 shadow-float backdrop-blur sm:grid-cols-2">
            {ACCOUNTS.map((a) => (
              <div
                key={a.key}
                className="rounded-xl border border-paper-border bg-paper-block/40 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-brand-600">
                    {a.label}
                  </span>
                  <button
                    onClick={() => copy(`${a.key}-full`, fullInfo(a), "完整匯款資訊")}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-brand-700"
                    title="複製戶名＋銀行＋帳號（可直接貼給客戶）"
                  >
                    {copiedKey === `${a.key}-full` ? (
                      <Check size={13} />
                    ) : (
                      <Copy size={13} />
                    )}
                    複製完整資訊
                  </button>
                </div>
                <div className="mt-2 space-y-0.5 text-sm text-paper-text">
                  <div className="font-medium">{a.holder}</div>
                  <div className="text-xs text-paper-muted">{a.bank}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono tracking-wide">{a.account}</span>
                    <button
                      onClick={() =>
                        // 帳號以純數字複製，網銀輸入欄多半不收分隔符
                        copy(`${a.key}-acct`, a.account.replace(/\D/g, ""), "帳號")
                      }
                      className="rounded-md p-1 text-paper-muted transition hover:bg-paper-block hover:text-brand-600"
                      title="複製帳號（純數字）"
                      aria-label={`複製${a.label}帳號`}
                    >
                      {copiedKey === `${a.key}-acct` ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  {a.taxId && (
                    <div className="flex items-center gap-1.5 text-xs text-paper-muted">
                      統一編號：
                      <span className="font-mono">{a.taxId}</span>
                      <button
                        onClick={() => copy(`${a.key}-tax`, a.taxId!, "統編")}
                        className="rounded-md p-1 text-paper-muted transition hover:bg-paper-block hover:text-brand-600"
                        title="複製統一編號"
                        aria-label="複製統一編號"
                      >
                        {copiedKey === `${a.key}-tax` ? (
                          <Check size={13} className="text-emerald-600" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-paper-text px-4 py-2.5 text-sm text-white shadow-float sm:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
