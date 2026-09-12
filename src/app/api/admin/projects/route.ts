import { NextResponse } from "next/server";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/project-schema";
import { listInquiries } from "@/lib/project-store";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Admin project-inquiry listing.
 *
 *   GET /api/admin/projects?status=new&sort=oldest&q=...
 *
 * Filtering and sorting happen on real persisted data, server-side. The
 * proxy blocks unauthenticated callers; this handler re-verifies the session
 * token itself (defense in depth) and rate-limits per IP.
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

export async function GET(request: Request) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:projects:list:${ip}`, 120);
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
  const statusParam = url.searchParams.get("status") ?? "";
  const sortParam = url.searchParams.get("sort") ?? "newest";
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  // Status filter is validated against the canonical enum — any unknown
  // value is treated as "no filter" rather than echoed into an error.
  const status = (PROJECT_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as ProjectStatus)
    : null;

  try {
    const all = await listInquiries();
    const filtered = status
      ? all.filter((inquiry) => inquiry.status === status)
      : all;

    const searched = query
      ? filtered.filter((inquiry) =>
          [inquiry.name, inquiry.email, inquiry.company, inquiry.description]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(query)),
        )
      : filtered;

    const sorted = [...searched].sort((a, b) => {
      const delta =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortParam === "oldest" ? -delta : delta;
    });

    return NextResponse.json(
      { success: true, data: sorted, total: sorted.length },
      { headers: NO_STORE },
    );
  } catch (error) {
    logError("[api/admin/projects] GET failed", error);
    return internalError();
  }
}