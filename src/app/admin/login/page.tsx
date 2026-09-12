"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toFaDigits } from "@/lib/utils";
import { APP_VERSION } from "@/config/version";

/**
 * Admin login — standalone centered card in the OMID visual language. Sends
 * credentials to /api/admin/login; on success the session cookie is already
 * set server-side, so only a client-side redirect to /admin is needed.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "ورود ناموفق بود. دوباره تلاش کنید.");
    } catch {
      setError("خطای شبکه رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-violet/10 blur-[120px]" />
        <div className="absolute bottom-0 left-[15%] h-72 w-72 rounded-full bg-cyan/8 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm">
        {/* brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-cyan text-xl font-bold text-ink">
            O
          </span>
          <h1 className="mt-4 text-xl font-semibold text-paper">
            پنل مدیریت OMID Studio
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            فقط برای مدیران — دسترسی محدود است.
          </p>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-2xl border border-line-strong bg-ink-2/90 p-6 shadow-[0_24px_70px_-30px_rgb(0_0_0/0.9)] backdrop-blur-xl"
        >
          <label htmlFor="admin-username" className="block text-[12px] font-medium text-soft">
            نام کاربری
          </label>
          <input
            id="admin-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-line bg-ink-3 px-3.5 text-[14px] text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
            placeholder="نام کاربری مدیریت"
          />

          <label htmlFor="admin-password" className="mt-4 block text-[12px] font-medium text-soft">
            رمز عبور
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-line bg-ink-3 px-3.5 text-[14px] text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
            placeholder="••••••••"
          />

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[12px] text-paper"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-cyan text-[14px] font-semibold text-ink transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "در حال ورود…" : "ورود به پنل"}
          </button>

          <p className="mt-4 text-center font-mono text-[10px] text-faint">
            نسخه {toFaDigits(APP_VERSION)}
          </p>
        </form>

        <Link
          href="/"
          className="mx-auto mt-6 block w-fit text-[12px] text-muted transition-colors duration-200 hover:text-paper"
        >
          ← بازگشت به وب‌سایت
        </Link>
      </div>
    </div>
  );
}