/**
 * 브라우저 스모크 테스트 (견본 데이터, 폰 화면). 배포 전에 한 번 돌리세요.
 *   node subtech-inventory/dev/mock-page.js && node subtech-inventory/dev/smoke.js
 * 클라우드 세션: Chromium·Playwright 가 미리 깔려 있음 (require('playwright') 그대로).
 */
const { chromium, devices } = require('playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, 'out', 'page.html');
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fail++; };
(async () => {
  const b = await chromium.launch();
  const pg = await (await b.newContext({ ...devices['Galaxy S9+'] })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.accept(d.type() === 'prompt' ? '초기화' : undefined));
  await pg.goto(url); await pg.evaluate(() => localStorage.clear()); await pg.goto(url); await pg.waitForTimeout(800);
  const L = s => pg.locator('#locApp [data-el="' + s + '"]');
  const calls = () => pg.evaluate(() => CALLS);

  console.log('위치도');
  ok(await pg.locator('#locApp .cell').count() === 9, '칸 9개 그려짐');
  ok((await pg.locator('#locApp .cell[data-k="0,0"]').innerText()).includes('(기판)'), '칸에 품명(분류) 표시');

  console.log('칸 창 → 수량 입력 저장 (일반 창)');
  await pg.locator('#locApp .cell[data-k="0,0"]').tap(); await pg.waitForTimeout(150);
  await pg.locator('#locApp .qitem[data-qi="0"] [data-qb="0"]').fill('2');
  await pg.locator('#locApp .qitem[data-qi="0"] [data-ql]').fill('30');
  await pg.locator('#locApp [data-qsave]').tap(); await pg.waitForTimeout(300);
  let c = (await calls()).filter(x => x.setQty);
  ok(c.length === 1 && c[0].setQty.rows[0].qty === 230, '2박스×100+30낱개 = 230 저장 (locSetQty)');
  ok((await pg.locator('#locApp .qitem[data-qi="0"] .qnow').innerText()).includes('230'), '저장 후 "지금 230개"');

  console.log('출고 (위치도 안에서)');
  await pg.locator('#locApp [data-go="출고"]').first().tap(); await pg.waitForTimeout(150);
  await pg.locator('#locApp [data-ol]').fill('30'); await pg.locator('#locApp [data-osave]').tap(); await pg.waitForTimeout(300);
  c = (await calls()).filter(x => x.quickOut);
  ok(c.length === 1 && c[0].quickOut.loose === 30, '낱개 30 출고 (locQuickOut)');
  await pg.locator('#locApp .panel [data-a="close"]').first().tap();

  console.log('재고X → 발주완료');
  await L('bOut').tap(); await pg.locator('#locApp [data-o="q"]').fill('x1');
  await pg.locator('#locApp .olist [data-xx="X1||완포"]').first().tap(); await pg.waitForTimeout(100);
  await pg.locator('#locApp .olist [data-xo="X1||완포"]').first().tap(); await pg.waitForTimeout(100);
  ok((await pg.evaluate(() => locApi.orderMap()))['X1||완포'] === 'o', '발주완료 상태');
  await pg.locator('#locApp .olist [data-o="close"]').tap(); await pg.waitForTimeout(900);
  ok((await calls()).some(x => x.save !== undefined && typeof x.save === 'number'), '위치도 저장(locSave) 호출됨');

  console.log('검색 (같은 이름 묶기, 분류 칩)');
  await L('q').fill('sv7'); await pg.waitForTimeout(150);
  const r = await L('results').innerText();
  ok(/전체 2/.test(r) && /기판/.test(r) && /완포/.test(r), '분류 칩 + 한 카드에 분류별');
  await L('q').fill('');

  console.log('총수량 탭');
  await pg.click('#navTotal'); await pg.waitForTimeout(100);
  ok((await pg.locator('#totList').innerText()).includes('총수량'), '위치별 "(총수량 N개)"');

  ok(errs.length === 0, '페이지 오류 없음 ' + (errs.length ? JSON.stringify(errs) : ''));
  await b.close();
  console.log(fail ? `\n실패 ${fail}개` : '\n모두 통과');
  process.exit(fail ? 1 : 0);
})();
