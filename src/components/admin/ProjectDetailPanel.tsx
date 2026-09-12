"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Priority, ProjectStatus } from "@/lib/project-schema";
import { PRIORITY_LABELS, PROJECT_STATUS_LABELS } from "@/lib/project-schema";
import { STATUS_STYLE } from "@/lib/project-status";
import { cn } from "@/lib/utils";
import type { StoredInquiry } from "@/lib/project-store";

/**
 * Admin editor for a single inquiry: status, priority and internal notes.
 * Every change is validated again on the server (canonical enums) — the UI
 * only ever sends language-neutral codes, never the Persian labels.
 */
export function ProjectDetailPanel({ inquiry }: { inquiry: StoredInquiry }) {
  const router = useRouter();
  const [status, setStatus] = useState<ProjectStatus>(inquiry.status);
  const [priority, setPriority] = useState<Priority | "">(
    inquiry.priority ?? "",
  );
  const [notes, setNotes] = useState(inquiry.adminNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    { ok: boolean; text: string } | null
  >(null);

  const dirty =
    status !== inquiry.status ||
    ((priority as Priority | "") || "") !==
      (inquiry.priority ?? "") ||
    notes.trim() !== (inquiry.adminNotes ?? "");

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/projects/${inquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          priority: priority === "" ? null : priority,
          adminNotes: notes.trim() === "" ? null : notes.trim(),
        }),
      });
      if (response.ok) {
        setMessage({ ok: true, text: "تغییرات ذخیره شد." });
        router.refresh();
      } else {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setMessage({
          ok: false,
          text: payload?.error?.message ?? "ذخیره‌سازی ناموفق بود.",
        });
      }
    } catch {
      setMessage({ ok: false, text: "خطای شبکه رخ داد." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSave(event)}
      className="rounded-2xl border border-line bg-ink-2/80"
    >
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold text-paper">مدیریت درخواست</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          وضعیت، اولویت و یادداشت‌های داخلی.
        </p>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="inquiry-status"
            className="block text-[12px] font-medium text-soft"
          >
            وضعیت پروژه
          </label>
          <select
            id="inquiry-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus)}
            className="mt-2 h-11 w-full appearance-none rounded-xl border border-line bg-ink-3 px-3.5 text-[13px] text-paper focus:border-cyan/60 focus:outline-none"
          >
            {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-2 inline-block">
            <CurrentStatusBadge status={status} />
          </span>
        </div>

        <div>
          <label
            htmlFor="inquiry-priority"
            className="block text-[12px] font-medium text-soft"
          >
            اولویت سرنخ
          </label>
          <select
            id="inquiry-priority"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as Priority | "")
            }
            className="mt-2 h-11 w-full appearance-none rounded-xl border border-line bg-ink-3 px-3.5 text-[13px] text-paper focus:border-cyan/60 focus:outline-none"
          >
            <option value="">بدون اولویت</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="inquiry-notes"
            className="block text-[12px] font-medium text-soft"
          >
            یادداشت‌های داخلی
          </label>
          <textarea
            id="inquiry-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="یادداشت خصوصی مدیر درباره‌ی این پروژه…"
            className="mt-2 w-full resize-y rounded-xl border border-line bg-ink-3 px-3.5 py-3 text-[13px] leading-relaxed text-paper placeholder:text-faint focus:border-cyan/60 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
        <button
          type="submit"
          disabled={busy || !dirty}
          className="h-10 rounded-xl bg-gradient-to-r from-violet to-cyan px-5 text-[13px] font-semibold text-ink transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={cn(
              "text-[12px]",
              message.ok ? "text-success" : "text-danger",
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

function CurrentStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset",
        STATUS_STYLE[status],
      )}
    >
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}