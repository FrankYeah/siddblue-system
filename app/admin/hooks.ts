"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
//  工作區共用 hooks
// ─────────────────────────────────────────────────────────────

/**
 * 序列化＋合併 (coalesce) 的儲存佇列。
 *
 * 樂觀更新搭配「整包覆寫 PUT」有個 race condition：連續快速拖曳／切換時
 * 會同時發出多個 PUT，HTTP 回應順序不保證 ── 較舊的請求可能最後抵達，
 * 以舊資料覆寫掉新資料 (last-write-wins 亂序)。
 *
 * 這個 hook 保證：同一時間最多一個請求在途；期間再被呼叫只保留「最新」
 * 酬載，待在途請求完成後補送一次。中間態被合併掉（KV 只需要最終結果），
 * 送出順序即狀態順序，不會有舊蓋新。
 */
export function useQueuedSave<T>(save: (payload: T) => Promise<void>) {
  const inflight = useRef(false);
  const queued = useRef<T | null>(null);
  // 以 ref 持有最新的 save，避免呼叫端用 inline function 時佇列引用到舊 closure
  const saveRef = useRef(save);
  saveRef.current = save;
  const [saving, setSaving] = useState(false);

  // 有在途或排隊中的變更時攔截關閉/重整分頁：
  // 樂觀更新讓畫面看起來已完成，但 KV 寫入可能還在路上，直接關掉就遺失了
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (inflight.current || queued.current !== null) {
        e.preventDefault();
        // Chrome 需要設定 returnValue 才會顯示確認對話框
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const enqueue = useCallback(async (payload: T) => {
    queued.current = payload;
    if (inflight.current) return; // 已有請求在途，完成後會自動補送最新酬載
    inflight.current = true;
    setSaving(true);
    try {
      while (queued.current !== null) {
        const next = queued.current;
        queued.current = null;
        await saveRef.current(next);
      }
    } finally {
      inflight.current = false;
      setSaving(false);
    }
  }, []);

  /** 是否仍有未送達 KV 的變更（在途或排隊中） */
  const isBusy = useCallback(
    () => inflight.current || queued.current !== null,
    [],
  );

  /**
   * 丟棄排隊中的酬載（不影響在途請求）。
   * 用於版本衝突（409）後：排隊中的整包酬載是基於過期狀態算出來的，
   * 若照常補送會拿舊內容蓋掉剛從伺服器同步回來的最新資料。
   */
  const clear = useCallback(() => {
    queued.current = null;
  }, []);

  return { enqueue, saving, isBusy, clear };
}

/**
 * Modal 開啟期間鎖定背景頁面捲動。
 *
 * iOS Safari 的 `fixed inset-0` Modal 沒鎖 body 時，Modal 內容捲到底
 * 會 scroll chaining 繼續捲動背景頁（背景位移、關閉後位置跳掉）。
 * 單純 `overflow: hidden` 在 iOS 上不可靠，故用標準的 position:fixed
 * 技法：鎖定時把 body 固定在目前捲動位置，解鎖時還原捲動座標。
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

/**
 * 視窗重獲焦點時重新同步資料。
 *
 * /admin 的看板資料只在頁面載入時從 Server Component 帶入一次；
 * 之後皆為客戶端樂觀狀態。若使用者在另一台裝置（或另一分頁）改了資料，
 * 或 Next.js Client Router Cache 供應了過期的 RSC payload，畫面會停留在舊資料。
 * 監聽 focus / visibilitychange，在切回分頁時呼叫 sync() 讓呼叫端重抓 API。
 * 呼叫端自行判斷是否適合同步（例如編輯中、儲存中則跳過）。
 */
export function useSyncOnFocus(sync: () => void) {
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") syncRef.current();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
}
