/* ============================================================
   OMID Studio — service worker
   ============================================================
   Update strategy: every deployment embeds a new APP_VERSION into
   this file, so the browser detects the byte-different worker and
   activates it (install → skipWaiting → clients.claim()). Users are
   never stuck on a stale build; old caches are purged on activate.

   Fetch strategies (only GET, same-origin, non-API):
   • navigations    → network-first; fall back to the cached copy of
                      the visited page, then to the precached /offline
                      shell, then a controlled error
   • /_next/static  → stale-while-revalidate (content-hashed assets,
                      fonts included)
   • /_next/image   → stale-while-revalidate (optimized images)
   • /images /icons → network-first with cache fill
   • /api/*         → never cached — the server stays authoritative

   /offline is precached at install so an unvisited page still gets a
   branded Persian RTL fallback instead of a browser error page.
   ============================================================ */

const APP_VERSION = "1.0.29";

const CACHE_KEEP = [
  `omid-studio-static-${APP_VERSION}`,
  `omid-studio-runtime-${APP_VERSION}`,
];

/** Precached at install so offline navigation always has a fallback shell. */
const PRECACHE_URLS = ["/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(`omid-studio-static-${APP_VERSION}`);
      await Promise.all(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)),
      );
      // NOTE: deliberately NO skipWaiting() here. The worker installs and
      // prepares the new version's caches, but stays in `waiting` state.
      // Activation is user-gated: the update card sends SKIP_WAITING only
      // after the user clicks «به‌روزرسانی» and the backend confirms
      // persistence. Postponing («بعداً») therefore keeps the CURRENT
      // version's worker — and its content — running. Old caches are only
      // purged on activate, so they also survive a postponed update.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("omid-studio-") && !CACHE_KEEP.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const isNavigation = (request) => request.mode === "navigate";

async function openCache(name) {
  return caches.open(name);
}

/** Look for a response for `url` across every cache (e.g. the precached /offline shell). */
async function matchInAnyCache(url) {
  const names = await caches.keys();
  for (const name of names) {
    const cache = await openCache(name);
    const hit = await cache.match(url, { ignoreSearch: true });
    if (hit) return hit;
  }
  return undefined;
}

/** Network first; on failure serve the cached copy of this URL, then the fallback URL. */
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await openCache(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await matchInAnyCache(fallbackUrl);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

/** Serve the cached copy instantly, refresh it from the network in the background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await openCache(cacheName);
  const cached = await cache.match(request);

  const refresh = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API responses are dynamic — never cache them.
  if (url.pathname.startsWith("/api/")) return;

  if (isNavigation(request)) {
    event.respondWith(
      networkFirst(request, `omid-studio-runtime-${APP_VERSION}`, "/offline"),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      staleWhileRevalidate(request, `omid-studio-static-${APP_VERSION}`),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(
      staleWhileRevalidate(request, `omid-studio-static-${APP_VERSION}`),
    );
    return;
  }

  if (/^\/(images|icons)\//.test(url.pathname)) {
    event.respondWith(
      networkFirst(request, `omid-studio-runtime-${APP_VERSION}`),
    );
    return;
  }
});