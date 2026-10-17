/* =========================================================
   Service Worker · Conversión de unidades con fracciones equivalentes
   ---------------------------------------------------------
   · Pensado para vivir en una SUBCARPETA del portal
     https://tecdea.github.io  →  /fraccionesequivalentes/
   · La página lo registra con ruta relativa («./sw.js»), así
     que su ámbito (scope) queda limitado a esa subcarpeta y
     NO interfiere con el resto del portal.
   · La VERSIÓN de la app vive en la constante VERSION y se
     envía a la página por postMessage (chip de versión).
   ---------------------------------------------------------
   Para publicar una versión nueva basta con subir VERSION
   (y revisar APP_SHELL si cambian archivos). Durante la
   activación se borran automáticamente las cachés antiguas.
   ========================================================= */

const VERSION = '1.0.0';
const CACHE_NAME = 'fracciones-equiv-v' + VERSION;

/* Shell de la aplicación (rutas relativas a la subcarpeta) */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/maskable-192.png',
  './img/maskable-512.png',
  './img/apple-touch-icon.png',
  './img/favicon-32.png'
];

/* ---------- Instalación: precachea el shell ---------- */
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---------- Activación: limpia cachés de versiones anteriores ---------- */
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves
          .filter((clave) => clave !== CACHE_NAME)
          .map((clave) => caches.delete(clave))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---------- Peticiones de red ---------- */
self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  const url = new URL(peticion.url);

  /* Solo recursos de este origen y dentro de la subcarpeta de la app */
  if (url.origin !== self.location.origin) return;
  const ambito = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(ambito)) return;
  if (url.pathname.endsWith('/sw.js')) return;

  /* Navegación: red primero; si falla (offline), servimos el shell cacheado */
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copia));
          }
          return respuesta;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* Resto de recursos: caché primero + actualización en segundo plano */
  evento.respondWith(
    caches.match(peticion).then((cacheado) => {
      const desdeRed = fetch(peticion)
        .then((respuesta) => {
          if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => cacheado);
      return cacheado || desdeRed;
    })
  );
});

/* =========================================================
   Chip de versión: la página pregunta por postMessage
   ({ type: 'GET_VERSION' }) y el service worker responde
   con { type: 'VERSION', version: VERSION }.
   ========================================================= */
self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.type === 'GET_VERSION' && evento.source) {
    evento.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
