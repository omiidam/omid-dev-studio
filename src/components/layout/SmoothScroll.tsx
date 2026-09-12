"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";

/**
 * Lenis smooth scrolling — skipped entirely under prefers-reduced-motion.
 * `anchors: true` makes in-page anchor links glide to their targets.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      anchors: true,
      autoRaf: true,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}