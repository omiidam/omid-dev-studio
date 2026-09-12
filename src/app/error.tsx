"use client";

import { useEffect } from "react";

/**
 * Root error boundary (segment level, below the root layout — navigation and
 * footer stay alive). Shown when any page/section throws during render or
 * hydration. The reset action re-renders the failed segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure to the server/browser log for diagnosis. Never
    // render `error` details to the visitor — the message is for developers.
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-[70svh] flex-col items-center justify-center px-6 pt-24 text-center">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[22rem] w-[40rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-danger/15 via-blue/10 to-cyan/12 blur-[110px]"
      />
      <p className="relative text-[12px] font-medium tracking-wide text-faint">
        خطای غیرمنتظره
      </p>
      <h1 className="relative mt-6 max-w-xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-paper md:text-6xl">
        چیزی درست پیش نرفت.
      </h1>
      <p className="relative mt-6 max-w-md text-base leading-relaxed text-muted">
        یک خطای غیرمنتظره رخ داد. تلاش دوباره معمولاً مشکل را حل می‌کند — اگر
        باز هم تکرار شد، از صفحه‌ی تماس به ما خبر دهید.
      </p>
      <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="btn btn-primary h-12 px-8 text-[15px]"
        >
          تلاش دوباره
          <span aria-hidden="true">←</span>
        </button>
        <a
          href="/contact"
          className="btn btn-secondary h-12 px-8 text-[15px]"
        >
          صفحه‌ی تماس
        </a>
      </div>
    </div>
  );
}
