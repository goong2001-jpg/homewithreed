/* 앱 껍데기만 캐시합니다. 기록은 localStorage 에 있어서 오프라인에서도 적을 수 있습니다.
 * 온라인이면 항상 서버에서 새로 받는다. 브라우저 HTTP 캐시(GitHub Pages 는 10분)까지 건너뛰어야
 * index.html 만 새것이고 app.js·style.css 는 옛것인 '섞인 버전'이 생기지 않는다. */
var CACHE = 'hwr-allowance-v4';
var SHELL = ['./', './index.html', './style.css?v=4', './app.js?v=4', './manifest.json', './icon.svg'];

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
  e.respondWith(
    fetch(e.request.url, { cache: 'no-store' }).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
