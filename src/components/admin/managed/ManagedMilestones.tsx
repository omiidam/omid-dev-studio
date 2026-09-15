"use client";

import { useState } from "react";
import type {
  ManagedMilestoneRecord,
  MilestoneInput,
  MilestoneStatus,
} from "@/lib/managed-projects";
import {
  MILESTONE_STATUS_LABELS,
  MILESTONE_STATUS_STYLE,
  milestoneStatusOptions,
} from "@/lib/managed-projects";
import { cn, toFaDigits } from "@/lib/utils";
import { emptyMilestone, useMilestones } from "@/lib/milestone-store";

/**
 * Project milestones / timeline (Phase 6) — rendered from real database
 * rows in their persisted order. Each stage is editable/deletable through
 * the authenticated API; overdue is computed live from the persisted
 * deadline (never a stored flag). Project-level progress and status remain
 * separate fields — no automatic aggregation is applied here.
 */

const inputClasses =
  "mt-1.5 h-9 w-full rounded-lg border border-line bg-ink-3 px-3 text-[12px] text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none";
const labelClasses = "block text-[11px] font-medium text-soft";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}

function StatusPill({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        MILESTONE_STATUS_STYLE[status],
      )}
    >
      <span aria-hidden="true" className="size-1 rounded-full bg-current" />
      {MILESTONE_STATUS_LABELS[status]}
    </span>
  );
}

/** Overdue is derived live: not completed + persisted deadline in the past. */
function isOverdue(milestone: ManagedMilestoneRecord): boolean {
  return (
    milestone.status !== "completed" &&
    milestone.deadline !== "" &&
    Date.parse(milestone.deadline) < Date.now()
  );
}

/** Dot on the timeline spine — state derived from real data. */
function StageDot({ milestone }: { milestone: ManagedMilestoneRecord }) {
  const completed = milestone.status === "completed";
  const active = milestone.status === "in_progress";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -right-[26.5px] top-1 size-3 rounded-full ring-4 ring-ink-2",
        completed
          ? "bg-success"
          : active
            ? "bg-gradient-to-br from-violet to-cyan"
            : isOverdue(milestone)
              ? "bg-danger"
              : "bg-ink-3 ring-line-strong/40",
      )}
    />
  );
}

export function ManagedMilestones({ projectId }: { projectId: string }) {
  const { milestones, error, busy, create, update, remove } = useMilestones(projectId);
  const [editing, setEditing] = useState<
    { mode: "create" } | { mode: "edit"; milestone: ManagedMilestoneRecord } | null
  >(null);
  const [confirmingDelete, setConfirmingDelete] = useState<ManagedMilestoneRecord | null>(null);

  const list = milestones ?? [];
  const nextOrder = list.length === 0 ? 0 : Math.max(...list.map((m) => m.order)) + 1;

  return (
    <section className="rounded-2xl border border-line bg-ink-2/80">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-paper">مراحل پروژه</h2>
          <p className="mt-0.5 text-[11px] text-faint">
            خط زمانی از مراحل واقعی ثبت‌شده در پایگاه داده
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing({ mode: "create" })}
            className="inline-flex h-8 items-center rounded-lg border border-line bg-ink-3 px-3 text-[12px] font-medium text-paper transition-colors duration-200 hover:border-cyan/40 hover:text-cyan"
          >
            افزودن مرحله
          </button>
        )}
      </div>

      <div className="p-5">
        {error && (
          <p role="alert" className="mb-4 text-[12px] text-danger">
            {error}
          </p>
        )}

        {milestones === null ? (
          <div className="py-6 text-center text-[13px] text-muted" role="status">
            در حال دریافت مراحل…
          </div>
        ) : list.length === 0 && !editing ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-muted">
              هنوز مرحله‌ای برای این پروژه ثبت نشده است.
            </p>
            <button
              type="button"
              onClick={() => setEditing({ mode: "create" })}
              className="mt-3 inline-flex h-8 items-center rounded-lg border border-line bg-ink-3 px-3 text-[12px] font-medium text-cyan transition-colors duration-200 hover:text-paper"
            >
              افزودن مرحله
            </button>
          </div>
        ) : (
          <>
            {/* timeline */}
            <ol className="relative space-y-5 border-r border-line pr-6">
              {list.map((milestone) => (
                <li key={milestone.id} className="relative">
                  <StageDot milestone={milestone} />
                  <div
                    className={cn(
                      "rounded-xl border px-4 py-3",
                      isOverdue(milestone)
                        ? "border-danger/40 bg-danger/5"
                        : "border-line bg-ink-3/50",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] text-faint">
                            {toFaDigits(milestone.order + 1)}
                          </span>
                          <p className="text-[13px] font-medium text-paper">
                            {milestone.title}
                          </p>
                          <StatusPill status={milestone.status as MilestoneStatus} />
                          {isOverdue(milestone) && (
                            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger ring-1 ring-inset ring-danger/25">
                              از مهلت گذشته
                            </span>
                          )}
                        </div>
                        {milestone.description && (
                          <p className="mt-1 text-[12px] leading-6 text-muted">
                            {milestone.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
                          <span>شروع: {formatDate(milestone.startDate || null)}</span>
                          <span>مهلت: {formatDate(milestone.deadline || null)}</span>
                          {milestone.completedAt && (
                            <span>تکمیل: {formatDate(milestone.completedAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`ویرایش ${milestone.title}`}
                          onClick={() => setEditing({ mode: "edit", milestone })}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-200 hover:border-cyan/40 hover:text-cyan"
                        >
                          <svg aria-hidden="true" className="size-3.5" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M11.3 2.1a1.7 1.7 0 0 1 2.4 2.4L5 13.2l-3.2.8.8-3.2 8.7-8.7Z"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`حذف ${milestone.title}`}
                          onClick={() => setConfirmingDelete(milestone)}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-200 hover:border-danger/40 hover:text-danger"
                        >
                          <svg aria-hidden="true" className="size-3.5" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M3 4h10M6.5 4V2.8c0-.4.3-.8.8-.8h1.4c.5 0 .8.4.8.8V4m2.7 0-.4 8.6c0 .9-.7 1.6-1.6 1.6H5.8c-.9 0-1.6-.7-1.6-1.6L3.8 4"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* milestone progress */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div
                        role="progressbar"
                        aria-valuenow={milestone.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-1 flex-1 overflow-hidden rounded-full bg-ink-3 ring-1 ring-inset ring-line"
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet to-cyan transition-[width] duration-500"
                          style={{ width: `${milestone.progress}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 font-mono text-[10px] text-muted">
                        {toFaDigits(milestone.progress)}٪
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {editing && (
              <MilestoneForm
                projectId={projectId}
                editing={editing.mode === "edit" ? editing.milestone : null}
                initial={
                  editing.mode === "edit"
                    ? editing.milestone
                    : emptyMilestone(nextOrder)
                }
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={async (input) => {
                  const ok =
                    editing.mode === "edit"
                      ? (await update(editing.milestone.id, input)) !== null
                      : (await create(input)) !== null;
                  if (ok) setEditing(null);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* delete confirmation — destructive action is never accidental */}
      {confirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          onClick={() => setConfirmingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="milestone-delete-title" className="text-[15px] font-semibold text-paper">
              حذف مرحله
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-soft">
              مرحله‌ی «{confirmingDelete.title}» برای همیشه حذف می‌شود. این
              عملیات بازگشت‌پذیر نیست.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(null)}
                className="h-9 rounded-xl px-4 text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  await remove(confirmingDelete.id);
                  setConfirmingDelete(null);
                }}
                className="inline-flex h-9 items-center rounded-xl bg-danger px-4 text-[12px] font-semibold text-paper transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "در حال حذف…" : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Create/edit milestone form — all fields, Persian labels, no fake success. */
function MilestoneForm({
  editing,
  initial,
  busy,
  onCancel,
  onSave,
}: {
  projectId: string;
  editing: ManagedMilestoneRecord | null;
  initial: MilestoneInput;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: MilestoneInput) => Promise<void>;
}) {
  const [form, setForm] = useState<MilestoneInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof MilestoneInput>(key: K, value: MilestoneInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || busy) return;
    if (!form.title.trim()) {
      setError("عنوان مرحله الزامی است.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
        order: Math.max(0, Math.trunc(Number(form.order) || 0)),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(event);
      }}
      className="mt-5 rounded-xl border border-line bg-ink-3/40 p-4"
    >
      <p className="text-[13px] font-semibold text-paper">
        {editing ? `ویرایش مرحله` : "مرحله‌ی جدید"}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="ms-title" className={labelClasses}>
            عنوان مرحله <span className="text-danger">*</span>
          </label>
          <input
            id="ms-title"
            type="text"
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            required
            maxLength={120}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="ms-status" className={labelClasses}>
            وضعیت
          </label>
          <select
            id="ms-status"
            value={form.status}
            onChange={(event) => set("status", event.target.value as MilestoneStatus)}
            className={inputClasses}
          >
            {milestoneStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ms-progress" className={labelClasses}>
            درصد پیشرفت — {toFaDigits(form.progress)}٪
          </label>
          <input
            id="ms-progress"
            type="range"
            min={0}
            max={100}
            value={form.progress}
            onChange={(event) => set("progress", Number(event.target.value))}
            className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-3 accent-cyan"
          />
        </div>
        <div>
          <label htmlFor="ms-start" className={labelClasses}>
            تاریخ شروع
          </label>
          <input
            id="ms-start"
            type="date"
            value={form.startDate}
            onChange={(event) => set("startDate", event.target.value)}
            className={cn(inputClasses, "font-mono")}
          />
        </div>
        <div>
          <label htmlFor="ms-deadline" className={labelClasses}>
            مهلت
          </label>
          <input
            id="ms-deadline"
            type="date"
            value={form.deadline}
            onChange={(event) => set("deadline", event.target.value)}
            className={cn(inputClasses, "font-mono")}
          />
        </div>
        <div>
          <label htmlFor="ms-order" className={labelClasses}>
            ترتیب
          </label>
          <input
            id="ms-order"
            type="number"
            min={0}
            value={form.order}
            onChange={(event) => set("order", Number(event.target.value))}
            className={cn(inputClasses, "text-left")}
            dir="ltr"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="ms-description" className={labelClasses}>
            توضیحات
          </label>
          <textarea
            id="ms-description"
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            rows={2}
            maxLength={1000}
            className="mt-1.5 w-full resize-y rounded-lg border border-line bg-ink-3 px-3 py-2 text-[12px] leading-6 text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving || busy}
          className="inline-flex h-9 items-center rounded-xl bg-gradient-to-r from-violet to-cyan px-4 text-[12px] font-semibold text-ink transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "افزودن مرحله"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper"
        >
          انصراف
        </button>
        {error && (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
