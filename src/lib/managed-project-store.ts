"use client";

import { useCallback, useEffect, useState } from "react";
import type { ManagedProject } from "@/lib/managed-projects";
import { emptyProject } from "@/data/admin/projects";
import {
  ManagedProjectApiError,
  fetchManagedProject,
  fetchManagedProjects,
} from "@/lib/managed-project-client";

/**
 * Frontend data source for the Project Management Panel — Phase 3.
 *
 * The panel UI is unchanged from Phase 1; only this seam changed. The store
 * is now a React hook over the real authenticated API: the backend is
 * authoritative, every list/detail fetch re-reads the persisted records, and
 * there is no client-side mock data in production paths.
 *
 * `emptyProject` and the record shape stay re-exported so consumers keep
 * their exact Phase-1 call signatures.
 */

export interface ManagedProjectStats {
  total: number;
  inProgress: number;
  completed: number;
  pending: number;
}

export const MANAGED_LIST_ERROR =
  "دریافت فهرست پروژه‌ها ناموفق بود. دوباره تلاش کنید.";

export const MANAGED_NOT_FOUND = "پروژه پیدا نشد.";

function describeError(cause: unknown): string {
  return cause instanceof ManagedProjectApiError
    ? cause.message
    : MANAGED_LIST_ERROR;
}

/** Single-record variant for detail/edit pages (re-fetches on id change). */
export function useManagedProject(id: string) {
  // State carries the id it was loaded for, so a navigation between projects
  // never renders the previous project while the next fetch is in flight.
  const [state, setState] = useState<{
    id: string;
    project: ManagedProject | null;
    error: string | null;
    notFound: boolean;
  }>({ id, project: null, error: null, notFound: false });

  useEffect(() => {
    let cancelled = false;
    fetchManagedProject(id)
      .then((record) => {
        if (!cancelled) {
          setState({ id, project: record, error: null, notFound: false });
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const notFound =
          cause instanceof ManagedProjectApiError && cause.code === "NOT_FOUND";
        setState({
          id,
          project: null,
          error: notFound ? null : describeError(cause),
          notFound,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = state.id === id ? state : null;
  return {
    project: current?.project ?? null,
    error: current?.error ?? null,
    notFound: current?.notFound ?? false,
    loading: current === null || current.project === null,
  };
}

interface ListState {
  /** Which reload cycle the payload belongs to. */
  key: number;
  projects: ManagedProject[] | null;
  error: string | null;
}

export function useManagedProjects() {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<ListState>({
    key: 0,
    projects: null,
    error: null,
  });

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchManagedProjects()
      .then((records) => {
        if (!cancelled) {
          setState({ key: reloadKey, projects: records, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          // Keep the previous list visible on refresh failures.
          setState((prev) => ({
            key: reloadKey,
            projects: prev.projects,
            error: describeError(cause),
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const current = state.key === reloadKey ? state : null;
  return {
    projects: current?.projects ?? null,
    error: current?.error ?? null,
    loading: current === null || current.projects === null,
    reload,
  };
}

export function computeManagedProjectStats(
  projects: ManagedProject[],
): ManagedProjectStats {
  return {
    total: projects.length,
    inProgress: projects.filter((p) => p.status === "in_progress").length,
    completed: projects.filter((p) => p.status === "completed").length,
    pending: projects.filter((p) => p.status === "pending").length,
  };
}

export { emptyProject };
