/*
 * 우리집 하루수입 가계부 — 서비스워커 (v17)
 *
 * 목적: 신호가 없는 곳에서도 앱이 열리게 한다. (기록 저장은 원래 오프라인에서도 됐다)
 *
 * ⚠️ "새로고침해도 옛 버전이 뜬다"를 막는 규칙 — 바꾸지 말 것
 *   · 화면(index.html)은 **항상 네트워크 먼저**. 4초 안에 못 받으면 그때만 저장해 둔 화면을 쓴다.
 *     → 온라인이면 새로고침 한 번에 새 버전이 뜬다 (예전과 같다).
 *   · static/ 아래 파일은 이름에 해시가 붙어 내용이 절대 안 바뀌므로 저장본을 먼저 쓴다.
 *   · version.json 은 저장하지 않는다 (지금 배포된 버전을 알려주는 파일이라서).
 *   · 다른 주소(Firebase 등)는 건드리지 않는다.
 *
 * 범위는 이 파일이 놓인 폴더(/homewithreed/couple-budget/)뿐이라 저장소의 다른 앱에는 영향이 없다.
 * 사용자 기록(localStorage)은 서비스워커가 읽지도 쓰지도 않는다.
 */
const CACHE = 'couple-budget-shell-v1';
const MAX_ENTRIES = 60;
const SCOPE = self.registration.scope;          // …/homewithreed/couple-budget/
const INDEX = SCOPE;                            // 화면은 이 주소 하나로 저장한다

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      const res = await fetch(INDEX, { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put(INDEX, res);
      // 화면이 바로 불러오는 스크립트·스타일도 같이 받아둔다 → 첫 방문 뒤 바로 오프라인으로 열린다
      const urls = Array.from(html.matchAll(/(?:src|href)="([^"]*\/static\/[^"]+)"/g), m => m[1]);
      await Promise.all(urls.map(u => cache.add(new URL(u, SCOPE).href).catch(() => {})));
    } catch (e) { /* 설치 중 네트워크가 끊겨도 다음에 다시 시도된다 */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => n.startsWith('couple-budget-shell-') && n !== CACHE)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/** 오래된 파일부터 지운다 (버전이 올라갈 때마다 옛 번들이 쌓이지 않게) */
async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.filter(k => k.url !== INDEX).slice(0, Math.max(0, keys.length - MAX_ENTRIES));
  await Promise.all(extra.map(k => cache.delete(k)));
}

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    if (res && res.ok) cache.put(INDEX, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const saved = await cache.match(INDEX);
    if (saved) return saved;
    return fetch(request);     // 저장본도 없으면 브라우저 기본 동작(오류 화면)에 맡긴다
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok) { cache.put(request, res.clone()).then(() => trim(cache)).catch(() => {}); }
  return res;
}

async function networkThenCache(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const saved = await cache.match(request);
    if (saved) return saved;
    throw e;
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.href.startsWith(SCOPE)) return;                  // 다른 앱·다른 서버는 그대로
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return;

  if (req.mode === 'navigate') { event.respondWith(networkFirstPage(req)); return; }
  if (url.pathname.includes('/static/')) { event.respondWith(cacheFirst(req)); return; }
  event.respondWith(networkThenCache(req));                 // 아이콘·manifest
});
