"use client";

import { useState } from "react";
import {
  DatabaseBackup,
  ChevronDown,
  Download,
  History,
  RotateCcw,
  Loader2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
//  📦 資料備份與匯出 (Backup & Export Widget)
//  常駐後台導覽列：一鍵匯出全部資料 JSON、立即備份、還原至過去快照。
//  每日自動快照另由 Vercel Cron 呼叫 /api/backup/snapshot（見 vercel.json）。
// ─────────────────────────────────────────────────────────────

interface BackupCounts {
  quotes: number;
  cases: number;
  contacts: number;
  notes: number;
  inspirations: number;
  todos: number;
  /** 選填：新增支出模組前建立的舊快照沒有這個欄位 */
  expenses?: number;
}

interface BackupMeta {
  id: string;
  exportedAt: string;
  counts: BackupCounts;
}

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 以 UTC+8 (台北) 手動格式化，避免 SSR/CSR 的 Intl 輸出不一致
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}/${p(t.getUTCMonth() + 1)}/${p(t.getUTCDate())} ${p(
    t.getUTCHours(),
  )}:${p(t.getUTCMinutes())}`;
}

function summarize(c: BackupCounts) {
  return `報價 ${c.quotes}・案件 ${c.cases}・人脈 ${c.contacts}・筆記 ${c.notes}・靈感 ${c.inspirations}・待辦 ${c.todos}・支出 ${c.expenses ?? 0}`;
}

export default function BackupPanel() {
  const [open, setOpen] = useState(false);
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function loadList() {
    setLoading(true);
    try {
      const res = await fetch("/api/backup/list");
      if (!res.ok) throw new Error();
      const { backups: list } = (await res.json()) as {
        backups: BackupMeta[];
      };
      setBackups(list);
      setLoaded(true);
    } catch {
      flash("讀取備份清單失敗");
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next && !loaded) loadList();
      return next;
    });
  }

  async function snapshotNow() {
    setBusy(true);
    try {
      const res = await fetch("/api/backup/snapshot");
      if (!res.ok) throw new Error();
      flash("已建立備份");
      await loadList();
    } catch {
      flash("備份失敗，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  async function restore(b: BackupMeta) {
    const msg = `確定要還原到「${fmt(b.exportedAt)}」的備份？\n\n這會清空並覆寫目前所有資料（報價單、案件管理、人脈庫、知識庫、靈感看板、待辦清單），改回備份當時的內容：\n${summarize(b.counts)}\n\n此動作無法復原，請確認。`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id }),
      });
      if (!res.ok) throw new Error();
      flash("已還原，重新載入頁面…");
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      flash("還原失敗，請稍後再試");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={toggleOpen}
        aria-expanded={open}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
        title="資料備份與匯出"
      >
        <DatabaseBackup size={15} />
        備份
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-4 shadow-float backdrop-blur">
            <div className="flex items-center gap-2">
              <a
                href="/api/backup/export"
                className="btn-ghost flex-1 justify-center text-sm"
                title="下載目前全部資料的 JSON 檔"
              >
                <Download size={14} /> 匯出 JSON
              </a>
              <button
                onClick={snapshotNow}
                disabled={busy}
                className="btn-primary flex-1 justify-center text-sm"
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <History size={14} />
                )}
                立即備份
              </button>
            </div>

            <div className="mt-3 border-t border-paper-border pt-3">
              <div className="mb-1.5 text-xs font-medium text-paper-muted">
                最近備份（每日自動保留 7 份）
              </div>
              {loading ? (
                <p className="py-3 text-center text-xs text-paper-muted">
                  載入中…
                </p>
              ) : backups.length === 0 ? (
                <p className="py-3 text-center text-xs text-paper-muted">
                  尚無備份，按「立即備份」建立第一份。
                </p>
              ) : (
                <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                  {backups.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-paper-block/40 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-paper-text">
                          {fmt(b.exportedAt)}
                        </div>
                        <div className="truncate text-[11px] text-paper-muted">
                          {summarize(b.counts)}
                        </div>
                      </div>
                      <button
                        onClick={() => restore(b)}
                        disabled={busy}
                        className="btn-ghost shrink-0 px-2 text-xs"
                        title="還原到這個時間點（會覆寫目前所有資料）"
                      >
                        <RotateCcw size={13} /> 還原
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
