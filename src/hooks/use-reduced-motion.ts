"use client";

import { useSyncExternalStore } from "react";

/**
 * Hydration-safe access to `prefers-reduced-motion`.
 *
 * Built on `useSyncExternalStore`: React uses `getServerSnapshot` for both
 * the SSR HTML and the initial client render (so markup is identical), then
 * switches to the real media query after hydration. Callers that animate may
 * start out with animation styles and stop them once the user's actual
 * preference is known — never the other way around.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** No `window` on the server — animations are enabled there by default. */
function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
