// 실행: (god-village 폴더에서) python3 -m http.server 8153 &  →  node test/smoke.js
const { chromium } = require('playwright');
const BASE = 'http://localhost:8153';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e))); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/index.html');
  await p.waitForFunction(() => window.__gv && window.__gv.S);
  const t = sel => p.textContent(sel);
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const box = await p.locator('#field').boundingBox();
  // 세계 좌표 → 화면 좌표
  const scr = async (wx, wy) => { const o = await ev(([x, y]) => { const g = window.__gv; return { x: (x - g.cam.x) * g.F.pix, y: (y - g.cam.y) * g.F.pix }; }, [wx, wy]); return { x: box.x + o.x, y: box.y + o.y }; };

  // ---- 첫 화면 ----
  check('석기 시대로 시작', (await t('#eraNm')) === '석기 시대');
  check('시민 3명, 군락 1개', await ev(() => window.__gv.S.pop.length === 3 && window.__gv.S.settles.length === 1));
  check('세계 12칸, 우리 칸만 탐험됨', await ev(() => window.__gv.S.explored.flat().length === 12 && window.__gv.S.explored.flat().filter(Boolean).length === 1));
  check('적 부족은 왼쪽 위, 아직 못 만남', await ev(() => { const e = window.__gv.S.enemy; return e && e.c === 0 && e.r === 0 && !e.met; }));
  check('산적·보물 등 오브젝트 배치', await ev(() => window.__gv.S.camps.length + window.__gv.S.pickups.length >= 3));
  check('신의 힘 버튼 10개', (await p.locator('.pw').count()) === 10);
  check('미니맵', (await p.locator('#minimap').count()) === 1);
  check('카메라가 우리 마을을 비춤', await ev(() => { const g = window.__gv, h = g.home(); return h.x > g.cam.x && h.x < g.cam.x + g.F.vw && h.y > g.cam.y && h.y < g.cam.y + g.F.vh; }));

  // ---- 스스로 발전 ----
  await p.waitForFunction(() => window.__gv.S.blds.some(b => b.type === 'totem' && b.done), null, { timeout: 100000 });
  check('시민들이 스스로 토템을 세움', true);

  // ---- 지도 끌기(패닝) ----
  const cam0 = await ev(() => ({ x: window.__gv.cam.x, y: window.__gv.cam.y }));
  await p.mouse.move(box.x + 20, box.y + 40); await p.mouse.down(); await p.mouse.move(box.x + 120, box.y + 140, { steps: 6 }); await p.mouse.up();
  check('빈 땅을 끌면 카메라 이동', await ev(c => window.__gv.cam.x !== c.x || window.__gv.cam.y !== c.y, cam0));
  await p.click('#homeBtn');
  check('🏠 버튼으로 복귀', await ev(() => { const g = window.__gv, h = g.home(); return h.x > g.cam.x && h.x < g.cam.x + g.F.vw && h.y > g.cam.y && h.y < g.cam.y + g.F.vh; }));

  // ---- 신의 힘: 식량 ----
  await ev(() => { window.__gv.S.faith = 50; });
  await p.click('.pw[data-power="food"]');
  const h = await ev(() => { const h = window.__gv.home(); return { x: h.x, y: h.y + 14 }; });
  let s = await scr(h.x, h.y); await p.mouse.click(s.x, s.y);
  check('선물이 떨어짐', await ev(() => window.__gv.S.gifts.length === 1 || window.__gv.S.stats.gifts === 1));
  check('믿음 5 소모', await ev(() => window.__gv.S.faith === 45), String(await ev(() => window.__gv.S.faith)));
  const food0 = await ev(() => window.__gv.S.res.food);
  await p.waitForFunction(() => window.__gv.S.gifts.length === 0, null, { timeout: 40000 }).catch(() => {});
  check('시민이 선물을 주워 식량 증가', await ev(f => window.__gv.S.gifts.length === 0 && window.__gv.S.res.food > f + 15, food0), String(await ev(() => window.__gv.S.gifts.length)));

  // ---- 영감 → 발견 ----
  await ev(() => { window.__gv.S.faith = 100; });
  await p.click('.pw[data-power="idea"]'); s = await scr(h.x, h.y); await p.mouse.click(s.x, s.y);
  check('영감으로 지식 +15', await ev(() => window.__gv.S.res.know >= 15));
  await ev(() => { window.__gv.S.res.know = 60; window.__gv.slowTick(Date.now()); });
  check('불 발견(지식 60)', await ev(() => window.__gv.S.techs.includes('fire')));
  check('업적 "첫 불꽃"', await ev(() => window.__gv.S.ach.includes('first_fire')));

  // ---- 신탁 ----
  await p.click('.pw[data-power="oracle"]'); await p.waitForSelector('#oracleSheet:not([hidden])');
  check('출정은 적을 찾기 전엔 잠김', await p.locator('#oracleList [data-oracle="invade"]').isDisabled());
  await p.click('#oracleList [data-oracle="know"]');
  check('신탁 적용', await ev(() => window.__gv.S.oracle && window.__gv.S.oracle.id === 'know'));

  // ---- 시민 들어 옮기기 ----
  await p.click('#homeBtn');
  const v = await ev(() => { const g = window.__gv, h = g.home(); const v = g.S.pop.reduce((a, b) => Math.hypot(b.x - h.x, b.y - h.y) < Math.hypot(a.x - h.x, a.y - h.y) ? b : a); v.x = h.x; v.y = h.y + 12; v.held = false; v.state = 'idle'; return { id: v.id, x: v.x, y: v.y - 6 }; });
  const tree = await ev(() => { const g = window.__gv, h = g.home(); const n = g.S.nodes.filter(n => n.type === 'tree' && Math.abs(n.x - h.x) < 60 && Math.abs(n.y - h.y) < 60).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0]; return { x: n.x + 4, y: n.y + 2 }; });
  const sv = await scr(v.x, v.y), st = await scr(tree.x, tree.y);
  await p.mouse.move(sv.x, sv.y); await p.mouse.down(); await p.mouse.move(sv.x + 20, sv.y, { steps: 4 });
  check('드래그 중 들려 있음', await ev(id => window.__gv.S.pop.find(x => x.id === id).held, v.id));
  await p.mouse.move(st.x, st.y, { steps: 8 }); await p.mouse.up();
  check('나무 옆에 내려놓으면 나무꾼(신의 뜻)', await ev(id => { const v = window.__gv.S.pop.find(x => x.id === id); return !v.held && v.job === 'lumber' && v.nudge > Date.now(); }, v.id));
  check('옮긴 횟수 기록', await ev(() => window.__gv.S.stats.moves === 1));

  // ---- 가족: 결혼 → 출산 ----
  await ev(() => { const g = window.__gv, S = g.S; S.marryT = 999; g.family(); });
  check('결혼', await ev(() => window.__gv.S.pop.filter(v => v.partner).length >= 2 && window.__gv.S.stats.marry >= 1));
  await ev(() => { const g = window.__gv, S = g.S; S.res.food = 100; S.happy = 80; const h = g.home(); S.blds.push({ id: 'h1', type: 'hut', x: h.x + 30, y: h.y, progress: 8, done: true, settle: h.id }, { id: 'h2', type: 'hut', x: h.x - 30, y: h.y, progress: 8, done: true, settle: h.id }); S.birthT = 9999; g.family(); });
  check('아이 출생', await ev(() => window.__gv.S.pop.some(v => v.child) && window.__gv.S.stats.born >= 1));
  check('아이는 일 안 함', await ev(() => window.__gv.S.pop.filter(v => v.child).every(v => v.job === 'child')));

  // ---- 탐험·소원 ----
  await ev(() => { window.__gv.S.nextWish = 0; window.__gv.slowTick(Date.now()); });
  check('소원 생성·카드', await ev(() => window.__gv.S.wishes.length >= 1) && (await p.locator('#wishList .wish').count()) >= 1);
  await p.click('.navbtn[data-panel="more"]'); await p.click('#godReveal'); await p.click('#panel .sheet-title .x');
  check('안개 걷기 → 12칸 탐험, 적 발견', await ev(() => window.__gv.S.explored.flat().filter(Boolean).length === 12 && window.__gv.S.enemy.met));
  check('산적이 나타남', await ev(() => window.__gv.S.hostiles.some(h => h.kind === 'bandit')));

  // ---- 전투: 불벼락으로 산적 소굴 ----
  const camp = await ev(() => { const k = window.__gv.S.camps[0]; window.__gv.panTo(k); return { x: k.x, y: k.y }; });
  await ev(() => { window.__gv.S.faith = 200; });
  await p.click('.pw[data-power="fire"]');
  s = await scr(camp.x, camp.y); await p.mouse.click(s.x, s.y); await p.mouse.click(s.x, s.y);
  await p.waitForTimeout(500); await ev(() => window.__gv.slowTick(Date.now()));
  check('불벼락 두 방으로 소굴 소탕', await ev(() => window.__gv.S.camps[0].cleared && window.__gv.S.stats.bandit >= 1));

  // ---- 새 군락 ----
  await ev(() => { const g = window.__gv, S = g.S; const h = g.home(); for (let i = 0; i < 12; i++) S.pop.push({ ...S.pop[0], id: 'x' + i, name: '시민' + i, partner: null, child: false, age: 999, kids: 0, job: 'gather', state: 'idle', held: false, x: h.x, y: h.y, settle: h.id }); S.res.wood = 100; S.res.food = 100; g.family(); });
  check('인구가 늘면 새 군락을 세움', await ev(() => window.__gv.S.settles.length >= 2 && window.__gv.S.pop.some(v => v.state === 'migrate')));

  // ---- 회귀: 시민은 적에게 죽지 않고 쓰러진다, 침략은 45초 뒤 끝난다, 다 쓰러지면 피난민 ----
  const before = await ev(() => { const g = window.__gv, S = g.S; S.hostiles = []; const h = g.home(); const civ = S.pop.filter(v => !v.child && v.job !== 'warrior' && v.job !== 'hunter'); civ.forEach(v => { v.hp = 1; v.x = h.x; v.y = h.y; }); S.hostiles.push({ id: 'r1', kind: 'enemy', raid: true, x: h.x, y: h.y, hp: 30, atk: 50, target: { x: h.x, y: h.y }, until: S.simT + 45, timer: 0, walk: 0, face: 1, pillage: 0 }); return { pop: S.pop.length, until: S.hostiles[0].until - S.simT }; });
  check('침략 지속은 45초', before.until <= 45.01);
  await p.waitForTimeout(3500);
  check('일반 시민은 죽지 않고 쓰러짐', await ev(n => window.__gv.S.pop.length === n && window.__gv.S.pop.some(v => v.down > 0), before.pop), String(await ev(() => window.__gv.S.pop.length)));
  await ev(() => { window.__gv.S.hostiles = []; });
  await ev(() => { const g = window.__gv, S = g.S; S.pop = S.pop.slice(0, 1); S.pop[0].child = false; S.refugeeT = 18; g.family(); });
  check('어른이 1명 이하면 피난민 도착', await ev(() => window.__gv.S.pop.length === 3));

  // ---- 적 침략 → 격퇴 / 출정 → 정복 ----
  await ev(() => { const g = window.__gv, S = g.S; if (!S.techs.includes('hunting')) S.techs.push('hunting'); if (!S.techs.includes('weapons')) S.techs.push('weapons'); const h = g.home(); while (S.pop.length < 8) { const v = { ...S.pop[0], id: 'p' + S.pop.length, name: '주민' + S.pop.length, partner: null, child: false, age: 999, kids: 0, job: 'gather', state: 'idle', held: false, down: 0, x: h.x, y: h.y, settle: h.id, hp: 16 }; S.pop.push(v); } S.enemy.lastRaid = -9999; S.enemy.metAt = -9999; S.simT = 9999; g.slowTick(Date.now()); });
  check('적 침략 시작', await ev(() => window.__gv.S.hostiles.some(h => h.kind === 'enemy' && h.raid)));
  check('침략 소원 조건·HUD', (await t('#oracleLine')).includes('침략 중'));
  await ev(() => { window.__gv.S.hostiles.forEach(h => { if (h.raid) h.hp = 0; }); });
  await p.waitForTimeout(400);
  check('침략 격퇴 업적', await ev(() => window.__gv.S.stats.defend >= 1 && window.__gv.S.ach.includes('defend')));
  await ev(() => { const g = window.__gv, S = g.S; S.faith = 300; S.pop.slice(0, 4).forEach(v => { v.job = 'warrior'; v.child = false; }); g.useOracle('invade'); });
  check('출정 명령', await ev(() => !!window.__gv.S.invading && window.__gv.S.rally));
  await ev(() => { const g = window.__gv, S = g.S; S.pop.filter(v => v.job === 'warrior').forEach(v => { v.x = S.enemy.x; v.y = S.enemy.y + 4; }); });
  await p.waitForFunction(() => window.__gv.S.hostiles.some(h => h.defend), null, { timeout: 5000 });
  check('적 수비대 등장', true);
  await ev(() => { window.__gv.S.hostiles.forEach(h => { if (h.defend) h.hp = 0; }); });
  await p.waitForFunction(() => window.__gv.S.stats.conquer >= 1, null, { timeout: 5000 });
  check('정복 → 적 땅이 우리 군락', await ev(() => !window.__gv.S.enemy.alive && window.__gv.S.settles.some(s => s.nm.startsWith('정복지')) && window.__gv.S.ach.includes('conquer')));

  // ---- 패널·절전 ----
  await p.click('.navbtn[data-panel="ach"]'); check('업적 19개', (await p.locator('#achList .item').count()) === 19);
  await p.click('.navbtn[data-panel="bld"]'); check('마을 패널에 군락·적 정보', (await t('#bldNext')).includes('첫 마을'));
  await p.click('#panel .sheet-title .x');
  await p.click('#sleepBtn'); check('절전 화면', !(await p.locator('#sleep').isHidden())); await p.click('#sleep');

  // ---- 저장/복원 + 오프라인 ----
  await ev(() => { const S = window.__gv.S; S.rate = { food: 10, wood: 4, stone: 2, metal: 0, know: 0, faith: 3, born: 0 }; window.__gv.save(); const s = JSON.parse(localStorage.getItem('god-village-v1')); s.lastTick = Date.now() - 2 * 3600000; localStorage.setItem('god-village-v1', JSON.stringify(s)); window.__gv.lock = true; });
  const faithPre = await ev(() => window.__gv.S.faith);
  await p.reload(); await p.waitForSelector('#welcome:not([hidden])');
  check('오프라인 정산 창(2시간, 50%)', (await t('#welcomeText')).includes('2시간'));
  check('믿음 정산 +180', await ev(f => window.__gv.S.faith >= f + 180, faithPre));
  await p.click('#welcomeOk');
  check('새로고침 뒤 세계 유지', await ev(() => window.__gv.S.settles.length >= 2 && window.__gv.S.explored.flat().filter(Boolean).length === 12 && window.__gv.S.stats.marry >= 1));

  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL PASS');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
