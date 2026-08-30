/* 톡톡 습관친구 서비스워커 — 푸시 알림 전용.
 *
 * 오프라인 캐싱은 일부러 안 한다. 이 앱은 GitHub Pages 에 해시 붙은 번들로 올라가서,
 * 캐싱을 붙이면 "앱이 옛날 버전에서 안 바뀐다" 류의 버그만 늘어난다.
 *
 * ⚠️ CRA 는 public/ 안의 파일에 %PUBLIC_URL% 을 치환해주지 않는다(index.html 만 해준다).
 *    그래서 경로는 전부 self.registration.scope 에서 만들어 쓴다.
 *
 * ⚠️ SW_VERSION 을 바꿔야 브라우저가 새 워커로 갈아탄다. 이 파일은 파일명에 해시가
 *    안 붙어서, 내용이 1바이트도 안 바뀌면 업데이트로 쳐주지 않는다.
 */
const SW_VERSION = '1.0.0';

/** 푸시가 알려준 "이 슬롯은 이 친구가 보냈다"를 앱에 넘겨주는 통로 */
const HINT_CACHE = 'habit-talk-hints';
const HINT_URL = 'hints.json';

self.addEventListener('install', () => {
  // 새 워커를 기다리지 않고 바로 올린다
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** 앱이 열렸을 때 "누가 보냈는지" 맞춰줄 수 있게 기록해둔다 */
async function rememberHint(payload) {
  if (!payload || !payload.date || !payload.slotId || !payload.friendId) return;
  try {
    const cache = await caches.open(HINT_CACHE);
    const url = new URL(HINT_URL, self.registration.scope).toString();
    const prev = await cache.match(url);
    const hints = prev ? await prev.json() : {};
    hints[`${payload.date}|${payload.slotId}`] = payload.friendId;
    // 너무 오래된 건 버린다
    const keys = Object.keys(hints).sort();
    while (keys.length > 40) delete hints[keys.shift()];
    await cache.put(url, new Response(JSON.stringify(hints)));
  } catch {
    // 힌트는 있으면 좋은 정도라, 실패해도 알림은 그대로 띄운다
  }
}

self.addEventListener('push', (event) => {
  // ⚠️ 무슨 일이 있어도 알림을 하나는 띄워야 한다.
  //    iOS 는 알림을 안 띄우는 푸시를 몇 번 받으면 구독 자체를 취소해버린다.
  event.waitUntil(
    (async () => {
      let payload = null;
      try {
        payload = event.data ? event.data.json() : null;
      } catch {
        payload = null;
      }

      const title = (payload && payload.title) || '톡톡 습관친구';
      const body = (payload && payload.body) || '친구가 메시지를 보냈어! 💬';
      const icon = new URL('icon.svg', self.registration.scope).toString();

      await rememberHint(payload);

      await self.registration.showNotification(title, {
        body,
        icon,
        badge: icon,
        tag: payload && payload.slotId ? `slot-${payload.slotId}` : 'habit-talk',
        renotify: true,
        data: {
          url: self.registration.scope,
          slotId: payload && payload.slotId,
          friendId: payload && payload.friendId,
        },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || self.registration.scope;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 이미 열려 있으면 그 창을 앞으로 가져온다
      for (const client of all) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })()
  );
});
