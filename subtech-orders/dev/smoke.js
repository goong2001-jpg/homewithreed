/**
 * 화면 스모크 테스트 (Playwright) —  node subtech-orders/dev/mock-page.js && node subtech-orders/dev/smoke.js
 * 폰 화면으로: 붙여넣기 → 나누기 → 저장 → 주문 목록 → 송장 엑셀 → 출하서 마감. PC 화면도 한 번 엶.
 * 스크린샷은 dev/out/*.png
 */
const { chromium, devices } = require('playwright');
const XLr = (() => { const m = { exports: {} }; new Function('module', require('fs').readFileSync(require('path').join(__dirname, '..', 'Xlsx.html'), 'utf8').replace(/<\/?script>/g, ''))(m); return m.exports; })();
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out');
// file:// 로 열면 내려받는 파일 이름이 안 붙어서(브라우저 보안), 잠깐 쓰는 로컬 서버로 엶
const server = require('http').createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(path.join(OUT, 'page.html'))); });
let URL = '';
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const PASTE = `[홍길동] [오전 11:06] 가나하우징

STT-1.3      60
H7     X        50
스티커있음

택배
[홍길동] [오전 11:08] 네 확인했습니다
[김영희] [오전 11:17] 다라코퍼레이션
STF-7S 1개
이몽룡
010-0000-8453
경상북도 상주시 가나마루1길 17-40 주택
부재 시 문 앞에 놓아주세요.
[김영희] [오전 11:20] 마바이엔지

SV11  외출  X    50

대신화물
[김영희] [오후 12:04] 사아상사 수출
SV7 O 1000개 명판있슴
다음주 목요일 직납합니다`;
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); URL = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Galaxy S9+'], acceptDownloads: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(URL); await page.waitForFunction(() => document.getElementById('st').textContent === '');
  // 테스트용 브라우저는 한글 파일 이름을 'download' 로만 알려줘서, 앱이 붙인 이름을 따로 적어 둠
  await page.evaluate(() => { window.NAMES = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) NAMES.push(this.download); return c.call(this); }; });
  ok((await page.textContent('#ver')).trim() === 'v1' || /^v\d+$/.test((await page.textContent('#ver')).trim()), '앱 열림, 버전 표시 (불일치 경고 없음)');
  await page.fill('#paste', PASTE); await page.click('[data-act=parse]');
  ok(await page.locator('#drafts .card').count() === 4, '붙여넣기 → 발주 4건으로 나눔 (잡담 1건 제외)');
  const d0 = await page.locator('#drafts .card').nth(0).innerText();
  ok(/가나하우징/.test(d0) && /대전광역시 대덕구 가나로 1062/.test(d0) && /주소록 주소/.test(d0) && /택배/.test(d0), '주소 없는 단골 → 주소록에서 주소 채움');
  const d1 = await page.locator('#drafts .card').nth(1).innerText();
  ok(/보내는분 다라코퍼레이션/.test(d1) && /지난번|배송방법 없음/.test(d1), '직송 건 → 보내는분=거래처, 배송방법 없으면 경고');
  await page.screenshot({ path: path.join(OUT, '1-drafts.png'), fullPage: true });
  // 2번째 주문 고치기: 택배(CJ) 선불
  await page.locator('#drafts .card').nth(1).click({ position: { x: 150, y: 20 } });
  await page.click('#sheet [data-act=car][data-i=CJ]'); await page.click('#sheet [data-act=pay][data-i=선불]');
  ok(await page.inputValue('#e-ship') === '택배선불', '배송 버튼 → 출하서 표기 자동 (택배선불)');
  await page.screenshot({ path: path.join(OUT, '2-edit.png') });
  await page.click('#sheet [data-act=edSave]');
  await page.click('[data-act=draftSave]'); await page.waitForFunction(() => S.orders.length === 4);
  ok(await page.evaluate(() => GAS.__tabs['주문'].length) === 5 && await page.inputValue('#paste') === '', '4건 저장 → 주문 탭에 4줄');
  await page.click('#nav [data-v=list]');
  ok(await page.locator('#orders .card').count() === 4 && (await page.textContent('#nWait')) === '4', '주문 목록 4건, 대기 숫자');
  await page.screenshot({ path: path.join(OUT, '3-list.png'), fullPage: true });
  // 송장
  await page.click('#nav [data-v=print]'); await page.waitForFunction(() => S.rec);
  await page.click('[data-act=pCar][data-i=CJ]');
  ok(await page.locator('#pList .card').count() === 2 && /추천/.test(await page.locator('#pList').innerText()), 'CJ 송장 2건 + 박스 추천');
  await page.screenshot({ path: path.join(OUT, '4-print.png'), fullPage: true });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=pXlsx]')]);
  const f = path.join(OUT, 'cj.xlsx'); await dl.saveAs(f);
  ok(/^CJ택배_\d{4}-\d{2}-\d{2}\.xlsx$/.test(await page.evaluate(() => NAMES[0])) && fs.statSync(f).size > 1500, 'CJ 엑셀 내려받음');
  await page.waitForFunction(() => S.orders.filter(o => o.printed).length === 2);
  ok(await page.locator('#pList .card').count() === 0 && await page.evaluate(() => GAS.__tabs['주문_송장기록'].length) >= 8, '뽑은 주문은 목록에서 빠지고 송장기록에 남음');
  // 출하서
  await page.click('#nav [data-v=close]'); await page.waitForFunction(() => document.querySelectorAll('#cList .card').length === 4);
  ok(await page.locator('#cList input:checked').count() === 2, '출하서: 오늘 송장 뽑은 2건이 미리 체크됨');
  await page.screenshot({ path: path.join(OUT, '5-close.png'), fullPage: true });
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=closeDay]')]);
  const f2 = path.join(OUT, 'chulha.xlsx'); await dl2.saveAs(f2);
  await page.waitForFunction(() => S.orders.filter(o => o.st === '출고완료').length === 2);
  ok(/^하루마감_\d{4}-\d{2}-\d{2}\.xlsx$/.test(await page.evaluate(() => NAMES[1])) && await page.evaluate(() => GAS.__tabs['주문_출하기록'].length) === 2, '마감 → 하루 파일 + 출하기록 1줄, 2건 출고완료·2건 대기');
  { const b = fs.readFileSync(f2), R = await XLr.read(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    ok(JSON.stringify(Object.keys(R)) === JSON.stringify(['출하서', 'CJ', '미출고']) && R['CJ'][0][0] === '보내는분성명' && R['CJ'].length === 3, '하루 파일 탭: 출하서 · CJ(2건) · 미출고'); }
  { const [dm] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=monthGet]')]); const fm = path.join(OUT, 'month.xlsx'); await dm.saveAs(fm);
    const b = fs.readFileSync(fm), R = await XLr.read(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ks = Object.keys(R);
    ok(ks[0] === '거래처별' && ks[1] === '품목별' && ks[2] === '출고목록' && /월 \d+일$/.test(ks[3]) && await page.evaluate(() => /월_출고현황\.xlsx$/.test(NAMES[2])), '월 파일: 거래처별·품목별·출고목록 + 날짜별 출하서'); }
  await page.waitForFunction(() => /출고 2건/.test(document.getElementById('rList').textContent));
  ok(true, '지난 출하서 목록에 표시');
  // v2: 오늘 송장 수량
  await page.click('#nav [data-v=print]');
  ok(/CJ 2건/.test(await page.textContent('#pToday')), '송장 화면 맨 위: 오늘 출력 CJ 2건');
  // v2: 일부 출고 + 어제 날짜
  await page.click('#nav [data-v=close]'); await page.waitForFunction(() => document.querySelectorAll('#cList [data-act=ship]').length === 2);
  await page.locator('#cList [data-act=ship]').first().click();
  const yday = await page.evaluate(() => addDay(S.today, -1));
  await page.click('#shB [data-act=sDate]:nth-child(2)');
  ok(await page.inputValue('#s-date') === yday, '출고 창: 어제 날짜 고르기');
  await page.fill('#shB .sq', '30');
  ok(await page.locator('#shB .sw').isVisible() && await page.locator('#s-rest').isVisible(), '수량을 줄이면 사유·잔량 칸이 나타남');
  await page.click('#shF [data-act=sSave]');
  ok(/사유/.test(await page.textContent('#toast')), '사유 없이 저장하면 막음');
  await page.selectOption('#shB .sw', '자재부족');
  await page.screenshot({ path: path.join(OUT, '7-ship.png') });
  await page.click('#shF [data-act=sSave]');
  await page.waitForFunction(() => S.orders.some(o => o.parent));
  const sh = await page.evaluate(() => { const r = S.orders.find(o => o.parent), p = S.orders.find(o => o.id === r.parent); return [p.st, p.shipped, p.items[0].qty, p.items[0].ord, r.items[0].qty, r.st]; });
  ok(sh[0] === '출고완료' && sh[1] === yday && sh[2] === 30 && sh[3] === 50 && sh[4] === 20 && sh[5] === '대기', '일부 출고: 30 출고(어제), 잔량 20 대기 주문 생김');
  // v3: 송장 카드에서 받는 곳·보내는분 고치기 (대신 주문)
  await page.click('#nav [data-v=print]'); await page.click('[data-act=pCar][data-i=대신]');
  await page.locator('#pList [data-act=pEdit]').first().click();
  await page.click('#sheet [data-act=snd][data-i=custom]');
  ok(await page.locator('#e-sender').isVisible() && await page.inputValue('#e-sender') === '', '보내는분 "직접 입력" → 빈 칸이 열림');
  await page.fill('#e-sender', '가나물산'); await page.fill('#e-senderPhone', '031-000-1111');
  await page.fill('#e-addr', '강원 원주시 가나로 1');
  ok(await page.locator('#e-saveAddr').isVisible(), '주소록에 없는 새 주소 → "주소록에 저장" 체크 칸');
  await page.check('#e-saveAddr');
  await page.screenshot({ path: path.join(OUT, '9-edit-ship.png') });
  await page.click('#sheet [data-act=edSave]');
  await page.waitForFunction(() => S.custs.some(c => c.addr === '강원 원주시 가나로 1'));
  ok(await page.evaluate(() => { const o = S.orders.find(x => x.carrier === '대신' && x.st === '대기'); return o.sender === '가나물산' && o.senderPhone === '031-000-1111'; }), '보내는분 직접 입력 저장 + 새 주소 주소록에 저장');
  ok(await page.evaluate(() => recentOf('마바이엔지').some(x => x.addr === '강원 원주시 가나로 1')), '방금 쓴 주소가 "최근 보낸 곳"에 들어감');
  // v2: 주문 목록 묶음 + 고르기 삭제 + 되살리기
  await page.click('#nav [data-v=list]');
  ok((await page.locator('#orders .grp').count()) >= 1 && /잔량/.test(await page.textContent('#orders')), '대기 목록: 예정일 묶음, 잔량 표시');
  await page.screenshot({ path: path.join(OUT, '8-list.png'), fullPage: true });
  const nBefore = await page.evaluate(() => S.orders.length);
  await page.click('[data-act=lPick]');
  await page.locator('#orders [data-chk]').first().check();
  await page.click('[data-act=lDel]');
  await page.waitForFunction(n => S.orders.length === n - 1, nBefore);
  ok(await page.evaluate(() => GAS.__tabs['주문_삭제기록'].length) === 2, '고르기 → 삭제 → 삭제기록에 보관');
  await page.click('#nav [data-v=more]'); await page.click('[data-act=delLoad]');
  await page.waitForSelector('[data-act=delRestore]'); await page.click('[data-act=delRestore]');
  await page.waitForFunction(n => S.orders.length === n, nBefore);
  ok(true, '더보기 → 삭제한 주문 되살리기');
  await page.fill('#cq', '가나');
  ok(await page.locator('#custs .card').count() >= 1, '주소록 검색');
  ok(await page.evaluate(() => JSON.stringify(GAS.__tabs['거래로그'])) === '[["일시","품목ID"]]', '거래로그는 그대로');
  ok(errs.length === 0, '화면 오류 없음' + (errs.length ? ': ' + errs.join(' | ') : ''));
  // PC 화면
  const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await pc.goto(URL); await pc.waitForFunction(() => document.getElementById('st').textContent === '');
  await pc.fill('#paste', PASTE); await pc.click('[data-act=parse]'); await pc.screenshot({ path: path.join(OUT, '6-pc.png') });
  ok(await pc.locator('#drafts .card').count() === 4, 'PC 화면에서도 동작');
  await browser.close(); server.close();
  console.log(fail ? `\n실패 ${fail}개` : '\n모두 통과'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
