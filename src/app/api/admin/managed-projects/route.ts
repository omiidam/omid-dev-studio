import { NextResponse } from "next/server";
import { managedProjectSchema, MANAGED_PROJECT_TYPES } from "@/lib/managed-project-schema";
import {
  MANAGED_PROJECT_STATUSES,
  PAYMENT_STATUSES,
} from "@/lib/managed-projects";
import {
  createManagedProjectRecord,
  listManagedProjectRecords,
  DatabaseUnavailableError,
} from "@/lib/managed-project-db";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Managed-projects collection (Phase 3).
 *
 *   GET  /api/admin/managed-projects?status=&payment=&type=&q=&sort=
 *   POST /api/admin/managed-projects
 *
 * The proxy blocks unauthenticated callers; this handler re-verifies the
 * session token itself (defense in depth) and rate-limits per IP. The
 * response format follows the project convention: { success, data | error }.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function internalError() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "خطای داخلی رخ داد." },
    },
    { status: 500, headers: NO_STORE },
  );
}

/** Real database outage — 503, retryable, no fake success and no fallback. */
function databaseUnavailable() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "در دسترسی به پایگاه داده مشکلی پیش آمد. بعداً تلاش کنید.",
      },
    },
    { status: 503, headers: NO_STORE },
  );
}

function validationError(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION_ERROR", message } },
    { status: 422, headers: NO_STORE },
  );
}

/** One-of helper: returns the value when it is a member of the enum. */
function oneOf<T extends readonly string[]>(
  value: string | null,
  allowed: T,
): T[number] | null {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

export async function GET(request: Request) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:managed:list:${ip}`, 120);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "تعداد درخواست‌ها بیش از حد مجاز است." },
      },
      { status: 429, headers: NO_STORE },
    );
  }

  const url = new URL(request.url);
  try {
    const records = await listManagedProjectRecords({
      status: oneOf(url.searchParams.get("status"), MANAGED_PROJECT_STATUSES) ?? undefined,
      payment: oneOf(url.searchParams.get("payment"), PAYMENT_STATUSES) ?? undefined,
      type: oneOf(url.searchParams.get("type"), MANAGED_PROJECT_TYPES) ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
      sort: oneOf(url.searchParams.get("sort"), [
        "updated",
        "deadline",
        "progress",
      ] as const) ?? undefined,
      // archived=1 → include soft-deleted records (each carries its flag so
      // the UI can distinguish them); default remains active-only.
      includeArchived: url.searchParams.get("archived") === "1",
    });
    return NextResponse.json(
      { success: true, data: records, total: records.length },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects] GET: database unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects] GET failed", error);
    return internalError();
  }
}

export async function POST(request: Request) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:managed:create:${ip}`, 60);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "تعداد درخواست‌ها بیش از حد مجاز است." },
      },
      { status: 429, headers: NO_STORE },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("application/json")) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "فرمت درخواست باید JSON باشد." },
      },
      { status: 415, headers: NO_STORE },
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

  const parsed = managedProjectSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(
      parsed.error.issues[0]?.message ?? "اطلاعات پروژه معتبر نیست.",
    );
  }

  try {
    const created = await createManagedProjectRecord(parsed.data);
    return NextResponse.json(
      { success: true, data: created },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects] POST: database unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects] POST failed", error);
    return internalError();
  }
}
