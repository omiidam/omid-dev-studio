"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "span" | "li" | "p";
}

/* ────────────────────────────────────────────────────────────────
   Shared, rAF-throttled scroll/resize ticker plus a periodic safety
   check. Reveal intentionally does NOT rely on Framer Motion's
   `whileInView` (IntersectionObserver) — in some environments IO
   callbacks never fire, leaving every Reveal stuck at `opacity: 0` and
   the page looking empty even though the DOM contains all the data.

   Visibility is computed from getBoundingClientRect on a single shared
   listener, and applied through plain inline styles with a CSS
   transition — deterministic, hydration-safe, and independent of any
   animation library's lifecycle.
   ──────────────────────────────────────────────────────────────── */
const listeners = new Set<() => void>();
let ticking = false;
let attached = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function dispatch() {
  ticking = false;
  for (const fn of listeners) fn();
}

function requestTick() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(dispatch);
}

function startInterval() {
  if (intervalId !== null) return;
  // Safety net: some webviews never deliver scroll events (or IO), so a
  // slow periodic check guarantees content is revealed once in view.
  intervalId = setInterval(dispatch, 300);
}

function stopInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!attached && typeof window !== "undefined") {
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick);
    attached = true;
  }
  startInterval();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stopInterval();
  };
}

const VIEWPORT_OFFSET = 80;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const TAGS = {
  div: "div",
  span: "span",
  li: "li",
  p: "p",
} as const;

/**
 * Scroll-triggered fade-up reveal. Hydration-safe: the server and the
 * initial client render share the same hidden inline style, and visibility
 * only changes inside an effect after mount. Honors prefers-reduced-motion.
 */
export function Reveal({ children, className, delay = 0, y = 28, as = "div" }: RevealProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  const Tag = TAGS[as] as "div";

  useEffect(() => {
    // Reduced motion: content is rendered fully visible (no hidden state),
    // so there is nothing to reveal and no machinery to attach.
    if (reduce) return;

    const el = ref.current;
    if (!el) return;

    let done = false;
    const check = () => {
      if (done) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= vh - VIEWPORT_OFFSET && rect.bottom >= 0) {
        done = true;
        setShown(true);
        unsubscribe();
      }
    };

    const unsubscribe = subscribe(check);
    check(); // reveal immediately if already in view on mount
    return unsubscribe;
  }, [reduce]);

  const style: CSSProperties = reduce
    ? {}
    : {
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : `translateY(${y}px)`,
        transition: `opacity 0.9s ${EASE} ${delay}s, transform 0.9s ${EASE} ${delay}s`,
        willChange: "opacity, transform",
      };

  return (
    <Tag ref={ref} className={cn(className)} style={style}>
      {children}
    </Tag>
  );
}