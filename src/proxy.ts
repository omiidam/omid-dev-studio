import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  isValidAdminSessionToken,
} from "@/lib/auth";

/**
 * Request gate for the admin area.
 *
 *   /admin/*         → pages: unauthenticated visitors are redirected to the
 *                      login page; authenticated sessions pass through.
 *   /api/admin/*     → APIs: unauthenticated callers get a 401 JSON response
 *                      (with the project-standard error shape) instead of a
 *                      redirect, so fetch() consumers can handle it cleanly.
 *   /admin/login + /api/admin/login are public by definition — but an
 *   already-authenticated visitor hitting the login page is sent to /admin.
 *
 * This is one layer. Every admin route handler and server-rendered page
 * re-verifies the session cookie itself (defense in depth), so a bypass of
 * this file can never expose admin data on its own.
 */

const NO_STORE = { "Cache-Control": "no-store" };

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (!isAdminArea && !isAdminApi) return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE)?.value ?? "";
  const authed = isValidAdminSessionToken(token);

  // Public entry points of the admin flow.
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    if (authed && pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (isAdminApi) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "برای دسترسی به این بخش ابتدا وارد شوید.",
        },
      },
      { status: 401, headers: NO_STORE },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    // /admin itself is covered via :path* (zero-or-more segments), but list
    // it explicitly so the intent (and coverage) stays obvious.
    "/admin",
  ],
};