import type { NextConfig } from "next";

/**
 * Production-only security switches.
 *
 * OMID_STUDIO_HTTPS_ENABLED=1 — set it in production where TLS terminates
 * (self-hosted: your reverse proxy). Enables Strict-Transport-Security and
 * `upgrade-insecure-requests` in the CSP. Left off locally so the plain-http
 * preview and dev server keep working; `upgrade-insecure-requests` would
 * rewrite same-origin subresource URLs to https on an http-only origin.
 */
const HTTPS_ENABLED = process.env.OMID_STUDIO_HTTPS_ENABLED === "1";
const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy — strict on every source the app does not use.
 *
 * The site loads nothing from third parties (self-hosted fonts, no
 * analytics, no embeds), so every external origin is denied by default.
 * This is the documented "without nonces" configuration: script-src needs
 * 'unsafe-inline' for Next.js's inline RSC payload, and style-src needs it
 * for framer-motion's inline style attributes; a nonce-based policy would
 * force every page to dynamic rendering, regressing the Phase 7 static
 * optimization. 'unsafe-eval' is required by React only in development.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(HTTPS_ENABLED ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  // MIME sniffing must stay off — always honor the declared Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // This app has no use for being framed by other origins.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Referrer sent only within the same origin; trimmed cross-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Keep browser features we don't use disabled by default.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy", value: csp },
  // Isolate this origin from cross-origin window interactions.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(HTTPS_ENABLED
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [75, 88],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;