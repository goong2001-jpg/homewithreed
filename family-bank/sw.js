/* 앱 껍데기만 캐시합니다. 통장 기록은 localStorage 에 있어서 오프라인에서도 쓸 수 있습니다.
 * 온라인이면 항상 서버에서 새로 받아서 index.html·app.js·style.css 버전이 섞이지 않게 한다.
 * 덤으로 푸시 알림(아이가 찾기 신청 → 부모 폰)도 여기서 띄운다. habit-talk/public/sw.js 와 같은 흐름. */
var CACHE = 'hwr-bank-v6';
var SHELL = ['./', './index.html', './style.css?v=6', './app.js?v=6', './manifest.json', './icon.svg'];

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

/* ---- 푸시 알림 (habit-push Worker 의 /bank/notify 가 보낸다) ---- */
self.addEventListener('push', function (e) {
  // 무슨 일이 있어도 알림을 하나는 띄운다. iOS 는 알림을 안 띄우는 푸시가 몇 번 오면 구독을 끊어 버린다.
  var payload = null;
  try { payload = e.data ? e.data.json() : null; } catch (err) { payload = null; }
  var title = (payload && payload.title) || '엄마아빠 은행';
  var body = (payload && payload.body) || '아이가 찾기 신청을 했어요. 앱에서 확인해 주세요.';
  var icon = new URL('icon-192.png', self.registration.scope).toString();
  var url = self.registration.scope;
  try {   // 앱 주소는 같은 사이트 안일 때만 믿는다
    if (payload && typeof payload.url === 'string' && new URL(payload.url).origin === self.location.origin) url = payload.url;
  } catch (err) {}
  e.waitUntil(self.registration.showNotification(title, {
    body: body, icon: icon, badge: icon,
    tag: (payload && typeof payload.tag === 'string' && payload.tag) || 'hwr-bank',   // 같은 신청이 합쳐지면 알림도 하나로
    renotify: true,
    data: { url: url }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (all) {
    for (var i = 0; i < all.length; i++) {   // 이미 열려 있으면 그 창을 앞으로
      if (all[i].url.indexOf(self.registration.scope) === 0 && 'focus' in all[i]) return all[i].focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});
