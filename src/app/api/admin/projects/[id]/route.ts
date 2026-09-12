import { NextResponse } from "next/server";
import { adminProjectUpdateSchema } from "@/lib/project-schema";
import { getInquiry, updateInquiry } from "@/lib/project-store";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Admin project-inquiry detail + update.
 *
 *   GET   /api/admin/projects/[id] → one inquiry
 *   PATCH /api/admin/projects/[id] → change status / priority / notes
 *
 * Status transitions are always validated against the canonical enum on the
 * server — the client never decides what is a legal value. When the update
 * is empty or irrelevant, the endpoint still echoes the untouched record so
 * the consumer's state stays consistent.
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

function notFound() {
  return NextResponse.json(
    {
      success: false,
      error: { code: "NOT_FOUND", message: "درخواست پروژه یافت نشد." },
    },
    { status: 404, headers: NO_STORE },
  );
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const { id } = await params;
  // UUIDs are opaque safe identifiers — never used to build a filesystem
  // path, so traversal is impossible by construction.
  try {
    const inquiry = await getInquiry(id);
    if (!inquiry) return notFound();
    return NextResponse.json(
      { success: true, data: inquiry },
      { headers: NO_STORE },
    );
  } catch (error) {
    logError("[api/admin/projects/[id]] GET failed", error);
    return internalError();
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:projects:patch:${ip}`, 60);
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

  const parsed = adminProjectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "اطلاعات ارسال‌شده معتبر نیست. وضعیت، اولویت و یادداشت باید مقدار شناخته‌شده داشته باشند.",
        },
      },
      { status: 422, headers: NO_STORE },
    );
  }

  const { id } = await params;
  const update = parsed.data;
  const patch = {
    status: update.status,
    priority: update.priority === undefined ? undefined : update.priority,
    adminNotes: update.adminNotes === undefined ? undefined : update.adminNotes,
  };

  try {
    const updated = await updateInquiry(id, patch);
    if (!updated) return notFound();
    return NextResponse.json(
      { success: true, data: updated },
      { headers: NO_STORE },
    );
  } catch (error) {
    logError("[api/admin/projects/[id]] PATCH failed", error);
    return internalError();
  }
}