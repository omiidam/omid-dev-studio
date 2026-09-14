import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ManagedProjectInput,
} from "@/lib/managed-projects";

/**
 * Persistent storage for managed projects (Phase 3).
 *
 * Follows the exact conventions of `project-store.ts`: JSON on the server
 * file system, atomic writes (temp file + rename), serialized read-modify-
 * write so concurrent mutations cannot lose updates, and a small function
 * surface so the backing implementation can later move to a real database
 * without touching the API routes or the UI.
 *
 * Location: `<project>/.data/managed-projects.json`, overridable via
 * OMID_STUDIO_MANAGED_PROJECTS_FILE (documented in .env.example).
 */

export const DEFAULT_MANAGED_PROJECTS_FILE = path.join(
  process.cwd(),
  ".data",
  "managed-projects.json",
);

function storeFile(): string {
  return (
    process.env.OMID_STUDIO_MANAGED_PROJECTS_FILE ??
    DEFAULT_MANAGED_PROJECTS_FILE
  );
}

/** The persisted record shape — extends the shared input with metadata. */
export interface StoredManagedProject extends ManagedProjectInput {
  id: string;
  /** Soft-delete flag — archived records stay queryable, never destroyed. */
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What the API is allowed to create (never id/archived/timestamps). */
export type NewManagedProject = ManagedProjectInput;

/** Explicit update surface — no uncontrolled body spreading reaches here. */
export type ManagedProjectUpdate = Partial<ManagedProjectInput>;

/* ---------------------------------------------------------------------------
 * Serialized file access
 * ------------------------------------------------------------------------ */

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function isStoredProject(value: unknown): value is StoredManagedProject {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.client === "string" &&
    typeof record.status === "string" &&
    typeof record.payment === "string" &&
    typeof record.archived === "boolean" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
}

async function readFileSafe(): Promise<StoredManagedProject[]> {
  const file = storeFile();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Forward-compatible: malformed entries never leak into the API.
    return parsed.filter(isStoredProject);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") return [];
    console.error("[managed-project-db] store unreadable:", error);
    return [];
  }
}

async function writeFileSafe(records: StoredManagedProject[]): Promise<void> {
  const file = storeFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(records, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/* ---------------------------------------------------------------------------
 * Public API — the single data layer the API routes talk to
 * ------------------------------------------------------------------------ */

export interface ManagedProjectQuery {
  status?: string;
  payment?: string;
  type?: string;
  query?: string;
  sort?: "updated" | "deadline" | "progress";
  /** Default false: archived records are excluded from normal listings. */
  includeArchived?: boolean;
}

export function listManagedProjectRecords(
  options: ManagedProjectQuery = {},
): Promise<StoredManagedProject[]> {
  return withLock(async () => {
    let records = await readFileSafe();
    if (!options.includeArchived) {
      records = records.filter((record) => !record.archived);
    }
    if (options.status) {
      records = records.filter((record) => record.status === options.status);
    }
    if (options.payment) {
      records = records.filter((record) => record.payment === options.payment);
    }
    if (options.type) {
      records = records.filter((record) => record.type === options.type);
    }
    const q = options.query?.trim().toLowerCase();
    if (q) {
      records = records.filter(
        (record) =>
          record.name.toLowerCase().includes(q) ||
          record.client.toLowerCase().includes(q) ||
          record.technologies.some((tech) => tech.toLowerCase().includes(q)),
      );
    }
    return [...records].sort((a, b) => {
      if (options.sort === "deadline") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      if (options.sort === "progress") return b.progress - a.progress;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  });
}

export function getManagedProjectRecord(
  id: string,
): Promise<StoredManagedProject | null> {
  return withLock(async () => {
    const records = await readFileSafe();
    return records.find((record) => record.id === id && !record.archived) ?? null;
  });
}

export function createManagedProjectRecord(
  input: NewManagedProject,
): Promise<StoredManagedProject> {
  return withLock(async () => {
    const records = await readFileSafe();
    const now = new Date().toISOString();
    const record: StoredManagedProject = {
      ...input,
      id: randomUUID(),
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    records.push(record);
    await writeFileSafe(records);
    return record;
  });
}

export function updateManagedProjectRecord(
  id: string,
  update: ManagedProjectUpdate,
): Promise<StoredManagedProject | null> {
  return withLock(async () => {
    const records = await readFileSafe();
    const index = records.findIndex(
      (record) => record.id === id && !record.archived,
    );
    if (index === -1) return null;
    const current = records[index];
    // Explicit field-by-field merge — never a spread of unknown body keys.
    const next: StoredManagedProject = {
      ...current,
      ...(update.name !== undefined && { name: update.name }),
      ...(update.client !== undefined && { client: update.client }),
      ...(update.type !== undefined && { type: update.type }),
      ...(update.description !== undefined && { description: update.description }),
      ...(update.status !== undefined && { status: update.status }),
      ...(update.progress !== undefined && { progress: update.progress }),
      ...(update.startDate !== undefined && { startDate: update.startDate }),
      ...(update.deadline !== undefined && { deadline: update.deadline }),
      ...(update.budget !== undefined && { budget: update.budget }),
      ...(update.payment !== undefined && { payment: update.payment }),
      ...(update.demoUrl !== undefined && { demoUrl: update.demoUrl }),
      ...(update.githubUrl !== undefined && { githubUrl: update.githubUrl }),
      ...(update.technologies !== undefined && { technologies: update.technologies }),
      ...(update.notes !== undefined && { notes: update.notes }),
      updatedAt: new Date().toISOString(),
    };
    records[index] = next;
    await writeFileSafe(records);
    return next;
  });
}

/** Soft delete — the record is retained, flagged, and hidden from listings. */
export function archiveManagedProjectRecord(
  id: string,
): Promise<StoredManagedProject | null> {
  return withLock(async () => {
    const records = await readFileSafe();
    const index = records.findIndex(
      (record) => record.id === id && !record.archived,
    );
    if (index === -1) return null;
    const next: StoredManagedProject = {
      ...records[index],
      archived: true,
      updatedAt: new Date().toISOString(),
    };
    records[index] = next;
    await writeFileSafe(records);
    return next;
  });
}
