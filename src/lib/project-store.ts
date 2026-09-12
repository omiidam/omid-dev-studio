import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PROJECT_STATUSES,
  type Priority,
  type ProjectStatus,
} from "@/lib/project-schema";

/**
 * Persistent storage for project inquiries.
 *
 * Records are stored as JSON on the server file system so that data survives
 * application restarts — no in-memory array or browser storage masquerading as
 * a database. Writes are atomic (temp file + rename) and serialized so
 * concurrent submissions cannot lose updates.
 *
 * The store is intentionally behind small functions with a plain-data shape:
 * swapping the backing implementation for a real database later only changes
 * this module — not the API routes or the UI.
 *
 * Location is configurable via OMID_STUDIO_DATA_FILE (defaults to
 * `<project>/.data/inquiries.json`). The directory is created on first write.
 *
 * Phase 11 extends each record with lightweight lead-management fields
 * (priority, adminNotes) and a full status lifecycle. Records persisted by an
 * older release (status "closed") are migrated to the current lifecycle value
 * ("completed") on read, so existing data is preserved untouched on disk.
 */

export const DEFAULT_INQUIRIES_FILE = path.join(
  process.cwd(),
  ".data",
  "inquiries.json",
);

function inquiriesFile(): string {
  return process.env.OMID_STUDIO_DATA_FILE ?? DEFAULT_INQUIRIES_FILE;
}

/* ---------------------------------------------------------------------------
 * Types — the persisted record shape (internal, language-neutral)
 * ------------------------------------------------------------------------ */

/** Legacy status value written by releases before the full lifecycle. */
const LEGACY_CLOSED_STATUS = "closed";

export interface StoredInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  projectType: string;
  budget: string;
  description: string;
  referenceUrl?: string;
  status: ProjectStatus;
  /** Lightweight CRM fields — added in Phase 11. */
  priority?: Priority;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/** What the POST endpoint is allowed to create (never the status/id/timestamps). */
export type NewInquiry = Pick<
  StoredInquiry,
  | "name"
  | "email"
  | "phone"
  | "company"
  | "projectType"
  | "budget"
  | "description"
  | "referenceUrl"
>;

/** The only fields an admin may change on an existing inquiry. */
export interface InquiryUpdate {
  status?: ProjectStatus;
  priority?: Priority | null;
  adminNotes?: string | null;
}

/* ---------------------------------------------------------------------------
 * Serialized file access
 * ------------------------------------------------------------------------ */

let queue: Promise<unknown> = Promise.resolve();

/** Serialize store operations so read-modify-write sequences cannot interleave. */
function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  // Keep the chain alive regardless of individual failures.
  queue = run.catch(() => undefined);
  return run;
}

/** Normalize a stored record into the current canonical shape (no writes). */
function normalizeStatus(records: StoredInquiry[]): StoredInquiry[] {
  return records.map((record) =>
    (record.status as string) === LEGACY_CLOSED_STATUS
      ? { ...record, status: "completed" }
      : record,
  );
}

async function readFileSafe(): Promise<StoredInquiry[]> {
  const file = inquiriesFile();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Forward-compatible: keep only records that look like our shape, so
    // malformed/hostile entries never leak into the admin UI.
    return normalizeStatus(
      parsed.filter(isStoredInquiry),
    ) as StoredInquiry[];
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") return []; // no records yet
    // Corrupt store — move it aside so it stops breaking requests, then start fresh.
    console.error("[project-store] store unreadable, quarantining file:", error);
    try {
      await fs.rename(file, `${file}.corrupt-${Date.now()}`);
    } catch {
      // ignore — best effort
    }
    return [];
  }
}

function isStoredInquiry(value: unknown): value is StoredInquiry {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return false;
  if (typeof record.name !== "string") return false;
  if (typeof record.email !== "string") return false;
  if (typeof record.status !== "string") return false;
  if (!(PROJECT_STATUSES as readonly string[]).includes(record.status) &&
      record.status !== LEGACY_CLOSED_STATUS) return false;
  return true;
}

async function writeFileSafe(records: StoredInquiry[]): Promise<void> {
  const file = inquiriesFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(records, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

/** List all inquiries, newest first. */
export function listInquiries(): Promise<StoredInquiry[]> {
  return withLock(async () => {
    const records = await readFileSafe();
    return records.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });
}

/** Fetch a single inquiry by id. Returns null when not found. */
export function getInquiry(id: string): Promise<StoredInquiry | null> {
  return withLock(async () => {
    const records = await readFileSafe();
    return records.find((record) => record.id === id) ?? null;
  });
}

/**
 * Apply an admin update to an existing inquiry. Status/priority/notes are
 * the ONLY mutable fields; the server always re-validates them via the API
 * layer before they reach this function. Returns null when not found.
 */
export function updateInquiry(
  id: string,
  update: InquiryUpdate,
): Promise<StoredInquiry | null> {
  return withLock(async () => {
    const records = await readFileSafe();
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) return null;

    const current = records[index];
    const next: StoredInquiry = {
      ...current,
      status: update.status ?? current.status,
      updatedAt: new Date().toISOString(),
    };
    if (update.priority !== undefined) {
      next.priority = update.priority ?? undefined;
    }
    if (update.adminNotes !== undefined) {
      next.adminNotes = update.adminNotes || undefined;
    }
    // Dropping to an empty status value is impossible by construction, but a
    // defensive check keeps the store always valid.
    if (!(PROJECT_STATUSES as readonly string[]).includes(next.status)) {
      return null;
    }

    records[index] = next;
    await writeFileSafe(records);
    return next;
  });
}

/** Simple, real dashboards numbers derived from persisted data — never fake. */
export interface InquiryStats {
  total: number;
  newCount: number;
  reviewingCount: number;
  contactedCount: number;
  proposalCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  /** A few of the most recent inquiries (newest first) for dashboard lists. */
  recent: StoredInquiry[];
}

export function getInquiryStats(limit = 6): Promise<InquiryStats> {
  return withLock(async () => {
    const records = await readFileSafe();
    const sorted = [...records].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const count = (status: ProjectStatus) =>
      sorted.filter((record) => record.status === status).length;

    return {
      total: sorted.length,
      newCount: count("new"),
      reviewingCount: count("reviewing"),
      contactedCount: count("contacted"),
      proposalCount: count("proposal"),
      inProgressCount: count("in_progress"),
      completedCount: count("completed"),
      cancelledCount: count("cancelled"),
      recent: sorted.slice(0, limit),
    };
  });
}

/**
 * Persist a new inquiry. Returns the stored record (with id, status and
 * timestamps) so the POST response can echo exactly what was written.
 */
export function createInquiry(input: NewInquiry): Promise<StoredInquiry> {
  return withLock(async () => {
    const records = await readFileSafe();
    const now = new Date().toISOString();
    const record: StoredInquiry = {
      id: randomUUID(),
      status: "new",
      createdAt: now,
      updatedAt: now,
      name: input.name,
      email: input.email,
      projectType: input.projectType,
      budget: input.budget,
      description: input.description,
    };
    // Drop optional empty strings so the stored shape stays clean and
    // predictable ("company" may be undefined rather than "").
    if (input.company) record.company = input.company;
    if (input.phone) record.phone = input.phone;
    if (input.referenceUrl) record.referenceUrl = input.referenceUrl;
    records.push(record);
    await writeFileSafe(records);
    return record;
  });
}