// Service worker real, servido como archivo. La v14 lo registraba desde un blob:,
// que el navegador rechaza — por eso nunca funcionó offline.
//
// Estrategia: RED PRIMERO, cache como respaldo. Es una app de precios: vale más
// esperar medio segundo y cotizar con la lista de hoy que responder al instante
// con una copia vieja. Sin señal, el cache contesta y la app abre igual.
const CACHE = "gz-v15-7";
const ARCHIVOS = [
  "./", "./index.html", "./manifest.json", "./logo.jpg",
  "./icono-180.png", "./icono-192.png", "./icono-512.png",
  "./src/estilos.css", "./src/app.js", "./src/motor.js",
  "./src/precios.js", "./src/perfiles.js", "./src/modelos.js",
  "./src/panel.js", "./src/lista-publicada.js", "./src/historial.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // la API del dólar nunca se cachea
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match("./index.html")))
  );
});
