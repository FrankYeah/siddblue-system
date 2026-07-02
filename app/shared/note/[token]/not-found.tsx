import Link from "next/link";
import { PaperPlane } from "@/components/BrandDecor";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-gradient px-6 text-center text-white">
      <PaperPlane
        size={100}
        className="absolute right-[16%] top-[20%] text-white/20 animate-float-plane"
      />
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-3 text-lg text-white/85">
        找不到這則筆記，連結可能已失效或未開啟分享。
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 shadow-float transition hover:bg-brand-50"
      >
        回到首頁
      </Link>
    </main>
  );
}
