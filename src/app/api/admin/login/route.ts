import { NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/project-schema";
import {
  ADMIN_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifyAdminCredentials,
} from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * POST /api/admin/login
 *
 * Validates credentials and, on success, sets an httpOnly signed session
 * cookie scoped to the whole site. Reuses the project-standard response
 * shape and rate limiting. The proxy lets this public endpoint through; the
 * cookie name/session token are still re-verified on every later request.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("application/json")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "فرمت درخواست باید JSON باشد.",
        },
      },
      { status: 415, headers: NO_STORE },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "PAYLOAD_TOO_LARGE", message: "درخواست بیش از حد مجاز است." },
      },
      { status: 413, headers: NO_STORE },
    );
  }

  // Brute-force guard — a handful of failed attempts is plenty before the
  // window kicks in.
  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:login:${ip}`, 5);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "تلاش‌های زیاد. کمی بعد دوباره تلاش کنید." },
      },
      { status: 429, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_JSON", message: "بدنه‌ی درخواست JSON معتبر نیست." },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "اطلاعات واردشده معتبر نیست." },
      },
      { status: 422, headers: NO_STORE },
    );
  }

  const ok = await verifyAdminCredentials(
    parsed.data.username,
    parsed.data.password,
  ).catch((error) => {
    logError("[api/admin/login] credential check failed", error);
    return false;
  });

  if (!ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "نام کاربری یا رمز عبور نادرست است.",
        },
      },
      { status: 401, headers: NO_STORE },
    );
  }

  const token = createSessionToken();
  const response = NextResponse.json(
    { success: true, data: { authenticated: true } },
    { headers: NO_STORE },
  );
  response.cookies.set(ADMIN_COOKIE, token, sessionCookieOptions(7 * 24 * 60 * 60));
  return response;
}