import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 品牌深藍漸層色階 (海洋與天空)
        brand: {
          50: "#eef4ff",
          100: "#dbe6ff",
          200: "#bfd3ff",
          300: "#93b4ff",
          400: "#6fb1fc", // 天空淺藍
          500: "#4364f7", // 中段藍
          600: "#0052d4", // 深海藍 (主色)
          700: "#0043ad",
          800: "#003a8c",
          900: "#00224d",
        },
        // Notion 風格中性色
        paper: {
          bg: "#fbfaf7", // 淡米色
          block: "#f7f6f3", // 區塊灰
          border: "#e9e8e3",
          text: "#37352f",
          muted: "#787066",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "\"PingFang TC\"",
          "\"Noto Sans TC\"",
          "\"Microsoft JhengHei\"",
          "sans-serif",
        ],
        mono: [
          "\"SF Mono\"",
          "\"JetBrains Mono\"",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #0052d4 0%, #4364f7 55%, #6fb1fc 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, #003a8c 0%, #0052d4 50%, #4364f7 100%)",
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)",
        float: "0 12px 40px rgba(0, 82, 212, 0.18)",
      },
      keyframes: {
        "float-plane": {
          "0%, 100%": { transform: "translate(0, 0) rotate(-8deg)" },
          "50%": { transform: "translate(10px, -12px) rotate(-4deg)" },
        },
        "gull-glide": {
          "0%": { transform: "translateX(-10px) translateY(0)", opacity: "0.6" },
          "50%": { transform: "translateX(6px) translateY(-6px)", opacity: "1" },
          "100%": { transform: "translateX(-10px) translateY(0)", opacity: "0.6" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // 純 opacity 進場（不留下 transform）：供含拖曳的面板使用，
        // 避免 transform 建立 containing block 破壞 @hello-pangea/dnd 的 fixed 定位
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "float-plane": "float-plane 6s ease-in-out infinite",
        "gull-glide": "gull-glide 7s ease-in-out infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
