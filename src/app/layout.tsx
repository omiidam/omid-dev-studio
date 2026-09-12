import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import "@/components/layout/starfield.css";
import { site } from "@/data/site";
import { APP_VERSION } from "@/config/version";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "OMID Studio — طراحی و توسعه وب و محصولات دیجیتال",
    template: "%s — OMID Studio",
  },
  description: site.description,
  keywords: [
    "طراحی وب",
    "توسعه وب",
    "وب‌اپلیکیشن",
    "توسعه فول‌استک",
    "طراحی رابط کاربری",
    "محصولات دیجیتال",
    "OMID Studio",
  ],
  authors: [{ name: "OMID Studio" }],
  openGraph: {
    type: "website",
    url: site.url,
    siteName: site.name,
    title: "OMID Studio — طراحی و توسعه وب و محصولات دیجیتال",
    description: site.description,
    locale: "fa_IR",
    images: [
      {
        url: "/images/omid-studio-hero.png",
        width: 1536,
        height: 1024,
        alt: "OMID Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OMID Studio — طراحی و توسعه وب و محصولات دیجیتال",
    description: site.description,
    images: ["/images/omid-studio-hero.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "OMID Studio",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060609",
};

/** Schema.org structured data — factual only, no invented claims. */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}/#organization`,
      name: site.name,
      url: site.url,
      email: site.email,
      description: site.description,
      logo: {
        "@type": "ImageObject",
        url: `${site.url}/icons/icon-512.png`,
      },
      knowsAbout: [
        "Web Design",
        "Web Development",
        "Web Applications",
        "Full-Stack Development",
        "SaaS Interfaces",
        "UI/UX Design",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.name,
      inLanguage: "fa-IR",
      publisher: { "@id": `${site.url}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className="scroll-smooth"
      /* The release this document was rendered from (`scripts/release-server.mjs`
         serves each client its completed release), so the build that produced a
         page is always verifiable — and version mixing is detectable. */
      data-app-version={APP_VERSION}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}