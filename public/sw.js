/*
 * Service worker de la PWA — Fase 0.
 * Estrategia conservadora para una app con datos privados:
 *   - Solo se guardan en caché recursos estáticos públicos (JS/CSS/iconos).
 *   - Las páginas y la API van siempre a la red (no se cachean datos personales).
 *   - Si no hay red al navegar, se muestra /offline.
 * Fase 4: al tocar un aviso de recordatorio se abre (o enfoca) la app en su pantalla.
 * Fase 4: avisos con la app cerrada (Web Push enviado por /api/cron/avisos).
 */
const VERSION = "v6";
const STATIC_CACHE = `ae-static-${VERSION}`;
const PRECACHE = ["/offline", "/icons/caja-192.png", "/icons/caja-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || "/";
  // Solo rutas internas.
  const url = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Asistente", body: event.data ? event.data.text() : "" };
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(String(data.title || "Asistente").slice(0, 200), {
      body: String(data.body || "").slice(0, 500),
      tag: String(data.tag || "aviso").slice(0, 200),
      icon: "/icons/caja-192.png",
      badge: "/icons/caja-192.png",
      data: { url },
      requireInteraction: Boolean(data.critical),
      vibrate: data.critical ? [300, 150, 300, 150, 300] : [200],
    }),
  );
});
