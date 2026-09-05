const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FAKE = fs.readFileSync(path.join(__dirname, 'fakepeer.js'), 'utf8');
const BASE = 'http://localhost:8137';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,   // 없으면 playwright 기본 크로미움
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-capture', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ permissions: ['microphone'] });

  const errors = [];
  async function openPage() {
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await p.route('**/peerjs.min.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE }));
    await p.goto(BASE + '/index.html');
    return p;
  }

  async function join(p, name, room) {
    await p.fill('#nameInput', name);
    await p.fill('#roomInput', room);
    await p.click('#joinBtn');
    await p.waitForSelector('#talkView:not(.hidden)', { timeout: 8000 });
  }

  global.__pages = {};
  const a = await openPage();
  global.__pages.a = a;
  await join(a, '아빠', '1234');
  check('A 입장 → 무전 화면', await a.isVisible('#talkView'));
  check('A 혼자 표시', await a.evaluate(() => document.querySelectorAll('#members li').length) === 1);
  check('A 가 허브가 됨', (await a.textContent('#members')).includes('⭐'), await a.textContent('#members'));
  check('A 초기 상태 = 대기', (await a.textContent('#statusLine')).includes('기다리는'), await a.textContent('#statusLine'));

  const b = await openPage();
  global.__pages.b = b;
  await join(b, '엄마', '1234');

  await a.waitForFunction(() => document.querySelectorAll('#members li').length === 2, null, { timeout: 10000, polling: 200 });
  await b.waitForFunction(() => document.querySelectorAll('#members li').length === 2, null, { timeout: 10000, polling: 200 });
  check('A 에서 상대 이름 보임', (await a.textContent('#members')).includes('엄마'), await a.textContent('#members'));
  check('B 에서 상대 이름 보임', (await b.textContent('#members')).includes('아빠'), await b.textContent('#members'));
  check('B 는 허브가 아님', !(await b.textContent('#members')).split('(나)')[0].includes('⭐'), await b.textContent('#members'));
  check('A 상태 = 2명', (await a.textContent('#statusLine')).includes('2명'), await a.textContent('#statusLine'));

  // 빈 슬롯(3~6)이 인원으로 잡히지 않는지 확인 — 재스캔 이후에도 2명이어야 한다
  await a.waitForTimeout(1500);
  check('유령 인원이 안 섞임', await a.evaluate(() => document.querySelectorAll('#members li').length) === 2);
  check('허브 명단이 2명', await a.evaluate(() => document.querySelectorAll('#members li').length) === 2);

  // PTT 송신 (헤드리스에서 실제 마우스 대신 포인터 이벤트를 직접 던진다)
  console.log('... PTT 시작');
  await a.dispatchEvent('#pttBtn', 'pointerdown');
  await a.waitForTimeout(300);
  check('A 송신 중 표시', (await a.getAttribute('#pttBtn', 'class')).includes('on'));
  await b.waitForFunction(() => document.getElementById('nowTalking').textContent.includes('말하는 중'),
    null, { timeout: 5000, polling: 200 });
  check('B 에 "아빠 말하는 중" 뜸', (await b.textContent('#nowTalking')).includes('아빠'), await b.textContent('#nowTalking'));

  await a.dispatchEvent('#pttBtn', 'pointerup');
  await b.waitForFunction(() => !document.getElementById('nowTalking').textContent.includes('말하는 중'),
    null, { timeout: 5000, polling: 200 });
  check('손 떼면 송신 종료 전파', !(await b.textContent('#nowTalking')).includes('말하는 중'));
  check('버튼 원래대로', !(await a.getAttribute('#pttBtn', 'class')).includes('on'));

  // 허브(A)가 나갔을 때 B 가 허브를 이어받고, 새 사람(C)이 여전히 들어올 수 있는지
  console.log('... 허브 승계 확인');
  await a.click('#leaveBtn');
  await b.waitForFunction(() => document.querySelectorAll('#members li').length === 1, null, { timeout: 15000, polling: 300 });
  check('A 퇴장 시 B 목록에서 사라짐', await b.evaluate(() => document.querySelectorAll('#members li').length) === 1);
  await b.waitForFunction(() => document.querySelector('#members li.me').textContent.includes('⭐'), null, { timeout: 20000, polling: 300 });
  check('B 가 허브를 이어받음', (await b.textContent('#members')).includes('⭐'), await b.textContent('#members'));

  const c = await openPage();
  global.__pages.c = c;
  await join(c, '리드', '1234');
  await b.waitForFunction(() => document.querySelectorAll('#members li').length === 2, null, { timeout: 15000, polling: 300 });
  await c.waitForFunction(() => document.querySelectorAll('#members li').length === 2, null, { timeout: 15000, polling: 300 });
  check('허브 승계 후 새 참가자 연결됨', (await b.textContent('#members')).includes('리드'), await b.textContent('#members'));

  // 나가기
  await c.click('#leaveBtn');
  await b.waitForFunction(() => document.querySelectorAll('#members li').length === 1, null, { timeout: 12000, polling: 200 });
  check('C 퇴장 시 B 목록에서 사라짐', await b.evaluate(() => document.querySelectorAll('#members li').length) === 1);

  check('JS 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(fail.length ? '\n실패 ' + fail.length + '개: ' + fail.join(', ') : '\n전체 통과');
  process.exit(fail.length ? 1 : 0);
})().catch(async e => {
  console.error('테스트 자체 실패:', e.message);
  for (const [k, p] of Object.entries(global.__pages || {})) {
    try { console.error('\n===== ' + k + ' 진단 기록 =====\n' + await p.textContent('#log')); } catch (_) {}
  }
  process.exit(2);
});
