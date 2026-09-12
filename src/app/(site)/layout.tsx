import "@/components/layout/starfield.css";
import { Starfield } from "@/components/layout/Starfield";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { BackToTop } from "@/components/layout/BackToTop";
import { PageAnalytics } from "@/components/analytics/PageAnalytics";

/**
 * Public website shell — company branding and chrome that only belongs on
 * public pages. The route group `(site)` keeps the original URLs unchanged
 * while letting the admin area render without this marketing chrome.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Starfield />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-paper focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-ink"
      >
        پرش به محتوا
      </a>
      <SmoothScroll>
        <Navigation />
        <main id="main" className="relative z-10">{children}</main>
        <Footer />
      </SmoothScroll>
      <BackToTop />
      <ServiceWorkerRegistration />
      <PageAnalytics />
    </>
  );
}