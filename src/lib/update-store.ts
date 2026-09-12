import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Authoritative update-state store.
 *
 * The backend — never the browser — decides whether a client still needs to
 * apply the required application version. For each anonymous client (identified
 * by an httpOnly cookie the backend issues) the store persists the last version
 * whose update flow completed successfully end-to-end:
 *
 *   completedVersion === APP_VERSION  →  updateRequired = false
 *   anything else (or no record)      →  updateRequired = true
 *
 * The record is written ONLY by the update-completion endpoint after its full
 * validation/processing succeeded — so a refresh, tab close, network error or
 * invalid submission can never mark a client as updated.
 *
 * Storage follows the same pattern as project-store: JSON on the server file
 * system (survives restarts), atomic writes (temp file + rename) and a
 * serialized lock so concurrent read-modify-write sequences cannot interleave.
 * Swapping this for a real database later changes only this module.
 *
 * Location is configurable via OMID_STUDIO_UPDATE_STATE_FILE (defaults to
 * `<project>/.data/update-state.json`).
 */

export const DEFAULT_UPDATE_STATE_FILE = path.join(
  process.cwd(),
  ".data",
  "update-state.json",
);

function stateFile(): string {
  return process.env.OMID_STUDIO_UPDATE_STATE_FILE ?? DEFAULT_UPDATE_STATE_FILE;
}

/** Persisted per-client record (internal shape). */
export interface ClientUpdateState {
  clientId: string;
  /** Version whose update flow fully completed on the backend; null = none. */
  completedVersion: string | null;
  updatedAt: string;
}

interface UpdateStateFile {
  clients: ClientUpdateState[];
}

/* ---------------------------------------------------------------------------
 * Serialized file access (same discipline as project-store)
 * ------------------------------------------------------------------------ */

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readFileSafe(): Promise<UpdateStateFile> {
  try {
    const raw = await fs.readFile(stateFile(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as UpdateStateFile).clients)
    ) {
      return { clients: [] };
    }
    // Keep only well-formed records — malformed entries are dropped, not trusted.
    const clients = (parsed as UpdateStateFile).clients.filter(
      (entry): entry is ClientUpdateState =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as ClientUpdateState).clientId === "string" &&
        ((entry as ClientUpdateState).completedVersion === null ||
          typeof (entry as ClientUpdateState).completedVersion === "string"),
    );
    return { clients };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    if (code === "ENOENT") return { clients: [] };
    console.error("[update-store] state unreadable, starting fresh:", error);
    return { clients: [] };
  }
}

async function writeFileSafe(state: UpdateStateFile): Promise<void> {
  const file = stateFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/* ---------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

/** The version the client last completed, or null when it never did. */
export function getCompletedVersion(
  clientId: string,
): Promise<string | null> {
  return withLock(async () => {
    const state = await readFileSafe();
    return (
      state.clients.find((entry) => entry.clientId === clientId)
        ?.completedVersion ?? null
    );
  });
}

/**
 * Persist a client's completed version. Atomic: the whole read-modify-write
 * runs inside the lock and the write itself is temp-file + rename, so a
 * failure here leaves the previous state (and therefore updateRequired=true)
 * untouched.
 */
export function setCompletedVersion(
  clientId: string,
  version: string,
): Promise<ClientUpdateState> {
  return withLock(async () => {
    const state = await readFileSafe();
    const now = new Date().toISOString();
    const record: ClientUpdateState = {
      clientId,
      completedVersion: version,
      updatedAt: now,
    };
    const index = state.clients.findIndex(
      (entry) => entry.clientId === clientId,
    );
    if (index === -1) {
      state.clients.push(record);
    } else {
      state.clients[index] = record;
    }
    await writeFileSafe(state);
    return record;
  });
}
