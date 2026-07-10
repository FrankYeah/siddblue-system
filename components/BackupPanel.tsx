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
import { adminFetch } from "@/lib/api-client";

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
  /** 選填註記，如「還原前自動快照」 */
  note?: string;
}

interface BackupError {
  at: string;
  message: string;
}

/** 最新快照超過此時數即顯示「備份過期」警告（每日 Cron 正常時不會發生） */
const STALE_HOURS = 36;

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
  const [lastError, setLastError] = useState<BackupError | null>(null);
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
      const res = await adminFetch("/api/backup/list");
      if (!res.ok) throw new Error();
      const { backups: list, lastError: err } = (await res.json()) as {
        backups: BackupMeta[];
        lastError?: BackupError | null;
      };
      setBackups(list);
      setLastError(err ?? null);
      setLoaded(true);
    } catch {
      flash("讀取備份清單失敗");
    } finally {
      setLoading(false);
    }
  }

  // 最新快照距今超過 STALE_HOURS → 每日 Cron 可能沒在跑（或一直失敗），顯示警告
  const newestAt = backups.length > 0 ? new Date(backups[0].exportedAt).getTime() : 0;
  const stale =
    loaded &&
    backups.length > 0 &&
    Number.isFinite(newestAt) &&
    Date.now() - newestAt > STALE_HOURS * 3600 * 1000;

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
      const res = await adminFetch("/api/backup/snapshot");
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
    const msg = `確定要還原到「${fmt(b.exportedAt)}」的備份？\n\n這會清空並覆寫目前所有資料（報價單、案件管理、人脈庫、知識庫、靈感看板、待辦清單），改回備份當時的內容：\n${summarize(b.counts)}\n\n還原前會自動先為「目前狀態」建立一份快照，若還原錯了可再還原回來。`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await adminFetch("/api/backup/restore", {
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

            {/* 備份健康告警：Cron 失敗或快照過期時顯示，避免默默失敗數月無人知 */}
            {lastError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                ⚠️ 最近一次自動備份失敗（{fmt(lastError.at)}）：
                {lastError.message}
                <br />
                請按「立即備份」確認能否成功，持續失敗請檢查 Vercel 設定。
              </div>
            )}
            {!lastError && stale && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                ⚠️ 最新備份是 {fmt(backups[0].exportedAt)}，已超過 {STALE_HOURS}{" "}
                小時。每日自動備份可能沒有執行（檢查 Vercel Cron 與
                CRON_SECRET 設定），建議先按「立即備份」。
              </div>
            )}

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
                          {b.note && (
                            <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-normal text-brand-700">
                              {b.note}
                            </span>
                          )}
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
