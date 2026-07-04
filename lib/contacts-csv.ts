import type {
  ContactInput,
  ContactLevel,
  ContactStatus,
  CooperationType,
} from "./types";

// ─────────────────────────────────────────────────────────────
//  人脈庫 CSV 匯入解析 (前端使用，client-safe)
//
//  依表頭中文欄名對應欄位 (欄位順序不拘、可缺欄)：
//    姓名 / 職業別 / 聯絡方式 / 網址 / 熟悉度 / 喜好度 / 能力值 /
//    價格 / 狀態 / 合作方向 / 匯款資訊 / 備註
//  評級值 高/中/低/不確定、狀態 就業/接案/創業/學生、
//  合作方向 專案合作/業界合作，皆以「包含關鍵字」寬鬆比對，
//  無法辨識或未填時歸為 unknown (合作方向預設專案合作)。
// ─────────────────────────────────────────────────────────────

/** RFC 4180 風格 CSV 解析：支援引號欄位、欄內逗號/換行、"" 跳脫、BOM */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 去除整列空白的資料列
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

type ContactField = keyof ContactInput;

/** 表頭別名 → 欄位 (寬鬆比對：表頭「包含」別名即命中) */
const HEADER_ALIASES: [ContactField, string[]][] = [
  ["name", ["姓名", "名字", "name"]],
  ["profession", ["職業別", "職業", "職稱", "profession"]],
  ["contactInfo", ["聯絡方式", "聯絡資訊", "聯繫方式", "contact"]],
  ["url", ["網址", "連結", "url", "link", "website"]],
  ["familiarity", ["熟悉度", "熟悉", "familiarity"]],
  ["liking", ["喜好度", "喜好", "liking"]],
  ["ability", ["能力值", "能力", "ability"]],
  ["price", ["價格", "價位", "price"]],
  ["status", ["狀態", "就業狀態", "status"]],
  ["cooperationType", ["合作方向", "合作類型", "合作分類", "cooperation"]],
  ["transferInfo", ["匯款資訊", "匯款", "帳號資訊"]],
  ["note", ["備註", "筆記", "note", "memo"]],
];

function matchField(header: string): ContactField | null {
  const h = header.trim().toLowerCase();
  if (!h) return null;
  for (const [field, aliases] of HEADER_ALIASES) {
    if (aliases.some((a) => h.includes(a.toLowerCase()))) return field;
  }
  return null;
}

function parseLevel(raw: string): ContactLevel {
  const v = raw.trim().toLowerCase();
  if (!v) return "unknown";
  // Notion 多選匯出會是「中, 高」這類複合值：取較明確者 (高 > 低 > 中)
  if (v.includes("高") || v.includes("high")) return "high";
  if (v.includes("低") || v.includes("low")) return "low";
  if (v.includes("中") || v.includes("medium")) return "medium";
  return "unknown"; // 「不確定」等無法辨識的值
}

function parseStatus(raw: string): ContactStatus {
  const v = raw.trim().toLowerCase();
  if (!v) return "unknown";
  if (v.includes("就業") || v.includes("employ")) return "employed";
  if (v.includes("創業") || v.includes("startup")) return "startup";
  if (v.includes("學生") || v.includes("student")) return "student";
  if (v.includes("接案") || v.includes("freelance")) return "freelance";
  return "unknown";
}

function parseCooperation(raw: string): CooperationType {
  const v = raw.trim().toLowerCase();
  if (
    v.includes("業界") ||
    v.includes("網紅") ||
    v.includes("互惠") ||
    v.includes("industry")
  ) {
    return "industry";
  }
  return "project";
}

export interface ContactsCsvResult {
  /** 可匯入的聯絡人 (依 CSV 由上而下順序) */
  contacts: ContactInput[];
  /** 因缺姓名而略過的資料列數 */
  skipped: number;
  /** 資料列總數 (不含表頭) */
  total: number;
}

/**
 * 解析人脈庫 CSV 內文。
 * 第一列視為表頭；找不到「姓名」欄時擲出錯誤 (整份無法對應)。
 */
export function parseContactsCsv(text: string): ContactsCsvResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("CSV 內容不足：至少需要表頭與一列資料");
  }

  const header = rows[0];
  const columnMap = new Map<number, ContactField>();
  header.forEach((h, i) => {
    const field = matchField(h);
    if (field && !Array.from(columnMap.values()).includes(field)) {
      columnMap.set(i, field);
    }
  });

  if (!Array.from(columnMap.values()).includes("name")) {
    throw new Error("找不到「姓名」欄位，請確認第一列為表頭且包含「姓名」");
  }

  const contacts: ContactInput[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const raw: Partial<Record<ContactField, string>> = {};
    columnMap.forEach((field, i) => {
      raw[field] = String(row[i] ?? "").trim();
    });

    if (!raw.name) {
      skipped++;
      continue;
    }
    contacts.push({
      name: raw.name,
      profession: raw.profession ?? "",
      contactInfo: raw.contactInfo ?? "",
      url: raw.url ?? "",
      familiarity: parseLevel(raw.familiarity ?? ""),
      liking: parseLevel(raw.liking ?? ""),
      ability: parseLevel(raw.ability ?? ""),
      price: parseLevel(raw.price ?? ""),
      status: parseStatus(raw.status ?? ""),
      cooperationType: parseCooperation(raw.cooperationType ?? ""),
      transferInfo: raw.transferInfo ?? "",
      note: raw.note ?? "",
    });
  }

  return { contacts, skipped, total: rows.length - 1 };
}
