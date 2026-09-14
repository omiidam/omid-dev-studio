"use client";

import { useMemo } from "react";
import {
  MANAGED_LIST_ERROR,
  useManagedProjects,
} from "@/lib/managed-project-store";
import { toFaDigits } from "@/lib/utils";
import { ManagedPaymentBadge } from "@/components/admin/managed/badges";

function formatAmount(amount: number): string {
  if (!amount) return "—";
  return `${toFaDigits(amount.toLocaleString("en-US"))} دلار`;
}

/** Financial overview derived from the real API-backed projects. */
export default function ManageFinancePage() {
  const { projects, error, loading } = useManagedProjects();

  const { total, settled, active } = useMemo(() => {
    if (!projects) return { total: 0, settled: 0, active: 0 };
    return {
      total: projects.reduce((sum, project) => sum + project.budget, 0),
      settled: projects
        .filter((project) => project.payment === "paid")
        .reduce((sum, project) => sum + project.budget, 0),
      active: projects.filter((p) => p.status === "in_progress").length,
    };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker">مدیریت</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          مالی
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          نمای کلی مبالغ پروژه‌ها — مدیریت مالی کامل در فاز بعد.
        </p>
      </div>

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
          در حال دریافت…
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-ink-2/80 p-5">
          <p className="text-[11px] font-medium text-muted">مجموع مبالغ</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-paper">
            {formatAmount(total)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-ink-2/80 p-5">
          <p className="text-[11px] font-medium text-muted">تسویه‌شده</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-success">
            {formatAmount(settled)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-ink-2/80 p-5">
          <p className="text-[11px] font-medium text-muted">در انتظار تسویه</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-blue">
            {formatAmount(total - settled)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-ink-2/80 p-5">
          <p className="text-[11px] font-medium text-muted">پروژه‌های فعال</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-cyan">
            {toFaDigits(active)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-ink-2/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-right">
            <thead>
              <tr className="border-b border-line text-[11px] text-faint">
                <th className="px-5 py-3.5 font-medium">پروژه</th>
                <th className="px-4 py-3.5 font-medium">مبلغ</th>
                <th className="px-4 py-3.5 font-medium">پرداخت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(projects ?? []).map((project) => (
                <tr key={project.id} className="hover:bg-ink-3/50">
                  <td className="px-5 py-3.5 text-[13px] font-medium text-paper">
                    {project.name}
                  </td>
                  <td className="px-4 py-3.5 text-[12px] text-soft">
                    {formatAmount(project.budget)}
                  </td>
                  <td className="px-4 py-3.5">
                    <ManagedPaymentBadge status={project.payment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
