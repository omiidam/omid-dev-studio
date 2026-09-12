import { NextResponse } from "next/server";
import { APP_VERSION } from "@/config/version";
import {
  getCompletedVersion,
} from "@/lib/update-store";
import {
  issueUpdateClientCookie,
  requestUpdateClientId,
} from "@/lib/update-client";
import { logError } from "@/lib/log";

/**
 * Update-status endpoint — the backend is the single authority on whether an
 * update is required.
 *
 *   GET /api/update/status
 *   → 200 { success, data: { updateRequired, currentVersion, userCompletedVersion, effectiveVersion } }
 *
 * `effectiveVersion` is the version whose content the client is entitled to —
 * always the last COMPLETED version, never the latest release. A client whose
 * completed version is behind the required version must keep receiving its
 * effective (previous) version state; the update form is the only gateway
 * between the two.
 *
 * A stable anonymous client identity (httpOnly cookie) is issued on first
 * contact. `updateRequired` is true whenever the persisted completed version
 * differs from the current required version — including "never completed".
 * Responses are `no-store`: no cache layer may answer for the backend.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function devLog(...parts: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.log("[UPDATE]", ...parts);
  }
}

export async function GET(request: Request) {
  try {
    let clientId = requestUpdateClientId(request);
    let setCookie: string | null = null;
    if (!clientId) {
      const issued = issueUpdateClientCookie();
      clientId = issued.value;
      setCookie = issued.header;
    }

    const userCompletedVersion = await getCompletedVersion(clientId);
    const updateRequired = userCompletedVersion !== APP_VERSION;

    devLog(
      "status request",
      `current backend version=${APP_VERSION}`,
      `user completed version=${userCompletedVersion ?? "none"}`,
      `update required=${updateRequired}`,
    );

    const response = NextResponse.json(
      {
        success: true,
        data: {
          updateRequired,
          currentVersion: APP_VERSION,
          userCompletedVersion: userCompletedVersion ?? null,
          // Authoritative effective version: what the user has actually
          // completed — NOT the deployed release. It advances only via
          // /api/update/complete after full persistence.
          effectiveVersion: userCompletedVersion ?? null,
        },
      },
      { headers: NO_STORE },
    );
    if (setCookie) response.headers.set("Set-Cookie", setCookie);
    return response;
  } catch (error) {
    logError("[api/update/status] GET failed", error);
    // Unavailable backend → the client must NOT be considered updated.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPDATE_STATUS_UNAVAILABLE",
          message: "وضعیت به‌روزرسانی در دسترس نیست.",
        },
      },
      { status: 503, headers: NO_STORE },
    );
  }
}
