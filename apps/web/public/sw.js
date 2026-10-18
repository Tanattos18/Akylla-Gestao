/* global self, caches, fetch, URL */
/*
 * Service worker do Akylla Gestão (PWA).
 * Regra: NADA de dados em cache. A API (/api) e as páginas vão sempre à
 * rede; só a página "sem conexão" e os ícones ficam guardados, para mostrar
 * um aviso claro quando a internet cair (em vez da tela de erro do navegador).
 */
const CACHE = "akylla-shell-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});
