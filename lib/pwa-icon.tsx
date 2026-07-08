import type { ReactElement } from "react";

// ─────────────────────────────────────────────────────────────
//  PWA / 瀏覽器分頁圖示的共用視覺設計
//  沿用網站識別：品牌藍色漸層 + 白色 "{ }" 括號標記 (見 components/BrandDecor.tsx)
//  由 app/icon.tsx / app/apple-icon.tsx 以 next/og 的 ImageResponse 產生，
//  避免手動準備多組 PNG 檔、也確保各尺寸圖示視覺一致。
// ─────────────────────────────────────────────────────────────

export function brandIconElement(size: number): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0052D4 0%, #4364F7 55%, #6FB1FC 100%)",
        borderRadius: size * 0.22,
      }}
    >
      <span
        style={{
          color: "#fff",
          fontSize: size * 0.48,
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        {"{ }"}
      </span>
    </div>
  );
}
