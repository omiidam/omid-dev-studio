import { NextResponse } from "next/server";
import {
  milestoneUpdateSchema,
  isValidMilestoneId,
  milestoneDatesAreConsistent,
} from "@/lib/milestone-schema";
import {
  getMilestoneRecord,
  updateMilestoneRecord,
  deleteMilestoneRecord,
  DatabaseUnavailableError,
} from "@/lib/managed-project-db";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Milestone item (Phase 6).
 *
 *   GET    /api/admin/managed-projects/:id/milestones/:milestoneId
 *   PATCH  /api/admin/managed-projects/:id/milestones/:milestoneId
 *   DELETE /api/admin/managed-projects/:id/milestones/:milestoneId
 *
 * The milestone is always addressed through its parent project in the URL,
 * and the data layer enforces that relationship — there is no way to reach
 * another project's milestone by guessing its ID.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

type Params = { params: Promise<{ id: string; milestoneId: string }> };

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: NO_STORE },
  );
}

function databaseUnavailable() {
  return jsonError(
    503,
    "DATABASE_UNAVAILABLE",
    "در دسترسی به پایگاه داده مشکلی پیش آمد. بعداً تلاش کنید.",
  );
}

export async function GET(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const { id, milestoneId } = await params;
  if (!isValidMilestoneId(id) || !isValidMilestoneId(milestoneId)) {
    return jsonError(400, "INVALID_ID", "شناسه ارسالی معتبر نیست.");
  }

  try {
    const milestone = await getMilestoneRecord(id, milestoneId);
    if (!milestone) {
      return jsonError(404, "NOT_FOUND", "مرحله پیدا نشد.");
    }
    return NextResponse.json(
      { success: true, data: milestone },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[milestones/:milestoneId] GET: db unavailable", error);
      return databaseUnavailable();
    }
    logError("[milestones/:milestoneId] GET failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}

export async function PATCH(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:milestones:update:${ip}`, 90);
  if (!limited.allowed) {
    return jsonError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است.");
  }

  const { id, milestoneId } = await params;
  if (!isValidMilestoneId(id) || !isValidMilestoneId(milestoneId)) {
    return jsonError(400, "INVALID_ID", "شناسه ارسالی معتبر نیست.");
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

  const parsed = milestoneUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "اطلاعات مرحله معتبر نیست.",
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return jsonError(422, "VALIDATION_ERROR", "هیچ فیلدی برای به‌روزرسانی ارسال نشده است.");
  }

  try {
    const current = await getMilestoneRecord(id, milestoneId);
    if (!current) {
      return jsonError(404, "NOT_FOUND", "مرحله پیدا نشد.");
    }
    // Cross-field date rule on the merged record (deadline ≥ startDate).
    if (!milestoneDatesAreConsistent({ ...current, ...parsed.data })) {
      return jsonError(
        422,
        "VALIDATION_ERROR",
        "مهلت مرحله نمی‌تواند پیش از تاریخ شروع آن باشد.",
      );
    }

    const updated = await updateMilestoneRecord(id, milestoneId, parsed.data);
    if (!updated) {
      return jsonError(404, "NOT_FOUND", "مرحله پیدا نشد.");
    }
    return NextResponse.json(
      { success: true, data: updated },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[milestones/:milestoneId] PATCH: db unavailable", error);
      return databaseUnavailable();
    }
    logError("[milestones/:milestoneId] PATCH failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:milestones:delete:${ip}`, 30);
  if (!limited.allowed) {
    return jsonError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است.");
  }

  const { id, milestoneId } = await params;
  if (!isValidMilestoneId(id) || !isValidMilestoneId(milestoneId)) {
    return jsonError(400, "INVALID_ID", "شناسه ارسالی معتبر نیست.");
  }

  try {
    const deleted = await deleteMilestoneRecord(id, milestoneId);
    if (!deleted) {
      return jsonError(404, "NOT_FOUND", "مرحله پیدا نشد.");
    }
    return NextResponse.json(
      { success: true, data: { id: milestoneId, deleted: true } },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[milestones/:milestoneId] DELETE: db unavailable", error);
      return databaseUnavailable();
    }
    logError("[milestones/:milestoneId] DELETE failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}
