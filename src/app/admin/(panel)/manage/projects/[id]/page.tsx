"use client";

import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ManagedProjectDetail } from "@/components/admin/managed/ManagedProjectDetail";
import {
  ManagedDetailSkeleton,
  ManagedDetailStateless,
} from "@/components/admin/managed/ManagedDetailStates";
import { useManagedArchive, useManagedProject } from "@/lib/managed-project-store";

/** Phase 5 — managed project details from the real API, plus the real
 * archive/restore action (soft delete; the database record is never
 * destroyed) behind an explicit confirmation dialog. */
export default function ManagedProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const { project, error, notFound, loading, reload } = useManagedProject(id);
  const { archive, restore, busy, error: archiveError } = useManagedArchive(id);
  const [confirming, setConfirming] = useState(false);

  async function handleArchive() {
    const ok = await archive();
    setConfirming(false);
    if (ok) {
      reload();
      router.refresh();
    }
  }

  async function handleRestore() {
    const ok = await restore();
    if (ok) {
      reload();
      router.refresh();
    }
  }

  if (notFound) {
    return <ManagedDetailStateless message="پروژه پیدا نشد." />;
  }
  if (error) {
    return <ManagedDetailStateless message={error} />;
  }
  if (loading || !project) {
    return <ManagedDetailSkeleton />;
  }

  return (
    <>
      <ManagedProjectDetail
        project={project}
        archived={Boolean(project.archived)}
        action={
          project.archived ? (
            <button
              type="button"
              onClick={() => void handleRestore()}
              disabled={busy !== null}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 text-[13px] font-medium text-success transition-opacity duration-200 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "restore" ? "در حال بازگردانی…" : "بازگردانی پروژه"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy !== null}
              className="inline-flex h-10 items-center rounded-xl border border-danger/30 bg-danger/5 px-4 text-[13px] font-medium text-danger transition-colors duration-200 hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              بایگانی پروژه
            </button>
          )
        }
      />
      {archiveError && (
        <p role="alert" className="mt-3 text-[12px] text-danger">
          {archiveError}
        </p>
      )}

      {/* archive confirmation — the destructive action is never accidental */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="archive-title" className="text-[15px] font-semibold text-paper">
              بایگانی پروژه
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-soft">
              پروژه‌ی «{project.name}» به فهرست پروژه‌های فعال دیگر نمایش داده
              نمی‌شود. رکورد در پایگاه داده حفظ می‌شود و می‌توانید بعداً آن را
              بازگردانید.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-9 rounded-xl px-4 text-[12px] font-medium text-muted transition-colors duration-200 hover:text-paper"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={busy !== null}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-danger px-4 text-[12px] font-semibold text-paper transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "archive" ? "در حال بایگانی…" : "بایگانی"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
