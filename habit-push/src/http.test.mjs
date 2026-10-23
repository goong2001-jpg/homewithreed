/**
 * /subscribe·/unsubscribe 문지기(출처·크기·횟수 제한)와 설정 검사 테스트.
 *   npm test
 *
 * Worker 를 띄우지 않고 fetch 핸들러를 가짜 KV 로 직접 부른다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { validConfig } from './index.ts';

/** 메모리 KV. TTL 은 무시한다 — 여기서 보는 건 읽고 쓰는 순서뿐이다 */
function fakeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    puts: 0,
    async get(key, type) {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key, value) {
      this.puts += 1;
      store.set(key, value);
    },
  };
}

const env = (over = {}) => ({
  HABIT_KV: fakeKV(),
  ALLOWED_ORIGIN: 'https://app.example',
  VAPID_SUBJECT: 'mailto:x@example.com',
  PASSPHRASE: 'secret',
  ...over,
});

const config = (over = {}) => ({
  deviceId: 'dev-1',
  timezone: 'Asia/Seoul',
  friends: [{ id: 'f1', name: '별이', emoji: '⭐' }],
  slots: [{ id: 's1', time: '07:30', title: '아침', bodies: ['일어났어?'] }],
  ...over,
});

const subscription = { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } };

function post(path, body, headers = {}) {
  return new Request(`https://worker.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('validConfig 는 친구 항목의 모양까지 본다', () => {
  assert.equal(validConfig(config()), true);
  assert.equal(validConfig(config({ friends: [{ id: 'f1', name: '별이' }] })), false);
  assert.equal(validConfig(config({ friends: [{ id: 1, name: '별이', emoji: '⭐' }] })), false);
  assert.equal(validConfig(config({ friends: [{ id: 'f1', name: 'x'.repeat(41), emoji: '⭐' }] })), false);
  assert.equal(validConfig(config({ friends: ['별이'] })), false);
  assert.equal(validConfig(config({ friends: [] })), false);
});

test('올바른 요청은 저장된다', async () => {
  const e = env();
  const res = await worker.fetch(post('/subscribe', { passphrase: 'secret', subscription, config: config() }), e);
  assert.equal(res.status, 200);
  const devices = await e.HABIT_KV.get('devices', 'json');
  assert.equal(devices.length, 1);
});

test('다른 출처에서 온 쓰기 요청은 403', async () => {
  const e = env();
  const res = await worker.fetch(
    post('/subscribe', { passphrase: 'secret', subscription, config: config() }, { Origin: 'https://evil.example' }),
    e
  );
  assert.equal(res.status, 403);
  const res2 = await worker.fetch(post('/unsubscribe', { passphrase: 'secret', deviceId: 'dev-1' }, { Origin: 'https://evil.example' }), e);
  assert.equal(res2.status, 403);
});

test('ALLOWED_ORIGIN 이 비어 있으면 출처를 보지 않는다', async () => {
  const res = await worker.fetch(
    post('/unsubscribe', { passphrase: 'secret', deviceId: 'dev-1' }, { Origin: 'https://anywhere.example' }),
    env({ ALLOWED_ORIGIN: '' })
  );
  assert.equal(res.status, 200);
});

test('본문이 64KB 를 넘으면 읽지도 않고 413', async () => {
  const res = await worker.fetch(
    post('/subscribe', '{}', { 'content-length': String(65 * 1024) }),
    env()
  );
  assert.equal(res.status, 413);
});

test('같은 IP 에서 1분에 10번을 넘으면 429', async () => {
  const e = env();
  const headers = { 'CF-Connecting-IP': '203.0.113.9' };
  const bad = { passphrase: 'wrong', deviceId: 'dev-1' };
  for (let i = 0; i < 10; i += 1) {
    const res = await worker.fetch(post('/unsubscribe', bad, headers), e);
    assert.equal(res.status, 401, `요청 ${i + 1}`);
  }
  const res = await worker.fetch(post('/unsubscribe', bad, headers), e);
  assert.equal(res.status, 429);
  // 다른 IP 는 영향을 받지 않는다
  const other = await worker.fetch(post('/unsubscribe', bad, { 'CF-Connecting-IP': '198.51.100.1' }), e);
  assert.equal(other.status, 401);
});

test('/health 는 출처 없이도 읽히고 마지막 cron 시각을 알려준다', async () => {
  const e = env({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' });
  const before = await (await worker.fetch(new Request('https://worker.example/health'), e)).json();
  assert.equal(before.configured, true);
  assert.equal(before.vapidPublicKey, 'pub');
  assert.equal(before.lastTickAt, null);

  let pending;
  await worker.scheduled({}, e, { waitUntil: (p) => { pending = p; } });
  await pending;
  const after = await (await worker.fetch(new Request('https://worker.example/health'), e)).json();
  assert.ok(typeof after.lastTickAt === 'string');
});

test('시크릿이 없으면 KV 의 공개키를 쓰되, 개인키까지 없으면 설정 안 된 상태다', async () => {
  const e = env({ HABIT_KV: fakeKV({ 'config:vapid': JSON.stringify({ publicKey: 'kv-pub' }) }) });
  const h = await (await worker.fetch(new Request('https://worker.example/health'), e)).json();
  assert.equal(h.vapidPublicKey, '');
  assert.equal(h.configured, false);
});

test('시크릿 개인키 + KV 공개키 조합이 된다', async () => {
  const e = env({
    VAPID_PRIVATE_KEY: 'priv',
    HABIT_KV: fakeKV({ 'config:vapid': JSON.stringify({ publicKey: 'kv-pub' }) }),
  });
  const h = await (await worker.fetch(new Request('https://worker.example/health'), e)).json();
  assert.equal(h.vapidPublicKey, 'kv-pub');
  assert.equal(h.configured, true);
});
