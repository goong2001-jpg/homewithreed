/* 신의 마을 — 원시인 셋이 스스로 문명을 일구는 걸 지켜보는 신 게임 (2판: 넓은 세계·탐험·가족·군락·전투).
 * 데이터(시대·기술·건물·소원·대사·수치)는 data.js, 여기는 로직만.
 * 구성: 상태 → 세계 생성 → 시뮬레이션(시민·가족·건물·기술·소원·전투·적) → 신의 힘 → 픽셀 그리기(카메라) → 화면(DOM) → 입력 → 시작
 * 서버 없이 이 기기 브라우저(localStorage)에만 저장합니다. 테스트·콘솔용 핸들: window.__gv */
(function () {
  'use strict';
  var D = window.GV, C = D.CFG, W = D.WORLD, FM = D.FAMILY, EN = D.ENEMY, SAVE_KEY = 'god-village-v1';
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
  var RES_COL = { food: '#e06a5a', wood: '#a0703a', stone: '#9a9aa0', metal: '#d0a040', know: '#6fb3ff' };
  var WW = W.cols * W.cellW, WH = W.rows * W.cellH; // 세계 크기(픽셀)

  // ---------- 상태 ----------
  var S = null;
  function fresh() {
    return {
      v: 2, world: 1, era: 0, faith: C.startFaith, faithTotal: 0, happy: 50, res: { food: 25, wood: 12, stone: 6, metal: 0, know: 0 }, simT: 0,
      pop: [], blds: [], nodes: [], techs: [], wolves: [], gifts: [], wishes: [], ach: [], settles: [], explored: [], camps: [], pickups: [], hostiles: [],
      enemy: null, rally: null, oracle: null, miracle: null, rainUntil: 0, lastTick: Date.now(), nextWish: Date.now() + 40000, nextWolf: Date.now() + C.wolfEvery * 1000,
      marryT: 0, birthT: 0, log: [], chat: [], stats: { wishes: 0, gifts: 0, moves: 0, born: 0, wolves: 0, smites: 0, marry: 0, bandit: 0, defend: 0, conquer: 0, died: 0 },
      cfg: { offPct: C.offPct, offHours: C.offHours, sound: true }, daily: { date: today(), wish: 0, gift: 0, move: 0, claimed: false },
      rate: { food: 0, wood: 0, stone: 0, metal: 0, know: 0, faith: 0, born: 0 }, launched: false
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      var s = JSON.parse(raw), f = fresh();
      Object.keys(f).forEach(function (k) { if (s[k] === undefined) s[k] = f[k]; });
      Object.keys(f.stats).forEach(function (k) { if (s.stats[k] === undefined) s.stats[k] = 0; });
      if (s.v < 2) migrateV1(s);
      s.pop.forEach(function (v) { v.state = 'idle'; v.held = false; v.bubble = null; v.timer = 0; if (v.hp === undefined) v.hp = unitStat(v).hp; });
      return s;
    } catch (e) { return null; }
  }
  // 1판 저장(지도 한 칸) → 2판 세계로 옮기기: 건물은 종류만 남기고 우리 칸에 다시 놓는다
  function migrateV1(s) {
    var old = s.blds.slice(); s.v = 2; s.simT = 0; s.settles = []; s.explored = []; s.camps = []; s.pickups = []; s.hostiles = []; s.enemy = null; s.nodes = [];
    genWorld(s); var home = s.settles[0];
    s.blds = []; old.forEach(function (b) { var pos = freeSlotFor(s, home, bw(b.type)); if (pos) s.blds.push({ id: uid(), type: b.type, x: pos.x, y: pos.y, progress: b.progress, done: b.done, settle: home.id }); });
    s.pop.forEach(function (v, i) { v.x = home.x + rnd(-14, 14); v.y = home.y + rnd(-6, 10); v.settle = home.id; v.born = 0; v.age = FM.adultAfter + 1; v.child = false; v.partner = null; v.kids = 0; v.hp = unitStat(v).hp; });
  }
  function save() { if (window.__gv && window.__gv.lock) return; S.lastTick = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function addLog(txt) { var d = new Date(); S.log.unshift({ t: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), txt: txt }); if (S.log.length > 120) S.log.length = 120; ui.dirty.log = true; }
  var toastTimer = 0;
  function toast(msg) { var el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2600); }
  function say(v, kind, force) { if (!force && Math.random() > 0.5) return; var txt = pick(D.LINES[kind]); S.chat.push({ nm: v.name, txt: txt }); if (S.chat.length > 30) S.chat.shift(); v.bubble = { txt: txt, until: Date.now() + 2500 }; renderChat(); }
  function sysChat(txt) { S.chat.push({ sys: true, txt: txt }); if (S.chat.length > 30) S.chat.shift(); renderChat(); }
  function era() { return D.ERAS[S.era]; }
  function hasTech(id) { return S.techs.indexOf(id) >= 0; }
  function mul(key) { var m = 1 + (S.world - 1) * 0.1; S.techs.forEach(function (id) { var t = D.TECHS.find(function (x) { return x.id === id; }); if (t && t.effect[key]) m *= t.effect[key]; }); if (key === 'food' && S.miracle && S.miracle.id === 'harvest' && Date.now() < S.miracle.until) m *= 3; if (key === 'food' && Date.now() < S.rainUntil) m *= 1.5; if (key === 'faith') m *= 0.5 + S.happy / 100; return m; }
  function addFaith(n) { S.faith += n; S.faithTotal += n; }
  function storageCap() { var n = S.blds.filter(function (b) { return b.done && b.type === 'storage'; }).length; return Math.round((C.storageBase + C.storagePer * n) * (1 + S.era * 0.6) * (1 + (S.settles.length - 1) * 0.5)); }
  function addRes(k, n) { if (k === 'know') { S.res.know += n; return; } S.res[k] = Math.min(storageCap(), S.res[k] + n); }
  function housing(settle) { var h = 0; S.blds.forEach(function (b) { if (b.done && D.BUILDINGS[b.type].housing && (!settle || b.settle === settle.id)) h += D.BUILDINGS[b.type].housing; }); return h; }
  function popOf(settle) { return S.pop.filter(function (v) { return v.settle === settle.id; }); }
  function adults() { return S.pop.filter(function (v) { return !v.child; }); }
  function bldsOf(role, doneOnly, settle) { return S.blds.filter(function (b) { return (!doneOnly || b.done) && D.BUILDINGS[b.type].role === role && (!settle || b.settle === settle.id); }); }
  function settleOf(v) { return S.settles.find(function (s) { return s.id === v.settle; }) || S.settles[0]; }
  function home() { return S.settles[0]; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function moveToward(e, tx, ty, sp, dt) { var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1, s = Math.min(d, sp * dt); e.x += dx / d * s; e.y += dy / d * s; e.walk = (e.walk || 0) + dt * 8; e.face = dx < 0 ? -1 : 1; return d - s; }
  function cellOf(p) { return { c: clamp(Math.floor(p.x / W.cellW), 0, W.cols - 1), r: clamp(Math.floor(p.y / W.cellH), 0, W.rows - 1) }; }
  function cellCenter(c, r) { return { x: c * W.cellW + W.cellW / 2, y: r * W.cellH + W.cellH / 2 }; }
  function isExplored(c, r) { return !!(S.explored[r] && S.explored[r][c]); }
  function reveal(c, r) { if (isExplored(c, r)) return; S.explored[r][c] = true; var objs = S.camps.filter(function (k) { return k.c === c && k.r === r; }).map(function (k) { return '🏴‍☠️ 산적 소굴'; }).concat(S.pickups.filter(function (k) { return k.c === c && k.r === r; }).map(function (k) { return k.ic + ' ' + k.nm; }));
    if (S.enemy && S.enemy.c === c && S.enemy.r === r && !S.enemy.met) { S.enemy.met = true; S.enemy.metAt = S.simT; addFaith(30); sysChat('👀 ' + EN.nm + '의 마을을 발견했다! 그들도 우리를 알게 됐다 (믿음 +30)'); addLog('👀 <b>' + EN.nm + '</b> 발견'); toast('👀 ' + EN.nm + ' 발견! 언젠가 쳐들어올 수 있다'); }
    sysChat('🧭 새 땅을 발견했다' + (objs.length ? ': ' + objs.join(', ') : '')); ui.dirty.map = true; F.mapKey = ''; ui.dirty.head = true; }
  function exploredCount() { var n = 0; S.explored.forEach(function (row) { row.forEach(function (x) { if (x) n++; }); }); return n; }
  function unitStat(v) { var base = D.UNITS[v.child ? 'child' : v.job === 'warrior' ? 'warrior' : v.job === 'hunter' ? 'hunter' : 'citizen']; var m = 1 + S.era * 0.2; return { hp: Math.round(base.hp * m * mul('hp')), atk: base.atk * m * mul('atk') }; }

  // ---------- 세계 생성 ----------
  function seeded(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function genWorld(s) {
    var r = seeded(s.world * 17 + 3), c, rr, i;
    s.explored = []; for (rr = 0; rr < W.rows; rr++) { s.explored.push([]); for (c = 0; c < W.cols; c++) s.explored[rr].push(false); }
    s.explored[W.home.r][W.home.c] = true;
    var hc = cellCenter(W.home.c, W.home.r); s.settles = [{ id: uid(), nm: '첫 마을', x: Math.round(hc.x), y: Math.round(hc.y + 8), c: W.home.c, r: W.home.r }];
    var ec = cellCenter(W.enemy.c, W.enemy.r); s.enemy = { c: W.enemy.c, r: W.enemy.r, x: Math.round(ec.x), y: Math.round(ec.y), units: EN.units, met: false, metAt: 0, lastRaid: 0, growT: 0, alive: true, raids: 0 };
    s.nodes = []; s.camps = []; s.pickups = [];
    function addNode(type, cx, cy, spread) { for (var t = 0; t < 30; t++) { var p = { x: cx + (r() - 0.5) * spread, y: cy + (r() - 0.5) * spread * 0.8 }; var cc = cellOf(p); if (p.x < 6 || p.x > WW - 6 || p.y < 6 || p.y > WH - 6) continue; if (s.settles.some(function (st) { return dist(st, p) < 30; })) continue; if ((s.enemy.c === cc.c && s.enemy.r === cc.r) && dist(s.enemy, p) < 34) continue; if (s.nodes.some(function (o) { return dist(o, p) < 9; })) continue; s.nodes.push({ id: uid(), type: type, x: p.x, y: p.y, amount: D.NODES[type].max, vx: 0, vy: 0 }); return; } }
    for (rr = 0; rr < W.rows; rr++) for (c = 0; c < W.cols; c++) {
      var cc = cellCenter(c, rr), isHome = c === W.home.c && rr === W.home.r, isEnemy = c === W.enemy.c && rr === W.enemy.r;
      // 기본 자원
      var base = isHome ? { tree: 7, rock: 3, bush: 5, deer: 2, ore: 2 } : { tree: 4, rock: 2, bush: 2, deer: 1, ore: 1 };
      Object.keys(base).forEach(function (t) { for (i = 0; i < base[t]; i++) addNode(t, cc.x, cc.y, isHome ? 110 : 120); });
      if (isHome || isEnemy) continue;
      // 가운데 칸: 오브젝트 1~2개
      var n = 1 + (r() < 0.5 ? 1 : 0), used = [];
      for (i = 0; i < n; i++) {
        var pool = D.OBJECTS.filter(function (o) { return used.indexOf(o.id) < 0; }), sum = 0; pool.forEach(function (o) { sum += o.weight; }); var x = r() * sum, obj = pool[0]; for (var k = 0; k < pool.length; k++) { x -= pool[k].weight; if (x < 0) { obj = pool[k]; break; } } used.push(obj.id);
        var ox = cc.x + (r() - 0.5) * 70, oy = cc.y + (r() - 0.5) * 70;
        if (obj.id === 'hunt') { for (var a = 0; a < 3; a++) addNode('deer', ox, oy, 50); for (a = 0; a < 2; a++) addNode('boar', ox, oy, 50); }
        else if (obj.id === 'grove') { for (a = 0; a < 5; a++) addNode('bush', ox, oy, 50); for (a = 0; a < 3; a++) addNode('tree', ox, oy, 60); }
        else if (obj.id === 'quarry') { for (a = 0; a < 3; a++) addNode('rock', ox, oy, 50); for (a = 0; a < 3; a++) addNode('ore', ox, oy, 50); }
        else if (obj.id === 'bandit') s.camps.push({ id: uid(), c: c, r: rr, x: Math.round(ox), y: Math.round(oy), units: obj.units, cleared: false, spawned: false, loot: obj.loot });
        else s.pickups.push({ id: uid(), kind: obj.id, nm: obj.nm, ic: obj.ic, c: c, r: rr, x: Math.round(ox), y: Math.round(oy), reward: obj.reward, taken: false });
      }
    }
  }
  function genLook() { return { hair: ri(0, 4), hc: pick(D.HAIR), skin: pick(D.SKIN) }; }
  function makeVillager(x, y, job, settle, child) {
    var v = { id: uid(), name: pick(D.NAMES), look: genLook(), job: child ? 'child' : (job || 'gather'), state: 'idle', x: x, y: y, tx: x, ty: y, timer: 0, node: null, bld: null, carry: null, bubble: null, nextTalk: rnd(5, 30), nudge: 0, held: false, droppedAt: 0, face: 1, walk: 0, born: S ? S.simT : 0, age: child ? 0 : FM.adultAfter + 1, child: !!child, partner: null, kids: 0, settle: settle ? settle.id : null, hp: 10 };
    if (S) v.hp = unitStat(v).hp; return v;
  }
  function newGame() {
    S = fresh(); genWorld(S); var h = home();
    ['gather', 'lumber', 'miner'].forEach(function (j) { S.pop.push(makeVillager(h.x + rnd(-10, 10), h.y + rnd(-4, 8), j, h)); });
    S.pop.forEach(function (v) { v.hp = unitStat(v).hp; });
    sysChat('🌅 세 사람이 들판에 섰다. 신이시여, 지켜봐 주소서.'); addLog('세계 ' + S.world + ' 시작');
    cam.x = h.x - F.vw / 2; cam.y = h.y - F.vh / 2 + 10;
  }

  // ---------- 시뮬레이션 ----------
  var F = { vw: 195, vh: 300, pix: 2, ctx: null, map: null, mapKey: '', time: 0, fx: [], rain: 0, flash: 0, shake: 0 };
  var cam = { x: 0, y: 0 };
  function researchBld(settle) { var best = null; S.blds.forEach(function (b) { if (!b.done) return; var d = D.BUILDINGS[b.type]; if (d.research && (!best || (d.research === true ? 1 : d.research) > (D.BUILDINGS[best.type].research === true ? 1 : D.BUILDINGS[best.type].research))) best = b; }); return best; }
  function faithBld(settle) { var cs = S.blds.filter(function (b) { return b.done && D.BUILDINGS[b.type].role === 'faith' && (!settle || b.settle === settle.id); }); if (!cs.length) cs = S.blds.filter(function (b) { return b.done && D.BUILDINGS[b.type].role === 'faith'; }); return cs[cs.length - 1] || null; }
  function totem(settle) { return S.blds.find(function (b) { return b.done && b.type === 'totem' && (!settle || b.settle === settle.id); }); }
  function depot(v) { var st = settleOf(v), best = null, bd = 1e9; S.blds.forEach(function (b) { if (!b.done || b.settle !== st.id || (b.type !== 'storage' && b.type !== 'totem')) return; var d = dist(v, b); if (d < bd) { bd = d; best = b; } }); return best ? { x: best.x, y: best.y + 3 } : { x: st.x, y: st.y + 4 }; }
  function nearestNode(v, type, maxD) { var best = null, bd = maxD || 150; S.nodes.forEach(function (n) { if (n.type !== type || n.amount < 1) return; var cc = cellOf(n); if (!isExplored(cc.c, cc.r)) return; var d = dist(v, n); if (d < bd) { bd = d; best = n; } }); return best; }
  function nearestHostile(p, r) { var best = null, bd = r; S.hostiles.forEach(function (h) { var d = dist(p, h); if (d < bd) { bd = d; best = h; } }); S.wolves.forEach(function (w) { var d = dist(p, w); if (d < bd) { bd = d; best = w; } }); return best; }
  function fighter(v) { return !v.child && (v.job === 'warrior' || (v.job === 'hunter' && hasTech('hunting'))); }
  function jobOk(job) { var j = D.JOBS[job]; if (!j || job === 'child') return false; if (j.tech && !hasTech(j.tech)) return false; if (job === 'farmer' && !bldsOf('food', true).length) return false; if (job === 'smith' && !S.nodes.some(function (n) { return n.type === 'ore'; })) return false; if (job === 'builder' && !S.blds.some(function (b) { return !b.done; })) return false; if (job === 'scout' && exploredCount() >= W.cols * W.rows && !S.pickups.some(function (k) { return !k.taken && isExplored(k.c, k.r); })) return false; return true; }
  function currentTech() { return D.TECHS.find(function (t) { return t.era <= S.era && !hasTech(t.id); }) || null; }
  function wolvesAllowed() { return S.era < 3 && !S.blds.some(function (b) { return b.done && b.type === 'castle'; }); }

  function step(dt) {
    var now = Date.now(); F.time += dt; S.simT += dt;
    S.nodes.forEach(function (n) { var d = D.NODES[n.type]; if (n.amount < d.max) n.amount = Math.min(d.max, n.amount + d.regrow * dt); if (d.moves) { if (Math.random() < dt * 0.3) { n.vx = rnd(-6, 6); n.vy = rnd(-4, 4); } n.x = clamp(n.x + n.vx * dt, 6, WW - 6); n.y = clamp(n.y + n.vy * dt, 6, WH - 6); } });
    S.res.food = Math.max(0, S.res.food - S.pop.length * C.foodPerPop * dt);
    S.pop.forEach(function (v) { stepVillager(v, dt, now); });
    stepHostiles(dt, now);
    for (var j = F.fx.length - 1; j >= 0; j--) { var f = F.fx[j]; f.t += dt; if (f.kind === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; } if (f.kind === 'num') f.y -= 8 * dt; if (f.kind === 'heart') f.y -= 6 * dt; if (f.t > f.life) F.fx.splice(j, 1); }
    F.rain = Math.max(0, F.rain - dt); F.flash = Math.max(0, F.flash - dt); F.shake = Math.max(0, F.shake - dt * 8);
    if (S.rally && now > S.rally.until) S.rally = null;
    slow.t += dt; if (slow.t >= 2) { slow.t = 0; slowTick(now); }
    S.pop.forEach(function (v) { if (v.bubble && now > v.bubble.until) v.bubble = null; });
  }
  var slow = { t: 0, n: 0 };
  function slowTick(now) {
    slow.n++;
    rebalanceJobs(); updateHappy(); checkTech(); checkEra(); S.settles.forEach(planBuilding);
    if (now > S.nextWish) { S.nextWish = now + C.wishEvery * 1000; makeWish(); }
    checkWishes(now); family(); enemyTick(now); campsTick();
    if (slow.n % 3 === 0) { checkAch(); checkDaily(); }
    if (S.oracle && now > S.oracle.until) { S.oracle = null; sysChat('📣 신탁의 효력이 다했다'); }
    if (wolvesAllowed() && now > S.nextWolf && S.pop.length >= 4) { S.nextWolf = now + C.wolfEvery * 1000 * rnd(0.8, 1.3); spawnWolf(); }
    renderHead();
  }
  function stepVillager(v, dt, now) {
    if (v.held) return;
    v.anim = Math.max(0, (v.anim || 0) - dt); v.age += dt;
    if (v.down) { if (S.simT < v.down) { v.hp = Math.min(unitStat(v).hp, v.hp + dt * unitStat(v).hp / 30); return; } v.down = 0; v.state = 'idle'; }
    var cc = cellOf(v); if (!isExplored(cc.c, cc.r)) reveal(cc.c, cc.r);
    if (F.time > v.nextTalk) { v.nextTalk = F.time + rnd(20, 60); say(v, v.child ? 'child' : v.state === 'pray' ? 'pray' : v.state === 'fight' ? 'war' : v.job === 'scout' ? 'explore' : 'idle', true); }
    if (v.hp < unitStat(v).hp && v.state !== 'fight') v.hp = Math.min(unitStat(v).hp, v.hp + dt * 0.5);
    // 위협: 싸울 수 있으면 싸우고, 아니면 도망
    var threat = nearestHostile(v, fighter(v) ? 40 : 28);
    if (threat && !fighter(v) && v.state !== 'migrate') { v.state = 'flee'; }
    if (v.state === 'flee') { var w2 = nearestHostile(v, 40); if (!w2) { v.state = 'idle'; return; } var dx = v.x - w2.x, dy = v.y - w2.y, d = Math.sqrt(dx * dx + dy * dy) || 1; var st0 = settleOf(v); if (dist(v, st0) > 30) { dx += (st0.x - v.x) * 0.02; dy += (st0.y - v.y) * 0.02; } v.x = clamp(v.x + dx / d * 24 * dt, 4, WW - 4); v.y = clamp(v.y + dy / d * 24 * dt, 4, WH - 4); v.walk += dt * 8; v.face = dx < 0 ? -1 : 1; return; }
    if (fighter(v) && !v.carry && v.state !== 'migrate') {
      var tgt = threat; var rallyOn = S.rally && v.job === 'warrior' || (S.rally && S.rally.all);
      if (!tgt && rallyOn) { if (dist(v, S.rally) > 10) { v.state = 'fight'; moveToward(v, S.rally.x + rnd(-6, 6), S.rally.y + rnd(-4, 4), 24, dt); return; } tgt = nearestHostile(v, 70); }
      if (tgt) { v.state = 'fight'; if (dist(v, tgt) > 6) moveToward(v, tgt.x, tgt.y, 22, dt); else { v.timer -= dt; if (v.timer <= 0) { v.timer = 1; v.anim = 0.3; hit(v, tgt, unitStat(v).atk); } } return; }
      if (v.state === 'fight') v.state = 'idle';
    }
    if (v.state === 'gift') { var g = S.gifts.find(function (x) { return x.id === v.gift; }); if (!g) { v.state = 'idle'; return; } if (moveToward(v, g.x, g.y, 22, dt) < 2) { S.gifts = S.gifts.filter(function (x) { return x !== g; }); addRes(g.res, g.n); F.fx.push({ kind: 'num', x: v.x, y: v.y - 16, txt: '+' + g.n + RES_IC[g.res], color: RES_COL[g.res], size: 6, t: 0, life: 1 }); say(v, 'gift', true); v.state = 'idle'; } return; }
    if (v.state === 'migrate') { if (moveToward(v, v.tx, v.ty, 18, dt) < 2) { v.state = 'idle'; say(v, 'settle'); } return; }
    if (v.state === 'idle') { decide(v); return; }
    if (v.state === 'wander') { if (moveToward(v, v.tx, v.ty, v.child ? 6 : 8, dt) < 1 || (v.timer -= dt) <= 0) v.state = 'idle'; return; }
    if (v.state === 'explore') { if (moveToward(v, v.tx, v.ty, 18, dt) < 2 || (v.timer -= dt) <= 0) { v.state = 'idle'; } return; }
    if (v.state === 'pickup') { var pk = S.pickups.find(function (x) { return x.id === v.pick; }); if (!pk || pk.taken) { v.state = 'idle'; return; } if (moveToward(v, pk.x, pk.y, 18, dt) < 2) { pk.taken = true; var rw = pk.reward; if (rw.faith) addFaith(rw.faith); if (rw.know) S.res.know += rw.know; sysChat(pk.ic + ' ' + v.name + '이(가) ' + pk.nm + '을(를) 찾았다! ' + (rw.faith ? '믿음 +' + rw.faith : '지식 +' + rw.know)); addLog(pk.ic + ' <b>' + pk.nm + '</b> 발견'); burst(pk, '#ffe9a8', 16); say(v, 'loot', true); v.state = 'idle'; ui.dirty.map = true; } return; }
    if (v.state === 'go') {
      var tg = v.node ? S.nodes.find(function (n) { return n.id === v.node; }) : (v.bld ? S.blds.find(function (b) { return b.id === v.bld; }) : null);
      if (!tg) { v.state = 'idle'; return; }
      if (moveToward(v, tg.x + (v.off || 0), tg.y + 3, 16, dt) < 1.2) { v.state = v.bld && D.BUILDINGS[tg.type].role === 'faith' && v.job === 'priest' ? 'pray' : 'work'; v.timer = v.state === 'pray' ? C.prayTime : C.gatherTime; if (v.node && (tg.type === 'deer' || tg.type === 'boar')) v.timer = 2; }
      return;
    }
    if (v.state === 'work' || v.state === 'pray') {
      v.timer -= dt; v.anim = 0.2;
      if (v.bld) { var b = S.blds.find(function (x) { return x.id === v.bld; }); if (!b) { v.state = 'idle'; return; } if (!b.done) { b.progress += dt * mul('build'); if (b.progress >= D.BUILDINGS[b.type].work) finishBuilding(b); v.timer = 1; return; } }
      if (v.timer > 0) return; finishWork(v); return;
    }
    if (v.state === 'carry') { var dp = depot(v); if (moveToward(v, dp.x, dp.y, 15, dt) < 1.5) { if (v.carry) { addRes(v.carry.res, v.carry.n); rateAcc[v.carry.res] += v.carry.n; } v.carry = null; v.state = 'idle'; } return; }
  }
  function decide(v) {
    var st = settleOf(v), j = D.JOBS[v.job];
    // 선물: 아무도 가지러 가고 있지 않으면(주우러 가던 사람이 다른 일로 바뀌었어도) 내가 간다
    var g = S.gifts.find(function (x) { return dist(v, x) < 70 && !S.pop.some(function (o) { return o !== v && o.state === 'gift' && o.gift === x.id; }); }); if (g && !v.child) { g.taken = true; v.gift = g.id; v.state = 'gift'; return; }
    if (v.child) { v.tx = clamp(st.x + rnd(-20, 20), 4, WW - 4); v.ty = clamp(st.y + rnd(-8, 12), 4, WH - 4); v.timer = rnd(2, 5); v.state = 'wander'; return; }
    if (v.job === 'scout') {
      var pk = null, bd = 1e9; S.pickups.forEach(function (k) { if (k.taken || !isExplored(k.c, k.r)) return; var d = dist(v, k); if (d < bd) { bd = d; pk = k; } }); if (pk) { v.pick = pk.id; v.state = 'pickup'; return; }
      var best = null; bd = 1e9; for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++) { if (isExplored(c, r)) continue; var cc = cellCenter(c, r), d = dist(v, cc); if (d < bd) { bd = d; best = cc; } }
      if (best) { v.tx = best.x + rnd(-20, 20); v.ty = best.y + rnd(-20, 20); v.timer = 40; v.state = 'explore'; return; }
      return wander(v);
    }
    if (v.job === 'warrior') { var th = nearestHostile(v, 90); if (th) { v.state = 'fight'; return; } v.tx = clamp(st.x + rnd(-26, 26), 4, WW - 4); v.ty = clamp(st.y + rnd(-10, 14), 4, WH - 4); v.timer = rnd(2, 5); v.state = 'wander'; return; }
    if (v.job === 'builder') { var site = null, sd = 1e9; S.blds.forEach(function (b) { if (b.done) return; var d = dist(v, b); if (d < sd) { sd = d; site = b; } }); if (site) { v.bld = site.id; v.node = null; v.off = rnd(-5, 5); v.state = 'go'; return; } return wander(v); }
    if (v.job === 'scholar') { var rb = researchBld() || totem(); if (rb) { v.bld = rb.id; v.node = null; v.off = rnd(-6, 6); v.state = 'go'; return; } return wander(v); }
    if (v.job === 'priest') { var fb = faithBld(st); if (fb) { v.bld = fb.id; v.node = null; v.off = rnd(-7, 7); v.state = 'go'; return; } return wander(v); }
    if (v.job === 'farmer') { var farms = bldsOf('food', true, st); if (!farms.length) farms = bldsOf('food', true); if (farms.length) { var fm = pick(farms); v.bld = fm.id; v.node = null; v.off = rnd(-5, 5); v.state = 'go'; return; } }
    var type = j.node || 'bush', n = nearestNode(v, type) || (type === 'deer' ? nearestNode(v, 'boar') : null) || nearestNode(v, 'bush') || nearestNode(v, 'tree');
    if (n) { v.node = n.id; v.bld = null; v.off = rnd(-3, 3); v.state = 'go'; return; }
    wander(v);
  }
  function wander(v) { var st = settleOf(v); v.tx = clamp(st.x + rnd(-24, 24), 4, WW - 4); v.ty = clamp(st.y + rnd(-10, 14), 4, WH - 4); v.timer = rnd(2, 5); v.state = 'wander'; }
  function finishWork(v) {
    var amt;
    if (v.state === 'pray') { amt = C.prayFaith * mul('faith'); addFaith(amt); rateAcc.faith += amt; F.fx.push({ kind: 'spark', x: v.x, y: v.y - 14, vx: 0, vy: -8, color: '#ffe9a8', t: 0, life: 1 }); v.state = 'idle'; return; }
    if (v.bld) { var b = S.blds.find(function (x) { return x.id === v.bld; }), d = b ? D.BUILDINGS[b.type] : null;
      if (d && d.research && v.job === 'scholar') { amt = (C.knowPerWork || 1) * (d.research === true ? 1 : d.research) * mul('know'); S.res.know += amt; rateAcc.know += amt; F.fx.push({ kind: 'num', x: v.x, y: v.y - 15, txt: '+' + Math.round(amt) + '📜', color: RES_COL.know, size: 5, t: 0, life: 0.8 }); v.state = 'idle'; return; }
      if (d && d.role === 'food') { v.carry = { res: 'food', n: Math.round(C.gatherAmount * 1.5 * mul('food')) }; v.state = 'carry'; return; }
      if (d && d.role === 'faith') { amt = C.prayFaith * (d.faith || 1) * mul('faith'); addFaith(amt); rateAcc.faith += amt; v.state = 'idle'; return; }
      v.state = 'idle'; return; }
    var n = S.nodes.find(function (x) { return x.id === v.node; }); if (!n) { v.state = 'idle'; return; }
    var take = Math.min(n.amount, n.type === 'deer' ? 6 : n.type === 'boar' ? 8 : C.gatherAmount); n.amount -= take;
    v.carry = { res: D.NODES[n.type].res, n: Math.round(take * mul(D.NODES[n.type].res)) }; v.state = 'carry';
  }
  function rebalanceJobs() {
    var ad = adults(), pop = ad.length, w = { gather: 2, hunter: 0, farmer: 0, lumber: 2, miner: 1, smith: 0, builder: 0, scholar: 1, priest: 1, scout: 0, warrior: 0 };
    if (S.res.food < S.pop.length * 4) { w.gather += 4; w.hunter += 3; w.farmer += 4; } else if (S.res.food > S.pop.length * 12) w.gather = 1;
    if (hasTech('hunting')) w.hunter += 2; if (jobOk('farmer')) w.farmer += 3; if (jobOk('smith')) w.smith += 2;
    S.settles.forEach(function (st) { var next = nextBuilding(st); if (next) { var cost = D.BUILDINGS[next].cost; if ((cost.wood || 0) > S.res.wood) w.lumber += 2; if ((cost.stone || 0) > S.res.stone) w.miner += 2; if ((cost.metal || 0) > S.res.metal) w.smith += 2; } });
    if (S.blds.some(function (b) { return !b.done; })) w.builder += 3 + Math.floor(pop / 8);
    if (currentTech() && (researchBld() || totem())) w.scholar += 2 + Math.floor(pop / 10);
    if (faithBld()) w.priest += 1 + Math.floor(pop / 12);
    if (jobOk('scout') && pop >= 4) w.scout += 1 + (S.pickups.some(function (k) { return !k.taken && isExplored(k.c, k.r); }) ? 2 : 0);
    if (hasTech('weapons')) { var threat = S.hostiles.length || (S.enemy && S.enemy.met) || S.camps.some(function (k) { return !k.cleared && isExplored(k.c, k.r); }); w.warrior += threat ? 3 + Math.floor(pop / 6) : 1 + Math.floor(pop / 12); if (S.rally || (S.enemy && S.enemy.met && raidActive())) w.warrior += 4; }
    if (S.oracle) Object.keys(S.oracle.weight).forEach(function (k) { w[k] += S.oracle.weight[k] * 2; });
    Object.keys(w).forEach(function (k) { if (!jobOk(k)) w[k] = 0; });
    var sum = 0; Object.keys(w).forEach(function (k) { sum += w[k]; }); if (!sum || !pop) return;
    var count = {}; ad.forEach(function (v) { count[v.job] = (count[v.job] || 0) + 1; });
    var over = null, under = null, oMax = -1e9, uMax = -1e9;
    Object.keys(w).forEach(function (k) { var want = w[k] / sum * pop, have = count[k] || 0, diff = have - want; if (diff > oMax && have > 0) { oMax = diff; over = k; } if (-diff > uMax && w[k] > 0) { uMax = -diff; under = k; } });
    ad.forEach(function (v) { if (!jobOk(v.job) && v.job !== 'gather' && Date.now() > v.nudge) { v.job = 'gather'; v.state = 'idle'; } });
    if (!over || !under || over === under || uMax < 0.6) return;
    var cand = ad.filter(function (v) { return v.job === over && !v.carry && !v.held && Date.now() > v.nudge && (v.state === 'idle' || v.state === 'wander' || v.state === 'go'); });
    if (cand.length) { var v = pick(cand); v.job = under; v.state = 'idle'; v.node = null; v.bld = null; v.hp = Math.min(v.hp, unitStat(v).hp); }
  }
  function updateHappy() {
    var pop = S.pop.length, t = 50;
    if (S.res.food > pop * 6) t += 10; if (S.res.food <= 0) t -= 20; if (housing() < pop) t -= 12;
    S.blds.forEach(function (b) { if (b.done && D.BUILDINGS[b.type].happy) t += D.BUILDINGS[b.type].happy; });
    t += S.era * 2; if (Date.now() < S.rainUntil) t += 5; if (S.wolves.length) t -= 8; if (raidActive()) t -= 10;
    t = clamp(t, 0, 100); S.happy += (t - S.happy) * 0.15;
  }
  function checkTech() {
    var t = currentTech(); if (!t) return;
    if (S.res.know >= t.cost) { S.res.know -= t.cost; S.techs.push(t.id); addLog(t.ic + ' <b>' + t.nm + '</b> 발견 — ' + t.msg); sysChat(t.ic + ' ' + t.nm + ' 발견! ' + t.msg); toast(t.ic + ' ' + t.nm + '을(를) 발견했다!'); burst(home(), '#6fb3ff', 20); S.pop.slice(0, 3).forEach(function (v) { say(v, 'tech', true); }); S.pop.forEach(function (v) { v.hp = Math.min(unitStat(v).hp, v.hp + 5); }); ui.dirty.tech = true; checkAch(); }
  }
  function checkEra() {
    var e = era(), allTech = D.TECHS.filter(function (t) { return t.era === S.era; }).every(function (t) { return hasTech(t.id); });
    var key = S.blds.some(function (b) { return b.done && b.type === e.key; }), popOk = S.pop.length >= (e.minPop || 0);
    if (allTech && key && popOk && S.era < D.ERAS.length - 1) { S.era++; var ne = era(); addFaith(20); S.happy = Math.min(100, S.happy + 10); addLog('🎉 <b>' + ne.nm + '</b>가 열렸다! ' + ne.msg); sysChat('🎉 ' + ne.nm + '가 열렸다! ' + ne.msg); toast('🎉 ' + ne.nm + '!'); burst(home(), '#ffd34f', 40); S.pop.forEach(function (v) { if (Math.random() < 0.4) say(v, 'era', true); }); F.mapKey = ''; ui.dirty.tech = true; }
  }
  function nextBuilding(st) {
    var pop = popOf(st).length, pending = S.blds.filter(function (b) { return !b.done && b.settle === st.id; }); if (pending.length >= 2) return null;
    var avail = Object.keys(D.BUILDINGS).filter(function (k) { var b = D.BUILDINGS[k]; if (b.era > S.era) return false; var ub = D.TECHS.find(function (t) { return t.unlock === k; }); if (ub && !hasTech(ub.id)) return false; return true; });
    var has = function (k) { return S.blds.some(function (b) { return b.type === k && b.settle === st.id; }); }, hasAny = function (k) { return S.blds.some(function (b) { return b.type === k; }); };
    var one = avail.filter(function (k) { var b = D.BUILDINGS[k]; if (b.auto !== 'one') return false; if (k === 'totem') return !has(k); if (st.id !== home().id) return false; return !hasAny(k); });
    if (one.length) return one[0];
    if (housing(st) < pop + 2) { var houses = avail.filter(function (k) { return D.BUILDINGS[k].auto === 'house'; }); if (houses.length) return houses[houses.length - 1]; }
    var cap = storageCap(); if (RES.some(function (k) { return k !== 'know' && S.res[k] > cap * 0.85; }) && avail.indexOf('storage') >= 0 && S.blds.filter(function (b) { return b.type === 'storage'; }).length < 2 + S.era + S.settles.length) return 'storage';
    if (avail.indexOf('farm') >= 0 && bldsOf('food', false, st).length < Math.floor(pop / 5)) return 'farm';
    return null;
  }
  function canAfford(cost) { return Object.keys(cost).every(function (k) { return S.res[k] >= cost[k]; }); }
  function bw(type) { return { totem: 6, campfire: 8, hut: 12, storage: 12, farm: 16, thatch: 14, forge: 14, wood: 16, school: 16, stone: 18, market: 20, castle: 24, brick: 18, university: 22, theater: 18, rowhouse: 24, factory: 22, powerplant: 20, tower: 14, lab: 20, park: 22, dome: 22, rocket: 12 }[type] || 14; }
  function freeSlotFor(s, st, w) {
    var cand = [], r = seeded(s.blds.length * 31 + 5 + st.x);
    for (var i = 0; i < 500; i++) { var ang = r() * Math.PI * 2, rad = 20 + r() * 52; var p = { x: Math.round(st.x + Math.cos(ang) * rad), y: Math.round(st.y + Math.sin(ang) * rad * 0.8) };
      if (p.x < 10 || p.x > WW - 10 || p.y < 14 || p.y > WH - 4) continue;
      if (s.blds.some(function (b) { return Math.abs(b.x - p.x) < (w + bw(b.type)) / 2 + 4 && Math.abs(b.y - p.y) < 18; })) continue;
      if (s.nodes.some(function (n) { return dist(n, p) < 8 + w / 2; })) continue;
      if (s.settles.some(function (o) { return o !== st && dist(o, p) < 40; })) continue;
      cand.push({ p: p, d: dist(p, st) }); }
    if (!cand.length) return null; cand.sort(function (a, b) { return a.d - b.d; }); return cand[0].p;
  }
  function planBuilding(st) {
    var k = nextBuilding(st); if (!k) return; var d = D.BUILDINGS[k]; if (!canAfford(d.cost)) return;
    var pos = freeSlotFor(S, st, bw(k));
    if (!pos && d.auto === 'house') { var old = S.blds.filter(function (b) { return b.done && b.settle === st.id && D.BUILDINGS[b.type].housing && D.BUILDINGS[b.type].era < S.era; })[0]; if (!old) return; Object.keys(d.cost).forEach(function (r) { S.res[r] -= d.cost[r]; }); old.type = k; old.done = false; old.progress = 0; sysChat('🏗️ ' + st.nm + ': 낡은 집을 헐고 ' + d.nm + '을(를) 짓기 시작했다'); ui.dirty.bld = true; return; }
    if (!pos) return;
    Object.keys(d.cost).forEach(function (r) { S.res[r] -= d.cost[r]; });
    S.blds.push({ id: uid(), type: k, x: pos.x, y: pos.y, progress: 0, done: false, settle: st.id });
    sysChat('🏗️ ' + (S.settles.length > 1 ? st.nm + ': ' : '') + d.ic + ' ' + d.nm + '을(를) 짓기 시작했다'); ui.dirty.bld = true;
  }
  function finishBuilding(b) {
    b.done = true; b.progress = D.BUILDINGS[b.type].work; var d = D.BUILDINGS[b.type];
    addLog('🏠 <b>' + d.nm + '</b> 완성' + (d.msg ? ' — ' + d.msg : '')); sysChat('✅ ' + d.ic + ' ' + d.nm + ' 완성!' + (d.msg ? ' ' + d.msg : ''));
    burst({ x: b.x, y: b.y - 6 }, '#ffe9a8', 14); ui.dirty.bld = true;
    if (d.role === 'launch') { S.launched = true; toast('🚀 우주선 완성! 더보기에서 새 세계를 열 수 있어요'); }
  }
  // ---- 가족·세대·군락 ----
  function family() {
    S.marryT += 2; S.birthT += 2; var now = Date.now();
    // 마을이 거의 비면 피난민이 찾아온다 (기술·건물은 그대로)
    if (adults().length <= 1) { S.refugeeT = (S.refugeeT || 0) + 2; if (S.refugeeT >= 20) { S.refugeeT = 0; var h0 = home(); for (var q = 0; q < 2; q++) { var nv = makeVillager(h0.x + rnd(-10, 10), h0.y + rnd(-4, 8), q ? 'lumber' : 'gather', h0); nv.hp = unitStat(nv).hp; S.pop.push(nv); } sysChat('🏃 피난민 두 사람이 마을을 찾아왔다. 다시 시작할 수 있다.'); addLog('🏃 <b>피난민</b> 도착'); toast('🏃 피난민이 찾아왔다'); ui.dirty.pop = true; } }
    // 어른이 됨
    S.pop.forEach(function (v) { if (v.child && v.age >= FM.adultAfter) { v.child = false; v.job = 'gather'; v.hp = unitStat(v).hp; say(v, 'grow', true); sysChat('🧑 ' + v.name + '이(가) 어른이 됐다'); } });
    // 결혼: 같은 군락의 짝 없는 어른 둘
    if (S.marryT >= FM.marryEvery) { S.marryT = 0; S.settles.forEach(function (st) { var singles = popOf(st).filter(function (v) { return !v.child && !v.partner; }); if (singles.length >= 2) { var a = singles.splice(ri(0, singles.length - 1), 1)[0], b = pick(singles); a.partner = b.id; b.partner = a.id; S.stats.marry++; sysChat('💕 ' + a.name + '와(과) ' + b.name + '이(가) 부부가 됐다'); addLog('💕 <b>' + a.name + '</b> · <b>' + b.name + '</b> 결혼'); say(a, 'marry', true); say(b, 'marry', true); for (var i = 0; i < 6; i++) F.fx.push({ kind: 'heart', x: a.x + rnd(-6, 6), y: a.y - 14, t: 0, life: 1.4 }); S.wishes.slice().forEach(function (w) { if (w.type === 'love' && (w.vid === a.id || w.vid === b.id)) fulfill(w, S.pop.find(function (x) { return x.id === w.vid; })); }); } }); }
    // 출산: 부부 중 하나, 식량·집·행복
    if (S.birthT >= FM.birthEvery * Math.pow(0.92, S.era) / mul('growth')) { S.birthT = 0; if (S.pop.length < 220 && S.res.food >= C.growthFood && S.happy >= 30) {
      var couples = S.pop.filter(function (v) { return v.partner && !v.child && v.kids < FM.maxChildren && S.pop.some(function (o) { return o.id === v.partner; }); });
      var st = null, par = null; couples.some(function (v) { var s2 = settleOf(v); if (housing(s2) > popOf(s2).length) { st = s2; par = v; return true; } return false; });
      if (par) { var mate = S.pop.find(function (o) { return o.id === par.partner; }); par.kids++; if (mate) mate.kids++; S.res.food -= C.growthFood; var house = pick(S.blds.filter(function (b) { return b.done && b.settle === st.id && D.BUILDINGS[b.type].housing; })) || st; var kid = makeVillager(house.x + rnd(-6, 6), house.y + 5, null, st, true); S.pop.push(kid); S.stats.born++; rateAcc.born++; sysChat('👶 ' + par.name + '와(과) ' + (mate ? mate.name : '…') + '의 아이 ' + kid.name + '이(가) 태어났다 (인구 ' + S.pop.length + ')'); say(par, 'born', true); burst(kid, '#ffb0d0', 8); ui.dirty.pop = true; } } }
    // 노년
    S.pop.slice().forEach(function (v) { if (!v.child && v.age > FM.lifeSec * rnd(0.95, 1.1) && !v.held) { say(v, 'elder', true); sysChat('🌠 ' + v.name + '이(가) 별이 됐다 (' + Math.floor(v.age / 60) + '분을 살았다)'); addLog('🌠 <b>' + v.name + '</b> 별이 됨'); var mate = S.pop.find(function (o) { return o.id === v.partner; }); if (mate) mate.partner = null; S.pop = S.pop.filter(function (o) { return o !== v; }); S.stats.died++; burst(v, '#ffe9a8', 10); ui.dirty.pop = true; } });
    // 새 군락: 인구가 충분하고, 탐험한 빈 칸이 있고, 산적이 없을 때
    if (S.settles.length < FM.maxSettlements && S.pop.length >= FM.settleAt * S.settles.length && canAfford(FM.settleCost)) {
      var cells = []; for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++) { if (!isExplored(c, r)) continue; if (S.settles.some(function (o) { return o.c === c && o.r === r; })) continue; if (S.enemy && S.enemy.alive && S.enemy.c === c && S.enemy.r === r) continue; if (S.camps.some(function (k) { return k.c === c && k.r === r && !k.cleared; })) continue; var cc = cellCenter(c, r); cells.push({ c: c, r: r, d: dist(cc, home()) }); }
      if (cells.length) { cells.sort(function (a, b) { return a.d - b.d; }); var cell = cells[0], cc2 = cellCenter(cell.c, cell.r); Object.keys(FM.settleCost).forEach(function (k) { S.res[k] -= FM.settleCost[k]; });
        var st2 = { id: uid(), nm: D.SETTLE_NAMES[(S.settles.length - 1) % D.SETTLE_NAMES.length], x: Math.round(cc2.x + rnd(-10, 10)), y: Math.round(cc2.y + rnd(-10, 10)), c: cell.c, r: cell.r }; S.settles.push(st2);
        var group = adults().filter(function (v) { return v.settle === home().id && !v.held; }).sort(function (a, b) { return (b.partner ? 1 : 0) - (a.partner ? 1 : 0); }).slice(0, FM.settleGroup);
        group.forEach(function (v) { v.settle = st2.id; v.state = 'migrate'; v.tx = st2.x + rnd(-8, 8); v.ty = st2.y + rnd(-4, 8); v.node = null; v.bld = null; v.carry = null; });
        sysChat('🏕️ ' + group.length + '명이 떠나 새 군락 "' + st2.nm + '"을 세웠다!'); addLog('🏕️ 새 군락 <b>' + st2.nm + '</b>'); toast('🏕️ 새 군락 ' + st2.nm + '!'); burst(st2, '#ffe9a8', 20); ui.dirty.map = true; ui.dirty.head = true; }
    }
  }
  // ---- 전투: 산적·늑대·적 부족 ----
  function campsTick() {
    S.camps.forEach(function (k) { if (k.cleared || k.spawned || !isExplored(k.c, k.r)) return; k.spawned = true; for (var i = 0; i < k.units; i++) S.hostiles.push({ id: uid(), kind: 'bandit', camp: k.id, x: k.x + rnd(-8, 8), y: k.y + rnd(-4, 6), hp: D.UNITS.bandit.hp * (1 + S.era * 0.2), atk: D.UNITS.bandit.atk * (1 + S.era * 0.2), home: { x: k.x, y: k.y }, timer: 0, walk: 0, face: 1 }); });
    S.camps.forEach(function (k) { if (k.cleared || !k.spawned) return; if (!S.hostiles.some(function (h) { return h.camp === k.id && h.hp > 0; })) { k.cleared = true; S.stats.bandit++; Object.keys(k.loot).forEach(function (r) { if (r === 'faith') addFaith(k.loot[r]); else addRes(r, k.loot[r]); }); sysChat('🏴‍☠️ 산적 소굴을 소탕했다! 전리품 ' + Object.keys(k.loot).map(function (r) { return RES_IC[r] + k.loot[r]; }).join(' ')); addLog('🏴‍☠️ <b>산적 소굴</b> 소탕'); toast('🏴‍☠️ 산적 소굴 소탕! 전리품을 얻었다'); burst(k, '#ffd34f', 24); ui.dirty.map = true; checkAch(); } });
  }
  function raidActive() { return S.hostiles.some(function (h) { return h.kind === 'enemy' && h.raid; }); }
  function enemyTick(now) {
    var e = S.enemy; if (!e || !e.alive) { if (e && !e.alive && S.simT - e.diedAt > 600) respawnEnemy(); return; }
    e.growT += 2; if (e.growT >= EN.growEvery) { e.growT = 0; if (e.units < EN.growMax + S.era * 2) e.units++; }
    if (!e.met && S.simT < EN.firstRaid) return;
    var since = S.simT - Math.max(e.lastRaid, e.metAt || 0);
    if (since >= EN.raidEvery && !raidActive() && !S.invading && e.units >= 2 && S.pop.length >= 6) {
      var fighters = S.pop.filter(fighter).length;
      e.lastRaid = S.simT; e.raids++; var n = Math.max(1, Math.min(e.units, EN.raidSize + Math.floor(e.raids / 2), fighters + 2)); e.units -= n;
      var target = pick(S.settles); for (var i = 0; i < n; i++) S.hostiles.push({ id: uid(), kind: 'enemy', raid: true, x: e.x + rnd(-6, 6), y: e.y + rnd(-6, 6), hp: EN.unitHp * (1 + S.era * 0.25), atk: EN.unitAtk * (1 + S.era * 0.25), target: { x: target.x, y: target.y }, until: S.simT + EN.raidTime, timer: 0, walk: 0, face: 1, pillage: 0 });
      sysChat('⚔️ ' + EN.nm + ' ' + n + '명이 "' + target.nm + '"을 향해 쳐들어온다! (' + EN.raidTime + '초 뒤 물러감)'); addLog('⚔️ <b>' + EN.nm + '</b> 침략 (' + n + '명)'); toast('⚔️ 적이 쳐들어온다! 🚩 집결·⚡ 번개로 막으세요'); S.pop.forEach(function (v) { if (Math.random() < 0.3) say(v, 'raid', true); }); S.rally = { x: target.x, y: target.y + 6, until: now + 60000, all: true }; panTo(target); ui.dirty.head = true;
    }
  }
  function respawnEnemy() { var corners = [{ c: 0, r: 0 }, { c: W.cols - 1, r: 0 }, { c: 0, r: W.rows - 1 }].filter(function (k) { return !S.settles.some(function (s) { return s.c === k.c && s.r === k.r; }); }); if (!corners.length) return; var k = pick(corners), cc = cellCenter(k.c, k.r); S.enemy = { c: k.c, r: k.r, x: Math.round(cc.x), y: Math.round(cc.y), units: EN.units + 4 + S.era * 2, met: isExplored(k.c, k.r), metAt: S.simT, lastRaid: S.simT, growT: 0, alive: true, raids: 0 }; sysChat('👁️ 새로운 부족이 먼 땅에 자리 잡았다…'); ui.dirty.map = true; }
  function stepHostiles(dt, now) {
    for (var i = S.hostiles.length - 1; i >= 0; i--) {
      var h = S.hostiles[i]; h.anim = Math.max(0, (h.anim || 0) - dt);
      if (h.hp <= 0) { S.hostiles.splice(i, 1); burst(h, '#e06a5a', 8); if (h.kind === 'enemy') { if (h.raid && !S.hostiles.some(function (o) { return o.raid; })) { S.stats.defend++; addFaith(15); sysChat('🛡️ 침략을 막아냈다! 믿음 +15'); addLog('🛡️ 침략 격퇴'); S.wishes.slice().forEach(function (w) { if (w.type === 'enemy') fulfill(w, S.pop.find(function (x) { return x.id === w.vid; })); }); checkAch(); } } continue; }
      var tgt = null, bd = h.kind === 'bandit' ? 40 : 60; S.pop.forEach(function (v) { if (v.held) return; var d = dist(h, v); if (d < bd) { bd = d; tgt = v; } });
      if (h.kind === 'bandit') { if (tgt && dist(h, h.home) < 70) { if (dist(h, tgt) > 6) moveToward(h, tgt.x, tgt.y, 14, dt); else attackV(h, tgt, dt); } else if (dist(h, h.home) > 4) moveToward(h, h.home.x, h.home.y, 10, dt); continue; }
      if (h.kind === 'enemy' && h.raid) {
        if (S.simT > h.until) { S.hostiles.splice(i, 1); if (S.enemy && S.enemy.alive) S.enemy.units++; continue; }
        if (tgt) { if (dist(h, tgt) > 6) moveToward(h, tgt.x, tgt.y, 13, dt); else attackV(h, tgt, dt); continue; }
        if (dist(h, h.target) > 8) { moveToward(h, h.target.x, h.target.y, 13, dt); continue; }
        h.pillage += dt; if (h.pillage > 3) { h.pillage = 0; var stolen = {}; ['food', 'wood', 'stone', 'metal'].forEach(function (k) { var n = Math.floor(S.res[k] * EN.lootPct / 3); if (n > 0) { S.res[k] -= n; stolen[k] = n; } }); var b = pick(S.blds.filter(function (o) { return o.done && dist(o, h) < 40 && o.type !== 'totem'; })); if (b && Math.random() < 0.5) { b.done = false; b.progress = D.BUILDINGS[b.type].work * 0.5; sysChat('🔥 ' + D.BUILDINGS[b.type].nm + '이(가) 불탔다!'); ui.dirty.bld = true; } F.fx.push({ kind: 'num', x: h.x, y: h.y - 10, txt: '약탈!', color: '#ff7a70', size: 6, t: 0, life: 0.9 }); if (Math.random() < 0.3) sysChat('💢 적이 약탈 중: ' + Object.keys(stolen).map(function (k) { return RES_IC[k] + stolen[k]; }).join(' ')); }
        continue;
      }
      if (h.kind === 'enemy' && h.defend) { if (tgt) { if (dist(h, tgt) > 6) moveToward(h, tgt.x, tgt.y, 13, dt); else attackV(h, tgt, dt); } else if (dist(h, S.enemy || h) > 6 && S.enemy) moveToward(h, S.enemy.x, S.enemy.y, 10, dt); continue; }
    }
    for (var k = S.wolves.length - 1; k >= 0; k--) { var w = S.wolves[k]; w.anim = Math.max(0, (w.anim || 0) - dt); if (w.hp <= 0 || now > w.until) { if (w.hp <= 0) { S.stats.wolves++; addFaith(2); sysChat('🐺 늑대를 물리쳤다! 믿음 +2'); } else sysChat('🐺 늑대가 숲으로 돌아갔다'); S.wolves.splice(k, 1); continue; } var t2 = null, b2 = 1e9; S.pop.forEach(function (v) { if (v.held) return; var d = dist(w, v); if (d < b2) { b2 = d; t2 = v; } }); if (t2 && b2 > 6) moveToward(w, t2.x, t2.y, 9, dt); else if (t2) attackV(w, t2, dt); }
    // 침략(우리가 적 마을로): 전사들이 적 기지 근처에 있고 적이 없으면 정복
    if (S.invading && S.enemy && S.enemy.alive) { var near = S.pop.filter(function (v) { return v.job === 'warrior' && dist(v, S.enemy) < 30; }).length; if (near > 0 && !S.hostiles.some(function (o) { return o.defend; })) { if (!S.enemy.defSpawned) { S.enemy.defSpawned = true; var n = Math.min(S.enemy.units, 10); for (var q = 0; q < n; q++) S.hostiles.push({ id: uid(), kind: 'enemy', defend: true, x: S.enemy.x + rnd(-10, 10), y: S.enemy.y + rnd(-6, 8), hp: EN.unitHp * (1 + S.era * 0.25) * 1.2, atk: EN.unitAtk * (1 + S.era * 0.25), timer: 0, walk: 0, face: 1 }); sysChat('⚔️ ' + EN.nm + '의 전사 ' + n + '명이 마을을 지키러 나왔다!'); } else conquer(); } if (S.simT > S.invading) { S.invading = 0; S.rally = null; } }
  }
  function attackV(h, v, dt) {
    h.timer = (h.timer || 0) - dt; if (h.timer > 0) return; h.timer = 1.2; h.anim = 0.3;
    var dmg = Math.round((h.atk || 3) * rnd(0.8, 1.2)); v.hp -= dmg; F.fx.push({ kind: 'num', x: v.x, y: v.y - 14, txt: '-' + dmg, color: '#ff7a70', size: 5, t: 0, life: 0.6 });
    if (v.state !== 'fight' && !fighter(v)) v.state = 'flee';
    if (v.hp > 0) return;
    var by = h.kind === 'wolf' ? '늑대' : h.kind === 'bandit' ? '산적' : EN.nm;
    if (fighter(v)) { dieV(v, by); return; }
    // 일반 시민·아이는 죽지 않고 쓰러진다: 집으로 옮겨져 30초 쉬고 일어난다
    v.hp = 1; v.down = S.simT + 30; var st = settleOf(v); v.x = st.x + rnd(-8, 8); v.y = st.y + rnd(2, 10); v.state = 'wander'; v.tx = v.x; v.ty = v.y; v.timer = 30; v.carry = null;
    S.happy = Math.max(0, S.happy - 2); sysChat('💫 ' + v.name + '이(가) ' + by + '에게 쓰러져 집으로 옮겨졌다'); v.bubble = { txt: '으으… 아파', until: Date.now() + 2500 };
  }
  function dieV(v, by) { S.pop = S.pop.filter(function (o) { return o !== v; }); var mate = S.pop.find(function (o) { return o.id === v.partner; }); if (mate) mate.partner = null; S.stats.died++; S.happy = Math.max(0, S.happy - 4); sysChat('💀 ' + v.name + '이(가) ' + by + '에게 쓰러졌다…'); addLog('💀 <b>' + v.name + '</b> 전사 (' + by + ')'); burst(v, '#e06a5a', 10); S.wishes = S.wishes.filter(function (w) { return w.vid !== v.id; }); ui.dirty.pop = true; ui.dirty.wish = true; }
  function hit(v, t, atk) { var dmg = Math.round(atk * rnd(0.8, 1.2)); t.hp -= dmg; t.anim = 0.3; F.fx.push({ kind: 'num', x: t.x, y: t.y - 10, txt: String(dmg), color: '#fff', size: 6, t: 0, life: 0.6 }); for (var i = 0; i < 3; i++) F.fx.push({ kind: 'spark', x: t.x, y: t.y - 4, vx: rnd(-20, 20), vy: rnd(-30, -5), color: '#ffd34f', t: 0, life: 0.4 }); }
  function conquer() {
    var e = S.enemy; e.alive = false; e.diedAt = S.simT; S.invading = 0; S.rally = null; S.stats.conquer++; addFaith(EN.conquerFaith); ['food', 'wood', 'stone', 'metal'].forEach(function (k) { addRes(k, 80 + S.era * 40); });
    if (S.settles.length < FM.maxSettlements + 1) { var st = { id: uid(), nm: '정복지 ' + (S.stats.conquer), x: e.x, y: e.y + 6, c: e.c, r: e.r }; S.settles.push(st); S.pop.filter(function (v) { return v.job === 'warrior' && dist(v, e) < 40; }).slice(0, 3).forEach(function (v) { v.settle = st.id; }); }
    sysChat('👑 ' + EN.nm + '의 마을을 정복했다! 믿음 +' + EN.conquerFaith + ', 그 땅은 우리 군락이 됐다'); addLog('👑 <b>' + EN.nm + '</b> 정복'); toast('👑 정복! 적 마을이 우리 땅이 됐다'); burst(e, '#ffd34f', 40); ui.dirty.map = true; checkAch();
  }
  function spawnWolf() { var st = pick(S.settles), ang = rnd(0, 6.28), x = clamp(st.x + Math.cos(ang) * 70, 2, WW - 2), y = clamp(st.y + Math.sin(ang) * 60, 2, WH - 2); S.wolves.push({ id: uid(), kind: 'wolf', x: x, y: y, hp: C.wolfHp * (1 + S.era * 0.3), atk: 3 + S.era, until: Date.now() + 50000, walk: 0, face: 1, timer: 0 }); sysChat('🐺 늑대가 ' + st.nm + ' 근처에 나타났다! ⚡ 번개로 쫓거나 사냥꾼·전사가 맞선다'); }
  // ---- 소원·업적·과제 ----
  function makeWish() {
    if (S.wishes.length >= 3 || !S.pop.length) return;
    var pop = S.pop.length, next = nextBuilding(home()), cost = next ? D.BUILDINGS[next].cost : {};
    var cond = { foodLow: S.res.food < pop * 4, woodLow: (cost.wood || 0) > S.res.wood, stoneLow: (cost.stone || 0) > S.res.stone, research: !!currentTech() && S.res.know < currentTech().cost * 0.7, farm: bldsOf('food', true).length > 0, wolf: S.wolves.length > 0, totem: !!totem(), homeless: housing() < pop, bandit: S.hostiles.some(function (h) { return h.kind === 'bandit'; }), single: adults().filter(function (v) { return !v.partner; }).length >= 2, raid: raidActive() };
    var options = D.WISHES.filter(function (w) { return cond[w.when] && !S.wishes.some(function (x) { return x.type === w.id; }); }); if (!options.length) return;
    var w = pick(options), free = S.pop.filter(function (v) { return !v.child && !S.wishes.some(function (x) { return x.vid === v.id; }) && (w.id !== 'love' || !v.partner); }); if (!free.length) return;
    var v = pick(free); S.wishes.push({ id: uid(), type: w.id, vid: v.id, until: Date.now() + C.wishTime * 1000 });
    v.bubble = { txt: w.ic + ' ' + w.txt, until: Date.now() + 4000 }; sysChat('❗ ' + v.name + ': "' + w.txt + '"'); renderWishes();
  }
  function checkWishes(now) {
    for (var i = S.wishes.length - 1; i >= 0; i--) {
      var w = S.wishes[i], def = D.WISHES.find(function (x) { return x.id === w.type; }), v = S.pop.find(function (x) { return x.id === w.vid; }), ok = false;
      if (!v) { S.wishes.splice(i, 1); continue; }
      if (def.done === 'wolfDead') ok = S.wolves.length === 0; else if (def.done === 'housing') ok = housing() >= S.pop.length; else if (def.done === 'nearTotem') { var t = totem(settleOf(v)) || totem(); ok = t && now - v.droppedAt < 6000 && dist(v, t) < 14; } else if (def.done === 'banditDead') ok = !S.hostiles.some(function (h) { return h.kind === 'bandit' && dist(h, v) < 160; }); else if (def.done === 'married') ok = !!v.partner; else if (def.done === 'raidOver') ok = !raidActive();
      if (ok) fulfill(w, v); else if (now > w.until) { S.wishes.splice(i, 1); S.happy = Math.max(0, S.happy - 2); sysChat('😢 ' + v.name + '의 소원이 사라졌다'); ui.dirty.wish = true; }
    }
  }
  function fulfill(w, v) { S.wishes = S.wishes.filter(function (x) { return x !== w; }); var amt = Math.round(C.wishFaith * mul('faith')); addFaith(amt); S.happy = Math.min(100, S.happy + 3); S.stats.wishes++; S.daily.wish++; if (v) { v.bubble = { txt: '🙏 감사합니다!', until: Date.now() + 2500 }; sysChat('💝 ' + v.name + '의 소원을 들어줬다! 믿음 +' + amt); burst(v, '#ffe9a8', 10); } renderWishes(); }
  function powerFulfills(id) { S.wishes.slice().forEach(function (w) { var def = D.WISHES.find(function (x) { return x.id === w.type; }); if (def.done === 'power:' + id) fulfill(w, S.pop.find(function (x) { return x.id === w.vid; })); }); }
  function checkAch() { var val = { pop: S.pop.length, era: S.era, tech: S.techs.length, faith: S.faithTotal, wish: S.stats.wishes, move: S.stats.moves, world: S.world, marry: S.stats.marry, settle: S.settles.length, explored: exploredCount(), bandit: S.stats.bandit, defend: S.stats.defend, conquer: S.stats.conquer }; D.ACHIEVEMENTS.forEach(function (a) { if (S.ach.indexOf(a.id) >= 0) return; if ((val[a.type] || 0) >= a.n) { S.ach.push(a.id); addFaith(a.faith); toast('🏆 업적: ' + a.nm + (a.faith ? ' (믿음 +' + a.faith + ')' : '')); addLog('🏆 업적 <b>' + a.nm + '</b>'); sysChat('🏆 업적 달성: ' + a.ic + ' ' + a.nm); ui.dirty.ach = true; } }); }
  function checkDaily() { var d = S.daily; if (d.date !== today()) S.daily = d = { date: today(), wish: 0, gift: 0, move: 0, claimed: false }; if (!d.claimed && D.DAILY.every(function (t) { return d[t.id] >= t.n; })) { d.claimed = true; addFaith(D.DAILY_FAITH); toast('✅ 오늘의 과제 완료! 믿음 +' + D.DAILY_FAITH); sysChat('✅ 오늘의 과제 완료! 믿음 +' + D.DAILY_FAITH); } ui.dirty.ach = true; }
  function burst(p, color, n) { for (var i = 0; i < n; i++) F.fx.push({ kind: 'spark', x: p.x, y: p.y, vx: rnd(-30, 30), vy: rnd(-50, -5), color: color, t: 0, life: rnd(0.4, 0.9) }); }

  // ---------- 신의 힘 ----------
  function usePower(id, x, y) {
    var pw = D.POWERS.find(function (p) { return p.id === id; }); if (!pw) return;
    if (S.faith < pw.cost) return toast('✨ 믿음이 모자라요 (' + pw.cost + ' 필요). 시민들이 기도하면 쌓입니다');
    var p = { x: clamp(x, 4, WW - 4), y: clamp(y, 4, WH - 4) };
    S.faith -= pw.cost; S.stats.gifts++; S.daily.gift++;
    if (id === 'food' || id === 'wood' || id === 'stone') { S.gifts.push({ id: uid(), res: id, n: Math.round(pw.amount * (1 + S.era * 0.5)), x: p.x, y: p.y, taken: false }); burst(p, RES_COL[id], 12); sysChat(pw.ic + ' 하늘에서 ' + pw.nm + '이(가) 떨어졌다!'); }
    else if (id === 'idea') { var n = Math.round(pw.amount * (1 + S.era * 0.8)); S.res.know += n; burst(p, '#6fb3ff', 16); F.fx.push({ kind: 'num', x: p.x, y: p.y - 10, txt: '+' + n + '📜', color: RES_COL.know, size: 7, t: 0, life: 1.2 }); sysChat('💡 영감이 내렸다! 지식 +' + n); }
    else if (id === 'rain') { F.rain = 4; S.rainUntil = Date.now() + pw.amount * 1000; S.happy = Math.min(100, S.happy + 5); sysChat('🌧️ 단비가 내린다. 밭이 자라고 모두 기뻐한다'); S.pop.forEach(function (v) { if (Math.random() < 0.3) v.bubble = { txt: '비다!', until: Date.now() + 2000 }; }); }
    else if (id === 'smite') { F.flash = 0.25; F.shake = 2; var h = nearestHostile(p, 12); if (h) { h.hp -= 30; F.fx.push({ kind: 'num', x: h.x, y: h.y - 10, txt: '⚡30', color: '#ffe9a8', size: 7, t: 0, life: 0.8 }); S.stats.smites++; } else { var v = null, bd = 8; S.pop.forEach(function (o) { var d = dist(o, p); if (d < bd) { bd = d; v = o; } }); if (v) { S.happy = Math.max(0, S.happy - 3); v.state = 'wander'; v.tx = v.x + rnd(-20, 20); v.ty = v.y + rnd(-10, 10); v.timer = 2; say(v, 'scold', true); sysChat('⚡ ' + v.name + '을(를) 혼냈다 (행복 -3)'); } else sysChat('⚡ 번개가 들판에 떨어졌다'); } burst(p, '#fff6c0', 18); }
    else if (id === 'rally') { S.rally = { x: p.x, y: p.y, until: Date.now() + 60000, all: true }; sysChat('🚩 집결 깃발을 꽂았다. 전사와 사냥꾼이 모인다'); burst(p, '#e04040', 10); }
    else if (id === 'fire') { F.flash = 0.3; F.shake = 3; var k = 0; S.hostiles.concat(S.wolves).forEach(function (h) { if (dist(h, p) < 26) { h.hp -= 40; k++; F.fx.push({ kind: 'num', x: h.x, y: h.y - 10, txt: '🔥40', color: '#ff9a3c', size: 7, t: 0, life: 0.8 }); } }); for (var i = 0; i < 30; i++) F.fx.push({ kind: 'spark', x: p.x + rnd(-22, 22), y: p.y + rnd(-14, 14), vx: rnd(-10, 10), vy: rnd(-40, -10), color: pick(['#ff7a2a', '#ffd040', '#ff3030']), t: 0, life: rnd(0.5, 1) }); sysChat('🔥 불벼락이 떨어졌다! ' + (k ? k + '명에게 피해' : '맞은 게 없다')); }
    else if (id === 'heal') { var m = 0; S.pop.forEach(function (v) { if (dist(v, p) < 30) { v.hp = unitStat(v).hp; m++; F.fx.push({ kind: 'heart', x: v.x, y: v.y - 14, t: 0, life: 1 }); } }); sysChat('💗 치유의 빛 — ' + m + '명의 상처가 나았다'); }
    powerFulfills(id); renderHead(); save();
  }
  function useOracle(id) {
    var o = D.ORACLES.find(function (x) { return x.id === id; }); if (!o) return;
    if (o.era !== undefined && S.era < o.era) return toast('아직 이 기적을 쓸 수 없어요 (' + D.ERAS[o.era].nm + '부터)');
    if (o.miracle === 'invade' && (!S.enemy || !S.enemy.alive || !S.enemy.met)) return toast('먼저 적 부족의 마을을 찾아야 해요 (탐험가가 안개를 걷습니다)');
    if (S.faith < o.cost) return toast('✨ 믿음이 모자라요 (' + o.cost + ' 필요)');
    S.faith -= o.cost;
    if (o.miracle === 'harvest') { S.miracle = { id: 'harvest', until: Date.now() + 60000 }; sysChat('🌟 풍년의 기적! 60초 동안 식량 3배'); burst(home(), '#ffd34f', 30); }
    else if (o.miracle === 'insight') { var t = currentTech(); if (t) { S.res.know = Math.max(S.res.know, t.cost); checkTech(); } sysChat('✨ 계시의 기적!'); }
    else if (o.miracle === 'invade') { var w = S.pop.filter(function (v) { return v.job === 'warrior'; }).length; if (!w) { S.faith += o.cost; return toast('전사가 없어요. 창과 방패를 발견하고 신탁 "무기를 들어라"로 전사를 늘리세요'); } S.invading = S.simT + 240; S.enemy.defSpawned = false; S.rally = { x: S.enemy.x, y: S.enemy.y + 8, until: Date.now() + 240000 }; sysChat('🔥 출정! 전사 ' + w + '명이 ' + EN.nm + '의 마을로 진군한다'); addLog('🔥 <b>출정</b> (전사 ' + w + '명)'); panTo(S.enemy); }
    else { S.oracle = { id: id, weight: o.weight, until: Date.now() + C.oracleTime * 1000 }; sysChat('📣 신탁: "' + o.nm + '" (' + C.oracleTime + '초)'); S.pop.forEach(function (v) { if (Math.random() < 0.4) say(v, 'oracle', true); }); rebalanceJobs(); }
    renderHead(); save();
  }
  function dropVillager(v, x, y) {
    v.held = false; v.x = clamp(x, 4, WW - 4); v.y = clamp(y, 4, WH - 4); v.state = 'idle'; v.node = null; v.bld = null; v.droppedAt = Date.now(); S.stats.moves++; S.daily.move++;
    burst(v, '#c0b090', 8); say(v, 'drop', true);
    var near = null, bd = 16; S.nodes.forEach(function (n) { var d = dist(n, v); if (d < bd) { bd = d; near = { node: n }; } }); S.blds.forEach(function (b) { var d = dist(b, v); if (d < bd) { bd = d; near = { bld: b }; } });
    var job = null;
    if (near && near.node) job = { bush: 'gather', tree: 'lumber', rock: 'miner', ore: 'smith', deer: 'hunter', boar: 'hunter' }[near.node.type];
    else if (near && near.bld) { var r = D.BUILDINGS[near.bld.type].role; job = !near.bld.done ? 'builder' : r === 'faith' ? 'priest' : r === 'research' ? 'scholar' : r === 'food' ? 'farmer' : r === 'metal' ? 'smith' : null; }
    var cc = cellOf(v); if (!job && !isExplored(cc.c, cc.r)) job = 'scout';
    if (!job && nearestHostile(v, 30) && hasTech('weapons')) job = 'warrior';
    if (job && !v.child && jobOk(job)) { v.job = job; v.nudge = Date.now() + 90000; v.hp = Math.min(unitStat(v).hp, Math.max(v.hp, unitStat(v).hp * 0.6)); v.bubble = { txt: D.JOBS[job].ic + ' ' + D.JOBS[job].nm + ' 할게요!', until: Date.now() + 2500 }; }
    // 다른 군락 근처에 내려놓으면 거기로 이사
    var st = null, sd = 50; S.settles.forEach(function (o) { var d = dist(o, v); if (d < sd) { sd = d; st = o; } }); if (st && st.id !== v.settle) { v.settle = st.id; sysChat('🏕️ ' + v.name + '이(가) ' + st.nm + '(으)로 이사했다'); }
    ui.dirty.pop = true; ui.dirty.ach = true;
  }
  function newWorld() {
    if (!S.launched) return; var w = S.world + 1, keep = { faithTotal: S.faithTotal, ach: S.ach, stats: S.stats };
    S = fresh(); S.world = w; S.faithTotal = keep.faithTotal; S.ach = keep.ach; S.stats = keep.stats; S.faith = C.startFaith + w * 10; genWorld(S); var h = home();
    ['gather', 'lumber', 'miner'].forEach(function (j) { S.pop.push(makeVillager(h.x + rnd(-10, 10), h.y + rnd(-4, 8), j, h)); }); S.pop.forEach(function (v) { v.hp = unitStat(v).hp; });
    sysChat('🌍 세계 ' + w + ' — 모든 생산 +' + ((w - 1) * 10) + '%. 다시, 세 사람이 들판에 섰다.'); addLog('🌍 새 세계 ' + w); F.mapKey = ''; panTo(h); save(); renderAll();
  }
  var rateAcc = { food: 0, wood: 0, stone: 0, metal: 0, know: 0, faith: 0, born: 0, t: 0 };
  function trackRate(dt) { rateAcc.t += dt; if (rateAcc.t >= 60) { Object.keys(S.rate).forEach(function (k) { S.rate[k] = S.rate[k] * 0.5 + rateAcc[k] * 0.5; rateAcc[k] = 0; }); rateAcc.t = 0; } }
  function offlineCatchUp() {
    var now = Date.now(), el = now - S.lastTick; if (el < 120000) return;
    var mins = Math.min(el / 60000, S.cfg.offHours * 60), pct = S.cfg.offPct / 100, r = S.rate, got = [];
    ['food', 'wood', 'stone', 'metal'].forEach(function (k) { var n = Math.floor(r[k] * mins * pct); if (n > 0) { addRes(k, n); got.push(RES_IC[k] + fmt(n)); } });
    var kn = Math.floor(r.know * mins * pct); if (kn > 0) { S.res.know += kn; got.push('📜' + fmt(kn)); for (var i = 0; i < 10; i++) checkTech(); checkEra(); }
    var fa = Math.floor(r.faith * mins * pct); if (fa > 0) { addFaith(fa); got.push('✨' + fmt(fa)); }
    var born = Math.min(Math.floor(r.born * mins * pct), Math.max(0, housing() - S.pop.length)); for (var j = 0; j < born; j++) { var h = home(); S.pop.push(makeVillager(h.x + rnd(-12, 12), h.y + rnd(-8, 8), 'gather', h)); } if (born) got.push('👶' + born);
    S.simT += mins * 60 * pct; S.pop.forEach(function (v) { v.age += mins * 60 * pct; });
    var hrs = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    $('#welcomeText').textContent = (hrs ? hrs + '시간 ' : '') + mm + '분 동안 (오프라인 보상 ' + S.cfg.offPct + '%' + (el / 60000 > S.cfg.offHours * 60 ? ', 최대 ' + S.cfg.offHours + '시간' : '') + ')\n' + (got.length ? '시민들이 모은 것: ' + got.join(' · ') : '시민들은 조용히 지냈습니다') + '\n\n💡 절전 모드로 켜 두면 100%를 받습니다.';
    $('#welcome').hidden = false;
  }

  // ---------- 픽셀 그리기 (카메라) ----------
  function P(ctx, x, y, c, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function mix(a, b, k) { var pa = hex(a), pb = hex(b); return 'rgb(' + Math.round(pa[0] + (pb[0] - pa[0]) * k) + ',' + Math.round(pa[1] + (pb[1] - pa[1]) * k) + ',' + Math.round(pa[2] + (pb[2] - pa[2]) * k) + ')'; }
  function hex(h) { if (h[0] !== '#') return [120, 120, 120]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function resizeCanvas() {
    document.documentElement.style.setProperty('--navh', $('.nav').offsetHeight + 'px');
    var cv = $('#field'), cssW = cv.parentNode.getBoundingClientRect().width || 360;
    F.pix = Math.max(2, Math.floor(cssW / 190)); F.vw = Math.ceil(cssW / F.pix);
    var avail = window.innerHeight - $('.nav').offsetHeight - $('.powers').offsetHeight - 110;
    F.vh = clamp(Math.floor(avail / F.pix), 200, 360);
    cv.width = F.vw; cv.height = F.vh; cv.style.width = F.vw * F.pix + 'px'; cv.style.height = F.vh * F.pix + 'px';
    F.ctx = cv.getContext('2d'); F.ctx.imageSmoothingEnabled = false; F.mapKey = ''; clampCam();
  }
  function clampCam() { cam.x = clamp(cam.x, 0, Math.max(0, WW - F.vw)); cam.y = clamp(cam.y, 0, Math.max(0, WH - F.vh)); }
  function panTo(p) { cam.x = p.x - F.vw / 2; cam.y = p.y - F.vh / 2; clampCam(); }
  function buildMap() {
    var e = era(), r = seeded(S.world * 5 + S.era), cv = document.createElement('canvas'); cv.width = WW; cv.height = WH; var c = cv.getContext('2d'), i, x, y;
    P(c, 0, 0, '#2f4a2a', WW, WH);
    for (i = 0; i < 3000; i++) { x = Math.floor(r() * WW); y = Math.floor(r() * WH); P(c, x, y, r() < 0.5 ? '#3a5a33' : '#25391f', 1 + Math.floor(r() * 3), 1); }
    // 우리 군락 땅 색은 시대 색, 광장
    S.settles.forEach(function (st) { var g = e.ground; for (y = st.y - 60; y < st.y + 60; y++) for (x = st.x - 70; x < st.x + 70; x++) { if (x < 0 || y < 0 || x >= WW || y >= WH) continue; var d = dist({ x: x, y: y }, st); if (d < 60 && r() < 0.6) P(c, x, y, r() < 0.7 ? g : mix(g, '#ffffff', 0.12), 1, 1); }
      if (S.era >= 3) { for (y = st.y - 40; y < st.y + 40; y++) for (x = st.x - 50; x < st.x + 50; x++) { if ((Math.abs(x - st.x) < 3) || (Math.abs(y - st.y) < 3) || (dist({ x: x, y: y }, st) < 10)) P(c, x, y, ((x * 7 + y * 3) % 5 === 0) ? '#6a6050' : ((x + y) % 2 ? '#8a8070' : '#7a7060'), 1, 1); } }
      else for (y = st.y - 7; y < st.y + 7; y++) for (x = st.x - 11; x < st.x + 11; x++) if (r() < 0.5) P(c, x, y, '#5a4a32', 1, 1); });
    // 적 부족 땅
    if (S.enemy) { var en = S.enemy; for (y = en.y - 40; y < en.y + 40; y++) for (x = en.x - 50; x < en.x + 50; x++) { if (x < 0 || y < 0 || x >= WW || y >= WH) continue; if (dist({ x: x, y: y }, en) < 40 && r() < 0.5) P(c, x, y, en.alive ? '#4a3a30' : '#3a4a30', 1, 1); } }
    // 강 (왼쪽 아래에서 오른쪽 위로 굽이치는 물길, 칸 경계는 피해서)
    var rx = 20; for (y = WH - 1; y >= 0; y--) { rx += (r() - 0.5) * 2 + 0.25; rx = clamp(rx, 10, WW - 10); var skip = S.settles.some(function (st) { return Math.abs(y - st.y) < 50 && Math.abs(rx - st.x) < 60; }) || (S.enemy && Math.abs(y - S.enemy.y) < 40 && Math.abs(rx - S.enemy.x) < 50); if (skip) continue; P(c, rx - 3, y, '#3a6a9a', 7, 1); if (r() < 0.3) P(c, rx - 2 + Math.floor(r() * 5), y, '#5a8ac0', 1, 1); }
    for (i = 0; i < 120; i++) P(c, Math.floor(r() * WW), Math.floor(r() * WH), r() < 0.5 ? '#ffd0e0' : '#fff6c0', 1, 1);
    F.map = cv; F.mapKey = 'e' + S.era + 'w' + S.world + 's' + S.settles.length + (S.enemy ? (S.enemy.alive ? 'a' : 'd') + S.enemy.x : '');
  }
  function daylight() { var t = (F.time % C.dayLength) / C.dayLength; return 0.5 + 0.5 * Math.cos(t * Math.PI * 2); }
  function inView(p, m) { return p.x > cam.x - m && p.x < cam.x + F.vw + m && p.y > cam.y - m && p.y < cam.y + F.vh + m; }
  function draw() {
    var ctx = F.ctx; if (!ctx || ui.sleep) return;
    if (F.mapKey !== 'e' + S.era + 'w' + S.world + 's' + S.settles.length + (S.enemy ? (S.enemy.alive ? 'a' : 'd') + S.enemy.x : '')) buildMap();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var sx = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0, sy = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0;
    ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);
    ctx.drawImage(F.map, 0, 0);
    var ents = [];
    S.nodes.forEach(function (n) { if (inView(n, 20) && isExplored(cellOf(n).c, cellOf(n).r)) ents.push({ y: n.y, n: n }); });
    S.blds.forEach(function (b) { if (inView(b, 30)) ents.push({ y: b.y, b: b }); });
    S.camps.forEach(function (k) { if (inView(k, 30) && isExplored(k.c, k.r)) ents.push({ y: k.y, k: k }); });
    S.pickups.forEach(function (k) { if (!k.taken && inView(k, 20) && isExplored(k.c, k.r)) ents.push({ y: k.y, pk: k }); });
    if (S.enemy && inView(S.enemy, 40) && isExplored(S.enemy.c, S.enemy.r)) ents.push({ y: S.enemy.y, en: S.enemy });
    S.gifts.forEach(function (g) { ents.push({ y: g.y, g: g }); });
    S.pop.forEach(function (v) { if (!v.held && inView(v, 20)) ents.push({ y: v.y, v: v }); });
    S.wolves.forEach(function (w) { if (inView(w, 20)) ents.push({ y: w.y, w: w }); });
    S.hostiles.forEach(function (h) { if (inView(h, 20)) ents.push({ y: h.y, h: h }); });
    if (S.rally) ents.push({ y: S.rally.y, rally: S.rally });
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { if (e.n) drawNode(ctx, e.n); else if (e.b) drawBuilding(ctx, e.b); else if (e.k) drawCamp(ctx, e.k); else if (e.pk) drawPickup(ctx, e.pk); else if (e.en) drawEnemyBase(ctx, e.en); else if (e.g) drawGift(ctx, e.g); else if (e.v) drawVillager(ctx, e.v, Math.round(e.v.x), Math.round(e.v.y)); else if (e.w) drawWolf(ctx, e.w); else if (e.h) drawHostile(ctx, e.h); else if (e.rally) drawRally(ctx, e.rally); });
    // 안개
    for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++) { if (isExplored(c, r)) continue; var x0 = c * W.cellW, y0 = r * W.cellH; if (x0 > cam.x + F.vw || x0 + W.cellW < cam.x || y0 > cam.y + F.vh || y0 + W.cellH < cam.y) continue; ctx.fillStyle = 'rgba(8,12,20,.86)'; ctx.fillRect(x0, y0, W.cellW, W.cellH); ctx.fillStyle = '#1a2230'; for (var i = 0; i < 40; i++) ctx.fillRect(x0 + (i * 37) % W.cellW, y0 + (i * 53) % W.cellH, 2, 1); }
    var night = 1 - daylight(); if (S.era >= 5) night *= 0.5;
    ctx.fillStyle = 'rgba(10,16,50,' + (0.06 + night * 0.26).toFixed(2) + ')'; ctx.fillRect(cam.x - 2, cam.y - 2, F.vw + 4, F.vh + 4);
    if (night > 0.3) S.blds.forEach(function (b) { if (!b.done || !inView(b, 30)) return; var d = D.BUILDINGS[b.type]; if (d.style === 'campfire' || d.style === 'forge' || d.housing || d.research) { ctx.globalAlpha = (night - 0.3) * 0.35; ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.arc(b.x, b.y - 4, bw(b.type) * 0.7, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } });
    S.pop.forEach(function (v) { if (!v.held) return; ctx.globalAlpha = 0.35; P(ctx, v.x - 4, v.y, '#000', 8, 2); ctx.globalAlpha = 1; drawVillager(ctx, v, Math.round(v.x), Math.round(v.y) - 14); });
    F.fx.forEach(function (f) { var a = 1 - f.t / f.life; if (f.kind === 'spark') { ctx.globalAlpha = a; P(ctx, f.x, f.y, f.color, 1, 1); } else if (f.kind === 'heart') { ctx.globalAlpha = a; P(ctx, f.x - 1, f.y - 1, '#ff6a9a', 1, 1); P(ctx, f.x + 1, f.y - 1, '#ff6a9a', 1, 1); P(ctx, f.x - 2, f.y, '#ff6a9a', 5, 1); P(ctx, f.x - 1, f.y + 1, '#ff6a9a', 3, 1); P(ctx, f.x, f.y + 2, '#ff6a9a', 1, 1); } else { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.font = 'bold ' + f.size + 'px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; var tx = Math.round(f.x), ty = Math.round(f.y); ctx.fillText(f.txt, tx - 1, ty); ctx.fillText(f.txt, tx + 1, ty); ctx.fillText(f.txt, tx, ty - 1); ctx.fillText(f.txt, tx, ty + 1); ctx.fillStyle = f.color; ctx.fillText(f.txt, tx, ty); } ctx.globalAlpha = 1; });
    if (F.rain > 0) { ctx.globalAlpha = 0.5; for (var j = 0; j < 80; j++) P(ctx, cam.x + (j * 37 + Math.floor(F.time * 90)) % F.vw, cam.y + ((j * 53 + Math.floor(F.time * 160)) % F.vh), '#9ad0ff', 1, 3); ctx.globalAlpha = 1; }
    if (F.flash > 0) { ctx.globalAlpha = F.flash * 2; ctx.fillStyle = '#fff'; ctx.fillRect(cam.x, cam.y, F.vw, F.vh); ctx.globalAlpha = 1; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLabels(); if (ui.dirty.map || (slow.n % 2 === 0)) drawMinimap();
  }
  function drawNode(ctx, n) {
    var x = Math.round(n.x), y = Math.round(n.y), k = n.amount / D.NODES[n.type].max;
    if (n.type === 'tree') { var h = 5 + Math.round(k * 5); P(ctx, x - 1, y - 3, '#3a2a1a', 2, 3); P(ctx, x - 3, y - 3 - h, '#2f6a3a', 6, h); P(ctx, x - 2, y - 4 - h, '#3f8a4a', 4, 1); P(ctx, x - 4, y - h, '#2a5f36', 8, Math.max(1, h - 3)); }
    else if (n.type === 'rock') { var s = 2 + Math.round(k * 3); P(ctx, x - s, y - s, '#6a6f7a', s * 2, s); P(ctx, x - s + 1, y - s - 1, '#8a8f9a', s * 2 - 2, 1); P(ctx, x - s, y, '#4a4f5a', s * 2, 1); }
    else if (n.type === 'bush') { P(ctx, x - 3, y - 3, '#2f6a3a', 6, 3); P(ctx, x - 2, y - 4, '#3f8a4a', 4, 1); if (k > 0.3) { P(ctx, x - 2, y - 3, '#e03a3a', 1, 1); P(ctx, x + 1, y - 2, '#e03a3a', 1, 1); } if (k > 0.7) P(ctx, x, y - 4, '#e03a3a', 1, 1); }
    else if (n.type === 'ore') { P(ctx, x - 3, y - 3, '#5a5a62', 6, 3); P(ctx, x - 2, y - 4, '#6a6a72', 4, 1); if (k > 0.2) { P(ctx, x - 1, y - 3, '#ffb040', 1, 1); P(ctx, x + 1, y - 2, '#ffb040', 1, 1); } }
    else if (n.type === 'deer') { var b = Math.floor((F.time * 6) % 2); P(ctx, x - 3, y - 4 + b, '#a0703a', 6, 3); P(ctx, x + 3, y - 6 + b, '#a0703a', 2, 3); P(ctx, x + 3, y - 8 + b, '#6a4a2a', 1, 2); P(ctx, x + 5, y - 8 + b, '#6a4a2a', 1, 2); P(ctx, x - 3, y - 1, '#6a4a2a', 1, 1); P(ctx, x + 1, y - 1, '#6a4a2a', 1, 1); P(ctx, x + 4, y - 5 + b, '#1a1410', 1, 1); }
    else if (n.type === 'boar') { var b2 = Math.floor((F.time * 5) % 2); P(ctx, x - 4, y - 4 + b2, '#5a4030', 8, 4); P(ctx, x + 4, y - 4 + b2, '#5a4030', 2, 3); P(ctx, x + 5, y - 2 + b2, '#f0e0c0', 1, 1); P(ctx, x - 3, y, '#3a2a1a', 1, 1); P(ctx, x + 2, y, '#3a2a1a', 1, 1); P(ctx, x + 4, y - 4 + b2, '#ff5050', 1, 1); }
  }
  function drawGift(ctx, g) { var x = Math.round(g.x), y = Math.round(g.y), bob = Math.round(Math.sin(F.time * 5)); P(ctx, x - 3, y - 4 + bob, RES_COL[g.res], 6, 4); P(ctx, x - 3, y - 2 + bob, mix(RES_COL[g.res], '#000', 0.3), 6, 1); P(ctx, x, y - 5 + bob, '#ffe9a8', 1, 1); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y - 2, 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function drawPickup(ctx, k) { var x = Math.round(k.x), y = Math.round(k.y), bob = Math.round(Math.sin(F.time * 4)); if (k.kind === 'treasure') { P(ctx, x - 4, y - 4 + bob, '#8a5a2a', 8, 4); P(ctx, x - 4, y - 5 + bob, '#c08a3a', 8, 1); P(ctx, x - 1, y - 3 + bob, '#ffd34f', 2, 2); } else { P(ctx, x - 5, y - 1, '#9a9aa0', 10, 1); P(ctx, x - 4, y - 7, '#b0b0b8', 2, 6); P(ctx, x + 2, y - 7, '#b0b0b8', 2, 6); P(ctx, x - 1, y - 5, '#b0b0b8', 2, 4); P(ctx, x - 5, y - 8, '#c8c8d0', 10, 1); } ctx.globalAlpha = 0.2; ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y - 3, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function drawCamp(ctx, k) { var x = k.x, y = k.y; if (k.cleared) { P(ctx, x - 6, y - 2, '#3a3a3a', 12, 2); P(ctx, x - 3, y - 4, '#2a2a2a', 6, 2); return; } P(ctx, x - 7, y - 1, '#4a3a2a', 14, 1); P(ctx, x - 5, y - 7, '#5a4a3a', 10, 6); P(ctx, x - 6, y - 8, '#3a2a1a', 12, 1); P(ctx, x - 1, y - 4, '#1a1410', 3, 3); P(ctx, x + 6, y - 14, '#6a5a3a', 1, 13); P(ctx, x + 7, y - 14, '#1a1a1a', 5, 3); P(ctx, x + 8, y - 13, '#fff', 1, 1); P(ctx, x + 10, y - 13, '#fff', 1, 1); var f = Math.floor(F.time * 8) % 2; P(ctx, x - 9, y - 3 - f, '#ff7a2a', 2, 2 + f); }
  function drawEnemyBase(ctx, e) { var x = e.x, y = e.y; if (!e.alive) { P(ctx, x - 8, y - 2, '#3a3a3a', 16, 2); return; } for (var i = 0; i < 4; i++) { var hx = x + [-16, 0, 16, -6][i], hy = y + [2, -8, 2, 12][i]; P(ctx, hx - 5, hy - 4, '#5a3030', 10, 4); P(ctx, hx - 4, hy - 6, '#6a3a3a', 8, 2); P(ctx, hx - 3, hy - 7, '#6a3a3a', 6, 1); P(ctx, hx - 1, hy - 3, '#1a1010', 2, 3); } P(ctx, x - 1, y - 20, '#6a5a3a', 1, 14); P(ctx, x, y - 20, '#a02a2a', 6, 4); P(ctx, x + 1, y - 19, '#fff', 2, 2); ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('x' + e.units, x + 1, y - 23); ctx.fillStyle = '#ff8a80'; ctx.fillText('x' + e.units, x, y - 24); }
  function drawRally(ctx, r) { var x = Math.round(r.x), y = Math.round(r.y), w = Math.floor(F.time * 6) % 2; P(ctx, x, y - 12, '#6a5a3a', 1, 12); P(ctx, x + 1, y - 12, '#e04040', 5 + w, 3); P(ctx, x + 1, y - 9, '#c03030', 4 + w, 1); ctx.globalAlpha = 0.15; ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  function drawWolf(ctx, w) { var x = Math.round(w.x), y = Math.round(w.y), b = Math.floor((w.walk || F.time * 6) % 2); P(ctx, x - 4, y - 4 + b, '#6a6f78', 8, 3); P(ctx, x + 3, y - 6 + b, '#6a6f78', 3, 3); P(ctx, x + 3, y - 7 + b, '#5a5f68', 1, 1); P(ctx, x + 5, y - 7 + b, '#5a5f68', 1, 1); P(ctx, x - 5, y - 5 + b, '#5a5f68', 2, 1); P(ctx, x - 3, y - 1, '#4a4f58', 1, 1); P(ctx, x + 1, y - 1, '#4a4f58', 1, 1); P(ctx, x + 4, y - 5 + b, '#ff3030', 1, 1); if (w.anim > 0) P(ctx, x + 6, y - 4 + b, '#fff', 1, 1); }
  function drawHostile(ctx, h) { var x = Math.round(h.x), y = Math.round(h.y), t = y - 13, cl = h.kind === 'bandit' ? '#2a2a2a' : '#8a2a2a', cd = h.kind === 'bandit' ? '#111' : '#5a1a1a', f = h.face || 1; P(ctx, x - 3, t + 2, '#d8b890', 6, 4); P(ctx, x - 3, t, h.kind === 'bandit' ? '#a02020' : '#3a2a1a', 6, 2); P(ctx, x - 2 * f, t + 4, '#1a1410', 1, 1); P(ctx, x + (f > 0 ? 1 : -1), t + 4, '#1a1410', 1, 1); if (h.kind === 'bandit') P(ctx, x - 3, t + 3, '#1a1a1a', 6, 1); P(ctx, x - 3, t + 6, cl, 6, 5); P(ctx, x - 3, t + 9, cd, 6, 1); P(ctx, x + 3 * f, t + 5 - (h.anim > 0 ? 2 : 0), '#9a9aa0', 1, 5); P(ctx, x - 2, t + 11, '#1a1410', 2, 2); P(ctx, x, t + 11, '#1a1410', 2, 2); var mh = h.kind === 'bandit' ? D.UNITS.bandit.hp * (1 + S.era * 0.2) : EN.unitHp * (1 + S.era * 0.25) * (h.defend ? 1.2 : 1); P(ctx, x - 4, y + 1, '#000', 8, 1); P(ctx, x - 4, y + 1, '#e04040', Math.round(8 * clamp(h.hp / mh, 0, 1)), 1); }
  function drawBuilding(ctx, b) {
    var d = D.BUILDINGS[b.type], x = Math.round(b.x), y = Math.round(b.y), w = bw(b.type), st = d.style;
    if (!b.done) { P(ctx, x - w / 2, y - 1, '#3a2a1a', w, 1); P(ctx, x - w / 2, y - 8, '#8a6a3a', 1, 8); P(ctx, x + w / 2 - 1, y - 8, '#8a6a3a', 1, 8); P(ctx, x - w / 2, y - 8, '#8a6a3a', w, 1); var p = b.progress / d.work; P(ctx, x - w / 2, y - 11, '#000', w, 2); P(ctx, x - w / 2, y - 11, '#ffd34f', Math.round(w * clamp(p, 0, 1)), 2); if (p > 0.3) P(ctx, x - w / 2 + 1, y - 4, mix('#8a6a3a', '#000', 0.2), w - 2, 3); return; }
    var dark = '#2a1a10', win = '#ffd070';
    if (st === 'hut') { P(ctx, x - 5, y - 4, '#8a6a4a', 10, 4); P(ctx, x - 4, y - 6, '#9a7a5a', 8, 2); P(ctx, x - 3, y - 7, '#9a7a5a', 6, 1); P(ctx, x - 1, y - 3, dark, 2, 3); }
    else if (st === 'totem') { P(ctx, x - 2, y - 14, '#7a5a3a', 4, 14); P(ctx, x - 3, y - 12, '#c04a3a', 6, 2); P(ctx, x - 3, y - 8, '#e0b040', 6, 2); P(ctx, x - 1, y - 11, '#1a1410', 1, 1); P(ctx, x + 1, y - 11, '#1a1410', 1, 1); P(ctx, x - 4, y - 16, '#c04a3a', 2, 2); P(ctx, x + 2, y - 16, '#c04a3a', 2, 2); ctx.globalAlpha = 0.15 + 0.1 * Math.sin(F.time * 3); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y - 8, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else if (st === 'campfire') { P(ctx, x - 4, y - 2, '#5a3a1a', 8, 2); P(ctx, x - 3, y - 3, '#6a4a2a', 6, 1); var f = Math.floor(F.time * 8) % 3; P(ctx, x - 2, y - 6 - f, '#ff7a2a', 4, 3 + f); P(ctx, x - 1, y - 8 - f, '#ffd040', 2, 3); if (Math.random() < 0.1) F.fx.push({ kind: 'spark', x: x, y: y - 8, vx: rnd(-4, 4), vy: -12, color: '#ffb040', t: 0, life: 0.6 }); }
    else if (st === 'storage') { P(ctx, x - 6, y - 7, '#8a6a3a', 12, 7); P(ctx, x - 7, y - 9, '#5a4030', 14, 2); P(ctx, x - 4, y - 5, '#5a4030', 3, 3); P(ctx, x + 1, y - 5, '#5a4030', 3, 3); }
    else if (st === 'farm') { P(ctx, x - 8, y - 5, '#5a4a32', 16, 6); for (var i = 0; i < 4; i++) P(ctx, x - 7 + i * 4, y - 4, Date.now() < S.rainUntil ? '#5fd05a' : '#3f8a4a', 2, 4); }
    else if (st === 'thatch') house(ctx, x, y, 14, 7, '#b09060', '#d8b860', win);
    else if (st === 'forge') { house(ctx, x, y, 14, 8, '#4a4a52', '#2e2e36', '#ff7a2a'); P(ctx, x + 4, y - 14, '#3a3a3a', 2, 5); P(ctx, x + 4, y - 16 - Math.floor(F.time * 2) % 2, '#8888', 2, 2); }
    else if (st === 'wood') house(ctx, x, y, 16, 9, '#8a5a30', '#6a3a1a', win);
    else if (st === 'school') { house(ctx, x, y, 16, 9, '#c8b890', '#3a5aa0', win); P(ctx, x + 6, y - 16, '#6a5a3a', 1, 6); P(ctx, x + 7, y - 16, '#e04040', 3, 2); }
    else if (st === 'stone') house(ctx, x, y, 18, 10, '#8a8f9a', '#5a4a3a', win);
    else if (st === 'market') { P(ctx, x - 10, y - 1, '#5a4a32', 20, 1); for (var k = 0; k < 3; k++) { var mx = x - 9 + k * 7; P(ctx, mx, y - 5, '#8a6a3a', 5, 5); P(ctx, mx - 1, y - 7, ['#e04040', '#4080e0', '#e0c040'][k], 7, 2); P(ctx, mx, y - 4, ['#ffd0a0', '#a0ffa0', '#ffa0a0'][k], 2, 2); } }
    else if (st === 'castle') { P(ctx, x - 12, y - 10, '#7a7f8a', 24, 10); P(ctx, x - 12, y - 16, '#8a8f9a', 5, 16); P(ctx, x + 7, y - 16, '#8a8f9a', 5, 16); for (var t = 0; t < 3; t++) { P(ctx, x - 12 + t * 2, y - 17, '#8a8f9a', 1, 1); P(ctx, x + 7 + t * 2, y - 17, '#8a8f9a', 1, 1); } P(ctx, x - 2, y - 6, dark, 4, 6); P(ctx, x - 1, y - 20, '#6a5a3a', 1, 4); P(ctx, x, y - 20, '#e04040', 3, 2); }
    else if (st === 'brick') { house(ctx, x, y, 18, 11, '#a04a3a', '#5a3a3a', win); P(ctx, x - 8, y - 9, '#8a3a2a', 16, 1); }
    else if (st === 'university') { P(ctx, x - 11, y - 10, '#e8e0d0', 22, 10); P(ctx, x - 12, y - 12, '#c8b8a0', 24, 2); for (var u = 0; u < 4; u++) P(ctx, x - 9 + u * 6, y - 10, '#fff8f0', 2, 10); P(ctx, x - 6, y - 16, '#c8b8a0', 12, 4); P(ctx, x - 1, y - 18, '#e0c040', 2, 2); }
    else if (st === 'theater') { house(ctx, x, y, 18, 10, '#7a3a8a', '#4a2a5a', '#ffd0ff'); P(ctx, x - 3, y - 14, '#ffd040', 2, 2); P(ctx, x + 1, y - 14, '#ffd040', 2, 2); }
    else if (st === 'rowhouse') { P(ctx, x - 12, y - 12, '#8a8a90', 24, 12); P(ctx, x - 12, y - 13, '#4a4a50', 24, 1); for (var r2 = 0; r2 < 2; r2++) for (var cx2 = 0; cx2 < 5; cx2++) P(ctx, x - 10 + cx2 * 5, y - 10 + r2 * 5, win, 2, 2); }
    else if (st === 'factory') { P(ctx, x - 11, y - 9, '#6a6a70', 22, 9); P(ctx, x - 11, y - 11, '#8a3a2a', 22, 2); P(ctx, x - 8, y - 18, '#4a4a4a', 3, 9); P(ctx, x + 2, y - 18, '#4a4a4a', 3, 9); var sm = Math.floor(F.time * 2) % 3; P(ctx, x - 8, y - 20 - sm, '#9998', 3, 2); P(ctx, x + 2, y - 21 - sm, '#9998', 3, 2); P(ctx, x - 2, y - 6, dark, 4, 6); }
    else if (st === 'powerplant') { P(ctx, x - 10, y - 10, '#b0b8c0', 20, 10); P(ctx, x - 4, y - 16, '#d0d8e0', 8, 6); P(ctx, x - 1, y - 8, '#ffd040', 2, 1); P(ctx, x, y - 7, '#ffd040', 2, 1); P(ctx, x - 1, y - 6, '#ffd040', 2, 1); }
    else if (st === 'tower') { P(ctx, x - 7, y - 26, '#4a6a9a', 14, 26); P(ctx, x - 7, y - 27, '#2a4a7a', 14, 1); for (var ty = 0; ty < 6; ty++) for (var tx2 = 0; tx2 < 3; tx2++) P(ctx, x - 5 + tx2 * 4, y - 24 + ty * 4, (ty + tx2) % 3 ? '#ffe9a8' : '#2a3a5a', 2, 2); }
    else if (st === 'lab') { P(ctx, x - 10, y - 8, '#e8f0f8', 20, 8); P(ctx, x - 6, y - 14, '#c8d8e8', 12, 6); P(ctx, x - 4, y - 16, '#d8e8f8', 8, 2); P(ctx, x - 2, y - 11, '#40c0ff', 4, 2); }
    else if (st === 'park') { P(ctx, x - 11, y - 6, '#3f8a4a', 22, 6); P(ctx, x - 8, y - 12, '#2f6a3a', 6, 6); P(ctx, x + 3, y - 13, '#2f6a3a', 6, 7); P(ctx, x - 1, y - 5, '#80c0ff', 3, 2); }
    else if (st === 'dome') { ctx.fillStyle = '#9ad0ff'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x, y - 2, 11, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1; P(ctx, x - 11, y - 2, '#c0d0e0', 22, 2); P(ctx, x - 5, y - 8, '#e0e8f0', 10, 6); P(ctx, x - 3, y - 6, win, 2, 2); P(ctx, x + 1, y - 6, win, 2, 2); }
    else if (st === 'rocket') { P(ctx, x - 4, y - 20, '#e8e8f0', 8, 20); P(ctx, x - 3, y - 24, '#e04040', 6, 4); P(ctx, x - 1, y - 26, '#e04040', 2, 2); P(ctx, x - 7, y - 6, '#e04040', 3, 6); P(ctx, x + 4, y - 6, '#e04040', 3, 6); P(ctx, x - 1, y - 14, '#40a0ff', 2, 2); }
    else house(ctx, x, y, w, 9, '#8a6a4a', '#5a4030', win);
  }
  function house(ctx, x, y, w, h, wall, roof, win) { P(ctx, x - w / 2, y - h, wall, w, h); P(ctx, x - w / 2, y - h, mix(wall, '#000', 0.3), 1, h); for (var i = 0; i < 4; i++) P(ctx, x - w / 2 - 1 + i, y - h - 4 + i, roof, w + 2 - i * 2, 1); P(ctx, x - 1, y - 4, '#2a1a10', 3, 4); P(ctx, x - w / 2 + 2, y - h + 2, win, 2, 2); P(ctx, x + w / 2 - 4, y - h + 2, win, 2, 2); }
  function drawVillager(ctx, v, x, y) {
    var e = era(), L = v.look, kid = v.child, t = y - (kid ? 9 : 13), a = v.anim > 0 ? 1 : 0, moving = v.state === 'go' || v.state === 'carry' || v.state === 'wander' || v.state === 'flee' || v.state === 'gift' || v.state === 'explore' || v.state === 'migrate' || v.state === 'pickup' || (v.state === 'fight' && !a);
    var walk = moving ? Math.floor((v.walk || 0) % 2) : 0, skin = L.skin, hair = L.hc, cloth = v.job === 'warrior' ? mix(e.cloth[0], '#a02020', 0.4) : e.cloth[0], clothD = e.cloth[1], f = v.face || 1;
    if (kid) { P(ctx, x - 2, t + 1, skin, 4, 3); P(ctx, x - 2, t, hair, 4, 1); P(ctx, x - 1 * f, t + 2, '#1a1410', 1, 1); P(ctx, x - 2, t + 4, cloth, 4, 3); P(ctx, x - 1, t + 7, '#2a2119', 1, 2); P(ctx, x + 1, t + 7, '#2a2119', 1, 2); return; }
    if (L.hair === 1) { P(ctx, x - 4, t + 2, hair, 1, 6); P(ctx, x + 3, t + 2, hair, 1, 6); }
    P(ctx, x - 3, t + 2, skin, 6, 4); P(ctx, x - 3, t, hair, 6, 2); P(ctx, x - 3, t + 2, hair, 1, 1); P(ctx, x + 2, t + 2, hair, 1, 1);
    if (L.hair === 0 || L.hair === 3) P(ctx, x - 3, t + 1, hair, 7, 1);
    if (v.job === 'warrior') { P(ctx, x - 4, t, '#9a9fa8', 8, 2); P(ctx, x - 3, t - 1, '#b0b5bf', 6, 1); } else if (e.hat === 'helmet') { P(ctx, x - 4, t, '#9a9fa8', 8, 2); P(ctx, x - 3, t - 1, '#b0b5bf', 6, 1); } else if (e.hat === 'cap') { P(ctx, x - 4, t + 1, clothD, 8, 1); P(ctx, x - 3, t - 1, clothD, 6, 2); } else if (e.hat === 'visor') { P(ctx, x - 4, t - 1, '#e0e8f0', 8, 2); P(ctx, x - 3, t + 3, '#40a0ff', 6, 1); }
    P(ctx, x - 2 * f, t + 4, '#1a1410', 1, 1); P(ctx, x + (f > 0 ? 1 : -1), t + 4, '#1a1410', 1, 1);
    P(ctx, x - 3, t + 6, cloth, 6, 5); P(ctx, x - 3, t + 9, clothD, 6, 1);
    if (S.era === 0) { P(ctx, x - 2, t + 7, clothD, 1, 1); P(ctx, x + 1, t + 8, clothD, 1, 1); }
    P(ctx, x + 3 * f, t + 7 - a, skin, 1, 2);
    P(ctx, x - 2, t + 11, '#2a2119', 2, 2 + (walk ? 0 : 1)); P(ctx, x, t + 11, '#2a2119', 2, 2 + (walk ? 1 : 0));
    if (v.carry) { P(ctx, x - 2, t - 4, RES_COL[v.carry.res], 4, 3); P(ctx, x - 2, t - 2, mix(RES_COL[v.carry.res], '#000', 0.3), 4, 1); }
    var tool = { lumber: '#8a6a3a', miner: '#9a9aa0', hunter: '#c0a070', builder: '#d0a040', farmer: '#8a6a3a', smith: '#d0a040', warrior: '#9a9aa0', scout: '#6a5a3a' }[v.job];
    if (tool && (v.state === 'work' || v.state === 'go' || v.state === 'fight' || v.state === 'explore')) { P(ctx, x + 3 * f, t + 4 - a * 2, tool, 1, 4); P(ctx, x + 3 * f + (f > 0 ? 1 : -2), t + 3 - a * 2, v.job === 'lumber' || v.job === 'miner' || v.job === 'builder' || v.job === 'warrior' ? '#c0c0c8' : tool, 2, 2); }
    if (v.job === 'warrior') P(ctx, x - 5 * f, t + 6, '#6a4a2a', 2, 4);
    if (v.state === 'pray') { P(ctx, x - 1, t + 6, skin, 2, 2); if (Math.floor(F.time * 2) % 2) P(ctx, x - 1, t - 3, '#ffe9a8', 2, 1); }
    if (S.wishes.some(function (w) { return w.vid === v.id; })) { P(ctx, x - 1, t - 6 - Math.floor(F.time * 3) % 2, '#ffd34f', 2, 3); P(ctx, x - 1, t - 2 - Math.floor(F.time * 3) % 2, '#ffd34f', 2, 1); }
    var mh = unitStat(v).hp; if (v.hp < mh * 0.95) { P(ctx, x - 4, y + 1, '#000', 8, 1); P(ctx, x - 4, y + 1, v.hp / mh < 0.3 ? '#ff5a50' : '#7fd36b', Math.round(8 * clamp(v.hp / mh, 0, 1)), 1); }
  }
  var labelEls = {};
  function drawLabels() {
    var box = $('#labels'), seen = {}, p = F.pix, ox = -cam.x, oy = -cam.y, many = S.pop.length > 40;
    function el(id, cls) { var e = labelEls[id]; if (!e) { e = document.createElement('div'); e.className = cls; box.appendChild(e); labelEls[id] = e; } e.className = cls; seen[id] = true; return e; }
    S.pop.forEach(function (v) {
      if (!inView(v, 10)) return; var lift = v.held ? 14 : 0;
      if (!many || v.bubble || v.held || v.job === 'warrior') { var e = el(v.id, 'tag'); e.textContent = v.name; e.style.left = (v.x + ox) * p + 'px'; e.style.top = (v.y + 2 - lift) * p + 'px'; }
      if (v.bubble) { var b = el(v.id + 'b', 'bubble'); b.textContent = v.bubble.txt; b.style.left = (v.x + ox) * p + 'px'; b.style.top = (v.y - (v.child ? 11 : 16) - lift) * p + 'px'; }
    });
    S.blds.forEach(function (b) { if (!inView(b, 10) || (b.done && D.BUILDINGS[b.type].auto === 'house')) return; var e = el(b.id, 'tag bld'), d = D.BUILDINGS[b.type]; e.textContent = (b.done ? d.ic + ' ' : '🏗️ ') + d.nm; e.style.left = (b.x + ox) * p + 'px'; e.style.top = (b.y + 1 + oy) * p + 'px'; });
    S.settles.forEach(function (st) { if (!inView(st, 20)) return; var e = el('st' + st.id, 'tag settle'); e.textContent = '🏘️ ' + st.nm + ' ' + popOf(st).length + '명'; e.style.left = (st.x + ox) * p + 'px'; e.style.top = (st.y - 24 + oy) * p + 'px'; });
    S.camps.forEach(function (k) { if (k.cleared || !isExplored(k.c, k.r) || !inView(k, 10)) return; var e = el('k' + k.id, 'tag enemy'); e.textContent = '🏴‍☠️ 산적 소굴'; e.style.left = (k.x + ox) * p + 'px'; e.style.top = (k.y + 2 + oy) * p + 'px'; });
    if (S.enemy && S.enemy.alive && isExplored(S.enemy.c, S.enemy.r) && inView(S.enemy, 20)) { var ee = el('enemy', 'tag enemy'); ee.textContent = '⚔️ ' + EN.nm; ee.style.left = (S.enemy.x + ox) * p + 'px'; ee.style.top = (S.enemy.y + 14 + oy) * p + 'px'; }
    for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++) { if (isExplored(c, r)) continue; var cc = cellCenter(c, r); if (!inView(cc, 60)) continue; var fe = el('fog' + c + r, 'tag fog'); fe.textContent = '? 안 가 본 땅'; fe.style.left = (cc.x + ox) * p + 'px'; fe.style.top = (cc.y + oy) * p + 'px'; }
    Object.keys(labelEls).forEach(function (id) { if (!seen[id]) { labelEls[id].remove(); delete labelEls[id]; } });
  }
  function drawMinimap() {
    ui.dirty.map = false; var cv = $('#minimap'), sc = 0.16, ctx = cv.getContext('2d'); cv.width = Math.round(WW * sc); cv.height = Math.round(WH * sc);
    for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++) { ctx.fillStyle = isExplored(c, r) ? '#3a5a33' : '#141a22'; ctx.fillRect(c * W.cellW * sc, r * W.cellH * sc, W.cellW * sc, W.cellH * sc); ctx.strokeStyle = '#0008'; ctx.strokeRect(c * W.cellW * sc + 0.5, r * W.cellH * sc + 0.5, W.cellW * sc - 1, W.cellH * sc - 1); }
    S.settles.forEach(function (st) { ctx.fillStyle = '#ffd34f'; ctx.fillRect(st.x * sc - 2, st.y * sc - 2, 5, 5); });
    S.camps.forEach(function (k) { if (!k.cleared && isExplored(k.c, k.r)) { ctx.fillStyle = '#222'; ctx.fillRect(k.x * sc - 2, k.y * sc - 2, 4, 4); } });
    S.pickups.forEach(function (k) { if (!k.taken && isExplored(k.c, k.r)) { ctx.fillStyle = '#6fb3ff'; ctx.fillRect(k.x * sc - 1, k.y * sc - 1, 3, 3); } });
    if (S.enemy && S.enemy.alive && isExplored(S.enemy.c, S.enemy.r)) { ctx.fillStyle = '#e04040'; ctx.fillRect(S.enemy.x * sc - 2, S.enemy.y * sc - 2, 5, 5); }
    S.hostiles.forEach(function (h) { if (h.raid) { ctx.fillStyle = '#ff6060'; ctx.fillRect(h.x * sc - 1, h.y * sc - 1, 2, 2); } });
    ctx.strokeStyle = '#fff'; ctx.strokeRect(cam.x * sc + 0.5, cam.y * sc + 0.5, F.vw * sc - 1, F.vh * sc - 1);
  }
  function drawPortrait(cv, v) { cv.width = 20; cv.height = 20; var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 20, 20); drawVillager(ctx, { look: v.look, job: v.job, state: 'idle', face: 1, anim: 0, carry: null, id: '', child: v.child, hp: 999 }, 9, 18); }

  // ---------- 메인 루프 ----------
  var last = 0, acc = 0, uiTick = 0, secTick = 0, saveTick = 0;
  function loop(ts) {
    requestAnimationFrame(loop); if (!last) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000); last = ts;
    acc += dt; while (acc >= 1 / 30) { step(1 / 30); acc -= 1 / 30; }
    trackRate(dt); draw();
    uiTick += dt; secTick += dt;
    if (uiTick >= 0.5) { uiTick = 0; renderHead(); renderWishTimers(); }
    if (secTick >= 1) { secTick = 0; if (ui.sleep) renderSleep(); if (ui.dirty.pop) renderPop(); if (ui.dirty.bld) renderBld(); if (ui.dirty.tech) renderTech(); if (ui.dirty.ach) renderAch(); if (ui.dirty.log) renderLog(); if ((saveTick = (saveTick + 1) % 5) === 0) save(); }
  }

  // ---------- 화면(DOM) ----------
  var ui = { dirty: { pop: true, bld: true, tech: true, ach: true, log: true, wish: true, head: true, map: true }, power: null, sleep: false, sleepAt: 0, held: null, downAt: null, panning: false, wake: null };
  function renderHead() {
    ui.dirty.head = false; var e = era();
    $('#eraIc').textContent = e.ic; $('#eraNm').textContent = e.nm; $('#worldNo').textContent = S.world > 1 ? '세계 ' + S.world : '';
    $('#resRow').innerHTML = RES.filter(function (k) { return k !== 'metal' || S.era >= 1 || S.res.metal > 0; }).map(function (k) { return '<span>' + RES_IC[k] + ' ' + fmt(S.res[k]) + '</span>'; }).join('');
    $('#cap').textContent = '보관 ' + fmt(storageCap()) + ' · 군락 ' + S.settles.length + ' · 탐험 ' + exploredCount() + '/' + (W.cols * W.rows);
    $('#faith').textContent = '✨ ' + fmt(S.faith); $('#popCnt').textContent = '👥 ' + S.pop.length + '/' + housing() + (S.pop.filter(function (v) { return v.child; }).length ? ' (아이 ' + S.pop.filter(function (v) { return v.child; }).length + ')' : ''); $('#happy').textContent = (S.happy >= 70 ? '😊' : S.happy >= 40 ? '🙂' : '😟') + ' ' + Math.round(S.happy);
    var t = currentTech(), tb = researchBld() || totem(); $('#techLine').innerHTML = t ? ('🔬 ' + t.ic + ' ' + t.nm + ' <i style="width:' + Math.round(clamp(S.res.know / t.cost, 0, 1) * 100) + '%"></i><span>' + fmt(S.res.know) + '/' + t.cost + (tb ? '' : ' · 토템이 있어야 연구') + '</span>') : (S.era === D.ERAS.length - 1 ? '🚀 ' + (S.launched ? '새 세계를 열 수 있다' : '우주선을 짓는 중') : '🏁 다음 시대까지: ' + (S.pop.length < (era().minPop || 0) ? '인구 ' + S.pop.length + '/' + era().minPop : D.BUILDINGS[era().key].nm + ' 짓는 중'));
    var warriors = S.pop.filter(function (v) { return v.job === 'warrior'; }).length;
    $('#oracleLine').textContent = (S.oracle ? '📣 ' + D.ORACLES.find(function (o) { return o.id === S.oracle.id; }).nm + ' ' + Math.ceil((S.oracle.until - Date.now()) / 1000) + 's · ' : '') + (S.invading ? '🔥 출정 중 · ' : raidActive() ? '⚔️ 침략 중! · ' : '') + '⚔️ 전사 ' + warriors + (S.enemy && S.enemy.met && S.enemy.alive ? ' · 적 ' + S.enemy.units : '');
    document.querySelectorAll('.pw').forEach(function (b) { var p = D.POWERS.find(function (x) { return x.id === b.dataset.power; }); if (p) b.classList.toggle('poor', S.faith < p.cost); b.classList.toggle('on', ui.power === b.dataset.power); });
    $('#huntInfo').textContent = '시민 ' + S.pop.length + '명 · ' + (raidActive() ? '⚔️ 침략 중' : S.hostiles.length ? '🏴‍☠️ 산적 ' + S.hostiles.length : S.wolves.length ? '🐺 늑대 ' + S.wolves.length : '평화로움');
  }
  function renderWishes() { ui.dirty.wish = false; $('#wishList').innerHTML = S.wishes.map(function (w) { var def = D.WISHES.find(function (x) { return x.id === w.type; }), v = S.pop.find(function (x) { return x.id === w.vid; }); return '<div class="wish" data-id="' + w.id + '"><b>' + def.ic + ' ' + esc(v ? v.name : '?') + '</b><span>' + esc(def.txt) + '</span><i data-t="' + w.until + '"></i></div>'; }).join(''); }
  function renderWishTimers() { var now = Date.now(); document.querySelectorAll('#wishList i').forEach(function (i) { i.style.width = clamp((+i.dataset.t - now) / (C.wishTime * 1000) * 100, 0, 100) + '%'; }); }
  function renderChat() { var el = $('#chatList'); el.innerHTML = S.chat.slice(-9).map(function (c) { return c.sys ? '<div class="sys">' + esc(c.txt) + '</div>' : '<div><b>' + esc(c.nm) + '</b> : ' + esc(c.txt) + '</div>'; }).join(''); el.scrollTop = el.scrollHeight; }
  var STATE_NM = { idle: '쉬는 중', wander: '어슬렁', go: '가는 중', work: '일하는 중', pray: '기도 중', carry: '나르는 중', flee: '도망!', gift: '선물 주우러', held: '들려 있음', explore: '탐험 중', pickup: '보물 찾으러', fight: '전투 중', migrate: '이주 중' };
  function renderPop() {
    ui.dirty.pop = false; var el = $('#popList'), count = {}; S.pop.forEach(function (v) { count[v.job] = (count[v.job] || 0) + 1; });
    $('#jobSummary').innerHTML = Object.keys(D.JOBS).filter(function (k) { return count[k]; }).map(function (k) { return '<span>' + D.JOBS[k].ic + ' ' + D.JOBS[k].nm + ' ' + count[k] + '</span>'; }).join(' ') + S.settles.map(function (st) { return '<span class="st">🏘️ ' + esc(st.nm) + ' ' + popOf(st).length + '</span>'; }).join('');
    el.innerHTML = S.pop.slice(0, 60).map(function (v) { var j = D.JOBS[v.job], mate = v.partner ? S.pop.find(function (o) { return o.id === v.partner; }) : null; return '<div class="item" data-id="' + v.id + '"><div class="ic"><canvas data-portrait="' + v.id + '"></canvas></div><div class="body"><div class="nm">' + esc(v.name) + ' <span class="sub">' + j.ic + ' ' + j.nm + (Date.now() < v.nudge ? ' (신의 뜻)' : '') + '</span></div><div class="sub">' + (v.held ? '들려 있음' : STATE_NM[v.state] || v.state) + (v.carry ? ' · ' + RES_IC[v.carry.res] + v.carry.n : '') + (mate ? ' · 💕' + esc(mate.name) : '') + (v.kids ? ' · 👶' + v.kids : '') + ' · ' + esc(settleOf(v).nm) + '</div></div></div>'; }).join('') + (S.pop.length > 60 ? '<div class="sub">… 외 ' + (S.pop.length - 60) + '명</div>' : '');
    el.querySelectorAll('canvas[data-portrait]').forEach(function (cv) { var v = S.pop.find(function (x) { return x.id === cv.dataset.portrait; }); if (v) drawPortrait(cv, v); });
  }
  function renderBld() {
    ui.dirty.bld = false; var h = home(), next = nextBuilding(h);
    $('#bldNext').innerHTML = (next ? '다음에 지을 것: <b>' + D.BUILDINGS[next].ic + ' ' + D.BUILDINGS[next].nm + '</b> — 필요: ' + Object.keys(D.BUILDINGS[next].cost).map(function (k) { return RES_IC[k] + D.BUILDINGS[next].cost[k] + (S.res[k] < D.BUILDINGS[next].cost[k] ? '<em>(부족)</em>' : ''); }).join(' ') : '지금은 지을 게 없어요. 기술을 발견하면 새 건물이 열립니다.') +
      '<br>' + S.settles.map(function (st) { return '🏘️ <b>' + esc(st.nm) + '</b> 인구 ' + popOf(st).length + ' · 수용 ' + housing(st); }).join(' · ') + (S.enemy && S.enemy.alive ? '<br>⚔️ ' + EN.nm + ': ' + (S.enemy.met ? '전사 ' + S.enemy.units + '명 · 침략 ' + S.enemy.raids + '회' : '아직 못 찾음 (탐험가가 안개를 걷습니다)') : '<br>👑 적 부족 정복됨');
    $('#bldList').innerHTML = S.blds.slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); }).map(function (b) { var d = D.BUILDINGS[b.type], st = S.settles.find(function (s) { return s.id === b.settle; }); return '<div class="item"><div class="ic">' + d.ic + '</div><div class="body"><div class="nm">' + d.nm + (b.done ? '' : ' <span class="sub">짓는 중 ' + Math.round(b.progress / d.work * 100) + '%</span>') + '</div><div class="sub">' + (d.housing ? '수용 ' + d.housing + '명' : d.role === 'research' ? '지식 ×' + d.research : d.role === 'faith' ? '믿음 ×' + (d.faith || 1) : d.role === 'storage' ? '보관 +' + C.storagePer : d.role === 'food' ? '농부가 식량 생산' : d.role === 'happy' ? '행복 +' + d.happy : d.role === 'metal' ? '금속' : d.role === 'launch' ? '새 세계로' : '') + (st ? ' · ' + esc(st.nm) : '') + '</div></div></div>'; }).join('') || '<div class="sub">아직 건물이 없어요.</div>';
  }
  function renderTech() {
    ui.dirty.tech = false; var cur = currentTech();
    $('#techList').innerHTML = D.ERAS.map(function (e, i) { if (i > S.era + 1) return ''; return '<div class="era' + (i === S.era ? ' on' : i < S.era ? ' past' : ' future') + '"><b>' + e.ic + ' ' + e.nm + '</b><span class="sub">' + e.msg + '</span>' + D.TECHS.filter(function (t) { return t.era === i; }).map(function (t) { var done = hasTech(t.id); return '<div class="tech ' + (done ? 'done' : cur && cur.id === t.id ? 'cur' : '') + '">' + t.ic + ' ' + t.nm + ' <span class="sub">📜' + t.cost + (done ? ' ✓' : cur && cur.id === t.id ? ' · 연구 중 ' + Math.round(clamp(S.res.know / t.cost, 0, 1) * 100) + '%' : '') + (t.unlock ? ' · ' + D.BUILDINGS[t.unlock].nm + ' 해금' : '') + (t.job ? ' · ' + D.JOBS[t.job].nm + ' 직업' : '') + '</span></div>'; }).join('') + (i === S.era ? '<div class="sub">시대를 넘기려면: 이 시대 기술 전부 + ' + D.BUILDINGS[e.key].ic + ' ' + D.BUILDINGS[e.key].nm + (e.minPop ? ' + 인구 ' + e.minPop + '명 (지금 ' + S.pop.length + ')' : '') + '</div>' : '') + '</div>'; }).join('');
  }
  function renderAch() {
    ui.dirty.ach = false; var d = S.daily;
    $('#dailyList').innerHTML = D.DAILY.map(function (t) { return '<div class="' + (d[t.id] >= t.n ? 'ok' : '') + '">' + (d[t.id] >= t.n ? '✓' : '·') + ' ' + t.nm + ' ' + Math.min(d[t.id], t.n) + '/' + t.n + '</div>'; }).join('') + (d.claimed ? '<div class="ok">✅ 오늘의 과제 완료 (믿음 +' + D.DAILY_FAITH + ')</div>' : '<div class="sub">다 하면 믿음 +' + D.DAILY_FAITH + '</div>');
    var NM = { pop: '인구 ', era: '시대 ', tech: '발견 ', faith: '누적 믿음 ', wish: '소원 ', move: '옮기기 ', world: '세계 ', marry: '결혼 ', settle: '군락 ', explored: '탐험한 땅 ', bandit: '산적 소탕 ', defend: '침략 격퇴 ', conquer: '정복 ' };
    $('#achList').innerHTML = D.ACHIEVEMENTS.map(function (a) { var ok = S.ach.indexOf(a.id) >= 0; return '<div class="item ' + (ok ? '' : 'dim') + '"><div class="ic">' + a.ic + '</div><div class="body"><div class="nm">' + a.nm + (ok ? ' ✓' : '') + '</div><div class="sub">' + NM[a.type] + (a.type === 'era' ? D.ERAS[a.n].nm : a.n) + (a.faith ? ' · 믿음 +' + a.faith : '') + '</div></div></div>'; }).join('');
  }
  function renderLog() { ui.dirty.log = false; $('#logList').innerHTML = S.log.map(function (l) { return '<div>' + l.t + ' ' + l.txt + '</div>'; }).join('') || '<div>아직 기록이 없어요.</div>'; }
  function renderMore() { $('#moreInfo').innerHTML = '세계 ' + S.world + ' · 누적 믿음 ' + fmt(S.faithTotal) + ' · 태어난 아이 ' + S.stats.born + ' · 결혼 ' + S.stats.marry + ' · 별이 된 사람 ' + S.stats.died + ' · 들어준 소원 ' + S.stats.wishes + ' · 옮긴 횟수 ' + S.stats.moves + ' · 늑대 ' + S.stats.wolves + ' · 산적 소탕 ' + S.stats.bandit + ' · 침략 격퇴 ' + S.stats.defend + ' · 정복 ' + S.stats.conquer + '<br>오프라인 보상 ' + S.cfg.offPct + '% · 최대 ' + S.cfg.offHours + '시간 · 분당 수입: ' + ['food', 'wood', 'know', 'faith'].map(function (k) { return RES_IC[k] + S.rate[k].toFixed(1); }).join(' '); $('#newWorldBtn').disabled = !S.launched; $('#soundBtn').textContent = S.cfg.sound ? '🔊 소리 켬' : '🔇 소리 끔'; }
  function renderSleep() { var d = new Date(); $('#sleepClock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); $('#sleepStats').textContent = '절전 ' + Math.floor((Date.now() - ui.sleepAt) / 60000) + '분 · ' + era().nm + ' · 👥 ' + S.pop.length + ' · ✨ ' + fmt(S.faith) + ' · 발견 ' + S.techs.length + '/' + D.TECHS.length + (raidActive() ? ' · ⚔️ 침략 중!' : ''); }
  function setSleep(on) { ui.sleep = on; $('#sleep').hidden = !on; if (on) { ui.sleepAt = Date.now(); renderSleep(); if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { ui.wake = l; }).catch(function () {}); } else { if (ui.wake) { ui.wake.release().catch(function () {}); ui.wake = null; } renderAll(); } }
  function renderAll() { renderHead(); renderWishes(); renderChat(); renderPop(); renderBld(); renderTech(); renderAch(); renderLog(); ui.dirty.map = true; }
  var PANEL_TITLE = { pop: '👥 시민', bld: '🏘️ 마을', tech: '🔬 발견', ach: '🏆 업적·과제', more: '⋯ 더보기' };
  function openPanel(name) { document.querySelectorAll('#panel .pane').forEach(function (p) { p.classList.toggle('on', p.id === 'tab-' + name); }); $('#panelTitle').textContent = PANEL_TITLE[name]; if (name === 'pop') renderPop(); if (name === 'bld') renderBld(); if (name === 'tech') renderTech(); if (name === 'ach') renderAch(); if (name === 'more') { renderMore(); renderLog(); } $('#panel').hidden = false; document.querySelectorAll('.navbtn').forEach(function (b) { b.classList.toggle('on', b.dataset.panel === name); }); }
  function openVillager(v) {
    var j = D.JOBS[v.job], mate = v.partner ? S.pop.find(function (o) { return o.id === v.partner; }) : null;
    $('#sheetContent').innerHTML = '<div class="h-head"><canvas id="portrait"></canvas><div><div class="nm">' + esc(v.name) + (v.child ? ' 🧒' : '') + '</div><div class="sub">' + j.ic + ' ' + j.nm + ' · ' + (STATE_NM[v.state] || v.state) + ' · ❤️' + Math.round(v.hp) + '/' + unitStat(v).hp + '</div><div class="sub">' + esc(settleOf(v).nm) + ' · ' + (v.child ? '아이 (어른까지 ' + Math.max(0, Math.ceil((FM.adultAfter - v.age) / 60)) + '분)' : Math.floor(v.age / 60) + '분을 살았다') + (mate ? ' · 💕 ' + esc(mate.name) : ' · 혼자') + (v.kids ? ' · 아이 ' + v.kids : '') + '</div></div></div>' +
      '<p class="hint">직업은 마을 형편에 따라 스스로 바꿉니다. 지도에서 <b>집어서</b> 나무·바위·토템 옆에 내려놓으면 90초 동안 그 일을 하고, 안 가 본 땅에 내려놓으면 탐험가가 됩니다. 다른 군락 옆에 놓으면 그리로 이사합니다.</p>' +
      '<div class="row"><input id="renameIn" type="text" value="' + esc(v.name) + '" maxlength="8"><button class="btn" data-act="rename">이름 바꾸기</button><button class="btn" data-act="close">닫기</button></div>';
    $('#sheet').hidden = false; drawPortrait($('#portrait'), v); ui.sheetV = v;
  }

  // ---------- 입력 ----------
  function canvasPos(e) { var r = $('#field').getBoundingClientRect(); return { x: (e.clientX - r.left) / F.pix + cam.x, y: (e.clientY - r.top) / F.pix + cam.y }; }
  function bind() {
    var cv = $('#field');
    cv.addEventListener('pointerdown', function (e) {
      var p = canvasPos(e); ui.downAt = { x: p.x, y: p.y, sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y, t: Date.now() }; ui.panning = false;
      var v = null, bd = 7; S.pop.forEach(function (o) { var d = Math.sqrt((o.x - p.x) * (o.x - p.x) + (o.y - 6 - p.y) * (o.y - 6 - p.y)); if (d < bd) { bd = d; v = o; } });
      if (v) { ui.held = v; v.held = true; v.state = 'idle'; v.carry = null; say(v, 'held', true); }
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', function (e) {
      if (ui.held) { var p = canvasPos(e); ui.held.x = clamp(p.x, 4, WW - 4); ui.held.y = clamp(p.y, 4, WH - 4); if (ui.held.x - cam.x < 12) cam.x -= 2; if (ui.held.x - cam.x > F.vw - 12) cam.x += 2; if (ui.held.y - cam.y < 12) cam.y -= 2; if (ui.held.y - cam.y > F.vh - 12) cam.y += 2; clampCam(); return; }
      if (!ui.downAt) return; var dx = (e.clientX - ui.downAt.sx) / F.pix, dy = (e.clientY - ui.downAt.sy) / F.pix;
      if (ui.panning || Math.abs(dx) > 3 || Math.abs(dy) > 3) { ui.panning = true; cam.x = ui.downAt.cx - dx; cam.y = ui.downAt.cy - dy; clampCam(); ui.dirty.map = true; }
    });
    cv.addEventListener('pointerup', function (e) {
      var p = canvasPos(e), down = ui.downAt; ui.downAt = null;
      if (ui.held) { var v = ui.held; ui.held = null; var moved = down && (Math.abs(p.x - down.x) > 3 || Math.abs(p.y - down.y) > 3); if (moved) dropVillager(v, p.x, p.y); else { v.held = false; v.state = 'idle'; openVillager(v); } return; }
      if (ui.panning) { ui.panning = false; return; }
      if (ui.power) { usePower(ui.power, p.x, p.y); if (ui.power !== 'smite' && ui.power !== 'fire') ui.power = null; renderHead(); return; }
      var b = null; S.blds.forEach(function (o) { if (Math.abs(o.x - p.x) < bw(o.type) / 2 + 2 && p.y > o.y - 20 && p.y < o.y + 4) b = o; });
      if (b) { var d = D.BUILDINGS[b.type]; toast(d.ic + ' ' + d.nm + (b.done ? (d.housing ? ' · 수용 ' + d.housing + '명' : d.msg ? ' · ' + d.msg : '') : ' · 짓는 중 ' + Math.round(b.progress / d.work * 100) + '%')); return; }
      var k = S.camps.find(function (o) { return !o.cleared && isExplored(o.c, o.r) && dist(o, p) < 14; }); if (k) return toast('🏴‍☠️ 산적 소굴 — 산적 ' + S.hostiles.filter(function (h) { return h.camp === k.id; }).length + '명. 🚩 집결로 전사를 보내거나 🔥 불벼락');
      if (S.enemy && S.enemy.alive && isExplored(S.enemy.c, S.enemy.r) && dist(S.enemy, p) < 24) return toast('⚔️ ' + EN.nm + ' — 전사 ' + S.enemy.units + '명. 📣 신탁 "적을 쳐라"로 출정');
      var n = null; S.nodes.forEach(function (o) { if (dist(o, p) < 7) n = o; }); if (n) toast(D.NODES[n.type].nm + ' · ' + RES_IC[D.NODES[n.type].res] + ' ' + Math.floor(n.amount) + ' 남음');
    });
    cv.addEventListener('pointercancel', function () { if (ui.held) { ui.held.held = false; ui.held.state = 'idle'; ui.held = null; } ui.downAt = null; ui.panning = false; });
    $('#minimap').addEventListener('click', function (e) { var r = e.currentTarget.getBoundingClientRect(); panTo({ x: (e.clientX - r.left) / r.width * WW, y: (e.clientY - r.top) / r.height * WH }); ui.dirty.map = true; });
    $('#homeBtn').addEventListener('click', function () { panTo(home()); ui.dirty.map = true; });
    document.querySelectorAll('.pw').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.power === 'oracle') { renderOracle(); $('#oracleSheet').hidden = false; return; } ui.power = ui.power === b.dataset.power ? null : b.dataset.power; var pw = D.POWERS.find(function (x) { return x.id === ui.power; }); if (pw) toast(pw.ic + ' ' + pw.nm + ' — 지도를 탭하세요 (' + pw.hint + ', 믿음 ' + pw.cost + ')'); renderHead(); }); });
    $('#oracleList').addEventListener('click', function (e) { var b = e.target.closest('[data-oracle]'); if (!b) return; useOracle(b.dataset.oracle); $('#oracleSheet').hidden = true; });
    $('#wishList').addEventListener('click', function (e) { var w = e.target.closest('.wish'); if (!w) return; var ws = S.wishes.find(function (x) { return x.id === w.dataset.id; }); if (ws) { toast(D.WISHES.find(function (x) { return x.id === ws.type; }).hint); var v = S.pop.find(function (x) { return x.id === ws.vid; }); if (v) panTo(v); } });
    document.querySelectorAll('.navbtn').forEach(function (b) { b.addEventListener('click', function () { openPanel(b.dataset.panel); }); });
    document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('.sheet').hidden = true; if (b.closest('#panel')) document.querySelectorAll('.navbtn').forEach(function (x) { x.classList.remove('on'); }); }); });
    $('#popList').addEventListener('click', function (e) { var el = e.target.closest('[data-id]'); if (!el) return; var v = S.pop.find(function (x) { return x.id === el.dataset.id; }); if (v) { openVillager(v); panTo(v); } });
    $('#sheetContent').addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (!b) return; if (b.dataset.act === 'close') $('#sheet').hidden = true; if (b.dataset.act === 'rename' && ui.sheetV) { var nm = $('#renameIn').value.trim().slice(0, 8); if (nm) { ui.sheetV.name = nm; toast('이름을 ' + nm + '(으)로 바꿨어요'); renderPop(); save(); } $('#sheet').hidden = true; } });
    $('#sleepBtn').addEventListener('click', function () { setSleep(true); save(); }); $('#sleep').addEventListener('click', function () { setSleep(false); });
    $('#soundBtn').addEventListener('click', function () { S.cfg.sound = !S.cfg.sound; renderMore(); save(); });
    $('#newWorldBtn').addEventListener('click', function () { if (!S.launched) return; if (!confirm('새 세계를 열까요? 처음부터 다시 시작하고, 세계 ' + (S.world + 1) + '에서는 모든 생산이 +' + (S.world * 10) + '% 됩니다. 업적과 누적 믿음은 남습니다.')) return; newWorld(); $('#panel').hidden = true; });
    $('#welcomeOk').addEventListener('click', function () { $('#welcome').hidden = true; });
    $('#godFaith').addEventListener('click', function () { addFaith(100); renderHead(); save(); }); $('#godKnow').addEventListener('click', function () { S.res.know += 500; renderHead(); save(); });
    $('#godEra').addEventListener('click', function () { D.TECHS.filter(function (t) { return t.era === S.era; }).forEach(function (t) { if (!hasTech(t.id)) S.techs.push(t.id); }); var k = era().key, h = home(); if (!S.blds.some(function (b) { return b.type === k; })) { var pos = freeSlotFor(S, h, bw(k)) || h; S.blds.push({ id: uid(), type: k, x: pos.x, y: pos.y, progress: 0, done: true, settle: h.id }); } while (S.pop.length < (era().minPop || 0)) S.pop.push(makeVillager(h.x + rnd(-14, 14), h.y + rnd(-6, 10), 'gather', h)); checkEra(); renderAll(); save(); });
    $('#godRes').addEventListener('click', function () { ['food', 'wood', 'stone', 'metal'].forEach(function (k) { S.res[k] += 300; }); renderHead(); save(); });
    $('#godReveal').addEventListener('click', function () { for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++) reveal(c, r); campsTick(); renderAll(); save(); });
    $('#godPop').addEventListener('click', function () { var h = home(); for (var i = 0; i < 5; i++) S.pop.push(makeVillager(h.x + rnd(-14, 14), h.y + rnd(-6, 10), 'gather', h)); renderAll(); save(); });
    $('#godExport').addEventListener('click', function () { $('#godData').value = JSON.stringify(S); $('#godData').select(); toast('아래 칸을 복사해 두세요'); });
    $('#godImport').addEventListener('click', function () { try { var s = JSON.parse($('#godData').value); if (!s || !s.pop) throw 0; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); location.reload(); } catch (e) { toast('저장 데이터 형식이 아니에요'); } });
    $('#godReset').addEventListener('click', function () { if (!confirm('정말 전부 지울까요? 되돌릴 수 없어요.')) return; localStorage.removeItem(SAVE_KEY); location.reload(); });
    $('#godOff').addEventListener('change', function () { S.cfg.offPct = clamp(parseInt($('#godOff').value, 10) || 50, 0, 100); save(); });
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); else { last = 0; offlineCatchUp(); renderAll(); } });
    window.addEventListener('pagehide', save);
  }
  function renderOracle() { $('#oracleList').innerHTML = D.ORACLES.map(function (o) { var locked = (o.era !== undefined && S.era < o.era) || (o.miracle === 'invade' && !(S.enemy && S.enemy.alive && S.enemy.met)); return '<button class="btn oracle" data-oracle="' + o.id + '" ' + (locked ? 'disabled' : '') + '><b>' + o.ic + ' ' + o.nm + '</b><span class="sub">' + (o.hint || (C.oracleTime + '초 동안 시민들이 이 일에 집중')) + (o.era !== undefined && S.era < o.era ? ' · ' + D.ERAS[o.era].nm + '부터' : o.miracle === 'invade' && !(S.enemy && S.enemy.met) ? ' · 적 마을을 먼저 찾아야 함' : '') + ' · ✨' + o.cost + '</span></button>'; }).join(''); }
  function buildPowerBar() { $('#powerBar').innerHTML = D.POWERS.map(function (p) { return '<button class="pw" data-power="' + p.id + '" type="button"><i>' + p.ic + '</i>' + p.nm + '<small>✨' + p.cost + '</small></button>'; }).join('') + '<button class="pw oracleBtn" data-power="oracle" type="button"><i>📣</i>신탁<small>✨10+</small></button>'; }

  // ---------- 시작 ----------
  buildPowerBar(); resizeCanvas();
  S = load(); if (!S) newGame(); else { panTo(home()); }
  bind(); $('#godOff').value = S.cfg.offPct; offlineCatchUp(); renderAll();
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__gv = { get S() { return S; }, F: F, cam: cam, ui: ui, D: D, save: save, home: home, usePower: usePower, useOracle: useOracle, dropVillager: dropVillager, slowTick: slowTick, nextBuilding: nextBuilding, reveal: reveal, panTo: panTo, cellCenter: cellCenter, family: family };
})();
