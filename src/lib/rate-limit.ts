/**
 * Abuse protection for the public project-inquiry endpoint — an in-process
 * sliding-window rate limiter plus exact-duplicate submission detection.
 *
 * Deliberately dependency-free and keyed in memory: this is a single
 * self-hosted Next.js server, so one process owns the whole request path.
 * Two documented limits of this design:
 *   • State is per-process — multiple server instances (or a restart)
 *     reset the windows. On the single-server architecture that is fine;
 *     a distributed store would be required for a multi-instance fleet.
 *   • The client IP comes from proxy headers (x-forwarded-for). Behind a
 *     reverse proxy that header is trustworthy; a client connecting
 *     directly could spoof it. It still stops trivial same-IP flooding,
 *     which is the stated goal here.
 *
 * The storage path is never derived from request data, and no user input
 * ever reaches this module's keys.
 */

const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_SUBMISSIONS = 20; // generous for humans, blocks flooding

/** Per-IP sliding-window buckets. */
const windows = new Map<string, number[]>();

/** Exact-duplicate fingerprints (email + projectType + normalized text). */
const recentSubmissions = new Map<string, number>();

/** Bound the maps even under sustained abuse. */
const MAX_TRACKED_KEYS = 10_000;

function pruneWindow(key: string, windowMs: number): void {
  const entry = windows.get(key);
  if (!entry) return;
  const cutoff = Date.now() - windowMs;
  let i = 0;
  while (i < entry.length && entry[i] <= cutoff) i += 1;
  if (i === entry.length) {
    windows.delete(key);
  } else if (i > 0) {
    entry.splice(0, i);
  }
}

/**
 * Consume one slot for `key` within the window. Returns whether the request
 * is allowed and, when denied, how many seconds to wait before retrying.
 */
export function rateLimitHit(
  key: string,
  max = DEFAULT_MAX_SUBMISSIONS,
  windowMs = DEFAULT_WINDOW_MS,
): { allowed: boolean; retryAfterSec: number } {
  pruneWindow(key, windowMs);
  const now = Date.now();
  const entry = windows.get(key) ?? [];
  if (entry.length >= max) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((entry[0] + windowMs - now) / 1000),
    );
    return { allowed: false, retryAfterSec };
  }
  entry.push(now);
  if (windows.size >= MAX_TRACKED_KEYS) {
    // Keep memory bounded: drop the bucket of the least-recently-active key.
    const firstKey = windows.keys().next().value as string | undefined;
    if (firstKey !== undefined) windows.delete(firstKey);
  }
  windows.set(key, entry);
  return { allowed: true, retryAfterSec: 0 };
}

/** Best-effort client identifier from proxy headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * True when an identical inquiry was already accepted within the dedupe
 * window. The fingerprint is only recorded AFTER a successful persist
 * (recordSubmission), so a failed submission never blocks a legitimate retry.
 */
export function checkDuplicate(fingerprint: string): boolean {
  const last = recentSubmissions.get(fingerprint);
  return last !== undefined && Date.now() - last < DEFAULT_WINDOW_MS;
}

/** Mark a successfully stored inquiry so an exact repeat is rejected. */
export function recordSubmission(fingerprint: string): void {
  if (recentSubmissions.size >= MAX_TRACKED_KEYS) {
    const firstKey = recentSubmissions.keys().next().value as
      | string
      | undefined;
    if (firstKey !== undefined) recentSubmissions.delete(firstKey);
  }
  recentSubmissions.set(fingerprint, Date.now());
}

/** Stable, language-neutral fingerprint of a validated inquiry. */
export function submissionFingerprint(input: {
  email: string;
  projectType: string;
  description: string;
}): string {
  const text = input.description.trim().replace(/\s+/g, " ");
  return `${input.email.toLowerCase()}|${input.projectType}|${text}`;
}