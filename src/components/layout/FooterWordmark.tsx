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
 * Background integration — the mark is treated as part of the page's
 * atmosphere rather than a graphic placed on it:
 *   1. two faint pools of the site's own accent system (violet and cyan —
 *      the same language as `--gradient-primary`) rise behind it like
 *      ambient scene lighting;
 *   2. a blurred, low-opacity duplicate of the logo sits behind the crisp
 *      one — a bloom that reads as light diffusing off the mark itself;
 *   3. a radial mask dissolves the mark's outer edges into the background,
 *      so no hard silhouette separates it from the page;
 *   4. the mark itself renders slightly below full opacity, letting the
 *      dark theme participate in its color.
 *
 * The reveal is a soft rise+fade driven by IntersectionObserver;
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

  const revealClasses = `transition-[opacity,transform] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
    revealed ? "translate-y-0 opacity-100" : "translate-y-[0.35em] opacity-0"
  }`;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none select-none"
    >
      <div className="relative mx-auto flex w-full max-w-[80rem] justify-center px-[3vw] pb-6 pt-10 md:pb-8">
        {/* Ambient scene lighting behind the mark — two soft pools of the
            site's own accent system (violet on the start side, cyan on the
            end side), matching the page's existing glow language. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-[8%] bottom-0 top-[15%] rounded-[100%] blur-2xl"
          style={{
            background: [
              "radial-gradient(38% 62% at 30% 62%, rgb(139 123 255 / 0.07), transparent 70%)",
              "radial-gradient(38% 62% at 70% 62%, rgb(76 194 255 / 0.06), transparent 70%)",
            ].join(", "),
          }}
        />

        <div className={`relative ${revealClasses}`}>
          {/* Bloom — a blurred copy of the mark itself at low opacity, so
              light appears to diffuse off the logo into the surrounding
              atmosphere (background-aware lighting, no external glow). */}
          <Image
            src="/images/omid-logo.png"
            alt=""
            width={923}
            height={328}
            draggable={false}
            aria-hidden="true"
            className="absolute inset-0 h-full w-auto scale-[1.015] opacity-25 blur-lg"
          />

          {/* Crisp mark — radial mask dissolves its outer edges into the
              background; 0.92 opacity lets the dark theme participate in
              its color, so it reads as embedded, not pasted. */}
          <Image
            src="/images/omid-logo.png"
            alt=""
            width={923}
            height={328}
            draggable={false}
            className="relative h-14 w-auto opacity-92 md:h-24 lg:h-[8.5rem]"
            style={{
              maskImage:
                "radial-gradient(88% 88% at 50% 50%, black 62%, transparent 98%)",
              WebkitMaskImage:
                "radial-gradient(88% 88% at 50% 50%, black 62%, transparent 98%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
