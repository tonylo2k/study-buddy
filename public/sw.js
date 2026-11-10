// Study Buddy offline cache. Network first; fall back to what was saved earlier.
// API calls (/api/*) are never cached: extract and generate always need the network.
const CACHE = "study-buddy-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function warm(routes) {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const route of routes) {
    try {
      const res = await fetch(route, { credentials: "same-origin" });
      if (!res.ok) continue;
      await cache.put(route, res.clone());
      const html = await res.text();
      for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assets.add(m[0]);
    } catch (_) {}
  }
  await Promise.all(
    [...assets, "/manifest.webmanifest", "/icon.svg"].map(async (url) => {
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        }
      } catch (_) {}
    }),
  );
}

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "warm") e.waitUntil(warm(e.data.routes || []));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && !url.searchParams.has("_rsc")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? url.pathname : req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE);
        if (req.mode === "navigate") return (await cache.match(url.pathname)) || (await cache.match("/")) || Response.error();
        return (await cache.match(req)) || Response.error();
      }),
  );
});
