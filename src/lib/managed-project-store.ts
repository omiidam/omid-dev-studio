"use client";

import type {
  ManagedProject,
  ManagedProjectInput,
} from "@/lib/managed-projects";
import {
  managedProjectSeed,
  emptyProject,
} from "@/data/admin/projects";

/**
 * Frontend data source for the Project Management Panel — Phase 1.
 *
 * Phase 1 keeps everything in a module-scoped in-memory store seeded from the
 * isolated demo data. This module is the ONLY seam the UI talks to: when the
 * Phase 2 backend lands, these functions become `fetch("/api/...")` calls
 * (or server actions) with the exact same signatures — no UI rewrite.
 *
 * The store is intentionally client-side and non-persistent: reloading the
 * panel restores the demo state. Nothing here touches the real backend.
 */

let projects: ManagedProject[] = managedProjectSeed.map((project) => ({
  ...project,
}));

function nowIso() {
  return new Date().toISOString();
}

function nextId() {
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

export interface ManagedProjectStats {
  total: number;
  inProgress: number;
  completed: number;
  pending: number;
}

export function getManagedProjectStats(): ManagedProjectStats {
  return {
    total: projects.length,
    inProgress: projects.filter((p) => p.status === "in_progress").length,
    completed: projects.filter((p) => p.status === "completed").length,
    pending: projects.filter((p) => p.status === "pending").length,
  };
}

export function listManagedProjects(): ManagedProject[] {
  return [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getManagedProject(id: string): ManagedProject | null {
  return projects.find((project) => project.id === id) ?? null;
}

export function createManagedProject(input: ManagedProjectInput): ManagedProject {
  const now = nowIso();
  const project: ManagedProject = {
    ...input,
    id: nextId(),
    createdAt: now,
    updatedAt: now,
    timeline: [],
    milestones: [],
    activity: [
      { id: nextId(), at: now, text: "پروژه ایجاد شد." },
    ],
    files: [],
  };
  projects = [project, ...projects];
  return project;
}

export function updateManagedProject(
  id: string,
  input: ManagedProjectInput,
): ManagedProject | null {
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return null;
  const current = projects[index];
  const next: ManagedProject = {
    ...current,
    ...input,
    updatedAt: nowIso(),
    activity: [
      {
        id: nextId(),
        at: nowIso(),
        text: "اطلاعات پروژه ویرایش شد.",
      },
      ...current.activity,
    ].slice(0, 12),
  };
  projects = projects.map((project, i) => (i === index ? next : project));
  return next;
}

export { emptyProject };
