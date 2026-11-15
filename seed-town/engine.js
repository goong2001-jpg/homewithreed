/* 씨앗 마을 엔진 — 화면과 상관없는 규칙만 있다(가게 장부, 씨앗·열매, 소식, 배지).
 * 단계(씨앗·새싹·나무·숲)가 달라도 이 엔진은 하나다. 단계는 "무엇을 보여 주느냐"만 다르다.
 * 브라우저(window.SeedEngine)와 node(test/smoke.js) 양쪽에서 쓴다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SeedEngine = factory();
})(this, function () {

  // 씨앗값이 같으면 늘 같은 순서로 나오는 난수 (세계마다 저장해 두고 이어 쓴다)
  function rnd(W) {
    W.rng = (W.rng + 0x6D2B79F5) | 0;
    var t = W.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function fixedOf(def, base) { return def.fixed * Math.pow(base / def.base, 0.92); }   // 가게가 크면 나가는 돈도 거의 같이 큰다

  // 아무 일도 없을 때 한 계절에 남는 돈
  function plainProfit(def, base, s, debt, D) {
    var sales = base * def.season[s];
    return sales - sales * def.varCost - fixedOf(def, base) - (debt || 0) * D.RULES.interest;
  }
  function plainYear(def, base, debt, D) {
    var sum = 0;
    for (var s = 0; s < 4; s++) sum += plainProfit(def, base, s, debt, D);
    return sum;
  }

  function openShop(def, D) {
    var eps = plainYear(def, def.base, def.debt, D) / D.RULES.shares;
    return {
      base: def.base, cash: def.cash, debt: def.debt || 0, assets: def.base * 2,
      shares: D.RULES.shares,   // 이 가게의 주식 수 (유상증자·소각으로 바뀐다)
      price: 1, per: 1 / eps,     // 처음 씨앗 한 개 값이 동전 1개가 되도록 맞춘 배수
      hist: [], mods: [], closed: 0, mood: 'ok'
    };
  }

  function newWorld(D, seed) {
    var W = { turn: 0, rng: (seed || 1) | 0, shops: {} };
    D.SHOPS.forEach(function (def) { W.shops[def.id] = openShop(def, D); });
    return W;
  }

  function level(def, c) {
    var l = 1 + Math.floor(Math.log(c.base / def.base) / Math.log(1.3));
    return Math.max(1, Math.min(4, l));
  }

  // 한 계절을 보낸다. 가게마다 { sales, cost, profit, div, dps, mood, closedNow, reopened } 를 돌려준다.
  function step(W, D) {
    var R = D.RULES, s = W.turn % 4, rep = {};
    D.SHOPS.forEach(function (def) {
      var c = W.shops[def.id], r = rep[def.id] = { dps: 0 };
      if (c.closed > 0) {
        c.closed--;
        if (c.closed === 0) { W.shops[def.id] = openShop(def, D); r.reopened = true; }
        else r.closed = true;
        return;
      }
      var salesMod = 0, costMod = 0;
      c.mods = c.mods.filter(function (m) {
        salesMod += m.sales || 0; costMod += m.cost || 0;
        return --m.left > 0;
      });
      if (!c.shares) c.shares = R.shares;   // 예전 저장분
      var sales = c.base * def.season[s] * Math.max(0.1, 1 + salesMod) * (1 + (rnd(W) * 2 - 1) * def.vol);
      var vc = sales * def.varCost, fx = fixedOf(def, c.base) + costMod, it = c.debt * R.interest;
      var cost = vc + fx + it, spend = 0, borrow = 0, repay = 0;
      var profit = sales - cost;
      var div = profit > 0 ? profit * def.payout : 0;
      var kept = profit - div;
      c.cash += kept;
      if (kept > 0) {                       // 남긴 돈 일부로 가게를 키운다
        spend = kept * def.reinvest;
        c.cash -= spend; c.assets += spend; c.base += spend * R.reinvestRoi;
      }
      if (c.cash < 0) { borrow = -c.cash; c.debt += borrow; c.cash = 0; }      // 모자라면 빌린다
      else if (c.debt > 0) {                                  // 여유가 있으면 갚는다
        var spare = (c.cash - fixedOf(def, c.base)) * 0.5;
        if (spare > 0) { repay = Math.min(c.debt, spare); c.debt -= repay; c.cash -= repay; }
      }
      // 기분: 평소 이 계절에 남기던 돈과 견준다
      var usual = plainProfit(def, c.base, s, c.debt, D);
      r.mood = c.mood = profit < 0 ? 'bad' : (profit > usual * 1.15 + 0.3 ? 'good' : (profit < usual * 0.6 ? 'bad' : 'ok'));
      // 값: 최근 1년 동안 남긴 돈으로 정한다 (모자란 계절은 평소 값으로 채운다)
      var year = profit, n = 1;
      for (var i = c.hist.length - 1; i >= 0 && n < 4; i--, n++) year += c.hist[i].profit;
      for (; n < 4; n++) year += plainProfit(def, c.base, (s + n) % 4, c.debt, D);
      var target = Math.max(0.15, c.per * year / c.shares);
      c.price = c.price * 0.5 + target * 0.5;
      r.sales = sales; r.cost = cost; r.profit = profit; r.div = div; r.dps = div / c.shares;
      c.hist.push({ t: W.turn, sales: round2(sales), cost: round2(cost), profit: round2(profit), div: round2(div), cash: round2(c.cash), debt: round2(c.debt), price: round2(c.price),
        // 재무제표용: 변동비·고정비·이자, 재투자, 빌린 돈·갚은 돈, 설비자산, 주식 수
        vc: round2(vc), fx: round2(fx), it: round2(it), inv: round2(spend), borrow: round2(borrow), repay: round2(repay), assets: round2(c.assets), shares: round2(c.shares) });
      if (c.hist.length > 80) c.hist.shift();
      if (c.debt > R.closeDebt * c.base) { c.closed = R.reopenAfter; c.mood = 'bad'; r.closedNow = true; }
    });
    W.turn++;
    return rep;
  }
  function round2(x) { return Math.round(x * 100) / 100; }

  /* ---------- 플레이어 ---------- */

  function newPlayer(name, D, seed) {
    var P = {
      name: name, stage: 'seed', coins: D.RULES.startCoins, stars: 0,
      met: {},             // 한 번이라도 심어 본 가게
      hold: {},            // 가게 id → { shares 씨앗 수, put 넣은 동전, since 처음 심은 계절, fruit 자라는 열매(0~1), ripe 익은 열매 }
      world: newWorld(D, seed),
      news: null, lastNews: [], badges: {}, wishes: {},
      stats: { harvest: 0, news: 0, rumor: 0, seen: 0, buyBad: 0, lost: 0, line: 0, informed: 0, cheap: 0, reasoned: 0, quiz: 0 },
      looked: {},          // 가게 id → 성적표를 본 계절 (새싹: 보고 나서 심기)
      journal: [],         // 숲: 투자일지 { t, id, act, n, price, why }
      history: [],         // 계절마다 마을 보물
      day: '', turnsToday: 0, log: []   // log: 날짜별 플레이 기록 { d, turns, self }
    };
    drawNews(P, D);
    return P;
  }

  // 예전 저장분에 새 칸을 채운다
  function upgrade(P, D) {
    var st = P.stats;
    ['line', 'informed', 'cheap', 'reasoned', 'quiz'].forEach(function (k) { if (st[k] === undefined) st[k] = 0; });
    if (!P.looked) P.looked = {};
    if (!P.journal) P.journal = [];
    if (!P.met) P.met = {};
    for (var id in P.world.shops) if (!P.world.shops[id].shares) P.world.shops[id].shares = D.RULES.shares;
    return P;
  }

  function valueOf(P, id) {
    var h = P.hold[id];
    return h ? Math.floor(h.shares * P.world.shops[id].price + 1e-9) : 0;
  }
  function wealth(P) {
    var w = P.coins;
    for (var id in P.hold) w += valueOf(P, id) + P.hold[id].ripe;
    return w;
  }

  function invest(P, D, id, n, why) {
    var c = P.world.shops[id];
    if (!c || c.closed > 0 || n < 1 || P.coins < n) return false;
    var h = P.hold[id];
    if (!h) {
      h = P.hold[id] = { shares: 0, put: 0, since: P.world.turn, fruit: 0, ripe: 0 };
      if (!P.met[id]) { P.met[id] = 1; h.fruit = D.RULES.welcomeFruit || 0; }
    }
    h.shares += n / c.price; h.put += n; P.coins -= n;
    if (c.mood === 'bad' && c.hist.length) P.stats.buyBad++;
    if (P.looked[id] === P.world.turn) P.stats.informed++;
    if (c.hist.length && ratios(shopDef(D, id), c, D).cheap) P.stats.cheap++;
    note(P, id, 'buy', n, why);
    return true;
  }
  function harvest(P, id) {
    var h = P.hold[id];
    if (!h || !h.ripe) return 0;
    var n = h.ripe; h.ripe = 0; P.coins += n; P.stats.harvest += n;
    return n;
  }
  // half 가 참이면 절반만 꺼낸다(새싹부터)
  function withdraw(P, id, half, why) {
    var h = P.hold[id];
    if (!h) return 0;
    harvest(P, id);
    var v;
    if (half && valueOf(P, id) >= 2) {
      v = Math.floor(h.shares / 2 * P.world.shops[id].price + 1e-9);
      h.shares /= 2; h.put = Math.round(h.put / 2);
    } else { v = valueOf(P, id); delete P.hold[id]; }
    P.coins += v;
    note(P, id, 'sell', v, why);
    return v;
  }
  // 투자일지: 이유를 적었을 때만 남긴다
  function note(P, id, act, n, why) {
    why = (why || '').trim();
    if (!why) return;
    P.journal.push({ t: P.world.turn, id: id, act: act, n: n, price: round2(P.world.shops[id].price), why: why.slice(0, 120) });
    if (P.journal.length > 100) P.journal.shift();
    if (act === 'buy') P.stats.reasoned++;
  }
  function shopDef(D, id) { for (var i = 0; i < D.SHOPS.length; i++) if (D.SHOPS[i].id === id) return D.SHOPS[i]; }
  function stageIdx(P, D) { for (var i = 0; i < D.STAGES.length; i++) if (D.STAGES[i].id === P.stage) return i; return 0; }
  function cardStage(card, D) { for (var i = 0; i < D.STAGES.length; i++) if (D.STAGES[i].id === (card.stage || 'seed')) return i; return 0; }

  // 최근 1년 기준 비율 (나무 단계부터 보여 준다)
  function ratios(def, c, D) {
    var year = 0, divs = 0, n = 0;
    for (var i = c.hist.length - 1; i >= 0 && n < 4; i--, n++) { year += c.hist[i].profit; divs += c.hist[i].div; }
    if (n < 4) { year = plainYear(def, c.base, c.debt, D); divs = Math.max(0, year) * def.payout; }
    var sh = c.shares || D.RULES.shares, eps = year / sh, equity = c.cash + c.assets - c.debt;
    var fair = c.per * plainYear(def, c.base, c.debt, D) / sh;   // 아무 일 없을 때의 값
    return {
      eps: eps, equity: equity, year: year,
      per: eps > 0 ? c.price / eps : null,
      roe: equity > 0 ? year / equity : null,
      debtRatio: equity > 0 ? c.debt / equity : null,
      yield: divs / sh / c.price,
      fair: fair, cheap: c.price < fair * 0.8
    };
  }

  // 다음 소식 카드를 뽑아 P.news 에 둔다
  function drawNews(P, D) {
    var W = P.world;
    var si = stageIdx(P, D);
    var pool = D.NEWS.filter(function (n) {
      if (cardStage(n, D) > si) return false;          // 내 단계보다 어려운 카드는 안 나온다
      if (n.kind === 'rumor' && W.turn < D.RULES.rumorFrom) return false;
      if (P.lastNews.indexOf(n.id) >= 0) return false;
      if (n.shop !== 'all' && W.shops[n.shop].closed > 0) return false;
      return true;
    });
    if (!pool.length) pool = D.NEWS.filter(function (n) { return n.kind === 'good' || n.kind === 'bad'; });
    var card = pool[Math.floor(rnd(W) * pool.length)];
    P.news = { id: card.id, guess: null };
    P.lastNews.push(card.id);
    if (P.lastNews.length > 8) P.lastNews.shift();
  }
  function newsCard(P, D) {
    for (var i = 0; i < D.NEWS.length; i++) if (P.news && D.NEWS[i].id === P.news.id) return D.NEWS[i];
    return null;
  }
  function guess(P, g) { if (P.news) P.news.guess = g; }   // 'good' | 'bad' | 'unknown'
  function guessLine(P, l) { if (P.news) P.news.line = l; }   // 새싹: 'sales'(번 돈) | 'cost'(쓴 돈)
  function answerOf(card) { return card.answer || (card.kind === 'rumor' ? 'unknown' : card.kind); }
  function lineOf(card) { return card.kind === 'disc' ? null : card.cost ? 'cost' : card.sales ? 'sales' : null; }

  function applyNews(P, D, card) {
    // 공시(disc)는 sales 에 부호를 직접 적는다
    var W = P.world, sign = card.kind === 'good' || card.kind === 'disc' ? 1 : -1, real = null;
    if (card.kind === 'rumor') { real = rnd(W) < 0.5; sign = card.dir || 1; if (!real) return { real: false }; }
    var ids = card.shop === 'all' ? D.SHOPS.map(function (s) { return s.id; }) : [card.shop];
    ids.forEach(function (id) {
      var c = W.shops[id];
      if (c.closed > 0) return;
      // 소문은 절반만 사실이 된다(사실이면 dir 방향으로). cost 는 늘 나쁜 쪽.
      if (card.sales || card.cost) c.mods.push({ sales: card.sales ? sign * card.sales : 0, cost: card.cost || 0, left: card.turns || 1 });
      if (card.sharesMul) {            // 유상증자(>1): 새 주식을 팔아 돈이 들어온다 / 소각(<1): 돈을 써서 주식을 없앤다
        var old = c.shares || D.RULES.shares;
        c.shares = old * card.sharesMul;
        if (card.sharesMul > 1) c.cash += (c.shares - old) * c.price * 0.9;
        else c.cash = Math.max(0, c.cash - (old - c.shares) * c.price);
      }
      if (card.priceMul) c.price *= card.priceMul;   // 값만 잠깐 움직인다 (장부는 그대로)
    });
    return { real: real };
  }

  // 계절 하나를 넘긴다. 화면이 보여 줄 보고서를 돌려준다.
  function nextTurn(P, D) {
    var W = P.world, before = wealth(P), out = { news: null, shops: {}, fruits: 0, badges: [], wishes: [], closed: [], reopened: [] };
    var card = newsCard(P, D);
    if (card) {
      var res = applyNews(P, D, card);
      var answer = answerOf(card);
      var right = P.news.guess === answer;
      P.stats.seen++;
      if (right) { P.stars++; if (card.kind === 'rumor') P.stats.rumor++; else P.stats.news++; }
      out.news = { card: card, guess: P.news.guess, answer: answer, right: right, real: res.real };
      if (P.news.line && lineOf(card)) {
        var lr = P.news.line === lineOf(card);
        if (lr) { P.stars++; P.stats.line++; }
        out.news.line = { guess: P.news.line, answer: lineOf(card), right: lr };
      }
    }
    var rep = step(W, D), anyBad = false;
    D.SHOPS.forEach(function (def) {
      var r = rep[def.id], h = P.hold[def.id], o = out.shops[def.id] = { mood: r.mood, closed: !!r.closed, got: 0 };
      if (r.reopened) out.reopened.push(def.id);
      if (r.closedNow) {
        out.closed.push(def.id); o.closed = true;
        if (h) { P.stats.lost += h.put; delete P.hold[def.id]; }
        return;
      }
      if (!h) return;
      if (r.mood === 'bad') anyBad = true;
      h.fruit += h.shares * r.dps;
      while (h.fruit >= 1) { h.fruit -= 1; h.ripe++; o.got++; out.fruits++; }
    });
    P.coins += D.RULES.allowance;
    var now = wealth(P);
    P.history.push(now);
    if (P.history.length > 200) P.history.shift();
    out.storm = anyBad && Object.keys(P.hold).length >= 2 && now - D.RULES.allowance > before;
    out.badges = checkBadges(P, D, out);
    D.WISHES.forEach(function (w) { if (!P.wishes[w.id] && now >= w.at) { P.wishes[w.id] = 1; out.wishes.push(w); } });
    P.turnsToday++;
    drawNews(P, D);
    return out;
  }

  function checkBadges(P, D, out) {
    var got = [], W = P.world, n = Object.keys(P.hold).length, now = wealth(P);
    D.BADGES.forEach(function (b) {
      if (P.badges[b.id] !== undefined) return;
      if (b.stage && cardStage(b, D) > stageIdx(P, D)) return;   // 그 단계가 돼야 받는다
      var ok = false;
      if (b.type === 'first') ok = n >= 1;
      else if (b.type === 'shops') ok = n >= b.n;
      else if (b.type === 'hold') { for (var id in P.hold) if (W.turn - P.hold[id].since >= b.n) ok = true; }
      else if (b.type === 'harvest') ok = P.stats.harvest >= b.n;
      else if (b.type === 'news') ok = P.stats.news >= b.n;
      else if (b.type === 'rumor') ok = P.stats.rumor >= b.n;
      else if (b.type === 'year') ok = W.turn >= b.n * 4;
      else if (b.type === 'wealth') ok = now >= b.n;
      else if (b.type === 'storm') ok = !!(out && out.storm);
      else if (b.type === 'buyBad') ok = P.stats.buyBad >= 1;
      else if (b.type === 'stat') ok = (P.stats[b.stat] || 0) >= b.n;   // line·informed·cheap·reasoned·quiz
      if (ok) { P.badges[b.id] = W.turn; P.stars++; got.push(b); }
    });
    return got;
  }

  // 하루에 넘길 수 있는 계절 수를 지킨다. 날짜가 바뀌면 다시 열린다.
  function touchDay(P, today) {
    if (P.day !== today) { P.day = today; P.turnsToday = 0; }
    var last = P.log[P.log.length - 1];
    if (!last || last.d !== today) { last = { d: today, turns: 0, self: null }; P.log.push(last); if (P.log.length > 120) P.log.shift(); }
    return last;
  }
  function canPlay(P, D) { return P.turnsToday < D.RULES.turnsPerDay; }

  /* ---------- 숲: 공시 원문 읽기 ---------- */
  // 가게의 지난 계절 장부로 보고서 숫자와 문제 3개를 만든다. 장부가 없으면 null.
  function makeQuiz(P, D, id) {
    var def = shopDef(D, id), c = P.world.shops[id], l = c.hist[c.hist.length - 1];
    if (!l || c.closed > 0) return null;
    var equity = round2(l.cash + (l.assets || c.assets) - l.debt), rot = P.world.turn % 3, qs = [];
    function pct(x) { return Math.round(x * 100); }
    function opts(right, a, b) {       // 정답 자리를 계절마다 돌린다
      var o = [a, b]; o.splice(rot % 3, 0, right);
      return { options: o, answer: rot % 3 };
    }
    var m = pct(l.profit / l.sales), q1 = opts(m + '%', (m + 9) + '%', (m - 7) + '%');
    qs.push({ q: '이번 분기 순이익률(순이익 ÷ 매출)은 얼마에 가장 가까운가요?', options: q1.options, answer: q1.answer,
      why: '순이익 ' + l.profit + ' ÷ 매출 ' + l.sales + ' = ' + m + '%' });
    var dr = equity > 0 ? pct(l.debt / equity) : null;
    var q2 = dr === null ? opts('자본이 0 이하라 계산할 수 없다(자본잠식)', '50%', '120%') : opts(dr + '%', (dr + 35) + '%', (dr + 80) + '%');
    qs.push({ q: '부채비율(부채 ÷ 자본)은 얼마인가요?', options: q2.options, answer: q2.answer,
      why: dr === null ? '자본총계가 0 이하입니다.' : '부채 ' + l.debt + ' ÷ 자본 ' + equity + ' = ' + dr + '%' });
    if (l.profit > 0) {
      var po = pct(l.div / l.profit), q3 = opts(po + '%', Math.min(100, po + 20) + '%', Math.max(0, po - 15) + '%');
      if (q3.options[0] === q3.options[1] || q3.options[1] === q3.options[2] || q3.options[0] === q3.options[2]) q3 = opts(po + '%', (po + 25) + '%', (po + 45) + '%');
      qs.push({ q: '배당성향(배당 ÷ 순이익)은 얼마인가요?', options: q3.options, answer: q3.answer,
        why: '배당 ' + l.div + ' ÷ 순이익 ' + l.profit + ' = ' + po + '%' });
    } else {
      var q4 = opts('손실이 나서 배당하지 않았다', '순이익의 절반을 배당했다', '지난 분기와 같은 금액을 배당했다');
      qs.push({ q: '이번 분기 배당은 어떻게 됐나요?', options: q4.options, answer: q4.answer, why: '순이익이 ' + l.profit + ' 로 손실이어서 배당금이 0 입니다.' });
    }
    return { id: id, name: def.name, kind: def.kind, row: l, equity: equity, questions: qs };
  }
  function scoreQuiz(P, right) { if (right) { P.stats.quiz++; P.stars++; } }

  return {
    upgrade: upgrade, stageIdx: stageIdx, ratios: ratios, guessLine: guessLine, answerOf: answerOf, lineOf: lineOf,
    makeQuiz: makeQuiz, scoreQuiz: scoreQuiz, shopDef: shopDef,
    newWorld: newWorld, newPlayer: newPlayer, step: step, level: level,
    valueOf: valueOf, wealth: wealth, invest: invest, harvest: harvest, withdraw: withdraw,
    drawNews: drawNews, newsCard: newsCard, guess: guess, nextTurn: nextTurn, checkBadges: checkBadges,
    touchDay: touchDay, canPlay: canPlay, plainYear: plainYear
  };
});
