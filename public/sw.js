// きづき PWA Service Worker（アプリシェルのオフライン表示用）。
// 注意: 記事の定期収集はサーバー側(GitHub Actions)で行う。SWで収集はしない (spec §20)。
const CACHE = 'kizuki-shell-v2';
const SHELL = ['/', '/manifest.webmanifest'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API/データは常に最新を取得（オフライン時のみキャッシュ）
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // それ以外はキャッシュ優先
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
