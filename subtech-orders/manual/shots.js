/**
 * 설명서용 화면 캡처 —  node subtech-orders/dev/mock-page.js && node subtech-orders/manual/shots.js
 * 가짜 시트(지어낸 거래처·주소) 위에서 앱을 열어 manual/img/*.png 로 저장. 그다음 node subtech-orders/manual/build.js
 */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const IMG = path.join(__dirname, 'img'), PAGE = path.join(__dirname, '..', 'dev', 'out', 'page.html');
const server = require('http').createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(PAGE)); });
const PASTE = `[홍길동] [오전 11:06] 가나하우징

STT-1.3      30
STT-2.6DE    60

택배
[김영희] [오전 11:17] 다라코퍼레이션
STF-7S 1개
이몽룡
010-0000-8453
경상북도 상주시 가나마루1길 17-40
부재 시 문 앞에 놓아주세요.
[김영희] [오전 11:20] 마바이엔지

SV11  외출  X    50

차량출고`;
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const URL = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#toast{display:none!important}'; document.head.appendChild(st); }));
  const page = await ctx.newPage(); page.on('dialog', d => d.accept());
  const shot = (n, o) => page.screenshot(Object.assign({ path: path.join(IMG, n + '.png') }, o || {}));
  await page.goto(URL); await page.waitForFunction(() => document.getElementById('st').textContent === '');
  await page.fill('#paste', PASTE); await shot('o1-paste');
  await page.click('[data-act=parse]'); await page.locator('#drafts .card').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -70)); await shot('o2-drafts');
  await page.locator('#drafts .card').nth(2).click({ position: { x: 150, y: 20 } }); await page.waitForTimeout(300);
  await page.locator('#sheet [data-act=car]').first().scrollIntoViewIfNeeded(); await shot('o3-edit');
  await page.click('#sheet [data-act=edSave]');
  await page.click('[data-act=draftSave]'); await page.waitForFunction(() => S.orders.length === 3);
  await page.click('#nav [data-v=list]'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('o4-list');
  await page.click('#nav [data-v=print]'); await page.waitForFunction(() => S.rec); await page.click('[data-act=pCar][data-i=CJ]'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('o5-print');
  // 생산 화면에서 준비·부착 (같은 가짜 시트를 쓰도록 이 페이지 안에서 lineMark 호출)
  await page.evaluate(() => new Promise(r => { const o = S.orders.find(x => x.cust.indexOf('가나하우징') >= 0); call('lineMark', { id: o.id, what: 'tagged', on: true, by: '홍길동' }, () => call('boot', {}, x => { S.orders = x.orders; render(); r(); })); }));
  await page.click('#nav [data-v=close]'); await page.waitForFunction(() => document.querySelectorAll('#cList .card').length > 0);
  await page.click('[data-act=cQuick][data-i=tag]'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('o6-close');
  await page.locator('#cList [data-act=ship]').first().click(); await page.waitForTimeout(300); await shot('o7-ship');
  await page.keyboard.press('Escape'); await page.goto(URL); await page.waitForFunction(() => document.getElementById('st').textContent === '');
  await page.click('#nav [data-v=more]'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('o8-more');

  // 생산 화면
  const lp = await ctx.newPage(); lp.on('dialog', d => d.type() === 'prompt' ? d.accept(/준비된 수량/.test(d.message()) ? '20' : '홍길동') : d.accept());
  const lshot = (n, o) => lp.screenshot(Object.assign({ path: path.join(IMG, n + '.png') }, o || {}));
  await lp.goto(URL + '?view=line'); await lp.waitForFunction(() => S.role === 'line' && document.getElementById('lnSt').textContent === '');
  await lp.evaluate(() => new Promise(r => call('saveOrders', { orders: [
    { cust: '가나하우징', items: [{ name: 'STT-1.3', sensor: '', qty: 30, unit: '', note: '' }, { name: 'STT-2.6DE', sensor: '', qty: 60, unit: '', note: '' }], carrier: 'CJ', ship: '택배선불', due: S.today },
    { cust: '다라난방', items: [{ name: 'H10 7단계', sensor: 'X', qty: 30, unit: '', note: '' }], carrier: '직납', ship: '직납', due: S.today },
    { cust: '마바전기', items: [{ name: 'SV7', sensor: 'X', qty: 20, unit: '', note: '스티커 있음' }, { name: '파워코드 2C', sensor: '', qty: 20, unit: '개', note: '' }], carrier: '경동', ship: '경동택배선불', due: S.today },
    { cust: '사아상사', items: [{ name: 'STT-1.3', sensor: '', qty: 60, unit: '', note: '' }], carrier: 'CJ', ship: '택배선불', due: S.today, printed: S.today + ' 10:00:00', box: [{ k: '대', b: 2 }] }] }, () => { lineLoad(true); r(); })));
  await lp.waitForFunction(() => document.querySelectorAll('#lnBody .lncard').length === 4);
  await lshot('l1-today');
  await lp.evaluate(() => document.querySelector('.lncnt').nextElementSibling.scrollIntoView({ block: 'start' })); await lp.evaluate(() => window.scrollBy(0, -120)); await lp.waitForTimeout(200); await lshot('l1b-cards');
  const card = n => lp.locator('.lncard').filter({ hasText: n });
  await card('가나하우징').locator('.irow').nth(1).click();
  await lp.waitForFunction(() => { const o = LN.orders.find(x => x.cust === '가나하우징'); return o.itemReady && o.itemReady['1']; });
  await card('가나하우징').locator('[data-act=lnItemQ]').nth(0).click();
  await lp.waitForFunction(() => { const o = LN.orders.find(x => x.cust === '가나하우징'); return o.itemReady['0'] && o.itemReady['0'].q === 20; });
  await lp.addStyleTag({ content: '.lnnav{display:none!important}' }); await lp.waitForTimeout(400);
  await card('가나하우징').screenshot({ path: path.join(IMG, 'l2-items.png') });
  await card('마바전기').locator('[data-w=tagged]').click();
  await lp.waitForFunction(() => LN.orders.some(o => o.cust === '마바전기' && o.tagged)); await lp.waitForTimeout(400);
  await card('마바전기').screenshot({ path: path.join(IMG, 'l3-auto.png') });
  await lp.addStyleTag({ content: '.lnnav{display:flex!important}' }); await lp.click('.lnnav [data-i=sum]'); await lp.waitForTimeout(300); await lshot('l4-sum');
  await lp.click('.lnnav [data-i=today]');

  // PC 출하서
  const pc = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 }); const pp = await pc.newPage(); pp.on('dialog', d => d.accept());
  await pp.goto(URL); await pp.waitForFunction(() => document.getElementById('st').textContent === '');
  await pp.fill('#paste', PASTE); await pp.click('[data-act=parse]'); await pp.click('[data-act=draftSave]'); await pp.waitForFunction(() => S.orders.length === 3);
  await pp.click('#nav [data-v=list]'); await pp.waitForTimeout(300); await pp.screenshot({ path: path.join(IMG, 'p1-list.png') });
  await browser.close(); server.close(); console.log('캡처 완료 →', IMG);
})().catch(e => { console.error(e); process.exit(1); });
