import { NextResponse } from "next/server";
import { milestoneSchema, isValidMilestoneId } from "@/lib/milestone-schema";
import {
  createMilestoneRecord,
  listMilestoneRecords,
  projectExistsRecord,
  DatabaseUnavailableError,
} from "@/lib/managed-project-db";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Milestone collection for one project (Phase 6).
 *
 *   GET  /api/admin/managed-projects/:id/milestones
 *   POST /api/admin/managed-projects/:id/milestones
 *
 * Same conventions as the managed-projects routes: the proxy blocks
 * unauthenticated callers, the handler re-verifies the session cookie
 * (defense in depth), the project relationship is validated against the
 * database (no client-trusted IDs), and responses use the project-standard
 * { success, data | error } envelope with Persian user-safe messages.
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

function databaseUnavailable() {
  return jsonError(
    503,
    "DATABASE_UNAVAILABLE",
    "در دسترسی به پایگاه داده مشکلی پیش آمد. بعداً تلاش کنید.",
  );
}

export async function GET(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:milestones:list:${ip}`, 120);
  if (!limited.allowed) {
    return jsonError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است.");
  }

  const { id } = await params;
  if (!isValidMilestoneId(id)) {
    return jsonError(400, "INVALID_ID", "شناسه پروژه معتبر نیست.");
  }

  try {
    // The parent must exist — otherwise an arbitrary ID would yield an
    // empty list indistinguishable from a real project with no milestones.
    if (!(await projectExistsRecord(id))) {
      return jsonError(404, "NOT_FOUND", "پروژه پیدا نشد.");
    }
    const milestones = await listMilestoneRecords(id);
    return NextResponse.json(
      { success: true, data: milestones },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects/:id/milestones] GET: db unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects/:id/milestones] GET failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}

export async function POST(request: Request, { params }: Params) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:milestones:create:${ip}`, 60);
  if (!limited.allowed) {
    return jsonError(429, "RATE_LIMITED", "تعداد درخواست‌ها بیش از حد مجاز است.");
  }

  const { id } = await params;
  if (!isValidMilestoneId(id)) {
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

  const parsed = milestoneSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      422,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "اطلاعات مرحله معتبر نیست.",
    );
  }

  try {
    if (!(await projectExistsRecord(id))) {
      return jsonError(404, "NOT_FOUND", "پروژه پیدا نشد.");
    }
    const created = await createMilestoneRecord(id, parsed.data);
    return NextResponse.json(
      { success: true, data: created },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      logError("[api/admin/managed-projects/:id/milestones] POST: db unavailable", error);
      return databaseUnavailable();
    }
    logError("[api/admin/managed-projects/:id/milestones] POST failed", error);
    return jsonError(500, "INTERNAL_ERROR", "خطای داخلی رخ داد.");
  }
}
