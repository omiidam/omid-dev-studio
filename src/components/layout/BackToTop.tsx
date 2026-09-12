"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { EASE } from "@/lib/animations";

/** Show the button only after the visitor has scrolled this far. */
const SHOW_THRESHOLD = 400;

/**
 * Floating back-to-top button — OMID Studio's own take on the classic
 * micro-interaction (inspired by back2topfun's quality bar, not copied):
 * restrained glass geometry, brand accents, smooth entrance, subtle hover
 * lift, and no progress gimmicks. Scroll visibility uses one passive,
 * rAF-throttled listener that only updates React state when the threshold
 * actually crosses — no per-pixel renders. Renders nothing on the server,
 * so hydration never sees `window`.
 */
export function BackToTop() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    let shown = false;

    const check = () => {
      ticking = false;
      const next = window.scrollY > SHOW_THRESHOLD;
      if (next !== shown) {
        shown = next;
        setVisible(next);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(check);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    check(); // capture the initial position (e.g. restored scroll)
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="بازگشت به بالا"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="group fixed bottom-5 right-4 z-40 flex size-11 items-center justify-center rounded-full border border-line-strong bg-ink-2/85 text-paper shadow-[0_12px_32px_-12px_rgb(0_0_0/0.7)] backdrop-blur-md transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-cyan/40 hover:shadow-[0_16px_40px_-12px_rgb(85_193_255/0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan sm:bottom-6 sm:right-6 sm:size-12"
        >
          {/* accent tick — a restrained brand cue */}
          <span
            aria-hidden="true"
            className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
          <svg
            aria-hidden="true"
            className="size-4 text-soft transition-colors duration-300 group-hover:text-paper sm:size-[18px]"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M8 13V3m0 0L4.5 6.5M8 3l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
}