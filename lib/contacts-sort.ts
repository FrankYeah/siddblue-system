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

/** 職業別標籤調色盤 (Tailwind class 需為完整字面值，JIT 才掃得到) */
const PROFESSION_PALETTE = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-lime-100 text-lime-700",
  "bg-cyan-100 text-cyan-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
  "bg-pink-100 text-pink-700",
];

/**
 * 後備取色：字串雜湊 (供尚未進到色表的新標籤使用)。
 */
export function professionColor(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (h * 31 + token.charCodeAt(i)) >>> 0;
  }
  return PROFESSION_PALETTE[h % PROFESSION_PALETTE.length];
}

/**
 * 依「排序後的獨特標籤」循環指派調色盤：
 * 相鄰的職業別 (= 分組排序後相鄰的群) 必為不同色，辨識度最高；
 * 雜湊取色會撞色，故以此為主、雜湊為後備。
 */
export function buildProfessionColorMap(
  tokens: string[],
): Map<string, string> {
  const sorted = Array.from(new Set(tokens)).sort((a, b) =>
    a.localeCompare(b, "zh-Hant"),
  );
  const map = new Map<string, string>();
  sorted.forEach((t, i) =>
    map.set(t, PROFESSION_PALETTE[i % PROFESSION_PALETTE.length]),
  );
  return map;
}
