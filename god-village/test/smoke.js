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

  // ---- 첫 화면 ----
  check('석기 시대로 시작', (await t('#eraNm')) === '석기 시대');
  check('시민 3명', await ev(() => window.__gv.S.pop.length === 3));
  check('자원 나무·바위·덤불·사슴 배치', await ev(() => { const n = window.__gv.S.nodes; return n.some(x => x.type === 'tree') && n.some(x => x.type === 'rock') && n.some(x => x.type === 'bush') && n.some(x => x.type === 'deer'); }));
  check('믿음 표시', (await t('#faith')).includes('✨'));
  check('신의 힘 버튼 7개', (await p.locator('.pw').count()) === 7);
  check('픽셀 캔버스', await ev(() => document.getElementById('field').width < 200));

  // ---- 스스로 발전: 자원 모으고 토템 짓고 ----
  await p.waitForFunction(() => window.__gv.S.blds.some(b => b.type === 'totem' && b.done), null, { timeout: 60000 });
  check('시민들이 스스로 토템을 세움', true);
  check('자원이 늘어남', await ev(() => window.__gv.S.res.wood + window.__gv.S.res.stone + window.__gv.S.res.food > 20));

  // ---- 신의 힘: 식량 떨어뜨리기 → 시민이 주움 ----
  const faith0 = await ev(() => window.__gv.S.faith);
  await ev(() => { window.__gv.S.faith = 50; });
  await p.click('.pw[data-power="food"]');
  check('힘 선택됨', (await p.locator('.pw[data-power="food"].on').count()) === 1);
  const box = await p.locator('#field').boundingBox();
  const c = await ev(() => { const c = window.__gv.center(), F = window.__gv.F; return { x: (c.x + 10) * F.pix, y: (c.y + 6) * F.pix }; });
  await p.mouse.click(box.x + c.x, box.y + c.y);
  check('선물이 땅에 떨어짐', await ev(() => window.__gv.S.gifts.length === 1 || window.__gv.S.stats.gifts === 1));
  check('믿음 5 소모', await ev(() => window.__gv.S.faith === 45), String(await ev(() => window.__gv.S.faith)));
  const food0 = await ev(() => window.__gv.S.res.food);
  await p.waitForFunction(() => window.__gv.S.gifts.length === 0, null, { timeout: 20000 });
  check('시민이 선물을 주워 식량 증가', await ev(f => window.__gv.S.res.food > f + 20, food0));

  // ---- 영감 → 지식 → 발견 ----
  await ev(() => { window.__gv.S.faith = 100; });
  await p.click('.pw[data-power="idea"]');
  await p.mouse.click(box.x + c.x, box.y + c.y);
  check('영감으로 지식 +25', await ev(() => window.__gv.S.res.know >= 25));
  await ev(() => window.__gv.slowTick(Date.now()));
  check('불을 발견(지식 20 이상이면)', await ev(() => window.__gv.S.techs.includes('fire')));
  check('업적 "첫 불꽃"', await ev(() => window.__gv.S.ach.includes('first_fire')));

  // ---- 신탁 ----
  await p.click('.pw[data-power="oracle"]');
  await p.waitForSelector('#oracleSheet:not([hidden])');
  await p.click('#oracleList [data-oracle="know"]');
  check('신탁 적용', await ev(() => window.__gv.S.oracle && window.__gv.S.oracle.id === 'know'));
  check('신탁 표시', (await t('#oracleLine')).includes('지혜'));

  // ---- 시민 들어 옮기기 (드래그) ----
  const v = await ev(() => { const v = window.__gv.S.pop[0], F = window.__gv.F; return { id: v.id, x: v.x * F.pix, y: (v.y - 6) * F.pix }; });
  const tree = await ev(() => { const n = window.__gv.S.nodes.find(x => x.type === 'tree'), F = window.__gv.F; return { x: (n.x + 4) * F.pix, y: (n.y + 2) * F.pix }; });
  await p.mouse.move(box.x + v.x, box.y + v.y); await p.mouse.down(); await p.mouse.move(box.x + v.x + 30, box.y + v.y, { steps: 5 });
  check('드래그 중 들려 있음', await ev(id => window.__gv.S.pop.find(x => x.id === id).held, v.id));
  await p.mouse.move(box.x + tree.x, box.y + tree.y, { steps: 8 }); await p.mouse.up();
  check('나무 옆에 내려놓으면 나무꾼이 됨', await ev(id => { const v = window.__gv.S.pop.find(x => x.id === id); return !v.held && v.job === 'lumber' && v.nudge > Date.now(); }, v.id));
  check('옮긴 횟수 기록', await ev(() => window.__gv.S.stats.moves === 1 && window.__gv.S.daily.move === 1));

  // ---- 소원 ----
  await ev(() => { window.__gv.S.nextWish = 0; window.__gv.slowTick(Date.now()); });
  check('소원 생성', await ev(() => window.__gv.S.wishes.length >= 1));
  check('소원 카드 표시', (await p.locator('#wishList .wish').count()) >= 1);

  // ---- 늑대 + 번개 ----
  await ev(() => { const S = window.__gv.S; S.wolves.push({ id: 'w1', x: 20, y: 60, hp: 40, until: Date.now() + 60000, walk: 0, face: 1 }); });
  const wpos = await ev(() => { const F = window.__gv.F, w = window.__gv.S.wolves[0]; return { x: w.x * F.pix, y: w.y * F.pix }; });
  await p.click('.pw[data-power="smite"]');
  await p.mouse.click(box.x + wpos.x, box.y + wpos.y);
  check('번개로 늑대 처치', await ev(() => window.__gv.S.wolves.length === 0 || window.__gv.S.wolves[0].hp <= 0));

  // ---- 시대 넘기기(치트) → 옷·집 바뀜 ----
  await p.click('.navbtn[data-panel="more"]');
  await p.click('#godEra');
  check('청동기 시대로', await ev(() => window.__gv.S.era === 1));
  check('시대 배지 갱신', (await t('#eraNm')) === '청동기 시대');
  await p.click('#panel .sheet-title .x');

  // ---- 패널 ----
  await p.click('.navbtn[data-panel="tech"]');
  check('발견 목록', (await p.locator('#techList .tech').count()) >= 5);
  await p.click('.navbtn[data-panel="bld"]');
  check('건물 목록', (await p.locator('#bldList .item').count()) >= 1);
  await p.click('.navbtn[data-panel="ach"]');
  check('업적 목록', (await p.locator('#achList .item').count()) === 13);
  await p.click('.navbtn[data-panel="pop"]');
  check('시민 목록', (await p.locator('#popList .item').count()) >= 3);
  await p.click('#panel .sheet-title .x');

  // ---- 절전 ----
  await p.click('#sleepBtn');
  check('절전 화면', !(await p.locator('#sleep').isHidden()));
  await p.click('#sleep');
  check('절전 해제', await p.locator('#sleep').isHidden());

  // ---- 저장/복원 + 오프라인 정산 ----
  await ev(() => { const S = window.__gv.S; S.rate = { food: 10, wood: 4, stone: 2, metal: 0, know: 6, faith: 3, born: 0 }; window.__gv.save(); const s = JSON.parse(localStorage.getItem('god-village-v1')); s.lastTick = Date.now() - 2 * 3600000; localStorage.setItem('god-village-v1', JSON.stringify(s)); window.__gv.lock = true; });
  const faithPre = await ev(() => window.__gv.S.faith);
  await p.reload();
  await p.waitForSelector('#welcome:not([hidden])');
  const wt = await t('#welcomeText');
  check('오프라인 정산 창(2시간, 50%)', wt.includes('2시간') && wt.includes('50%'), wt.replace(/\n/g, ' '));
  check('믿음 50% 정산 (3×120×0.5=180 이상)', await ev(f => window.__gv.S.faith >= f + 180, faithPre), String(await ev(() => window.__gv.S.faith)));
  await p.click('#welcomeOk');
  check('새로고침 뒤 시대·시민 유지', await ev(() => window.__gv.S.era === 1 && window.__gv.S.pop.length >= 3 && window.__gv.S.techs.includes('fire')));

  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  check('페이지 오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n' + fail.length + ' FAILED' : '\nALL PASS');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
