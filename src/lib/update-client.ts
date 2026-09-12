import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { requestIsAdminAuthed } from "@/lib/auth";

/**
 * Anonymous update-state client identity.
 *
 * The backend issues an httpOnly, same-site cookie (`os_update_client`) holding
 * a random UUID. It is an *identity*, not a source of truth: all update
 * decisions live server-side in update-store. Cookies are explicitly allowed
 * for carrying an identity here — what the architecture forbids is using
 * browser storage as the source of truth for update completion, which this
 * never does.
 *
 * - Read path (`getUpdateClientId`): returns the existing id or null —
 *   route handlers cannot always set cookies.
 * - Write path: the status endpoint sets the cookie when absent via the
 *   `Set-Cookie` header on its response, so the very first visit already
 *   gets a stable identity and the completion call reuses it.
 */

export const UPDATE_CLIENT_COOKIE = "os_update_client";
/** Long-lived: the identity should outlive sessions. */
const TEN_YEARS_SECONDS = 10 * 365 * 24 * 60 * 60;

function isValidClientId(value: string): boolean {
  // Strict UUID v4-format check — nothing malformed is ever treated as a
  // stored identity (prevents injection into the store file keys).
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Extract the client id from an incoming Request (or null). */
export function requestUpdateClientId(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(
    new RegExp(`(?:^|;\\s*)${UPDATE_CLIENT_COOKIE}=([^;]+)`),
  );
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  return isValidClientId(value) ? value : null;
}

/** `Set-Cookie` header value that issues a fresh client identity. */
export function issueUpdateClientCookie(): { name: string; value: string; header: string } {
  const value = randomUUID();
  const header = `${UPDATE_CLIENT_COOKIE}=${value}; Path=/; Max-Age=${TEN_YEARS_SECONDS}; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
  return { name: UPDATE_CLIENT_COOKIE, value, header };
}

/**
 * Server Component / Route Handler helper via next/headers (read-only).
 * Exists for symmetry with auth.ts; route handlers below use the Request
 * variant so they can also set the cookie on first contact.
 */
export async function getUpdateClientId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(UPDATE_CLIENT_COOKIE)?.value ?? "";
  return isValidClientId(value) ? value : null;
}

/** Admins manage releases — they should not be nagged by the update card. */
export function requestIsAdminClient(request: Request): boolean {
  return requestIsAdminAuthed(request);
}
