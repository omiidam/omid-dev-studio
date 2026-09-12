import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Persistent, append-only storage for analytics events.
 *
 * Events are written as one JSON object per line to a private file on the
 * server (`<project>/.data/analytics.ndjson`). The file never travels to the
 * client and is not exposed through any route — it exists only so operator
 * tooling can review the validated event stream.
 *
 * Retention is bounded: when the file exceeds MAX_FILE_BYTES it is rotated to
 * `<file>.old` (replacing the previous archive) so a single deployment keeps
 * at most the current + one previous file.
 *
 * Writes are serialized through a promise chain so concurrent request handlers
 * cannot interleave partial lines.
 */

const MAX_FILE_BYTES = 1_000_000;

export const DEFAULT_ANALYTICS_FILE = path.join(
  process.cwd(),
  ".data",
  "analytics.ndjson",
);

function analyticsFile(): string {
  return process.env.OMID_STUDIO_ANALYTICS_FILE ?? DEFAULT_ANALYTICS_FILE;
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialize append operations so concurrent requests cannot interleave lines. */
function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  // Keep the chain alive regardless of individual failures.
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Append already-validated events to the analytics log. Throws on failure so
 * the caller can decide how to degrade (analytics persistence is best-effort).
 */
export function appendAnalyticsEvents(events: unknown[]): Promise<void> {
  return withLock(async () => {
    const file = analyticsFile();
    const dir = path.dirname(file);
    await fs.mkdir(dir, { recursive: true });

    // Rotate a large file aside before writing more.
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_FILE_BYTES) {
        const archive = `${file}.old`;
        try {
          await fs.rm(archive, { force: true });
        } catch {
          // best effort
        }
        await fs.rename(file, archive);
      }
    } catch {
      // ENOENT (first write) or other stat failure — no rotation needed yet.
    }

    if (events.length > 0) {
      const lines = events.map((item) => JSON.stringify(item)).join("\n") + "\n";
      await fs.appendFile(file, lines, "utf8");
    }
  });
}