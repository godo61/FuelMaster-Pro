const CACHE_NAME = 'fuelmaster-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos addAll de forma segura
      return cache.addAll(ASSETS).catch(err => console.log("Cache error during install:", err));
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Solo cachear peticiones GET
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Fallback si no hay red ni cache
        return caches.match('./index.html');
      });
    })
  );
});