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
  check('구역 배지 1', (await t('#zoneNo')) === '1');
  check('시작 골드 300', (await t('#gold')).includes('300'), await t('#gold'));
  check('대기소 타이머', /다음 \d\d:\d\d/.test(await t('#spawnTimer')), await t('#spawnTimer'));
  check('헌터 0/4', (await t('#hunterCount')) === '👤 0/4', await t('#hunterCount'));
  check('픽셀 캔버스(내부 해상도 작음)', await p.evaluate(() => document.getElementById('field').width < 200));
  check('오늘 할 일 3개', (await p.locator('#missionList div').count()) === 3);

  // ---- 신 모드: 구역 배지 7번 탭 ----
  for (let i = 0; i < 7; i++) await p.click('#zoneBadge');
  await p.waitForSelector('#god:not([hidden])');
  check('신 모드 열림', !(await p.locator('#god').isHidden()));
  check('기본값 등장 간격 10분', (await p.inputValue('#gSpawnMin')) === '10');
  await p.click('#gCallNow');
  await p.fill('#gHName', '테스터');
  await p.selectOption('#gHCls', 'warrior');
  await p.selectOption('#gHTier', 'SP');
  await p.click('#gMakeHunter');
  await p.selectOption('#gIKind', 'sword');
  await p.selectOption('#gITier', 'SP');
  await p.click('#gMakeItem');
  await p.fill('#gSpawnMin', '0.1');
  await p.fill('#gExpMul', '10');
  await p.click('#gApply');
  await p.click('#god .sheet-title .x');
  check('신 모드 닫힘', await p.locator('#god').isHidden());
  check('대기소 배지 2', (await t('#waitBadge')) === '2', await t('#waitBadge'));

  // ---- 대기소: 받아들이기 / 돌려보내기 ----
  await p.click('#waitBtn');
  await p.waitForSelector('#waitSheet:not([hidden])');
  check('대기소에 헌터 2명', (await p.locator('#gateList .item[data-id]').count()) === 2);
  const card = p.locator('#gateList .item[data-id]', { hasText: '테스터' });
  check('만든 헌터 S+', (await card.locator('.tier').textContent()) === 'S+');
  check('대기소 초상화 그려짐', (await card.locator('canvas').count()) === 1);
  await card.locator('[data-act="accept"]').click();
  check('헌터 1/4', (await t('#hunterCount')) === '👤 1/4', await t('#hunterCount'));
  await p.locator('#gateList [data-act="reject"]').first().click();
  check('돌려보내면 대기소 비움', (await p.locator('#gateList .item[data-id]').count()) === 0);
  await p.click('#waitSheet .sheet-title .x');
  check('합류하면 바로 사냥', await p.evaluate(() => window.__ht.S.hunters[0].status === 'hunt'));
  check('사냥터 이름표', (await p.locator('#labels .tag', { hasText: '테스터' }).count()) === 1);
  check('합류 인사말이 수다에', (await t('#chatList')).includes('테스터'));

  // ---- 헌터 패널 → 장비 교체 ----
  await p.click('.navbtn[data-panel="hunters"]');
  await p.waitForSelector('#panel:not([hidden])');
  check('헌터 패널 제목', (await t('#panelTitle')).includes('헌터'));
  await p.click('#hunterList .item');
  await p.waitForSelector('#sheet:not([hidden])');
  check('헌터 시트', (await t('#sheetContent')).includes('테스터'));
  check('처음엔 맨손', (await t('#sheetContent')).includes('맨손'));
  await p.click('#sheetContent [data-act="pick"][data-slot="weapon"]');
  await p.click('#pickList .item[data-pick]:not([data-pick="none"])');
  check('무기 장착', (await t('#sheetContent')).includes('신의 검'));
  const atkAfter = await p.evaluate(() => window.__ht.S.hunters[0].atk);
  check('장착 뒤 공격력 오름', atkAfter > 30, String(atkAfter));
  check('창고에서 빠짐', await p.evaluate(() => window.__ht.S.items.length === 0));
  check('장비 미션 카운트', await p.evaluate(() => window.__ht.S.daily.equip === 1));
  await p.click('#sheetContent [data-act="close"]');
  await p.click('#panel .sheet-title .x');

  // ---- 사냥 진행 ----
  await p.waitForFunction(() => window.__ht.S.stats.kills >= 1, null, { timeout: 25000 });
  check('몬스터 처치', await p.evaluate(() => window.__ht.S.stats.kills >= 1));
  check('골드 증가', await p.evaluate(() => window.__ht.S.gold > 300));
  check('경험치/레벨 증가', await p.evaluate(() => window.__ht.S.hunters[0].exp > 0 || window.__ht.S.hunters[0].lv > 1));

  // ---- 자동 등장 ----
  await p.waitForFunction(() => window.__ht.S.gate.length >= 1, null, { timeout: 15000 });
  check('시간이 지나면 새 헌터 등장', await p.evaluate(() => window.__ht.S.gate.length >= 1));

  // ---- 건설 / 창고 / 대장간 / 기록 ----
  await p.click('.navbtn[data-panel="town"]');
  check('건물 4개', (await p.locator('#townList .item[data-id]').count()) === 4);
  await p.click('.navbtn[data-panel="forge"]');
  check('대장간 버튼', (await t('#craftBtn')).includes('만들기'));
  await p.click('.navbtn[data-panel="log"]');
  check('기록 쌓임', (await p.locator('#logList div').count()) >= 3);
  await p.click('#panel .sheet-title .x');

  // ---- 저장/복원 ----
  await p.evaluate(() => window.__ht.save());
  await p.reload();
  await p.waitForFunction(() => window.__ht && window.__ht.S.hunters.length === 1);
  check('새로고침 뒤 헌터 유지', await p.evaluate(() => window.__ht.S.hunters[0].name === '테스터'));
  check('새로고침 뒤 무기 유지', await p.evaluate(() => window.__ht.S.hunters[0].weapon && window.__ht.S.hunters[0].weapon.tier === 'SP'));
  check('규칙 유지(등장 간격 0.1)', await p.evaluate(() => window.__ht.S.cfg.spawnMin === 0.1));

  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL PASS');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
