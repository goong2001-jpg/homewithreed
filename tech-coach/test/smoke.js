// 실행: (tech-coach 폴더에서) python3 -m http.server 8151 &  →  node test/smoke.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:8151';
const SHOTS = process.env.SHOTS || '';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html');
  const t = sel => p.textContent(sel);
  const shot = async n => { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + n + '.png', fullPage: false }); };
  await shot('01-home');

  check('처음엔 진단 안내', (await t('#view')).includes('수준 진단 5문항부터'));
  check('이번 주 W1', (await t('#view')).includes('브라우저와 HTML'));

  // ---- 진단: 적기 전엔 확인 포인트 버튼이 잠겨 있다 ----
  await p.click('[data-act="diag"]');
  check('적기 전 버튼 잠김', await p.isDisabled('#showBtn'));
  for (let i = 0; i < 5; i++) {
    await p.fill('#ans', i === 2 ? '모름' : '요청하고 응답을 받는다');
    await p.click('#showBtn');
    if (i === 0) { check('확인 포인트 표시', (await t('#session')).includes('확인 포인트')); await shot('02-diag'); }
    await p.click('[data-act="diagRate"][data-g="' + (i === 2 ? 0 : 2) + '"]');
  }
  const res = await t('#session');
  check('결과: 알았다 4 몰랐다 1', res.includes('알았다 4') && res.includes('몰랐다 1'), res.slice(0, 80));
  check('결과: 3번 보강 → 6주차 맛보기', res.includes('3번') && res.includes('6주차'));
  await shot('03-diag-result');
  await p.click('[data-act="diagSave"]');
  check('진단 저장 후 안내 사라짐', !(await t('#view')).includes('수준 진단 5문항부터'));

  // ---- 세션 순서 체크 ----
  await p.check('[data-act="step"][data-i="0"]');
  check('세션 1/5', (await t('#view')).includes('1/5'));

  // ---- 면접모드 5문 ----
  await p.click('[data-act="interview"]');
  check('면접모드 1/5', (await t('#session')).includes('면접모드 · 1/5'));
  for (let i = 0; i < 5; i++) {
    await p.fill('#ans', '이미 학습된 모델을 API로 호출해 추론만 씁니다. 프롬프트를 설계했습니다. 세 번째 문장.');
    if (i === 0) check('문장 수 경고', (await t('#cnt')).includes('2문장으로 줄여'));
    await p.click('#showBtn');
    if (i === 0) { check('모범 답 표시', (await t('#session')).includes('2문장 모범 답')); await shot('04-qa'); }
    await p.click('[data-act="qaRate"][data-g="' + (i % 2 ? 1 : 2) + '"]');
  }
  check('면접모드 결과', (await t('#session')).includes('면접모드 결과'));
  await p.click('#session [data-act="close"]');
  check('질문 정확 3/20', (await t('#view')).includes('3/20'));

  // ---- 질문 탭: 내 답이 남아 있다 ----
  await p.click('[data-act="tab"][data-tab="qa"]');
  await p.click('[data-act="qaf"][data-f="real"]');
  check('공모전 실제 질문 4개', (await p.locator('#view [data-act="qa"]').count()) === 4);
  await p.click('[data-act="qa"][data-id="q01"]');
  check('q01 질문', (await t('#session')).includes('무슨 데이터로'));
  await p.click('#session [data-act="close"]');

  // ---- 용어 퀴즈 ----
  await p.click('[data-act="tab"][data-tab="terms"]');
  check('용어 20개', (await p.locator('.term').count()) === 20);
  await p.click('[data-act="termQuiz"]');
  for (let i = 0; i < 5; i++) {
    const def = await t('#session .q');
    const ans = await p.evaluate(d => window.TC_DATA.TERMS.find(x => x.d === d).t, def);
    await p.locator('#session .opt', { hasText: new RegExp('^' + ans.replace(/[()]/g, '\\$&') + '$') }).click();
    await p.click('[data-act="termNext"]');
  }
  check('용어 퀴즈 5/5', (await t('#session')).includes('5 / 5'));
  await p.click('#session [data-act="close"]');
  check('익힘 5개 이상', (await p.locator('.know.on').count()) >= 5);

  // ---- 커리큘럼: 완료하면 다음 주로 ----
  await p.click('[data-act="tab"][data-tab="course"]');
  await p.click('[data-act="week"][data-n="1"]');
  await shot('05-course');
  await p.click('[data-act="doneWeek"][data-n="1"]');
  check('W2로 넘어감', (await t('#wk')).includes('W2'));

  // ---- 3분 설명 ----
  await p.click('[data-act="tab"][data-tab="home"]');
  await p.click('[data-act="pitch"]');
  await p.click('[data-act="pitchGo"]');
  await p.waitForTimeout(1300);
  await p.click('[data-act="pitchStop"]');
  check('3분 설명 기록', (await t('#session')).includes('최근 기록'));
  await shot('06-pitch');
  await p.click('#session [data-act="close"]');

  // ---- 기록 + 새로고침 후 유지 ----
  await p.click('[data-act="tab"][data-tab="log"]');
  await p.fill('#lgX', '서버와 API를 같은 걸로 알았다');
  await p.fill('#lgN', '자바스크립트 이벤트');
  await p.click('[data-act="addLog"]');
  check('기록 1건', (await t('#view')).includes('1건'));
  await p.reload();
  await p.click('[data-act="tab"][data-tab="log"]');
  check('새로고침 후 기록 유지', (await t('#view')).includes('서버와 API를 같은 걸로'));
  const txt = await p.evaluate(() => { let s = ''; navigator.clipboard.writeText = v => { s = v; return Promise.resolve(); }; document.querySelector('[data-act="copyLog"]').click(); return new Promise(r => setTimeout(() => r(s), 50)); });
  check('복사 텍스트에 기록', txt.includes('## ') && txt.includes('다음 주제: 자바스크립트 이벤트'), txt.slice(0, 60));
  await shot('07-log');

  // ---- 가로 스크롤 없음 ----
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check('가로 넘침 없음', sw <= 390, String(sw));

  check('JS 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + '개 실패' : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
