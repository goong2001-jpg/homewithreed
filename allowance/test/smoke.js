// 실행: (allowance 폴더에서) npx http-server -p 8138 -s &  →  node test/smoke.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:8138';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  // prompt 에 넣을 답을 차례로 쌓아 둔다. 비어 있으면 기본값으로 확인.
  const answers = [];
  p.on('dialog', d => (d.type() === 'prompt' && answers.length ? d.accept(answers.shift()) : d.accept()));
  await p.goto(BASE + '/index.html');

  const year = new Date().getFullYear();
  check('연도 라벨', (await p.textContent('#yearLabel')) === year + '년');
  check('처음엔 0원', (await p.textContent('#yearTotal')) === '0원');

  await p.click('.bill.b1000');
  await p.click('.chip[data-giver="할머니"]');
  await p.click('.bill.b50000');
  await p.click('.bill.b10000');
  await p.click('.bill.b5000');
  check('올해 합계 66,000원', (await p.textContent('#yearTotal')) === '66,000원', await p.textContent('#yearTotal'));
  check('4번 받음', (await p.textContent('#yearCount')) === '4번 받았어요');
  check('할머니 기록 표시', (await p.locator('.row .who', { hasText: '할머니' }).count()) === 1);
  check('선택한 사람은 기록 후 해제', (await p.locator('.chip.on').count()) === 0);

  await p.click('#undoBtn');
  check('되돌리기 → 61,000원', (await p.textContent('#yearTotal')) === '61,000원');

  // 작년 날짜로 기록 → 작년 화면으로 넘어감
  await p.fill('#dateInput', (year - 1) + '-12-31');
  await p.click('.bill.b10000');
  check('작년으로 이동', (await p.textContent('#yearLabel')) === (year - 1) + '년');
  check('작년 합계 10,000원', (await p.textContent('#yearTotal')) === '10,000원');
  check('전체 합계 71,000원', (await p.textContent('#allTotal')) === '71,000원');
  await p.click('#nextYear');
  check('다음 해 버튼', (await p.textContent('#yearTotal')) === '61,000원');

  await p.reload();
  check('새로고침 후 유지', (await p.textContent('#allTotal')) === '71,000원');

  await p.locator('.row .del').first().click();
  check('삭제', (await p.textContent('#yearTotal')) !== '61,000원', await p.textContent('#yearTotal'));

  // 백업 → 비우고 → 불러오기
  await p.click('.backup summary');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBtn')]);
  const file = await dl.path();
  const before = await p.textContent('#allTotal');
  await p.evaluate(() => localStorage.removeItem('hwr-allowance-v1'));
  await p.reload();
  check('비운 뒤 0원', (await p.textContent('#allTotal')) === '0원');
  await p.click('.backup summary');
  await p.setInputFiles('#importInput', file);
  await p.waitForTimeout(300);
  check('백업 복원', (await p.textContent('#allTotal')) === before, await p.textContent('#allTotal'));

  // ---- 준 사람 추가·수정·삭제 ----
  const chips = () => p.$$eval('#givers .chip[data-giver]', els => els.map(e => e.textContent));
  answers.push('  고모  ');
  await p.click('#givers [data-act="add"]');
  check('추가 (공백 정리)', (await chips()).includes('고모'));
  check('추가한 사람 바로 선택', (await p.textContent('.chip.on')) === '고모');
  await p.click('.bill.b10000');
  check('고모 기록', (await p.locator('.row .who', { hasText: '고모' }).count()) === 1);

  await p.click('#givers [data-act="edit"]');
  const idx = (await p.$$eval('#givers .chipName', els => els.map(e => e.textContent.replace(' ✏️', '')))).indexOf('고모');
  answers.push('큰고모');
  await p.click(`#givers [data-rename="${idx}"]`);
  check('이름 수정', (await p.$$eval('#givers .chipName', els => els.map(e => e.textContent))).some(t => t.startsWith('큰고모')));
  check('지난 기록 이름도 바뀜', (await p.locator('.row .who', { hasText: '큰고모' }).count()) === 1);

  answers.push('할머니');
  await p.click(`#givers [data-rename="${idx}"]`);
  check('중복 이름 거부', (await p.$$eval('#givers .chipName', els => els.map(e => e.textContent))).some(t => t.startsWith('큰고모')));

  await p.click('#givers [data-remove="0"]');   // 할머니
  await p.click('#givers [data-act="done"]');
  check('삭제', !(await chips()).includes('할머니'));
  check('삭제해도 지난 기록 유지', (await p.locator('.row .who', { hasText: '할머니' }).count()) >= 1);

  await p.reload();
  check('목록 새로고침 후 유지', (await chips()).includes('큰고모') && !(await chips()).includes('할머니'));

  await p.screenshot({ path: process.env.SHOT || 'shot.png', fullPage: true });
  check('JS 에러 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n실패 ' + fail.length + '개' : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
