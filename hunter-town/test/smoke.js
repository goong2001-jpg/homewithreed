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
  p.on('dialog', d => d.accept()); // prompt(가격) 은 기본값 그대로
  await p.goto(BASE + '/index.html');
  const t = sel => p.textContent(sel);
  const ev = (fn, arg) => p.evaluate(fn, arg);

  // ---- 첫 화면 ----
  check('구역 배지 1', (await t('#zoneNo')) === '1');
  check('시작 골드 300', (await t('#gold')).includes('300'), await t('#gold'));
  check('대기소 타이머', /다음 \d\d:\d\d/.test(await t('#spawnTimer')), await t('#spawnTimer'));
  check('헌터 0/4', (await t('#hunterCount')) === '👤 0/4', await t('#hunterCount'));
  check('픽셀 캔버스', await ev(() => document.getElementById('field').width < 200));
  check('오늘 할 일 한 줄', (await t('#missionLine')).includes('오늘 할 일 0/3'));
  check('기본 건물: 숙소·대장간·물약상점·잡화상', await ev(() => { const T = window.__ht.S.town; return T.inn === 1 && T.forge === 1 && T.potion === 1 && T.market === 1 && T.weapon === 0; }));

  // ---- 한 지도: 마을(위) + 사냥터(아래) ----
  check('건물 이름표 4 + 빈 터 4', (await p.locator('#labels .tag.bld').count()) === 4 && (await p.locator('#labels .tag.lot').count()) === 4);
  check('성벽이 마을과 사냥터 사이', await ev(() => { const F = window.__ht.F; return F.wallY > F.top + 40 && F.fTop < F.h - 40; }));

  // ---- 신 모드: 구역 배지 7번 탭 ----
  for (let i = 0; i < 7; i++) await p.click('#zoneBadge');
  await p.waitForSelector('#god:not([hidden])');
  check('신 모드 열림', !(await p.locator('#god').isHidden()));
  check('오프라인 기본 50% / 24시간', (await p.inputValue('#gOffPct')) === '50' && (await p.inputValue('#gOffHours')) === '24');
  await p.click('#gCallNow');
  await p.fill('#gHName', '테스터');
  await p.selectOption('#gHCls', 'warrior');
  await p.selectOption('#gHTier', 'SP');
  await p.click('#gMakeHunter');
  await p.selectOption('#gIKind', 'sword');
  await p.selectOption('#gITier', 'SP');
  await p.click('#gMakeItem');
  await p.selectOption('#gIKind', 'armor');
  await p.selectOption('#gITier', 'A');
  await p.click('#gMakeItem');
  await p.click('#gGold');
  await p.click('#gMats');
  await p.fill('#gSpawnMin', '0.1');
  await p.fill('#gExpMul', '10');
  await p.click('#gApply');
  await p.click('#god .sheet-title .x');
  check('신 모드 닫힘', await p.locator('#god').isHidden());
  check('S+ 검은 옵션 4개', await ev(() => window.__ht.S.items.find(i => i.tier === 'SP').opts.length === 4));
  check('A 갑옷은 옵션 2개', await ev(() => window.__ht.S.items.find(i => i.tier === 'A').opts.length === 2));

  // ---- 건설: 무기상점·방어구상점 짓기 ----
  await p.click('.navbtn[data-panel="town"]');
  await p.waitForSelector('#panel:not([hidden])');
  await p.click('#townList [data-id="weapon"] [data-act="up"]');
  await p.click('#townList [data-id="armor"] [data-act="up"]');
  check('상점 2개 완공', await ev(() => window.__ht.S.town.weapon === 1 && window.__ht.S.town.armor === 1));

  // ---- 창고: 강화·진열 ----
  await p.click('.navbtn[data-panel="items"]');
  const spId = await ev(() => window.__ht.S.items.find(i => i.tier === 'SP').id);
  const oreBefore = await ev(() => window.__ht.S.mats.ore);
  await p.click('#itemList [data-id="' + spId + '"] [data-act="enh"]');
  check('강화 시도(광석 소모)', await ev(o => window.__ht.S.mats.ore < o, oreBefore));
  await p.click('#itemList [data-id="' + spId + '"] [data-act="shelf"]');
  check('무기상점에 진열', await ev(() => window.__ht.S.shops.weapon.length === 1 && window.__ht.S.shops.weapon[0].price > 0));
  const arId = await ev(() => window.__ht.S.items.find(i => i.tier === 'A').id);
  await p.click('#itemList [data-id="' + arId + '"] [data-act="shelf"]');
  check('방어구상점에 진열', await ev(() => window.__ht.S.shops.armor.length === 1));

  // ---- 상점: 물약 양조 ----
  await p.click('.navbtn[data-panel="shop"]');
  const stock0 = await ev(() => window.__ht.S.shops.potionStock);
  for (let i = 0; i < 4; i++) await p.click('#brewBtn');
  check('연타 4번 = 물약 +1', await ev(s => window.__ht.S.shops.potionStock === s + 1, stock0));
  await p.click('.price .seg[data-price="25"]');
  check('물약 가격 변경', await ev(() => window.__ht.S.shops.potionPrice === 25));
  await p.click('#panel .sheet-title .x');

  // ---- 대기소: 받아들이기 → 정비(판매→물약→상점) → 사냥 ----
  await p.click('#waitBtn');
  await p.waitForSelector('#waitSheet:not([hidden])');
  const card = p.locator('#gateList .item[data-id]', { hasText: '테스터' });
  check('만든 헌터 S+', (await card.locator('.tier').textContent()) === 'S+');
  await ev(() => { const h = window.__ht.S.gate.find(x => x.name === '테스터'); h.gold = 5000; });
  await card.locator('[data-act="accept"]').click();
  await p.locator('#gateList [data-act="reject"]').first().click();
  await p.click('#waitSheet .sheet-title .x');
  check('합류하면 마을에서 정비 시작', await ev(() => { const h = window.__ht.S.hunters[0]; return h.status === 'town' && h.phase === 'sell'; }));
  const goldBefore = await ev(() => window.__ht.S.gold);
  await p.waitForFunction(() => window.__ht.S.hunters[0].status === 'hunt', null, { timeout: 40000 });
  check('정비 끝나면 사냥 출발', await ev(() => window.__ht.S.hunters[0].status === 'hunt'));
  check('정비 중 물약 구매', await ev(() => window.__ht.S.hunters[0].potions >= 1));
  check('정비 중 진열 무기 구매·장착', await ev(() => { const h = window.__ht.S.hunters[0]; return h.weapon && h.weapon.tier === 'SP' && window.__ht.S.shops.weapon.length === 0; }));
  check('정비 중 진열 갑옷 구매', await ev(() => window.__ht.S.hunters[0].armor && window.__ht.S.hunters[0].armor.tier === 'A'));
  check('판매 수입이 마을 금고로', await ev(g => window.__ht.S.gold > g, goldBefore));
  check('헌터 주머니 줄어듦', await ev(() => window.__ht.S.hunters[0].gold < 5000));
  check('장비 옵션이 능력치에 반영', await ev(() => { const h = window.__ht.S.hunters[0]; return h.mspd >= 1 && h.cdmg >= 2 && h.atk > 30; }));

  check('출발 위치는 문 앞(사냥터 쪽)', await ev(() => { const h = window.__ht.S.hunters[0], F = window.__ht.F; return h.y >= F.fTop && Math.abs(h.x - F.w / 2) < 12; }));

  // ---- 회귀: 체력 낮고 물약 없어도 출발 직후 되돌아오지 않는다 ----
  await ev(() => { const S = window.__ht.S, h = S.hunters[0]; S.shops.potionStock = 0; h.status = 'town'; h.phase = 'ready'; h.act = 0; h.hp = 1; h.potions = 0; h.gold = 0; const g = window.__ht.townSpot('market'); h.x = g.x; h.y = g.y; });
  await p.waitForFunction(() => window.__ht.S.hunters[0].status === 'hunt', null, { timeout: 20000 });
  check('출발할 때 체력 완전 회복', await ev(() => { const h = window.__ht.S.hunters[0]; return h.hp === h.maxHp; }));
  await p.waitForTimeout(4000);
  check('출발 4초 뒤에도 사냥 중', await ev(() => { const h = window.__ht.S.hunters[0]; return h.status === 'hunt' && !h.returning; }));

  // ---- 사냥: 처치 → 헌터 주머니·가방 ----
  await p.waitForFunction(() => window.__ht.S.stats.kills >= 3, null, { timeout: 30000 });
  check('몬스터 처치', await ev(() => window.__ht.S.stats.kills >= 3));
  check('골드는 헌터 주머니로', await ev(() => window.__ht.S.hunters[0].gold > 0));
  check('잡템이 헌터 가방에', await ev(() => window.__ht.S.hunters[0].bag.length >= 1));
  // 촌장의 일격: 몬스터 위치를 탭
  const hit = await ev(() => { const m = window.__ht.F.mons.find(m => m.x < window.__ht.F.w - 8); if (!m) return null; return { x: m.x * window.__ht.F.pix, y: (m.y - 6) * window.__ht.F.pix, hp: m.hp, id: m.id }; });
  if (hit) {
    const box = await p.locator('#field').boundingBox();
    await p.mouse.click(box.x + hit.x, box.y + hit.y);
    check('촌장의 일격', await ev(() => window.__ht.S.stats.strikes >= 1));
  } else check('촌장의 일격(몬스터 없음, 건너뜀)', true);
  await p.click('#shoutBtn');
  check('함성 버프', await ev(() => window.__ht.S.shoutUntil > Date.now()));

  // ---- 자동 등장 ----
  await p.waitForFunction(() => window.__ht.S.gate.length >= 1, null, { timeout: 15000 });
  check('시간이 지나면 새 헌터 등장', await ev(() => window.__ht.S.gate.length >= 1));

  // ---- 절전 모드 ----
  await p.click('#sleepBtn');
  check('절전 화면', !(await p.locator('#sleep').isHidden()));
  const k0 = await ev(() => window.__ht.S.stats.kills);
  await p.waitForTimeout(3000);
  check('절전 중에도 사냥 진행', await ev(k => window.__ht.S.stats.kills > k, k0));
  await p.click('#sleep');
  check('절전 해제', await p.locator('#sleep').isHidden());

  // ---- 오프라인 정산: 마지막 저장을 3시간 전으로 돌려 재시작 ----
  await ev(() => { const S = window.__ht.S; S.rate = { gold: 10, exp: 20, kills: 2, drops: 0.2, hgold: 5 }; window.__ht.save(); const s = JSON.parse(localStorage.getItem('hunter-town-v1')); s.lastTick = Date.now() - 3 * 3600000; localStorage.setItem('hunter-town-v1', JSON.stringify(s)); window.__ht.lock = true; });
  const goldPre = await ev(() => window.__ht.S.gold);
  await p.reload();
  await p.waitForSelector('#welcome:not([hidden])');
  const wt = await t('#welcomeText');
  check('오프라인 정산 창', wt.includes('3시간') && wt.includes('50%'), wt.replace(/\n/g, ' '));
  check('오프라인 보상 50% (10×180×0.5=900)', await ev(g => window.__ht.S.gold === g + 900, goldPre), String(await ev(() => window.__ht.S.gold)));
  await p.click('#welcomeOk');
  check('새로고침 뒤 헌터·장비 유지', await ev(() => { const h = window.__ht.S.hunters[0]; return h.name === '테스터' && h.weapon && h.weapon.tier === 'SP' && h.weapon.opts.length === 4; }));

  // ---- 기록·건설 패널 ----
  await p.click('.navbtn[data-panel="log"]');
  check('기록 쌓임', (await p.locator('#logList div').count()) >= 3);
  await p.click('.navbtn[data-panel="town"]');
  check('건물 8개', (await p.locator('#townList .item[data-id]').count()) === 8);
  await p.click('#panel .sheet-title .x');

  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL PASS');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
