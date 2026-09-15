import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite (node:sqlite) persistence layer for managed projects — Phase 4.
 *
 * The project is a single self-hosted Node.js server with no external
 * database, so the previous JSON-file store is upgraded in place to SQLite:
 * the same single process owns the data, but persistence is now a real
 * database engine with typed columns, CHECK constraints, UNIQUE ids and
 * indexed queries. Zero new dependencies (node:sqlite ships with Node ≥ 22).
 *
 * Conventions preserved from Phase 3:
 *   • the same exported function surface — API routes and UI never change;
 *   • serialized write access (Statement.run calls are synchronous and the
 *     Node event loop serializes them; the open DB handle is reused);
 *   • server-side zod validation in managed-project-schema.ts stays active.
 *
 * Database location: `.data/managed-projects.db`, overridable via
 * OMID_STUDIO_MANAGED_PROJECTS_DB. Legacy `.data/managed-projects.json`
 * (Phase 3) is imported automatically on first open, never dropped.
 */

export const DEFAULT_MANAGED_PROJECTS_DB = path.join(
  process.cwd(),
  ".data",
  "managed-projects.db",
);

const LEGACY_JSON_FILE = path.join(process.cwd(), ".data", "managed-projects.json");

function dbFile(): string {
  return process.env.OMID_STUDIO_MANAGED_PROJECTS_DB ?? DEFAULT_MANAGED_PROJECTS_DB;
}

/** The persisted record shape — same contract as the Phase-3 JSON store. */
export interface StoredManagedProject {
  id: string;
  name: string;
  client: string;
  type: string;
  description: string;
  status: string;
  progress: number;
  startDate: string;
  deadline: string;
  budget: number;
  payment: string;
  demoUrl: string;
  githubUrl: string;
  technologies: string[];
  notes: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewManagedProject = Omit<
  StoredManagedProject,
  "id" | "archived" | "createdAt" | "updatedAt"
>;

export type ManagedProjectUpdate = Partial<NewManagedProject>;

/* ---------------------------------------------------------------------------
 * Connection — one handle per process, opened lazily, schema idempotent.
 * ------------------------------------------------------------------------ */

let handle: DatabaseSync | null = null;
let initPromise: Promise<DatabaseSync> | null = null;

const MIGRATIONS: { version: number; up: string }[] = [
  {
    version: 1,
    // CHECK constraints enforce the enum domains and the 0–100 progress
    // range at the database level; zod remains the first validation line.
    up: `
      CREATE TABLE IF NOT EXISTS managed_projects (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 120),
        client        TEXT NOT NULL CHECK (length(trim(client)) > 0 AND length(client) <= 120),
        type          TEXT NOT NULL CHECK (type IN ('website','webapp','saas','ecommerce','dashboard','other')),
        description   TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
        status        TEXT NOT NULL CHECK (status IN ('negotiating','pending','in_progress','completed','halted')),
        progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        start_date    TEXT NOT NULL DEFAULT '' CHECK (start_date = '' OR start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        deadline      TEXT NOT NULL DEFAULT '' CHECK (deadline = '' OR deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
        budget        NUMERIC NOT NULL DEFAULT 0 CHECK (budget >= 0 AND budget <= 1000000000),
        payment       TEXT NOT NULL CHECK (payment IN ('unpaid','advance','partial','paid')),
        demo_url      TEXT NOT NULL DEFAULT '' CHECK (length(demo_url) <= 2048),
        github_url    TEXT NOT NULL DEFAULT '' CHECK (length(github_url) <= 2048),
        technologies  TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(technologies) AND json_array_length(technologies) <= 20),
        notes         TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
        archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_managed_projects_updated_at ON managed_projects (updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_managed_projects_archived ON managed_projects (archived);
    `,
  },
];

async function openDatabase(): Promise<DatabaseSync> {
  if (handle) return handle;

  const file = dbFile();
  await fs.promises.mkdir(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  // WAL: concurrent readers never block the writer on this single server.
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Reproducible schema: a small versioned migration table, applied in order,
  // idempotently. No manual production edits, no destructive resets.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const appliedRows = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all() as { version: number }[];
  const applied = new Set(appliedRows.map((row) => row.version));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.up);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        migration.version,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  importLegacyJsonIfPresent(db);

  handle = db;
  return db;
}

/**
 * One-time, non-destructive import of the Phase-3 JSON store when it still
 * exists (fresh installs skip this entirely). Records that violate the SQL
 * constraints are skipped individually — the import never fails the request
 * path and never deletes the legacy file.
 */
function importLegacyJsonIfPresent(db: DatabaseSync): void {
  try {
    if (!fs.existsSync(LEGACY_JSON_FILE)) return;
    const alreadyImported = db
      .prepare("SELECT COUNT(*) AS count FROM managed_projects")
      .get() as { count: number };
    if (alreadyImported.count > 0) return;

    const raw = JSON.parse(fs.readFileSync(LEGACY_JSON_FILE, "utf8"));
    if (!Array.isArray(raw)) return;

    const insert = db.prepare(`
      INSERT OR IGNORE INTO managed_projects
        (id, name, client, type, description, status, progress, start_date,
         deadline, budget, payment, demo_url, github_url, technologies,
         notes, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let imported = 0;
    for (const record of raw) {
      if (typeof record !== "object" || record === null) continue;
      const r = record as Record<string, unknown>;
      if (typeof r.id !== "string" || typeof r.name !== "string") continue;
      try {
        insert.run(
          r.id,
          r.name,
          typeof r.client === "string" ? r.client : "",
          typeof r.type === "string" ? r.type : "other",
          typeof r.description === "string" ? r.description : "",
          typeof r.status === "string" ? r.status : "pending",
          typeof r.progress === "number" ? Math.trunc(r.progress) : 0,
          typeof r.startDate === "string" ? r.startDate : "",
          typeof r.deadline === "string" ? r.deadline : "",
          typeof r.budget === "number" ? r.budget : 0,
          typeof r.payment === "string" ? r.payment : "unpaid",
          typeof r.demoUrl === "string" ? r.demoUrl : "",
          typeof r.githubUrl === "string" ? r.githubUrl : "",
          JSON.stringify(Array.isArray(r.technologies) ? r.technologies : []),
          typeof r.notes === "string" ? r.notes : "",
          r.archived === true ? 1 : 0,
          typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
          typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString(),
        );
        imported += 1;
      } catch {
        // Constraint violation on one legacy record must not block the rest.
      }
    }
    if (imported > 0) {
      console.log(
        `[managed-project-db] imported ${imported} record(s) from legacy JSON store`,
      );
    }
  } catch (error) {
    console.error("[managed-project-db] legacy JSON import skipped:", error);
  }
}

/** Connection accessor — shared by every operation, opened at most once. */
function db(): Promise<DatabaseSync> {
  if (!initPromise) {
    initPromise = openDatabase().catch((error) => {
      initPromise = null; // allow a later request to retry the connection
      throw error;
    });
  }
  return initPromise;
}

/** Distinguishable error for callers that need to surface a 503 to clients. */
export class DatabaseUnavailableError extends Error {
  constructor(cause: unknown) {
    super("database unavailable", { cause });
  }
}

async function withDb<T>(operation: (database: DatabaseSync) => T): Promise<T> {
  try {
    return operation(await db());
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) throw error;
    // Connection-level failures (missing file permissions, disk errors…) are
    // reported as a typed error so routes can answer 503 instead of 500.
    const message = error instanceof Error ? error.message : String(error);
    if (/SQLITE_CANTOPEN|EACCES|ENOENT|database/.test(message)) {
      throw new DatabaseUnavailableError(error);
    }
    throw error;
  }
}

/* ---------------------------------------------------------------------------
 * Row mapping
 * ------------------------------------------------------------------------ */

interface ManagedProjectRow {
  id: string;
  name: string;
  client: string;
  type: string;
  description: string;
  status: string;
  progress: number;
  start_date: string;
  deadline: string;
  budget: number;
  payment: string;
  demo_url: string;
  github_url: string;
  technologies: string;
  notes: string;
  archived: number;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: ManagedProjectRow): StoredManagedProject {
  let technologies: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.technologies);
    if (Array.isArray(parsed)) {
      technologies = parsed.filter((tech): tech is string => typeof tech === "string");
    }
  } catch {
    technologies = [];
  }
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    type: row.type,
    description: row.description,
    status: row.status,
    progress: row.progress,
    startDate: row.start_date,
    deadline: row.deadline,
    budget: row.budget,
    payment: row.payment,
    demoUrl: row.demo_url,
    githubUrl: row.github_url,
    technologies,
    notes: row.notes,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `
  id, name, client, type, description, status, progress, start_date, deadline,
  budget, payment, demo_url, github_url, technologies, notes, archived,
  created_at, updated_at
`;

/* ---------------------------------------------------------------------------
 * Public API — identical surface to the Phase-3 JSON store
 * ------------------------------------------------------------------------ */

export interface ManagedProjectQuery {
  status?: string;
  payment?: string;
  type?: string;
  query?: string;
  sort?: "updated" | "deadline" | "progress";
  includeArchived?: boolean;
}

export function listManagedProjectRecords(
  options: ManagedProjectQuery = {},
): Promise<StoredManagedProject[]> {
  return withDb((database) => {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (!options.includeArchived) where.push("archived = 0");
    if (options.status) {
      where.push("status = ?");
      params.push(options.status);
    }
    if (options.payment) {
      where.push("payment = ?");
      params.push(options.payment);
    }
    if (options.type) {
      where.push("type = ?");
      params.push(options.type);
    }
    const q = options.query?.trim().toLowerCase();
    if (q) {
      // Parameterized LIKE with escaped wildcards — no string interpolation.
      const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      where.push(
        "(lower(name) LIKE ? ESCAPE '\\' OR lower(client) LIKE ? ESCAPE '\\' OR lower(technologies) LIKE ? ESCAPE '\\')",
      );
      params.push(like, like, like);
    }

    const orderBy =
      options.sort === "deadline"
        ? "CASE WHEN deadline = '' THEN 1 ELSE 0 END, deadline ASC"
        : options.sort === "progress"
          ? "progress DESC"
          : "updated_at DESC";

    const rows = database
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM managed_projects
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY ${orderBy}`,
      )
      .all(...params) as unknown as ManagedProjectRow[];
    return rows.map(rowToRecord);
  });
}

export function getManagedProjectRecord(
  id: string,
  options: { includeArchived?: boolean } = {},
): Promise<StoredManagedProject | null> {
  return withDb((database) => {
    const row = database
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM managed_projects
         WHERE id = ?${options.includeArchived ? "" : " AND archived = 0"}`,
      )
      .get(id) as unknown as ManagedProjectRow | undefined;
    return row ? rowToRecord(row) : null;
  });
}

export function createManagedProjectRecord(
  input: NewManagedProject,
): Promise<StoredManagedProject> {
  return withDb((database) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    database
      .prepare(
        `INSERT INTO managed_projects
           (id, name, client, type, description, status, progress, start_date,
            deadline, budget, payment, demo_url, github_url, technologies,
            notes, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.client,
        input.type,
        input.description,
        input.status,
        input.progress,
        input.startDate,
        input.deadline,
        input.budget,
        input.payment,
        input.demoUrl,
        input.githubUrl,
        JSON.stringify(input.technologies),
        input.notes,
        now,
        now,
      );
    return {
      ...input,
      id,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function updateManagedProjectRecord(
  id: string,
  update: ManagedProjectUpdate,
): Promise<StoredManagedProject | null> {
  return withDb((database) => {
    const existing = database
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM managed_projects WHERE id = ? AND archived = 0`,
      )
      .get(id) as unknown as ManagedProjectRow | undefined;
    if (!existing) return null;

    // Explicit field-by-field mapping — request bodies never reach SQL directly.
    const updates: string[] = [];
    const params: (string | number)[] = [];
    if (update.name !== undefined) {
      updates.push("name = ?");
      params.push(update.name);
    }
    if (update.client !== undefined) {
      updates.push("client = ?");
      params.push(update.client);
    }
    if (update.type !== undefined) {
      updates.push("type = ?");
      params.push(update.type);
    }
    if (update.description !== undefined) {
      updates.push("description = ?");
      params.push(update.description);
    }
    if (update.status !== undefined) {
      updates.push("status = ?");
      params.push(update.status);
    }
    if (update.progress !== undefined) {
      updates.push("progress = ?");
      params.push(update.progress);
    }
    if (update.startDate !== undefined) {
      updates.push("start_date = ?");
      params.push(update.startDate);
    }
    if (update.deadline !== undefined) {
      updates.push("deadline = ?");
      params.push(update.deadline);
    }
    if (update.budget !== undefined) {
      updates.push("budget = ?");
      params.push(update.budget);
    }
    if (update.payment !== undefined) {
      updates.push("payment = ?");
      params.push(update.payment);
    }
    if (update.demoUrl !== undefined) {
      updates.push("demo_url = ?");
      params.push(update.demoUrl);
    }
    if (update.githubUrl !== undefined) {
      updates.push("github_url = ?");
      params.push(update.githubUrl);
    }
    if (update.technologies !== undefined) {
      updates.push("technologies = ?");
      params.push(JSON.stringify(update.technologies));
    }
    if (update.notes !== undefined) {
      updates.push("notes = ?");
      params.push(update.notes);
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString(), id);

    database
      .prepare(
        `UPDATE managed_projects SET ${updates.join(", ")} WHERE id = ?`,
      )
      .run(...params);

    const row = database
      .prepare(`SELECT ${SELECT_COLUMNS} FROM managed_projects WHERE id = ?`)
      .get(id) as unknown as ManagedProjectRow;
    return rowToRecord(row);
  });
}

/** Soft delete — retained in the database with archived = 1, never destroyed. */
export function archiveManagedProjectRecord(
  id: string,
): Promise<StoredManagedProject | null> {
  return withDb((database) => {
    const result = database
      .prepare(
        `UPDATE managed_projects
         SET archived = 1, updated_at = ?
         WHERE id = ? AND archived = 0`,
      )
      .run(new Date().toISOString(), id);
    if (result.changes === 0) return null;
    const row = database
      .prepare(`SELECT ${SELECT_COLUMNS} FROM managed_projects WHERE id = ?`)
      .get(id) as unknown as ManagedProjectRow;
    return rowToRecord(row);
  });
}

/** Reverse of archive — brings a soft-deleted project back to active state. */
export function restoreManagedProjectRecord(
  id: string,
): Promise<StoredManagedProject | null> {
  return withDb((database) => {
    const result = database
      .prepare(
        `UPDATE managed_projects
         SET archived = 0, updated_at = ?
         WHERE id = ? AND archived = 1`,
      )
      .run(new Date().toISOString(), id);
    if (result.changes === 0) return null;
    const row = database
      .prepare(`SELECT ${SELECT_COLUMNS} FROM managed_projects WHERE id = ?`)
      .get(id) as unknown as ManagedProjectRow;
    return rowToRecord(row);
  });
}
