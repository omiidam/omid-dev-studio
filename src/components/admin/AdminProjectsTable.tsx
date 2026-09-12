"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { StoredInquiry } from "@/lib/project-store";
import type { ProjectStatus } from "@/lib/project-schema";
import { toFaDigits } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PriorityBadge, StatusBadge } from "@/components/admin/badges";

interface AdminProjectsTableProps {
  inquiries: StoredInquiry[];
  total: number;
  statusOptions: { value: ProjectStatus; label: string }[];
}

function buildUrl(
  pathname: string,
  searchParams: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams(searchParams);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Admin projects list with real server-side filtering/sorting. Every control
 * writes to the URL search params so the server re-renders from the actual
 * persisted store — no fabricated client datasets anywhere.
 */
export function AdminProjectsTable({
  inquiries,
  total,
  statusOptions,
}: AdminProjectsTableProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = (searchParams.get("status") ?? "") as
    | ProjectStatus
    | "";
  const sort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";
  const query = searchParams.get("q") ?? "";

  const [draft, setDraft] = useState(query);
  const submittedDraft = useMemo(() => query, [query]);

  function apply(patch: Record<string, string | null>) {
    router.push(buildUrl(pathname, searchParams, patch));
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    apply(value ? { q: value } : { q: null });
  }

  return (
    <div className="space-y-4">
      {/* filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-ink-2/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => apply({ status: null })}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors duration-200",
              !currentStatus
                ? "bg-gradient-to-r from-violet to-cyan text-ink ring-transparent"
                : "bg-ink-3 text-muted ring-line hover:text-paper",
            )}
          >
            همه
          </button>
          <span
            aria-hidden="true"
            className="mx-0.5 hidden h-4 w-px bg-line lg:block"
          />
          {statusOptions.map((option) => {
            const active = currentStatus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => apply({ status: option.value })}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset transition-colors duration-200",
                  active
                    ? "bg-cyan/15 text-cyan ring-cyan/25"
                    : "bg-ink-3 text-muted ring-line hover:text-paper",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <form
            onSubmit={handleSearch}
            className="relative min-w-0 flex-1 lg:w-56 lg:flex-none"
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="جستجو…"
              className="h-9 w-full rounded-lg border border-line bg-ink-3 pr-9 pl-3 text-[12px] text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
            />
          </form>
          <div className="flex shrink-0 items-center rounded-lg border border-line bg-ink-3">
            <button
              type="button"
              onClick={() => apply({ sort: null })}
              className={cn(
                "h-9 rounded-r-lg px-3 text-[11px] font-medium transition-colors duration-200",
                sort === "newest" ? "text-cyan" : "text-muted hover:text-paper",
              )}
            >
              جدیدترین
            </button>
            <button
              type="button"
              onClick={() => apply({ sort: "oldest" })}
              className={cn(
                "h-9 rounded-l-lg border-r border-line px-3 text-[11px] font-medium transition-colors duration-200",
                sort === "oldest" ? "text-cyan" : "text-muted hover:text-paper",
              )}
            >
              قدیمی‌ترین
            </button>
          </div>
        </div>
      </div>

      {submittedDraft && (
        <p className="text-[12px] text-muted">
          نتایج جستجو برای «{submittedDraft}» —{" "}
          <button
            type="button"
            onClick={() => apply({ q: null })}
            className="font-medium text-cyan hover:text-paper"
          >
            پاک کردن
          </button>
        </p>
      )}

      <p className="text-[12px] text-faint">
        {toFaDigits(inquiries.length)} مورد از {toFaDigits(total)} درخواست
      </p>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-ink-2/80">
        {inquiries.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-[14px] text-muted">
              درخواستی با این فیلترها پیدا نشد.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead>
                <tr className="border-b border-line text-[11px] text-faint">
                  <th className="px-5 py-3.5 font-medium">مشتری</th>
                  <th className="hidden px-4 py-3.5 font-medium md:table-cell">
                    نوع پروژه
                  </th>
                  <th className="hidden px-4 py-3.5 font-medium lg:table-cell">
                    بودجه
                  </th>
                  <th className="px-4 py-3.5 font-medium">تاریخ ارسال</th>
                  <th className="px-4 py-3.5 font-medium">وضعیت</th>
                  <th className="px-4 py-3.5 font-medium">اولویت</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inquiries.map((inquiry) => (
                  <tr
                    key={inquiry.id}
                    className="group transition-colors duration-150 hover:bg-ink-3/50"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/projects/${inquiry.id}`}
                        className="block max-w-[220px]"
                      >
                        <span className="block truncate text-[13px] font-medium text-paper group-hover:text-cyan">
                          {inquiry.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {inquiry.email}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3.5 text-[12px] text-muted md:table-cell">
                      {projectTypeLabel(inquiry.projectType)}
                    </td>
                    <td className="hidden px-4 py-3.5 text-[12px] text-muted lg:table-cell">
                      {budgetLabel(inquiry.budget)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-faint">
                      {formatDate(inquiry.createdAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={inquiry.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      {inquiry.priority ? (
                        <PriorityBadge priority={inquiry.priority} />
                      ) : (
                        <span className="text-[11px] text-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/projects/${inquiry.id}`}
                        aria-label={`مشاهده جزئیات ${inquiry.name}`}
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
    </div>
  );
}

function projectTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    website: "وب‌سایت",
    webapp: "وب‌اپلیکیشن",
    saas: "محصول SaaS",
    ecommerce: "فروشگاه",
    dashboard: "داشبورد / پنل",
    other: "چیز دیگر",
  };
  return labels[value] ?? value;
}

function budgetLabel(value: string): string {
  const labels: Record<string, string> = {
    under_2000: "زیر ۲٬۰۰۰ دلار",
    "2000_5000": "۲ تا ۵ هزار دلار",
    "5000_15000": "۵ تا ۱۵ هزار دلار",
    over_15000: "بیش از ۱۵ هزار دلار",
    unsure: "مطمئن نیست",
  };
  return labels[value] ?? value;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}