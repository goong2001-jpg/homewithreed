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
  // v4: 옵션 줄 펼치기 · 물어보기 · 품목명 학습
  await page.click('#nav [data-v=new]');
  const Y = '[김영희] [오후 1:00] 다라코퍼레이션\nH300WF\n색상:화이트,종류:조절기+온도센서+진동모듈 2개\n홍길동\n010-0000-1172\n경기도 안산시 상록구 가나물길 26-5\n물건 프론트 안쪽으로 넣어주시고 던지지마세요';
  await page.fill('#paste', Y); await page.click('[data-act=parse]');
  const dtxt = await page.locator('#drafts .card').first().innerText();
  ok(/H300WF\s+X\s+2/.test(dtxt) && /온도센서\s+2/.test(dtxt) && /진동모듈/.test(dtxt), '와이코식 옵션 줄 → H300WF 2 · 온도센서 2 로 나눔');
  ok(await page.evaluate(() => S.drafts[0].msg) === '물건 프론트 안쪽으로 넣어주시고 던지지마세요', '배송 요청 → 배송 메시지');
  await page.screenshot({ path: path.join(OUT, '10-ask.png'), fullPage: true });
  await page.click('[data-act=askOpt][data-to=item]');
  await page.waitForFunction(() => S.learn.some(x => x.from === '진동모듈' && x.to === 'item'));
  ok(await page.evaluate(() => S.drafts[0].items.map(i => i.name).join(',')) === 'H300WF,온도센서,진동모듈', '물어보기 "따로 품목으로" → 품목 줄 추가 + 기억');
  await page.locator('#drafts .card').first().click({ position: { x: 150, y: 20 } });
  await page.locator('#e-items .itrow').nth(1).locator('.nm').fill('몰딩센서 2M');
  await page.click('#sheet [data-act=edSave]');
  await page.waitForFunction(() => S.learn.some(x => x.kind === 'name' && x.from === '온도센서' && x.to === '몰딩센서 2M'));
  ok(true, '나눈 결과에서 품목명을 고치면 거래처별로 기억 (온도센서 → 몰딩센서 2M)');
  await page.click('[data-act=draftClear]');
  await page.fill('#paste', Y.replace('진동모듈', '진동모듈')); await page.click('[data-act=parse]');
  ok(await page.evaluate(() => S.drafts[0].items.map(i => i.name).join(',')) === 'H300WF,몰딩센서 2M,진동모듈' && await page.locator('[data-act=askOpt]').count() === 0, '다시 붙여넣으면 기억한 대로 자동 (물어보기 없음)');
  await page.click('[data-act=draftClear]');
  await page.click('#nav [data-v=more]'); await page.click('[data-act=lrnShow]');
  ok(await page.locator('#lrnList [data-act=lrnDel]').count() === 2, '더보기 → 학습 목록 2건');
  await page.locator('#lrnList [data-act=lrnDel]').first().click();
  await page.waitForFunction(() => S.learn.length === 1);
  ok(true, '학습 지우기');
  await page.fill('#cq', '가나');
  ok(await page.locator('#custs .card').count() >= 1, '주소록 검색');
  ok(await page.evaluate(() => JSON.stringify(GAS.__tabs['거래로그'])) === '[["일시","품목ID"]]', '거래로그는 그대로');
  ok(errs.length === 0, '화면 오류 없음' + (errs.length ? ': ' + errs.join(' | ') : ''));
  // v5: 사무실 화면에 생산 표시 + 출하서 미리 체크는 송장부착된 것
  { const wid = await page.evaluate(() => S.orders.find(o => o.st === '대기').id);
    await page.evaluate(id => new Promise(r => call('lineMark', { id, what: 'tagged', on: true, by: '홍길동' }, () => call('boot', {}, x => { S.orders = x.orders; render(); r(); }))), wid);
    await page.click('#nav [data-v=list]');
    ok(/준비완료 ✓/.test(await page.textContent('#orders')) && /(송장부착|출고준비) ✓/.test(await page.textContent('#orders')), '사무실 주문 목록에 준비완료·송장부착 표시');
    await page.click('#nav [data-v=close]'); await page.waitForFunction(() => document.querySelectorAll('#cList .card').length > 0);
    ok(await page.evaluate(id => { const lu = closeLineUsed(), d = $('cDate').value; return S.orders.filter(o => o.st === '대기' && closeChecked(o, d, lu)).map(o => o.id).join() === id; }, wid) && await page.locator('#cList input:checked').count() === 1, '출하서: 송장부착된 주문만 미리 체크 (먼저 열어 봤어도 반영)'); }
  // v5: 생산 화면 (?view=line)
  { const lp = await ctx.newPage(); const lerr = []; lp.on('pageerror', e => lerr.push(e.message));
    lp.on('dialog', d => d.type() === 'prompt' ? d.accept('홍길동') : d.accept());
    await lp.goto(URL + '?view=line'); await lp.waitForFunction(() => S.role === 'line' && document.getElementById('lnSt').textContent === '');
    await lp.evaluate(() => new Promise(r => call('saveOrders', { orders: [
      { cust: '가나보일러', items: [{ name: 'SV7', sensor: 'X', qty: 50, unit: '', note: '스티커 있음' }, { name: '파워코드 2C', sensor: '', qty: 50, unit: '개', note: '' }], carrier: 'CJ', ship: '택배선불', due: S.today, recv: '김비밀', phone: '010-9999-0000', addr: '서울 비밀구 비밀로 1', memo: '명판있음' },
      { cust: '다라난방', items: [{ name: 'H10 7단계', sensor: 'X', qty: 30, unit: '', note: '' }], carrier: '직납', ship: '직납', due: S.today },
      { cust: '마바전기', items: [{ name: 'SV7', sensor: 'X', qty: 20, unit: '', note: '' }], carrier: '경동', ship: '경동택배선불', due: addDay(S.today, 1) },
      { cust: '사아상사', items: [{ name: 'STT-1.3', sensor: '', qty: 60, unit: '', note: '' }], carrier: 'CJ', ship: '택배선불', due: S.today, printed: S.today + ' 10:00:00', box: [{ k: '대', b: 2 }, { k: '중', b: 1 }] },
      { cust: '자차온돌', items: [{ name: 'H7', sensor: 'X', qty: 10, unit: '', note: '' }], carrier: '경동', ship: '경동택배선불', due: S.today }] }, () => { lineLoad(true); r(); })));
    await lp.waitForFunction(() => document.querySelectorAll('#lnBody .lncard').length === 4);
    { const cnt = await lp.locator('.lncnt').innerText(), first = await lp.evaluate(() => document.querySelector('#lnBody').firstElementChild.nextElementSibling.className);
      ok(/CJ 택배\s*3박스 \+ 1건\s*1건 송장 출력 전/.test(cnt) && /경동\s*1건\s*송장 출력 전/.test(cnt) && /대신\s*0/.test(cnt) && /직납\s*1건/.test(cnt) && first === 'lncnt', '맨 위 운송별: CJ 3박스(출력분) + 1건(출력 전) · 경동 1건 · 대신 0 · 직납 1건');
      ok(await lp.locator('.lncard.car-cj').count() === 2 && await lp.locator('.lncard.car-kd').count() === 1 && await lp.locator('.lncard.car-jn').count() === 1 && /경동/.test(await lp.locator('.lncard.car-kd .cbadge').textContent()), '카드마다 운송사 색 배지 (CJ 파랑·경동 빨강·직납 갈색)');
      await lp.click('.lncnt .car-kd'); ok(await lp.locator('.lncard').count() === 1 && /경동만 보는 중/.test(await lp.textContent('#lnBody')), '위 경동 칸을 누르면 경동 주문만');
      await lp.screenshot({ path: path.join(OUT, '12-line-color.png') });
      await lp.click('[data-act=lnCar][data-i=""]'); ok(await lp.locator('.lncard').count() === 4, '전체 보기');
      ok(await lp.evaluate(() => { const b = document.getElementById('lnBody'), sum = b.querySelector('.lnsum'), cards = b.querySelectorAll('.lncard'); return !!(cards[cards.length - 1].compareDocumentPosition(sum) & Node.DOCUMENT_POSITION_FOLLOWING); }), '"오늘 아직 만들 것"은 카드 아래에'); }
    const body = await lp.textContent('#lnBody');
    ok(await lp.locator('#app').isHidden() && /오늘 아직 만들 것/.test(body) && /SV7 X/.test(body) && /50/.test(body), '생산 화면: 사무실 메뉴 없이 오늘 출고 4건 + 아직 만들 양');
    ok(!/김비밀|010-9999|비밀구/.test(await lp.content()), '받는분·전화·주소는 화면 어디에도 없음');
    ok(await lp.locator('.lncard').nth(1).locator('[data-w=tagged]').textContent() === '출고준비' || /출고준비/.test(body), '직납은 "출고준비" 버튼');
    await lp.locator('.lncard').first().locator('[data-w=ready]').click();
    await lp.waitForFunction(() => LN.orders.some(o => o.ready && o.readyBy === '홍길동'));
    ok(true, '준비완료 (처음 한 번 이름 묻고 기억)');
    await lp.screenshot({ path: path.join(OUT, '11-line.png'), fullPage: true });
    const firstCust = await lp.locator('.lncard').first().locator('.cu').textContent();
    await lp.locator('.lncard').filter({ hasText: '가나보일러' }).locator('[data-w=tagged]').click();
    await lp.waitForFunction(() => LN.orders.some(o => o.cust === '가나보일러' && o.tagged));
    ok(await lp.locator('.lncard').last().locator('.cu').textContent() === '가나보일러' && await lp.locator('.lncard.s2').count() === 1, '송장부착한 주문은 흐리게 맨 아래로');
    await lp.click('.lnnav [data-i=next]'); ok(/내일/.test(await lp.textContent('#lnBody')) && /마바전기/.test(await lp.textContent('#lnBody')), '다음 탭: 내일 출고');
    await lp.click('.lnnav [data-i=sum]'); ok(/전체 대기 중 아직 만들 것/.test(await lp.textContent('#lnBody')), '만들 양 탭');
    await lp.click('.lnnav [data-i=today]');
    await lp.locator('.lncard').filter({ hasText: '가나보일러' }).locator('[data-w=ready]').click();
    await lp.waitForFunction(() => LN.orders.some(o => o.cust === '가나보일러' && !o.ready && !o.tagged));
    ok(true, '준비완료 취소 → 송장부착도 같이 취소');
    ok(lerr.length === 0, '생산 화면 오류 없음' + (lerr.length ? ': ' + lerr.join(' | ') : ''));
    await lp.close(); }
  // PC 화면
  const pc = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await pc.goto(URL); await pc.waitForFunction(() => document.getElementById('st').textContent === '');
  await pc.fill('#paste', PASTE); await pc.click('[data-act=parse]'); await pc.screenshot({ path: path.join(OUT, '6-pc.png') });
  ok(await pc.locator('#drafts .card').count() === 4, 'PC 화면에서도 동작');
  await browser.close(); server.close();
  console.log(fail ? `\n실패 ${fail}개` : '\n모두 통과'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
