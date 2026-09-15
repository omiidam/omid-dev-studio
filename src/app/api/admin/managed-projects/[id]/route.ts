import { NextResponse } from "next/server";
import {
  managedProjectUpdateSchema,
  isValidProjectId,
  datesAreConsistent,
} from "@/lib/managed-project-schema";
import {
  getManagedProjectRecord,
  updateManagedProjectRecord,
  archiveManagedProjectRecord,
  restoreManagedProjectRecord,
  DatabaseUnavailableError,
} from "@/lib/managed-project-db";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Managed-project item (Phase 3, archive/restore added in Phase 5).
 *
 *   GET    /api/admin/managed-projects/:id   → full record (archived included)
 *   POST   /api/admin/managed-projects/:id   → restore an archived project
 *   PATCH  /api/admin/managed-projects/:id   → partial update, validated field-by-field
 *   DELETE /api/admin/managed-projects/:id   → soft delete (archive), never destroyed
 *
 * The proxy blocks unauthenticated callers; this handler re-verifies the
 * session cookie itself (defense in depth) and rate-limits per IP.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ id: string }> };

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: NO_STORE },
  );
}

/** Real database outage — 503, retryable, no fake success and no fallback. */
function databaseUnavailable() {
  return jsonError(
    503,
    "DATABASE_UNAVAILABLE",
    "در دسترسی به پایگاه داده مشکلی پیش آمد. بعداً تلاش کنید.",
  );
}

export async function GET(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const { id } = await params;
  if (!isValidProjectId(id)) {
    return jsonError(400, "INVALID_ID", "شناسه پروژه معتبر نیست.");
  }

  try {
    // Archived records are returned with their archived flag so the UI can
    // distinguish (and restore) them; active-only consumers filter client-side.
    const record = await getManagedProjectRecord(id, { includeArchived: true });
    if (!record) {
      return jsonError(404, "NOT_FOUND", "پروژه پیدا نشد.");
    }
    return NextResponse.json(
      { success: true, data: record },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects/:id] GET: database unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects/:id] GET failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}

export async function PATCH(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:managed:update:${ip}`, 90);
  if (!limited.allowed) {
    return jsonError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است.");
  }

  const { id } = await params;
  if (!isValidProjectId(id)) {
    return jsonError(400, "INVALID_ID", "شناسه پروژه معتبر نیست.");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("application/json")) {
    return jsonError(415, "UNSUPPORTED_MEDIA_TYPE", "فرمت درخواست باید JSON باشد.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "بدنه‌ی درخواست JSON معتبر نیست.");
  }

  const parsed = managedProjectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "اطلاعات پروژه معتبر نیست.",
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return jsonError(422, "VALIDATION_ERROR", "هیچ فیلدی برای به‌روزرسانی ارسال نشده است.");
  }

  // Cross-field rule on the merged record: deadline ≥ startDate.
  try {
    const current = await getManagedProjectRecord(id);
    if (!current) {
      return jsonError(404, "NOT_FOUND", "پروژه پیدا نشد.");
    }
    const merged = { ...current, ...parsed.data };
    if (!datesAreConsistent(merged)) {
      return jsonError(
        422,
        "VALIDATION_ERROR",
        "مهلت تحویل نمی‌تواند پیش از تاریخ شروع باشد.",
      );
    }

    const updated = await updateManagedProjectRecord(id, parsed.data);
    if (!updated) {
      return jsonError(404, "NOT_FOUND", "پروژه پیدا نشد یا بایگانی شده است.");
    }
    return NextResponse.json(
      { success: true, data: updated },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects/:id] PATCH: database unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects/:id] PATCH failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:managed:archive:${ip}`, 30);
  if (!limited.allowed) {
    return jsonError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است.");
  }

  const { id } = await params;
  if (!isValidProjectId(id)) {
    return jsonError(400, "INVALID_ID", "شناسه پروژه معتبر نیست.");
  }

  try {
    const archived = await archiveManagedProjectRecord(id);
    if (!archived) {
      return jsonError(404, "NOT_FOUND", "پروژه پیدا نشد.");
    }
    return NextResponse.json(
      { success: true, data: { id: archived.id, archived: true } },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects/:id] DELETE: database unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects/:id] DELETE failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}

/** Restore a soft-deleted (archived) project back to the active list. */
export async function POST(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:managed:update:${ip}`, 90);
  if (!limited.allowed) {
    return jsonError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است.");
  }

  const { id } = await params;
  if (!isValidProjectId(id)) {
    return jsonError(400, "INVALID_ID", "شناسه پروژه معتبر نیست.");
  }

  try {
    const restored = await restoreManagedProjectRecord(id);
    if (!restored) {
      return jsonError(404, "NOT_FOUND", "پروژه بایگانی‌شده‌ای با این شناسه پیدا نشد.");
    }
    return NextResponse.json(
      { success: true, data: restored },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects/:id] POST: database unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects/:id] POST failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}
