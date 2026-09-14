"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toFaDigits } from "@/lib/utils";
import { APP_VERSION } from "@/config/version";

/**
 * Admin login form — visual structure from the attached reference (card-in-
 * card gradient frame, inset-shadow icon fields, centered heading) rebuilt in
 * the OMID Studio violet→cyan system with RTL layout. Reference colors
 * (green/neon) are deliberately NOT copied — the OMID token system is the
 * source of truth for identity; the reference defines only composition.
 *
 * Behavior: POST /api/admin/login sets the httpOnly session cookie server-
 * side; success then only needs a client redirect — to `nextPath` when the
 * server validated it as a same-site admin path, otherwise /admin.
 */

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="size-4 shrink-0 text-cyan/80"
    >
      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6.5a5 5 0 0 1 10 0 .5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="size-4 shrink-0 text-cyan/80"
    >
      <path d="M8 1a2.5 2.5 0 0 1 2.5 2.5V5h-5V3.5A2.5 2.5 0 0 1 8 1Zm3.5 4V3.5a3.5 3.5 0 1 0-7 0V5a2 2 0 0 0-2 2v5.5a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
    </svg>
  );
}

export function AdminLoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || succeeded) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (response.ok) {
        setSucceeded(true); // keeps the button disabled across the redirect
        router.replace(nextPath);
        router.refresh();
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "ورود ناموفق بود. دوباره تلاش کنید.");
    } catch {
      setError("در برقراری ارتباط با سرور مشکلی پیش آمد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-16">
      {/* ambient backdrop — same language as the panel chrome */}
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

        {/* reference structure: gradient frame card → inner dark card */}
        <div className="rounded-3xl bg-gradient-to-br from-violet via-blue to-cyan p-px shadow-[0_0_60px_-16px_rgb(124_140_255/0.45)] transition-shadow duration-300 hover:shadow-[0_0_70px_-14px_rgb(124_140_255/0.6)]">
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="rounded-[calc(1.5rem-1px)] bg-ink-2/95 px-6 pb-4 pt-7 backdrop-blur-xl"
          >
            <p
              id="login-heading"
              className="text-center text-[15px] font-semibold text-gradient"
            >
              ورود به پنل مدیریت
            </p>

            {/* reference field treatment: inset shadow + leading icon */}
            <label htmlFor="admin-username" className="sr-only">
              ایمیل / نام کاربری
            </label>
            <div className="mt-6 flex h-12 items-center gap-2.5 rounded-2xl bg-ink-3 px-4 shadow-[inset_2px_5px_10px_rgb(0_0_0/0.5)] transition-colors duration-200 focus-within:ring-1 focus-within:ring-cyan/50">
              <UserIcon />
              <input
                id="admin-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-full w-full bg-transparent text-[14px] text-paper placeholder:text-faint focus:outline-none"
                placeholder="ایمیل / نام کاربری"
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>

            <label htmlFor="admin-password" className="sr-only">
              رمز عبور
            </label>
            <div className="mt-3 flex h-12 items-center gap-2.5 rounded-2xl bg-ink-3 px-4 shadow-[inset_2px_5px_10px_rgb(0_0_0/0.5)] transition-colors duration-200 focus-within:ring-1 focus-within:ring-cyan/50">
              <LockIcon />
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-full w-full bg-transparent text-[14px] text-paper placeholder:text-faint focus:outline-none"
                placeholder="رمز عبور"
                aria-describedby={error ? "login-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "پنهان‌کردن رمز" : "نمایش رمز"}
                aria-pressed={showPassword}
                className="shrink-0 text-faint transition-colors duration-200 hover:text-cyan"
              >
                {showPassword ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="size-4"
                  >
                    <path d="m11.5 5.2 1.4-1.4a6 6 0 0 1 1.9 2.9.7.7 0 0 1 0 .6 6 6 0 0 1-2 2.9L11.4 8.8a3 3 0 0 0 .1-3.6Zm-1.5 1.5-3.7-3.6A6 6 0 0 1 8 2.7c2.5 0 4.6 1.5 5.5 3.6l-1.5 1.5A3.5 3.5 0 0 0 10 6.7ZM3.1 3.8l10.6 10.6-1 1L10.9 13.6a6.4 6.4 0 0 1-2.9.7c-2.5 0-4.6-1.5-5.5-3.6a.7.7 0 0 1 0-.6 6 6 0 0 1 2-2.9L2 5.9l1-1Zm3.5 3.5a2.5 2.5 0 0 0 3 3.1l-3-3.1Z" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="size-4"
                  >
                    <path d="M8 3c2.8 0 5.1 1.7 6 4.2a.7.7 0 0 1 0 .6C13.1 10.3 10.8 12 8 12S2.9 10.3 2 7.8a.7.7 0 0 1 0-.6C2.9 4.7 5.2 3 8 3Zm0 1.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <p
                id="login-error"
                role="alert"
                className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[12px] text-paper"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || succeeded}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-cyan text-[14px] font-semibold text-ink transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="size-4 animate-spin"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6"
                      stroke="currentColor"
                      strokeOpacity="0.3"
                      strokeWidth="2"
                    />
                    <path
                      d="M14 8a6 6 0 0 0-6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  در حال ورود…
                </>
              ) : succeeded ? (
                "خوش آمدید — در حال انتقال…"
              ) : (
                "ورود به پنل مدیریت"
              )}
            </button>

            <p className="mt-4 text-center font-mono text-[10px] text-faint">
              نسخه {toFaDigits(APP_VERSION)}
            </p>
          </form>
        </div>

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
