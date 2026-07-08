"use client";

import { useState } from "react";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { PaperPlane, CodeBraces } from "@/components/BrandDecor";
import { COMPANY_NAME } from "@/lib/defaults";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error || "密碼錯誤，請再試一次");
    } catch {
      setError("登入失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-gradient px-6">
      <PaperPlane
        size={90}
        className="absolute right-[14%] top-[18%] text-white/20 animate-float-plane"
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-float backdrop-blur"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient text-white">
            <Lock size={22} />
          </div>
          <h1 className="text-lg font-semibold text-paper-text">
            {COMPANY_NAME}
          </h1>
          <p className="mt-1 text-sm text-paper-muted">
            報價後台 <CodeBraces className="text-brand-500" /> 請輸入密碼
          </p>
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoFocus
            className="field-input pr-11"
            placeholder="後台密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-paper-muted transition hover:bg-paper-block hover:text-paper-text"
            title={showPassword ? "隱藏密碼" : "顯示密碼"}
            aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary mt-4 w-full" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          登入
        </button>
      </form>
    </main>
  );
}
