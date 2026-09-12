import { NextResponse } from "next/server";
import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventProps,
} from "@/lib/analytics";
import { appendAnalyticsEvents } from "@/lib/analytics-store";
import { getClientIp, rateLimitHit } from "@/lib/rate-limit";
import { logError } from "@/lib/log";

/**
 * Analytics ingestion — the same-origin receiving end of the client event
 * stream.
 *
 * Privacy by construction:
 *   • The event-name allowlist (ANALYTICS_EVENTS) is the contract. Any event
 *     whose name is unknown is rejected; any property not declared for that
 *     event is dropped. Inquiry content (names, emails, phones, project
 *     descriptions) can never pass this schema.
 *   • Props are flat scalars only; oversized strings are dropped, not echoed.
 *   • The response never echoes received data back to the client.
 *
 * The route answers `success: true` for every structurally valid batch even if
 * persistence fails, so the client never retries (which would be the only way
 * duplicate analytics events could be created).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_EVENTS = 60;
const MAX_PROP_LENGTH = 100;
const NO_STORE = { "Cache-Control": "no-store" };

interface ParsedEvent {
  name: AnalyticsEventName;
  props: AnalyticsEventProps;
  ts: number;
}

/** Accepts one raw event object against the schema; malformed items drop out. */
function parseEvent(raw: unknown): ParsedEvent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const name = record.name;
  if (typeof name !== "string" || !(name in ANALYTICS_EVENTS)) return null;

  const allowed = new Set<string>(ANALYTICS_EVENTS[name as AnalyticsEventName]);
  const props: AnalyticsEventProps = {};
  if (record.props !== undefined) {
    if (typeof record.props !== "object" || record.props === null) return null;
    for (const [key, value] of Object.entries(
      record.props as Record<string, unknown>,
    )) {
      if (!allowed.has(key)) continue; // undeclared prop → never stored
      if (typeof value === "string") {
        const trimmed = value.slice(0, MAX_PROP_LENGTH);
        if (trimmed.length > 0) props[key] = trimmed;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        props[key] = value;
      } else if (typeof value === "boolean") {
        props[key] = value;
      }
    }
  }

  // The client stamps ts; clamp obviously-fabricated timestamps so a buggy or
  // hostile clock can never poison the stored stream.
  let ts = typeof record.ts === "number" && Number.isFinite(record.ts)
    ? record.ts
    : Date.now();
  const now = Date.now();
  if (ts < now - 24 * 3600 * 1000 || ts > now + 24 * 3600 * 1000) ts = now;

  return { name: name as AnalyticsEventName, props, ts };
}

export async function POST(request: Request) {
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

  const limited = rateLimitHit(`analytics:post:${getClientIp(request)}`, 200);
  if (!limited.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "تعداد درخواست‌ها بیش از حد مجاز است.",
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
        error: { code: "INVALID_JSON", message: "بدنه‌ی درخواست JSON معتبر نیست." },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const rawEvents =
    typeof body === "object" && body !== null && "events" in body
      ? (body as { events?: unknown }).events
      : null;
  if (
    !Array.isArray(rawEvents) ||
    rawEvents.length === 0 ||
    rawEvents.length > MAX_EVENTS
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "بار رویداد نامعتبر است.",
        },
      },
      { status: 422, headers: NO_STORE },
    );
  }

  const events = rawEvents
    .map(parseEvent)
    .filter((event): event is ParsedEvent => event !== null);
  if (events.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "بار رویداد نامعتبر است.",
        },
      },
      { status: 422, headers: NO_STORE },
    );
  }

  // Best-effort persistence — analytics must never fail the analytics POST
  // in a way that makes the client retry (that would duplicate events).
  try {
    await appendAnalyticsEvents(events);
  } catch (error) {
    logError("[api/analytics] persist failed", error);
  }

  return NextResponse.json({ success: true, count: events.length }, { headers: NO_STORE });
}