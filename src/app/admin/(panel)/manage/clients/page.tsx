"use client";

import { listManagedProjects } from "@/lib/managed-project-store";
import { toFaDigits } from "@/lib/utils";

export default function ManageClientsPage() {
  const byClient = new Map<string, number>();
  for (const project of listManagedProjects()) {
    byClient.set(project.client, (byClient.get(project.client) ?? 0) + 1);
  }
  const clients = [...byClient.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker">مدیریت</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          مشتریان
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          فهرست مشتریان بر اساس پروژه‌های ثبت‌شده — نسخه‌ی کامل در فاز بعد.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map(([client, count]) => (
          <div
            key={client}
            className="rounded-2xl border border-line bg-ink-2/80 p-5 transition-colors duration-200 hover:border-line-strong"
          >
            <p className="truncate text-[14px] font-medium text-paper">
              {client}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {toFaDigits(count)} پروژه
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
