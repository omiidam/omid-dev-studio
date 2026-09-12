"use client";

import { useEffect, useState } from "react";
import { APP_VERSION } from "@/config/version";

/**
 * useDisplayedVersion — the version label the user sees.
 *
 * The displayed version MUST be the user's EFFECTIVE version (the last
 * version they actually completed, as recorded by the backend) — never the
 * deployed build constant. A newly deployed release is only an *available*
 * release; until the user completes the update, every version-facing UI
 * must keep showing their completed version.
 *
 * Resolution order:
 *   1. GET /api/update/status (no-store) → effectiveVersion (authoritative).
 *   2. Fallback to the build constant APP_VERSION when the backend is
 *      unreachable. This is safe in practice: without a status answer the
 *      update flow cannot run, and the two values are identical for any
 *      up-to-date user, which is the only state reachable offline.
 */
export function useDisplayedVersion(): string {
  const [displayed, setDisplayed] = useState(APP_VERSION);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/update/status", { cache: "no-store" });
        if (!response.ok) return;
        const body: unknown = await response.json();
        const data = (
          body as {
            success?: boolean;
            data?: { effectiveVersion?: string | null; updateRequired?: boolean };
          }
        ).data;
        if (!active || !data) return;
        if (data.updateRequired && data.effectiveVersion) {
          setDisplayed(data.effectiveVersion);
        }
        // updateRequired === false → effectiveVersion === APP_VERSION; the
        // build constant already on screen is correct.
      } catch {
        /* keep build constant — never block rendering over the label */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return displayed;
}
