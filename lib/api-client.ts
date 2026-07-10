// ─────────────────────────────────────────────────────────────
//  後台 API fetch 封裝 (僅供 Client Component 使用)
//
//  解決的問題：sb_admin cookie 過期 (30 天) 後，所有寫入 API 回 401，
//  但各看板的樂觀更新讓畫面看起來一切正常、catch 只 flash「儲存失敗」——
//  使用者會誤以為是網路問題繼續操作，實際上每一筆變更都沒有落地。
//
//  adminFetch 與原生 fetch 介面完全相同 (回傳 Response)，呼叫端只需
//  把 fetch 換成 adminFetch，其餘 res.ok / res.json() 邏輯不變；
//  唯一差異：偵測到 401 時跳出明確的「登入已過期」提示並引導重新整理。
// ─────────────────────────────────────────────────────────────

// 只提示一次，避免多個並發請求同時 401 時跳出連環對話框
let sessionExpiredNotified = false;

function notifySessionExpired() {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  const reload = window.confirm(
    "登入已過期，需要重新登入。\n\n" +
      "按「確定」重新整理頁面（畫面上尚未儲存的變更會遺失）；\n" +
      "若有未儲存的內容，請按「取消」先自行複製備份，再手動重新整理。",
  );
  if (reload) window.location.reload();
}

/**
 * 後台 API 專用 fetch：介面同原生 fetch，401 時提示登入過期。
 * 注意：登入本身 (POST /api/admin/login) 不可用此封裝——那裡的 401 是密碼錯誤。
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) notifySessionExpired();
  return res;
}
