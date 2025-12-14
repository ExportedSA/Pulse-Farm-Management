const CACHE = "pulse-shell-v1";
const ASSETS = ["/","/manifest.json"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c)=> c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((r)=> r || fetch(event.request)));
});
self.addEventListener("sync", async (event) => {
  if (event.tag === "pulse-sync") {
    event.waitUntil(self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: "SYNC_NOW" }));
    }));
  }
});
