"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * نظرات — infinite reviews marquee.
 *
 * Architecture (per the required pattern):
 *
 *   reviews marquee container   (outer viewport: overflow hidden, full width, edge fade)
 *   └── scrolling track         (inner track: flat flex, width max-content — THE animated element)
 *       ├── original review sequence
 *       └── ≥1 identical duplicate sequence (visual copies only — never new records)
 *
 * Continuous LEFT → RIGHT motion:
 *
 *   The track is translated sideways by exactly ONE measured sequence width
 *   per iteration, using a single linear animation on the whole track:
 *
 *     @keyframes name { from { transform: translateX(0); }
 *                       to   { transform: translateX(SEQ)px; } }
 *
 *   Because the duplicate sequence is structurally identical to the original
 *   and sits at exactly +SEQ along the axis, the frame at `to` is
 *   pixel-identical to the frame at `from`. The repeat/reset is therefore
 *   invisible at every viewport size and review count.
 *
 *   RTL correctness (this site is dir=rtl): the flex track lays the first
 *   sequence at the RIGHT of the viewport and flows copies leftwards. The
 *   loop distance is measured from the DOM itself — the absolute `offsetLeft`
 *   difference between the first card of sequence 1 and the first card of
 *   sequence 2 — so it is exactly one full sequence INCLUDING its inter-card
 *   gaps, independent of layout direction. `translateX(0)` starts with the
 *   sequence already occupying the viewport (no blank lead-in), and
 *   `translateX(+SEQ)` advances the stream rightwards until the duplicate
 *   slides into place. There is NO empty gap, NO long animation-delay and NO
 *   first-card teaser waiting off-screen.
 *
 *   Speed: duration is always computed as sequenceWidth / pixelsPerSecond
 *   (never an arbitrary constant). Default ≈ 110 px/s — a moderate,
 *   readable professional pace. Not 60-ish seconds per lap.
 *
 *   Small review counts: the renderer always emits at least two sequences and
 *   the effect adds more copies if the measured coverage is ever insufficient,
 *   so the viewport is never left empty even with 1–3 reviews. Review records
 *   are never duplicated — only their DOM rendering is repeated.
 *
 *   `prefers-reduced-motion`: the strip keeps its continuous horizontal
 *   motion (explicit site requirement) at the measured duration, restored via
 *   `--marquee-duration` in globals.css.
 */

export interface ReviewItem {
  id: string;
  name: string;
  role: string;
  date: string;
  text: string;
}

interface ReviewsMarqueeProps {
  /** The reviews from the application data source — never mutated here. */
  reviews: ReviewItem[];
  /** Gap between cards in rem (must match the CSS gap on the track). */
  gapRem?: number;
  /** Desired speed in CSS px per second. Duration is computed from it. */
  speedPxPerSec?: number;
}

/* ── Instrumentation. Enabled in dev automatically; also enabled in any
   build when the URL carries `marquee-debug` (used for production
   verification before the temporary logs are removed). ── */
const DEBUG =
  typeof window !== "undefined" &&
  (process.env.NODE_ENV === "development" ||
    new URLSearchParams(window.location.search).has("marquee-debug"));

function dlog(...parts: unknown[]) {
  if (DEBUG) console.log("[REVIEWS-MARQUEE]", ...parts);
}

/** Injects (once per name) the pixel-exact keyframe rule for the track. */
function ensureKeyframes(name: string, shiftPx: number): void {
  if (document.querySelector(`style[data-marquee="${name}"]`)) return;
  const style = document.createElement("style");
  style.dataset.marquee = name;
  // LEFT → RIGHT: start with the sequence in the viewport and glide the track
  // one sequence width to the RIGHT. The repeat frame equals the start frame
  // because the duplicate sequence occupies exactly +shiftPx. RTL-safe.
  style.textContent =
    `@keyframes ${name} { from { transform: translateX(0); } ` +
    `to { transform: translateX(${shiftPx}px); } }`;
  document.head.appendChild(style);
}

export function ReviewsMarquee({
  reviews,
  gapRem = 1.5,
  speedPxPerSec = 110,
}: ReviewsMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(
    () => Math.max(2, Math.ceil(3200 / Math.max(1, reviews.length * 400)) + 1),
  );

  /** Recompute sequence width + duration; returns the pixel shift or null. */
  const applyAnimation = useCallback((): number | null => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container || reviews.length === 0) return null;

    // One full sequence width INCLUDING the inter-sequence gap — measured as
    // the absolute offset difference between the first cards of sequences 1
    // and 2. Correct in BOTH layout directions (this site is RTL).
    const firstCard = track.children[0] as HTMLElement | undefined;
    const secondSeqStart = track.children[reviews.length] as HTMLElement | undefined;
    if (!firstCard || !secondSeqStart) {
      dlog("ERROR: sequence elements not found — cannot measure");
      return null;
    }
    const shiftPx = Math.abs(firstCard.offsetLeft - secondSeqStart.offsetLeft);

    // durationSec = sequenceWidth / pixelsPerSecond — constant speed, never a
    // huge arbitrary duration, never clamped to a slow floor.
    const durationSec = Math.max(1, Math.round(shiftPx / speedPxPerSec));
    const name = `reviews-marquee-${Math.round(shiftPx)}-${durationSec}`;
    ensureKeyframes(name, shiftPx);

    track.style.animationName = name;
    track.style.animationDuration = `${durationSec}s`;
    // Carried for the reduced-motion restore block in globals.css.
    track.style.setProperty("--marquee-duration", `${durationSec}s`);
    track.style.animationTimingFunction = "linear";
    track.style.animationIterationCount = "infinite";
    track.style.animationFillMode = "none";
    track.style.animationDelay = "0s";
    track.style.setProperty("transform", "translateX(0)");

    dlog("initialized");
    dlog(`reviewCount=${reviews.length}`);
    dlog(`sequenceCount=${Math.floor(track.children.length / reviews.length)}`);
    dlog(`viewportWidth=${container.clientWidth}`);
    dlog(`sequenceWidth=${shiftPx}`);
    dlog(`trackWidth=${track.scrollWidth}`);
    dlog(`translationDistance=${shiftPx}`);
    dlog(`pixelsPerSecond=${speedPxPerSec}`);
    dlog(`animationDuration=${durationSec}`);
    dlog(`direction=LEFT_TO_RIGHT`);
    dlog(`animationName=${name}`);
    dlog(
      `keyframes=translateX(0) → translateX(${shiftPx}px) (linear, infinite, repeat at ${shiftPx}px)`,
    );
    return shiftPx;
  }, [reviews.length, speedPxPerSec]);

  /** Computed-style confirmation of the live animation; logs the audit fields. */
  const verify = useCallback((): void => {
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;
    const computed = getComputedStyle(track);
    dlog("verify —", String(computed.animationName).startsWith("none")
      ? "animationName=none (FAIL)"
      : `animationName=${computed.animationName}`);
    dlog(`animationPlayState=${computed.animationPlayState}`);
    dlog(`computedTransform=${computed.transform}`);
    dlog(`overflow=${getComputedStyle(container).overflowX}`);
  }, []);

  useEffect(() => {
    if (reviews.length === 0) return;
    const track = trackRef.current;
    const container = containerRef.current;
    if (!track || !container) return;

    let shift = applyAnimation();
    if (shift === null) {
      dlog("initialization failed — one re-check after fonts/layout");
      document.fonts?.ready.then(() => {
        if (trackRef.current) shift = applyAnimation();
      });
      return;
    }

    // Ensure the track is wide enough that the viewport never empties, no
    // matter the viewport or review count (small counts included). Deferred to
    // a frame callback so the width measurement reads settled layout.
    const ensureCoverage = () => {
      const tr = trackRef.current;
      const ct = containerRef.current;
      if (!tr || !ct) return;
      if (tr.scrollWidth < ct.clientWidth * 1.5) {
        const needed = Math.max(2, Math.ceil((ct.clientWidth * 1.5) / shift!) + 1);
        if (needed !== copies) setCopies(needed);
      }
    };
    const coverageFrame = requestAnimationFrame(ensureCoverage);

    verify();

    /* ── First-entry measurement (≤ 1 s required; measured live). ── */
    if (DEBUG) {
      dlog("first-entry timer started");
      const startedAt = performance.now();
      let entered = false;
      let enteredTime = 0;
      const iv = window.setInterval(() => {
        if (entered) return;
        const cards = trackRef.current?.children;
        if (!cards || cards.length === 0) return;
        const cr = containerRef.current?.getBoundingClientRect();
        if (!cr) return;
        for (let i = 0; i < cards.length; i++) {
          const r = (cards[i] as HTMLElement).getBoundingClientRect();
          if (r.right >= cr.left && r.left <= cr.right) {
            entered = true;
            enteredTime = (performance.now() - startedAt) / 1000;
            break;
          }
        }
        if (entered) {
          dlog(`first review entered viewport — ${enteredTime.toFixed(2)}s`);
          dlog(`first-entry time=${enteredTime}`);
          if (enteredTime > 1) {
            dlog("ERROR: first review entered after 1 second");
          }
          window.clearInterval(iv);
        }
      }, 50);
      window.setTimeout(() => {
        if (!entered) {
          dlog("ERROR: first review exceeded 1 second entry requirement (timeout)");
          window.clearInterval(iv);
        }
      }, 3000);
    }

    const onResize = () => {
      dlog("resize detected — re-checking coverage");
      const tr = trackRef.current;
      const ct = containerRef.current;
      if (!tr || !ct) return;
      if (tr.scrollWidth < ct.clientWidth * 1.5) {
        const needed = Math.max(2, Math.ceil((ct.clientWidth * 1.5) / (shift ?? 1)) + 1);
        if (needed !== copies) setCopies(needed);
      }
      verify();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(coverageFrame);
      window.removeEventListener("resize", onResize);
    };
  }, [reviews.length, copies, applyAnimation, verify]);

  /* ── Empty state — existing behavior, no fake review is invented ── */
  if (reviews.length === 0) {
    dlog("reviewCount=0 — empty state, marquee not rendered");
    return (
      <p className="mt-14 text-center text-sm text-muted">
        نظری ثبت نشده است — اولین نفر باشید.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="marquee-edge-fade relative mt-14 overflow-x-hidden"
      role="region"
      aria-label="نظرات بازدیدکنندگان"
    >
      {/* INNER TRACK — the only animated element. `w-max` keeps the strip on
          one horizontal line; cards are fixed-width `shrink-0` so the
          measured sequence width is stable. Cards never receive the
          transform. Duplicates carry `dup-` keys and aria-hidden. */}
      <div
        ref={trackRef}
        className="flex w-max items-stretch will-change-transform"
        style={{ gap: `${gapRem}rem` }}
      >
        {Array.from({ length: copies }, (_, copyIndex) =>
          reviews.map((review) => (
            <CommentCard
              key={copyIndex === 0 ? review.id : `dup${copyIndex}-${review.id}`}
              review={review}
              ariaHidden={copyIndex > 0}
            />
          )),
        )}
      </div>
    </div>
  );
}

function CommentCard({
  review,
  ariaHidden = false,
}: {
  review: ReviewItem;
  ariaHidden?: boolean;
}) {
  return (
    <figure
      aria-hidden={ariaHidden || undefined}
      className="w-[21rem] shrink-0 rounded-2xl border border-line bg-ink-2/80 p-6 backdrop-blur-sm transition-colors duration-500 hover:border-line-strong sm:w-[24rem] md:p-7"
    >
      <div className="flex items-center gap-3.5">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-faint">
          <UserIcon />
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 end-0 size-2.5 rounded-full border-2 border-ink bg-success"
          />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-bold text-paper">
            {review.name}
          </span>
          <p className="text-[11px] font-medium text-faint">
            {review.role} · {review.date}
          </p>
        </div>
      </div>

      <blockquote className="mt-5 text-[13.5px] font-medium leading-relaxed text-soft">
        {review.text}
      </blockquote>
    </figure>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
      <path
        d="M6.57757 15.4816C5.1628 16.324 1.45336 18.0441 3.71266 20.1966C4.81631 21.248 6.04549 22 7.59087 22H16.4091C17.9545 22 19.1837 21.248 20.2873 20.1966C22.5466 18.0441 18.8372 16.324 17.4224 15.4816C14.1048 13.5061 9.89519 13.5061 6.57757 15.4816Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 6.5C16.5 8.98528 14.4853 11 12 11C9.51472 11 7.5 8.98528 7.5 6.5C7.5 4.01472 9.51472 2 12 2C14.4853 2 16.5 4.01472 16.5 6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}