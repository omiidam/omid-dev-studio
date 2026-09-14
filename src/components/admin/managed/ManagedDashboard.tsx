"use client";

import Link from "next/link";
import { toFaDigits } from "@/lib/utils";
import { getManagedProjectStats, listManagedProjects } from "@/lib/managed-project-store";
import {
  ManagedProgress,
  ManagedStatusBadge,
} from "@/components/admin/managed/badges";

const CARD_TONES = ["text-paper", "text-cyan", "text-success", "text-blue"];

/**
 * Management dashboard — summary cards plus the most recently touched
 * projects. Purely frontend: numbers come from the Phase-1 in-memory store.
 */
export function ManagedDashboard() {
  const stats = getManagedProjectStats();
  const recent = listManagedProjects().slice(0, 5);

  const cards = [
    { label: "کل پروژه‌ها", value: stats.total },
    { label: "در حال انجام", value: stats.inProgress },
    { label: "تکمیل‌شده", value: stats.completed },
    { label: "در انتظار شروع", value: stats.pending },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="kicker">پنل مدیریت پروژه‌ها</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          داشبورد
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          نمای کلی از وضعیت پروژه‌های جاری استودیو.
        </p>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card, index) => (
          <div
            key={card.label}
            className="group rounded-2xl border border-line bg-ink-2/80 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_18px_40px_-24px_rgb(124_140_255/0.35)]"
          >
            <p className="text-[11px] font-medium text-muted">{card.label}</p>
            <p
              className={`mt-2.5 text-3xl font-semibold tracking-tight ${CARD_TONES[index]}`}
            >
              {toFaDigits(card.value)}
            </p>
            <div
              aria-hidden="true"
              className="mt-3 h-0.5 w-8 rounded-full bg-gradient-to-r from-violet to-cyan opacity-60 transition-all duration-300 group-hover:w-12 group-hover:opacity-100"
            />
          </div>
        ))}
      </div>

      {/* recent projects */}
      <section className="rounded-2xl border border-line bg-ink-2/80">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-paper">
            پروژه‌های اخیر
          </h2>
          <Link
            href="/admin/manage/projects"
            className="text-[12px] font-medium text-cyan transition-colors duration-200 hover:text-paper"
          >
            مشاهده همه ←
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-muted">
            هنوز پروژه‌ای ثبت نشده است.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/admin/manage/projects/${project.id}`}
                  className="flex flex-col gap-3 px-5 py-4 transition-colors duration-200 hover:bg-ink-3/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-paper">
                      {project.name}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      {project.client}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <ManagedProgress
                      value={project.progress}
                      showLabel
                      className="w-28"
                    />
                    <ManagedStatusBadge status={project.status} />
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
