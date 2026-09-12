import { NextResponse } from "next/server";
import { APP_VERSION } from "@/config/version";
import {
  getCompletedVersion,
  setCompletedVersion,
} from "@/lib/update-store";
import {
  issueUpdateClientCookie,
  requestUpdateClientId,
} from "@/lib/update-client";
import { rateLimitHit, getClientIp } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Update-completion endpoint — the ONLY place a client's completed version is
 * advanced, and only after the whole operation succeeded end-to-end:
 *
 *   POST /api/update/complete
 *   body: { fromVersion: string, toVersion: string }
 *   → 200 { success, data: { updateRequired: false, ... } }
 *
 * Atomicity rules enforced here:
 *   • The request must declare exactly the transition the backend requires
 *     (fromVersion = current stored completed version, toVersion =
 *     APP_VERSION) — stale or forged completions are rejected.
 *   • Validation, rate limiting and persistence all run before the response;
 *     any failure leaves the stored state untouched, so the client remains
 *     "not updated" and the update form re-appears on the next status check.
 *   • Persistence uses an atomic file write inside a serialized lock: the
 *     completed version is never advanced unless the write fully succeeded.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function devLog(...parts: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.log("[UPDATE]", ...parts);
  }
}

interface CompleteBody {
  fromVersion?: unknown;
  toVersion?: unknown;
}

function badRequest(code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: 400, headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = rateLimitHit(`update:complete:${ip}`, 20);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
        },
      },
      { status: 429, headers: NO_STORE },
    );
  }

  let body: CompleteBody;
  try {
    body = (await request.json()) as CompleteBody;
  } catch {
    devLog("validation failed — invalid JSON body");
    return badRequest("INVALID_JSON", "بدنه‌ی درخواست JSON معتبر نیست.");
  }

  const fromVersion =
    body.fromVersion === null
      ? null
      : typeof body.fromVersion === "string"
        ? body.fromVersion
        : undefined;
  const toVersion = typeof body.toVersion === "string" ? body.toVersion : null;

  // Validation — the declared transition must match backend reality exactly.
  // `fromVersion: null` legitimately means "never completed any version".
  devLog("submission started", `from=${fromVersion ?? "none"}`, `to=${toVersion ?? "?"}`);
  if (fromVersion === undefined || !toVersion) {
    devLog("validation failed — missing version fields");
    return badRequest(
      "VALIDATION_ERROR",
      "اطلاعات به‌روزرسانی ناقص است.",
    );
  }
  if (toVersion !== APP_VERSION) {
    devLog("validation failed — toVersion does not match required version");
    return badRequest(
      "VERSION_MISMATCH",
      "نسخه‌ی اعلام‌شده با نسخه‌ی مورد نیاز یکسان نیست.",
    );
  }

  try {
    let clientId = requestUpdateClientId(request);
    let setCookie: string | null = null;
    if (!clientId) {
      const issued = issueUpdateClientCookie();
      clientId = issued.value;
      setCookie = issued.header;
    }

    const stored = await getCompletedVersion(clientId);
    if (stored !== fromVersion) {
      // Stale, replayed or forged completion — refuse without persisting.
      devLog(
        "validation failed — stored completed version does not match request",
        `stored=${stored ?? "none"}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "STALE_UPDATE_STATE",
            message: "وضعیت به‌روزرسانی تغییر کرده است. دوباره تلاش کنید.",
          },
        },
        { status: 409, headers: NO_STORE },
      );
    }

    if (stored === APP_VERSION) {
      // Already persisted (e.g. a retried completion) — idempotent success.
      devLog("persistence already done — idempotent completion");
      const response = NextResponse.json(
        {
          success: true,
          data: {
            updateRequired: false,
            currentVersion: APP_VERSION,
            userCompletedVersion: stored,
            effectiveVersion: stored,
          },
        },
        { headers: NO_STORE },
      );
      if (setCookie) response.headers.set("Set-Cookie", setCookie);
      return response;
    }

    // Persistence — only this atomic write advances the completed version.
    devLog("persistence started", `clientId=***`, `version=${APP_VERSION}`);
    await setCompletedVersion(clientId, APP_VERSION);
    devLog("persistence succeeded", `version=${APP_VERSION}`);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          updateRequired: false,
          currentVersion: APP_VERSION,
          userCompletedVersion: APP_VERSION,
          // Effective version advances HERE — only after persistence succeeded.
          effectiveVersion: APP_VERSION,
        },
      },
      { headers: NO_STORE },
    );
    if (setCookie) response.headers.set("Set-Cookie", setCookie);
    return response;
  } catch (error) {
    logError("[api/update/complete] POST failed", error);
    devLog("persistence failed");
    // Any failure leaves the stored state untouched → still not updated.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PERSISTENCE_FAILED",
          message: "ثبت به‌روزرسانی انجام نشد. دوباره تلاش کنید.",
        },
      },
      { status: 500, headers: NO_STORE },
    );
  } finally {
    devLog("final status check complete");
  }
}
