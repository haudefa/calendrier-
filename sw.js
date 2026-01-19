const CACHE = "dot-home-v3"; // incrémente v4, v5… quand tu changes des fichiers
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/config.json",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML so updates arrive quickly, fallback to cache (offline)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put("/", fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match("/");
        return cached || caches.match("/index.html");
      }
    })());
    return;
  }

  // Cache-first for assets
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    const cache = await caches.open(CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  })());
});
