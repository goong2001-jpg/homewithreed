// 실행: (japanese-learn 폴더에서) python3 -m http.server 8141 &  →  node test/smoke.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:8141';
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
  const shot = async n => { if (SHOTS) await p.screenshot({ path: SHOTS + '/' + n + '.png' }); };
  await shot('01-welcome');

  check('처음엔 환영 화면', (await t('#view')).includes('はじめまして'));

  // ---- 레벨테스트: 초급 6개 다 맞히고 중급은 모두 모르겠어요 → 초급 6과(동사 ます형) ----
  await p.click('[data-act="startTest"]');
  await p.click('[data-act="testBegin"]');
  const plc = await p.evaluate(() => window.JP_DATA.PLACEMENT.map(st => st.map(q => q.o[q.a])));
  for (const ans of plc[0]) {
    await p.locator('#session .opt', { hasText: ans }).first().click();
  }
  check('초급 통과 후 중급 안내', (await t('#session')).includes('중급 문제로 넘어갑니다'));
  await p.click('[data-act="testGo"]');
  await shot('02-test');
  for (let i = 0; i < 6; i++) await p.click('[data-act="testPick"][data-i="-1"]');
  const res = await t('#session');
  check('결과: 동사 ます형부터', res.includes('동사 ます형부터'), res.slice(0, 80));
  check('결과: 한 단계 아래 제안', res.includes('자기소개'));
  await shot('03-result');
  await p.click('[data-act="accept"][data-id="b6"]');
  check('홈에 6과', (await t('#view')).includes('第6課'));
  await shot('04-home');

  // ---- 단원 학습: 단어 8 → 문형 → 퀴즈(전부 정답) ----
  await p.click('#view [data-act="startLesson"]');
  check('단어 카드 1/8', (await t('#session .cnt')) === '1 / 8');
  await shot('05-word');
  for (let i = 0; i < 8; i++) await p.click('[data-act="nextWord"]');
  check('문형 화면', (await t('#session .pattern')).includes('ます'));
  await shot('06-grammar');
  await p.click('[data-act="toQuiz"]');
  await shot('07-quiz');
  let guard = 0;
  while (guard++ < 40) {
    const ans = await p.evaluate(() => window.__jpDebug.answer());
    if (ans == null) break;
    const opts = await p.$$eval('#session .opt', bs => bs.map(b => b.textContent));
    await p.click('#session .opt >> nth=' + opts.indexOf(ans));
    await p.waitForTimeout(720);
  }
  const r1 = await t('#session');
  check('퀴즈 100점 합격', r1.includes('合格') && r1.includes('100'), r1.slice(0, 120));
  await shot('08-pass');
  await p.click('#session [data-act="close"]');
  check('오늘 완료 도장', (await t('#view')).includes('済'));
  check('다음은 7과', (await t('#view')).includes('第7課'));
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('hwr-jp-v1')));
  check('복습 단어 8개 등록', Object.keys(st.srs).length === 8);
  check('연속 1일', (await t('#streak')).includes('1'));

  // ---- 일부러 다 틀리기 → 재도전, 틀린 문제는 다시 나온다 ----
  await p.click('#view [data-act="startLesson"]');
  for (let i = 0; i < 8; i++) await p.click('[data-act="nextWord"]');
  await p.click('[data-act="toQuiz"]');
  let firsts = 0; guard = 0;
  while (guard++ < 60) {
    const ans = await p.evaluate(() => window.__jpDebug.answer());
    if (ans == null) break;
    const opts = await p.$$eval('#session .opt', bs => bs.map(b => b.textContent));
    if (!(await p.evaluate(() => window.__jpDebug.missed()))) {
      await p.click('#session .opt >> nth=' + opts.findIndex(o => o !== ans));
      if (firsts++ === 0) await shot('09-wrong');
      await p.click('[data-act="quizNext"]');
    } else {
      await p.click('#session .opt >> nth=' + opts.indexOf(ans));
      await p.waitForTimeout(720);
    }
  }
  const r2 = await t('#session');
  check('다 틀리면 재도전', r2.includes('再挑戦'), r2.slice(0, 80));
  check('틀린 단어 목록', (await p.$$('#session .wrongList li')).length >= 8);
  await p.click('#session [data-act="close"]');

  // ---- 하루 지난 것처럼 복습 날짜를 당긴다 ----
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('hwr-jp-v1'));
    Object.values(s.srs).forEach(v => { v.due = '2000-01-01'; });
    localStorage.setItem('hwr-jp-v1', JSON.stringify(s));
  });
  await p.reload();
  await p.click('[data-tab="review"]');
  check('복습 대기 표시', (await t('.bigNum')) !== '0', await t('.bigNum'));
  check('오답 노트', (await p.$$('#view .wrongList li')).length >= 8);
  await shot('10-review');
  await p.click('#view [data-act="startReview"]');
  guard = 0;
  while (guard++ < 60) {
    const ans = await p.evaluate(() => window.__jpDebug.answer());
    if (ans == null) break;
    const opts = await p.$$eval('#session .opt', bs => bs.map(b => b.textContent));
    await p.click('#session .opt >> nth=' + opts.indexOf(ans));
    await p.waitForTimeout(720);
  }
  check('복습 완료', (await t('#session')).includes('復習'));
  await p.click('#session [data-act="close"]');
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('hwr-jp-v1')));
  check('복습 맞히면 상자 2로', Object.values(st2.srs).every(v => v.box === 2));

  // ---- 커리큘럼·기록·가나 ----
  await p.click('[data-tab="course"]');
  check('커리큘럼 22단원', (await p.$$('#view .line li')).length === 22);
  check('앞 단원은 건너뜀', (await t('#view')).includes('건너뜀'));
  await shot('11-course');
  await p.click('#view [data-id="b1"]');
  check('히라가나 46자', (await p.$$('#session .kanaGrid button')).length === 46);
  await shot('12-kana');
  await p.click('#session [data-act="close"]');
  await p.click('[data-tab="record"]');
  await shot('13-record');
  check('기록: 완료 단원 1', (await t('.stats')).includes('1완료 단원'));

  check('JS 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n실패 ' + fail.length + '개' : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
