/* 헌터 마을 — 나만의 방치형 헌터 타이쿤.
 * 서버 없이 이 기기 브라우저(localStorage)에만 저장합니다.
 * 구성: 데이터 정의 → 생성(헌터/장비/몬스터) → 시뮬레이션(사냥터) → 그리기(canvas) → 화면(DOM) → 신 모드 → 시작 */
(function () {
  'use strict';
  var SAVE_KEY = 'hunter-town-v1';
  var $ = function (s) { return document.querySelector(s); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var ri = function (a, b) { return Math.floor(rnd(a, b + 1)); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var fmt = function (n) { return Math.floor(n).toLocaleString('ko-KR'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  // ---------- 데이터 정의 ----------
  var TIERS = ['C', 'B', 'A', 'S', 'SP'];
  var TIER_LABEL = { C: 'C', B: 'B', A: 'A', S: 'S', SP: 'S+' };
  var TIER_MUL = { C: 1, B: 1.25, A: 1.6, S: 2.1, SP: 2.8 };
  var TIER_COLOR = { C: '#9aa3b8', B: '#5ad17c', A: '#4f9cf7', S: '#b06cf5', SP: '#f2b544' };
  var TIER_IDX = { C: 0, B: 1, A: 2, S: 3, SP: 4 };
  var CLASSES = {
    warrior: { nm: '전사', ic: '🗡️', weapon: 'sword', color: '#e06c5a', hp: 1.3, atk: 1.0, def: 1.3, spd: 1.0, range: 30 },
    archer:  { nm: '궁수', ic: '🏹', weapon: 'bow',   color: '#5ad17c', hp: 0.9, atk: 1.1, def: 0.8, spd: 1.3, range: 150 },
    mage:    { nm: '마법사', ic: '🔮', weapon: 'staff', color: '#4f9cf7', hp: 0.8, atk: 1.5, def: 0.6, spd: 0.8, range: 130 },
    cleric:  { nm: '성직자', ic: '✨', weapon: 'mace',  color: '#f2d06c', hp: 1.1, atk: 0.9, def: 1.1, spd: 0.9, range: 34, heal: true }
  };
  var WEAPON_NOUN = { sword: '검', bow: '활', staff: '지팡이', mace: '철퇴', armor: '갑옷' };
  var WEAPON_IC = { sword: '🗡️', bow: '🏹', staff: '🪄', mace: '🔨', armor: '🛡️' };
  var TIER_PREFIX = { C: '낡은', B: '단단한', A: '빛나는', S: '전설의', SP: '신의' };
  var TRAITS = [
    { nm: '힘센', good: true, atk: 0.15 }, { nm: '튼튼한', good: true, hp: 0.2 }, { nm: '날쌘', good: true, spd: 0.15 },
    { nm: '행운의', good: true, crit: 8 }, { nm: '부지런한', good: true, exp: 0.2 }, { nm: '욕심쟁이', good: true, gold: 0.25 },
    { nm: '겁쟁이', good: false, atk: -0.1 }, { nm: '허약한', good: false, hp: -0.15 }, { nm: '느린', good: false, spd: -0.15 },
    { nm: '덜렁이', good: false, def: -0.1 }, { nm: '게으른', good: false, exp: -0.15 }
  ];
  var NAMES = ['아린', '벨', '카일', '루나', '데인', '미르', '세라', '유키', '하루', '라온', '단테', '로이', '피아', '제이', '소라', '노아', '엘리', '가온', '테오', '밀라', '수호', '리안', '하나', '이안', '라희', '준', '니아', '레오', '시온', '유나'];
  var ZONES = [
    { nm: '초원', ic: '🌲', mons: ['슬라임', '들쥐', '고블린'], color: '#7bd37b', boss: '고블린 대장' },
    { nm: '숲', ic: '🌳', mons: ['늑대', '거미', '오크'], color: '#4f9c5f', boss: '오크 족장' },
    { nm: '동굴', ic: '🕳️', mons: ['박쥐', '스켈레톤', '트롤'], color: '#8a8fa8', boss: '트롤 왕' },
    { nm: '화산', ic: '🌋', mons: ['도마뱀', '임프', '골렘'], color: '#e0784f', boss: '용암 골렘' },
    { nm: '심연', ic: '🌑', mons: ['그림자', '악마', '와이번'], color: '#9a5cf0', boss: '심연의 드래곤' }
  ];
  var ZONE_KILLS = 20;
  var BUILDINGS = [
    { id: 'inn', nm: '숙소', ic: '🏠', desc: function (lv) { return '헌터 정원 ' + (3 + lv) + '명'; }, max: 20 },
    { id: 'forge', nm: '대장간', ic: '🔥', desc: function (lv) { return '제작 장비 등급 ↑ (' + lv + '단계)'; }, max: 10 },
    { id: 'camp', nm: '훈련소', ic: '🎯', desc: function (lv) { return '경험치 +' + lv * 10 + '%'; }, max: 20 },
    { id: 'shrine', nm: '회복의 성소', ic: '⛲', desc: function (lv) { return '쓰러진 뒤 회복 ' + Math.round((1 - restMul(lv)) * 100) + '% 빠름'; }, max: 10 }
  ];
  function restMul(lv) { return Math.max(0.3, 1 - lv * 0.08); }
  function buildCost(b, lv) { return Math.floor(150 * Math.pow(1.7, lv)); }

  var DEFAULT_CFG = {
    spawnMin: 10, gateCap: 3, tierW: [40, 30, 18, 9, 3], expMul: 1, goldMul: 1, monMul: 1, dropPct: 8, restSec: 60, capBonus: 0,
    shake: 1, hitstop: 1, particles: 1, sound: true
  };

  // ---------- 상태 ----------
  var S = null;
  function fresh() {
    return {
      v: 1, gold: 300, mats: { wood: 10, ore: 10, gem: 0 }, hunters: [], gate: [], items: [], town: { inn: 1, forge: 1, camp: 0, shrine: 0 },
      zone: 1, zoneKills: 0, bossDone: false, lastTick: Date.now(), nextSpawnAt: Date.now() + 20000,
      cfg: JSON.parse(JSON.stringify(DEFAULT_CFG)), stats: { kills: 0, arrivals: 0, goldEarned: 0 }, log: [], rate: 0, godSeen: false
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return fresh();
      var s = JSON.parse(raw);
      var f = fresh();
      Object.keys(f).forEach(function (k) { if (s[k] === undefined) s[k] = f[k]; });
      Object.keys(DEFAULT_CFG).forEach(function (k) { if (s.cfg[k] === undefined) s.cfg[k] = DEFAULT_CFG[k]; });
      s.hunters.forEach(function (h) { h.target = null; h.cd = 0; h.anim = 0; h.flash = 0; });
      return s;
    } catch (e) { return fresh(); }
  }
  var saveTimer = 0;
  function save() {
    S.lastTick = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }
  function addLog(txt) {
    var d = new Date(); var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    S.log.unshift({ t: hh, txt: txt });
    if (S.log.length > 80) S.log.length = 80;
    ui.dirty.log = true;
  }
  var toastTimer = 0;
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  // ---------- 생성 ----------
  function weightedTier(w) {
    var sum = 0; for (var i = 0; i < 5; i++) sum += w[i];
    var r = Math.random() * sum;
    for (var j = 0; j < 5; j++) { r -= w[j]; if (r < 0) return TIERS[j]; }
    return 'C';
  }
  function makeHunter(opt) {
    opt = opt || {};
    var cls = opt.cls || pick(Object.keys(CLASSES));
    var tier = opt.tier || weightedTier(S.cfg.tierW);
    var traits = [];
    var pool = TRAITS.slice();
    var n = ri(1, 2);
    while (traits.length < n && pool.length) { var t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; traits.push(t.nm); }
    var h = {
      id: uid(), name: opt.name || pick(NAMES), cls: cls, tier: tier, traits: traits, lv: 1, exp: 0,
      weapon: null, armor: null, status: 'town', auto: true, restUntil: 0, kills: 0, hp: 1,
      x: 30, cd: 0, anim: 0, flash: 0, target: null
    };
    recalc(h); h.hp = h.maxHp;
    return h;
  }
  function traitSum(h, key) { var s = 0; h.traits.forEach(function (nm) { var t = TRAITS.find(function (x) { return x.nm === nm; }); if (t && t[key]) s += t[key]; }); return s; }
  function recalc(h) {
    var c = CLASSES[h.cls], m = TIER_MUL[h.tier], g = Math.pow(1.07, h.lv - 1);
    h.maxHp = Math.round(100 * c.hp * m * g * (1 + traitSum(h, 'hp')) + (h.armor ? h.armor.hp : 0));
    h.atk = Math.round(10 * c.atk * m * g * (1 + traitSum(h, 'atk')) + (h.weapon ? h.weapon.atk : 0));
    h.def = Math.round(3 * c.def * m * g + (h.armor ? h.armor.def : 0)) * (1 + traitSum(h, 'def'));
    h.spd = c.spd * (1 + traitSum(h, 'spd'));
    h.crit = 5 + TIER_IDX[h.tier] * 3 + traitSum(h, 'crit');
    h.range = c.range;
    if (h.hp > h.maxHp) h.hp = h.maxHp;
  }
  function expNeed(lv) { return Math.floor(30 * Math.pow(lv, 1.5)); }
  function makeItem(opt) {
    opt = opt || {};
    var kind = opt.kind || (Math.random() < 0.65 ? 'weapon' : 'armor');
    var type = kind === 'armor' ? 'armor' : (opt.type || pick(['sword', 'bow', 'staff', 'mace']));
    var tier = opt.tier || weightedTier(opt.w || [45, 30, 16, 7, 2]);
    var z = opt.zone || S.zone;
    var m = TIER_MUL[tier] * (1 + (z - 1) * 0.18) * rnd(0.9, 1.15);
    var it = { id: uid(), kind: kind, type: type, tier: tier, name: TIER_PREFIX[tier] + ' ' + WEAPON_NOUN[type] };
    if (kind === 'weapon') it.atk = Math.round(6 * m);
    else { it.def = Math.round(3 * m); it.hp = Math.round(25 * m); }
    return it;
  }
  function sellPrice(it) { return Math.floor(20 * TIER_MUL[it.tier] * TIER_MUL[it.tier] * (1 + (S.zone - 1) * 0.1)); }
  function zoneInfo(z) { return ZONES[(z - 1) % ZONES.length]; }
  function zoneScale(z) { return Math.pow(1.32, z - 1) * S.cfg.monMul; }
  function makeMonster(boss) {
    var z = zoneInfo(S.zone), sc = zoneScale(S.zone);
    var k = boss ? 2 : ri(0, 2);
    var m = {
      id: uid(), nm: boss ? z.boss : z.mons[k], boss: !!boss, kind: k, color: z.color,
      maxHp: Math.round((boss ? 320 : 40 + k * 14) * sc), atk: Math.round((boss ? 14 : 5 + k * 2) * sc), def: Math.round(k * sc),
      spd: boss ? 0.7 : 0.9, gold: Math.round((boss ? 60 : 5 + k * 3) * sc), exp: Math.round((boss ? 90 : 8 + k * 4) * sc),
      x: field.w + 20 + Math.random() * 40, cd: Math.random(), anim: 0, flash: 0, r: boss ? 22 : 11 + k * 2
    };
    m.hp = m.maxHp;
    return m;
  }

  // ---------- 시뮬레이션 ----------
  var field = { w: 360, h: 230, ground: 0.72, mons: [], shots: [], fx: [], shake: 0, freeze: 0, spawnCd: 1, ctx: null, dpr: 1 };
  function capacity() { return 3 + S.town.inn + (S.cfg.capBonus | 0); }
  function hunting() { return S.hunters.filter(function (h) { return h.status === 'hunt'; }); }
  function tierFx(tier) { return 1 + TIER_IDX[tier] * 0.6; }

  function step(dt) {
    var now = Date.now();
    // 쓰러진 헌터 회복
    S.hunters.forEach(function (h) {
      if (h.status === 'town' && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.02 * dt);
      if (h.status === 'rest' && now >= h.restUntil) {
        h.hp = h.maxHp; h.status = h.auto ? 'hunt' : 'town'; h.x = 30; h.target = null;
        addLog('<b>' + esc(h.name) + '</b> 회복 완료' + (h.auto ? ', 다시 사냥터로' : ''));
        ui.dirty.hunters = true;
      }
    });
    var hs = hunting();
    var maxMon = S.bossDone ? 0 : Math.min(6, 3 + Math.floor(S.zone / 3));
    var bossTime = S.zoneKills >= ZONE_KILLS && !S.bossDone;
    if (hs.length) {
      field.spawnCd -= dt;
      if (bossTime) {
        if (!field.mons.some(function (m) { return m.boss; }) && field.mons.length === 0) { field.mons.push(makeMonster(true)); addLog('⚠️ <b>' + esc(zoneInfo(S.zone).boss) + '</b> 등장!'); }
      } else if (field.mons.length < maxMon && field.spawnCd <= 0) { field.mons.push(makeMonster(false)); field.spawnCd = rnd(0.8, 1.8); }
    }
    // 헌터 행동
    hs.forEach(function (h, i) {
      h.anim = Math.max(0, h.anim - dt); h.flash = Math.max(0, h.flash - dt);
      if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.004 * dt);
      var off = (i % 5) * 13; // 같은 사거리끼리 겹치지 않게 조금씩 뒤에 선다
      var tgt = nearest(field.mons, h.x);
      h.target = tgt;
      if (!tgt) { h.x = Math.min(h.x + 30 * dt, field.w * 0.45 + (h.cls === 'warrior' ? 30 : 0) - off); return; }
      var dist = tgt.x - h.x;
      if (dist > h.range - off) { h.x += 55 * dt; return; }
      h.cd -= dt * h.spd;
      if (h.cd <= 0) { h.cd = 1; attack(h, tgt); }
    });
    // 몬스터 행동
    field.mons.forEach(function (m) {
      m.anim = Math.max(0, m.anim - dt); m.flash = Math.max(0, m.flash - dt);
      var tgt = null, best = 1e9;
      hs.forEach(function (h) { var d = Math.abs(m.x - h.x); if (d < best) { best = d; tgt = h; } });
      if (!tgt) { m.x += 15 * dt; return; }
      if (m.x - tgt.x > 24) { m.x -= (m.boss ? 22 : 32) * dt; return; }
      m.cd -= dt * m.spd;
      if (m.cd <= 0) { m.cd = 1; monsterHit(m, tgt); }
    });
    // 투사체
    for (var i = field.shots.length - 1; i >= 0; i--) {
      var s = field.shots[i]; s.x += s.vx * dt; s.t += dt;
      if (s.x >= s.tx || s.t > 1.5) { field.shots.splice(i, 1); if (s.tgt && s.tgt.hp > 0) land(s.src, s.tgt, s.dmg, s.crit, s.type, s.tier); }
    }
    // 효과
    for (var j = field.fx.length - 1; j >= 0; j--) {
      var f = field.fx[j]; f.t += dt;
      if (f.kind === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; }
      if (f.kind === 'num') { f.y -= 28 * dt; }
      if (f.t > f.life) field.fx.splice(j, 1);
    }
    field.shake = Math.max(0, field.shake - dt * 10);
    // 정리: 죽은 몬스터, 사냥터에 없는 헌터
    field.mons = field.mons.filter(function (m) { return m.hp > 0; });
    if (!hs.length) { field.mons = []; field.shots = []; }
  }
  function nearest(list, x) { var b = null, d = 1e9; list.forEach(function (m) { if (m.hp <= 0) return; var dd = m.x - x; if (dd < d && dd > -40) { d = dd; b = m; } }); return b; }
  function attack(h, m) {
    h.anim = 0.25;
    var crit = Math.random() * 100 < h.crit;
    var dmg = Math.max(1, Math.round(h.atk * rnd(0.85, 1.15) - m.def * 0.5)) * (crit ? 2 : 1);
    var type = CLASSES[h.cls].weapon, tier = h.weapon ? h.weapon.tier : null;
    if (type === 'bow' || type === 'staff') {
      field.shots.push({ x: h.x + 10, y: 0, tx: m.x - 4, vx: type === 'bow' ? 420 : 300, t: 0, dmg: dmg, crit: crit, src: h, tgt: m, type: type, tier: tier });
      sound(type, tier, true);
    } else {
      setTimeout(function () { if (m.hp > 0) land(h, m, dmg, crit, type, tier); }, 90);
    }
    if (CLASSES[h.cls].heal) {
      var low = null; hunting().forEach(function (o) { if (o.hp < o.maxHp && (!low || o.hp / o.maxHp < low.hp / low.maxHp)) low = o; });
      if (low) { var amt = Math.round(h.atk * 0.6); low.hp = Math.min(low.maxHp, low.hp + amt); field.fx.push({ kind: 'num', x: low.x, y: gy() - 40, txt: '+' + amt, color: '#5ad17c', size: 11, t: 0, life: 0.9 }); }
    }
  }
  function gy() { return field.h * field.ground; }
  function land(h, m, dmg, crit, type, tier) {
    m.hp -= dmg; m.flash = 0.12;
    var power = (tier ? tierFx(tier) : 0.7) * (crit ? 1.5 : 1);
    var c = S.cfg;
    field.shake = Math.max(field.shake, 1.2 * power * c.shake);
    field.freeze = Math.max(field.freeze, 0.012 * power * c.hitstop);
    var n = Math.round(4 * power * c.particles);
    var col = tier ? TIER_COLOR[tier] : '#fff';
    for (var i = 0; i < n; i++) field.fx.push({ kind: 'spark', x: m.x, y: gy() - m.r, vx: rnd(-120, 120) * power, vy: rnd(-200, -40) * power, color: col, t: 0, life: rnd(0.3, 0.6) });
    field.fx.push({ kind: 'num', x: m.x + rnd(-6, 6), y: gy() - m.r - 16, txt: String(dmg) + (crit ? '!' : ''), color: crit ? '#f2b544' : '#fff', size: clamp(10 + Math.log(dmg + 1) * 2.2 + (crit ? 4 : 0), 10, 26), t: 0, life: 0.8 });
    if (type !== 'bow' && type !== 'staff') sound(type, tier, false);
    else sound(type, tier, false);
    if (m.hp <= 0) kill(h, m);
  }
  function monsterHit(m, h) {
    m.anim = 0.25;
    var dmg = Math.max(1, Math.round(m.atk * rnd(0.85, 1.15) - h.def * 0.5));
    h.hp -= dmg; h.flash = 0.12;
    field.fx.push({ kind: 'num', x: h.x, y: gy() - 36, txt: '-' + dmg, color: '#e6584f', size: 11, t: 0, life: 0.7 });
    if (h.hp <= 0) {
      h.hp = 0; h.status = 'rest'; h.target = null;
      h.restUntil = Date.now() + S.cfg.restSec * 1000 * restMul(S.town.shrine);
      addLog('<b>' + esc(h.name) + '</b> 쓰러짐 — ' + esc(m.nm) + '에게 당했다. 마을에서 회복 중');
      toast('💫 ' + h.name + ' 쓰러짐! 회복 중');
      ui.dirty.hunters = true;
    }
  }
  function kill(h, m) {
    var gold = Math.round(m.gold * S.cfg.goldMul * (1 + traitSum(h, 'gold')));
    S.gold += gold; S.stats.goldEarned += gold; S.stats.kills++; h.kills++;
    var expBase = m.exp * S.cfg.expMul * (1 + S.town.camp * 0.1);
    gainExp(h, expBase * (1 + traitSum(h, 'exp')));
    hunting().forEach(function (o) { if (o !== h) gainExp(o, expBase * 0.3 * (1 + traitSum(o, 'exp'))); });
    field.fx.push({ kind: 'num', x: m.x, y: gy() - m.r - 30, txt: '+' + gold + '🪙', color: '#f2b544', size: 11, t: 0, life: 1 });
    // 재료
    var z = S.zone;
    if (Math.random() < 0.35) S.mats.wood += ri(1, 2);
    if (Math.random() < 0.25) S.mats.ore += ri(1, 2);
    if (Math.random() < 0.03 + z * 0.005) S.mats.gem += 1;
    // 장비 드롭
    var dropP = (m.boss ? 100 : S.cfg.dropPct) / 100;
    if (Math.random() < dropP) {
      var w = [45 - z * 3, 30, 16 + z * 1.5, 7 + z, 2 + z * 0.5]; w[0] = Math.max(5, w[0]);
      if (m.boss) w = [0, 20, 40, 30, 10];
      var it = makeItem({ w: w });
      S.items.push(it);
      addLog('🎁 <b>' + esc(h.name) + '</b>이(가) <b>' + esc(it.name) + '</b>(' + TIER_LABEL[it.tier] + ') 획득');
      toast('🎁 ' + it.name + ' 획득!');
      ui.dirty.items = true;
    }
    if (m.boss) {
      S.bossDone = true;
      addLog('🏆 <b>' + esc(m.nm) + '</b> 처치! 다음 구역이 열렸다');
      toast('🏆 보스 처치! 다음 구역으로');
      setTimeout(function () { S.zone++; S.zoneKills = 0; S.bossDone = false; ui.dirty.hunters = true; save(); }, 1500);
    } else if (!S.bossDone && S.zoneKills < ZONE_KILLS) S.zoneKills++;
    ui.dirty.head = true;
  }
  function gainExp(h, e) {
    h.exp += e;
    var up = false;
    while (h.exp >= expNeed(h.lv)) { h.exp -= expNeed(h.lv); h.lv++; up = true; }
    if (up) { recalc(h); h.hp = h.maxHp; field.fx.push({ kind: 'num', x: h.x, y: gy() - 50, txt: 'LV UP!', color: '#4f9cf7', size: 14, t: 0, life: 1.2 }); addLog('⬆️ <b>' + esc(h.name) + '</b> Lv.' + h.lv + ' 달성'); ui.dirty.hunters = true; }
  }

  // 헌터 등장 (실시간 + 자리 비운 동안)
  function spawnTick(now) {
    var changed = false, iv = S.cfg.spawnMin * 60000;
    var guard = 0;
    while (S.nextSpawnAt <= now && guard++ < 50) {
      if (S.gate.length >= S.cfg.gateCap) { S.nextSpawnAt = now + iv; break; }
      var h = makeHunter();
      S.gate.push(h); S.stats.arrivals++; changed = true;
      S.nextSpawnAt += iv;
      if (S.nextSpawnAt < now - iv * 50) S.nextSpawnAt = now + iv;
    }
    if (changed) {
      var last = S.gate[S.gate.length - 1];
      addLog('🚪 새 헌터 <b>' + esc(last.name) + '</b>(' + CLASSES[last.cls].nm + ' ' + TIER_LABEL[last.tier] + ') 이(가) 마을 입구에 도착');
      toast('🚪 새 헌터 ' + last.name + ' 도착!');
      ui.dirty.gate = true;
    }
    return changed;
  }
  function offlineCatchUp() {
    var now = Date.now(), elapsed = now - S.lastTick;
    if (elapsed < 120000) return;
    var mins = Math.min(elapsed, 8 * 3600000) / 60000;
    var before = S.gate.length;
    spawnTick(now);
    var arrived = S.gate.length - before;
    var gold = Math.floor(S.rate * mins * 0.5);
    if (hunting().length === 0) gold = 0;
    S.gold += gold;
    var hrs = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    var txt = (hrs ? hrs + '시간 ' : '') + mm + '분 동안\n';
    txt += arrived ? '헌터 ' + arrived + '명이 입구에 왔고\n' : '새 헌터는 없었고\n';
    txt += gold ? '헌터들이 🪙 ' + fmt(gold) + ' 을 벌어 왔습니다.' : '헌터들은 쉬고 있었습니다.';
    $('#welcomeText').textContent = txt;
    $('#welcome').hidden = false;
  }
  // 골드 수입률(분당) 추적 — 자리 비운 동안 계산에 쓴다
  var rateWin = { gold: 0, t: 0 };
  function trackRate(dt) {
    rateWin.t += dt;
    if (rateWin.t >= 60) { S.rate = S.rate * 0.5 + (S.stats.goldEarned - rateWin.gold) * 0.5; rateWin.gold = S.stats.goldEarned; rateWin.t = 0; }
  }

  // ---------- 소리 ----------
  var AC = null;
  function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function sound(type, tier, launch) {
    if (!S.cfg.sound || !AC) return;
    var t = AC.currentTime, g = AC.createGain(), vol = (0.05 + (tier ? TIER_IDX[tier] * 0.03 : 0)) * (launch ? 0.4 : 1);
    g.connect(AC.destination);
    var o = AC.createOscillator();
    var f = { sword: 520, bow: 880, staff: 300, mace: 160 }[type] || 400;
    if (launch) f *= 1.6;
    o.type = { sword: 'square', bow: 'triangle', staff: 'sine', mace: 'sawtooth' }[type] || 'square';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * (type === 'staff' ? 2.2 : 0.4)), t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14 + (tier ? TIER_IDX[tier] * 0.02 : 0));
    o.connect(g); o.start(t); o.stop(t + 0.25);
    if (!launch && (type === 'sword' || type === 'mace')) { // 타격 노이즈
      var len = AC.sampleRate * 0.08, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var n = AC.createBufferSource(), ng = AC.createGain(); n.buffer = buf; ng.gain.value = vol * 1.5; n.connect(ng); ng.connect(AC.destination); n.start(t);
    }
  }

  // ---------- 그리기 ----------
  function resizeCanvas() {
    var cv = $('#field'), r = cv.getBoundingClientRect();
    field.dpr = Math.min(2, window.devicePixelRatio || 1);
    field.w = Math.max(200, r.width); field.h = r.height || 230;
    cv.width = Math.round(field.w * field.dpr); cv.height = Math.round(field.h * field.dpr);
    field.ctx = cv.getContext('2d');
  }
  function draw() {
    var ctx = field.ctx; if (!ctx) return;
    ctx.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
    ctx.clearRect(0, 0, field.w, field.h);
    var sx = field.shake > 0.05 ? rnd(-field.shake, field.shake) * 3 : 0, sy = field.shake > 0.05 ? rnd(-field.shake, field.shake) * 3 : 0;
    ctx.translate(sx, sy);
    var g = gy(), z = zoneInfo(S.zone);
    // 배경: 하늘 + 땅
    ctx.fillStyle = z.color; ctx.globalAlpha = 0.18; ctx.fillRect(-10, g, field.w + 20, field.h); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(-10, g, field.w + 20, 2);
    // 마을(왼쪽)
    ctx.fillStyle = '#3a3f52'; ctx.fillRect(2, g - 34, 26, 34); ctx.fillStyle = '#5b4636'; ctx.beginPath(); ctx.moveTo(-2, g - 34); ctx.lineTo(15, g - 50); ctx.lineTo(32, g - 34); ctx.fill();
    ctx.fillStyle = '#f2b544'; ctx.fillRect(10, g - 20, 7, 9);
    // 헌터
    hunting().forEach(function (h) { drawHunter(ctx, h, h.x, g, 1); });
    S.hunters.forEach(function (h, i) { if (h.status === 'town') drawHunter(ctx, h, 44 + (i % 3) * 14, g + 2, 0.6, true); });
    // 몬스터
    field.mons.forEach(function (m) { drawMonster(ctx, m, g); });
    // 투사체
    field.shots.forEach(function (s) {
      var col = s.tier ? TIER_COLOR[s.tier] : '#ddd';
      ctx.strokeStyle = col; ctx.lineWidth = s.tier ? 1.5 + TIER_IDX[s.tier] * 0.5 : 1.5;
      if (s.type === 'bow') { ctx.beginPath(); ctx.moveTo(s.x - 12, g - 22); ctx.lineTo(s.x, g - 22); ctx.stroke(); }
      else { ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(s.x, g - 24 + Math.sin(s.t * 20) * 3, 3 + (s.tier ? TIER_IDX[s.tier] : 0), 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    });
    // 효과
    field.fx.forEach(function (f) {
      var a = 1 - f.t / f.life;
      if (f.kind === 'spark') { ctx.globalAlpha = a; ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, 3, 3); }
      else { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.font = 'bold ' + f.size + 'px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.txt, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y); }
      ctx.globalAlpha = 1;
    });
    if (!hunting().length) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('사냥 중인 헌터가 없어요. 헌터를 받아들이고 사냥을 보내 보세요.', field.w / 2, g - 60); }
  }
  function drawHunter(ctx, h, x, g, sc, idle) {
    var c = CLASSES[h.cls], a = h.anim > 0 ? Math.sin((0.25 - h.anim) / 0.25 * Math.PI) : 0;
    var lunge = a * 7 * sc, bob = idle ? Math.sin(Date.now() / 400 + x) * 1.2 : 0;
    ctx.save(); ctx.translate(x + lunge, g + bob); ctx.scale(sc, sc);
    var arm = h.armor, armCol = arm ? TIER_COLOR[arm.tier] : null;
    if (arm && arm.tier === 'SP') { ctx.shadowColor = armCol; ctx.shadowBlur = 14; }
    else if (arm && arm.tier === 'S') { ctx.shadowColor = armCol; ctx.shadowBlur = 7; }
    // 몸
    ctx.fillStyle = h.flash > 0 ? '#fff' : c.color;
    roundRect(ctx, -7, -24, 14, 16, 4); ctx.fill();
    if (arm) { ctx.fillStyle = armCol; ctx.globalAlpha = 0.55; roundRect(ctx, -7, -24, 14, 16, 4); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = armCol; ctx.lineWidth = 1 + TIER_IDX[arm.tier] * 0.5; roundRect(ctx, -7, -24, 14, 16, 4); ctx.stroke(); if (TIER_IDX[arm.tier] >= 2) { ctx.fillStyle = armCol; ctx.fillRect(-10, -25, 4, 5); ctx.fillRect(6, -25, 4, 5); } }
    ctx.shadowBlur = 0;
    // 머리
    ctx.fillStyle = h.flash > 0 ? '#fff' : '#f3d9b1'; ctx.beginPath(); ctx.arc(0, -31, 7, 0, 7); ctx.fill();
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(0, -33, 7, Math.PI, 0); ctx.fill();
    // 다리
    ctx.fillStyle = '#2b2f3c'; ctx.fillRect(-6, -8, 4, 8); ctx.fillRect(2, -8, 4, 8);
    // 무기 (오른손, 공격 중 회전)
    ctx.translate(7, -17); ctx.rotate(-0.6 + a * 1.6);
    drawWeapon(ctx, c.weapon, h.weapon ? h.weapon.tier : null);
    ctx.restore();
  }
  function drawWeapon(ctx, type, tier) {
    var col = tier ? TIER_COLOR[tier] : '#8a8f9c', ti = tier ? TIER_IDX[tier] : -1, len = 12 + (ti + 1) * 2.5;
    if (ti >= 3) { ctx.shadowColor = col; ctx.shadowBlur = 8 + (ti - 3) * 8; }
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round';
    if (type === 'sword') { ctx.lineWidth = 2 + ti * 0.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -len); ctx.stroke(); ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-2, 3); ctx.lineTo(3, -3); ctx.stroke(); }
    else if (type === 'bow') { ctx.lineWidth = 1.5 + ti * 0.3; ctx.beginPath(); ctx.arc(2, -2, len * 0.7, -1.9, 0.9); ctx.stroke(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(2 + Math.cos(-1.9) * len * 0.7, -2 + Math.sin(-1.9) * len * 0.7); ctx.lineTo(2 + Math.cos(0.9) * len * 0.7, -2 + Math.sin(0.9) * len * 0.7); ctx.stroke(); }
    else if (type === 'staff') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(len * 0.7, -len * 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(len * 0.75, -len * 0.75, 3 + ti, 0, 7); ctx.fill(); }
    else if (type === 'mace') { ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.6, -len * 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(len * 0.65, -len * 0.65, 4 + ti * 0.8, 0, 7); ctx.fill(); }
    ctx.shadowBlur = 0;
  }
  function drawMonster(ctx, m, g) {
    var a = m.anim > 0 ? Math.sin((0.25 - m.anim) / 0.25 * Math.PI) : 0;
    ctx.save(); ctx.translate(m.x - a * 6, g);
    ctx.fillStyle = m.flash > 0 ? '#fff' : m.color;
    if (m.kind === 0 && !m.boss) { ctx.beginPath(); ctx.ellipse(0, -m.r * 0.8, m.r * 1.2, m.r * 0.8, 0, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, -m.r, m.r, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-m.r * 0.7, -m.r * 1.6); ctx.lineTo(-m.r * 0.4, -m.r * 2.2); ctx.lineTo(-m.r * 0.1, -m.r * 1.7); ctx.fill(); ctx.beginPath(); ctx.moveTo(m.r * 0.7, -m.r * 1.6); ctx.lineTo(m.r * 0.4, -m.r * 2.2); ctx.lineTo(m.r * 0.1, -m.r * 1.7); ctx.fill(); }
    if (m.boss) { ctx.fillStyle = '#f2b544'; ctx.beginPath(); ctx.moveTo(-10, -m.r * 2.1); ctx.lineTo(-6, -m.r * 2.6); ctx.lineTo(-2, -m.r * 2.1); ctx.lineTo(2, -m.r * 2.6); ctx.lineTo(6, -m.r * 2.1); ctx.lineTo(10, -m.r * 2.6); ctx.lineTo(10, -m.r * 2.0); ctx.fill(); }
    // 눈
    ctx.fillStyle = '#1b1f2a'; ctx.beginPath(); ctx.arc(-m.r * 0.35, -m.r, 1.6, 0, 7); ctx.arc(m.r * 0.35, -m.r, 1.6, 0, 7); ctx.fill();
    // 체력
    var w = m.boss ? 60 : 24; ctx.fillStyle = '#0f1218'; ctx.fillRect(-w / 2, -m.r * 2 - 10, w, 4); ctx.fillStyle = m.boss ? '#e6584f' : '#5ad17c'; ctx.fillRect(-w / 2, -m.r * 2 - 10, w * clamp(m.hp / m.maxHp, 0, 1), 4);
    if (m.boss) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(m.nm, 0, -m.r * 2 - 14); }
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawPortrait(cv, h) {
    var ctx = cv.getContext('2d'), d = 2; cv.width = 72 * d; cv.height = 72 * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, 72, 72);
    var fake = { cls: h.cls, armor: h.armor, weapon: h.weapon, anim: 0, flash: 0 };
    drawHunter(ctx, fake, 36, 68, 1.6, false);
  }

  // ---------- 메인 루프 ----------
  var last = 0, acc = 0, uiTick = 0, secTick = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000); last = ts;
    if (field.freeze > 0) { field.freeze -= dt; draw(); return; }
    acc += dt;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    trackRate(dt);
    draw();
    uiTick += dt; secTick += dt;
    if (uiTick >= 0.5) { uiTick = 0; refreshLive(); }
    if (secTick >= 1) {
      secTick = 0; spawnTick(Date.now()); renderTimer();
      if (ui.dirty.gate) renderGate(); if (ui.dirty.hunters) renderHunters(); if (ui.dirty.items) renderItems(); if (ui.dirty.log) renderLog(); if (ui.dirty.head) renderHead();
      if ((saveTimer = (saveTimer + 1) % 5) === 0) save();
    }
  }

  // ---------- 화면(DOM) ----------
  var ui = { dirty: { gate: true, hunters: true, items: true, town: true, log: true, head: true }, tab: 'hunters', sheetHunter: null, pickSlot: null };
  function tierTag(t) { return '<span class="tier ' + t + '">' + TIER_LABEL[t] + '</span>'; }
  function renderHead() {
    ui.dirty.head = false;
    $('#gold').textContent = '🪙 ' + fmt(S.gold);
    $('#mats').textContent = '🪵 ' + S.mats.wood + ' · ⛏️ ' + S.mats.ore + ' · 💎 ' + S.mats.gem;
    var z = zoneInfo(S.zone);
    $('#zoneLabel').textContent = z.ic + ' ' + S.zone + '구역 · ' + z.nm;
    $('#zoneProg').textContent = S.zoneKills >= ZONE_KILLS ? (S.bossDone ? '이동 중…' : '👑 보스!') : S.zoneKills + ' / ' + ZONE_KILLS;
    $('#huntInfo').textContent = '사냥 중인 헌터 ' + hunting().length + '명';
    $('#hunterCount').textContent = '헌터 ' + S.hunters.length + ' / ' + capacity();
    $('#itemCount').textContent = '장비 ' + S.items.length + '개';
    $('#soundBtn').textContent = S.cfg.sound ? '🔊 소리' : '🔇 소리';
  }
  function renderTimer() {
    var left = Math.max(0, S.nextSpawnAt - Date.now());
    var el = $('#spawnTimer');
    if (S.gate.length >= S.cfg.gateCap) el.textContent = '입구가 꽉 찼어요';
    else { var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000); el.textContent = '다음 헌터까지 ' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  }
  function renderGate() {
    ui.dirty.gate = false;
    $('#gateList').innerHTML = S.gate.map(function (h) {
      var c = CLASSES[h.cls];
      return '<div class="gate-card" data-id="' + h.id + '"><div class="nm">' + c.ic + ' ' + esc(h.name) + ' ' + tierTag(h.tier) + '</div>' +
        '<div class="sub">' + c.nm + ' · ' + h.traits.map(esc).join(', ') + '</div>' +
        '<div class="sub">❤️' + h.maxHp + ' ⚔️' + h.atk + ' 🛡️' + Math.round(h.def) + '</div>' +
        '<div class="row"><button class="btn primary" data-act="accept">받아들이기</button><button class="btn" data-act="reject">돌려보내기</button></div></div>';
    }).join('');
  }
  function statusTag(h) {
    if (h.status === 'hunt') return '<span class="status hunt">사냥 중</span>';
    if (h.status === 'rest') return '<span class="status rest">회복 중 ' + Math.max(0, Math.ceil((h.restUntil - Date.now()) / 1000)) + '초</span>';
    return '<span class="status">마을에서 쉼</span>';
  }
  function renderHunters() {
    ui.dirty.hunters = false; renderHead();
    $('#hunterList').innerHTML = S.hunters.map(function (h) {
      var c = CLASSES[h.cls];
      return '<div class="item tap" data-id="' + h.id + '"><div class="ic" style="background:' + c.color + '22">' + c.ic + '</div><div class="body">' +
        '<div class="nm">' + esc(h.name) + ' ' + tierTag(h.tier) + ' <span class="sub">Lv.' + h.lv + '</span> <span class="st">' + statusTag(h) + '</span></div>' +
        '<div class="sub">' + c.nm + ' · ' + (h.weapon ? WEAPON_IC[h.weapon.type] + esc(h.weapon.name) : '맨손') + ' · ' + (h.armor ? '🛡️' + esc(h.armor.name) : '천옷') + '</div>' +
        '<div class="bar"><i class="hp" style="width:' + Math.round(h.hp / h.maxHp * 100) + '%"></i></div>' +
        '<div class="bar exp"><i class="exp" style="width:' + Math.round(h.exp / expNeed(h.lv) * 100) + '%"></i></div></div></div>';
    }).join('');
  }
  function refreshLive() {
    var list = $('#hunterList');
    S.hunters.forEach(function (h) {
      var el = list.querySelector('[data-id="' + h.id + '"]'); if (!el) return;
      el.querySelector('.hp').style.width = Math.round(h.hp / h.maxHp * 100) + '%';
      el.querySelector('.exp').style.width = Math.round(h.exp / expNeed(h.lv) * 100) + '%';
      el.querySelector('.st').innerHTML = statusTag(h);
    });
    $('#huntInfo').textContent = '사냥 중인 헌터 ' + hunting().length + '명';
    $('#zoneProg').textContent = S.zoneKills >= ZONE_KILLS ? (S.bossDone ? '이동 중…' : '👑 보스!') : S.zoneKills + ' / ' + ZONE_KILLS;
    $('#gold').textContent = '🪙 ' + fmt(S.gold);
    $('#mats').textContent = '🪵 ' + S.mats.wood + ' · ⛏️ ' + S.mats.ore + ' · 💎 ' + S.mats.gem;
    if (ui.sheetHunter && !$('#sheet').hidden) { var sh = $('#sheetHp'); if (sh) sh.textContent = h2hp(ui.sheetHunter); }
  }
  function h2hp(h) { return Math.round(h.hp) + ' / ' + h.maxHp; }
  function itemDesc(it) { return it.kind === 'weapon' ? '⚔️ +' + it.atk : '🛡️ +' + it.def + ' ❤️ +' + it.hp; }
  function renderItems() {
    ui.dirty.items = false; renderHead();
    var sorted = S.items.slice().sort(function (a, b) { return TIER_IDX[b.tier] - TIER_IDX[a.tier]; });
    $('#itemList').innerHTML = sorted.map(function (it) {
      return '<div class="item" data-id="' + it.id + '"><div class="ic">' + WEAPON_IC[it.type] + '</div><div class="body"><div class="nm">' + esc(it.name) + ' ' + tierTag(it.tier) + '</div>' +
        '<div class="sub">' + itemDesc(it) + (it.kind === 'weapon' ? ' · ' + clsForWeapon(it.type) + '용' : ' · 모두') + '</div></div>' +
        '<button class="btn" data-act="sell">🪙 ' + fmt(sellPrice(it)) + ' 팔기</button></div>';
    }).join('');
    $('#craftBtn').textContent = '🔨 만들기 (🪙' + fmt(craftCost().gold) + ' 🪵' + craftCost().wood + ' ⛏️' + craftCost().ore + ')';
  }
  function clsForWeapon(type) { for (var k in CLASSES) if (CLASSES[k].weapon === type) return CLASSES[k].nm; return ''; }
  function craftCost() { return { gold: 80 * S.zone + 40 * S.town.forge, wood: 4 + S.zone, ore: 4 + S.zone }; }
  function craft() {
    var c = craftCost();
    if (S.gold < c.gold || S.mats.wood < c.wood || S.mats.ore < c.ore) return toast('재료가 모자라요');
    S.gold -= c.gold; S.mats.wood -= c.wood; S.mats.ore -= c.ore;
    var f = S.town.forge, w = [Math.max(5, 50 - f * 6), 30, 12 + f * 3, 5 + f * 2, 1 + f];
    if (S.mats.gem > 0 && Math.random() < 0.5) { S.mats.gem--; w[4] += 15; }
    var it = makeItem({ w: w }); S.items.push(it);
    addLog('🔨 대장간에서 <b>' + esc(it.name) + '</b>(' + TIER_LABEL[it.tier] + ') 제작');
    toast('🔨 ' + it.name + ' 완성!');
    ui.dirty.items = true; renderItems();
  }
  function renderTown() {
    ui.dirty.town = false;
    $('#townList').innerHTML = BUILDINGS.map(function (b) {
      var lv = S.town[b.id], cost = buildCost(b, lv), maxed = lv >= b.max;
      return '<div class="item" data-id="' + b.id + '"><div class="ic">' + b.ic + '</div><div class="body"><div class="nm">' + b.nm + ' <span class="sub">Lv.' + lv + '</span></div><div class="sub">' + b.desc(lv) + (maxed ? '' : ' → ' + b.desc(lv + 1)) + '</div></div>' +
        '<button class="btn" data-act="up" ' + (maxed || S.gold < cost ? 'disabled' : '') + '>' + (maxed ? '최대' : '🪙 ' + fmt(cost)) + '</button></div>';
    }).join('') + '<div class="item"><div class="ic">📊</div><div class="body"><div class="nm">마을 기록</div><div class="sub">처치 ' + fmt(S.stats.kills) + ' · 방문 헌터 ' + S.stats.arrivals + ' · 번 돈 🪙' + fmt(S.stats.goldEarned) + '</div></div></div>';
  }
  function renderLog() {
    ui.dirty.log = false;
    $('#logList').innerHTML = S.log.map(function (l) { return '<div>' + l.t + ' ' + l.txt + '</div>'; }).join('') || '<div>아직 기록이 없어요.</div>';
  }
  function renderAll() { renderHead(); renderGate(); renderHunters(); renderItems(); renderTown(); renderLog(); renderTimer(); }

  // 헌터 상세 시트
  function openSheet(h) {
    ui.sheetHunter = h; ui.pickSlot = null;
    var c = CLASSES[h.cls];
    var html = '<div class="h-head"><canvas id="portrait" width="144" height="144"></canvas><div><div class="nm">' + esc(h.name) + ' ' + tierTag(h.tier) + '</div><div class="sub">' + c.nm + ' · Lv.' + h.lv + ' · 처치 ' + h.kills + '</div><div class="sub">' + statusTag(h) + '</div></div></div>' +
      '<div class="traits">' + h.traits.map(function (nm) { var t = TRAITS.find(function (x) { return x.nm === nm; }); return '<span class="trait ' + (t && t.good ? 'good' : 'bad') + '">' + esc(nm) + '</span>'; }).join('') + '</div>' +
      '<div class="stats"><div>체력<b id="sheetHp">' + h2hp(h) + '</b></div><div>공격<b>' + h.atk + '</b></div><div>방어<b>' + Math.round(h.def) + '</b></div><div>속도<b>' + h.spd.toFixed(2) + '</b></div><div>치명타<b>' + h.crit + '%</b></div><div>경험치<b>' + Math.floor(h.exp) + '/' + expNeed(h.lv) + '</b></div></div>' +
      '<div class="slot" data-slot="weapon"><div><div>' + WEAPON_IC[c.weapon] + ' 무기</div><div class="sub">' + (h.weapon ? esc(h.weapon.name) + ' (' + TIER_LABEL[h.weapon.tier] + ') ' + itemDesc(h.weapon) : '맨손') + '</div></div><button class="btn" data-act="pick" data-slot="weapon">바꾸기</button></div>' +
      '<div class="slot" data-slot="armor"><div><div>🛡️ 갑옷</div><div class="sub">' + (h.armor ? esc(h.armor.name) + ' (' + TIER_LABEL[h.armor.tier] + ') ' + itemDesc(h.armor) : '천옷') + '</div></div><button class="btn" data-act="pick" data-slot="armor">바꾸기</button></div>' +
      '<div id="pickList" class="pick" hidden></div>' +
      '<div class="row"><button class="btn primary" data-act="toggle">' + (h.status === 'hunt' || (h.status === 'rest' && h.auto) ? '🏠 마을에서 쉬게 하기' : '⚔️ 사냥 보내기') + '</button><button class="btn danger" data-act="dismiss">내보내기</button><button class="btn" data-close>닫기</button></div>';
    $('#sheetContent').innerHTML = html;
    $('#sheet').hidden = false;
    drawPortrait($('#portrait'), h);
  }
  function showPick(slot) {
    var h = ui.sheetHunter, el = $('#pickList'); ui.pickSlot = slot;
    var list = S.items.filter(function (it) { return slot === 'weapon' ? (it.kind === 'weapon' && it.type === CLASSES[h.cls].weapon) : it.kind === 'armor'; })
      .sort(function (a, b) { return TIER_IDX[b.tier] - TIER_IDX[a.tier]; });
    el.hidden = false;
    el.innerHTML = '<div class="item tap" data-pick="none"><div class="ic">✋</div><div class="body"><div class="nm">해제</div></div></div>' +
      list.map(function (it) { return '<div class="item tap" data-pick="' + it.id + '"><div class="ic">' + WEAPON_IC[it.type] + '</div><div class="body"><div class="nm">' + esc(it.name) + ' ' + tierTag(it.tier) + '</div><div class="sub">' + itemDesc(it) + '</div></div></div>'; }).join('') +
      (list.length ? '' : '<div class="sub">맞는 장비가 없어요. 사냥에서 줍거나 대장간에서 만들어 보세요.</div>');
  }
  function equip(h, slot, id) {
    var cur = h[slot];
    if (cur) { S.items.push(cur); h[slot] = null; }
    if (id !== 'none') {
      var i = S.items.findIndex(function (it) { return it.id === id; });
      if (i >= 0) { h[slot] = S.items.splice(i, 1)[0]; }
    }
    recalc(h);
    h.flash = 0.2;
    for (var k = 0; k < 14; k++) field.fx.push({ kind: 'spark', x: h.x, y: gy() - 20, vx: rnd(-90, 90), vy: rnd(-160, -30), color: h[slot] ? TIER_COLOR[h[slot].tier] : '#fff', t: 0, life: 0.6 });
    addLog('🧷 <b>' + esc(h.name) + '</b> ' + (slot === 'weapon' ? '무기' : '갑옷') + ' → ' + (h[slot] ? esc(h[slot].name) : '해제'));
    ui.dirty.items = true; ui.dirty.hunters = true; renderHunters(); renderItems();
    openSheet(h);
  }
  function acceptHunter(id) {
    var i = S.gate.findIndex(function (h) { return h.id === id; }); if (i < 0) return;
    if (S.hunters.length >= capacity()) return toast('숙소가 꽉 찼어요. 숙소를 올리거나 헌터를 내보내세요');
    var h = S.gate.splice(i, 1)[0]; h.status = 'hunt'; h.x = 30; S.hunters.push(h);
    addLog('🤝 <b>' + esc(h.name) + '</b> 합류! 바로 사냥터로');
    toast('🤝 ' + h.name + ' 합류!');
    ui.dirty.gate = true; ui.dirty.hunters = true; renderGate(); renderHunters(); save();
  }
  function rejectHunter(id) {
    var i = S.gate.findIndex(function (h) { return h.id === id; }); if (i < 0) return;
    var h = S.gate.splice(i, 1)[0];
    addLog('👋 <b>' + esc(h.name) + '</b> 돌려보냄');
    ui.dirty.gate = true; renderGate(); save();
  }

  // ---------- 신 모드 ----------
  var godTaps = [];
  function openGod() {
    var c = S.cfg;
    $('#gSpawnMin').value = c.spawnMin; $('#gGateCap').value = c.gateCap; $('#gTierW').value = c.tierW.join(',');
    $('#gExpMul').value = c.expMul; $('#gGoldMul').value = c.goldMul; $('#gMonMul').value = c.monMul; $('#gDrop').value = c.dropPct; $('#gRest').value = c.restSec; $('#gCapBonus').value = c.capBonus;
    $('#gShake').value = c.shake; $('#gHitstop').value = c.hitstop; $('#gParticles').value = c.particles;
    $('#gData').value = '';
    $('#god').hidden = false;
    if (!S.godSeen) { S.godSeen = true; addLog('✨ 신 모드가 열렸다'); }
  }
  function applyGod() {
    var c = S.cfg, num = function (id, min, def) { var v = parseFloat($(id).value); return isNaN(v) ? def : Math.max(min, v); };
    c.spawnMin = num('#gSpawnMin', 0.1, 10); c.gateCap = Math.round(num('#gGateCap', 1, 3));
    var w = $('#gTierW').value.split(',').map(function (x) { return Math.max(0, parseFloat(x) || 0); });
    if (w.length === 5 && w.some(function (x) { return x > 0; })) c.tierW = w;
    c.expMul = num('#gExpMul', 0.1, 1); c.goldMul = num('#gGoldMul', 0.1, 1); c.monMul = num('#gMonMul', 0.1, 1); c.dropPct = clamp(num('#gDrop', 0, 8), 0, 100); c.restSec = num('#gRest', 0, 60); c.capBonus = Math.round(num('#gCapBonus', 0, 0));
    c.shake = num('#gShake', 0, 1); c.hitstop = num('#gHitstop', 0, 1); c.particles = num('#gParticles', 0, 1);
    var iv = c.spawnMin * 60000; if (S.nextSpawnAt - Date.now() > iv) S.nextSpawnAt = Date.now() + iv;
    S.hunters.forEach(recalc);
    save(); renderAll(); toast('✨ 규칙을 바꿨습니다');
  }
  function fillGodSelects() {
    $('#gHCls').innerHTML = Object.keys(CLASSES).map(function (k) { return '<option value="' + k + '">' + CLASSES[k].nm + '</option>'; }).join('');
    var tiers = TIERS.map(function (t) { return '<option value="' + t + '">' + TIER_LABEL[t] + '</option>'; }).join('');
    $('#gHTier').innerHTML = tiers; $('#gITier').innerHTML = tiers;
    $('#gIKind').innerHTML = ['sword', 'bow', 'staff', 'mace', 'armor'].map(function (t) { return '<option value="' + t + '">' + WEAPON_IC[t] + ' ' + WEAPON_NOUN[t] + '</option>'; }).join('');
  }

  // ---------- 이벤트 ----------
  function bind() {
    document.addEventListener('pointerdown', function () { audio(); }, { once: true });
    $('#title').addEventListener('click', function () {
      var now = Date.now(); godTaps.push(now); godTaps = godTaps.filter(function (t) { return now - t < 3000; });
      if (godTaps.length >= 7) { godTaps = []; openGod(); }
      else if (godTaps.length >= 4) toast('✨ ' + (7 - godTaps.length) + '번 더…');
    });
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x === b); });
        document.querySelectorAll('.pane').forEach(function (p) { p.classList.toggle('on', p.id === 'tab-' + b.dataset.tab); });
        ui.tab = b.dataset.tab; if (ui.tab === 'town') renderTown(); if (ui.tab === 'log') renderLog(); if (ui.tab === 'items') renderItems();
      });
    });
    $('#gateList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var id = b.closest('[data-id]').dataset.id;
      if (b.dataset.act === 'accept') acceptHunter(id); else rejectHunter(id);
    });
    $('#hunterList').addEventListener('click', function (e) {
      var el = e.target.closest('[data-id]'); if (!el) return;
      var h = S.hunters.find(function (x) { return x.id === el.dataset.id; }); if (h) openSheet(h);
    });
    $('#itemList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="sell"]'); if (!b) return;
      var id = b.closest('[data-id]').dataset.id, i = S.items.findIndex(function (it) { return it.id === id; }); if (i < 0) return;
      var it = S.items.splice(i, 1)[0]; S.gold += sellPrice(it); addLog('💰 <b>' + esc(it.name) + '</b> 판매 +' + sellPrice(it)); renderItems(); save();
    });
    $('#craftBtn').addEventListener('click', craft);
    $('#townList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="up"]'); if (!b) return;
      var id = b.closest('[data-id]').dataset.id, bd = BUILDINGS.find(function (x) { return x.id === id; }), lv = S.town[id], cost = buildCost(bd, lv);
      if (lv >= bd.max || S.gold < cost) return;
      S.gold -= cost; S.town[id]++; addLog('🏗️ <b>' + bd.nm + '</b> Lv.' + S.town[id] + ' 완성'); toast('🏗️ ' + bd.nm + ' Lv.' + S.town[id]);
      S.hunters.forEach(recalc); renderTown(); renderHead(); save();
    });
    $('#soundBtn').addEventListener('click', function () { S.cfg.sound = !S.cfg.sound; audio(); renderHead(); save(); });
    $('#welcomeOk').addEventListener('click', function () { $('#welcome').hidden = true; });
    document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('.sheet').hidden = true; }); });
    $('#sheetContent').addEventListener('click', function (e) {
      var h = ui.sheetHunter; if (!h) return;
      var p = e.target.closest('[data-pick]'); if (p) { equip(h, ui.pickSlot, p.dataset.pick); save(); return; }
      var b = e.target.closest('[data-act]'); if (!b) { if (e.target.closest('[data-close]')) $('#sheet').hidden = true; return; }
      var act = b.dataset.act;
      if (act === 'pick') showPick(b.dataset.slot);
      else if (act === 'toggle') {
        if (h.status === 'hunt') { h.status = 'town'; h.auto = false; h.target = null; addLog('🏠 <b>' + esc(h.name) + '</b> 마을에서 휴식'); }
        else if (h.status === 'rest') { h.auto = !h.auto; }
        else { h.status = 'hunt'; h.auto = true; h.x = 30; addLog('⚔️ <b>' + esc(h.name) + '</b> 사냥터로 출발'); }
        renderHunters(); openSheet(h); save();
      } else if (act === 'dismiss') {
        if (!confirm(h.name + ' 을(를) 마을에서 내보낼까요? 장비는 창고로 돌아옵니다.')) return;
        if (h.weapon) S.items.push(h.weapon); if (h.armor) S.items.push(h.armor);
        S.hunters = S.hunters.filter(function (x) { return x !== h; });
        addLog('👋 <b>' + esc(h.name) + '</b> 마을을 떠남');
        $('#sheet').hidden = true; renderHunters(); renderItems(); save();
      } else if (b.hasAttribute('data-close')) $('#sheet').hidden = true;
    });
    // 신 모드
    $('#gApply').addEventListener('click', applyGod);
    $('#gCallNow').addEventListener('click', function () {
      if (S.gate.length >= S.cfg.gateCap) return toast('입구가 꽉 찼어요');
      var h = makeHunter(); S.gate.push(h); S.stats.arrivals++;
      addLog('📯 신의 부름으로 <b>' + esc(h.name) + '</b> 도착'); toast('📯 ' + h.name + ' 도착!'); renderGate(); save();
    });
    $('#gMakeHunter').addEventListener('click', function () {
      if (S.gate.length >= S.cfg.gateCap) return toast('입구가 꽉 찼어요');
      var h = makeHunter({ name: $('#gHName').value.trim() || null, cls: $('#gHCls').value, tier: $('#gHTier').value });
      S.gate.push(h); S.stats.arrivals++; addLog('✨ 신이 빚은 헌터 <b>' + esc(h.name) + '</b> 도착'); toast('✨ ' + h.name + ' 도착!'); renderGate(); save();
    });
    $('#gMakeItem').addEventListener('click', function () {
      var t = $('#gIKind').value, it = makeItem({ kind: t === 'armor' ? 'armor' : 'weapon', type: t, tier: $('#gITier').value });
      S.items.push(it); addLog('✨ 신이 빚은 <b>' + esc(it.name) + '</b>(' + TIER_LABEL[it.tier] + ')'); toast('✨ ' + it.name); renderItems(); save();
    });
    $('#gGold').addEventListener('click', function () { S.gold += 10000; renderHead(); renderTown(); save(); });
    $('#gMats').addEventListener('click', function () { S.mats.wood += 100; S.mats.ore += 100; S.mats.gem += 10; renderHead(); save(); });
    $('#gZoneUp').addEventListener('click', function () { S.zone++; S.zoneKills = 0; S.bossDone = false; field.mons = []; renderHead(); save(); });
    $('#gExport').addEventListener('click', function () { $('#gData').value = JSON.stringify(S); $('#gData').select(); toast('아래 칸의 내용을 복사해 두세요'); });
    $('#gImport').addEventListener('click', function () {
      try { var s = JSON.parse($('#gData').value); if (!s || !s.hunters) throw 0; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); location.reload(); }
      catch (e) { toast('저장 데이터 형식이 아니에요'); }
    });
    $('#gReset').addEventListener('click', function () { if (!confirm('정말 전부 지울까요? 되돌릴 수 없어요.')) return; localStorage.removeItem(SAVE_KEY); location.reload(); });
    if (location.hash === '#god') setTimeout(openGod, 300);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); else { last = 0; offlineCatchUp(); renderAll(); } });
    window.addEventListener('pagehide', save);
  }

  // ---------- 시작 ----------
  S = load();
  fillGodSelects();
  resizeCanvas();
  bind();
  offlineCatchUp();
  renderAll();
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') { navigator.serviceWorker.register('sw.js').catch(function () {}); }
  window.__ht = { S: S, makeHunter: makeHunter, makeItem: makeItem, save: save }; // 테스트·디버그용
})();
