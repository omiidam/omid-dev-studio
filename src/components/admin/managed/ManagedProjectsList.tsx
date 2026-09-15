"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  ManagedProject,
  ManagedProjectStatus,
  PaymentStatus,
} from "@/lib/managed-projects";
import {
  MANAGED_TYPE_LABELS,
  managedPaymentOptions,
  managedStatusOptions,
} from "@/lib/managed-projects";
import { toFaDigits } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ManagedPaymentBadge,
  ManagedProgress,
  ManagedStatusBadge,
} from "@/components/admin/managed/badges";
import {
  MANAGED_LIST_ERROR,
  useManagedProjects,
} from "@/lib/managed-project-store";

/** Server-renderable heading + create action (plain markup, no store access). */
export function ManagedProjectsHeading() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">مدیریت</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          پروژه‌ها
        </h1>
      </div>
      <Link
        href="/admin/manage/projects/new"
        className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-violet to-cyan px-4 text-[13px] font-semibold text-ink transition-opacity duration-200 hover:opacity-90"
      >
        ایجاد پروژه
      </Link>
    </div>
  );
}

type SortKey = "updated" | "deadline" | "progress";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "آخرین فعالیت" },
  { value: "deadline", label: "مهلت تحویل" },
  { value: "progress", label: "پیشرفت" },
];

/**
 * Managed-projects list — search, three filters and sort. Data comes from
 * the real authenticated API (Phase 3); filtering/sorting stay client-side
 * over the fetched records. On desktop a polished table; on small screens
 * each row collapses into a card so nothing overflows horizontally.
 */
export function ManagedProjectsList() {
  // Phase 5: the toggle pulls archived records too, so soft-deleted projects
  // stay identifiable; the default view remains active-only.
  const [showArchived, setShowArchived] = useState(false);
  const { projects, error, loading } = useManagedProjects({
    includeArchived: showArchived,
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ManagedProjectStatus | "">("");
  const [type, setType] = useState("");
  const [payment, setPayment] = useState<PaymentStatus | "">("");
  const [sort, setSort] = useState<SortKey>("updated");

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = query.trim().toLowerCase();
    const result = projects.filter((project) => {
      // When archived records are loaded, they always carry the flag; the
      // archived view shows them exclusively so the two lists stay clean.
      if (showArchived !== Boolean(project.archived)) return false;
      if (status && project.status !== status) return false;
      if (type && project.type !== type) return false;
      if (payment && project.payment !== payment) return false;
      if (!q) return true;
      return (
        project.name.toLowerCase().includes(q) ||
        project.client.toLowerCase().includes(q) ||
        project.technologies.some((tech) =>
          tech.toLowerCase().includes(q),
        )
      );
    });
    return [...result].sort((a, b) => {
      if (sort === "deadline") {
        // Undated last; RTL text order irrelevant to the comparison.
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      if (sort === "progress") return b.progress - a.progress;
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, [query, status, type, payment, sort, projects, showArchived]);

  const activeTypeOptions = useMemo(() => {
    if (!projects) return [];
    const seen = new Set(projects.map((project) => project.type));
    return Object.entries(MANAGED_TYPE_LABELS)
      .filter(([value]) => seen.has(value as ManagedProject["type"]))
      .map(([value, label]) => ({ value, label }));
  }, [projects]);

  function resetFilters() {
    setQuery("");
    setStatus("");
    setType("");
    setPayment("");
    setSort("updated");
  }

  const hasFilters = query.trim() !== "" || status !== "" || type !== "" || payment !== "";

  return (
    <div className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4 text-[13px] text-danger"
        >
          {MANAGED_LIST_ERROR}
        </div>
      )}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-line bg-ink-2/60 px-5 py-4 text-[13px] text-muted"
        >
          در حال دریافت پروژه‌ها…
        </div>
      )}
      {/* toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-ink-2/80 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* search */}
          <form
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="relative min-w-0 flex-1 sm:w-52 sm:flex-none"
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="m10.5 10.5 3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجوی پروژه، مشتری…"
              aria-label="جستجو در پروژه‌ها"
              className="h-9 w-full rounded-lg border border-line bg-ink-3 pr-9 pl-3 text-[12px] text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
            />
          </form>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ManagedProjectStatus | "")
            }
            aria-label="فیلتر وضعیت پروژه"
            className="h-9 rounded-lg border border-line bg-ink-3 px-2.5 text-[12px] text-paper focus:border-cyan/60 focus:outline-none"
          >
            <option value="">همه وضعیت‌ها</option>
            {managedStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="فیلتر نوع پروژه"
            className="h-9 rounded-lg border border-line bg-ink-3 px-2.5 text-[12px] text-paper focus:border-cyan/60 focus:outline-none"
          >
            <option value="">همه انواع</option>
            {activeTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={payment}
            onChange={(event) =>
              setPayment(event.target.value as PaymentStatus | "")
            }
            aria-label="فیلتر وضعیت پرداخت"
            className="h-9 rounded-lg border border-line bg-ink-3 px-2.5 text-[12px] text-paper focus:border-cyan/60 focus:outline-none"
          >
            <option value="">همه پرداخت‌ها</option>
            {managedPaymentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 rounded-lg px-2.5 text-[12px] font-medium text-cyan transition-colors duration-200 hover:text-paper"
            >
              پاک کردن
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-faint">
              {toFaDigits(filtered.length)} از {toFaDigits(projects?.length ?? 0)} پروژه
            </p>
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((value) => !value)}
              className={cn(
                "text-[11px] font-medium transition-colors duration-200",
                showArchived ? "text-cyan" : "text-muted hover:text-paper",
              )}
            >
              {showArchived ? "مشاهده پروژه‌های فعال" : "نمایش بایگانی‌شده‌ها"}
            </button>
          </div>
          <div className="flex items-center rounded-lg border border-line bg-ink-3">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-medium transition-colors duration-200 first:rounded-r-lg last:rounded-l-lg",
                  sort === option.value
                    ? "text-cyan"
                    : "text-muted hover:text-paper",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-ink-2/80 lg:block">
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center text-[14px] text-muted">
            {showArchived
              ? "پروژه‌ی بایگانی‌شده‌ای پیدا نشد."
              : "پروژه‌ای با این فیلترها پیدا نشد."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-right">
              <thead>
                <tr className="border-b border-line text-[11px] text-faint">
                  <th className="px-5 py-3.5 font-medium">پروژه</th>
                  <th className="hidden px-4 py-3.5 font-medium xl:table-cell">نوع</th>
                  <th className="px-4 py-3.5 font-medium">پیشرفت</th>
                  <th className="px-4 py-3.5 font-medium">شروع</th>
                  <th className="px-4 py-3.5 font-medium">مهلت</th>
                  <th className="px-4 py-3.5 font-medium">وضعیت</th>
                  <th className="px-4 py-3.5 font-medium">پرداخت</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    className="group transition-colors duration-150 hover:bg-ink-3/50"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/manage/projects/${project.id}`}
                        className="block max-w-[240px]"
                      >
                        <span className="block truncate text-[13px] font-medium text-paper group-hover:text-cyan">
                          {project.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {project.client}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3.5 text-[12px] text-muted xl:table-cell">
                      {MANAGED_TYPE_LABELS[project.type]}
                    </td>
                    <td className="px-4 py-3.5">
                      <ManagedProgress
                        value={project.progress}
                        showLabel
                        className="w-28"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-faint">
                      {project.startDate ? toFaDigits(project.startDate) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-faint">
                      {project.deadline ? toFaDigits(project.deadline) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      {project.archived ? (
                        <span className="inline-flex items-center rounded-full bg-ink-3 px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-inset ring-line-strong/40">
                          بایگانی‌شده
                        </span>
                      ) : (
                        <ManagedStatusBadge status={project.status} />
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <ManagedPaymentBadge status={project.payment} />
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/manage/projects/${project.id}`}
                        aria-label={`مشاهده جزئیات ${project.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-200 group-hover:border-cyan/40 group-hover:text-cyan"
                      >
                        <svg
                          aria-hidden="true"
                          className="size-4 -scale-x-100"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M13 8H3m0 0 3.5-3.5M3 8l3.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* mobile cards */}
      <div className="space-y-3 lg:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-line bg-ink-2/80 px-5 py-12 text-center text-[14px] text-muted">
            پروژه‌ای با این فیلترها پیدا نشد.
          </div>
        ) : (
          filtered.map((project) => (
            <Link
              key={project.id}
              href={`/admin/manage/projects/${project.id}`}
              className={cn(
                "block rounded-2xl border p-4 transition-colors duration-200",
                project.archived
                  ? "border-dashed border-line-strong/60 bg-ink-2/60"
                  : "border-line bg-ink-2/80 hover:border-line-strong",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-paper">
                    {project.name}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {project.client} · {MANAGED_TYPE_LABELS[project.type]}
                  </p>
                </div>
                <ManagedStatusBadge status={project.status} />
              </div>
              <ManagedProgress value={project.progress} showLabel className="mt-3" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
                <span className="font-mono">
                  مهلت: {project.deadline ? toFaDigits(project.deadline) : "—"}
                </span>
                <ManagedPaymentBadge status={project.payment} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
