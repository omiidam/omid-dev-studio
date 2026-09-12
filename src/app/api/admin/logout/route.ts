import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

/**
 * POST /api/admin/logout — clears the session cookie. The proxy already
 * guards this path for authenticated-only callers; clearing an absent cookie
 * is harmless regardless.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST() {
  const response = NextResponse.json(
    { success: true, data: { signedOut: true } },
    { headers: NO_STORE },
  );
  response.cookies.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
  return response;
}