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
  ok(await pg.locator('#locApp .cell[data-k="0,0"] .kb.kp svg').count() === 1, '파렛트 칸에 받침대 모양 (v38)');

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

  console.log('입출고 탭: 담당자 기억 · 거래 취소 (v34)');
  await pg.evaluate(() => go('search')); await pg.waitForTimeout(100);
  await pg.locator('#searchList .gr').first().tap(); await pg.waitForTimeout(300);
  await pg.selectOption('#staffSel', '김철수');
  ok(await pg.evaluate(() => localStorage.getItem('subtek-staff')) === '김철수', '담당자 고르면 기억');
  const hist = await pg.locator('#histList').innerText();
  ok(/취소 기록/.test(hist) && /취소됨/.test(hist) && await pg.locator('#histList .undo').count() === 1, '이력: 취소 기록·취소됨 표시, 취소 버튼은 남은 거래에만');
  await pg.locator('#histList .undo').tap(); await pg.waitForTimeout(200);
  c = (await calls()).filter(x => x.undo);
  ok(c.length === 1 && c[0].undo[0] === 7 && c[0].undo[1] === 1690000000000, '취소 → undoTransaction(줄, 시각키)');
  await pg.reload(); await pg.waitForTimeout(800); await pg.evaluate(() => go('search')); await pg.locator('#searchList .gr').first().tap(); await pg.waitForTimeout(200);
  ok(await pg.inputValue('#staffSel') === '김철수', '다시 열어도 담당자 그대로');

  console.log('다크 모드 (v34)');
  await pg.emulateMedia({ colorScheme: 'dark' }); await pg.evaluate(() => go('stock')); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(246, 248, 251)', '폰이 다크 모드여도 밝은 화면이 기본 (v38)');
  await pg.evaluate(() => setTheme('dark'));
  ok(await pg.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(25, 28, 30)', '"화면 어둡게"를 고르면 모든 탭이 어두운 배경');
  await pg.evaluate(() => setTheme('light')); await pg.emulateMedia({ colorScheme: 'light' });

  console.log('편집 버튼 줄 · 칸 창 순서 · 알림 (v35)');
  await pg.click('#navLoc'); await pg.waitForTimeout(100);
  ok(!(await L('tools2').isVisible()), '편집 버튼(칸 합치기 등)은 접혀 있음');
  await L('bMore').tap(); ok(await L('bMerge').isVisible(), '⚙️ 편집 누르면 펼쳐짐'); await L('bMore').tap();
  await pg.locator('#locApp .cell[data-k="1,1"]').tap(); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => { const P = document.querySelector('#locApp [data-el="panelBody"]'), a = P.querySelector('.sk'), d = P.querySelector('details.cfg'); return !!(a && d && !d.open && (a.compareDocumentPosition(d) & 4)); }), '칸 창: 현재 재고가 위, 칸 설정은 아래에 접힘');
  await pg.locator('#locApp .panel [data-a="close"]').first().tap();
  await pg.locator('#locApp .cell[data-k="2,2"]').tap(); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => document.querySelector('#locApp details.cfg').open), '빈 칸은 칸 설정이 펼쳐져 있음');
  await pg.locator('#locApp .panel [data-a="close"]').first().tap();
  await pg.evaluate(() => notice({ message: '테스트 오류' }, 1, '저장 실패: '));
  ok((await pg.locator('#notice').innerText()) === '저장 실패: 테스트 오류' && await pg.locator('#notice.err').isVisible(), '오류는 팝업 대신 화면 아래 알림');
  await pg.context().setOffline(true); await pg.waitForTimeout(200);
  ok(await pg.locator('#netBar').isVisible(), '인터넷 끊기면 위쪽에 안내');
  await pg.context().setOffline(false); await pg.waitForTimeout(200);
  ok(!(await pg.locator('#netBar').isVisible()), '다시 연결되면 안내 사라짐');

  console.log('보기 3단 · 분류 칩 (v40)');
  await pg.click('#navLoc'); await pg.waitForTimeout(100);
  await pg.locator('#locApp [data-v="map"]').tap(); await pg.waitForTimeout(150);
  ok(await pg.locator('#locApp .grid.v-map .cell').count() === 9 && (await pg.locator('#locApp .grid .cell[data-k="1,1"]').innerText()).trim() === '' && await pg.locator('#locApp .grid .cell[data-k="1,1"].stocked').count() === 1, '배치: 글씨 없이 색으로 (재고 있는 칸 진하게)');
  ok(await pg.locator('#locApp .grid .cell[data-k="0,0"] svg').count() === 1 && await pg.evaluate(() => { const g = document.querySelector('#locApp .grid'); return g.scrollWidth <= g.parentElement.clientWidth + 1; }), '배치: 종류 모양 표시, 한 화면 너비에 다 들어옴');
  await pg.locator('#locApp .grid .cell[data-k="1,1"]').tap(); await pg.waitForTimeout(300);
  ok(await pg.locator('#locApp .grid.v-full').count() === 1 && await pg.locator('#locApp .panel').isHidden(), '배치에서 칸을 누르면 그 자리를 전체 보기로');
  await pg.locator('#locApp [data-v="name"]').tap(); await pg.waitForTimeout(150);
  ok((await pg.locator('#locApp .grid.v-name .cell[data-k="1,1"] .n1').innerText()) === 'SV7', '이름: 칸마다 대표 품목 하나');
  await pg.locator('#locApp .catbar [data-c="기판"]').tap(); await pg.waitForTimeout(150);
  ok(await pg.locator('#locApp .cell[data-k="0,0"].hit').count() === 1 && await pg.locator('#locApp .cell[data-k="1,0"].dimc').count() === 1, '분류 칩: 기판 있는 칸만 켜짐');
  await pg.locator('#locApp .catbar [data-c=""]').tap(); await pg.locator('#locApp [data-v="full"]').tap(); await pg.waitForTimeout(150);

  console.log('탭 3개 · 더보기 · 품목 창 이력 (v41)');
  ok(await pg.locator('.nav > div').count() === 3, '아래 탭 3개 (위치도 · 품목 · 더보기)');
  await pg.click('#navMore'); await pg.waitForTimeout(100);
  ok(await pg.locator('#viewMore .mrow2').count() === 8 && (await pg.locator('#moreVer').innerText()).includes('v'), '더보기에 입출고·현재고·조립·메모·리포트·이력·내보내기');
  await pg.locator('#viewMore .mrow2').nth(2).tap(); await pg.waitForTimeout(150);
  ok(await pg.locator('#viewBuild').isVisible() && await pg.locator('#navMore.on').count() === 1, '더보기 → 조립 화면');
  await pg.click('#navLoc'); await pg.waitForTimeout(100);
  await pg.locator('#locApp .cell[data-k="1,1"]').tap(); await pg.waitForTimeout(200);
  await pg.locator('#locApp .panel [data-item]').first().tap(); await pg.waitForTimeout(200);
  await pg.locator('#locApp .panel [data-a="hist"]').tap(); await pg.waitForTimeout(250);
  ok(await pg.locator('#locApp .ihist .hr').count() === 3 && await pg.locator('#locApp .ihist [data-undo]').count() === 1, '품목 창: 최근 이력 표시, 취소는 남은 거래에만');
  const u0 = (await calls()).filter(x => x.undo).length;
  await pg.locator('#locApp .ihist [data-undo]').tap(); await pg.waitForTimeout(300);
  c = (await calls()).filter(x => x.undo);
  ok(c.length === u0 + 1 && c[c.length - 1].undo[0] === 7 && c[c.length - 1].undo[1] === 1690000000000, '품목 창에서 거래 취소 (줄, 시각키)');
  await pg.locator('#locApp .panel [data-a="close"]').first().tap();

  console.log('레시피 도우미 (v42)');
  await pg.evaluate(() => { go('build'); openNewBom(); document.getElementById('bomFinished').value = 'SV7||완포'; renderBomSug(); }); await pg.waitForTimeout(150);
  ok((await pg.locator('#bomSug .bsw').first().innerText()).includes('SV7') && (await pg.locator('#bomSug .bsw').first().innerText()).includes('기판'), '완제품을 고르면 같은 이름의 기판을 추천');
  await pg.locator('#bomSug .bsc').first().tap(); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => BF.parts.length === 1 && BF.parts[0].id === 'SV7||기판') && await pg.locator('#bomSug .bsc.on').count() === 1, '추천을 누르면 부품 목록에 추가');
  await pg.locator('#bsQ').fill('x1'); await pg.waitForTimeout(100);
  ok((await pg.locator('#bomSug').innerText()).includes('X1'), '직접 찾기로 부품 검색');
  await pg.locator('#bomSug .bsc.on').first().tap(); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => BF.parts.length === 1 && BF.parts[0].id === ''), '다시 누르면 빠짐');

  console.log('켤 때 속도 (v36)');
  await pg.evaluate(() => localStorage.setItem('mockDelay', '2500')); await pg.reload(); await pg.waitForTimeout(500);
  ok((await L('status').innerText()).includes('최신 확인 중'), '저장본으로 바로 뜸 (최신 확인 중)');
  await pg.locator('#locApp .cell[data-k="1,1"]').tap(); await pg.waitForTimeout(200);
  ok(await pg.locator('#locApp [data-qsave]').isVisible(), '최신 확인 중에도 칸이 열리고 수량 입력 가능');
  await pg.locator('#locApp .panel [data-a="close"]').first().tap();
  await pg.evaluate(() => { window.__g = document.querySelector('#locApp .grid .cell'); }); await pg.waitForTimeout(2600);
  ok(await pg.evaluate(() => window.__g.isConnected) && (await L('status').innerText()) === '저장됨', '최신이 저장본과 같으면 다시 그리지 않고 "저장됨"');
  await pg.evaluate(() => localStorage.removeItem('mockDelay'));

  console.log('내보내기 (v37)');
  await pg.click('#navTotal'); await pg.locator('#viewTotal .sortbtn').tap(); await pg.waitForTimeout(100);
  const xl = await pg.evaluate(() => { const rows = xRows(), u = xlsxBuild(rows); return { tabs: rows.map(r => r.name), head: rows[0].rows[0].map(c => c.v), n: rows[0].rows.length, zip: u[0] === 0x50 && u[1] === 0x4b, len: u.length }; });
  ok(xl.zip && xl.len > 2000 && xl.tabs[0] === '품목별' && xl.tabs[1] === '위치별' && /^위치도 /.test(xl.tabs[2]) && xl.head[0] === '번호' && xl.n === 4, '엑셀: 품목별(번호)·위치별·위치도 탭');
  await pg.locator('#xPanel .xacts .pri').tap(); await pg.waitForTimeout(300);
  c = (await calls()).filter(x => x.exp);
  ok(c.length === 1 && /\.xlsx$/.test(c[0].exp.name) && (await pg.inputValue('#xLink')).startsWith('https://drive.google.com/'), '보낼 링크 만들기 → 드라이브 링크 표시');
  await pg.locator('#xfP').tap(); await pg.locator('#xPanel .xacts .pri').tap(); await pg.waitForTimeout(600);
  c = (await calls()).filter(x => x.exp);
  ok(c.length === 2 && c[1].exp.mime === 'image/png' && c[1].exp.len > 1000, '위치도 그림(PNG) 링크');
  await pg.evaluate(() => closeExport());

  ok(errs.length === 0, '페이지 오류 없음 ' + (errs.length ? JSON.stringify(errs) : ''));
  await b.close();
  console.log(fail ? `\n실패 ${fail}개` : '\n모두 통과');
  process.exit(fail ? 1 : 0);
})();
