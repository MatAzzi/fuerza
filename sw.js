/* Service worker: guarda la app en caché para que funcione sin conexión. Subí VERSION al cambiar archivos. */
const VERSION = 'fuerza-v1';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-maskable.svg',
  'js/data.js', 'js/store.js', 'js/logic.js', 'js/charts.js', 'js/ui.js', 'js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Caché primero; en segundo plano se actualiza la copia si hay red. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(cached => {
    const net = fetch(e.request).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => cached || caches.match('index.html'));
    return cached || net;
  }));
});
