/* 신의 마을 — 원시인 셋이 스스로 문명을 일구는 걸 지켜보는 신 게임.
 * 데이터(시대·기술·건물·소원·대사·수치)는 data.js, 여기는 로직만.
 * 구성: 상태 → 생성 → 시뮬레이션(시민·건물·기술·소원·늑대) → 신의 힘 → 픽셀 그리기 → 화면(DOM) → 시작
 * 서버 없이 이 기기 브라우저(localStorage)에만 저장합니다. */
(function () {
  'use strict';
  var D = window.GV, C = D.CFG, SAVE_KEY = 'god-village-v1';
  var $ = function (s) { return document.querySelector(s); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var ri = function (a, b) { return Math.floor(rnd(a, b + 1)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var fmt = function (n) { return Math.floor(n).toLocaleString('ko-KR'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  var RES = ['food', 'wood', 'stone', 'metal', 'know'];
  var RES_IC = { food: '🍖', wood: '🪵', stone: '🪨', metal: '⛏️', know: '📜', faith: '✨' };
  var RES_NM = { food: '식량', wood: '나무', stone: '돌', metal: '금속', know: '지식', faith: '믿음' };
  var RES_COL = { food: '#e06a5a', wood: '#a0703a', stone: '#9a9aa0', metal: '#d0a040', know: '#6fb3ff' };

  // ---------- 상태 ----------
  var S = null;
  function fresh() {
    return {
      v: 1, world: 1, era: 0, faith: C.startFaith, faithTotal: 0, happy: 50, res: { food: 20, wood: 10, stone: 5, metal: 0, know: 0 },
      pop: [], blds: [], nodes: [], techs: [], wolves: [], gifts: [], wishes: [], ach: [],
      oracle: null, miracle: null, rainUntil: 0, lastTick: Date.now(), nextWish: Date.now() + 40000, nextWolf: Date.now() + C.wolfEvery * 1000, growthT: 0,
      log: [], chat: [], stats: { wishes: 0, gifts: 0, moves: 0, born: 0, wolves: 0, smites: 0 }, cfg: { offPct: C.offPct, offHours: C.offHours, sound: true },
      daily: { date: today(), wish: 0, gift: 0, move: 0, claimed: false }, rate: { food: 0, wood: 0, stone: 0, metal: 0, know: 0, faith: 0, born: 0 }, launched: false
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      var s = JSON.parse(raw), f = fresh();
      Object.keys(f).forEach(function (k) { if (s[k] === undefined) s[k] = f[k]; });
      Object.keys(f.stats).forEach(function (k) { if (s.stats[k] === undefined) s.stats[k] = 0; });
      s.pop.forEach(function (v) { v.state = 'idle'; v.held = false; v.bubble = null; v.timer = 0; });
      return s;
    } catch (e) { return null; }
  }
  function save() { if (window.__gv && window.__gv.lock) return; S.lastTick = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function addLog(txt) { var d = new Date(); S.log.unshift({ t: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), txt: txt }); if (S.log.length > 100) S.log.length = 100; ui.dirty.log = true; }
  var toastTimer = 0;
  function toast(msg) { var el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2400); }
  function say(v, kind, force) {
    if (!force && Math.random() > 0.5) return;
    var txt = pick(D.LINES[kind]); S.chat.push({ nm: v.name, txt: txt }); if (S.chat.length > 30) S.chat.shift();
    v.bubble = { txt: txt, until: Date.now() + 2500 }; renderChat();
  }
  function sysChat(txt) { S.chat.push({ sys: true, txt: txt }); if (S.chat.length > 30) S.chat.shift(); renderChat(); }
  function era() { return D.ERAS[S.era]; }
  function hasTech(id) { return S.techs.indexOf(id) >= 0; }
  function mul(key) { var m = 1 + (S.world - 1) * 0.1; S.techs.forEach(function (id) { var t = D.TECHS.find(function (x) { return x.id === id; }); if (t && t.effect[key]) m *= t.effect[key]; }); if (key === 'food' && S.miracle && S.miracle.id === 'harvest' && Date.now() < S.miracle.until) m *= 3; if (key === 'food' && Date.now() < S.rainUntil) m *= 1.5; if (key === 'faith') m *= 0.5 + S.happy / 100; return m; }
  function addFaith(n) { S.faith += n; S.faithTotal += n; }
  function storageCap() { var n = S.blds.filter(function (b) { return b.done && b.type === 'storage'; }).length; return Math.round((C.storageBase + C.storagePer * n) * (1 + S.era * 0.6)); }
  function addRes(k, n) { if (k === 'know') { S.res.know += n; return; } S.res[k] = Math.min(storageCap(), S.res[k] + n); }
  function housing() { var h = 0; S.blds.forEach(function (b) { if (b.done && D.BUILDINGS[b.type].housing) h += D.BUILDINGS[b.type].housing; }); return h; }
  function bldsOf(role, doneOnly) { return S.blds.filter(function (b) { return (!doneOnly || b.done) && D.BUILDINGS[b.type].role === role; }); }
  function totem() { return S.blds.find(function (b) { return b.done && b.type === 'totem'; }); }
  function center() { var t = totem(); return t ? { x: t.x, y: t.y + 4 } : { x: Math.round(F.w / 2), y: Math.round(F.top + (F.h - F.top) / 2) }; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function moveToward(e, tx, ty, sp, dt) { var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1, s = Math.min(d, sp * dt); e.x += dx / d * s; e.y += dy / d * s; e.walk = (e.walk || 0) + dt * 8; e.face = dx < 0 ? -1 : 1; return d - s; }

  // ---------- 생성 ----------
  function genLook() { return { hair: ri(0, 4), hc: pick(D.HAIR), skin: pick(D.SKIN) }; }
  function makeVillager(x, y, job) {
    return { id: uid(), name: pick(D.NAMES), look: genLook(), job: job || 'gather', state: 'idle', x: x, y: y, tx: x, ty: y, timer: 0, node: null, bld: null, carry: null, bubble: null, nextTalk: rnd(5, 30), nudge: 0, held: false, droppedAt: 0, face: 1, walk: 0, born: Date.now() };
  }
  function seeded(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function placeNodes() {
    var r = seeded(S.world * 13 + 7), c = center(), list = [];
    Object.keys(D.NODES).forEach(function (type) {
      var n = D.NODES[type], k = 0, tries = 0;
      while (k < n.count && tries++ < 400) {
        var x = 6 + r() * (F.w - 12), y = F.top + 8 + r() * (F.h - F.top - 14), p = { x: x, y: y };
        var dc = dist(p, c); if (dc < 34 || dc > F.w * 0.62) continue;
        if (list.some(function (o) { return dist(o, p) < 9; })) continue;
        list.push({ id: uid(), type: type, x: x, y: y, amount: n.max, vx: 0, vy: 0 }); k++;
      }
    });
    S.nodes = list;
  }
  function newGame() {
    S = fresh();
    var c = { x: Math.round(F.w / 2), y: Math.round(F.top + (F.h - F.top) / 2) };
    placeNodes();
    var jobs = ['gather', 'lumber', 'miner'];
    for (var i = 0; i < C.startPop; i++) S.pop.push(makeVillager(c.x + rnd(-10, 10), c.y + rnd(-6, 8), jobs[i % 3]));
    sysChat('🌅 세 사람이 들판에 섰다. 신이시여, 지켜봐 주소서.'); addLog('세계 ' + S.world + ' 시작');
  }

  // ---------- 시뮬레이션 ----------
  var F = { w: 130, h: 200, top: 22, pix: 3, ctx: null, map: null, mapKey: '', time: 0, fx: [], rain: 0, flash: 0, shake: 0, slots: [] };
  function researchBld() { var best = null; S.blds.forEach(function (b) { if (!b.done) return; var d = D.BUILDINGS[b.type]; if (d.research && (!best || d.research > D.BUILDINGS[best.type].research)) best = b; }); return best; }
  function faithBld() { var cs = S.blds.filter(function (b) { return b.done && D.BUILDINGS[b.type].role === 'faith'; }); return cs[cs.length - 1] || null; }
  function depot(v) { var best = null, bd = 1e9; S.blds.forEach(function (b) { if (!b.done || (b.type !== 'storage' && b.type !== 'totem')) return; var d = dist(v, b); if (d < bd) { bd = d; best = b; } }); return best ? { x: best.x, y: best.y + 3 } : center(); }
  function nearestNode(v, type) { var best = null, bd = 1e9; S.nodes.forEach(function (n) { if (n.type !== type || n.amount < 1) return; var d = dist(v, n); if (d < bd) { bd = d; best = n; } }); return best; }
  function nearestWolf(v, r) { var best = null, bd = r; S.wolves.forEach(function (w) { var d = dist(v, w); if (d < bd) { bd = d; best = w; } }); return best; }
  function jobOk(job) { var j = D.JOBS[job]; if (j.tech && !hasTech(j.tech)) return false; if (job === 'farmer' && !bldsOf('food', true).length) return false; if (job === 'smith' && !S.nodes.some(function (n) { return n.type === 'ore'; })) return false; if (job === 'builder' && !S.blds.some(function (b) { return !b.done; })) return false; return true; }
  function currentTech() { return D.TECHS.find(function (t) { return t.era <= S.era && !hasTech(t.id); }) || null; }
  function wolvesAllowed() { return S.era < 3 && !S.blds.some(function (b) { return b.done && b.type === 'castle'; }); }

  function step(dt) {
    var now = Date.now(); F.time += dt;
    // 자원 되살아남 · 사슴 이동
    S.nodes.forEach(function (n) { var d = D.NODES[n.type]; if (n.amount < d.max) n.amount = Math.min(d.max, n.amount + d.regrow * dt); if (d.moves) { if (Math.random() < dt * 0.3) { n.vx = rnd(-6, 6); n.vy = rnd(-4, 4); } n.x = clamp(n.x + n.vx * dt, 6, F.w - 6); n.y = clamp(n.y + n.vy * dt, F.top + 6, F.h - 6); } });
    // 식량 소비
    S.res.food = Math.max(0, S.res.food - S.pop.length * C.foodPerPop * dt);
    // 시민
    S.pop.forEach(function (v) { stepVillager(v, dt, now); });
    // 늑대
    for (var i = S.wolves.length - 1; i >= 0; i--) {
      var w = S.wolves[i]; w.anim = Math.max(0, (w.anim || 0) - dt);
      if (w.hp <= 0 || now > w.until) { if (w.hp <= 0) { S.stats.wolves++; addFaith(2); sysChat('🐺 늑대를 물리쳤다! 믿음 +2'); } else sysChat('🐺 늑대가 숲으로 돌아갔다'); S.wolves.splice(i, 1); continue; }
      var tgt = null, bd = 1e9; S.pop.forEach(function (v) { if (v.held) return; var d = dist(w, v); if (d < bd) { bd = d; tgt = v; } });
      if (tgt && bd > 6) moveToward(w, tgt.x, tgt.y, 9, dt);
      else if (tgt) { w.bite = (w.bite || 0) + dt; if (w.bite > 1.5) { w.bite = 0; w.anim = 0.3; S.happy = Math.max(0, S.happy - 1); if (tgt.state !== 'flee') { tgt.state = 'flee'; say(tgt, 'wolf'); } } }
    }
    if (wolvesAllowed() && now > S.nextWolf && S.pop.length >= 4) { S.nextWolf = now + C.wolfEvery * 1000 * rnd(0.8, 1.3); spawnWolf(); }
    // 효과
    for (var j = F.fx.length - 1; j >= 0; j--) { var f = F.fx[j]; f.t += dt; if (f.kind === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; } if (f.kind === 'num') f.y -= 8 * dt; if (f.t > f.life) F.fx.splice(j, 1); }
    F.rain = Math.max(0, F.rain - dt); F.flash = Math.max(0, F.flash - dt); F.shake = Math.max(0, F.shake - dt * 8);
    // 느린 틱(2초): 직업 배분·행복·기술·시대·소원·성장·업적
    slow.t += dt; if (slow.t >= 2) { slow.t = 0; slowTick(now); }
    S.pop.forEach(function (v) { if (v.bubble && now > v.bubble.until) v.bubble = null; });
  }
  var slow = { t: 0, n: 0 };
  function slowTick(now) {
    slow.n++;
    rebalanceJobs(); updateHappy(); checkTech(); checkEra(); planBuilding();
    if (now > S.nextWish) { S.nextWish = now + C.wishEvery * 1000; makeWish(); }
    checkWishes(now);
    S.growthT += 2; var every = C.growthEvery * Math.pow(0.9, S.era) / mul('growth');
    if (S.growthT >= every) { S.growthT = 0; tryGrow(); }
    if (slow.n % 3 === 0) { checkAch(); checkDaily(); }
    if (S.oracle && now > S.oracle.until) { S.oracle = null; sysChat('📣 신탁의 효력이 다했다'); ui.dirty.head = true; }
    ui.dirty.head = true;
  }
  function stepVillager(v, dt, now) {
    if (v.held) return;
    v.anim = Math.max(0, (v.anim || 0) - dt);
    if (F.time > v.nextTalk) { v.nextTalk = F.time + rnd(20, 60); say(v, v.state === 'pray' ? 'pray' : 'idle', true); }
    var wolf = nearestWolf(v, 18);
    if (wolf && !(v.job === 'hunter' && hasTech('hunting'))) { v.state = 'flee'; }
    if (v.state === 'flee') { var w2 = nearestWolf(v, 30); if (!w2) { v.state = 'idle'; return; } var dx = v.x - w2.x, dy = v.y - w2.y, d = Math.sqrt(dx * dx + dy * dy) || 1; v.x = clamp(v.x + dx / d * 20 * dt, 4, F.w - 4); v.y = clamp(v.y + dy / d * 20 * dt, F.top + 4, F.h - 4); v.walk += dt * 8; v.face = dx < 0 ? -1 : 1; return; }
    // 사냥꾼은 늑대와 싸운다
    if (v.job === 'hunter' && hasTech('hunting') && !v.carry) { var w3 = nearestWolf(v, 34); if (w3) { if (dist(v, w3) > 5) moveToward(v, w3.x, w3.y, 18, dt); else { v.timer -= dt; if (v.timer <= 0) { v.timer = 0.8; v.anim = 0.3; w3.hp -= 12; F.fx.push({ kind: 'num', x: w3.x, y: w3.y - 8, txt: '12', color: '#fff', size: 6, t: 0, life: 0.6 }); } } return; } }
    // 선물 줍기
    if (v.state === 'gift') { var g = S.gifts.find(function (x) { return x.id === v.gift; }); if (!g) { v.state = 'idle'; return; } if (moveToward(v, g.x, g.y, 22, dt) < 2) { S.gifts = S.gifts.filter(function (x) { return x !== g; }); addRes(g.res, g.n); F.fx.push({ kind: 'num', x: v.x, y: v.y - 16, txt: '+' + g.n + RES_IC[g.res], color: RES_COL[g.res], size: 6, t: 0, life: 1 }); say(v, 'gift', true); v.state = 'idle'; } return; }
    if (v.state === 'idle') { decide(v); return; }
    if (v.state === 'wander') { if (moveToward(v, v.tx, v.ty, 8, dt) < 1 || (v.timer -= dt) <= 0) v.state = 'idle'; return; }
    if (v.state === 'go') {
      var tgt = v.node ? S.nodes.find(function (n) { return n.id === v.node; }) : (v.bld ? S.blds.find(function (b) { return b.id === v.bld; }) : null);
      if (!tgt) { v.state = 'idle'; return; }
      var tx = tgt.x + (v.off || 0), ty = tgt.y + 3;
      if (moveToward(v, tx, ty, 16, dt) < 1.2) { v.state = v.bld && D.BUILDINGS[tgt.type].role === 'faith' && v.job === 'priest' ? 'pray' : 'work'; v.timer = v.state === 'pray' ? C.prayTime : C.gatherTime; if (v.node && tgt.type === 'deer') v.timer = 2; }
      return;
    }
    if (v.state === 'work' || v.state === 'pray') {
      v.timer -= dt; v.anim = 0.2;
      if (v.bld) { var b = S.blds.find(function (x) { return x.id === v.bld; }); if (!b) { v.state = 'idle'; return; }
        if (!b.done) { b.progress += dt * mul('build'); if (b.progress >= D.BUILDINGS[b.type].work) finishBuilding(b); v.timer = 1; return; } }
      if (v.timer > 0) return;
      finishWork(v); return;
    }
    if (v.state === 'carry') { var dp = depot(v); if (moveToward(v, dp.x, dp.y, 15, dt) < 1.5) { if (v.carry) { addRes(v.carry.res, v.carry.n); rateAcc[v.carry.res] += v.carry.n; } v.carry = null; v.state = 'idle'; } return; }
  }
  function decide(v) {
    var j = D.JOBS[v.job];
    // 가까운 선물이 있으면 줍는다
    var g = S.gifts.find(function (x) { return !x.taken && dist(v, x) < 60; }); if (g) { g.taken = true; v.gift = g.id; v.state = 'gift'; return; }
    if (v.job === 'builder') { var site = null, bd = 1e9; S.blds.forEach(function (b) { if (b.done) return; var d = dist(v, b); if (d < bd) { bd = d; site = b; } }); if (site) { v.bld = site.id; v.node = null; v.off = rnd(-5, 5); v.state = 'go'; return; } return wander(v); }
    if (v.job === 'scholar') { var rb = researchBld() || totem(); if (rb) { v.bld = rb.id; v.node = null; v.off = rnd(-6, 6); v.state = 'go'; return; } return wander(v); }
    if (v.job === 'priest') { var fb = faithBld(); if (fb) { v.bld = fb.id; v.node = null; v.off = rnd(-7, 7); v.state = 'go'; return; } return wander(v); }
    if (v.job === 'farmer') { var farms = bldsOf('food', true); if (farms.length) { var fm = pick(farms); v.bld = fm.id; v.node = null; v.off = rnd(-5, 5); v.state = 'go'; return; } }
    var type = j.node || 'bush', n = nearestNode(v, type) || nearestNode(v, 'bush') || nearestNode(v, 'tree');
    if (n) { v.node = n.id; v.bld = null; v.off = rnd(-3, 3); v.state = 'go'; return; }
    wander(v);
  }
  function wander(v) { var c = center(); v.tx = clamp(c.x + rnd(-24, 24), 4, F.w - 4); v.ty = clamp(c.y + rnd(-12, 14), F.top + 4, F.h - 4); v.timer = rnd(2, 5); v.state = 'wander'; }
  function finishWork(v) {
    var j = D.JOBS[v.job], amt;
    if (v.state === 'pray') { amt = C.prayFaith * mul('faith'); addFaith(amt); rateAcc.faith += amt; F.fx.push({ kind: 'spark', x: v.x, y: v.y - 14, vx: 0, vy: -8, color: '#ffe9a8', t: 0, life: 1 }); v.state = 'idle'; return; }
    if (v.bld) { var b = S.blds.find(function (x) { return x.id === v.bld; }), d = b ? D.BUILDINGS[b.type] : null;
      if (d && d.research && v.job === 'scholar') { amt = C.gatherAmount * (d.research === true ? 1 : d.research) * mul('know'); S.res.know += amt; rateAcc.know += amt; F.fx.push({ kind: 'num', x: v.x, y: v.y - 15, txt: '+' + Math.round(amt) + '📜', color: RES_COL.know, size: 5, t: 0, life: 0.8 }); v.state = 'idle'; return; }
      if (d && d.role === 'food') { v.carry = { res: 'food', n: Math.round(C.gatherAmount * 1.5 * mul('food')) }; v.state = 'carry'; return; }
      if (d && d.role === 'faith') { amt = C.prayFaith * (d.faith || 1) * mul('faith'); addFaith(amt); rateAcc.faith += amt; v.state = 'idle'; return; }
      v.state = 'idle'; return; }
    var n = S.nodes.find(function (x) { return x.id === v.node; });
    if (!n) { v.state = 'idle'; return; }
    var take = Math.min(n.amount, n.type === 'deer' ? 6 : C.gatherAmount); n.amount -= take;
    v.carry = { res: D.NODES[n.type].res, n: Math.round(take * mul(D.NODES[n.type].res)) }; v.state = 'carry';
  }
  // 직업 배분: 부족한 것 쪽으로 2초마다 한 명씩 옮긴다
  function rebalanceJobs() {
    var pop = S.pop.length, w = { gather: 2, hunter: 0, farmer: 0, lumber: 2, miner: 1, smith: 0, builder: 0, scholar: 1, priest: 1 };
    if (S.res.food < pop * 4) { w.gather += 4; w.hunter += 3; w.farmer += 4; } else if (S.res.food > pop * 12) { w.gather = 1; }
    if (hasTech('hunting')) w.hunter += 2; if (jobOk('farmer')) w.farmer += 3; if (jobOk('smith')) w.smith += 2;
    var next = nextBuilding(); if (next) { var cost = D.BUILDINGS[next].cost; if ((cost.wood || 0) > S.res.wood) w.lumber += 3; if ((cost.stone || 0) > S.res.stone) w.miner += 3; if ((cost.metal || 0) > S.res.metal) w.smith += 3; }
    if (S.blds.some(function (b) { return !b.done; })) w.builder += 3 + Math.floor(pop / 8);
    if (currentTech() && (researchBld() || totem())) w.scholar += 2 + Math.floor(pop / 10);
    if (faithBld()) w.priest += 1 + Math.floor(pop / 12);
    if (S.oracle) Object.keys(S.oracle.weight).forEach(function (k) { w[k] += S.oracle.weight[k] * 2; });
    Object.keys(w).forEach(function (k) { if (!jobOk(k)) w[k] = 0; });
    var sum = 0; Object.keys(w).forEach(function (k) { sum += w[k]; }); if (!sum) return;
    var count = {}; S.pop.forEach(function (v) { count[v.job] = (count[v.job] || 0) + 1; });
    var over = null, under = null, oMax = -1e9, uMax = -1e9;
    Object.keys(w).forEach(function (k) { var want = w[k] / sum * pop, have = count[k] || 0, diff = have - want; if (diff > oMax && have > 0) { oMax = diff; over = k; } if (-diff > uMax && w[k] > 0) { uMax = -diff; under = k; } });
    if (!over || !under || over === under || uMax < 0.6) return;
    var cand = S.pop.filter(function (v) { return v.job === over && !v.carry && !v.held && Date.now() > v.nudge && (v.state === 'idle' || v.state === 'wander' || v.state === 'go'); });
    if (cand.length) { var v = pick(cand); v.job = under; v.state = 'idle'; v.node = null; v.bld = null; }
  }
  function updateHappy() {
    var pop = S.pop.length, t = 50;
    if (S.res.food > pop * 6) t += 10; if (S.res.food <= 0) t -= 20; if (housing() < pop) t -= 12;
    S.blds.forEach(function (b) { if (b.done && D.BUILDINGS[b.type].happy) t += D.BUILDINGS[b.type].happy; });
    t += S.era * 2; if (Date.now() < S.rainUntil) t += 5; if (S.wolves.length) t -= 8;
    t = clamp(t, 0, 100); S.happy += (t - S.happy) * 0.15;
  }
  function checkTech() {
    var t = currentTech(); if (!t) return;
    if (S.res.know >= t.cost) { S.res.know -= t.cost; S.techs.push(t.id); addLog(t.ic + ' <b>' + t.nm + '</b> 발견 — ' + t.msg); sysChat(t.ic + ' ' + t.nm + ' 발견! ' + t.msg); toast(t.ic + ' ' + t.nm + '을(를) 발견했다!'); burst(center(), '#6fb3ff', 20); S.pop.slice(0, 3).forEach(function (v) { say(v, 'tech', true); }); ui.dirty.tech = true; checkAch(); }
  }
  function checkEra() {
    var e = era(), allTech = D.TECHS.filter(function (t) { return t.era === S.era; }).every(function (t) { return hasTech(t.id); });
    var key = S.blds.some(function (b) { return b.done && b.type === e.key; });
    if (allTech && key && S.era < D.ERAS.length - 1) {
      S.era++; var ne = era(); addFaith(20); S.happy = Math.min(100, S.happy + 10);
      addLog('🎉 <b>' + ne.nm + '</b>가 열렸다! ' + ne.msg); sysChat('🎉 ' + ne.nm + '가 열렸다! ' + ne.msg); toast('🎉 ' + ne.nm + '!');
      burst(center(), '#ffd34f', 40); S.pop.forEach(function (v) { if (Math.random() < 0.4) say(v, 'era', true); }); F.mapKey = ''; ui.dirty.tech = true; ui.dirty.head = true;
    }
  }
  // 시민이 알아서 짓는 건물 고르기
  function nextBuilding() {
    var pop = S.pop.length, pending = S.blds.filter(function (b) { return !b.done; }); if (pending.length >= 2) return null;
    var avail = Object.keys(D.BUILDINGS).filter(function (k) { var b = D.BUILDINGS[k]; if (b.era > S.era) return false; var unlockedBy = D.TECHS.find(function (t) { return t.unlock === k; }); if (unlockedBy && !hasTech(unlockedBy.id)) return false; return true; });
    var has = function (k) { return S.blds.some(function (b) { return b.type === k; }); };
    // 1) 시대 하나짜리 건물(토템·모닥불·대장간·학당…) 2) 집 3) 창고 4) 밭
    var one = avail.filter(function (k) { return D.BUILDINGS[k].auto === 'one' && !has(k); });
    if (one.length) return one[0];
    if (housing() < pop + 2) { var houses = avail.filter(function (k) { return D.BUILDINGS[k].auto === 'house'; }); if (houses.length) return houses[houses.length - 1]; }
    var cap = storageCap(); if (RES.some(function (k) { return k !== 'know' && S.res[k] > cap * 0.85; }) && avail.indexOf('storage') >= 0 && S.blds.filter(function (b) { return b.type === 'storage'; }).length < 2 + S.era) return 'storage';
    if (avail.indexOf('farm') >= 0 && bldsOf('food').length < Math.floor(pop / 6)) return 'farm';
    return null;
  }
  function canAfford(cost) { return Object.keys(cost).every(function (k) { return S.res[k] >= cost[k]; }); }
  function freeSlot(w) {
    var c = center(), cand = [], r = seeded(S.blds.length * 31 + 5);
    for (var i = 0; i < 500; i++) { var ang = r() * Math.PI * 2, rad = 22 + r() * (F.w * 0.42); var p = { x: Math.round(c.x + Math.cos(ang) * rad), y: Math.round(c.y + Math.sin(ang) * rad * 0.8) };
      if (p.x < 10 || p.x > F.w - 10 || p.y < F.top + 16 || p.y > F.h - 4) continue;
      if (S.blds.some(function (b) { return Math.abs(b.x - p.x) < (w + bw(b.type)) / 2 + 4 && Math.abs(b.y - p.y) < 18; })) continue;
      if (S.nodes.some(function (n) { return dist(n, p) < 8 + w / 2; })) continue;
      cand.push({ p: p, d: dist(p, c) }); }
    if (!cand.length) return null; cand.sort(function (a, b) { return a.d - b.d; }); return cand[0].p;
  }
  function bw(type) { return { totem: 6, campfire: 8, hut: 12, storage: 12, farm: 16, thatch: 14, forge: 14, wood: 16, school: 16, stone: 18, market: 20, castle: 24, brick: 18, university: 22, theater: 18, rowhouse: 24, factory: 22, powerplant: 20, tower: 14, lab: 20, park: 22, dome: 22, rocket: 12 }[type] || 14; }
  function planBuilding() {
    var k = nextBuilding(); if (!k) return; var d = D.BUILDINGS[k]; if (!canAfford(d.cost)) return;
    var pos = freeSlot(bw(k));
    if (!pos && d.auto === 'house') { // 자리가 없으면 가장 오래된 집을 헐고 새로 짓는다
      var old = S.blds.filter(function (b) { return b.done && D.BUILDINGS[b.type].housing && D.BUILDINGS[b.type].era < S.era; })[0]; if (!old) return;
      Object.keys(d.cost).forEach(function (r) { S.res[r] -= d.cost[r]; }); old.type = k; old.done = false; old.progress = 0; sysChat('🏗️ 낡은 집을 헐고 ' + d.nm + '을(를) 짓기 시작했다'); ui.dirty.bld = true; return; }
    if (!pos) return;
    Object.keys(d.cost).forEach(function (r) { S.res[r] -= d.cost[r]; });
    S.blds.push({ id: uid(), type: k, x: pos.x, y: pos.y, progress: 0, done: false });
    sysChat('🏗️ ' + d.ic + ' ' + d.nm + '을(를) 짓기 시작했다'); ui.dirty.bld = true;
  }
  function finishBuilding(b) {
    b.done = true; b.progress = D.BUILDINGS[b.type].work; var d = D.BUILDINGS[b.type];
    addLog('🏠 <b>' + d.nm + '</b> 완성' + (d.msg ? ' — ' + d.msg : '')); sysChat('✅ ' + d.ic + ' ' + d.nm + ' 완성!' + (d.msg ? ' ' + d.msg : ''));
    burst({ x: b.x, y: b.y - 6 }, '#ffe9a8', 14); ui.dirty.bld = true; ui.dirty.head = true;
    if (d.role === 'launch') { S.launched = true; toast('🚀 우주선 완성! 더보기에서 새 세계를 열 수 있어요'); }
  }
  function tryGrow() {
    if (S.pop.length >= 160) return;
    if (S.res.food >= C.growthFood && housing() > S.pop.length && S.happy >= 30) {
      S.res.food -= C.growthFood; var house = pick(S.blds.filter(function (b) { return b.done && D.BUILDINGS[b.type].housing; })) || { x: center().x, y: center().y };
      var v = makeVillager(house.x + rnd(-6, 6), house.y + 5, 'gather'); S.pop.push(v); S.stats.born++; rateAcc.born++;
      say(v, 'born', true); sysChat('👶 ' + v.name + '이(가) 태어났다 (인구 ' + S.pop.length + ')'); burst(v, '#ffb0d0', 8); ui.dirty.pop = true;
    }
  }
  function spawnWolf() {
    var side = ri(0, 3), x = side === 0 ? 2 : side === 1 ? F.w - 2 : rnd(4, F.w - 4), y = side === 2 ? F.top + 4 : side === 3 ? F.h - 4 : rnd(F.top + 10, F.h - 10);
    S.wolves.push({ id: uid(), x: x, y: y, hp: C.wolfHp * (1 + S.era * 0.3), until: Date.now() + 50000, walk: 0, face: 1 });
    sysChat('🐺 늑대가 나타났다! ⚡ 번개로 쫓거나 사냥꾼이 맞선다'); toast('🐺 늑대가 나타났다!');
  }
  // ---- 소원 ----
  function makeWish() {
    if (S.wishes.length >= 3 || !S.pop.length) return;
    var pop = S.pop.length, next = nextBuilding(), cost = next ? D.BUILDINGS[next].cost : {};
    var cond = { foodLow: S.res.food < pop * 4, woodLow: (cost.wood || 0) > S.res.wood, stoneLow: (cost.stone || 0) > S.res.stone, research: !!currentTech() && S.res.know < currentTech().cost * 0.7, farm: bldsOf('food', true).length > 0, wolf: S.wolves.length > 0, totem: !!totem(), homeless: housing() < pop };
    var options = D.WISHES.filter(function (w) { return cond[w.when] && !S.wishes.some(function (x) { return x.type === w.id; }); });
    if (!options.length) return;
    var w = pick(options), free = S.pop.filter(function (v) { return !S.wishes.some(function (x) { return x.vid === v.id; }); }); if (!free.length) return;
    var v = pick(free); S.wishes.push({ id: uid(), type: w.id, vid: v.id, until: Date.now() + C.wishTime * 1000 });
    v.bubble = { txt: w.ic + ' ' + w.txt, until: Date.now() + 4000 }; sysChat('❗ ' + v.name + ': "' + w.txt + '"'); renderWishes();
  }
  function checkWishes(now) {
    for (var i = S.wishes.length - 1; i >= 0; i--) {
      var w = S.wishes[i], def = D.WISHES.find(function (x) { return x.id === w.type; }), v = S.pop.find(function (x) { return x.id === w.vid; }), ok = false;
      if (!v) { S.wishes.splice(i, 1); continue; }
      if (def.done === 'wolfDead') ok = S.wolves.length === 0; else if (def.done === 'housing') ok = housing() >= S.pop.length; else if (def.done === 'nearTotem') { var t = totem(); ok = t && now - v.droppedAt < 6000 && dist(v, t) < 14; }
      if (ok) fulfill(w, v); else if (now > w.until) { S.wishes.splice(i, 1); S.happy = Math.max(0, S.happy - 2); sysChat('😢 ' + v.name + '의 소원이 사라졌다'); ui.dirty.wish = true; }
    }
  }
  function fulfill(w, v) {
    S.wishes = S.wishes.filter(function (x) { return x !== w; }); var amt = Math.round(C.wishFaith * mul('faith')); addFaith(amt); S.happy = Math.min(100, S.happy + 3); S.stats.wishes++; S.daily.wish++;
    v.bubble = { txt: '🙏 감사합니다!', until: Date.now() + 2500 }; sysChat('💝 ' + v.name + '의 소원을 들어줬다! 믿음 +' + amt); burst(v, '#ffe9a8', 10); ui.dirty.wish = true; ui.dirty.head = true;
  }
  function powerFulfills(powerId) { S.wishes.slice().forEach(function (w) { var def = D.WISHES.find(function (x) { return x.id === w.type; }); if (def.done === 'power:' + powerId) { var v = S.pop.find(function (x) { return x.id === w.vid; }); if (v) fulfill(w, v); } }); }
  function checkAch() {
    var val = { pop: S.pop.length, era: S.era, tech: S.techs.length, faith: S.faithTotal, wish: S.stats.wishes, move: S.stats.moves, world: S.world };
    D.ACHIEVEMENTS.forEach(function (a) { if (S.ach.indexOf(a.id) >= 0) return; if (val[a.type] >= a.n) { S.ach.push(a.id); addFaith(a.faith); toast('🏆 업적: ' + a.nm + (a.faith ? ' (믿음 +' + a.faith + ')' : '')); addLog('🏆 업적 <b>' + a.nm + '</b>'); sysChat('🏆 업적 달성: ' + a.ic + ' ' + a.nm); ui.dirty.ach = true; } });
  }
  function checkDaily() {
    var d = S.daily; if (d.date !== today()) S.daily = d = { date: today(), wish: 0, gift: 0, move: 0, claimed: false };
    if (!d.claimed && D.DAILY.every(function (t) { return d[t.id] >= t.n; })) { d.claimed = true; addFaith(D.DAILY_FAITH); toast('✅ 오늘의 과제 완료! 믿음 +' + D.DAILY_FAITH); sysChat('✅ 오늘의 과제 완료! 믿음 +' + D.DAILY_FAITH); }
    ui.dirty.ach = true;
  }
  function burst(p, color, n) { for (var i = 0; i < n; i++) F.fx.push({ kind: 'spark', x: p.x, y: p.y, vx: rnd(-30, 30), vy: rnd(-50, -5), color: color, t: 0, life: rnd(0.4, 0.9) }); }

  // ---------- 신의 힘 ----------
  function usePower(id, x, y) {
    var pw = D.POWERS.find(function (p) { return p.id === id; }); if (!pw) return;
    if (S.faith < pw.cost) return toast('✨ 믿음이 모자라요 (' + pw.cost + ' 필요). 시민들이 기도하면 쌓입니다');
    S.faith -= pw.cost; S.stats.gifts++; S.daily.gift++;
    if (id === 'food' || id === 'wood' || id === 'stone') { S.gifts.push({ id: uid(), res: id, n: Math.round(pw.amount * (1 + S.era * 0.5)), x: clamp(x, 4, F.w - 4), y: clamp(y, F.top + 4, F.h - 4), taken: false }); burst({ x: x, y: y }, RES_COL[id], 12); sysChat(pw.ic + ' 하늘에서 ' + pw.nm + '이(가) 떨어졌다!'); }
    else if (id === 'idea') { var n = Math.round(pw.amount * (1 + S.era * 0.8)); S.res.know += n; burst({ x: x, y: y }, '#6fb3ff', 16); F.fx.push({ kind: 'num', x: x, y: y - 10, txt: '+' + n + '📜', color: RES_COL.know, size: 7, t: 0, life: 1.2 }); sysChat('💡 영감이 내렸다! 지식 +' + n); }
    else if (id === 'rain') { F.rain = 4; S.rainUntil = Date.now() + pw.amount * 1000; S.happy = Math.min(100, S.happy + 5); sysChat('🌧️ 단비가 내린다. 밭이 자라고 모두 기뻐한다'); S.pop.forEach(function (v) { if (Math.random() < 0.3) v.bubble = { txt: '비다!', until: Date.now() + 2000 }; }); }
    else if (id === 'smite') { F.flash = 0.25; F.shake = 2; var w = null, bd = 12; S.wolves.forEach(function (o) { var d = dist(o, { x: x, y: y }); if (d < bd) { bd = d; w = o; } });
      if (w) { w.hp = 0; S.stats.smites++; } else { var v = null; bd = 8; S.pop.forEach(function (o) { var d = dist(o, { x: x, y: y }); if (d < bd) { bd = d; v = o; } }); if (v) { S.happy = Math.max(0, S.happy - 3); v.state = 'wander'; v.tx = v.x + rnd(-20, 20); v.ty = v.y + rnd(-10, 10); v.timer = 2; say(v, 'scold', true); sysChat('⚡ ' + v.name + '을(를) 혼냈다 (행복 -3)'); } else sysChat('⚡ 번개가 들판에 떨어졌다'); }
      burst({ x: x, y: y }, '#fff6c0', 18); }
    powerFulfills(id); ui.dirty.head = true; ui.dirty.ach = true; save();
  }
  function useOracle(id) {
    var o = D.ORACLES.find(function (x) { return x.id === id; }); if (!o) return;
    if (o.era !== undefined && S.era < o.era) return toast('아직 이 기적을 쓸 수 없어요 (' + D.ERAS[o.era].nm + '부터)');
    if (S.faith < o.cost) return toast('✨ 믿음이 모자라요 (' + o.cost + ' 필요)');
    S.faith -= o.cost;
    if (o.miracle === 'harvest') { S.miracle = { id: 'harvest', until: Date.now() + 60000 }; sysChat('🌟 풍년의 기적! 60초 동안 식량 3배'); burst(center(), '#ffd34f', 30); }
    else if (o.miracle === 'insight') { var t = currentTech(); if (t) { S.res.know = Math.max(S.res.know, t.cost); checkTech(); } sysChat('✨ 계시의 기적!'); }
    else { S.oracle = { id: id, weight: o.weight, until: Date.now() + C.oracleTime * 1000 }; sysChat('📣 신탁: "' + o.nm + '" (' + C.oracleTime + '초)'); S.pop.forEach(function (v) { if (Math.random() < 0.4) say(v, 'oracle', true); }); rebalanceJobs(); }
    renderHead(); save();
  }
  // 시민 들어 옮기기
  function dropVillager(v, x, y) {
    v.held = false; v.x = clamp(x, 4, F.w - 4); v.y = clamp(y, F.top + 4, F.h - 4); v.state = 'idle'; v.node = null; v.bld = null; v.droppedAt = Date.now(); S.stats.moves++; S.daily.move++;
    burst(v, '#c0b090', 8); say(v, 'drop', true);
    // 내려놓은 곳에 따라 한동안 그 일을 한다 (신의 뜻)
    var near = null, bd = 16; S.nodes.forEach(function (n) { var d = dist(n, v); if (d < bd) { bd = d; near = { node: n }; } }); S.blds.forEach(function (b) { var d = dist(b, v); if (d < bd) { bd = d; near = { bld: b }; } });
    var job = null;
    if (near && near.node) job = { bush: 'gather', tree: 'lumber', rock: 'miner', ore: 'smith', deer: 'hunter' }[near.node.type];
    else if (near && near.bld) { var r = D.BUILDINGS[near.bld.type].role; job = !near.bld.done ? 'builder' : r === 'faith' ? 'priest' : r === 'research' ? 'scholar' : r === 'food' ? 'farmer' : r === 'metal' ? 'smith' : null; if (near.bld.type === 'totem' && !near.bld.done) job = 'builder'; }
    if (job && jobOk(job)) { v.job = job; v.nudge = Date.now() + 90000; v.bubble = { txt: D.JOBS[job].ic + ' ' + D.JOBS[job].nm + ' 할게요!', until: Date.now() + 2500 }; }
    ui.dirty.pop = true; ui.dirty.ach = true;
  }
  function newWorld() {
    if (!S.launched) return;
    var w = S.world + 1, keep = { faithTotal: S.faithTotal, ach: S.ach, stats: S.stats };
    S = fresh(); S.world = w; S.faithTotal = keep.faithTotal; S.ach = keep.ach; S.stats = keep.stats; S.faith = C.startFaith + w * 10;
    placeNodes(); var c = center(); ['gather', 'lumber', 'miner'].forEach(function (j) { S.pop.push(makeVillager(c.x + rnd(-10, 10), c.y + rnd(-6, 8), j)); });
    sysChat('🌍 세계 ' + w + ' — 모든 생산 +' + ((w - 1) * 10) + '%. 다시, 세 사람이 들판에 섰다.'); addLog('🌍 새 세계 ' + w);
    F.mapKey = ''; save(); renderAll();
  }
  // 수입률(분당) — 오프라인 정산용
  var rateAcc = { food: 0, wood: 0, stone: 0, metal: 0, know: 0, faith: 0, born: 0, t: 0 };
  function trackRate(dt) { rateAcc.t += dt; if (rateAcc.t >= 60) { Object.keys(S.rate).forEach(function (k) { S.rate[k] = S.rate[k] * 0.5 + rateAcc[k] * 0.5; rateAcc[k] = 0; }); rateAcc.t = 0; } }
  function offlineCatchUp() {
    var now = Date.now(), el = now - S.lastTick; if (el < 120000) return;
    var mins = Math.min(el / 60000, S.cfg.offHours * 60), pct = S.cfg.offPct / 100, r = S.rate, got = [];
    ['food', 'wood', 'stone', 'metal'].forEach(function (k) { var n = Math.floor(r[k] * mins * pct); if (n > 0) { addRes(k, n); got.push(RES_IC[k] + fmt(n)); } });
    var kn = Math.floor(r.know * mins * pct); if (kn > 0) { S.res.know += kn; got.push('📜' + fmt(kn)); for (var i = 0; i < 10; i++) checkTech(); checkEra(); }
    var fa = Math.floor(r.faith * mins * pct); if (fa > 0) { addFaith(fa); got.push('✨' + fmt(fa)); }
    var born = Math.min(Math.floor(r.born * mins * pct), Math.max(0, housing() - S.pop.length)); for (var j = 0; j < born; j++) { var c = center(); S.pop.push(makeVillager(c.x + rnd(-12, 12), c.y + rnd(-8, 8), 'gather')); } if (born) got.push('👶' + born);
    var hrs = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    $('#welcomeText').textContent = (hrs ? hrs + '시간 ' : '') + mm + '분 동안 (오프라인 보상 ' + S.cfg.offPct + '%' + (el / 60000 > S.cfg.offHours * 60 ? ', 최대 ' + S.cfg.offHours + '시간' : '') + ')\n' + (got.length ? '시민들이 모은 것: ' + got.join(' · ') : '시민들은 조용히 지냈습니다') + '\n\n💡 절전 모드로 켜 두면 100%를 받습니다.';
    $('#welcome').hidden = false;
  }

  // ---------- 픽셀 그리기 ----------
  function P(ctx, x, y, c, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function mix(a, b, k) { var pa = hex(a), pb = hex(b); return 'rgb(' + Math.round(pa[0] + (pb[0] - pa[0]) * k) + ',' + Math.round(pa[1] + (pb[1] - pa[1]) * k) + ',' + Math.round(pa[2] + (pb[2] - pa[2]) * k) + ')'; }
  function hex(h) { if (h[0] !== '#') return [120, 120, 120]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function resizeCanvas() {
    document.documentElement.style.setProperty('--navh', $('.nav').offsetHeight + 'px');
    var cv = $('#field'), cssW = cv.parentNode.getBoundingClientRect().width || 360;
    F.pix = Math.max(2, Math.floor(cssW / 125)); F.w = Math.ceil(cssW / F.pix);
    var avail = window.innerHeight - $('.nav').offsetHeight - $('.powers').offsetHeight - 120;
    F.h = clamp(Math.floor(avail / F.pix), 150, 230);
    cv.width = F.w; cv.height = F.h; cv.style.width = F.w * F.pix + 'px'; cv.style.height = F.h * F.pix + 'px';
    F.ctx = cv.getContext('2d'); F.ctx.imageSmoothingEnabled = false; F.mapKey = '';
  }
  function buildMap() {
    var e = era(), r = seeded(S.world * 5 + S.era), cv = document.createElement('canvas'); cv.width = F.w; cv.height = F.h; var c = cv.getContext('2d'), i, x, y;
    P(c, 0, 0, '#0e1a26', F.w, F.top - 2); P(c, 0, F.top - 2, '#1a2a30', F.w, 2);
    for (i = 0; i < 18; i++) P(c, Math.floor(r() * F.w), Math.floor(r() * (F.top - 6)), r() < 0.3 ? '#fff' : '#9ab', 1, 1);
    P(c, F.w - 20, 5, '#ffe9a8', 6, 6); P(c, F.w - 19, 4, '#ffe9a8', 4, 8); P(c, F.w - 21, 6, '#ffe9a8', 8, 4);
    P(c, 0, F.top, e.ground, F.w, F.h - F.top);
    var light = mix(e.ground, '#ffffff', 0.12), dark = mix(e.ground, '#000000', 0.2);
    for (i = 0; i < 300; i++) { x = Math.floor(r() * F.w); y = F.top + Math.floor(r() * (F.h - F.top)); P(c, x, y, r() < 0.5 ? light : dark, 1 + Math.floor(r() * 3), 1); }
    var cc = center();
    if (S.era >= 3) { for (y = F.top; y < F.h; y++) for (x = 0; x < F.w; x++) { if ((Math.abs(x - cc.x) < 3) || (Math.abs(y - cc.y) < 3) || (dist({ x: x, y: y }, cc) < 12)) P(c, x, y, ((x * 7 + y * 3) % 5 === 0) ? '#6a6050' : ((x + y) % 2 ? '#8a8070' : '#7a7060'), 1, 1); } }
    else { for (y = cc.y - 8; y < cc.y + 8; y++) for (x = cc.x - 12; x < cc.x + 12; x++) if (r() < 0.5) P(c, x, y, '#5a4a32', 1, 1); }
    for (i = 0; i < 16; i++) P(c, Math.floor(r() * F.w), F.top + Math.floor(r() * (F.h - F.top)), r() < 0.5 ? '#ffd0e0' : '#fff6c0', 1, 1);
    F.map = cv; F.mapKey = F.w + 'x' + F.h + 'e' + S.era + 'w' + S.world;
  }
  function daylight() { var t = (F.time % C.dayLength) / C.dayLength; return 0.5 + 0.5 * Math.cos(t * Math.PI * 2); } // 1=낮 0=밤
  function draw() {
    var ctx = F.ctx; if (!ctx || ui.sleep) return;
    if (F.mapKey !== F.w + 'x' + F.h + 'e' + S.era + 'w' + S.world) buildMap();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var sx = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0, sy = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0;
    ctx.drawImage(F.map, sx, sy); ctx.translate(sx, sy);
    var ents = [];
    S.nodes.forEach(function (n) { ents.push({ y: n.y, n: n }); });
    S.blds.forEach(function (b) { ents.push({ y: b.y, b: b }); });
    S.gifts.forEach(function (g) { ents.push({ y: g.y, g: g }); });
    S.pop.forEach(function (v) { if (!v.held) ents.push({ y: v.y, v: v }); });
    S.wolves.forEach(function (w) { ents.push({ y: w.y, w: w }); });
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { if (e.n) drawNode(ctx, e.n); else if (e.b) drawBuilding(ctx, e.b); else if (e.g) drawGift(ctx, e.g); else if (e.v) drawVillager(ctx, e.v, Math.round(e.v.x), Math.round(e.v.y)); else drawWolf(ctx, e.w); });
    // 밤
    var night = 1 - daylight(); if (S.era >= 5) night *= 0.5;
    ctx.fillStyle = 'rgba(10,16,50,' + (0.08 + night * 0.26).toFixed(2) + ')'; ctx.fillRect(0, F.top - 2, F.w, F.h);
    if (night > 0.3) S.blds.forEach(function (b) { if (!b.done) return; var d = D.BUILDINGS[b.type]; if (d.style === 'campfire' || d.style === 'forge' || d.housing || d.research) { ctx.globalAlpha = (night - 0.3) * 0.35; ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.arc(b.x, b.y - 4, bw(b.type) * 0.7, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } });
    // 들린 시민은 맨 위에, 그림자 함께
    S.pop.forEach(function (v) { if (!v.held) return; ctx.globalAlpha = 0.35; P(ctx, v.x - 4, v.y, '#000', 8, 2); ctx.globalAlpha = 1; drawVillager(ctx, v, Math.round(v.x), Math.round(v.y) - 14); });
    F.fx.forEach(function (f) { var a = 1 - f.t / f.life; if (f.kind === 'spark') { ctx.globalAlpha = a; P(ctx, f.x, f.y, f.color, 1, 1); } else { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.font = 'bold ' + f.size + 'px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; var tx = Math.round(f.x), ty = Math.round(f.y); ctx.fillText(f.txt, tx - 1, ty); ctx.fillText(f.txt, tx + 1, ty); ctx.fillText(f.txt, tx, ty - 1); ctx.fillText(f.txt, tx, ty + 1); ctx.fillStyle = f.color; ctx.fillText(f.txt, tx, ty); } ctx.globalAlpha = 1; });
    if (F.rain > 0) { ctx.globalAlpha = 0.5; for (var i = 0; i < 60; i++) P(ctx, (i * 37 + Math.floor(F.time * 90)) % F.w, F.top + ((i * 53 + Math.floor(F.time * 160)) % (F.h - F.top)), '#9ad0ff', 1, 3); ctx.globalAlpha = 1; }
    if (F.flash > 0) { ctx.globalAlpha = F.flash * 2; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, F.w, F.h); ctx.globalAlpha = 1; }
    drawLabels();
  }
  function drawNode(ctx, n) {
    var x = Math.round(n.x), y = Math.round(n.y), k = n.amount / D.NODES[n.type].max;
    if (n.type === 'tree') { var h = 5 + Math.round(k * 5); P(ctx, x - 1, y - 3, '#3a2a1a', 2, 3); P(ctx, x - 3, y - 3 - h, '#2f6a3a', 6, h); P(ctx, x - 2, y - 4 - h, '#3f8a4a', 4, 1); P(ctx, x - 4, y - 2 - h + 2, '#2a5f36', 8, Math.max(1, h - 3)); }
    else if (n.type === 'rock') { var s = 2 + Math.round(k * 3); P(ctx, x - s, y - s, '#6a6f7a', s * 2, s); P(ctx, x - s + 1, y - s - 1, '#8a8f9a', s * 2 - 2, 1); P(ctx, x - s, y, '#4a4f5a', s * 2, 1); }
    else if (n.type === 'bush') { P(ctx, x - 3, y - 3, '#2f6a3a', 6, 3); P(ctx, x - 2, y - 4, '#3f8a4a', 4, 1); if (k > 0.3) { P(ctx, x - 2, y - 3, '#e03a3a', 1, 1); P(ctx, x + 1, y - 2, '#e03a3a', 1, 1); } if (k > 0.7) P(ctx, x, y - 4, '#e03a3a', 1, 1); }
    else if (n.type === 'ore') { P(ctx, x - 3, y - 3, '#5a5a62', 6, 3); P(ctx, x - 2, y - 4, '#6a6a72', 4, 1); if (k > 0.2) { P(ctx, x - 1, y - 3, '#ffb040', 1, 1); P(ctx, x + 1, y - 2, '#ffb040', 1, 1); } }
    else if (n.type === 'deer') { var b = Math.floor((F.time * 6) % 2); P(ctx, x - 3, y - 4 + b, '#a0703a', 6, 3); P(ctx, x + 3, y - 6 + b, '#a0703a', 2, 3); P(ctx, x + 3, y - 8 + b, '#6a4a2a', 1, 2); P(ctx, x + 5, y - 8 + b, '#6a4a2a', 1, 2); P(ctx, x - 3, y - 1, '#6a4a2a', 1, 1); P(ctx, x + 1, y - 1, '#6a4a2a', 1, 1); P(ctx, x + 4, y - 5 + b, '#1a1410', 1, 1); }
  }
  function drawGift(ctx, g) { var x = Math.round(g.x), y = Math.round(g.y), bob = Math.round(Math.sin(F.time * 5) * 1); P(ctx, x - 3, y - 4 + bob, RES_COL[g.res], 6, 4); P(ctx, x - 3, y - 2 + bob, mix(RES_COL[g.res], '#000', 0.3), 6, 1); P(ctx, x, y - 5 + bob, '#ffe9a8', 1, 1); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y - 2, 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function drawWolf(ctx, w) { var x = Math.round(w.x), y = Math.round(w.y), b = Math.floor((w.walk || F.time * 6) % 2); P(ctx, x - 4, y - 4 + b, '#6a6f78', 8, 3); P(ctx, x + 3, y - 6 + b, '#6a6f78', 3, 3); P(ctx, x + 3, y - 7 + b, '#5a5f68', 1, 1); P(ctx, x + 5, y - 7 + b, '#5a5f68', 1, 1); P(ctx, x - 5, y - 5 + b, '#5a5f68', 2, 1); P(ctx, x - 3, y - 1, '#4a4f58', 1, 1); P(ctx, x + 1, y - 1, '#4a4f58', 1, 1); P(ctx, x + 4, y - 5 + b, '#ff3030', 1, 1); if (w.anim > 0) P(ctx, x + 6, y - 4 + b, '#fff', 1, 1); }
  function drawBuilding(ctx, b) {
    var d = D.BUILDINGS[b.type], x = Math.round(b.x), y = Math.round(b.y), w = bw(b.type), st = d.style;
    if (!b.done) { P(ctx, x - w / 2, y - 1, '#3a2a1a', w, 1); P(ctx, x - w / 2, y - 8, '#8a6a3a', 1, 8); P(ctx, x + w / 2 - 1, y - 8, '#8a6a3a', 1, 8); P(ctx, x - w / 2, y - 8, '#8a6a3a', w, 1); var p = b.progress / d.work; P(ctx, x - w / 2, y - 11, '#000', w, 2); P(ctx, x - w / 2, y - 11, '#ffd34f', Math.round(w * clamp(p, 0, 1)), 2); if (p > 0.3) P(ctx, x - w / 2 + 1, y - 4, mix('#8a6a3a', '#000', 0.2), w - 2, 3); return; }
    var dark = '#2a1a10', win = '#ffd070';
    if (st === 'hut') { P(ctx, x - 5, y - 4, '#8a6a4a', 10, 4); P(ctx, x - 4, y - 6, '#9a7a5a', 8, 2); P(ctx, x - 3, y - 7, '#9a7a5a', 6, 1); P(ctx, x - 1, y - 3, dark, 2, 3); }
    else if (st === 'totem') { P(ctx, x - 2, y - 14, '#7a5a3a', 4, 14); P(ctx, x - 3, y - 12, '#c04a3a', 6, 2); P(ctx, x - 3, y - 8, '#e0b040', 6, 2); P(ctx, x - 1, y - 11, '#1a1410', 1, 1); P(ctx, x + 1, y - 11, '#1a1410', 1, 1); P(ctx, x - 4, y - 16, '#c04a3a', 2, 2); P(ctx, x + 2, y - 16, '#c04a3a', 2, 2); ctx.globalAlpha = 0.15 + 0.1 * Math.sin(F.time * 3); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y - 8, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (st === 'campfire') { P(ctx, x - 4, y - 2, '#5a3a1a', 8, 2); P(ctx, x - 3, y - 3, '#6a4a2a', 6, 1); var f = Math.floor(F.time * 8) % 3; P(ctx, x - 2, y - 6 - f, '#ff7a2a', 4, 3 + f); P(ctx, x - 1, y - 8 - f, '#ffd040', 2, 3); if (Math.random() < 0.1) F.fx.push({ kind: 'spark', x: x, y: y - 8, vx: rnd(-4, 4), vy: -12, color: '#ffb040', t: 0, life: 0.6 }); }
    else if (st === 'storage') { P(ctx, x - 6, y - 7, '#8a6a3a', 12, 7); P(ctx, x - 7, y - 9, '#5a4030', 14, 2); P(ctx, x - 4, y - 5, '#5a4030', 3, 3); P(ctx, x + 1, y - 5, '#5a4030', 3, 3); }
    else if (st === 'farm') { P(ctx, x - 8, y - 5, '#5a4a32', 16, 6); for (var i = 0; i < 4; i++) P(ctx, x - 7 + i * 4, y - 4, Date.now() < S.rainUntil ? '#5fd05a' : '#3f8a4a', 2, 4); }
    else if (st === 'thatch') { house(ctx, x, y, 14, 7, '#b09060', '#d8b860', win); }
    else if (st === 'forge') { house(ctx, x, y, 14, 8, '#4a4a52', '#2e2e36', '#ff7a2a'); P(ctx, x + 4, y - 14, '#3a3a3a', 2, 5); P(ctx, x + 4, y - 16 - Math.floor(F.time * 2) % 2, '#8888', 2, 2); }
    else if (st === 'wood') { house(ctx, x, y, 16, 9, '#8a5a30', '#6a3a1a', win); }
    else if (st === 'school') { house(ctx, x, y, 16, 9, '#c8b890', '#3a5aa0', win); P(ctx, x + 6, y - 16, '#6a5a3a', 1, 6); P(ctx, x + 7, y - 16, '#e04040', 3, 2); }
    else if (st === 'stone') { house(ctx, x, y, 18, 10, '#8a8f9a', '#5a4a3a', win); }
    else if (st === 'market') { P(ctx, x - 10, y - 1, '#5a4a32', 20, 1); for (var k = 0; k < 3; k++) { var mx = x - 9 + k * 7; P(ctx, mx, y - 5, '#8a6a3a', 5, 5); P(ctx, mx - 1, y - 7, ['#e04040', '#4080e0', '#e0c040'][k], 7, 2); P(ctx, mx, y - 4, ['#ffd0a0', '#a0ffa0', '#ffa0a0'][k], 2, 2); } }
    else if (st === 'castle') { P(ctx, x - 12, y - 10, '#7a7f8a', 24, 10); P(ctx, x - 12, y - 16, '#8a8f9a', 5, 16); P(ctx, x + 7, y - 16, '#8a8f9a', 5, 16); for (var t = 0; t < 3; t++) { P(ctx, x - 12 + t * 2, y - 17, '#8a8f9a', 1, 1); P(ctx, x + 7 + t * 2, y - 17, '#8a8f9a', 1, 1); } P(ctx, x - 2, y - 6, dark, 4, 6); P(ctx, x - 1, y - 20, '#6a5a3a', 1, 4); P(ctx, x, y - 20, '#e04040', 3, 2); }
    else if (st === 'brick') { house(ctx, x, y, 18, 11, '#a04a3a', '#5a3a3a', win); P(ctx, x - 8, y - 9, '#8a3a2a', 16, 1); }
    else if (st === 'university') { P(ctx, x - 11, y - 10, '#e8e0d0', 22, 10); P(ctx, x - 12, y - 12, '#c8b8a0', 24, 2); for (var u = 0; u < 4; u++) P(ctx, x - 9 + u * 6, y - 10, '#fff8f0', 2, 10); P(ctx, x - 6, y - 16, '#c8b8a0', 12, 4); P(ctx, x - 1, y - 18, '#e0c040', 2, 2); }
    else if (st === 'theater') { house(ctx, x, y, 18, 10, '#7a3a8a', '#4a2a5a', '#ffd0ff'); P(ctx, x - 3, y - 14, '#ffd040', 2, 2); P(ctx, x + 1, y - 14, '#ffd040', 2, 2); }
    else if (st === 'rowhouse') { P(ctx, x - 12, y - 12, '#8a8a90', 24, 12); P(ctx, x - 12, y - 13, '#4a4a50', 24, 1); for (var r2 = 0; r2 < 2; r2++) for (var cx2 = 0; cx2 < 5; cx2++) P(ctx, x - 10 + cx2 * 5, y - 10 + r2 * 5, win, 2, 2); }
    else if (st === 'factory') { P(ctx, x - 11, y - 9, '#6a6a70', 22, 9); P(ctx, x - 11, y - 11, '#8a3a2a', 22, 2); P(ctx, x - 8, y - 18, '#4a4a4a', 3, 9); P(ctx, x + 2, y - 18, '#4a4a4a', 3, 9); var sm = Math.floor(F.time * 2) % 3; P(ctx, x - 8, y - 20 - sm, '#9998', 3, 2); P(ctx, x + 2, y - 21 - sm, '#9998', 3, 2); P(ctx, x - 2, y - 6, dark, 4, 6); }
    else if (st === 'powerplant') { P(ctx, x - 10, y - 10, '#b0b8c0', 20, 10); P(ctx, x - 4, y - 16, '#d0d8e0', 8, 6); P(ctx, x - 1, y - 8, '#ffd040', 2, 1); P(ctx, x, y - 7, '#ffd040', 2, 1); P(ctx, x - 1, y - 6, '#ffd040', 2, 1); ctx.globalAlpha = 0.2; ctx.fillStyle = '#80c0ff'; ctx.beginPath(); ctx.arc(x, y - 10, 12, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (st === 'tower') { P(ctx, x - 7, y - 26, '#4a6a9a', 14, 26); P(ctx, x - 7, y - 27, '#2a4a7a', 14, 1); for (var ty = 0; ty < 6; ty++) for (var tx2 = 0; tx2 < 3; tx2++) P(ctx, x - 5 + tx2 * 4, y - 24 + ty * 4, (ty + tx2) % 3 ? '#ffe9a8' : '#2a3a5a', 2, 2); }
    else if (st === 'lab') { P(ctx, x - 10, y - 8, '#e8f0f8', 20, 8); P(ctx, x - 6, y - 14, '#c8d8e8', 12, 6); P(ctx, x - 4, y - 16, '#d8e8f8', 8, 2); P(ctx, x - 2, y - 11, '#40c0ff', 4, 2); }
    else if (st === 'park') { P(ctx, x - 11, y - 6, '#3f8a4a', 22, 6); P(ctx, x - 8, y - 12, '#2f6a3a', 6, 6); P(ctx, x + 3, y - 13, '#2f6a3a', 6, 7); P(ctx, x - 1, y - 5, '#80c0ff', 3, 2); P(ctx, x - 2, y - 7, '#ffd0e0', 1, 1); P(ctx, x + 1, y - 8, '#fff6c0', 1, 1); }
    else if (st === 'dome') { ctx.fillStyle = '#9ad0ff'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x, y - 2, 11, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1; P(ctx, x - 11, y - 2, '#c0d0e0', 22, 2); P(ctx, x - 5, y - 8, '#e0e8f0', 10, 6); P(ctx, x - 3, y - 6, win, 2, 2); P(ctx, x + 1, y - 6, win, 2, 2); }
    else if (st === 'rocket') { P(ctx, x - 4, y - 20, '#e8e8f0', 8, 20); P(ctx, x - 3, y - 24, '#e04040', 6, 4); P(ctx, x - 1, y - 26, '#e04040', 2, 2); P(ctx, x - 7, y - 6, '#e04040', 3, 6); P(ctx, x + 4, y - 6, '#e04040', 3, 6); P(ctx, x - 1, y - 14, '#40a0ff', 2, 2); if (S.launched) { var fl = Math.floor(F.time * 10) % 2; P(ctx, x - 2, y + fl, '#ff7a2a', 4, 2); } }
    else house(ctx, x, y, w, 9, '#8a6a4a', '#5a4030', win);
  }
  function house(ctx, x, y, w, h, wall, roof, win) { P(ctx, x - w / 2, y - h, wall, w, h); P(ctx, x - w / 2, y - h, mix(wall, '#000', 0.3), 1, h); for (var i = 0; i < 4; i++) P(ctx, x - w / 2 - 1 + i, y - h - 4 + i, roof, w + 2 - i * 2, 1); P(ctx, x - 1, y - 4, '#2a1a10', 3, 4); P(ctx, x - w / 2 + 2, y - h + 2, win, 2, 2); P(ctx, x + w / 2 - 4, y - h + 2, win, 2, 2); }
  function drawVillager(ctx, v, x, y) {
    var e = era(), L = v.look, t = y - 13, a = v.anim > 0 ? 1 : 0, moving = v.state === 'go' || v.state === 'carry' || v.state === 'wander' || v.state === 'flee' || v.state === 'gift';
    var walk = moving ? Math.floor((v.walk || 0) % 2) : 0, skin = L.skin, hair = L.hc, cloth = e.cloth[0], clothD = e.cloth[1];
    if (L.hair === 1) { P(ctx, x - 4, t + 2, hair, 1, 6); P(ctx, x + 3, t + 2, hair, 1, 6); }
    P(ctx, x - 3, t + 2, skin, 6, 4); P(ctx, x - 3, t, hair, 6, 2); P(ctx, x - 3, t + 2, hair, 1, 1); P(ctx, x + 2, t + 2, hair, 1, 1);
    if (L.hair === 0 || L.hair === 3) P(ctx, x - 3, t + 1, hair, 7, 1);
    if (e.hat === 'helmet') { P(ctx, x - 4, t, '#9a9fa8', 8, 2); P(ctx, x - 3, t - 1, '#b0b5bf', 6, 1); } else if (e.hat === 'cap') { P(ctx, x - 4, t + 1, clothD, 8, 1); P(ctx, x - 3, t - 1, clothD, 6, 2); } else if (e.hat === 'visor') { P(ctx, x - 4, t - 1, '#e0e8f0', 8, 2); P(ctx, x - 3, t + 3, '#40a0ff', 6, 1); }
    P(ctx, x - 2 * v.face, t + 4, '#1a1410', 1, 1); P(ctx, x + (v.face > 0 ? 1 : -1) * 1, t + 4, '#1a1410', 1, 1);
    P(ctx, x - 3, t + 6, cloth, 6, 5); P(ctx, x - 3, t + 9, clothD, 6, 1);
    if (S.era === 0) { P(ctx, x - 2, t + 7, clothD, 1, 1); P(ctx, x + 1, t + 8, clothD, 1, 1); }
    P(ctx, x + 3 * v.face, t + 7 - a, skin, 1, 2);
    P(ctx, x - 2, t + 11, '#2a2119', 2, 2 + (walk ? 0 : 1)); P(ctx, x, t + 11, '#2a2119', 2, 2 + (walk ? 1 : 0));
    if (v.carry) { P(ctx, x - 2, t - 4, RES_COL[v.carry.res], 4, 3); P(ctx, x - 2, t - 2, mix(RES_COL[v.carry.res], '#000', 0.3), 4, 1); }
    var tool = { lumber: '#8a6a3a', miner: '#9a9aa0', hunter: '#c0a070', builder: '#d0a040', farmer: '#8a6a3a', smith: '#d0a040' }[v.job];
    if (tool && (v.state === 'work' || v.state === 'go')) { P(ctx, x + 3 * v.face, t + 4 - a * 2, tool, 1, 4); P(ctx, x + 3 * v.face + (v.face > 0 ? 1 : -2), t + 3 - a * 2, v.job === 'lumber' || v.job === 'miner' || v.job === 'builder' ? '#9a9aa0' : tool, 2, 2); }
    if (v.state === 'pray') { P(ctx, x - 1, t + 6, skin, 2, 2); if (Math.floor(F.time * 2) % 2) P(ctx, x - 1, t - 3, '#ffe9a8', 2, 1); }
    if (S.wishes.some(function (w) { return w.vid === v.id; })) { P(ctx, x - 1, t - 6 - Math.floor(F.time * 3) % 2, '#ffd34f', 2, 3); P(ctx, x - 1, t - 2 - Math.floor(F.time * 3) % 2, '#ffd34f', 2, 1); }
  }
  var labelEls = {};
  function drawLabels() {
    var box = $('#labels'), seen = {}, p = F.pix;
    function el(id, cls) { var e = labelEls[id]; if (!e) { e = document.createElement('div'); e.className = cls; box.appendChild(e); labelEls[id] = e; } e.className = cls; seen[id] = true; return e; }
    S.pop.forEach(function (v) {
      if (S.pop.length <= 30 || v.bubble || v.held) { var e = el(v.id, 'tag'); e.textContent = v.name; e.style.left = v.x * p + 'px'; e.style.top = (v.y + 2 - (v.held ? 14 : 0)) * p + 'px'; }
      if (v.bubble) { var b = el(v.id + 'b', 'bubble'); b.textContent = v.bubble.txt; b.style.left = v.x * p + 'px'; b.style.top = (v.y - 16 - (v.held ? 14 : 0)) * p + 'px'; }
    });
    S.blds.forEach(function (b) { if (b.done && D.BUILDINGS[b.type].auto === 'house') return; var e = el(b.id, 'tag bld'); var d = D.BUILDINGS[b.type]; e.textContent = (b.done ? d.ic + ' ' : '🏗️ ') + d.nm; e.style.left = b.x * p + 'px'; e.style.top = (b.y + 1) * p + 'px'; });
    Object.keys(labelEls).forEach(function (id) { if (!seen[id]) { labelEls[id].remove(); delete labelEls[id]; } });
  }
  function drawPortrait(cv, v) { cv.width = 20; cv.height = 20; var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 20, 20); drawVillager(ctx, { look: v.look, job: v.job, state: 'idle', face: 1, anim: 0, carry: null, id: '' }, 9, 18); }

  // ---------- 메인 루프 ----------
  var last = 0, acc = 0, uiTick = 0, secTick = 0, saveTick = 0;
  function loop(ts) {
    requestAnimationFrame(loop); if (!last) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000); last = ts;
    acc += dt; while (acc >= 1 / 30) { step(1 / 30); acc -= 1 / 30; }
    trackRate(dt); draw();
    uiTick += dt; secTick += dt;
    if (uiTick >= 0.5) { uiTick = 0; renderHead(); if (ui.dirty.wish) renderWishes(); renderWishTimers(); }
    if (secTick >= 1) { secTick = 0; if (ui.sleep) renderSleep(); if (ui.dirty.pop) renderPop(); if (ui.dirty.bld) renderBld(); if (ui.dirty.tech) renderTech(); if (ui.dirty.ach) renderAch(); if (ui.dirty.log) renderLog(); if ((saveTick = (saveTick + 1) % 5) === 0) save(); }
  }

  // ---------- 화면(DOM) ----------
  var ui = { dirty: { pop: true, bld: true, tech: true, ach: true, log: true, wish: true, head: true }, power: null, sleep: false, sleepAt: 0, held: null, downAt: null, wake: null };
  function renderHead() {
    ui.dirty.head = false; var e = era();
    $('#eraIc').textContent = e.ic; $('#eraNm').textContent = e.nm; $('#worldNo').textContent = S.world > 1 ? '세계 ' + S.world : '';
    $('#resRow').innerHTML = RES.filter(function (k) { return k !== 'metal' || S.era >= 1 || S.res.metal > 0; }).map(function (k) { return '<span>' + RES_IC[k] + ' ' + fmt(S.res[k]) + '</span>'; }).join('');
    $('#cap').textContent = '보관 ' + fmt(storageCap());
    $('#faith').textContent = '✨ ' + fmt(S.faith); $('#popCnt').textContent = '👥 ' + S.pop.length + '/' + housing(); $('#happy').textContent = (S.happy >= 70 ? '😊' : S.happy >= 40 ? '🙂' : '😟') + ' ' + Math.round(S.happy);
    var t = currentTech(), tb = researchBld() || totem(); $('#techLine').innerHTML = t ? ('🔬 ' + t.ic + ' ' + t.nm + ' <i style="width:' + Math.round(clamp(S.res.know / t.cost, 0, 1) * 100) + '%"></i><span>' + fmt(S.res.know) + '/' + t.cost + (tb ? '' : ' · 토템이 있어야 연구') + '</span>') : (S.era === D.ERAS.length - 1 ? '🚀 ' + (S.launched ? '새 세계를 열 수 있다' : '우주선을 짓는 중') : '다음 시대 준비 중');
    $('#oracleLine').textContent = S.oracle ? '📣 ' + D.ORACLES.find(function (o) { return o.id === S.oracle.id; }).nm + ' ' + Math.ceil((S.oracle.until - Date.now()) / 1000) + 's' : '';
    document.querySelectorAll('.pw').forEach(function (b) { var p = D.POWERS.find(function (x) { return x.id === b.dataset.power; }); if (p) b.classList.toggle('poor', S.faith < p.cost); b.classList.toggle('on', ui.power === b.dataset.power); });
    $('#huntInfo').textContent = '시민 ' + S.pop.length + '명 · ' + (S.wolves.length ? '🐺 늑대 ' + S.wolves.length : '평화로움');
  }
  function renderWishes() {
    ui.dirty.wish = false;
    $('#wishList').innerHTML = S.wishes.map(function (w) { var def = D.WISHES.find(function (x) { return x.id === w.type; }), v = S.pop.find(function (x) { return x.id === w.vid; }); return '<div class="wish" data-id="' + w.id + '"><b>' + def.ic + ' ' + esc(v ? v.name : '?') + '</b><span>' + esc(def.txt) + '</span><i data-t="' + w.until + '"></i></div>'; }).join('');
  }
  function renderWishTimers() { var now = Date.now(); document.querySelectorAll('#wishList i').forEach(function (i) { i.style.width = clamp((+i.dataset.t - now) / (C.wishTime * 1000) * 100, 0, 100) + '%'; }); }
  function renderChat() { var el = $('#chatList'); el.innerHTML = S.chat.slice(-9).map(function (c) { return c.sys ? '<div class="sys">' + esc(c.txt) + '</div>' : '<div><b>' + esc(c.nm) + '</b> : ' + esc(c.txt) + '</div>'; }).join(''); el.scrollTop = el.scrollHeight; }
  var STATE_NM = { idle: '쉬는 중', wander: '어슬렁', go: '가는 중', work: '일하는 중', pray: '기도 중', carry: '나르는 중', flee: '도망!', gift: '선물 주우러', held: '들려 있음' };
  function renderPop() {
    ui.dirty.pop = false; var el = $('#popList'), count = {}; S.pop.forEach(function (v) { count[v.job] = (count[v.job] || 0) + 1; });
    $('#jobSummary').innerHTML = Object.keys(D.JOBS).filter(function (k) { return count[k]; }).map(function (k) { return '<span>' + D.JOBS[k].ic + ' ' + D.JOBS[k].nm + ' ' + count[k] + '</span>'; }).join(' ');
    el.innerHTML = S.pop.slice(0, 60).map(function (v) { var j = D.JOBS[v.job]; return '<div class="item" data-id="' + v.id + '"><div class="ic"><canvas data-portrait="' + v.id + '"></canvas></div><div class="body"><div class="nm">' + esc(v.name) + ' <span class="sub">' + j.ic + ' ' + j.nm + (Date.now() < v.nudge ? ' (신의 뜻)' : '') + '</span></div><div class="sub">' + (v.held ? '들려 있음' : STATE_NM[v.state] || v.state) + (v.carry ? ' · ' + RES_IC[v.carry.res] + v.carry.n : '') + '</div></div></div>'; }).join('') + (S.pop.length > 60 ? '<div class="sub">… 외 ' + (S.pop.length - 60) + '명</div>' : '');
    el.querySelectorAll('canvas[data-portrait]').forEach(function (cv) { var v = S.pop.find(function (x) { return x.id === cv.dataset.portrait; }); if (v) drawPortrait(cv, v); });
  }
  function renderBld() {
    ui.dirty.bld = false; var next = nextBuilding();
    $('#bldNext').innerHTML = next ? '다음에 지을 것: <b>' + D.BUILDINGS[next].ic + ' ' + D.BUILDINGS[next].nm + '</b> — 필요: ' + Object.keys(D.BUILDINGS[next].cost).map(function (k) { return RES_IC[k] + D.BUILDINGS[next].cost[k] + (S.res[k] < D.BUILDINGS[next].cost[k] ? '<em>(부족)</em>' : ''); }).join(' ') : '지금은 지을 게 없어요. 기술을 발견하면 새 건물이 열립니다.';
    $('#bldList').innerHTML = S.blds.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); }).map(function (b) { var d = D.BUILDINGS[b.type]; return '<div class="item"><div class="ic">' + d.ic + '</div><div class="body"><div class="nm">' + d.nm + (b.done ? '' : ' <span class="sub">짓는 중 ' + Math.round(b.progress / d.work * 100) + '%</span>') + '</div><div class="sub">' + (d.housing ? '수용 ' + d.housing + '명' : d.role === 'research' ? '지식 ×' + d.research : d.role === 'faith' ? '믿음 ×' + (d.faith || 1) : d.role === 'storage' ? '보관 +' + C.storagePer : d.role === 'food' ? '농부가 식량 생산' : d.role === 'happy' ? '행복 +' + d.happy : d.role === 'metal' ? '금속' : d.role === 'launch' ? '새 세계로' : '') + '</div></div></div>'; }).join('') || '<div class="sub">아직 건물이 없어요. 시민들이 나무와 돌을 모으면 토템부터 세웁니다.</div>';
  }
  function renderTech() {
    ui.dirty.tech = false; var cur = currentTech();
    $('#techList').innerHTML = D.ERAS.map(function (e, i) { if (i > S.era + 1) return ''; return '<div class="era' + (i === S.era ? ' on' : i < S.era ? ' past' : ' future') + '"><b>' + e.ic + ' ' + e.nm + '</b><span class="sub">' + e.msg + '</span>' + D.TECHS.filter(function (t) { return t.era === i; }).map(function (t) { var done = hasTech(t.id); return '<div class="tech ' + (done ? 'done' : cur && cur.id === t.id ? 'cur' : '') + '">' + t.ic + ' ' + t.nm + ' <span class="sub">📜' + t.cost + (done ? ' ✓' : cur && cur.id === t.id ? ' · 연구 중 ' + Math.round(clamp(S.res.know / t.cost, 0, 1) * 100) + '%' : '') + (t.unlock ? ' · ' + D.BUILDINGS[t.unlock].nm + ' 해금' : '') + '</span></div>'; }).join('') + (i === S.era ? '<div class="sub">시대를 넘기려면: 이 시대 기술 전부 + ' + D.BUILDINGS[e.key].ic + ' ' + D.BUILDINGS[e.key].nm + '</div>' : '') + '</div>'; }).join('');
  }
  function renderAch() {
    ui.dirty.ach = false; var d = S.daily;
    $('#dailyList').innerHTML = D.DAILY.map(function (t) { return '<div class="' + (d[t.id] >= t.n ? 'ok' : '') + '">' + (d[t.id] >= t.n ? '✓' : '·') + ' ' + t.nm + ' ' + Math.min(d[t.id], t.n) + '/' + t.n + '</div>'; }).join('') + (d.claimed ? '<div class="ok">✅ 오늘의 과제 완료 (믿음 +' + D.DAILY_FAITH + ')</div>' : '<div class="sub">다 하면 믿음 +' + D.DAILY_FAITH + '</div>');
    $('#achList').innerHTML = D.ACHIEVEMENTS.map(function (a) { var ok = S.ach.indexOf(a.id) >= 0; return '<div class="item ' + (ok ? '' : 'dim') + '"><div class="ic">' + a.ic + '</div><div class="body"><div class="nm">' + a.nm + (ok ? ' ✓' : '') + '</div><div class="sub">' + { pop: '인구 ', era: '시대 ', tech: '발견 ', faith: '누적 믿음 ', wish: '소원 ', move: '옮기기 ', world: '세계 ' }[a.type] + (a.type === 'era' ? D.ERAS[a.n].nm : a.n) + (a.faith ? ' · 믿음 +' + a.faith : '') + '</div></div></div>'; }).join('');
  }
  function renderLog() { ui.dirty.log = false; $('#logList').innerHTML = S.log.map(function (l) { return '<div>' + l.t + ' ' + l.txt + '</div>'; }).join('') || '<div>아직 기록이 없어요.</div>'; }
  function renderMore() { $('#moreInfo').innerHTML = '세계 ' + S.world + ' · 누적 믿음 ' + fmt(S.faithTotal) + ' · 태어난 아이 ' + S.stats.born + ' · 들어준 소원 ' + S.stats.wishes + ' · 옮긴 횟수 ' + S.stats.moves + ' · 늑대 격퇴 ' + S.stats.wolves + '<br>오프라인 보상 ' + S.cfg.offPct + '% · 최대 ' + S.cfg.offHours + '시간 · 분당 측정 수입: ' + ['food', 'wood', 'know', 'faith'].map(function (k) { return RES_IC[k] + S.rate[k].toFixed(1); }).join(' '); $('#newWorldBtn').disabled = !S.launched; $('#soundBtn').textContent = S.cfg.sound ? '🔊 소리 켬' : '🔇 소리 끔'; }
  function renderSleep() { var d = new Date(); $('#sleepClock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); $('#sleepStats').textContent = '절전 ' + Math.floor((Date.now() - ui.sleepAt) / 60000) + '분 · ' + era().nm + ' · 👥 ' + S.pop.length + ' · ✨ ' + fmt(S.faith) + ' · 발견 ' + S.techs.length + '/' + D.TECHS.length; }
  function setSleep(on) { ui.sleep = on; $('#sleep').hidden = !on; if (on) { ui.sleepAt = Date.now(); renderSleep(); if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { ui.wake = l; }).catch(function () {}); } else { if (ui.wake) { ui.wake.release().catch(function () {}); ui.wake = null; } renderAll(); } }
  function renderAll() { renderHead(); renderWishes(); renderChat(); renderPop(); renderBld(); renderTech(); renderAch(); renderLog(); }
  var PANEL_TITLE = { pop: '👥 시민', bld: '🏗️ 건물', tech: '🔬 발견', ach: '🏆 업적·과제', more: '⋯ 더보기' };
  function openPanel(name) { document.querySelectorAll('#panel .pane').forEach(function (p) { p.classList.toggle('on', p.id === 'tab-' + name); }); $('#panelTitle').textContent = PANEL_TITLE[name]; if (name === 'pop') renderPop(); if (name === 'bld') renderBld(); if (name === 'tech') renderTech(); if (name === 'ach') renderAch(); if (name === 'more') { renderMore(); renderLog(); } $('#panel').hidden = false; document.querySelectorAll('.navbtn').forEach(function (b) { b.classList.toggle('on', b.dataset.panel === name); }); }
  function openVillager(v) {
    var j = D.JOBS[v.job];
    $('#sheetContent').innerHTML = '<div class="h-head"><canvas id="portrait"></canvas><div><div class="nm">' + esc(v.name) + '</div><div class="sub">' + j.ic + ' ' + j.nm + ' · ' + (STATE_NM[v.state] || v.state) + '</div><div class="sub">' + era().nm + ' 사람 · 태어난 지 ' + Math.floor((Date.now() - v.born) / 60000) + '분</div></div></div>' +
      '<p class="hint">직업은 마을 형편에 따라 스스로 바꿉니다. 지도에서 이 시민을 <b>집어서</b> 나무·바위·토템 옆에 내려놓으면 90초 동안 그 일을 합니다.</p>' +
      '<div class="row"><input id="renameIn" type="text" value="' + esc(v.name) + '" maxlength="8"><button class="btn" data-act="rename">이름 바꾸기</button><button class="btn" data-act="close">닫기</button></div>';
    $('#sheet').hidden = false; drawPortrait($('#portrait'), v); ui.sheetV = v;
  }

  // ---------- 입력 ----------
  function canvasPos(e) { var r = $('#field').getBoundingClientRect(); return { x: (e.clientX - r.left) / F.pix, y: (e.clientY - r.top) / F.pix }; }
  function bind() {
    var cv = $('#field');
    cv.addEventListener('pointerdown', function (e) {
      var p = canvasPos(e); ui.downAt = { x: p.x, y: p.y, t: Date.now() };
      var v = null, bd = 7; S.pop.forEach(function (o) { var d = Math.sqrt((o.x - p.x) * (o.x - p.x) + (o.y - 6 - p.y) * (o.y - 6 - p.y)); if (d < bd) { bd = d; v = o; } });
      if (v) { ui.held = v; v.held = true; v.state = 'idle'; v.carry = null; say(v, 'held', true); cv.setPointerCapture(e.pointerId); }
    });
    cv.addEventListener('pointermove', function (e) { if (!ui.held) return; var p = canvasPos(e); ui.held.x = clamp(p.x, 4, F.w - 4); ui.held.y = clamp(p.y, F.top + 4, F.h - 4); });
    cv.addEventListener('pointerup', function (e) {
      var p = canvasPos(e);
      if (ui.held) { var v = ui.held; ui.held = null; var moved = ui.downAt && (Math.abs(p.x - ui.downAt.x) > 3 || Math.abs(p.y - ui.downAt.y) > 3); if (moved) dropVillager(v, p.x, p.y); else { v.held = false; v.state = 'idle'; openVillager(v); } return; }
      if (ui.power) { usePower(ui.power, p.x, p.y); if (ui.power !== 'smite') ui.power = null; renderHead(); return; }
      var b = null; S.blds.forEach(function (o) { if (Math.abs(o.x - p.x) < bw(o.type) / 2 + 2 && p.y > o.y - 20 && p.y < o.y + 4) b = o; });
      if (b) { var d = D.BUILDINGS[b.type]; toast(d.ic + ' ' + d.nm + (b.done ? (d.housing ? ' · 수용 ' + d.housing + '명' : d.msg ? ' · ' + d.msg : '') : ' · 짓는 중 ' + Math.round(b.progress / d.work * 100) + '%')); return; }
      var n = null; S.nodes.forEach(function (o) { if (dist(o, p) < 7) n = o; }); if (n) toast(D.NODES[n.type].nm + ' · ' + RES_IC[D.NODES[n.type].res] + ' ' + Math.floor(n.amount) + ' 남음');
    });
    cv.addEventListener('pointercancel', function () { if (ui.held) { ui.held.held = false; ui.held.state = 'idle'; ui.held = null; } });
    document.querySelectorAll('.pw').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.power === 'oracle') { renderOracle(); $('#oracleSheet').hidden = false; return; } ui.power = ui.power === b.dataset.power ? null : b.dataset.power; var pw = D.POWERS.find(function (x) { return x.id === ui.power; }); if (pw) toast(pw.ic + ' ' + pw.nm + ' — 지도를 탭하세요 (' + pw.hint + ', 믿음 ' + pw.cost + ')'); renderHead(); }); });
    $('#oracleList').addEventListener('click', function (e) { var b = e.target.closest('[data-oracle]'); if (!b) return; useOracle(b.dataset.oracle); $('#oracleSheet').hidden = true; });
    $('#wishList').addEventListener('click', function (e) { var w = e.target.closest('.wish'); if (!w) return; var ws = S.wishes.find(function (x) { return x.id === w.dataset.id; }); if (ws) toast(D.WISHES.find(function (x) { return x.id === ws.type; }).hint); });
    document.querySelectorAll('.navbtn').forEach(function (b) { b.addEventListener('click', function () { openPanel(b.dataset.panel); }); });
    document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('.sheet').hidden = true; if (b.closest('#panel')) document.querySelectorAll('.navbtn').forEach(function (x) { x.classList.remove('on'); }); }); });
    $('#popList').addEventListener('click', function (e) { var el = e.target.closest('[data-id]'); if (!el) return; var v = S.pop.find(function (x) { return x.id === el.dataset.id; }); if (v) openVillager(v); });
    $('#sheetContent').addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'close') $('#sheet').hidden = true; if (b.dataset.act === 'rename' && ui.sheetV) { var nm = $('#renameIn').value.trim().slice(0, 8); if (nm) { ui.sheetV.name = nm; toast('이름을 ' + nm + '(으)로 바꿨어요'); renderPop(); save(); } $('#sheet').hidden = true; } });
    $('#sleepBtn').addEventListener('click', function () { setSleep(true); save(); }); $('#sleep').addEventListener('click', function () { setSleep(false); });
    $('#soundBtn').addEventListener('click', function () { S.cfg.sound = !S.cfg.sound; renderMore(); save(); });
    $('#newWorldBtn').addEventListener('click', function () { if (!S.launched) return; if (!confirm('새 세계를 열까요? 마을은 처음부터 다시 시작하고, 세계 ' + (S.world + 1) + '에서는 모든 생산이 +' + (S.world * 10) + '% 됩니다. 업적과 누적 믿음은 남습니다.')) return; newWorld(); $('#panel').hidden = true; });
    $('#welcomeOk').addEventListener('click', function () { $('#welcome').hidden = true; });
    $('#godFaith').addEventListener('click', function () { addFaith(100); renderHead(); save(); }); $('#godKnow').addEventListener('click', function () { S.res.know += 500; renderHead(); save(); }); $('#godEra').addEventListener('click', function () { D.TECHS.filter(function (t) { return t.era === S.era; }).forEach(function (t) { if (!hasTech(t.id)) S.techs.push(t.id); }); var k = era().key; if (!S.blds.some(function (b) { return b.type === k; })) { var pos = freeSlot(bw(k)) || center(); S.blds.push({ id: uid(), type: k, x: pos.x, y: pos.y, progress: 0, done: true }); } checkEra(); renderAll(); save(); });
    $('#godRes').addEventListener('click', function () { ['food', 'wood', 'stone', 'metal'].forEach(function (k) { S.res[k] += 300; }); renderHead(); save(); });
    $('#godExport').addEventListener('click', function () { $('#godData').value = JSON.stringify(S); $('#godData').select(); toast('아래 칸을 복사해 두세요'); });
    $('#godImport').addEventListener('click', function () { try { var s = JSON.parse($('#godData').value); if (!s || !s.pop) throw 0; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); location.reload(); } catch (e) { toast('저장 데이터 형식이 아니에요'); } });
    $('#godReset').addEventListener('click', function () { if (!confirm('정말 전부 지울까요? 되돌릴 수 없어요.')) return; localStorage.removeItem(SAVE_KEY); location.reload(); });
    $('#godOff').addEventListener('change', function () { S.cfg.offPct = clamp(parseInt($('#godOff').value, 10) || 50, 0, 100); save(); });
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); else { last = 0; offlineCatchUp(); renderAll(); } });
    window.addEventListener('pagehide', save);
  }
  function renderOracle() { $('#oracleList').innerHTML = D.ORACLES.map(function (o) { var locked = o.era !== undefined && S.era < o.era; return '<button class="btn oracle" data-oracle="' + o.id + '" ' + (locked ? 'disabled' : '') + '><b>' + o.ic + ' ' + o.nm + '</b><span class="sub">' + (o.hint || (C.oracleTime + '초 동안 시민들이 이 일에 집중')) + (locked ? ' · ' + D.ERAS[o.era].nm + '부터' : '') + ' · ✨' + o.cost + '</span></button>'; }).join(''); }
  function buildPowerBar() { $('#powerBar').innerHTML = D.POWERS.map(function (p) { return '<button class="pw" data-power="' + p.id + '" type="button"><i>' + p.ic + '</i>' + p.nm + '<small>✨' + p.cost + '</small></button>'; }).join('') + '<button class="pw oracleBtn" data-power="oracle" type="button"><i>📣</i>신탁<small>✨15+</small></button>'; }

  // ---------- 시작 ----------
  buildPowerBar(); resizeCanvas();
  S = load(); if (!S) newGame(); else { if (!S.nodes.length) placeNodes(); }
  bind(); $('#godOff').value = S.cfg.offPct; offlineCatchUp(); renderAll();
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__gv = { get S() { return S; }, F: F, ui: ui, D: D, save: save, center: center, usePower: usePower, useOracle: useOracle, dropVillager: dropVillager, slowTick: slowTick, nextBuilding: nextBuilding }; // 테스트·디버그용
})();
