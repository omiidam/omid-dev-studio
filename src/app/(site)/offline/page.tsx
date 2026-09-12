import type { Metadata } from "next";

/**
 * Offline fallback — served by the service worker when a navigation cannot
 * reach the network (and the page itself was never visited/cached). The page
 * intentionally has NO unique client component: its behaviour is a tiny
 * inline script shipped inside the cached HTML, so it works even when every
 * JS chunk is unreachable. Excluded from search indexing.
 */
export const metadata: Metadata = {
  title: "آفلاین — OMID Studio",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="relative flex min-h-[70svh] flex-col items-center justify-center px-6 pt-24 text-center">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[22rem] w-[40rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet/12 via-blue/10 to-cyan/12 blur-[110px]"
      />
      <p className="relative text-[12px] font-medium tracking-wide text-faint">
        بدون اتصال
      </p>
      <h1 className="relative mt-6 max-w-xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-paper md:text-6xl">
        الان آفلاین هستید.
      </h1>
      <p className="relative mt-6 max-w-md text-base leading-relaxed text-muted">
        این صفحه از حافظه‌ی مرورگرتان بارگذاری شد و به اینترنت دسترسی نداریم.
        پس از برقراری اتصال، به‌صورت خودکار یا با دکمه‌ی زیر دوباره تلاش
        می‌کنیم تا آخرین نسخه‌ی سایت را ببینید.
      </p>
      <div className="relative mt-10">
        <button
          type="button"
          id="offline-retry"
          className="btn btn-primary h-12 px-8 text-[15px]"
        >
          تلاش دوباره
          <span aria-hidden="true">←</span>
        </button>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function () {
  var retry = function () { window.location.reload(); };
  var btn = document.getElementById("offline-retry");
  if (btn) btn.addEventListener("click", retry);
  // When connectivity returns, reload automatically so the user lands on
  // the latest version without having to notice the offline state.
  window.addEventListener("online", retry);
})();`,
        }}
      />
    </div>
  );
}