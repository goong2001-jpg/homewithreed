// 실행: (seed-town 폴더에서) python3 -m http.server 8154 &  →  node test/smoke.js
const path = require('path');
const D = require(path.join(__dirname, '..', 'data.js'));
const E = require(path.join(__dirname, '..', 'engine.js'));
const BASE = 'http://localhost:8154';
const fail = [];
function check(name, ok, extra) { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) fail.push(name); }

// ---- 엔진 (브라우저 없이) ----
(function engine() {
  check('기본은 모든 단계 하루 제한 없음', Object.values(D.RULES.turnsByStage).every(v => v === 0));
  D.RULES.turnsByStage.seed = 4;   // 제한 기능 자체가 살아 있는지 보려고 켠다
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

  // ---- v2: 단계 ----
  const S1 = E.newPlayer('s', D, 11);
  const seedOnly = () => { for (let i = 0; i < 60; i++) { const c = E.newsCard(S1, D); if (c.stage) return false; E.guess(S1, 'good'); E.nextTurn(S1, D); } return true; };
  check('씨앗 단계에는 공시·위기 카드가 안 나옴', seedOnly());
  const T1 = E.newPlayer('tr', D, 12); T1.stage = 'tree';
  let disc = 0, crisis = 0;
  for (let i = 0; i < 120; i++) { const c = E.newsCard(T1, D); if (c.kind === 'disc') disc++; if (c.note) crisis++; E.guess(T1, E.answerOf(c)); E.nextTurn(T1, D); }
  check('나무 단계에는 공시·위기 카드가 나옴', disc > 0 && crisis > 0, 'disc ' + disc + ' crisis ' + crisis);
  check('공시를 다 맞히면 전부 별', T1.stats.news + T1.stats.rumor === T1.stats.seen);
  // 유상증자: 주식 수가 늘고 값이 내려간다
  const U = E.newPlayer('u', D, 13); U.stage = 'tree';
  for (let i = 0; i < 4; i++) { E.guess(U, 'good'); E.nextTurn(U, D); }
  const sh0 = U.world.shops.toy.shares; U.news = { id: 'd_raise1', guess: 'bad' };
  const o2 = E.nextTurn(U, D);
  check('유상증자: 주식 수 25% 증가, 정답은 나쁜 소식', Math.abs(U.world.shops.toy.shares - sh0 * 1.25) < 1e-9 && o2.news.right);
  // 장부: 현금 증감 = 영업 − 투자 + 재무
  const ok = D.SHOPS.every(sd => { const h = U.world.shops[sd.id].hist; if (h.length < 2) return true; const a = h[h.length - 2], b = h[h.length - 1]; return Math.abs((b.cash - a.cash) - (b.profit - b.inv + b.borrow - b.repay - b.div)) < 0.05 || sd.id === 'toy'; });
  check('현금흐름표가 장부와 맞음', ok);
  // 새싹: 줄 맞히기
  const L = E.newPlayer('l', D, 14); L.stage = 'sprout'; L.news = { id: 'bread2', guess: 'bad' }; E.guessLine(L, 'cost');
  const o3 = E.nextTurn(L, D);
  check('새싹: "쓴 돈" 줄 맞히면 별 2개', o3.news.line.right && L.stats.line === 1 && L.stars === 2);
  // 절반 꺼내기
  E.invest(L, D, 'book', 6); const got = E.withdraw(L, 'book', true);
  check('절반 꺼내기', got === 3 && L.hold.book && E.valueOf(L, 'book') === 3);
  // 숲: 일지·문제
  const F = E.newPlayer('f', D, 15); F.stage = 'forest';
  E.invest(F, D, 'bread', 2, '꾸준해서'); E.invest(F, D, 'ice', 2, '');
  check('이유를 적어야 일지에 남음', F.journal.length === 1 && F.stats.reasoned === 1);
  check('장부가 없으면 문제도 없음', E.makeQuiz(F, D, 'bread') === null);
  E.guess(F, 'good'); E.nextTurn(F, D);
  const qz = E.makeQuiz(F, D, 'bread');
  check('공시 읽기 문제 3개, 보기 3개씩·정답이 계산과 맞음', qz.questions.length === 3 && qz.questions.every(q => q.options.length === 3 && new Set(q.options).size === 3) && qz.questions[0].options[qz.questions[0].answer] === Math.round(qz.row.profit / qz.row.sales * 100) + '%');
  // ---- v3: 세계 (실제 재무제표) ----
  const txt = '요약재무정보 (단위: 억원)\n매출액 1,200 1,050\n매출원가 700 640\n판매비와관리비 350 300\n영업이익(주1) 150 110\n당기순이익 110 (20)\n자산총계 1,200\n부채총계 400\n부채와자본총계 1,200\n자본총계 800\n영업활동으로 인한 현금흐름 △30\n발행주식총수 10,000,000\n주가 22,000';
  const rv = E.parseStatement(txt, D), ra = E.analyze(rv, { unit: 1e8 });
  check('붙여넣은 글에서 숫자를 읽음', rv.sales === 1200 && rv.net === 110 && rv.equity === 800 && rv.debt === 400 && rv.cfo === -30 && rv.shares === 1e7);
  check('비율 계산(PER 20·PBR 2.75·부채비율 50%·ROE 13.75%)', Math.abs(ra.per - 20) < 1e-9 && Math.abs(ra.pbr - 2.75) < 1e-9 && ra.debtRatio === 0.5 && Math.abs(ra.roe - 0.1375) < 1e-9);
  check('점검표: 흑자·빚 통과, 현금·그레이엄·버핏 주의', ra.checks.map(c => c.state).join() === 'ok,ok,warn,warn,warn');
  check('숫자가 모자라면 "자료 없음"', E.analyze({ sales: 10, net: 1 }, {}).checks.filter(c => c.state === 'na').length === 4);
  const rq = E.makeRealQuiz(rv, 0);
  check('실제 숫자로 문제 3개', rq.length === 3 && rq[0].options[rq[0].answer] === '9%' && rq[1].options[rq[1].answer] === '50%' && rq[2].options[rq[2].answer] === '13%');
  const W1 = E.newPlayer('w', D, 17); W1.stage = 'world';
  E.saveReal(W1, D, -1, '시험회사', { label: '1기', unit: 1e8, v: rv });
  E.predictReal(W1, 0, 'good', '매출이 늘어서');
  const rr = E.saveReal(W1, D, 0, '', { label: '2기', unit: 1e8, v: Object.assign({}, rv, { net: 140 }) });
  check('예측 → 다음 기간을 넣으면 복기', rr.review && rr.review.right && W1.stats.pred === 1 && W1.real[0].periods.length === 2 && W1.real[0].pred === null);
  // ---- v4: 이름별 단계, 어른은 하루 제한 없음 ----
  const Dad = E.newPlayer('아빠', D, 21), Kid = E.newPlayer('구름', D, 22);
  check('아빠는 세계, 구름이는 씨앗 단계로 시작', Dad.stage === 'world' && Kid.stage === 'seed');
  for (let i = 0; i < 12; i++) { E.guess(Dad, 'good'); E.nextTurn(Dad, D); }
  check('어른 단계는 하루 제한 없음', E.canPlay(Dad, D) && E.dayLimit(Dad, D) === 0 && E.dayLimit(Kid, D) === 4);
  const oldDad = E.newPlayer('아빠', D, 23); oldDad.stage = 'seed'; delete oldDad.stagePicked; E.upgrade(oldDad, D);
  const chose = E.newPlayer('아빠', D, 24); chose.stage = 'seed'; chose.stagePicked = 1; E.upgrade(chose, D);
  check('씨앗에 머물던 아빠 저장분은 세계로, 직접 고른 단계는 그대로', oldDad.stage === 'world' && chose.stage === 'seed');
  // 예전 저장분
  const old = E.newPlayer('o', D, 16); delete old.journal; delete old.looked; delete old.stats.quiz; delete old.world.shops.bread.shares;
  E.upgrade(old, D); E.guess(old, 'good'); E.nextTurn(old, D);
  check('v1 저장분도 그대로 이어짐', old.world.turn === 1 && old.world.shops.bread.shares === D.RULES.shares);
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
  await ev(() => { window.__st.D.RULES.turnsByStage.seed = 4; });   // 하루 제한 화면 검사용
  check('첫 화면: 누가 할까요', (await p.locator('[data-act=who]').count()) === 4);
  await p.click('[data-act=who][data-id="구름"]');
  check('처음이면 설명이 나옴', (await p.locator('.intro li').count()) === 3);
  await p.click('[data-act=introOk]');
  check('가게 6곳', (await p.locator('.shop').count()) === 6);
  check('소식 카드가 먼저 뜸', await p.locator('.newstext').isVisible());
  check('처음엔 "아직 몰라요"가 없음', (await p.locator('[data-act=guess]').count()) === 2);
  await p.click('[data-act=guess][data-id=good]');
  check('고르면 닫힘', await p.locator('#sheet').isHidden());
  check('길잡이: 마을에 말풍선이 뜨고 빵집이 반짝임', (await p.locator('#app .coach').count()) === 1 && (await p.locator('[data-act=shop][data-id=bread].hl').count()) === 1);
  await p.click('[data-act=shop][data-id=bread]');
  check('길잡이: 가게 창에서 심기 단추가 반짝임', (await p.locator('.sheetbody .coach').count()) === 1 && (await p.locator('[data-act=plant][data-n="1"].hl').count()) === 1);
  await p.click('[data-act=plant][data-n="1"]');
  check('길잡이: 심으면 새싹 설명으로 넘어감', (await p.textContent('.sheetbody .coach')).includes('새싹') && await ev(() => window.__st.P().tut === 3));
  await p.click('[data-act=plant][data-n="1"]');
  await p.click('[data-act=close]');
  check('길잡이: 닫으면 계절 단추가 반짝임', (await p.locator('[data-act=next].hl').count()) === 1);
  await p.click('[data-act=help]');
  check('도움말: 설명 10가지', (await p.locator('.helps li').count()) === 10);
  await p.click('.sheetbody [data-act=close]');
  for (const id of ['fruit', 'book']) {
    await p.click(`[data-act=shop][data-id=${id}]`);
    await p.click('[data-act=plant][data-n="1"]');
    await p.click('[data-act=plant][data-n="1"]');
    await p.click('[data-act=close]');
  }
  check('세 곳에 2개씩 심음', await ev(() => { const P = window.__st.P(); return Object.keys(P.hold).length === 3 && P.coins === window.__st.D.RULES.startCoins - 6; }));
  check('배지 2개(나도 주인·나눠 담기)', await ev(() => Object.keys(window.__st.P().badges).length === 2));
  await p.click('[data-act=next]');
  check('계절 결과 창', (await p.locator('.rows li').count()) === 6 && await p.locator('.answer').isVisible());
  check('길잡이: 결과 창에서 얼굴 설명', (await p.textContent('.sheetbody .coach')).includes('웃는 얼굴'));
  await p.click('[data-act=resultOk]');
  check('다음 소식이 뜸', await p.locator('.newstext').isVisible());
  for (let i = 0; i < 3; i++) { await p.click('[data-act=guess][data-id=bad]'); await p.click('[data-act=next]'); await p.click('[data-act=resultOk]'); }
  check('길잡이: 두 번째 소식 뒤 숫자 설명까지 옴', await ev(() => window.__st.P().tut === 7));
  await ev(() => { const b = document.querySelector('[data-act=tutSkip]'); if (b) b.click(); });   // 하루 끝 창에 가려 있어서 직접 누른다
  check('길잡이: 그만 보기를 누르면 끝남', await ev(() => window.__st.P().tut === 'done') && (await p.locator('.coach').count()) === 0);
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
  await p.click('[data-act=guess][data-id=good]');
  await p.click('[data-act=line]', { timeout: 800 }).catch(() => {});
  // ---- v2: 단계별 화면 ----
  const setStage = async id => { await ev(() => { const P = window.__st.P(); P.turnsToday = 0; }); await p.evaluate(s => { window.__st.P().stage = s; window.__st.render(); }, id); await p.click('[data-act=guess]', { timeout: 800 }).catch(() => {}); await p.click('[data-act=line]', { timeout: 800 }).catch(() => {}); };
  check('씨앗 단계 가게 창에는 성적표가 없음', await (async () => { await p.click('[data-act=shop][data-id=bread]'); const n = await p.locator('.report').count(); await p.click('[data-act=close]'); return n === 0; })());
  await setStage('sprout');
  check('새싹: 마을에 씨앗 값이 보임', (await p.locator('.px').count()) >= 5);
  await p.click('[data-act=shop][data-id=bread]');
  check('새싹: 성적표 3줄과 값 그래프', (await p.locator('.report p').count()) === 3 && (await p.locator('.spark').count()) === 1 && (await p.locator('.ratios').count()) === 0);
  await p.click('[data-act=close]');
  await setStage('tree');
  await p.click('[data-act=shop][data-id=bread]');
  check('나무: 비율 4개', (await p.locator('.ratios span').count()) === 4 && (await p.locator('[data-act=quiz]').count()) === 0);
  await p.click('[data-act=fs]');
  check('나무: 재무제표 3표', (await p.locator('table.fs').count()) === 3);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT.replace('.png', '-fs.png') });
  await p.click('.sheetbody .go');
  await p.click('[data-act=close]');
  await setStage('forest');
  await p.click('[data-act=shop][data-id=bread]');
  await p.fill('#why', '꾸준히 이익이 나서');
  await p.click('[data-act=plant][data-n="1"]');
  check('숲: 이유를 적고 사면 일지에 남음', await ev(() => window.__st.P().journal.length === 1));
  await p.click('[data-act=quiz]');
  check('숲: 분기보고서와 문제 3개', (await p.locator('.doc table').count()) === 3 && (await p.locator('.q').count()) === 3);
  const st0 = await ev(() => window.__st.P().stars);
  for (let i = 0; i < 3; i++) { const a = await p.evaluate(i => window.__st.E.makeQuiz(window.__st.P(), window.__st.D, 'bread').questions[i].answer, i); await p.click(`[data-act=ans][data-q="${i}"][data-o="${a}"]`); }
  check('숲: 다 맞히면 별 3개', await ev(() => window.__st.P().stars) === st0 + 3 && (await p.locator('.q button.ok').count()) === 3);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT.replace('.png', '-quiz.png') });
  await p.click('.sheetbody .go'); await p.click('[data-act=quiz]');
  for (let i = 0; i < 3; i++) await p.click(`[data-act=ans][data-q="${i}"][data-o="0"]`);
  check('숲: 같은 계절에 다시 풀어도 별이 안 늘어남', await ev(() => window.__st.P().stars) === st0 + 3);
  await p.click('.sheetbody .go'); await p.click('[data-act=close]');
  await p.click('[data-act=journal]');
  check('숲: 투자일지 창', (await p.locator('.jr').count()) === 1);
  await p.click('[data-act=close2]');
  // ---- v3: 세계 ----
  check('숲 단계에는 실제 회사 책장이 없음', (await p.locator('[data-act=real]').count()) === 0);
  await setStage('world');
  await p.click('[data-act=real]');
  await p.click('[data-act=realNew]');
  await p.click('[data-act=realSave]');
  check('세계: 빠진 칸이 있으면 저장 안 됨', (await p.textContent('#rMsg')).includes('빠진 것') && await ev(() => window.__st.P().real.length === 0));
  await p.fill('#rName', '시험회사'); await p.fill('#rLabel', '1기');
  await p.fill('#rPaste', '매출액 1,200\n영업이익 150\n당기순이익 110\n부채총계 400\n자본총계 800\n영업활동현금흐름 130\n발행주식총수 10,000,000\n주가 11,000');
  await p.click('[data-act=realParse]');
  check('세계: 붙여넣은 글이 칸에 들어감', (await p.inputValue('#rf_sales')) === '1200' && (await p.inputValue('#rf_equity')) === '800');
  await p.click('[data-act=realSave]');
  check('세계: 점검표 5줄과 비율 8개', (await p.locator('.checks li').count()) === 5 && (await p.locator('.ratios span').count()) === 8 && (await p.locator('.checks li.ok').count()) === 4);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT.replace('.png', '-world.png') });
  await p.fill('#rWhy', '이익률이 좋아서'); await p.click('[data-act=realPred][data-id=good]');
  check('세계: 예측을 걸어 둠', await ev(() => window.__st.P().real[0].pred.guess === 'good'));
  await p.click('[data-act=realQuiz]');
  check('세계: 실제 숫자 문제 3개', (await p.locator('.q').count()) === 3);
  await p.click('.sheetbody .go');
  await p.click('[data-act=realAdd]');
  await p.fill('#rLabel', '2기'); await p.fill('#rf_sales', '1300'); await p.fill('#rf_net', '90'); await p.fill('#rf_debt', '420'); await p.fill('#rf_equity', '850');
  await p.click('[data-act=realSave]');
  check('세계: 다음 기간을 넣으면 예측이 복기됨(빗나감)', (await p.locator('.answer.wrong').count()) === 1 && await ev(() => window.__st.P().real[0].reviews.length === 1));
  await p.click('.sheetbody [data-act=real]');
  check('세계: 책장에 회사 1곳', (await p.locator('.realrow').count()) === 1);
  await p.click('[data-act=close2]');
  if (process.env.SHOT) { await p.click('[data-act=shop][data-id=bread]'); await p.screenshot({ path: process.env.SHOT.replace('.png', '-shop.png'), fullPage: false }); await p.click('[data-act=close]'); }
  if (process.env.SHOT) { await p.screenshot({ path: process.env.SHOT }); }
  // ---- v4: 아빠로 시작하면 내용이 다르고 끊기지 않음 ----
  await ev(() => { window.__st.S.cur = null; window.__st.render(); });
  check('고르는 화면에 단계가 보임', (await p.textContent('[data-act=who][data-id="아빠"]')).includes('세계') && (await p.textContent('[data-act=who][data-id="열매"]')).includes('씨앗'));
  await p.click('[data-act=who][data-id="아빠"]');
  check('아빠 처음 화면: 세계 단계가 골라져 있고 제한 없음 안내', (await p.textContent('.stagepick .on')).includes('세계') && (await p.textContent('.pickpage .desc')).includes('제한 없음'));
  await p.click('[data-act=introOk]');
  for (let i = 0; i < 6; i++) { await p.click('[data-act=guess]'); await p.click('[data-act=line]', { timeout: 500 }).catch(() => {}); await p.click('[data-act=next]'); await p.click('[data-act=resultOk]'); }
  check('아빠는 6계절을 넘겨도 "오늘은 여기까지"가 안 뜸', (await p.locator('.go.rest').count()) === 0 && await ev(() => window.__st.P().world.turn === 6) && (await p.locator('.px').count()) >= 5);
  if (process.env.SHOT) { await p.click('[data-act=guess]'); await p.click('[data-act=line]', { timeout: 500 }).catch(() => {}); await p.screenshot({ path: process.env.SHOT.replace('.png', '-dad.png') }); }
  check('오류 없음', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fail.length ? '\n실패 ' + fail.length + '개: ' + fail.join(', ') : '\n모두 통과');
  process.exit(fail.length ? 1 : 0);
})();
