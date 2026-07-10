"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { Plus, Trash2, X } from "lucide-react";
import { formatCurrency, formatNT } from "@/lib/format";
import type { PaymentEntry } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
//  收/付款紀錄 (Payment Ledger)：取代單一數字，逐筆記錄日期＋金額＋備註。
//  case 收款與夥伴付款共用同一元件；onChange 回傳新陣列，呼叫端自行加總。
// ─────────────────────────────────────────────────────────────
export default function PaymentLedger({
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

