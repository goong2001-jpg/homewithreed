// 실행: (seed-town 폴더에서) python3 -m http.server 8154 &  →  node test/smoke.js
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const BASE = 'http://localhost:8154';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }

// ---- 엔진 (브라우저 없이) ----
(function engine() {
  const P = E.newPlayer('t', D, 42);
  check('처음 동전·소식 카드', P.coins === D.RULES.startCoins && !!E.newsCard(P, D));
  check('처음 씨앗 값은 동전 1개', D.SHOPS.every(s => Math.abs(P.world.shops[s.id].price - 1) < 1e-9));
  check('심으면 동전이 줄고 내 몫이 생김', E.invest(P, D, 'bread', 3) && P.coins === D.RULES.startCoins - 3 && E.valueOf(P, 'bread') === 3);
  check('동전보다 많이는 못 심음', !E.invest(P, D, 'book', 999));
  check('첫 씨앗 배지는 한 번만', E.checkBadges(P, D, null).length === 1 && E.checkBadges(P, D, null).length === 0 && P.stars === 1);
  E.guess(P, 'good');
  const before = P.coins, out = E.nextTurn(P, D);
  check('계절이 넘어가고 심부름 동전을 받음', P.world.turn === 1 && P.coins === before + D.RULES.allowance && !!out.news);
  check('가게 장부가 기록됨', P.world.shops.bread.hist.length === 1 && P.world.shops.bread.hist[0].sales > 0);
  check('같은 씨앗값이면 같은 결과', (() => { const a = E.newPlayer('a', D, 7), b = E.newPlayer('b', D, 7); for (let i = 0; i < 12; i++) { E.nextTurn(a, D); E.nextTurn(b, D); } return JSON.stringify(a.world) === JSON.stringify(b.world); })());
  // 48계절(12일) 여러 판: 고루 나눠 심으면 대체로 늘고, 장난감 가게는 가끔 문을 닫는다
  let grew = 0, closes = 0, first = [], rumors = 0;
  const N = 120;
  for (let g = 0; g < N; g++) {
    const Q = E.newPlayer('q', D, g * 7919 + 3); let ff = null;
    for (let t = 0; t < 48; t++) {
      const card = E.newsCard(Q, D); if (card.kind === 'rumor') rumors++;
      E.guess(Q, card.kind === 'rumor' ? 'unknown' : card.kind);
      let i = 0; while (Q.coins > 0 && i < 12) E.invest(Q, D, D.SHOPS[(t + i++) % 6].id, 1);
      const o = E.nextTurn(Q, D); closes += o.closed.length; if (o.fruits && ff === null) ff = t;
      D.SHOPS.forEach(s => E.harvest(Q, s.id));
    }
    if (E.wealth(Q) > D.RULES.startCoins + 48 * D.RULES.allowance) grew++;
    first.push(ff === null ? 99 : ff);
    if (g === 0) check('소식을 다 맞히면 별이 쌓임', Q.stats.news + Q.stats.rumor === Q.stats.seen && Q.stats.seen === 48);
  }
  first.sort((a, b) => a - b);
  check('나눠 심으면 10판 중 9판 이상 늘어남', grew >= N * 0.9, grew + '/' + N);
  check('첫 열매는 첫날(4계절) 안에', first[N >> 1] <= 3, 'median ' + first[N >> 1]);
  check('문 닫는 가게가 드물게 나옴', closes >= 1 && closes <= N * 0.4, closes + '회/' + N + '판');
  check('소문 카드가 섞임', rumors > 0);
  // 하루 제한
  const R = E.newPlayer('r', D, 1); E.touchDay(R, '2026-01-01');
  for (let i = 0; i < D.RULES.turnsPerDay; i++) E.nextTurn(R, D);
  check('하루 4계절까지', !E.canPlay(R, D));
  E.touchDay(R, '2026-01-02');
  check('다음 날 다시 열림', E.canPlay(R, D) && R.log.length === 2);
})();

// ---- 화면 ----
(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(BASE + '/index.html');
  await p.waitForFunction(() => window.__st);
  const ev = fn => p.evaluate(fn);
  check('첫 화면: 누가 할까요', (await p.locator('[data-act=who]').count()) === 4);
  await p.click('[data-act=who][data-id="구름"]');
  check('처음이면 설명이 나옴', (await p.locator('.intro li').count()) === 3);
  await p.click('[data-act=introOk]');
  check('가게 6곳', (await p.locator('.shop').count()) === 6);
  check('소식 카드가 먼저 뜸', await p.locator('.newstext').isVisible());
  check('처음엔 "아직 몰라요"가 없음', (await p.locator('[data-act=guess]').count()) === 2);
  await p.click('[data-act=guess][data-id=good]');
  check('고르면 닫힘', await p.locator('#sheet').isHidden());
  for (const id of ['bread', 'fruit', 'book']) {
    await p.click(`[data-act=shop][data-id=${id}]`);
    await p.click('[data-act=plant][data-n="1"]');
    await p.click('[data-act=plant][data-n="1"]');
    await p.click('[data-act=close]');
  }
  check('세 곳에 2개씩 심음', await ev(() => { const P = window.__st.P(); return Object.keys(P.hold).length === 3 && P.coins === window.__st.D.RULES.startCoins - 6; }));
  check('배지 2개(나도 주인·나눠 담기)', await ev(() => Object.keys(window.__st.P().badges).length === 2));
  await p.click('[data-act=next]');
  check('계절 결과 창', (await p.locator('.rows li').count()) === 6 && await p.locator('.answer').isVisible());
  await p.click('[data-act=resultOk]');
  check('다음 소식이 뜸', await p.locator('.newstext').isVisible());
  for (let i = 0; i < 3; i++) { await p.click('[data-act=guess][data-id=bad]'); await p.click('[data-act=next]'); await p.click('[data-act=resultOk]'); }
  check('4계절 뒤 하루 끝 화면', await p.locator('.years').isVisible() && await ev(() => window.__st.P().world.turn === 4));
  await p.click('[data-act=close2]');
  check('오늘은 더 못 넘김', (await p.locator('.go.rest').count()) === 1);
  // 열매 따기
  await ev(() => { const g = window.__st; g.P().hold.bread.ripe = 2; g.render(); });
  await p.click('[data-act=close2]');
  const c0 = await ev(() => window.__st.P().coins);
  await p.click('[data-act=pick][data-id=bread]', { force: true });   // 단추가 통통 튀어서 force
  check('열매를 따면 동전이 됨', await ev(() => window.__st.P().coins) === c0 + 2);
  // 꺼내기는 두 번 눌러야
  await p.click('[data-act=close2]', { timeout: 800 }).catch(() => {});
  await p.click('[data-act=shop][data-id=book]');
  await p.click('[data-act=pull]');
  check('꺼내기 한 번으로는 안 꺼내짐', await ev(() => !!window.__st.P().hold.book));
  await p.click('[data-act=pull]');
  check('두 번 누르면 꺼내짐', await ev(() => !window.__st.P().hold.book));
  // 어른 메뉴
  await p.click('[data-act=close2]', { timeout: 800 }).catch(() => {});
  await p.click('[data-act=parent]');
  const m = (await p.textContent('.sheetbody .desc')).match(/(\d+) × (\d+)/);
  await p.fill('#gateIn', '1'); await p.click('#gateF button');
  check('틀린 답으로는 못 들어감', (await p.locator('.ledger').count()) === 0);
  await p.fill('#gateIn', String(m[1] * m[2])); await p.click('#gateF button');
  check('어른 메뉴: 장부·관찰 기록', (await p.locator('.ledger tr').count()) === 7 && (await p.locator('.days button').count()) === 1);
  await p.click('.days button');
  check('"스스로 열었어요" 표시', await ev(() => window.__st.P().log[0].self === true));
  await p.click('[data-act=more]');
  check('한 해 더 열기', await ev(() => window.__st.E.canPlay(window.__st.P(), window.__st.D)));
  // 다시 열어도 그대로
  await p.reload(); await p.waitForFunction(() => window.__st);
  check('새로 고쳐도 기록이 남음', await ev(() => window.__st.P() && window.__st.P().world.turn === 4));
  // 소문은 8계절부터
  await ev(() => { const g = window.__st, P = g.P(); while (P.world.turn < 9) { g.E.guess(P, 'good'); g.E.nextTurn(P, g.D); } P.turnsToday = 0; g.render(); });
  check('나중엔 "아직 몰라요"가 생김', (await p.locator('[data-act=guess]').count()) === 3);
  if (process.env.SHOT) { await p.click('[data-act=guess][data-id=good]'); await p.screenshot({ path: process.env.SHOT }); }
  check('오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n실패 ' + fail.length + '개: ' + fail.join(', ') : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
