"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The oversized OMID signature that closes the page.
 *
 * Typographic treatment: the gradient, edge stroke and shadow layers all
 * live on the same element that holds the text (background-clip: text
 * cannot paint through transformed child spans — each letter used to be
 * individually wrapped and the fill silently vanished). The reveal is
 * therefore a single rise+fade of the whole wordmark the moment it scrolls
 * into view, driven by IntersectionObserver.
 *
 * `dir="ltr"` is required: the page is RTL and a flex row would otherwise
 * lay the letters out right-to-left, reading "DIMO".
 *
 * Decorative only (aria-hidden): the brand is already announced in the
 * footer's text content. `prefers-reduced-motion` shows the full wordmark
 * immediately with no animation.
 */
export function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      dir="ltr"
      className="pointer-events-none select-none overflow-hidden"
    >
      <p
        className={`wordmark-gradient -mb-[0.2em] w-full px-[2vw] text-center text-[clamp(5rem,23vw,22rem)] font-extrabold leading-[0.8] tracking-[-0.045em] transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          revealed
            ? "translate-y-0 opacity-100"
            : "translate-y-[0.35em] opacity-0"
        }`}
      >
        OMID
      </p>
      {/* hairline baseline — the engineered anchor the wordmark sits on */}
      <div
        aria-hidden="true"
        className="mx-auto h-px w-full max-w-[96vw] bg-gradient-to-r from-transparent via-line-strong to-transparent"
      />
    </div>
  );
}
