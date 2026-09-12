"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EASE } from "@/lib/animations";
import { APP_VERSION } from "@/config/version";
import {
  RELEASE_CATEGORY_LABELS,
  RELEASE_INFO,
  type ReleaseCategory,
  type ReleaseChange,
} from "@/config/release";
import { toFaDigits } from "@/lib/utils";

/**
 * Update offer — backend-authoritative version flow, NON-BLOCKING.
 *
 * The user's completed version lives on the backend and is exposed via
 * GET /api/update/status as effectiveVersion. When the backend reports
 * updateRequired, this component shows a small floating update card while
 * the CURRENT application stays fully visible and usable underneath —
 * navigation, scrolling and interaction are never blocked, the page never
 * goes dark, and there is no lock screen.
 *
 * Lifecycle:
 *   1. Every application entry → GET /api/update/status (no-store).
 *   2. updateRequired → the card slides in; «بعداً» postpones it for the
 *      current page session (backend state untouched — completedVersion and
 *      effectiveVersion remain exactly as they were).
 *   3. «به‌روزرسانی» applies the pending service worker (real asset update),
 *      then POSTs /api/update/complete. ONLY after a fresh status request
 *      returns updateRequired: false — i.e. the backend has persisted the
 *      new completedVersion — does the page reload into the new version.
 *   4. Any failure (network, validation, persistence) leaves both versions
 *      untouched; the card returns to its offer state with an error note.
 *
 * Architectural note: the deployment serves a single static Next.js bundle,
 * so historical per-version bundles are not retained; the backend remains
 * the sole authority for the user's completed/effective version and for
 * whether the update flow is offered at all.
 */

/** Shape of GET /api/update/status → data. */
interface UpdateStatus {
  updateRequired: boolean;
  currentVersion: string;
  userCompletedVersion: string | null;
  /** Version the client is on — the backend's record of what they completed. */
  effectiveVersion: string | null;
  /** Metadata of the release being offered, served by the latest release. */
  release?: {
    version: string;
    previousVersion: string;
    changes: ReleaseChange[];
  };
}

type Phase =
  | "checking" // initial backend query — page renders normally meanwhile
  | "offer" // update available — card shown, app fully usable
  | "updating" // user accepted — SW swap in progress
  | "activating" // backend confirmation in progress
  | "error"; // failed — offer restored, versions unchanged

const CATEGORY_ORDER: ReleaseCategory[] = ["new", "improvement", "fix", "optimization"];

/** Group a release's changes by category (labels shown only when present). */
function groupChanges(changes: ReleaseChange[]) {
  const groups: { category: ReleaseCategory; items: ReleaseChange[] }[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = changes.filter((change) => change.category === category);
    if (items.length > 0) groups.push({ category, items });
  }
  return groups;
}

function devLog(...parts: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.log("[UPDATE]", ...parts);
  }
}

/** Guard so a single update flow can never reload more than once. */
let reloadRequested = false;

export function ServiceWorkerRegistration() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  /** «بعداً» postpones the offer for this page session only — never persisted. */
  const [postponed, setPostponed] = useState(false);
  const updateButtonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ── Ask the backend for the authoritative update status on every entry ── */
  const fetchStatus = useCallback(async (): Promise<UpdateStatus | null> => {
    try {
      const response = await fetch("/api/update/status", { cache: "no-store" });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        (body as { success?: unknown }).success === true &&
        typeof (body as { data?: unknown }).data === "object"
      ) {
        const data = (body as { data: UpdateStatus }).data;
        if (typeof data.updateRequired === "boolean") return data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      devLog("[VERSION-GATE] application startup — asking backend");
      const data = await fetchStatus();
      if (!active) return;
      if (!data) {
        // Backend unavailable → the app simply runs and we retry quietly.
        // We never mark the user updated and never block the page over it.
        devLog("[VERSION-GATE] status unavailable — app runs, retrying in 5s");
        retryTimer = setTimeout(() => {
          if (mountedRef.current) setPhase((p) => (p === "checking" ? "checking" : p));
        }, 5000);
        return;
      }
      devLog(
        `[VERSION-GATE] server completedVersion=${data.userCompletedVersion ?? "none"}`,
        `requiredVersion=${data.currentVersion}`,
        `effectiveVersion=${data.effectiveVersion ?? "none"}`,
        `updateRequired=${data.updateRequired}`,
      );
      devLog(`[VERSION-GATE] frontend/build version=${APP_VERSION}`);
      // Invariant: before a successful update the effective version must
      // equal the completed version. If not, the backend state is corrupt.
      if (
        data.effectiveVersion !== null &&
        data.effectiveVersion !== data.userCompletedVersion
      ) {
        devLog(
          "[VERSION-GATE] INVALID STATE — effectiveVersion ≠ completedVersion",
          `effective=${data.effectiveVersion}`,
          `completed=${data.userCompletedVersion}`,
        );
      }
      setStatus(data);
      setPhase(data.updateRequired ? "offer" : "checking");
      if (data.updateRequired) {
        devLog(
          `[VERSION-GATE] update offered — user remains on effective version ${data.effectiveVersion ?? "none"}, app stays fully usable`,
        );
      } else {
        devLog("[VERSION-GATE] user up to date");
      }
    })();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [fetchStatus, status === null]);

  /* ── Service-worker registration (production only) ──
     The SW performs the real asset update; the backend decides whether an
     update offer is shown at all. */
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let active = true;
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (!active) return;
        const trackWorker = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              // A newer worker is ready — re-check; the offer re-asserts
              // itself if the backend still requires the update.
              fetchStatus().then((data) => {
                if (!active || !data) return;
                setStatus(data);
                if (data.updateRequired) {
                  setPhase((current) => (current === "checking" ? "offer" : current));
                }
              });
            }
          });
        };
        trackWorker(registration.installing);
        registration.addEventListener("updatefound", () => {
          trackWorker(registration.installing);
        });
      })
      .catch(() => {
        /* registration is best-effort — never break the page over it */
      });

    return () => {
      active = false;
    };
  }, [fetchStatus]);

  /* ── Focus the primary action once the offer renders ── */
  useEffect(() => {
    if (phase === "offer" || phase === "error") {
      updateButtonRef.current?.focus();
    }
  }, [phase, postponed]);

  const reloadOnce = useCallback(() => {
    if (reloadRequested) return;
    reloadRequested = true;
    devLog("[VERSION-GATE] application reload requested");
    window.location.reload();
  }, []);

  const performUpdate = useCallback(async () => {
    if (phase === "updating" || phase === "activating") return;
    setPhase("updating");
    devLog("[VERSION-GATE] update submission started");

    // 1) Apply the real asset update via the service worker (when one is
    //    waiting). Missing worker is fine: the version comparison lives on
    //    the backend, not in the worker.
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const worker = registration?.waiting || registration?.installing;
      if (worker) {
        const activated = new Promise<boolean>((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () =>
            resolve(true),
          );
          worker.addEventListener("statechange", function handler() {
            if (worker.state === "activated") {
              worker.removeEventListener("statechange", handler);
              resolve(true);
            }
          });
        });
        worker.postMessage({ type: "SKIP_WAITING" });
        await Promise.race([
          activated,
          new Promise((resolve) => setTimeout(() => resolve(true), 4000)),
        ]);
      }
    } catch {
      /* SW failure must not block backend confirmation */
    }

    // 2) Confirm completion to the backend — the ONLY source of truth.
    setPhase("activating");
    devLog(`[VERSION-GATE] completedVersion BEFORE=${status?.userCompletedVersion ?? "none"}`);
    try {
      const fromVersion = status?.userCompletedVersion ?? null;
      const response = await fetch("/api/update/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromVersion,
          toVersion: status?.currentVersion ?? APP_VERSION,
        }),
      });

      if (!response.ok) {
        devLog(`[VERSION-GATE] update validation failed — status ${response.status}`);
        setPhase("error");
        return;
      }

      devLog("[VERSION-GATE] update persistence result — backend accepted");
      // 3) Re-fetch status: the transition happens ONLY if the backend now
      //    says updateRequired === false. Never locally assume success.
      const fresh = await fetchStatus();
      if (!fresh) {
        devLog("[VERSION-GATE] status unavailable after completion — staying on offer");
        setPhase("error");
        return;
      }
      devLog(
        `[VERSION-GATE] final status — updateRequired=${fresh.updateRequired}`,
        `effectiveVersion AFTER=${fresh.effectiveVersion ?? "none"}`,
      );
      setStatus(fresh);
      if (fresh.updateRequired) {
        setPhase("error");
        return;
      }
      // Backend-confirmed transition — the ONLY place this may be logged.
      devLog(
        `[VERSION-GATE] EFFECTIVE VERSION CHANGED: ${fresh.userCompletedVersion ?? "none"} -> ${fresh.currentVersion}`,
      );
      // 4) One guarded reload so the running page picks up the new assets.
      setTimeout(reloadOnce, 350);
    } catch {
      devLog("[VERSION-GATE] update persistence failed — network error");
      setPhase("error");
    }
  }, [phase, status, fetchStatus, reloadOnce]);

  const postpone = useCallback(() => {
    // Postponing never touches completedVersion/effectiveVersion — backend
    // state is untouched; the offer simply returns on a later visit.
    devLog("[VERSION-GATE] update postponed — versions unchanged, app continues");
    setPostponed(true);
    setPhase("offer");
  }, []);

  const showCard =
    status !== null &&
    status.updateRequired &&
    (phase === "offer" || phase === "updating" || phase === "activating" || phase === "error") &&
    !postponed;

  /**
   * The changelog must describe the release being OFFERED. This page may be an
   * older build (an outdated client keeps running its own release), and its
   * bundled notes describe the release it was built from — so the backend's
   * copy wins whenever it is available and matches the offered version.
   */
  const offeredChanges =
    status?.release && status.release.version === status.currentVersion
      ? status.release.changes
      : RELEASE_INFO.changes;
  const changeGroups = useMemo(() => groupChanges(offeredChanges), [offeredChanges]);

  const progress = phase === "updating" ? 85 : phase === "activating" ? 95 : 0;

  const progressLabel =
    phase === "updating"
      ? "در حال نصب…"
      : phase === "activating"
        ? "در حال فعال‌سازی…"
        : "آماده‌ی نصب";

  const actionLabel =
    phase === "updating"
      ? "در حال نصب…"
      : phase === "activating"
        ? "در حال فعال‌سازی…"
        : phase === "error"
          ? "تلاش دوباره"
          : "به‌روزرسانی";

  const busy = phase === "updating" || phase === "activating";

  return (
    <AnimatePresence>
      {showCard && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="fixed bottom-4 start-4 z-[80] w-[calc(100vw-2rem)] max-w-sm sm:bottom-6 sm:start-6"
        >
          <div
            role="dialog"
            aria-label="به‌روزرسانی نسخه"
            className="relative overflow-hidden rounded-2xl border border-line-strong bg-ink-2/95 shadow-[0_20px_60px_-15px_rgb(0_0_0/0.6)] backdrop-blur-xl"
          >
            {/* corner glows — violet → cyan */}
            <div
              aria-hidden="true"
              className="absolute -left-12 -top-12 h-24 w-24 rounded-full bg-gradient-to-br from-violet/20 to-cyan/0 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-12 -right-12 h-24 w-24 rounded-full bg-gradient-to-br from-cyan/20 to-violet/0 blur-2xl"
            />

            <div className="relative p-4 sm:p-5">
              {/* header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div
                      aria-hidden="true"
                      className="absolute -inset-1 rounded-xl bg-gradient-to-r from-violet to-cyan opacity-30 blur-sm"
                    />
                    <div className="relative flex size-10 items-center justify-center rounded-xl bg-ink-3 ring-1 ring-white/10">
                      <svg
                        aria-hidden="true"
                        className="size-4.5 text-cyan sm:size-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-paper">
                      نسخه‌ی جدید در دسترس است
                    </h3>
                    <p className="mt-0.5 text-[12px] text-muted">
                      می‌توانید همین حالا به‌روزرسانی کنید یا بعداً
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cyan/10 px-2 py-1 text-[11px] font-medium text-cyan">
                  <span className="size-1 rounded-full bg-cyan" />
                  جدید
                </span>
              </div>

              <div className="mt-4 space-y-3.5">
                {/* version transition */}
                <div className="rounded-xl bg-ink-3/60 p-3">
                  {/* current → new version (arrow points toward the new one) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                    <span className="text-faint">نسخه فعلی</span>
                    <span className="font-medium text-muted">
                      {toFaDigits(status?.userCompletedVersion ?? RELEASE_INFO.previousVersion)}
                    </span>
                    <svg
                      aria-hidden="true"
                      className="size-3 text-faint"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M13 8H3m0 0 3.5-3.5M3 8l3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-faint">نسخه جدید</span>
                    <span className="font-medium text-cyan">
                      {toFaDigits(status?.currentVersion ?? APP_VERSION)}
                    </span>
                  </div>

                  {/* categorized change list */}
                  <div className="mt-2.5 space-y-2.5">
                    {changeGroups.map((group) => (
                      <div key={group.category}>
                        <p className="text-[10px] font-medium text-faint">
                          {RELEASE_CATEGORY_LABELS[group.category]}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {group.items.map((change) => (
                            <li
                              key={change.text}
                              className="flex items-start gap-2 text-[12px] leading-relaxed text-muted"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-[7px] size-1 shrink-0 rounded-full bg-gradient-to-r from-violet to-cyan"
                              />
                              {change.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* progress */}
                {phase === "error" ? (
                  <div
                    role="alert"
                    className="flex items-center gap-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-[12px] text-paper"
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4 shrink-0 text-danger"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
                      <path
                        d="M8 5v3.5M8 11h.01"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    خطا در اعمال به‌روزرسانی — دوباره تلاش کنید.
                  </div>
                ) : busy ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-soft">وضعیت به‌روزرسانی</span>
                      <span className="text-faint">{progressLabel}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-3">
                      <div
                        className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-violet to-cyan transition-[width] duration-700"
                        style={{ width: `${progress}%` }}
                      >
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* actions — update or postpone; the app keeps running either way */}
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 rounded-xl bg-gradient-to-r from-violet to-cyan p-px">
                    <button
                      ref={updateButtonRef}
                      type="button"
                      onClick={() => void performUpdate()}
                      disabled={busy}
                      className="group/btn flex w-full items-center justify-center gap-2 rounded-xl bg-ink-2/80 px-4 py-2.5 text-[13px] font-medium text-paper transition-colors duration-300 hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? (
                        <svg
                          aria-hidden="true"
                          className="size-4 animate-spin"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <circle
                            cx="8"
                            cy="8"
                            r="6"
                            stroke="currentColor"
                            strokeOpacity="0.3"
                            strokeWidth="2"
                          />
                          <path
                            d="M14 8a6 6 0 0 0-6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          className="size-4 transition-transform duration-300 group-hover/btn:-translate-x-0.5"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M13 8H3m0 0 3.5-3.5M3 8l3.5 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {actionLabel}
                    </button>
                  </div>
                  {!busy && (
                    <button
                      type="button"
                      onClick={postpone}
                      className="rounded-xl px-4 py-2.5 text-[13px] font-medium text-muted transition-colors duration-300 hover:bg-ink-3/60 hover:text-paper"
                    >
                      بعداً
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
