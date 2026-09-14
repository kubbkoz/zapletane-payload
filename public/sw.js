// Minimal service worker — exists ONLY to satisfy PWA installability criteria
// (Chrome requires an active SW with a fetch handler before it offers "Add to Home Screen").
// Deliberately does NOT cache anything — this app has already been bitten once this session
// by a stale-cache bug (a single transient 500 got cached and replayed for an hour). A caching
// SW here would reintroduce that exact class of risk. Every request just passes straight
// through to the network.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Range requests (video seeking/streaming) must stay on the browser's native path —
  // re-issuing them via fetch() strips Range semantics and breaks playback on Chrome.
  if (event.request.headers.has('range')) return;
  event.respondWith(fetch(event.request));
});
