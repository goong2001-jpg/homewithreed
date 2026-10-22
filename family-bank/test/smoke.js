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
  const pin = async v => { await p.fill('#pinInput', v); await p.click('#pinOk'); await p.waitForTimeout(250); };   // 해시 계산은 비동기
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('hwr-bank-v1')));

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
  const st = await stored();
  check('비밀번호는 해시로만 저장', st.pin === undefined && /^[0-9a-f]{64}$/.test(st.pinHash) && /^[0-9a-f]{32}$/.test(st.pinSalt), JSON.stringify([st.pin, st.pinHash, st.pinSalt]));
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
  await p.evaluate(() => {   // 버전 2 기본 이름으로 저장돼 있던 기기 + 버전 4까지 그대로 저장돼 있던 비밀번호
    const s = JSON.parse(localStorage.getItem('hwr-bank-v1'));
    s.kids[0].name = '구름'; s.kids[1].name = '열매';
    s.pin = '1234'; delete s.pinHash; delete s.pinSalt;
    localStorage.setItem('hwr-bank-v1', JSON.stringify(s));
  });
  await p.reload();
  await p.waitForTimeout(300);
  const mig = await stored();
  check('옛 비밀번호 → 해시로 옮김', mig.pin === undefined && /^[0-9a-f]{64}$/.test(mig.pinHash), JSON.stringify([mig.pin, mig.pinHash]));
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

  // ---- 백업: 비밀번호는 빠지고, 불러오기는 합치기(확인)/바꾸기 ----
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportBtn')]);
  const bkFile = await dl.path();
  const bk = JSON.parse(require('fs').readFileSync(bkFile, 'utf8'));
  check('백업에 비밀번호 없음', !('pin' in bk.state) && !('pinHash' in bk.state) && !('pinSalt' in bk.state), Object.keys(bk.state).join(','));
  const balBefore = await t('#balance');
  await p.setInputFiles('#importInput', bkFile);   // confirm 은 모두 확인 → 합치기
  await p.waitForTimeout(500);
  check('합치기: 같은 기록은 한 번만', (await t('#balance')) === balBefore && dialogs.some(m => m.includes('합칠까요')), (await t('#balance')) + ' vs ' + balBefore);
  check('합친 뒤에도 비밀번호 유지', (await stored()).pinHash === mig.pinHash);

  // ---- 통장 내역 고치기 (엄마아빠 모드): 호윤 세뱃돈의 날짜·금액·메모 ----
  const lbl = d => (d.slice(0, 4) !== ds(now).slice(0, 4) ? d.slice(2, 4) + '.' : '') + (+d.slice(5, 7)) + '.' + (+d.slice(8, 10));
  await p.click('#kids [data-kid="1"]');
  check('호윤 잔액', (await t('#balance')) === expect.toLocaleString('ko-KR') + '원', await t('#balance'));
  await p.click('.lrow >> nth=0');
  check('고치기 창', (await p.isVisible('#editSheet')) && (await t('#editTitle')) === '기록 고치기' && (await p.isVisible('#editSave')));
  check('창에 날짜·금액', (await p.inputValue('#editDate')) === ds(m2) && (await p.inputValue('#editAmount')) === '1,000,000',
    (await p.inputValue('#editDate')) + ' ' + (await p.inputValue('#editAmount')));
  const d2 = ds(new Date(m2.getFullYear(), m2.getMonth(), 2));
  await p.fill('#editDate', d2);
  await p.fill('#editAmount', '100만500');
  await p.fill('#editNote', '세뱃돈 고침');
  let nDlg = dialogs.length;
  await p.click('#editSave');
  check('이자 준 달이면 한 번 묻기', dialogs.slice(nDlg).some(m => m.includes('이미 이자를 준 달')), dialogs.slice(nDlg).join(' / '));
  check('고친 뒤 창 닫힘', !(await p.isVisible('#editSheet')));
  const row0 = await p.locator('.lrow').first().textContent();
  check('고친 날짜·금액·메모 반영', row0.startsWith(lbl(d2)) && row0.includes('1,000,500') && row0.includes('세뱃돈 고침'), row0);
  check('잔액 +500', (await t('#balance')) === (expect + 500).toLocaleString('ko-KR') + '원', await t('#balance'));
  const edited = (await stored()).kids[1].tx.filter(x => x.id === 'x1')[0];
  check('id 그대로, 저장된 날짜', edited && edited.date === d2 && edited.amount === 1000500, JSON.stringify(edited));
  check('이자는 다시 계산하지 않음', (await p.locator('.lrow.interest').count()) === 2);

  // ---- 지난 날짜로 맡기기: 지난달 1일에 1,000원 → 이자 줄 뒤, 같은 날짜 순서로 ----
  await p.click('#modeSeg [data-mode="in"]');
  check('맡긴 날짜 기본 오늘', (await p.inputValue('#dateInput')) === ds(now), await p.inputValue('#dateInput'));
  await p.fill('#dateInput', ds(m1));
  nDlg = dialogs.length;
  await p.click('.bill.b1000');
  check('지난 달이면 한 번 묻기', dialogs.slice(nDlg).some(m => m.includes('이미 이자를 준 달')));
  check('잔액 +1,000', (await t('#balance')) === (expect + 1500).toLocaleString('ko-KR') + '원', await t('#balance'));
  const allRows = await p.locator('.lrow').allTextContents();
  check('지난 날짜 줄이 제자리에', allRows.length === 6 && allRows[3].startsWith(lbl(ds(m1))) && allRows[3].includes('1,000') && allRows[1].includes('월 이자'), allRows.join(' | '));
  check('토스트에 날짜', (await t('#toastText')).includes('날짜로'), await t('#toastText'));
  const past = (await stored()).kids[1].tx.filter(x => x.type === 'in' && x.amount === 1000)[0];
  check('저장된 날짜 = 지난달 1일', past && past.date === ds(m1), JSON.stringify(past));

  // ---- 화면 ----
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check('가로 스크롤 없음', sw <= 390, String(sw));
  await p.click('#lockBtn');
  await p.click('#kids [data-kid="1"]');
  // 아이 모드에서는 내역을 보기만 한다
  await p.click('.lrow >> nth=0');
  check('아이 모드는 보기만', (await p.isVisible('#editSheet')) && (await t('#editTitle')) === '통장 내역' && !(await p.isVisible('#editSave')) && (await p.locator('#editAmount').isDisabled()));
  await p.click('#editClose');
  check('보기 창 닫힘', !(await p.isVisible('#editSheet')));
  await p.screenshot({ path: 'test/shot.png', fullPage: true });
  // 하율 화면 + 이자 축하 창
  await p.click('#kids [data-kid="0"]');
  await p.screenshot({ path: 'test/shot-kid.png' });
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('hwr-bank-v1')); s.kids[0].gift = 37; localStorage.setItem('hwr-bank-v1', JSON.stringify(s)); });
  await p.reload();
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'test/shot-gift.png' });

  // ---- 출금 신청 알림: 설정이 있으면 /bank/notify 를 부르고, 없으면 안 부른다 ----
  // 새 컨텍스트(빈 통장)에서. 서비스워커는 같은 사이트 GET 만 다루므로 다른 사이트로 가는 POST 는 route 가 그대로 본다.
  // (serviceWorkers: 'block' 을 주면 navigator.serviceWorker.ready 가 영영 안 풀려서 켜기 흐름이 멈춘다)
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx2.grantPermissions(['notifications']);   // 권한은 주되, 헤드리스엔 푸시 서비스가 없어서 구독에서 실패한다
  const q = await ctx2.newPage();
  const notifies = [], dialogs2 = [];
  q.on('pageerror', e => errors.push(String(e)));
  q.on('dialog', d => { dialogs2.push(d.message()); d.accept(); });
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  await q.route('https://push.example/**', route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (req.url().endsWith('/bank/notify')) {
      notifies.push(JSON.parse(req.postData()));
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"sent":1,"parents":1}' });
    }
    if (req.url().endsWith('/health')) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{"ok":true,"configured":true,"vapidPublicKey":"BAAA"}' });
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{}' });
  });
  const qpin = async v => { await q.fill('#pinInput', v); await q.click('#pinOk'); await q.waitForTimeout(250); };
  const qstored = () => q.evaluate(() => JSON.parse(localStorage.getItem('hwr-bank-v1')));
  await q.goto(BASE + '/index.html');
  await q.click('.bill.b10000');
  await q.click('#modeSeg [data-mode="out"]');
  await q.click('.bill.b5000');
  await q.waitForTimeout(400);
  check('알림 설정 없으면 요청 안 함', notifies.length === 0 && (await q.locator('.req').count()) === 1);
  await q.click('#lockBtn');
  await qpin('1234');
  await qpin('1234');
  await q.fill('#pushEndpoint', 'https://push.example/');
  await q.fill('#pushPass', 'secret');
  await q.click('#saveSettings');
  const pc = (await qstored()).push;
  check('서버 주소·암호 저장 (끝 / 정리)', pc && pc.endpoint === 'https://push.example' && pc.passphrase === 'secret' && !pc.enabled, JSON.stringify(pc));
  await q.click('#lockBtn');   // 아이 모드로
  await q.fill('#noteInput', '포켓몬 카드');
  await q.click('.bill.b1000');
  await q.waitForTimeout(600);
  check('찾기 신청 → /bank/notify 한 번', notifies.length === 1, JSON.stringify(notifies));
  const n = notifies[0] || {};
  check('알림 내용', n.passphrase === 'secret' && n.title === '엄마아빠 은행' && n.body === '하율이가 1,000원 찾기 신청했어요 (포켓몬 카드)' &&
    n.url === BASE + '/index.html' && /^hwr-bank-req-/.test(n.tag), JSON.stringify(n));
  check('알림 보냄 토스트', (await q.isVisible('#pushToast')) && (await q.textContent('#pushToast')) === '엄마아빠 폰에 알림 보냄');
  check('되돌리기 토스트는 그대로', (await q.textContent('#toastText')).includes('찾기 신청했어요'));
  await q.click('#lockBtn');
  await qpin('1234');
  const [dl2] = await Promise.all([q.waitForEvent('download'), q.click('#exportBtn')]);
  const bk2 = JSON.parse(require('fs').readFileSync(await dl2.path(), 'utf8'));
  check('백업에 알림 암호 없음 (주소만)', bk2.state.push && bk2.state.push.endpoint === 'https://push.example' && !('passphrase' in bk2.state.push) && !('deviceId' in bk2.state.push), JSON.stringify(bk2.state.push));
  // 헤드리스에는 푸시 서비스가 없다 → 켜기는 한국어 안내와 함께 실패하고 스위치는 꺼진 채로
  const nd2 = dialogs2.length;
  await q.click('#pushParent');
  await q.waitForTimeout(2000);
  check('켜기 실패는 한국어 안내', dialogs2.length > nd2 && /[가-힣]/.test(dialogs2[dialogs2.length - 1]) && !/[A-Za-z]{4,}/.test(dialogs2[dialogs2.length - 1]), dialogs2.slice(nd2).join(' / '));
  check('실패하면 스위치 꺼짐', !(await q.isChecked('#pushParent')) && !(await qstored()).push.enabled);
  await ctx2.close();

  check('스크립트 오류 없음', errors.length === 0, errors.join(' / '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + '개 실패' : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
