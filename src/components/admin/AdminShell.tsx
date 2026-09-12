"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { APP_VERSION } from "@/config/version";
import { toFaDigits } from "@/lib/utils";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "داشبورد", match: (path: string) => path === "/admin" },
  {
    href: "/admin/projects",
    label: "درخواست‌های پروژه",
    match: (path: string) => path.startsWith("/admin/projects"),
  },
];

/**
 * Admin chrome — top bar + navigation for the management area. Stays within
 * the OMID Studio visual language (same tokens, same typography) but drops
 * the public marketing chrome. Lightweight: no heavy animation, native scroll.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* the cookie still gets cleared on the next successful call */
    }
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-svh">
      {/* fixed glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
      >
        <div className="absolute -top-40 right-[10%] h-96 w-96 rounded-full bg-violet/10 blur-[120px]" />
        <div className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-cyan/8 blur-[120px]" />
      </div>

      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet to-cyan text-sm font-bold text-ink">
              O
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-paper">
                OMID Studio — پنل مدیریت
              </p>
              <p className="font-mono text-[10px] text-faint">
                نسخه {toFaDigits(APP_VERSION)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-lg border border-line bg-ink-3 px-3 py-2 text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper sm:inline-flex"
            >
              مشاهده سایت
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger transition-colors duration-200 hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "خروج…" : "خروج"}
            </button>
          </div>
        </div>
      </header>

      {/* desktop sidebar nav */}
      <nav
        aria-label="مدیریت"
        className="sticky top-16 z-30 border-b border-line bg-ink/80 backdrop-blur-xl lg:border-b-0"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 sm:px-6">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-3.5 text-[13px] font-medium transition-colors duration-200",
                  active
                    ? "border-transparent text-cyan"
                    : "border-transparent border-line text-muted hover:text-paper",
                )}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-violet to-cyan"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}