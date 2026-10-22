/* eslint-disable no-restricted-globals */
/*
 * 내 자산관리 — 오프라인용 서비스워커.
 *
 * 기록은 localStorage 에 있어서 서버가 필요 없다. 이 파일은 앱 껍데기(index.html 과
 * 빌드된 JS/CSS)만 캐시해서 지하철에서도 앱이 뜨게 한다.
 *
 *  - 설치: index.html 과 asset-manifest.json(CRA 빌드가 만든다)을 받아
 *          거기 적힌 해시 붙은 JS/CSS 를 전부 미리 캐시한다
 *  - /static/ 아래(파일명에 해시가 있어 내용이 안 바뀐다): 캐시 먼저
 *  - 페이지 이동(navigate): 네트워크 먼저, 끊겨 있으면 캐시한 index.html
 *  - 활성화: 이 앱의 옛 캐시를 지운다. 같은 도메인의 다른 앱 캐시는 건드리지 않는다
 *
 * 캐시 이름에 버전이 들어간다. 캐시 동작을 바꾸면 VERSION 을 올린다.
 * (빌드 결과물은 이름에 해시가 있어 버전을 안 올려도 새것이 잡힌다.)
 */
var VERSION = 'v1';
var PREFIX = 'asset-tracker-';
var CACHE = PREFIX + VERSION;

/* sw.js 가 /homewithreed/asset-tracker/sw.js 에 있으므로 BASE 는 /homewithreed/asset-tracker/ */
var BASE = new URL('./', self.location.href).pathname;
var INDEX = BASE + 'index.html';
var ASSET_MANIFEST = BASE + 'asset-manifest.json';

self.addEventListener('install', function (e) {
  e.waitUntil(precache().then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf(BASE) !== 0) return;   // 같은 도메인의 다른 앱은 건드리지 않는다

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, INDEX));
    return;
  }
  if (url.pathname.indexOf(BASE + 'static/') === 0) {
    e.respondWith(cacheFirst(req));
    return;
  }
  e.respondWith(networkFirst(req, null));
});

/** 앱 껍데기를 미리 받아둔다. 파일 하나가 실패해도 나머지는 캐시한다 */
function precache() {
  return caches.open(CACHE).then(function (cache) {
    return fetch(ASSET_MANIFEST, { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : { files: {} }; })
      .catch(function () { return { files: {} }; })
      .then(function (manifest) {
        var files = Object.keys(manifest.files || {})
          .map(function (k) { return manifest.files[k]; })
          .filter(function (u) { return typeof u === 'string' && !/\.map$/.test(u); });
        var urls = [INDEX, ASSET_MANIFEST, BASE + 'manifest.json'].concat(files);
        return Promise.all(urls.map(function (u) {
          return fetch(u, { cache: 'no-store' })
            .then(function (res) { if (res.ok) return cache.put(u, res); })
            .catch(function () {});
        }));
      });
  });
}

function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  });
}

function networkFirst(req, fallbackUrl) {
  return fetch(req).then(function (res) {
    if (res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      if (fallbackUrl) return caches.match(fallbackUrl);
      return undefined;
    }).then(function (hit) {
      return hit || new Response('오프라인이에요. 인터넷이 연결되면 다시 열어주세요.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    });
  });
}
