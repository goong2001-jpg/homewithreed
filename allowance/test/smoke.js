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
  // prompt/confirm 답을 차례로 쌓아 둔다. 비어 있으면 기본값으로 확인.
  const answers = [];
  let dismissNext = false;
  p.on('dialog', d => {
    if (dismissNext && d.type() === 'confirm') { dismissNext = false; return d.dismiss(); }
    return d.type() === 'prompt' && answers.length ? d.accept(answers.shift()) : d.accept();
  });
  await p.goto(BASE + '/index.html');
  const t = sel => p.textContent(sel);
  const year = new Date().getFullYear();

  // ---- 받은 돈 ----
  check('연도 라벨', (await t('#yearLabel')) === year + '년');
  check('처음엔 0원', (await t('#balance')) === '0원');
  // 지폐를 이어서 누르면 한 줄로 합쳐진다
  await p.click('#tags [data-tag="할머니"]');
  await p.click('.bill.b50000');
  await p.click('.bill.b50000');
  await p.click('.bill.b10000');
  check('5만×2+1만 → 한 줄', (await p.locator('.row').count()) === 1, String(await p.locator('.row').count()));
  check('합친 금액 110,000원', (await t('#yearIn')) === '+110,000원', await t('#yearIn'));
  check('합친 기록에 준 사람 유지', (await t('.row .who')).includes('할머니'));
  check('지폐 구성 표시', (await t('.row .who')).includes('오만원×2 + 만원'), await t('.row .who'));
  check('알림에 합계', (await t('#toastText')).includes('110,000원'));
  check('지폐 장수는 따로 셈', (await t('#billCounts')).replace(/\s/g, '').includes('오만원2장'), await t('#billCounts'));
  await p.click('#undoBtn');
  check('되돌리기 → 합친 줄 통째로 취소', (await t('#balance')) === '0원');

  // 칩을 새로 고르면 새 줄
  await p.click('#tags [data-tag="할머니"]');
  await p.click('.bill.b1000');
  await p.click('#tags [data-tag="엄마"]');
  await p.click('.bill.b50000');
  await p.click('.bill.b10000');
  check('새 칩 → 새 줄', (await p.locator('.row').count()) === 2);
  check('받은 돈 61,000원', (await t('#yearIn')) === '+61,000원', await t('#yearIn'));
  // 알림이 사라진 뒤 누르면 새 줄
  await p.waitForTimeout(5300);
  await p.click('.bill.b5000');
  check('알림 끝난 뒤 → 새 줄', (await p.locator('.row').count()) === 3);
  await p.click('#undoBtn');
  check('가진 돈 61,000원', (await t('#balance')) === '61,000원');

  // ---- 쓴 돈 ----
  await p.click('.seg [data-mode="out"]');
  check('쓴 돈 모드 제목', (await t('#recordTitle')).includes('썼어요'));
  check('쓴 곳 칩', (await p.locator('#tags [data-tag="과자·간식"]').count()) === 1);
  await p.click('#tags [data-tag="과자·간식"]');
  answers.push('1,500원');
  await p.click('#customBtn');
  check('직접 입력 1,500원 씀', (await t('#yearOut')) === '−1,500원', await t('#yearOut'));
  check('가진 돈 59,500원', (await t('#balance')) === '59,500원');
  check('목록에 −1,500원', (await p.locator('.row.out .amt', { hasText: '−1,500원' }).count()) === 1);
  check('어디에 썼나', (await t('#useBreak')).includes('과자·간식'));

  dismissNext = true;   // 가진 돈보다 많이 쓰기 → 취소
  await p.click('.bill.b50000'); await p.click('.bill.b10000');
  check('초과 지출 확인창(취소하면 안 적힘)', (await t('#yearOut')) === '−51,500원', await t('#yearOut'));
  await p.click('#undoBtn');

  // 쓴 곳 목록 편집 (받은 돈 목록과 따로)
  answers.push('포켓몬 카드');
  await p.click('#tags [data-act="add"]');
  check('쓴 곳 추가', (await p.locator('#tags [data-tag="포켓몬 카드"]').count()) === 1);
  await p.click('.seg [data-mode="in"]');
  check('받은 돈 목록엔 없음', (await p.locator('#tags [data-tag="포켓몬 카드"]').count()) === 0);

  // ---- 목표 ----
  check('목표 없음 안내', (await t('#goalBody')).includes('목표 정하기'));
  answers.push('레고 성', '100,000');
  await p.click('[data-goal="set"]');
  check('목표 이름', (await t('.goalName')).includes('레고 성'));
  check('진행률 59%', (await t('.progress span')) === '59%', await t('.progress span'));
  check('남은 금액', (await t('.goalMsg')) === '40,500원 더 모으면 돼요!', await t('.goalMsg'));
  await p.click('.bill.b50000');
  check('달성', (await t('.goalMsg')).includes('목표 달성'));
  await p.click('[data-goal="buy"]');
  check('샀어요 → 쓴 돈', (await p.locator('.row.out .who', { hasText: '레고 성' }).count()) === 1);
  check('샀어요 → 가진 돈 9,500원', (await t('#balance')) === '9,500원', await t('#balance'));
  check('목표 비워짐', (await t('#goalBody')).includes('목표 정하기'));
  await p.click('#undoBtn');
  check('되돌리면 목표 복원', (await t('.goalName')).includes('레고 성') && (await t('#balance')) === '109,500원');

  // ---- 큰 금액 / 한국어 단위 ----
  answers.push('자율주행 FSD차', '125000000');
  await p.click('[data-goal="set"]');
  check('목표 1억2500만 (숫자)', (await t('.goalNums')).includes('125,000,000원'), await t('.goalNums'));
  answers.push('자율주행 FSD차', '1억 2500만원');
  await p.click('[data-goal="set"]');
  check('목표 "1억 2500만원"', (await t('.goalNums')).includes('125,000,000원'), await t('.goalNums'));
  answers.push('레고 성', '십만원', '100,000');   // 못 읽으면 다시 묻는다
  await p.click('[data-goal="set"]');
  check('잘못 넣으면 다시 물어봄', (await t('.goalName')).includes('레고 성') && (await t('.goalNums')).includes('/ 100,000원'));
  await p.click('.seg [data-mode="out"]');
  answers.push('3만5천');
  await p.click('#customBtn');
  check('직접 입력 "3만5천"', (await p.locator('.row.out .amt', { hasText: '−35,000원' }).count()) === 1);
  await p.click('#undoBtn');
  await p.click('.seg [data-mode="in"]');

  // ---- 연도 ----
  await p.fill('#dateInput', (year - 1) + '-12-31');
  await p.click('.bill.b10000');
  check('작년으로 이동', (await t('#yearLabel')) === (year - 1) + '년');
  check('작년 받은 돈', (await t('#yearIn')) === '+10,000원');
  check('가진 돈은 전체 합', (await t('#balance')) === '119,500원', await t('#balance'));
  await p.click('#nextYear');

  // ---- 이름 수정/삭제 ----
  await p.click('#tags [data-act="edit"]');
  answers.push('친할머니');
  await p.click('#tags [data-rename="0"]');
  check('이름 수정 → 지난 기록도', (await p.locator('.row .who', { hasText: '친할머니' }).count()) === 1);
  await p.click('#tags [data-remove="0"]');
  await p.click('#tags [data-act="done"]');
  check('삭제해도 기록 유지', (await p.locator('#tags [data-tag="친할머니"]').count()) === 0 &&
    (await p.locator('.row .who', { hasText: '친할머니' }).count()) === 1);

  await p.reload();
  check('새로고침 후 유지', (await t('#balance')) === '119,500원' && (await t('.goalName')).includes('레고 성'));

  // ---- 옛 기록(type 없음) 호환 ----
  await p.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('hwr-allowance-v1'));
    a.push({ id: 'old1', date: new Date().getFullYear() + '-01-02', amount: 1000, giver: '아빠', createdAt: 1 });
    localStorage.setItem('hwr-allowance-v1', JSON.stringify(a));
  });
  await p.reload();
  check('옛 기록은 받은 돈', (await t('#balance')) === '120,500원', await t('#balance'));

  // ---- 백업 ----
  await p.click('.backup summary');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBtn')]);
  const file = await dl.path();
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  check('비운 뒤 0원', (await t('#balance')) === '0원');
  await p.click('.backup summary');
  await p.setInputFiles('#importInput', file);
  await p.waitForTimeout(300);
  check('백업 복원(기록)', (await t('#balance')) === '120,500원', await t('#balance'));
  check('백업 복원(목표)', (await t('.goalName')).includes('레고 성'));
  await p.click('.seg [data-mode="out"]');
  check('백업 복원(쓴 곳 목록)', (await p.locator('#tags [data-tag="포켓몬 카드"]').count()) === 1);

  await p.click('.seg [data-mode="in"]');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: process.env.SHOT || 'shot.png', fullPage: true });
  check('JS 에러 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n실패 ' + fail.length + '개' : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
