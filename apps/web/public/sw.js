/**
 * Service worker (spec §5.7): after the first visit the app shell, static
 * assets, the sample portrait and — once detection has run — the ML models are
 * all cached, so the whole pipeline works offline. Nothing here ever touches
 * user image data; only GET requests for code, models and bundled assets are
 * cached.
 *
 * Bump VERSION to invalidate every cache on deploy.
 */

const VERSION = "v4";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

/** Long-lived, content-hashed or immutable paths → cache-first. */
const CACHE_FIRST = [
  /^\/_next\/static\//,
  /^\/models\//,
  /^\/icons\//,
  /^\/sample-portrait\.jpg$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (CACHE_FIRST.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/** Fresh page when online; the cached shell (or page) when not. */
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request)) ??
      (await caches.match("/")) ??
      Response.error()
    );
  }
}
