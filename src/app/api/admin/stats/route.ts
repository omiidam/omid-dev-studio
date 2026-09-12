import { NextResponse } from "next/server";
import { getInquiryStats } from "@/lib/project-store";
import { requestIsAdminAuthed, unauthorizedAdminResponse } from "@/lib/auth";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Admin dashboard statistics.
 *
 *   GET /api/admin/stats
 *
 * Every number is computed server-side from the real persisted store —
 * nothing is fabricated or hardcoded. Consumed by the admin dashboard card.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!requestIsAdminAuthed(request)) return unauthorizedAdminResponse();

  const ip = getClientIp(request);
  const limited = rateLimitHit(`admin:stats:${ip}`, 120);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "تعداد درخواست‌ها بیش از حد مجاز است." },
      },
      { status: 429, headers: NO_STORE },
    );
  }

  try {
    const stats = await getInquiryStats();
    return NextResponse.json(
      { success: true, data: stats },
      { headers: NO_STORE },
    );
  } catch (error) {
    logError("[api/admin/stats] GET failed", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "خطای داخلی رخ داد." },
      },
      { status: 500, headers: NO_STORE },
    );
  }
}