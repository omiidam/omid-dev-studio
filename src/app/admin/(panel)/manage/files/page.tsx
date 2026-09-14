"use client";

import { listManagedProjects } from "@/lib/managed-project-store";
import { toFaDigits } from "@/lib/utils";

export default function ManageFilesPage() {
  const projects = listManagedProjects();
  const files = projects.flatMap((project) =>
    project.files.map((file) => ({ ...file, project: project.name })),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="kicker">مدیریت</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          فایل‌ها
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">
          پیوست‌های ثبت‌شده در پروژه‌ها — بارگذاری و مدیریت در فاز بعد.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-ink-2/80">
        {files.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-muted">
            فایلی ثبت نشده است.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-paper" dir="ltr">
                    {file.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    {file.project}
                  </p>
                </div>
                <div className="shrink-0 text-left">
                  <p className="font-mono text-[11px] text-faint">{file.size}</p>
                  <p className="text-[10px] text-faint">{file.kind}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-faint">
        {toFaDigits(files.length)} فایل در {toFaDigits(projects.length)} پروژه
      </p>
    </div>
  );
}
