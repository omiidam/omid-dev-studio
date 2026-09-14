"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import type { ManagedProject } from "@/lib/managed-projects";
import { MANAGED_TYPE_LABELS } from "@/lib/managed-projects";
import { toFaDigits } from "@/lib/utils";
import {
  ManagedPaymentBadge,
  ManagedProgress,
  ManagedStatusBadge,
} from "@/components/admin/managed/badges";

function formatDate(value: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatBudget(amount: number): string {
  if (!amount) return "—";
  return `${toFaDigits(amount.toLocaleString("en-US"))} دلار`;
}

/** Section shell — consistent with the existing admin area's cards. */
function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-ink-2/80">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold text-paper">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-soft">{children}</dd>
    </div>
  );
}

/**
 * Managed project details — all fields plus timeline/milestones/activity/
 * files sections (frontend UI only, Phase 1). Data comes from the Phase-1
 * store; links out for demo/GitHub render only when set.
 */
export function ManagedProjectDetail({ project }: { project: ManagedProject }) {
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/manage/projects"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper"
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
        بازگشت به پروژه‌ها
      </Link>

      {/* header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-ink-2/80 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="kicker">{MANAGED_TYPE_LABELS[project.type]}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
              {project.name}
            </h1>
            <p className="mt-1 text-[13px] text-muted">{project.client}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ManagedStatusBadge status={project.status} />
              <ManagedPaymentBadge status={project.payment} />
            </div>
          </div>
          <Link
            href={`/admin/manage/projects/${project.id}/edit`}
            className="inline-flex h-10 shrink-0 items-center rounded-xl border border-line bg-ink-3 px-4 text-[13px] font-medium text-paper transition-colors duration-200 hover:border-cyan/40 hover:text-cyan"
          >
            ویرایش پروژه
          </Link>
        </div>
        <ManagedProgress value={project.progress} showLabel className="max-w-sm" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          {/* overview */}
          <Section title="اطلاعات پروژه">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="تاریخ شروع">{formatDate(project.startDate)}</Field>
              <Field label="مهلت تحویل">{formatDate(project.deadline)}</Field>
              <Field label="مبلغ پروژه">{formatBudget(project.budget)}</Field>
              <Field label="وضعیت پرداخت">
                <ManagedPaymentBadge status={project.payment} />
              </Field>
              <Field label="لینک نمایشی">
                {project.demoUrl ? (
                  <a
                    href={project.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="block break-all text-cyan transition-colors duration-200 hover:text-paper"
                  >
                    {project.demoUrl}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="مخزن گیت‌هاب">
                {project.githubUrl ? (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="block break-all text-cyan transition-colors duration-200 hover:text-paper"
                  >
                    {project.githubUrl}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <div className="sm:col-span-2">
                <dt className="kicker">توضیحات</dt>
                <dd className="mt-2 whitespace-pre-wrap text-[13px] leading-7 text-soft">
                  {project.description || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="kicker">تکنولوژی‌ها</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {project.technologies.length === 0
                    ? "—"
                    : project.technologies.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-full bg-ink-3 px-2.5 py-1 text-[11px] font-medium text-soft ring-1 ring-inset ring-line"
                        >
                          {tech}
                        </span>
                      ))}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="kicker">یادداشت خصوصی</dt>
                <dd className="mt-2 whitespace-pre-wrap text-[13px] leading-7 text-soft">
                  {project.notes || "—"}
                </dd>
              </div>
            </dl>
          </Section>

          {/* timeline */}
          <Section title="خط زمانی پروژه">
            {project.timeline.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">
                رویدادی ثبت نشده است.
              </p>
            ) : (
              <ol className="relative space-y-6 border-r border-line pr-5">
                {project.timeline.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -right-[26px] top-1 size-2.5 rounded-full bg-gradient-to-br from-violet to-cyan ring-4 ring-ink-2"
                    />
                    <p className="font-mono text-[11px] text-faint">
                      {formatDate(event.date)}
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-paper">
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="mt-1 text-[12px] leading-6 text-muted">
                        {event.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          {/* milestones */}
          <Section title="نقاط عطف">
            {project.milestones.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">
                نقطه‌عطفی تعریف نشده است.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {project.milestones.map((milestone) => (
                  <li
                    key={milestone.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-ink-3/60 px-3.5 py-3"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        milestone.done
                          ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
                          : "flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-3 ring-1 ring-inset ring-line-strong/40"
                      }
                    >
                      {milestone.done ? (
                        <svg viewBox="0 0 12 12" className="size-3" fill="none">
                          <path
                            d="m2.5 6.5 2 2 5-5.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <span className="size-1.5 rounded-full bg-faint" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          milestone.done
                            ? "text-[13px] text-muted line-through"
                            : "text-[13px] font-medium text-paper"
                        }
                      >
                        {milestone.title}
                      </p>
                      {milestone.dueDate && (
                        <p className="mt-0.5 font-mono text-[10px] text-faint">
                          {formatDate(milestone.dueDate)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* activity */}
          <Section title="فعالیت اخیر">
            {project.activity.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">
                فعالیتی ثبت نشده است.
              </p>
            ) : (
              <ul className="space-y-4">
                {project.activity.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan/70"
                    />
                    <div>
                      <p className="text-[13px] leading-6 text-soft">
                        {item.text}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-faint">
                        {formatDateTime(item.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* files */}
          <Section title="فایل‌ها">
            {project.files.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">
                فایلی پیوست نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {project.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-3 text-[10px] font-semibold text-muted ring-1 ring-inset ring-line">
                        {file.kind}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-paper" dir="ltr">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-faint">
                          {file.size} · {formatDate(file.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
