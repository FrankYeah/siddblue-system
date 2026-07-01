// ─────────────────────────────────────────────────────────────
//  品牌裝飾元素 (Brand Decorative Elements)
//  紙飛機、白色海鷗、程式碼括號 { } — 極簡幾何線條 + 微動畫
//  這些純為裝飾，列印時會被 .no-print 隱藏
// ─────────────────────────────────────────────────────────────

/** 紙飛機 — 極簡幾何，帶漂浮微動畫 */
export function PaperPlane({
  className = "",
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M44 4 4 22l16 6 6 16 18-40Z" />
      <path d="M44 4 20 28" opacity="0.6" />
      <path d="M20 28v10" opacity="0.45" />
    </svg>
  );
}

/** 白色海鷗 — 兩道弧線的極簡剪影 */
export function Seagull({
  className = "",
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size * 0.5}
      viewBox="0 0 48 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 14C8 4 14 4 24 12" />
      <path d="M24 12C34 4 40 4 46 14" />
    </svg>
  );
}

/** 一群飛翔的海鷗 (前台 Banner 用) */
export function SeagullFlock({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <Seagull
        size={34}
        className="absolute left-[10%] top-[22%] text-white/70 animate-gull-glide"
      />
      <Seagull
        size={22}
        className="absolute left-[22%] top-[42%] text-white/50 animate-gull-glide [animation-delay:-2s]"
      />
      <Seagull
        size={28}
        className="absolute right-[16%] top-[30%] text-white/60 animate-gull-glide [animation-delay:-4s]"
      />
      <Seagull
        size={18}
        className="absolute right-[30%] top-[55%] text-white/40 animate-gull-glide [animation-delay:-1s]"
      />
    </div>
  );
}

/** 程式碼括號點綴 { } */
export function CodeBraces({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-mono font-semibold tracking-tight ${className}`}
      aria-hidden="true"
    >
      {"{ }"}
    </span>
  );
}
