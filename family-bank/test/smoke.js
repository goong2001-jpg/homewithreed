// 실행: (family-bank 폴더에서) python3 -m http.server 8139 &  →  node test/smoke.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:8139';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }
const pad = n => (n < 10 ? '0' : '') + n;
const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  const dialogs = [];
  const answers = [];
  p.on('dialog', d => { dialogs.push(d.message()); return d.type() === 'prompt' && answers.length ? d.accept(answers.shift()) : d.accept(); });
  await p.goto(BASE + '/index.html');
  const t = sel => p.textContent(sel);
  const pin = async v => { await p.fill('#pinInput', v); await p.click('#pinOk'); };

  // ---- 처음 ----
  check('처음엔 0원', (await t('#balance')) === '0원');
  check('아이 둘', (await p.locator('#kids button').count()) === 2);
  check('연 3.5% 기본', (await t('#rate')) === '연 3.5%', await t('#rate'));
  check('설정은 잠겨 있음', !(await p.isVisible('#admin')));

  // ---- 맡기기: 이어 누르면 한 줄 ----
  await p.click('#tags [data-tag="할머니"]');
  await p.click('.bill.b50000');
  await p.click('.bill.b50000');
  check('5만×2 → 한 줄', (await p.locator('.lrow').count()) === 1);
  check('잔액 100,000원', (await t('#balance')) === '100,000원', await t('#balance'));
  check('내역에 준 사람', (await t('.lrow .memo')) === '할머니');
  await p.click('#undoBtn');
  check('되돌리기 → 0원', (await t('#balance')) === '0원');
  await p.fill('#noteInput', '생일 선물');
  await p.click('.bill.b50000');
  check('다시 50,000원', (await t('#balance')) === '50,000원');
  check('이유가 내역에', (await p.locator('.lrow .memo').last().textContent()) === '생일 선물');
  check('이유 칸 비워짐', (await p.inputValue('#noteInput')) === '');

  // ---- 찾기 신청 ----
  await p.click('#modeSeg [data-mode="out"]');
  await p.click('#tags [data-tag="과자·간식"]');
  await p.fill('#noteInput', '친구랑 아이스크림');
  await p.click('.bill.b10000');
  check('찾기 이유 표시', (await t('.reqInfo span')).includes('과자·간식 · 친구랑 아이스크림'), await t('.reqInfo span'));
  check('신청만 되고 잔액 그대로', (await t('#balance')) === '50,000원');
  check('승인 대기 보임', await p.isVisible('#pendingCard'));
  check('탭에 배지', (await t('#kids .badge')) === '1');
  await p.waitForTimeout(5300);   // 합치기 시간 지나기
  await p.click('.bill.b50000');
  check('잔액보다 많으면 막음', dialogs.some(m => m.includes('찾을 수 없어요')) && (await p.locator('.req').count()) === 1);

  // ---- 승인: 처음엔 비밀번호를 정한다 ----
  await p.click('[data-approve]');
  check('비밀번호 정하기 창', (await t('#pinTitle')) === '새 비밀번호 정하기');
  await pin('12');
  check('짧으면 다시', (await t('#pinMsg')).includes('4~8자리'));
  await pin('1234');
  await pin('1234');
  check('승인 → 40,000원', (await t('#balance')) === '40,000원', await t('#balance'));
  check('대기 사라짐', !(await p.isVisible('#pendingCard')));
  check('엄마아빠 설정 보임', await p.isVisible('#admin'));
  check('내역 찾으신 돈', (await p.locator('.lrow').nth(1).textContent()).includes('10,000'));

  // ---- 잠그고 거절은 비밀번호 확인 ----
  await p.click('#lockBtn');
  check('잠그면 설정 숨김', !(await p.isVisible('#admin')));
  await p.click('.bill.b5000');
  await p.click('[data-reject]');
  await pin('9999');
  check('틀린 비밀번호', (await t('#pinMsg')).includes('달라요'));
  await pin('1234');
  check('거절 → 잔액 그대로', (await t('#balance')) === '40,000원' && !(await p.isVisible('#pendingCard')));

  // ---- 갖고 싶은 것 ----
  answers.push('레고', '5만');
  await p.click('[data-goal="set"]');
  check('목표 80%', (await t('.jar span')) === '80%', await t('.jar span'));
  check('남은 돈', (await t('.goalMsg')).includes('10,000원 더'), await t('.goalMsg'));
  await p.click('#modeSeg [data-mode="in"]');
  await p.click('.bill.b10000');
  check('다 모음', (await t('.goalMsg')).includes('다 모았어요'));
  await p.click('[data-goal="buy"]');
  check('목표로 찾기 신청', (await t('.reqInfo span')).includes('레고 사려고'), await t('.reqInfo span'));
  await p.click('[data-reject]');
  await p.click('#lockBtn');

  // ---- 호윤 통장은 따로 ----
  await p.click('#kids [data-kid="1"]');
  check('호윤은 0원', (await t('#balance')) === '0원');
  check('호윤 통장 이름', (await t('#bookName')) === '호윤 입출금통장');
  check('하율 탭', (await p.locator('#kids button').first().textContent()).startsWith('하율'));

  // ---- 이자: 두 달 전 1일에 100만원 맡긴 상태를 넣고 다시 연다 ----
  const now = new Date();
  const m2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const m1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const m3 = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const days2 = new Date(m2.getFullYear(), m2.getMonth() + 1, 0).getDate();
  const days1 = new Date(m1.getFullYear(), m1.getMonth() + 1, 0).getDate();
  const i2 = Math.floor(1000000 * days2 * 0.035 / 365);
  // 둘째 달 이자는 첫 달 이자에서 세금을 뗀 잔액에 붙는다
  const i1 = Math.floor((1000000 + i2 - Math.floor(i2 * 0.154)) * days1 * 0.035 / 365);
  await p.evaluate(([opened, settled]) => {
    const s = JSON.parse(localStorage.getItem('hwr-bank-v1'));
    s.kids[1].opened = opened;
    s.kids[1].settled = settled;
    s.kids[1].tx = [{ id: 'x1', date: opened, type: 'in', amount: 1000000, memo: '세뱃돈', createdAt: 1 }];
    s.tax = true;
    localStorage.setItem('hwr-bank-v1', JSON.stringify(s));
  }, [ds(m2), ds(m3).slice(0, 7)]);
  await p.evaluate(() => {   // 버전 2 기본 이름으로 저장돼 있던 기기
    const s = JSON.parse(localStorage.getItem('hwr-bank-v1'));
    s.kids[0].name = '구름'; s.kids[1].name = '열매';
    localStorage.setItem('hwr-bank-v1', JSON.stringify(s));
  });
  await p.reload();
  check('옛 기본 이름 → 하율·호윤', (await p.locator('#kids button').allTextContents()).join(',') === '하율,호윤');
  await p.click('#kids [data-kid="1"]');
  check('이자 축하 창', await p.isVisible('#giftSheet'));
  check('축하 금액 = 세금 뗀 이자', (await t('#giftAmount')) === '+' + (i2 - Math.floor(i2 * 0.154) + i1 - Math.floor(i1 * 0.154)).toLocaleString('ko-KR') + '원', await t('#giftAmount'));
  await p.click('#giftOk');
  check('호윤이에게', (await t('#giftTitle')) === '은행이 호윤이에게 이자를 줬어요!', await t('#giftTitle'));
  check('축하 닫힘', !(await p.isVisible('#giftSheet')));
  const rows = await p.locator('.lrow.interest').allTextContents();
  check('두 달치 이자 줄', rows.length === 2, rows.join(' | '));
  check('첫 달 이자 금액', rows[0] && rows[0].includes(i2.toLocaleString('ko-KR')), i2 + ' / ' + rows[0]);
  check('세금 줄', (await p.locator('.lrow.tax').count()) === 2);
  const tax2 = Math.floor(i2 * 0.154), tax1 = Math.floor(i1 * 0.154);
  const expect = (1000000 + i2 - tax2 + i1 - tax1);
  check('이자·세금 반영 잔액', (await t('#balance')) === expect.toLocaleString('ko-KR') + '원', await t('#balance') + ' vs ' + expect);
  await p.reload();
  await p.click('#kids [data-kid="1"]');
  check('축하는 한 번만', !(await p.isVisible('#giftSheet')));
  check('다시 열어도 이자 두 번 안 줌', (await p.locator('.lrow.interest').count()) === 2);
  check('이번 달 쌓이는 이자 표시', /원$/.test(await t('#accrued')) && (await t('#accrued')) !== '0.0원', await t('#accrued'));

  // ---- 물가 비교 카드 ----
  check('물가 카드 기본 숨김', !(await p.isVisible('#inflation')));
  await p.click('#lockBtn');
  await pin('1234');
  await p.check('#inflInput');
  await p.click('#saveSettings');
  check('물가 카드 보임', await p.isVisible('#inflation'));
  check('세금 떼면 물가를 겨우 따라감', (await t('.cmpMsg')).includes('겨우'), await t('.cmpMsg'));

  // ---- 용돈기입장 잔액 옮기기 ----
  await p.click('#kids [data-kid="0"]');
  await p.evaluate(() => localStorage.setItem('hwr-allowance-v1', JSON.stringify([
    { id: 'a', date: '2026-01-01', amount: 30000 }, { id: 'b', date: '2026-02-01', amount: 5000, type: 'out' }])));
  await p.click('#importAllowance');
  check('25,000원 옮김', (await t('#balance')) === '75,000원', await t('#balance'));

  // ---- 이자율 바꾸기 ----
  await p.fill('#rateInput', '0.1');
  await p.click('#saveSettings');
  check('이자율 0.1%', (await t('#rate')) === '연 0.1%', await t('#rate'));

  // ---- 화면 ----
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check('가로 스크롤 없음', sw <= 390, String(sw));
  await p.click('#lockBtn');
  await p.click('#kids [data-kid="1"]');
  await p.screenshot({ path: 'test/shot.png', fullPage: true });
  // 하율 화면 + 이자 축하 창
  await p.click('#kids [data-kid="0"]');
  await p.screenshot({ path: 'test/shot-kid.png' });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('hwr-bank-v1')); s.kids[0].gift = 37; localStorage.setItem('hwr-bank-v1', JSON.stringify(s)); });
  await p.reload();
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'test/shot-gift.png' });

  check('스크립트 오류 없음', errors.length === 0, errors.join(' / '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + '개 실패' : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
