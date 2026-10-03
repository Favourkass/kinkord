// Kinkord Service Worker
const CACHE_NAME = "kinkord-pwa-v4";
const OFFLINE_URL = "/offline";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/icons/icon-192x192.png",
  "/icons/badge-96x96.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/icon.svg",
  "/brand/logo-badge.png",
  "/brand/logo.png",
  "/favicon.ico",
];

// Install: Cache offline fallback and core static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: Clean up previous cache versions and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: Strategy depending on request type
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests or browser-extension schemes
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // Never cache API calls or auth routes in the service worker
  if (url.pathname.startsWith("/api/") || url.pathname.includes("/auth/")) {
    return;
  }

  // HTML navigation requests: Network-First with fallback to /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return cache.match(OFFLINE_URL);
      }),
    );
    return;
  }

  // Static assets (images, icons, fonts): Stale-While-Revalidate
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
  }
});

// Web Push notifications (VAPID)
// Push: what the API sends is { title, body, url, tag }. The same tag replaces
// the last notification, so a busy chat stays one notification, not twenty.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = new URL(data.url || "/", self.location.origin).href;
  const options = {
    body: data.body || "New activity on Kinkord",
    icon: "/icons/icon-192x192.png",
    // The status-bar icon. Android draws only its transparency, as a white
    // silhouette: the full-colour app icon came out as a blank square (and
    // with no badge Chrome shows its own logo), so this is the K in its ring,
    // white on transparent, like the marks X and Instagram show up there.
    badge: "/icons/badge-96x96.png",
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url, notificationId: data.notificationId },
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      windows.forEach((client) => client.postMessage({ type: "kinkord:notification" }));
      // Already looking at that very screen: nothing to tell them.
      const watching = windows.some(
        (w) => w.visibilityState === "visible" && new URL(w.url).pathname === new URL(url).pathname,
      );
      if (watching) return undefined;
      return self.registration.showNotification(data.title || "Kinkord", options);
    }),
  );
});

// Tap: bring an open Kinkord window to that screen, or open one there.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const id = event.notification.data?.notificationId;
  const url = id
    ? new URL(`/notifications?open=${encodeURIComponent(id)}`, self.location.origin).href
    : event.notification.data?.url || new URL("/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        try {
          // Only a window this worker controls can be moved; others just open fresh.
          if (open.url !== url) await open.navigate(url);
          return await open.focus();
        } catch {
          return self.clients.openWindow(url);
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
