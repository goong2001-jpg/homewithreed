// 실행: (hunter-town 폴더에서) python3 -m http.server 8152 &  →  node test/smoke.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:8152';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html');
  const t = sel => p.textContent(sel);

  // ---- 첫 화면 ----
  check('제목', (await t('#title')).includes('헌터 마을'));
  check('시작 골드 300', (await t('#gold')).includes('300'), await t('#gold'));
  check('입구 타이머', /다음 헌터까지 \d\d:\d\d/.test(await t('#spawnTimer')), await t('#spawnTimer'));
  check('헌터 0 / 4', (await t('#hunterCount')) === '헌터 0 / 4', await t('#hunterCount'));
  check('사냥터 캔버스', (await p.locator('#field').count()) === 1);

  // ---- 신 모드: 제목 7번 탭 ----
  for (let i = 0; i < 7; i++) await p.click('#title');
  await p.waitForSelector('#god:not([hidden])');
  check('신 모드 열림', !(await p.locator('#god').isHidden()));
  check('신 모드 기본값 등장 간격 10분', (await p.inputValue('#gSpawnMin')) === '10');

  // 헌터 부르기 → 입구 카드
  await p.click('#gCallNow');
  await p.waitForSelector('.gate-card');
  check('입구에 헌터 1명', (await p.locator('.gate-card').count()) === 1);
  // 내 헌터 만들기(S+ 전사 "테스터")
  await p.fill('#gHName', '테스터');
  await p.selectOption('#gHCls', 'warrior');
  await p.selectOption('#gHTier', 'SP');
  await p.click('#gMakeHunter');
  check('입구에 헌터 2명', (await p.locator('.gate-card').count()) === 2);
  const card = p.locator('.gate-card', { hasText: '테스터' });
  check('만든 헌터 S+', (await card.locator('.tier').textContent()) === 'S+');
  // 신의 장비: S+ 검
  await p.selectOption('#gIKind', 'sword');
  await p.selectOption('#gITier', 'SP');
  await p.click('#gMakeItem');
  // 규칙 변경: 등장 간격 0.1분, 경험치 10배
  await p.fill('#gSpawnMin', '0.1');
  await p.fill('#gExpMul', '10');
  await p.click('#gApply');
  await p.click('#god [data-close].btn');
  check('신 모드 닫힘', await p.locator('#god').isHidden());

  // ---- 입구: 받아들이기 / 돌려보내기 ----
  await card.locator('[data-act="accept"]').click();
  check('헌터 1 / 4', (await t('#hunterCount')) === '헌터 1 / 4', await t('#hunterCount'));
  check('목록에 테스터', (await t('#hunterList')).includes('테스터'));
  check('합류하면 바로 사냥', (await t('#hunterList')).includes('사냥 중'));
  await p.locator('.gate-card [data-act="reject"]').first().click();
  check('돌려보내면 입구 비움', (await p.locator('.gate-card').count()) === 0);

  // ---- 장비 교체 ----
  await p.click('#hunterList .item');
  await p.waitForSelector('#sheet:not([hidden])');
  check('헌터 시트 열림', (await t('#sheetContent')).includes('테스터'));
  check('처음엔 맨손', (await t('#sheetContent')).includes('맨손'));
  await p.click('#sheetContent [data-act="pick"][data-slot="weapon"]');
  await p.click('#pickList .item[data-pick]:not([data-pick="none"])');
  check('무기 장착', (await t('#sheetContent')).includes('신의 검'), (await t('#sheetContent')).slice(0, 80));
  const atkAfter = await p.evaluate(() => window.__ht.S.hunters[0].atk);
  check('장착 뒤 공격력 오름', atkAfter > 30, String(atkAfter));
  check('창고에서 빠짐', await p.evaluate(() => window.__ht.S.items.length === 0));
  await p.click('#sheetContent [data-close]');
  check('목록에 무기 표시', (await t('#hunterList')).includes('신의 검'));

  // ---- 사냥 진행: 몇 초 뒤 처치 수·골드가 오른다 ----
  await p.waitForFunction(() => window.__ht.S.stats.kills >= 1, null, { timeout: 20000 });
  check('몬스터 처치', await p.evaluate(() => window.__ht.S.stats.kills >= 1));
  check('골드 증가', await p.evaluate(() => window.__ht.S.gold > 300));
  check('경험치 증가', await p.evaluate(() => window.__ht.S.hunters[0].exp > 0 || window.__ht.S.hunters[0].lv > 1));

  // ---- 자동 등장: 0.1분 간격이라 곧 새 헌터가 온다 ----
  await p.waitForFunction(() => window.__ht.S.gate.length >= 1, null, { timeout: 15000 });
  check('시간이 지나면 새 헌터 등장', await p.evaluate(() => window.__ht.S.gate.length >= 1));

  // ---- 마을 / 장비 탭 / 기록 ----
  await p.click('.tab[data-tab="town"]');
  check('마을 건물 4개', (await p.locator('#townList .item[data-id]').count()) === 4);
  await p.click('.tab[data-tab="items"]');
  check('대장간 버튼', (await t('#craftBtn')).includes('만들기'));
  await p.click('.tab[data-tab="log"]');
  check('기록 쌓임', (await p.locator('#logList div').count()) >= 3);

  // ---- 저장/복원 ----
  await p.evaluate(() => window.__ht.save());
  await p.reload();
  await p.waitForSelector('#hunterList .item');
  check('새로고침 뒤 헌터 유지', (await t('#hunterList')).includes('테스터'));
  check('새로고침 뒤 무기 유지', (await t('#hunterList')).includes('신의 검'));
  check('규칙 유지(등장 간격 0.1)', await p.evaluate(() => window.__ht.S.cfg.spawnMin === 0.1));

  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL PASS');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
