/**
 * Application version — the single source of truth.
 *
 * The footer displays it, the service worker embeds it (via
 * scripts/write-sw-version.mjs on prebuild/predev) so each deployment
 * produces a byte-different worker, and the PWA update toast uses it to
 * detect that a new version is live. Bump it on every deploy.
 */
export const APP_VERSION = "1.0.27";