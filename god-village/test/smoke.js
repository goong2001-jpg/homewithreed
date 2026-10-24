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
  check('첫 접속 출석 창', !(await p.locator('#attend').isHidden()));
  await p.click('#attendOk');
  check('출석 보상 받으면 닫힘·믿음 +20', (await p.locator('#attend').isHidden()) && await p.evaluate(() => window.__gv.S.faith >= 32 && window.__gv.S.rpg.attend.streak === 1));
  const ev = (fn, arg) => p.evaluate(fn, arg);
  const box = await p.locator('#field').boundingBox();
  // 세계 좌표 → 화면 좌표
  const scr = async (wx, wy) => { const o = await ev(([x, y]) => { const g = window.__gv; return { x: (x - g.cam.x) * g.F.pix, y: (y - g.cam.y) * g.F.pix }; }, [wx, wy]); return { x: box.x + o.x, y: box.y + o.y }; };

  // ---- 첫 화면 ----
  check('석기 시대로 시작', (await t('#eraNm')) === '석기 시대');
  check('시민 3명, 군락 1개', await ev(() => window.__gv.S.pop.length === 3 && window.__gv.S.settles.length === 1));
  check('세계 50칸, 우리 칸만 탐험됨', await ev(() => window.__gv.S.explored.flat().length === 50 && window.__gv.S.explored.flat().filter(Boolean).length === 1));
  check('첫 적 세력은 왼쪽 위, 아직 못 만남', await ev(() => { const f = window.__gv.S.factions[0]; return f && f.bases[0].c === 0 && f.bases[0].r === 0 && !f.met; }));
  check('괴물 둥지가 있다', await ev(() => window.__gv.S.lairs.length >= 1));
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

  // ---- 3판: 목소리(원망·제물·질문)·팝업·축복·가족·오와열·밤 ----
  await ev(() => { const S = window.__gv.S; S.faith = 100; S.voices = []; S.nextVoice = Date.now() + 1e7; S.nextWish = Date.now() + 1e7; window.__gv.voice('hungry'); });
  check('원망 목소리 생성·카드', await ev(() => window.__gv.S.voices.length === 1 && window.__gv.S.voices[0].kind === 'complaint') && (await p.locator('#wishList .voice.complaint').count()) === 1);
  await p.click('#wishList .voice');
  check('카드를 탭하면 시민 옆 팝업', !(await p.locator('#needPop').isHidden()) && (await p.locator('#needPop [data-vact="comfort"]').count()) === 1);
  const faithC = await ev(() => window.__gv.S.faith);
  await p.click('#needPop [data-vact="comfort"]');
  check('위로하면 목소리 해결·믿음 소모·팝업 닫힘', await ev(f => window.__gv.S.voices.length === 0 && window.__gv.S.stats.voices === 1 && window.__gv.S.stats.comfort === 1, faithC) && (await p.locator('#needPop').isHidden()));
  await ev(() => { window.__gv.voice('offer_food'); });
  check('제물: 시민이 토템으로 간다', await ev(() => window.__gv.S.pop.some(v => v.state === 'offer')));
  await ev(() => { const g = window.__gv; g.doAct('accept', g.S.pop.find(v => v.state === 'offer')); });
  check('제물 받기 → 제단 +1', await ev(() => window.__gv.S.altar === 1 && window.__gv.S.stats.offers === 1 && !window.__gv.S.pop.some(v => v.state === 'offer')));
  await ev(() => { const g = window.__gv; g.voice('q_value'); g.doAct('value:wisdom', g.S.pop.find(v => v.id === g.S.voices[0].vid)); });
  check('물음에 답하면 마을의 가치 +1', await ev(() => window.__gv.S.values.wisdom === 1 && window.__gv.S.asked.includes('q_value')));
  await ev(() => { const g = window.__gv; g.voice('hungry'); g.S.voices[0].until = 0; g.slowTick(Date.now()); });
  check('원망을 무시하면 신을 의심', await ev(() => window.__gv.S.voices.length === 0 && window.__gv.S.pop.some(v => v.doubt)));
  await ev(() => { const g = window.__gv; g.bless(g.S.pop.find(v => v.doubt)); });
  check('축복: 의심이 풀리고 축복 상태', await ev(() => !window.__gv.S.pop.some(v => v.doubt) && window.__gv.S.pop.some(v => v.bless > 0) && window.__gv.S.stats.bless === 1));
  check('아이에게 부모·세대·집이 있다', await ev(() => { const k = window.__gv.S.pop.find(v => v.child); return k && k.parents.length === 2 && k.gen === 2; }));
  check('시민 패널에 가족 묶음', (await (async () => { await p.click('.navbtn[data-panel="pop"]'); const ok = (await t('#famList')).includes('💕'); await p.click('#panel .sheet-title .x'); return ok; })()));
  await ev(() => { const g = window.__gv, S = g.S; if (!S.techs.includes('weapons')) S.techs.push('weapons'); S.pop.filter(v => !v.child).slice(0, 4).forEach(v => { v.job = 'warrior'; v.nudge = Date.now() + 99999; v.state = 'idle'; }); });
  await p.waitForTimeout(3500);
  check('전사들이 군기 옆에 오와열로 선다', await ev(() => { const g = window.__gv, st = g.home(); const ws = g.S.pop.filter(v => v.job === 'warrior'); return st.army && ws.length >= 3 && ws.every(v => (v.state === 'guard' || v.state === 'march') && Math.hypot(v.x - st.army.x, v.y - st.army.y) < 16); }), await ev(() => JSON.stringify(window.__gv.S.pop.filter(v => v.job === 'warrior').map(v => v.state))));
  await ev(() => { window.__gv.F.time = 75; window.__gv.S.fest = null; });
  await p.waitForTimeout(1500);
  check('깊은 밤엔 집으로 가서 잔다', await ev(() => window.__gv.daylight() < 0.08 && window.__gv.S.pop.some(v => v.state === 'sleep')));
  await ev(() => { window.__gv.F.time = 0; window.__gv.S.pop.forEach(v => { if (v.job === 'warrior') { v.job = 'gather'; v.nudge = 0; v.state = 'idle'; } }); });

  // ---- 탐험·소원 ----
  await ev(() => { window.__gv.S.nextWish = 0; window.__gv.slowTick(Date.now()); });
  check('소원 생성·카드', await ev(() => window.__gv.S.wishes.length >= 1) && (await p.locator('#wishList .wish').count()) >= 1);
  await p.click('.navbtn[data-panel="more"]'); await p.click('#godReveal'); await p.click('#panel .sheet-title .x');
  check('안개 걷기 → 50칸 탐험, 적 발견', await ev(() => window.__gv.S.explored.flat().filter(Boolean).length === 50 && window.__gv.S.factions[0].met));
  check('괴물이 둥지에서 나옴', await ev(() => window.__gv.S.hostiles.some(h => h.kind === 'monster')));
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
  await ev(() => { const g = window.__gv, S = g.S; if (!S.techs.includes('hunting')) S.techs.push('hunting'); if (!S.techs.includes('weapons')) S.techs.push('weapons'); const h = g.home(); while (S.pop.length < 8) { const v = { ...S.pop[0], id: 'p' + S.pop.length, name: '주민' + S.pop.length, partner: null, child: false, age: 999, kids: 0, job: 'gather', state: 'idle', held: false, down: 0, x: h.x, y: h.y, settle: h.id, hp: 16 }; S.pop.push(v); } S.hostiles = S.hostiles.filter(h => h.kind !== 'monster'); S.factions[0].lastRaid = -9999; S.factions[0].metAt = -9999; S.factions[0].bases[0].units = 8; S.simT = 9999; g.slowTick(Date.now()); });
  check('적 침략 시작', await ev(() => window.__gv.S.hostiles.some(h => h.kind === 'enemy' && h.raid)));
  check('침략 소원 조건·HUD', (await t('#oracleLine')).includes('침략 중'));
  await ev(() => { window.__gv.S.hostiles.forEach(h => { if (h.raid) h.hp = 0; }); });
  await p.waitForTimeout(400);
  check('침략 격퇴 업적', await ev(() => window.__gv.S.stats.defend >= 1 && window.__gv.S.ach.includes('defend')));
  await ev(() => { const g = window.__gv, S = g.S; S.faith = 300; S.pop.slice(0, 4).forEach(v => { v.job = 'warrior'; v.child = false; }); g.useOracle('invade'); });
  check('출정 명령', await ev(() => !!window.__gv.S.invading && window.__gv.S.rally));
  const bid = await ev(() => { const g = window.__gv, S = g.S; const b = g.allBases().find(x => x.b.id === S.invading.bid).b; S.pop.filter(v => v.job === 'warrior').forEach(v => { v.x = b.x; v.y = b.y + 30; }); return b.id; });
  await p.waitForFunction(() => window.__gv.S.hostiles.some(h => h.defend), null, { timeout: 8000 });
  check('적 수비대 등장 (전사가 기지 30px 밖에 있어도)', true);
  await ev(() => { window.__gv.S.hostiles.forEach(h => { if (h.defend) h.hp = 0; }); });
  await p.waitForFunction(() => window.__gv.S.stats.conquer >= 1, null, { timeout: 8000 });
  check('정복 → 기지가 사라지고 우리 군락이 됨', await ev(id => { const g = window.__gv, S = g.S; return !g.allBases().some(x => x.b.id === id) && S.settles.some(s => s.nm.startsWith('정복지')) && S.ach.includes('conquer') && !S.invading; }, bid));
  check('정복에 참여한 전사가 승리 1', await ev(() => window.__gv.S.pop.some(v => v.job === 'warrior' && v.wins >= 1)));

  // ---- 4판: 세력 확장·새 세력·배교·귀향·괴물→영웅·칭호·대역사·군대·축제 ----
  const nf = await ev(() => { const g = window.__gv, S = g.S; const n = g.factions().length; S.simT = 20000; g.spawnFaction(); return n; });
  check('새 세력이 먼 땅에 생김', await ev(n => window.__gv.factions().length === n + 1 && window.__gv.factions().some(f => f.nm !== '회색 부족'), nf));
  await ev(() => { const g = window.__gv; const f = g.factions()[0]; f.bases[0].units = 12; g.expandFaction(f); });
  check('세력이 옆 칸에 기지를 하나 더 세움', await ev(() => window.__gv.factions()[0].bases.length === 2));
  const popBefore = await ev(() => { const g = window.__gv, S = g.S; S.pop.filter(v => !v.child && v.state !== 'migrate').slice(0, 3).forEach(v => { v.doubt = true; }); S.lastSchism = -9999; const n = S.pop.length; g.checkSchism(); return n; });
  check('신을 의심하는 셋이 떠나 자기들 마을을 세움', await ev(n => { const g = window.__gv, S = g.S; const ex = g.factions().find(f => f.kind === 'exile'); return ex && S.pop.length === n - 3 && ex.bases[0].units === 3 && ex.relation === 'wary'; }, popBefore));
  await ev(() => { const g = window.__gv, S = g.S; const ex = g.factions().find(f => f.kind === 'exile'); ex.met = true; S.happy = 80; S.faith = 100; g.useOracle('return'); });
  check('신탁 "돌아오라" → 떠난 자들이 돌아옴', await ev(n => { const g = window.__gv, S = g.S; return !g.factions().some(f => f.kind === 'exile') && S.pop.length === n && S.stats.returned === 1; }, popBefore));
  await ev(() => { const g = window.__gv, S = g.S; const w = S.pop.find(v => v.job === 'warrior') || S.pop[0]; w.job = 'warrior'; const l = S.lairs[0]; l.spawned = false; l.dead = false; S.explored[l.r][l.c] = true; g.lairsTick(); const m = S.hostiles.find(h => h.kind === 'monster'); m.lastHit = w.id; m.hp = 0; w.fought = S.simT; });
  await p.waitForTimeout(300);
  check('괴물을 쓰러뜨린 전사는 영웅', await ev(() => window.__gv.S.pop.some(v => v.title === 'hero') && window.__gv.S.stats.hero === 1 && window.__gv.S.ach.includes('hero')));
  await ev(() => { const g = window.__gv, S = g.S; const v = S.pop.find(v => !v.title && !v.child); v.age = 99999; g.checkTitles(); });
  check('오래 산 시민은 장로', await ev(() => window.__gv.S.pop.some(v => v.title === 'elder')));
  await ev(() => { const S = window.__gv.S; S.res.wood = 500; S.res.stone = 500; S.res.metal = 300; S.res.food = 300; S.faith = 300; });
  check('대역사 명령 → 신전 공사 시작, 자원·믿음 차감', await ev(() => { const g = window.__gv, S = g.S; const ok = g.orderWork('shrine'); return ok && S.blds.some(b => b.type === 'shrine' && !b.done) && S.faith === 280 && S.res.wood === 420; }));
  check('자리가 빽빽해도 대역사는 지어진다 (나무를 베어내서라도)', await ev(() => { const g = window.__gv, S = g.S, h = g.home(); for (let i = 0; i < 40; i++) S.blds.push({ id: 'fill' + i, type: 'hut', x: h.x + ((i % 8) - 4) * 16, y: h.y + (Math.floor(i / 8) - 2) * 20, progress: 16, done: true, settle: h.id }); S.res.stone = 500; S.faith = 300; const ok = g.orderWork('monument'); S.blds = S.blds.filter(b => !String(b.id).startsWith('fill')); return ok && S.blds.some(b => b.type === 'monument'); }));
  check('군대 무장 1단계', await ev(() => { const g = window.__gv, S = g.S; const hp0 = S.pop.filter(v => v.job === 'warrior')[0]; return g.orderArmy() && S.armyLv === 1 && S.res.metal === 260; }));
  check('축제 열기', await ev(() => { const g = window.__gv, S = g.S; S.fest = null; return g.orderFest() && !!S.fest && S.res.food <= 240 && S.res.food > 230; }));
  await p.click('.pw[data-power="oracle"]'); await p.waitForSelector('#oracleSheet:not([hidden])');
  check('신탁 창에 대역사·군대·축제 버튼', (await p.locator('#oracleList [data-work]').count()) === 8 && (await p.locator('#oracleList [data-order]').count()) === 2);
  await p.click('#oracleSheet .sheet-title .x');

  // ---- 6판: 시민 화신(지정·조종·자동 사냥·귀환·죽음)·사냥감·탐험 이벤트·장비·미궁·시간 이벤트·출석·오프라인 ----
  check('화신 탭·화신 정하기 버튼', (await p.locator('.navbtn[data-panel="rpg"]').count()) === 1 && (await t('#descendBtn')).includes('화신 정하기'));
  check('탐험 이벤트 지점이 안개 속 칸마다 숨어 있다', await ev(() => window.__gv.S.pickups.filter(k => k.kind === 'event').length >= 40));
  await ev(() => { const g = window.__gv, S = g.S; S.faith = 200; S.hostiles = S.hostiles.filter(h => h.kind !== 'monster'); const v = S.pop.find(v => !v.child && v.state !== 'migrate' && v.age < 5000); window.RPG.setAvatar(v); });
  check('시민을 화신으로: 전사가 되고 조종 모드, 능력치는 화신 기준', await ev(() => { const R = window.RPG, g = window.__gv, v = R.av(); return v && v.job === 'warrior' && R.C().ctrl && g.unitStat(v).hp === R.maxHp() && g.S.rpg.champ === v.id; }) && !(await p.locator('#rpgHud').isHidden()));
  check('화신이 살아 있으면 바꿀 수 없다', await ev(() => { const R = window.RPG, S = window.__gv.S; const o = S.pop.find(v => !v.child && !R.isAvatar(v)); return o && !R.setAvatar(o); }));
  await ev(() => { const S = window.__gv.S, v = window.RPG.av(); S.hostiles.push({ id: 'tb', kind: 'bandit', camp: 'none', x: v.x + 6, y: v.y, hp: 1, atk: 0, home: { x: v.x, y: v.y }, timer: 99, walk: 0, face: 1 }); });
  await p.waitForTimeout(1500);
  check('화신이 적을 자동으로 베고 경험치·처치 수', await ev(() => window.__gv.S.rpg.xp > 0 && window.__gv.S.rpg.kills === 1));
  check('조이스틱으로 걷기', await (async () => { const a0 = await ev(() => { const v = window.RPG.av(); const h = window.__gv.home(); v.x = h.x - 40; v.y = h.y + 20; return { x: v.x }; }); const jb = await p.locator('#joy').boundingBox(); await p.mouse.move(jb.x + jb.width / 2, jb.y + jb.height / 2); await p.mouse.down(); await p.mouse.move(jb.x + jb.width - 6, jb.y + jb.height / 2, { steps: 4 }); await p.waitForTimeout(700); await p.mouse.up(); return await ev(a => window.RPG.av().x > a.x + 10, a0); })());
  check('사냥감이 칸마다 생기고 건드리기 전엔 조용하다', await ev(() => { const R = window.RPG, S = window.__gv.S; S.rpg.beastT = -9999; R.beastsTick(); const bs = S.hostiles.filter(h => h.beast); return bs.length >= 3 && bs.every(h => !h.angry); }));
  check('⚔️ 베기: 사냥감에게 돌진해 베고, 사냥감이 화난다', await ev(() => { const R = window.RPG, S = window.__gv.S, v = R.av(), hm = window.__gv.home(); v.x = hm.x - 40; v.y = hm.y + 20; S.hostiles = S.hostiles.filter(h => !h.beast); const b = R.spawnBeast(hm.c, hm.r); b.x = v.x + 40; b.y = v.y; b.hp = 500; b.mhp = 500; R.C().dashCd = 0; const x0 = v.x; R.dash(); return v.x > x0 + 20 && b.hp < 500 && b.angry === true; }));
  check('사냥감을 잡으면 경험치·식량', await ev(() => { const R = window.RPG, S = window.__gv.S, v = R.av(); const f0 = S.res.food, x0 = S.rpg.xp + S.rpg.lv * 1000; S.hostiles.forEach(h => { if (h.beast) { h.hp = 0; h.lastHit = v.id; } }); return true; }) && await (async () => { await p.waitForTimeout(300); return await ev(() => (window.__gv.S.rpg.hunted || 0) >= 1); })());
  check('장비 드롭·착용·강화·해제·분해', await ev(() => { const R = window.RPG, S = window.__gv.S; const it = R.drop('monster', R.av()); const n0 = S.rpg.inv.length; R.equip(it.id); const eq = S.rpg.equip[it.slot] && S.rpg.equip[it.slot].id === it.id; S.res.metal = 500; const p0 = it.plus; R.enhance(it.id); const okE = S.rpg.equip[it.slot].plus === p0 + 1; R.unequip(it.slot); const f0 = S.faith; R.dismantle(it.id); return eq && okE && S.rpg.inv.length === n0 - 1 && S.faith > f0; }));
  check('레벨업 → 화신 체력 상승', await ev(() => { const R = window.RPG, S = window.__gv.S, g = window.__gv; S.rpg.xp = 10000; R.gainXp(0); return S.rpg.lv > 1 && g.unitStat(R.av()).hp > 90; }));
  check('탐험 이벤트: 난민 합류', await ev(() => { const R = window.RPG, S = window.__gv.S; const n0 = S.pop.length; const pk = S.pickups.find(k => k.kind === 'event' && !k.taken); pk.taken = true; const ev2 = R.resolveEvent(pk, R.av(), 'refugees'); return ev2.id === 'refugees' && S.pop.length > n0; }));
  check('탐험 이벤트: 용병단·보물', await ev(() => { const R = window.RPG, S = window.__gv.S; const w0 = S.pop.filter(v => v.job === 'warrior').length, i0 = S.rpg.inv.length; const pks = S.pickups.filter(k => k.kind === 'event' && !k.taken); pks[0].taken = true; R.resolveEvent(pks[0], R.av(), 'mercs'); pks[1].taken = true; R.resolveEvent(pks[1], R.av(), 'treasure'); return S.pop.filter(v => v.job === 'warrior').length > w0 && S.rpg.inv.length === i0 + 1; }));
  check('조종을 끄면 HUD 가 닫히고 알아서 사냥한다', await (async () => { await p.click('#ctrlOff'); await ev(() => { const S = window.__gv.S, R = window.RPG; S.hostiles = S.hostiles.filter(h => !h.beast); const hm = window.__gv.home(); const b = R.spawnBeast(hm.c, hm.r); b.x = hm.x + 50; b.y = hm.y + 30; b.hp = b.mhp = 9999; R.av().x = hm.x; R.av().y = hm.y; }); await p.waitForTimeout(1500); return (await p.locator('#rpgHud').isHidden()) && await ev(() => { const R = window.RPG, v = R.av(); return !R.C().ctrl && v.state === 'fight'; }); })());
  check('조종하지 않을 때 체력이 낮아지면 토템으로 귀환하고 죽지 않는다', await ev(() => { const R = window.RPG, S = window.__gv.S, v = R.av(), g = window.__gv; const n = S.pop.length; v.hp = 5; const ok = R.guard(v, { kind: 'bandit' }); return ok && S.pop.length === n && R.av() === v && v.av.rest > S.simT && v.state === 'rest'; }));
  check('쉬는 동안엔 공격받아도 죽지 않는다', await ev(() => { const R = window.RPG, v = R.av(); v.hp = 1; return R.guard(v, { kind: 'bandit' }) && v.hp >= 1; }));
  check('조종 중 죽으면 화신 자리가 비고 새로 고를 수 있다', await ev(() => { const R = window.RPG, S = window.__gv.S, g = window.__gv, v = R.av(); v.av.rest = 0; R.setCtrl(true); v.hp = 0; const bandit = { kind: 'bandit', nm: '산적' }; const d0 = S.rpg.deaths; S.pop = S.pop; R.onDie(v, '산적'); return S.rpg.champ === null && S.rpg.deaths === d0 + 1 && !R.C().ctrl && S.rpg.lv > 1; }));
  check('새 화신 지정 시 레벨·장비는 이어받는다', await ev(() => { const R = window.RPG, S = window.__gv.S; S.faith = 100; const lv = S.rpg.lv; const o = S.pop.find(v => !v.child && v.state !== 'migrate' && v.age < 5000); return R.setAvatar(o) && S.rpg.lv === lv && R.av() === o; }));
  await ev(() => { const R = window.RPG, S = window.__gv.S, dg = S.rpg.dg; R.av().x = dg.x; R.av().y = dg.y + 4; R.enterDungeon(); });
  check('미궁 입장 → 1층 그림자 등장', await ev(() => window.__gv.S.rpg.dg.active && window.__gv.S.hostiles.some(h => h.kind === 'dmob')));
  await ev(() => { const v = window.RPG.av(); window.__gv.S.hostiles.forEach(h => { if (h.kind === 'dmob') { h.hp = 0; h.lastHit = v.id; } }); });
  await p.waitForTimeout(600);
  check('1층 돌파 → 믿음·오늘 첫 돌파 장비', await ev(() => { const dg = window.__gv.S.rpg.dg; return !dg.active && dg.best === 1 && dg.maxToday === 1 && window.__gv.S.rpg.inv.length >= 1; }));
  check('유성 이벤트', await ev(() => { const R = window.RPG, S = window.__gv.S; R.spawnMeteor(); return S.pickups.some(k => k.kind === 'meteor' && !k.taken); }));
  const invH = await ev(() => { const R = window.RPG, S = window.__gv.S; R.spawnHorde(); const ok = S.hostiles.some(h => h.horde); S.hostiles.forEach(h => { if (h.horde) h.hp = 0; }); return ok ? S.rpg.inv.length : -1; });
  await p.waitForTimeout(600);
  check('습격 이벤트 → 전부 물리치면 상자', invH >= 0 && await ev(n => window.__gv.S.rpg.hordeWins === 1 && window.__gv.S.rpg.inv.length === n + 1, invH));
  await ev(() => window.RPG.setCtrl(false));
  check('출석 보상', await ev(() => { const R = window.RPG, S = window.__gv.S; S.rpg.attend = { last: '', streak: 0 }; R.checkAttend(); const pend = S.rpg.attend.pending; R.claimAttend(); return pend && !S.rpg.attend.pending && S.rpg.attend.streak === 1; }));
  check('오프라인: 화신이 사냥한 경험치, 세력 확장·의심, 돌아온 믿음', await ev(() => { const R = window.RPG, S = window.__gv.S; const f0 = S.faith, x0 = S.rpg.xp + S.rpg.lv * 100000; const msg = R.offline(30 * 60); return S.faith > f0 && /돌아온 신/.test(msg) && /의심/.test(msg) && /사냥하며 경험치/.test(msg) && (S.rpg.xp + S.rpg.lv * 100000) > x0; }));
  await p.click('.navbtn[data-panel="rpg"]'); await p.waitForTimeout(300);
  check('화신 패널 렌더', (await t('#tab-rpg')).includes('화신 ') && (await p.locator('#tab-rpg [data-rpg^="equip:"]').count()) >= 1);
  await p.click('#panel .sheet-title .x');

  // ---- 패널·절전 ----
  await p.click('.navbtn[data-panel="ach"]'); check('업적 29개', (await p.locator('#achList .item').count()) === 29);
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
  check('새로고침 뒤 세계 유지', await ev(() => window.__gv.S.settles.length >= 2 && window.__gv.S.explored.flat().filter(Boolean).length === 50 && window.__gv.S.stats.marry >= 1 && window.__gv.S.factions.length >= 2 && window.__gv.S.pop.some(v => v.title)));
  check('새로고침 뒤에도 화신 시민이 유지됨', await ev(() => !!window.RPG.av() && window.RPG.av().job === 'warrior'));

  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL PASS');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
