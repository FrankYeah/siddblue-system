"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Link2, Plus } from "lucide-react";
import type { Contact } from "@/lib/types";

// ─────────────────────────────────────────────────────────────
//  夥伴選擇器：可搜尋的人脈庫下拉 + 保留名單外自由填寫 + 連過去看詳情
// ─────────────────────────────────────────────────────────────
export default function PartnerPicker({
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

