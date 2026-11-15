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
      var sales = c.base * def.season[s] * Math.max(0.1, 1 + salesMod) * (1 + (rnd(W) * 2 - 1) * def.vol);
      var cost = sales * def.varCost + fixedOf(def, c.base) + costMod + c.debt * R.interest;
      var profit = sales - cost;
      var div = profit > 0 ? profit * def.payout : 0;
      var kept = profit - div;
      c.cash += kept;
      if (kept > 0) {                       // 남긴 돈 일부로 가게를 키운다
        var spend = kept * def.reinvest;
        c.cash -= spend; c.assets += spend; c.base += spend * R.reinvestRoi;
      }
      if (c.cash < 0) { c.debt -= c.cash; c.cash = 0; }      // 모자라면 빌린다
      else if (c.debt > 0) {                                  // 여유가 있으면 갚는다
        var spare = (c.cash - fixedOf(def, c.base)) * 0.5;
        if (spare > 0) { var pay = Math.min(c.debt, spare); c.debt -= pay; c.cash -= pay; }
      }
      // 기분: 평소 이 계절에 남기던 돈과 견준다
      var usual = plainProfit(def, c.base, s, c.debt, D);
      r.mood = c.mood = profit < 0 ? 'bad' : (profit > usual * 1.15 + 0.3 ? 'good' : (profit < usual * 0.6 ? 'bad' : 'ok'));
      // 값: 최근 1년 동안 남긴 돈으로 정한다 (모자란 계절은 평소 값으로 채운다)
      var year = profit, n = 1;
      for (var i = c.hist.length - 1; i >= 0 && n < 4; i--, n++) year += c.hist[i].profit;
      for (; n < 4; n++) year += plainProfit(def, c.base, (s + n) % 4, c.debt, D);
      var target = Math.max(0.15, c.per * year / R.shares);
      c.price = c.price * 0.5 + target * 0.5;
      r.sales = sales; r.cost = cost; r.profit = profit; r.div = div; r.dps = div / R.shares;
      c.hist.push({ t: W.turn, sales: round2(sales), cost: round2(cost), profit: round2(profit), div: round2(div), cash: round2(c.cash), debt: round2(c.debt), price: round2(c.price) });
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
      stats: { harvest: 0, news: 0, rumor: 0, seen: 0, buyBad: 0, lost: 0 },
      history: [],         // 계절마다 마을 보물
      day: '', turnsToday: 0, log: []   // log: 날짜별 플레이 기록 { d, turns, self }
    };
    drawNews(P, D);
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

  function invest(P, D, id, n) {
    var c = P.world.shops[id];
    if (!c || c.closed > 0 || n < 1 || P.coins < n) return false;
    var h = P.hold[id];
    if (!h) {
      h = P.hold[id] = { shares: 0, put: 0, since: P.world.turn, fruit: 0, ripe: 0 };
      if (!P.met[id]) { P.met[id] = 1; h.fruit = D.RULES.welcomeFruit || 0; }
    }
    h.shares += n / c.price; h.put += n; P.coins -= n;
    if (c.mood === 'bad' && c.hist.length) P.stats.buyBad++;
    return true;
  }
  function harvest(P, id) {
    var h = P.hold[id];
    if (!h || !h.ripe) return 0;
    var n = h.ripe; h.ripe = 0; P.coins += n; P.stats.harvest += n;
    return n;
  }
  function withdraw(P, id) {
    if (!P.hold[id]) return 0;
    harvest(P, id);
    var v = valueOf(P, id);
    P.coins += v; delete P.hold[id];
    return v;
  }

  // 다음 소식 카드를 뽑아 P.news 에 둔다
  function drawNews(P, D) {
    var W = P.world;
    var pool = D.NEWS.filter(function (n) {
      if (n.kind === 'rumor' && W.turn < D.RULES.rumorFrom) return false;
      if (P.lastNews.indexOf(n.id) >= 0) return false;
      if (n.shop !== 'all' && W.shops[n.shop].closed > 0) return false;
      return true;
    });
    if (!pool.length) pool = D.NEWS.filter(function (n) { return n.kind !== 'rumor'; });
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

  function applyNews(P, D, card) {
    var W = P.world, sign = card.kind === 'good' ? 1 : -1, real = null;
    if (card.kind === 'rumor') { real = rnd(W) < 0.5; sign = card.dir || 1; if (!real) return { real: false }; }
    var ids = card.shop === 'all' ? D.SHOPS.map(function (s) { return s.id; }) : [card.shop];
    ids.forEach(function (id) {
      var c = W.shops[id];
      if (c.closed > 0) return;
      // 소문은 절반만 사실이 된다(사실이면 dir 방향으로). cost 는 늘 나쁜 쪽.
      c.mods.push({ sales: card.sales ? sign * card.sales : 0, cost: card.cost || 0, left: card.turns || 1 });
    });
    return { real: real };
  }

  // 계절 하나를 넘긴다. 화면이 보여 줄 보고서를 돌려준다.
  function nextTurn(P, D) {
    var W = P.world, before = wealth(P), out = { news: null, shops: {}, fruits: 0, badges: [], wishes: [], closed: [], reopened: [] };
    var card = newsCard(P, D);
    if (card) {
      var res = applyNews(P, D, card);
      var answer = card.kind === 'rumor' ? 'unknown' : card.kind;
      var right = P.news.guess === answer;
      P.stats.seen++;
      if (right) { P.stars++; if (card.kind === 'rumor') P.stats.rumor++; else P.stats.news++; }
      out.news = { card: card, guess: P.news.guess, answer: answer, right: right, real: res.real };
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

  return {
    newWorld: newWorld, newPlayer: newPlayer, step: step, level: level,
    valueOf: valueOf, wealth: wealth, invest: invest, harvest: harvest, withdraw: withdraw,
    drawNews: drawNews, newsCard: newsCard, guess: guess, nextTurn: nextTurn, checkBadges: checkBadges,
    touchDay: touchDay, canPlay: canPlay, plainYear: plainYear
  };
});
