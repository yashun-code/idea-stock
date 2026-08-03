const CACHE_NAME = 'idea-stock-v4';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('idea-stock-') && key !== CACHE_NAME).map((key) => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    url.hostname === 'api.anthropic.com'
    || url.hostname.endsWith('.supabase.co')
    || url.hostname === 'cdn.jsdelivr.net'
    || event.request.method !== 'GET'
  ) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
