/**
 * 엄마아빠 은행(family-bank) 알림 중계 테스트.
 *   npm test
 *
 * 순수 함수(페이로드 다듬기, 부모 폰 목록 갱신)와 /bank/* 경로를 가짜 KV 로 직접 부른다.
 * 실제 푸시 발송(web-push)은 여기서 하지 않는다 — 부모 폰이 없을 때의 응답까지만 본다.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { bankPayload, upsertParent } from './index.ts';

/** 메모리 KV. TTL 은 무시한다 */
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

const sub = (n = 1) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: `p${n}`, auth: `a${n}` } });

function post(path, body, headers = {}) {
  return new Request(`https://worker.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// ── 순수 함수 ──

test('bankPayload 는 제목이 없으면 기본 제목을 넣고, 본문이 없거나 길면 거른다', () => {
  assert.deepEqual(bankPayload({ body: '하율이가 5,000원 찾기 신청했어요' }), {
    title: '엄마아빠 은행',
    body: '하율이가 5,000원 찾기 신청했어요',
  });
  assert.deepEqual(
    bankPayload({ title: ' 은행 ', body: ' 본문 ', url: 'https://x.example/bank/', tag: 'req-1' }),
    { title: '은행', body: '본문', url: 'https://x.example/bank/', tag: 'req-1' }
  );
  assert.equal(bankPayload({ body: '' }), null);
  assert.equal(bankPayload({ body: '   ' }), null);
  assert.equal(bankPayload({ body: 'x'.repeat(301) }), null);
  assert.equal(bankPayload({ title: 'x'.repeat(61), body: 'b' }), null);
  assert.equal(bankPayload({ body: 'b', url: 'javascript:alert(1)' }), null);
  assert.equal(bankPayload({ body: 'b', url: 'https://' + 'x'.repeat(500) }), null);
  assert.equal(bankPayload({ body: 'b', tag: 'x'.repeat(61) }), null);
  assert.equal(bankPayload({ body: 'b', tag: 7 }), null);
  assert.equal(bankPayload(null), null);
  assert.equal(bankPayload('문자열'), null);
});

test('upsertParent: 같은 기기·같은 구독은 하나만, 내용이 그대로면 changed=false', () => {
  const a = upsertParent([], { deviceId: 'mom', subscription: sub(1) }, 100);
  assert.equal(a.changed, true);
  assert.equal(a.list.length, 1);

  // 같은 기기, 같은 구독 → 쓰기 건너뜀
  const same = upsertParent(a.list, { deviceId: 'mom', subscription: sub(1) }, 200);
  assert.equal(same.changed, false);
  assert.equal(same.list, a.list);

  // 같은 기기, 구독만 새로 → 교체
  const renewed = upsertParent(a.list, { deviceId: 'mom', subscription: sub(2) }, 300);
  assert.equal(renewed.changed, true);
  assert.equal(renewed.list.length, 1);
  assert.equal(renewed.list[0].subscription.endpoint, 'https://push.example/2');

  // 다른 기기 이름인데 같은 endpoint (앱을 지웠다 다시 깔아서 deviceId 가 바뀜) → 하나만 남는다
  const dup = upsertParent(renewed.list, { deviceId: 'mom-2', subscription: sub(2) }, 400);
  assert.equal(dup.list.length, 1);
  assert.equal(dup.list[0].deviceId, 'mom-2');
});

test('upsertParent: 4대를 넘으면 오래된 것부터 버린다', () => {
  let list = [];
  for (let i = 1; i <= 5; i += 1) {
    list = upsertParent(list, { deviceId: `d${i}`, subscription: sub(i) }, i * 10).list;
  }
  assert.equal(list.length, 4);
  assert.deepEqual(list.map((p) => p.deviceId), ['d5', 'd4', 'd3', 'd2']);
});

// ── /bank/subscribe ──

test('/bank/subscribe 는 bank:parents 에 저장하고 devices 는 건드리지 않는다', async () => {
  const e = env();
  const body = { passphrase: 'secret', subscription: sub(1), deviceId: 'mom', role: 'parent' };
  const res = await worker.fetch(post('/bank/subscribe', body), e);
  assert.equal(res.status, 200);
  const parents = await e.HABIT_KV.get('bank:parents', 'json');
  assert.equal(parents.length, 1);
  assert.equal(parents[0].deviceId, 'mom');
  assert.equal(await e.HABIT_KV.get('devices', 'json'), null);

  // 같은 내용을 또 보내면 KV 쓰기 없이 unchanged
  const puts = e.HABIT_KV.puts;
  const again = await (await worker.fetch(post('/bank/subscribe', body), e)).json();
  assert.equal(again.unchanged, true);
  assert.equal(e.HABIT_KV.puts, puts + 1);   // 횟수 제한 카운터 한 번뿐
});

test('/bank/subscribe 는 암호·역할·구독 모양을 본다', async () => {
  const e = env();
  const ok = { passphrase: 'secret', subscription: sub(1), deviceId: 'mom', role: 'parent' };
  assert.equal((await worker.fetch(post('/bank/subscribe', { ...ok, passphrase: 'nope' }), e)).status, 401);
  assert.equal((await worker.fetch(post('/bank/subscribe', { ...ok, role: 'kid' }), e)).status, 400);
  assert.equal((await worker.fetch(post('/bank/subscribe', { ...ok, deviceId: '' }), e)).status, 400);
  assert.equal((await worker.fetch(post('/bank/subscribe', { ...ok, subscription: { endpoint: 'http://x' } }), e)).status, 400);
  assert.equal((await worker.fetch(post('/bank/subscribe', 'not json'), e)).status, 400);
  assert.equal((await worker.fetch(post('/bank/subscribe', ok, { Origin: 'https://evil.example' }), e)).status, 403);
  assert.equal(await e.HABIT_KV.get('bank:parents', 'json'), null);
});

test('/bank/unsubscribe 는 그 기기만 뺀다', async () => {
  const e = env();
  for (const id of ['mom', 'dad']) {
    await worker.fetch(post('/bank/subscribe', { passphrase: 'secret', subscription: sub(id), deviceId: id, role: 'parent' }), e);
  }
  const res = await worker.fetch(post('/bank/unsubscribe', { passphrase: 'secret', deviceId: 'mom' }), e);
  assert.equal(res.status, 200);
  const parents = await e.HABIT_KV.get('bank:parents', 'json');
  assert.deepEqual(parents.map((p) => p.deviceId), ['dad']);
  assert.equal((await worker.fetch(post('/bank/unsubscribe', { passphrase: 'x', deviceId: 'dad' }), e)).status, 401);
});

// ── /bank/notify ──

test('/bank/notify 는 부모 폰이 없으면 sent:0, 본문이 이상하면 400, 암호가 틀리면 401', async () => {
  const e = env({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' });
  const res = await worker.fetch(post('/bank/notify', { passphrase: 'secret', body: '하율이가 5,000원 찾기 신청했어요' }), e);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sent: 0, parents: 0 });

  assert.equal((await worker.fetch(post('/bank/notify', { passphrase: 'secret', body: '' }), e)).status, 400);
  assert.equal((await worker.fetch(post('/bank/notify', { passphrase: 'secret', body: 'b', url: 'ftp://x' }), e)).status, 400);
  assert.equal((await worker.fetch(post('/bank/notify', { passphrase: 'wrong', body: 'b' }), e)).status, 401);
  assert.equal((await worker.fetch(post('/bank/notify', { passphrase: 'secret', body: 'b' }, { Origin: 'https://evil.example' }), e)).status, 403);
});

test('/bank/notify 는 한 시간에 30번을 넘으면 429 (IP 가 달라도)', async () => {
  const e = env();
  // IP 별 1분 10번 제한에 걸리지 않게 요청마다 IP 를 바꾼다
  for (let i = 1; i <= 30; i += 1) {
    const res = await worker.fetch(
      post('/bank/notify', { passphrase: 'secret', body: `신청 ${i}` }, { 'CF-Connecting-IP': `10.0.${Math.floor(i / 200)}.${i}` }),
      e
    );
    assert.equal(res.status, 200, `요청 ${i}`);
  }
  const over = await worker.fetch(
    post('/bank/notify', { passphrase: 'secret', body: '하나 더' }, { 'CF-Connecting-IP': '10.0.1.1' }),
    e
  );
  assert.equal(over.status, 429);
  // 틀린 암호는 횟수를 먹지 않는다 (401 이 먼저)
  const bad = await worker.fetch(
    post('/bank/notify', { passphrase: 'wrong', body: 'x' }, { 'CF-Connecting-IP': '10.0.1.2' }),
    e
  );
  assert.equal(bad.status, 401);
});
