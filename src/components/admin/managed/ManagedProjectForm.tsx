"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ManagedProject,
  ManagedProjectInput,
  ManagedProjectStatus,
  PaymentStatus,
} from "@/lib/managed-projects";
import {
  managedPaymentOptions,
  managedStatusOptions,
  managedTypeOptions,
} from "@/lib/managed-projects";
import { emptyProject } from "@/lib/managed-project-store";
import {
  createManagedProjectViaApi,
  updateManagedProjectViaApi,
  ManagedProjectApiError,
} from "@/lib/managed-project-client";
import { toFaDigits } from "@/lib/utils";
import { cn } from "@/lib/utils";

const inputClasses =
  "mt-2 h-11 w-full rounded-xl border border-line bg-ink-3 px-3.5 text-[13px] text-paper placeholder:text-faint transition-colors duration-200 focus:border-cyan/60 focus:outline-none";
const labelClasses = "block text-[12px] font-medium text-soft";

/**
 * Create/edit form for managed projects. The same component serves both
 * directions: `project` absent → create, present → edit. Submission goes to
 * the real authenticated API (Phase 3); the backend is authoritative — the
 * UI navigates only after a confirmed server response.
 */
export function ManagedProjectForm({
  project,
}: {
  project?: ManagedProject;
}) {
  const router = useRouter();
  const isEdit = Boolean(project);
  const [form, setForm] = useState<ManagedProjectInput>(
    project
      ? {
          name: project.name,
          client: project.client,
          type: project.type,
          description: project.description,
          status: project.status,
          progress: project.progress,
          startDate: project.startDate,
          deadline: project.deadline,
          budget: project.budget,
          payment: project.payment,
          demoUrl: project.demoUrl,
          githubUrl: project.githubUrl,
          technologies: project.technologies,
          notes: project.notes,
        }
      : emptyProject(),
  );
  const [techDraft, setTechDraft] = useState(project?.technologies.join("، ") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof ManagedProjectInput>(
    key: K,
    value: ManagedProjectInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return; // no duplicate submissions
    const name = form.name.trim();
    const client = form.client.trim();
    if (!name || !client) {
      setError("نام پروژه و نام مشتری الزامی است.");
      return;
    }
    setError(null);

    const technologies = techDraft
      .split(/[،,]/)
      .map((tech) => tech.trim())
      .filter(Boolean);

    const input: ManagedProjectInput = {
      ...form,
      name,
      client,
      progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
      budget: Math.max(0, Number(form.budget) || 0),
      technologies,
    };

    setSubmitting(true);
    try {
      const saved = isEdit && project
        ? await updateManagedProjectViaApi(project.id, input)
        : await createManagedProjectViaApi(input);
      router.push(`/admin/manage/projects/${saved.id}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ManagedProjectApiError
          ? cause.message
          : "در ذخیره‌ی پروژه مشکلی پیش آمد.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <a
        href={
          isEdit && project
            ? `/admin/manage/projects/${project.id}`
            : "/admin/manage/projects"
        }
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
        {isEdit ? "بازگشت به پروژه" : "بازگشت به پروژه‌ها"}
      </a>

      <div>
        <p className="kicker">مدیریت</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
          {isEdit ? "ویرایش پروژه" : "ایجاد پروژه"}
        </h1>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event);
        }}
        className="rounded-2xl border border-line bg-ink-2/80"
      >
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="mp-name" className={labelClasses}>
              نام پروژه <span className="text-danger">*</span>
            </label>
            <input
              id="mp-name"
              type="text"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              required
              maxLength={120}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="mp-client" className={labelClasses}>
              نام مشتری <span className="text-danger">*</span>
            </label>
            <input
              id="mp-client"
              type="text"
              value={form.client}
              onChange={(event) => set("client", event.target.value)}
              required
              maxLength={120}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="mp-type" className={labelClasses}>
              نوع پروژه
            </label>
            <select
              id="mp-type"
              value={form.type}
              onChange={(event) =>
                set("type", event.target.value as ManagedProjectInput["type"])
              }
              className={inputClasses}
            >
              {managedTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="mp-description" className={labelClasses}>
              توضیحات
            </label>
            <textarea
              id="mp-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="خلاصه‌ای از دامنه و اهداف پروژه…"
              className="mt-2 w-full resize-y rounded-xl border border-line bg-ink-3 px-3.5 py-3 text-[13px] leading-7 text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="mp-status" className={labelClasses}>
              وضعیت
            </label>
            <select
              id="mp-status"
              value={form.status}
              onChange={(event) =>
                set("status", event.target.value as ManagedProjectStatus)
              }
              className={inputClasses}
            >
              {managedStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mp-progress" className={labelClasses}>
              درصد پیشرفت — {toFaDigits(form.progress)}٪
            </label>
            <input
              id="mp-progress"
              type="range"
              min={0}
              max={100}
              value={form.progress}
              onChange={(event) => set("progress", Number(event.target.value))}
              className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-cyan"
            />
          </div>

          <div>
            <label htmlFor="mp-start" className={labelClasses}>
              تاریخ شروع
            </label>
            <input
              id="mp-start"
              type="date"
              value={form.startDate}
              onChange={(event) => set("startDate", event.target.value)}
              className={cn(inputClasses, "font-mono text-[12px]")}
            />
          </div>

          <div>
            <label htmlFor="mp-deadline" className={labelClasses}>
              مهلت تحویل (Deadline)
            </label>
            <input
              id="mp-deadline"
              type="date"
              value={form.deadline}
              onChange={(event) => set("deadline", event.target.value)}
              className={cn(inputClasses, "font-mono text-[12px]")}
            />
          </div>

          <div>
            <label htmlFor="mp-budget" className={labelClasses}>
              مبلغ پروژه (دلار)
            </label>
            <input
              id="mp-budget"
              type="number"
              min={0}
              value={form.budget || ""}
              onChange={(event) => set("budget", Number(event.target.value))}
              placeholder="0"
              className={cn(inputClasses, "text-left")}
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="mp-payment" className={labelClasses}>
              وضعیت پرداخت
            </label>
            <select
              id="mp-payment"
              value={form.payment}
              onChange={(event) =>
                set("payment", event.target.value as PaymentStatus)
              }
              className={inputClasses}
            >
              {managedPaymentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mp-demo" className={labelClasses}>
              لینک Demo
            </label>
            <input
              id="mp-demo"
              type="url"
              value={form.demoUrl}
              onChange={(event) => set("demoUrl", event.target.value)}
              placeholder="https://…"
              dir="ltr"
              className={cn(inputClasses, "text-left")}
            />
          </div>

          <div>
            <label htmlFor="mp-github" className={labelClasses}>
              لینک GitHub
            </label>
            <input
              id="mp-github"
              type="url"
              value={form.githubUrl}
              onChange={(event) => set("githubUrl", event.target.value)}
              placeholder="https://github.com/…"
              dir="ltr"
              className={cn(inputClasses, "text-left")}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="mp-tech" className={labelClasses}>
              تکنولوژی‌ها
            </label>
            <input
              id="mp-tech"
              type="text"
              value={techDraft}
              onChange={(event) => setTechDraft(event.target.value)}
              placeholder="Next.js، TypeScript، PostgreSQL"
              className={inputClasses}
            />
            <p className="mt-1.5 text-[11px] text-faint">
              با ویرگول جدا کنید.
            </p>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="mp-notes" className={labelClasses}>
              یادداشت خصوصی
            </label>
            <textarea
              id="mp-notes"
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="یادداشت‌هایی که فقط برای شما قابل مشاهده است…"
              className="mt-2 w-full resize-y rounded-xl border border-line bg-ink-3 px-3.5 py-3 text-[13px] leading-7 text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-cyan px-5 text-[13px] font-semibold text-ink transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <svg
                aria-hidden="true"
                className="size-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeOpacity="0.35"
                  strokeWidth="3"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {submitting
              ? isEdit
                ? "در حال ذخیره…"
                : "در حال ایجاد…"
              : isEdit
                ? "ذخیره تغییرات"
                : "ایجاد پروژه"}
          </button>
          <a
            href={
              isEdit && project
                ? `/admin/manage/projects/${project.id}`
                : "/admin/manage/projects"
            }
            className="text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper"
          >
            انصراف
          </a>
          {error && (
            <p role="alert" className="text-[12px] text-danger">
              {error}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
