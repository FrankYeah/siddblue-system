import type { Contact } from "./types";

// ─────────────────────────────────────────────────────────────
//  人脈庫預設排序 (client + server 共用，不得引入 server-only 模組)
//
//  沒有手動拖曳順序 (contacts:order) 時的預設檢視：
//  「同一個合作方向、同一個職業別」的人排在一起，
//  一眼看出各領域目前有哪些可用人脈。
// ─────────────────────────────────────────────────────────────

/** 依 合作方向 → 職業別 → 姓名 分組排序 (穩定、不就地修改) */
export function groupSortContacts(list: Contact[]): Contact[] {
  return [...list].sort((a, b) => {
    // 專案合作 (外包/合夥) 在前，業界合作在後
    if (a.cooperationType !== b.cooperationType) {
      return a.cooperationType === "project" ? -1 : 1;
    }
    const pa = a.profession.trim();
    const pb = b.profession.trim();
    if (pa !== pb) {
      // 沒填職業別的排到該分組最後
      if (!pa) return 1;
      if (!pb) return -1;
      return pa.localeCompare(pb, "zh-Hant");
    }
    return a.name.localeCompare(b.name, "zh-Hant");
  });
}

/** 從多值職業別字串 (「Notion, 網站設計師」) 切出獨立標籤 */
export function professionTokens(profession: string): string[] {
  return profession
    .split(/[,、，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
