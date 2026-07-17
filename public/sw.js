// きづき PWA Service Worker
// 方針: 画面(ナビゲーション)・API・データは常に最新を取得（network-first）。
//       ハッシュ付き静的アセットのみキャッシュ優先。
// 収集はサーバー側(GitHub Actions)で行い、SWでは収集しない (spec §20)。
const CACHE = 'kizuki-shell-v4';

self.addEventListener('install', (e) => {
  // 即時有効化（古いSWを待たない）
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 画面遷移(HTML) / API / データ → 常にネットワーク優先、失敗時のみキャッシュ
  const isNavigation = req.mode === 'navigate';
  const isFresh = url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/');
  if (isNavigation || isFresh) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && isNavigation) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // それ以外（ハッシュ付きJS/CSS/画像など）はキャッシュ優先
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
