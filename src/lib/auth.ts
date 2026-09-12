import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin authentication for OMID Studio — a small, self-contained session
 * system built on the existing single-server architecture (no second auth
 * stack, no external identity provider).
 *
 * Design:
 *   • Credentials come from server-only environment variables
 *     (OMID_STUDIO_ADMIN_USER / OMID_STUDIO_ADMIN_PASSWORD). Nothing is
 *     stored in the repo and no password is ever persisted.
 *   • A successful login issues a signed session token carried in an
 *     httpOnly, same-site cookie. The token is an HMAC-SHA256 signature over
 *     `v1.<expiry>`; the signature key is derived from the configured
 *     secret (OMID_STUDIO_AUTH_SECRET) — or, when unset, from the admin
 *     password itself as a documented single-server fallback.
 *   • Tokens expire after 7 days and are verified with timing-safe
 *     comparisons on both the credential check and the signature check.
 *   • Every consumer re-verifies independently: the proxy guards
 *     /admin and /api/admin, route handlers re-check the cookie, and
 *     server-rendered admin pages call `isAdminAuthed()`. Defense in depth,
 *     never a single gate.
 */

export const ADMIN_COOKIE = "os_admin_session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sessionKey(): Buffer {
  const configured = process.env.OMID_STUDIO_AUTH_SECRET;
  if (configured && configured.length > 0) {
    return createHash("sha256").update(configured).digest();
  }
  // Single-server fallback: derive a stable key from the admin password.
  return createHash("sha256")
    .update("omid-studio-admin-session:v1")
    .update(process.env.OMID_STUDIO_ADMIN_PASSWORD ?? "")
    .digest();
}

function sign(payload: string): string {
  return createHmac("sha256", sessionKey()).update(payload).digest("hex");
}

/** True when the admin credentials are configured (login is possible). */
export function hasAdminConfig(): boolean {
  return Boolean(
    process.env.OMID_STUDIO_ADMIN_USER &&
      process.env.OMID_STUDIO_ADMIN_PASSWORD,
  );
}

/** Timing-safe credential check against the configured environment values. */
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expectedUser = process.env.OMID_STUDIO_ADMIN_USER;
  const expectedPass = process.env.OMID_STUDIO_ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;

  const actualUser = createHash("sha256").update(username).digest();
  const wantedUser = createHash("sha256").update(expectedUser).digest();
  if (!timingSafeEqual(actualUser, wantedUser)) return false;

  const actualPass = createHash("sha256").update(password).digest();
  const wantedPass = createHash("sha256").update(expectedPass).digest();
  if (!timingSafeEqual(actualPass, wantedPass)) return false;

  return true;
}

/** Issue a fresh signed session token. */
export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `v1.${expires}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a session token: shape, expiry and signature. Returns false for any
 * tampering (including malformed tokens), never throwing.
 */
export function isValidAdminSessionToken(token: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires <= Date.now()) return false;

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`), "hex");
  const received = Buffer.from(parts[2] ?? "", "hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Read + verify the admin cookie in a Server Component / Route Handler. */
export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value ?? "";
  return isValidAdminSessionToken(token);
}

/** Extract + verify the admin cookie from an incoming Request. */
export function requestIsAdminAuthed(request: Request): boolean {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(
    new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`),
  );
  const token = match?.[1] ? decodeURIComponent(match[1]) : "";
  return isValidAdminSessionToken(token);
}

/** Cookie attributes shared by login (set) and logout (clear). */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Standard 401 JSON response for admin APIs (never cached). */
export function unauthorizedAdminResponse() {
  return Response.json(
    {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "برای دسترسی به این بخش ابتدا وارد شوید.",
      },
    },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}