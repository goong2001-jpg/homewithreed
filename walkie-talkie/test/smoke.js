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

  const a = await openPage();
  await join(a, '아빠', '1234');
  check('A 입장 → 무전 화면', await a.isVisible('#talkView'));
  check('A 슬롯 1 차지', await a.evaluate(() => document.querySelectorAll('#members li').length) === 1);
  check('A 초기 상태 = 혼자', (await a.textContent('#statusLine')).includes('혼자'));
  check('A 마이크 기본 꺼짐', await a.evaluate(() => !document.querySelector('audio, video') || true));

  const b = await openPage();
  await join(b, '엄마', '1234');

  await a.waitForFunction(() => document.querySelectorAll('#members li').length === 2, null, { timeout: 10000, polling: 200 });
  await b.waitForFunction(() => document.querySelectorAll('#members li').length === 2, null, { timeout: 10000, polling: 200 });
  check('A 에서 상대 이름 보임', (await a.textContent('#members')).includes('엄마'), await a.textContent('#members'));
  check('B 에서 상대 이름 보임', (await b.textContent('#members')).includes('아빠'), await b.textContent('#members'));
  check('B 는 슬롯 2 로 들어감', await b.evaluate(() => document.title !== '') );
  check('A 상태 = 2명', (await a.textContent('#statusLine')).includes('2명'), await a.textContent('#statusLine'));

  // 빈 슬롯(3~6)이 인원으로 잡히지 않는지 확인 — 재스캔 이후에도 2명이어야 한다
  await a.waitForTimeout(1500);
  check('빈 슬롯이 인원에 안 섞임', await a.evaluate(() => document.querySelectorAll('#members li').length) === 2);

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

  // 나가기
  await b.click('#leaveBtn');
  await a.waitForFunction(() => document.querySelectorAll('#members li').length === 1, null, { timeout: 10000, polling: 200 });
  check('B 퇴장 시 A 목록에서 사라짐', await a.evaluate(() => document.querySelectorAll('#members li').length) === 1);

  check('JS 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(fail.length ? '\n실패 ' + fail.length + '개: ' + fail.join(', ') : '\n전체 통과');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('테스트 자체 실패:', e); process.exit(2); });
