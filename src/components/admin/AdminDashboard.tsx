"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { InquiryStats } from "@/lib/project-store";
import { toFaDigits } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/badges";

const REFRESH_MS = 60_000;

/**
 * Dashboard rendered from real persisted statistics (computed server-side).
 * Auto-refreshes every minute while the tab is visible so a newly submitted
 * inquiry shows up without manual reloads — a plain data refresh, never a
 * notification, so no duplicate-events risk exists.
 */
export function AdminDashboard({ stats }: { stats: InquiryStats }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  const cards = [
    { label: "درخواست‌های جدید", value: stats.newCount, tone: "text-cyan" },
    { label: "در حال بررسی", value: stats.reviewingCount, tone: "text-violet" },
    { label: "تماس گرفته شده", value: stats.contactedCount, tone: "text-blue" },
    { label: "در حال انجام", value: stats.inProgressCount, tone: "text-blue" },
    { label: "تکمیل شده", value: stats.completedCount, tone: "text-success" },
    { label: "لغو شده", value: stats.cancelledCount, tone: "text-muted" },
  ];

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      router.refresh();
      // refresh() is async on the server; clear the busy state on the next
      // paint so the button is usable again promptly.
      await new Promise((resolve) => setTimeout(resolve, 600));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="kicker">نمای کلی</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
            داشبورد مدیریت
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {toFaDigits(stats.total)} درخواست ثبت‌شده — همه از داده‌ی واقعی.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="shrink-0 rounded-lg border border-line bg-ink-3 px-3.5 py-2 text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? "در حال به‌روزرسانی…" : "به‌روزرسانی"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-line bg-ink-2/80 p-4 transition-colors duration-300 hover:border-line-strong"
          >
            <p className="text-[11px] font-medium text-muted">{card.label}</p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight ${card.tone}`}>
              {toFaDigits(card.value)}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-line bg-ink-2/80">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-paper">
            آخرین درخواست‌ها
          </h2>
          <Link
            href="/admin/projects"
            className="text-[12px] font-medium text-cyan transition-colors duration-200 hover:text-paper"
          >
            مشاهده همه ←
          </Link>
        </div>

        {stats.recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] text-muted">
              هنوز درخواستی ثبت نشده است.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {stats.recent.map((inquiry) => (
              <li key={inquiry.id}>
                <Link
                  href={`/admin/projects/${inquiry.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors duration-200 hover:bg-ink-3/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-paper">
                      {inquiry.name}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      {inquiry.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-[11px] text-faint">
                      {new Intl.DateTimeFormat("fa-IR", {
                        dateStyle: "medium",
                      }).format(new Date(inquiry.createdAt))}
                    </span>
                    <StatusBadge status={inquiry.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}