/**
 * Lightweight, privacy-first analytics for OMID Studio.
 *
 * Everything is self-hosted and same-origin:
 *   • No third-party scripts, cookies or fingerprinting.
 *   • The only "collection" is a tiny, validated event stream POSTed to the
 *     same-origin `/api/analytics` route and written to a private server file.
 *   • Each event type declares the exact property names it may carry. Anything
 *     not declared is dropped before it leaves the page, and the server
 *     re-validates the same allowlist — project-inquiry content (names, emails,
 *     phone numbers, project descriptions) can structurally never be analytics
 *     payload.
 *
 * Reliability:
 *   • trackEvent() never throws and never participates in rendering — a
 *     failing queue just drops events, it can never break the page.
 *   • Events are batched, sent with keepalive, and a pagehide beacon flushes
 *     whatever is still queued when the tab closes.
 *   • No analytics call can ever trigger a request toward the project-inquiry
 *     endpoint; page views are deduped by route so React Strict Mode,
 *     hydration and soft navigations cannot double-fire the same event.
 */

/** Event schema — event name → the only property names that event may carry. */
export const ANALYTICS_EVENTS = {
  /** A route rendered to the user (page = pathname). */
  page_view: ["page"],
  /** Main "start a project" CTA in the hero. */
  hero_cta_click: [],
  /** "See projects" CTA in the hero. */
  hero_portfolio_click: [],
  /** Any CTA that routes toward the contact section. */
  contact_cta_click: ["source"],
  /** "Tell us what you build" CTA in the services section. */
  service_cta_click: [],
  /** "See all projects" CTA. */
  portfolio_view_click: [],
  /** A project card was opened (slug of that project). */
  portfolio_item_click: ["slug"],
  /** First interaction with the project-inquiry form. */
  form_start: [],
  /** Successful project-inquiry submission. */
  form_submit_success: [],
  /** Failed project-inquiry submission (reason only — never contents). */
  form_submit_error: ["reason"],
  /** A mailto link was clicked. */
  email_link_click: ["source"],
  /** An external (social) link was clicked. */
  external_link_click: ["label"],
  /** A navigation link was clicked (source = desktop | mobile | footer). */
  nav_link_click: ["label", "source"],
  /** The mobile navigation menu was opened. */
  mobile_nav_open: [],
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;

export type AnalyticsEventProps = Record<string, string | number | boolean>;

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: AnalyticsEventProps;
  ts: number;
}

const MAX_PROP_LENGTH = 100;
const MAX_BATCH = 60;
const MAX_QUEUE = 200;
const ENDPOINT = "/api/analytics";

const queue: AnalyticsEvent[] = [];
let flushTimer: number | null = null;
let inFlight = false;
let hooksInstalled = false;

/** Returns props restricted to the event's declared allowlist. */
function restrictProps(
  name: AnalyticsEventName,
  props: AnalyticsEventProps | undefined,
): AnalyticsEventProps {
  const allowed = new Set<string>(ANALYTICS_EVENTS[name]);
  const safe: AnalyticsEventProps = {};
  if (!props) return safe;
  for (const key of Object.keys(props)) {
    if (!allowed.has(key)) continue;
    const value = props[key];
    if (typeof value === "string") {
      const trimmed = value.slice(0, MAX_PROP_LENGTH);
      if (trimmed.length > 0) safe[key] = trimmed;
    } else if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }
  return safe;
}

function enqueue(event: AnalyticsEvent): void {
  queue.push(event);
  if (queue.length > MAX_QUEUE) {
    // Bound the queue — drop the oldest events instead of growing forever.
    queue.splice(0, queue.length - MAX_QUEUE);
  }
  // If the page is already hidden the pagehide beacon will send the rest;
  // a timer would have nothing to run on after unload anyway.
  if (document.visibilityState === "hidden") return;
  void scheduleFlush();
}

function scheduleFlush(delay = 1500): void {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flush();
  }, delay);
}

async function flush(): Promise<void> {
  if (inFlight || queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  inFlight = true;
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`analytics endpoint ${response.status}`);
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[analytics] flushed ${batch.length} event(s)`);
    }
  } catch {
    // Offline/busy — put the batch back (capped) so a later flush can retry.
    queue.unshift(...batch);
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  } finally {
    inFlight = false;
    if (queue.length > 0) void scheduleFlush();
  }
}

function sendRemainingViaBeacon(): void {
  if (queue.length === 0) return;
  try {
    const payload = JSON.stringify({ events: queue.splice(0, MAX_BATCH) });
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(ENDPOINT, blob);
  } catch {
    /* best effort — losing analytics is always preferable to breaking a page */
  }
}

function installHooksOnce(): void {
  if (hooksInstalled || typeof window === "undefined") return;
  hooksInstalled = true;
  window.addEventListener("pagehide", () => sendRemainingViaBeacon());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendRemainingViaBeacon();
  });
}

/**
 * Records one interaction. Browser-only; safe to call from client lifecycle
 * and event handlers. Unknown props are silently dropped for the event's
 * declared allowlist.
 */
export function trackEvent(
  name: AnalyticsEventName,
  props?: AnalyticsEventProps,
): void {
  if (typeof window === "undefined") return;
  installHooksOnce();
  const safeProps = restrictProps(name, props);
  enqueue({ name, props: safeProps, ts: Date.now() });
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[analytics] track ${name}`, safeProps);
  }
}