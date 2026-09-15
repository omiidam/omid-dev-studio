"use client";

import { useCallback, useEffect, useState } from "react";
import type { ManagedMilestoneRecord, MilestoneInput } from "@/lib/managed-projects";
import {
  MilestoneApiError,
  createMilestoneViaApi,
  deleteMilestoneViaApi,
  fetchMilestones,
  updateMilestoneViaApi,
} from "@/lib/milestone-client";

/**
 * Frontend data source for project milestones (Phase 6).
 *
 * The backend is authoritative: the list always comes from the database via
 * the authenticated API, mutations wait for the confirmed server response,
 * and failures keep the previous state visible with an error message.
 */

const MILESTONE_LIST_ERROR = "دریافت مراحل پروژه ناموفق بود. دوباره تلاش کنید.";

function describeError(cause: unknown, fallback: string): string {
  return cause instanceof MilestoneApiError ? cause.message : fallback;
}

export function useMilestones(projectId: string) {
  const [milestones, setMilestones] = useState<ManagedMilestoneRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const records = await fetchMilestones(projectId);
      setMilestones(records);
      setError(null);
    } catch (cause: unknown) {
      setError(describeError(cause, MILESTONE_LIST_ERROR));
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    // Reset happens inside the async callback chain, not synchronously in
    // the effect body (react-hooks/set-state-in-effect).
    fetchMilestones(projectId)
      .then(
        (records) => {
          if (!cancelled) {
            setMilestones(records);
            setError(null);
          }
        },
        (cause: unknown) => {
          if (!cancelled) {
            setMilestones(null);
            setError(describeError(cause, MILESTONE_LIST_ERROR));
          }
        },
      );
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const create = useCallback(
    async (input: MilestoneInput): Promise<ManagedMilestoneRecord | null> => {
      if (busy) return null;
      setBusy(true);
      setError(null);
      try {
        const created = await createMilestoneViaApi(projectId, input);
        setMilestones((current) =>
          current === null
            ? [created]
            : [...current, created].sort((a, b) => a.order - b.order),
        );
        return created;
      } catch (cause: unknown) {
        setError(describeError(cause, "در ایجاد مرحله مشکلی پیش آمد."));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [busy, projectId],
  );

  const update = useCallback(
    async (
      milestoneId: string,
      input: MilestoneInput,
    ): Promise<ManagedMilestoneRecord | null> => {
      if (busy) return null;
      setBusy(true);
      setError(null);
      try {
        const updated = await updateMilestoneViaApi(projectId, milestoneId, input);
        setMilestones((current) =>
          current === null
            ? [updated]
            : [...current.filter((m) => m.id !== milestoneId), updated].sort(
                (a, b) => a.order - b.order,
              ),
        );
        return updated;
      } catch (cause: unknown) {
        setError(describeError(cause, "در ذخیره‌ی مرحله مشکلی پیش آمد."));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [busy, projectId],
  );

  const remove = useCallback(
    async (milestoneId: string): Promise<boolean> => {
      if (busy) return false;
      setBusy(true);
      setError(null);
      try {
        await deleteMilestoneViaApi(projectId, milestoneId);
        setMilestones((current) =>
          current === null ? null : current.filter((m) => m.id !== milestoneId),
        );
        return true;
      } catch (cause: unknown) {
        setError(describeError(cause, "در حذف مرحله مشکلی پیش آمد."));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, projectId],
  );

  return { milestones, error, busy, reload, create, update, remove };
}

/** Blank milestone form state. */
export function emptyMilestone(order: number): MilestoneInput {
  return {
    title: "",
    description: "",
    status: "pending",
    progress: 0,
    startDate: "",
    deadline: "",
    order,
  };
}
