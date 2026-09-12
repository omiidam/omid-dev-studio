"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * The OMID logo that closes the footer.
 *
 * The actual brand asset (`/images/omid-logo.png` — wordmark + four-point
 * symbol + the brand's blue gradient), background-removed so the footer's
 * ink theme shows through. Presented as a refined signature, not a display
 * title: centered inside the footer's own 80rem container, capped height
 * (8.5rem desktop → 3.5rem mobile via `h-*` + `w-auto`), so it can never
 * span the viewport, touch the edges, or be cropped — the intrinsic aspect
 * ratio is preserved by `height: auto` on the image element.
 *
 * A single faint ambient glow (the site's `--color-blue` at 6%) rises
 * behind it, so the logo reads as lit by the page rather than pasted on
 * it. The reveal is a soft rise+fade driven by IntersectionObserver;
 * `prefers-reduced-motion` shows the logo immediately, unmoved.
 *
 * Decorative only (aria-hidden): the brand is already announced in the
 * footer's text content.
 */
export function FooterWordmark() {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) {
      // Deferred (not synchronous) so the effect doesn't trigger a cascading
      // render during the commit phase — lint rule react-hooks/set-state-in-effect.
      const id = window.setTimeout(() => setRevealed(true), 0);
      return () => window.clearTimeout(id);
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
      className="pointer-events-none select-none"
    >
      <div className="relative mx-auto flex w-full max-w-[80rem] justify-center px-[3vw] pb-6 pt-10 md:pb-8">
        {/* Ambient environment glow behind the logo — one faint pool of the
            site's own blue, so the mark feels lit by the page itself. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-[10%] bottom-0 top-[20%] rounded-[100%] bg-[radial-gradient(55%_70%_at_50%_65%,rgb(91_140_255/0.06),transparent_72%)] blur-2xl"
        />

        <Image
          src="/images/omid-logo.png"
          alt=""
          width={923}
          height={328}
          priority={false}
          draggable={false}
          className={`relative h-14 w-auto transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] md:h-24 lg:h-[8.5rem] ${
            revealed
              ? "translate-y-0 opacity-100"
              : "translate-y-[0.35em] opacity-0"
          }`}
        />
      </div>
    </div>
  );
}
