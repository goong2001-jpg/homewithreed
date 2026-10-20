/* 앱 껍데기만 캐시합니다. 통장 기록은 localStorage 에 있어서 오프라인에서도 쓸 수 있습니다.
 * 온라인이면 항상 서버에서 새로 받아서 index.html·app.js·style.css 버전이 섞이지 않게 한다. */
var CACHE = 'hwr-bank-v3';
var SHELL = ['./', './index.html', './style.css?v=3', './app.js?v=3', './manifest.json', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-store' }).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
