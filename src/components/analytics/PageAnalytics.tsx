"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  trackEvent,
  type AnalyticsEventName,
  type AnalyticsEventProps,
} from "@/lib/analytics";

const DATA_TRACK_PROP = "data-track-prop-";

/**
 * Mounted once in the root layout. Fires exactly one page_view per route and
 * listens for clicks on any element carrying `data-track`, the single place
 * the site declares "this interaction is worth counting".
 *
 * Page views are deduped by pathname, so React Strict Mode (dev), hydration
 * and soft client navigations can never double-fire for the same route.
 * Click delegation works on server-rendered markup too — no component needs
 * to become a client component just to report an event.
 */
export function PageAnalytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackEvent("page_view", { page: pathname });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const tracked = target?.closest?.("[data-track]") as HTMLElement | null;
      if (!tracked) return;
      const name = tracked.getAttribute("data-track");
      if (!name) return;
      const props: AnalyticsEventProps = {};
      for (const attr of tracked.attributes) {
        if (attr.name.startsWith(DATA_TRACK_PROP)) {
          const key = attr.name.slice(DATA_TRACK_PROP.length);
          if (key) props[key] = attr.value;
        }
      }
      trackEvent(name as AnalyticsEventName, props);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}