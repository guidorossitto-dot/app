const CACHE_NAME = "agendapp-shell-v27";
const RUNTIME_CACHE = "agendapp-runtime-v27";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",

  // core
  "./state-config.js",
  "./store.js",
  "./actions.js",
  "./app-init.js",

  // servicios
  "./event-service.js",
  "./storage.js",
  "./event-selectors.js",
  "./venue-service.js",
  "./supabase-client.js",
  "./auth-service.js",
  "./candidate-dedupe.js",
  "./candidate-service.js",
  "./admin-event-form.js",

  // UI
  "./ui-render.js",
  "./ui-calendar.js",
  "./ui-calendar-render.js",
  "./ui-calendar-bindings.js",
  "./ui-calendar-popover.js",

  // mapa
  "./map-places.js",
  "./map-popups.js",

  // libs
  "./libs/leaflet/leaflet.css",
  "./libs/leaflet/leaflet.js",
  "./libs/leaflet/images/marker-icon.png",
  "./libs/leaflet/images/marker-icon-2x.png",
  "./libs/leaflet/images/marker-shadow.png",

  "./libs/leaflet-markercluster/MarkerCluster.css",
  "./libs/leaflet-markercluster/MarkerCluster.Default.css",
  "./libs/leaflet-markercluster/leaflet.markercluster.js",

  // icons
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of APP_SHELL) {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (response.ok) {
            await cache.put(url, response.clone());
          } else {
            console.warn("[SW] No se pudo cachear:", url, response.status);
          }
        } catch (err) {
          console.warn("[SW] No se pudo cachear:", url, err);
        }
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // Ignorar esquemas no soportados por Cache API, ej. chrome-extension://
  if (!["http:", "https:"].includes(url.protocol)) {
    return;
  }

  // Navegación HTML: network first, fallback a cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Mismo origen: cache first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(async (cached) => {
        if (cached) return cached;

        try {
          const response = await fetch(req);
          return response;
        } catch {
          const fallback = await caches.match(url.pathname);
          if (fallback) return fallback;

          return new Response("Offline", {
            status: 503,
            statusText: "Offline"
          });
        }
      })
    );
    return;
  }

  // Tiles de OpenStreetMap: network first + guardar en runtime cache
  if (
    url.hostname === "a.tile.openstreetmap.org" ||
    url.hostname === "b.tile.openstreetmap.org" ||
    url.hostname === "c.tile.openstreetmap.org"
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        try {
          const response = await fetch(req);
          if (
            response &&
            response.ok &&
            ["http:", "https:"].includes(url.protocol)
          ) {
            await cache.put(req, response.clone());
          }
          return response;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;

          return new Response("", {
            status: 503,
            statusText: "Offline"
          });
        }
      })
    );
    return;
  }

  // Otros externos: network first, fallback cache
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      try {
        const response = await fetch(req);
        if (
          response &&
          response.ok &&
          ["http:", "https:"].includes(url.protocol)
        ) {
          await cache.put(req, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;

        return new Response("", {
          status: 503,
          statusText: "Offline"
        });
      }
    })
  );
});