import { NextResponse } from "next/server";
import { inquirySchema, MAX_BODY_BYTES } from "@/lib/project-schema";
import {
  createInquiry,
  listInquiries,
  type StoredInquiry,
} from "@/lib/project-store";
import {
  checkDuplicate,
  getClientIp,
  rateLimitHit,
  recordSubmission,
  submissionFingerprint,
} from "@/lib/rate-limit";
import { logError } from "@/lib/log";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";

/**
 * Project inquiries API — one integrated part of the Next.js app.
 *
 *   GET  /api/projects  → list stored inquiries (newest first)
 *   POST /api/projects  → validate + persist a new inquiry
 *
 * Response contract (kept identical across endpoints):
 *
 *   Success: { success: true,  data: {...} }
 *   Error:   { success: false, error: { code, message, fields? } }
 *
 * User-facing messages are Persian; codes and values are language-neutral.
 * No raw stack traces or storage errors are ever exposed to the client.
 *
 * Security posture (Phase 8):
 *   • Strict input validation with Zod (lengths, enums, email, URL).
 *   • 32 KB body cap, JSON content-type enforcement.
 *   • In-process sliding-window rate limiting per client IP.
 *   • Server-side exact-duplicate rejection (recorded only after success,
 *     so a failed submission never blocks a legitimate retry).
 *   • Responses are `no-store` — inquiry data must never be cached by
 *     the browser, a shared proxy, or the service worker.
 *   • Unknown body keys (id/status/timestamps) are stripped by Zod; the
 *     server alone decides identity and status.
 *
 * This endpoint's POST is the public inquiry form. The GET listing returns
 * personal data (names, emails, phones) so it now requires the admin session
 * — unauthenticated listing is rejected with 401 both here and by the proxy
 * for /api/admin paths.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Responses carrying inquiry data must never be cached anywhere. */
const NO_STORE = { "Cache-Control": "no-store" };

function validationError(fields: Record<string, string>): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "اطلاعات واردشده معتبر نیست. لطفاً موارد مشخص‌شده را بررسی کنید.",
        fields,
      },
    },
    { status: 422, headers: NO_STORE },
  );
}

function internalError(message = "خطای داخلی رخ داد. لطفاً دوباره تلاش کنید.") {
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message } },
    { status: 500, headers: NO_STORE },
  );
}

export async function GET(request: Request) {
  // The listing is admin-only (it exposes contact details). Same-server
  // re-verification in addition to the proxy guard.
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  // Listing returns personal data — keep it quiet and uncacheable.
  const ip = getClientIp(request);
  const limited = rateLimitHit(`projects:get:${ip}`, 60);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
        },
      },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  try {
    const inquiries = await listInquiries();
    return NextResponse.json(
      { success: true, data: inquiries },
      { headers: NO_STORE },
    );
  } catch (error) {
    logError("[api/projects] GET failed", error);
    return internalError();
  }
}

export async function POST(request: Request) {
  // Content-type enforcement — cheap and stateless, checked before limits.
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

  // Guard against oversized bodies before parsing.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "درخواست ارسالی بیش از حد مجاز است.",
        },
      },
      { status: 413, headers: NO_STORE },
    );
  }

  // Per-IP sliding window — blocks flooding and rapid repeat submissions.
  const ip = getClientIp(request);
  const limited = rateLimitHit(`projects:post:${ip}`);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message:
            "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
        },
      },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "بدنه‌ی درخواست JSON معتبر نیست.",
        },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const fields: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages && messages.length > 0) fields[field] = messages[0];
    }
    return validationError(fields);
  }

  const input = parsed.data;
  // Server-side duplicate protection — the server is the authority, never
  // the client. The fingerprint is recorded only after a successful write.
  const fingerprint = submissionFingerprint(input);
  if (checkDuplicate(fingerprint)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "DUPLICATE_SUBMISSION",
          message: "این درخواست قبلاً ثبت شده است. درخواست تکراری ارسال نشد.",
        },
      },
      { status: 409, headers: NO_STORE },
    );
  }

  try {
    const record: StoredInquiry = await createInquiry({
      name: input.name,
      email: input.email,
      company: input.company || undefined,
      phone: input.phone || undefined,
      projectType: input.projectType,
      budget: input.budget,
      description: input.description,
      referenceUrl: input.referenceUrl || undefined,
    });
    recordSubmission(fingerprint);
    return NextResponse.json(
      {
        success: true,
        message: "درخواست شما ثبت شد.",
        data: record,
      },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    logError("[api/projects] POST failed", error);
    return internalError();
  }
}