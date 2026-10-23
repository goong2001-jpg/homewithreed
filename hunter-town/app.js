/* 헌터 마을 — 나만의 방치형 헌터 타이쿤 (픽셀 버전).
 * 서버 없이 이 기기 브라우저(localStorage)에만 저장합니다.
 * 구성: 데이터 정의 → 생성 → 시뮬레이션(2D 사냥터) → 픽셀 그리기 → 화면(DOM) → 신 모드 → 시작
 * 캔버스는 낮은 해상도(1픽셀 = 화면 PIX픽셀)로 그린 뒤 CSS 로 확대해 픽셀 느낌을 냅니다. */
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
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  // ---------- 데이터 정의 ----------
  var TIERS = ['C', 'B', 'A', 'S', 'SP'];
  var TIER_LABEL = { C: 'C', B: 'B', A: 'A', S: 'S', SP: 'S+' };
  var TIER_MUL = { C: 1, B: 1.25, A: 1.6, S: 2.1, SP: 2.8 };
  var TIER_COLOR = { C: '#b9b9b9', B: '#7fd36b', A: '#6fb3ff', S: '#c58cff', SP: '#ffd34f' };
  var TIER_IDX = { C: 0, B: 1, A: 2, S: 3, SP: 4 };
  var CLASSES = {
    warrior: { nm: '전사', ic: '🗡️', weapon: 'sword', color: '#c94f3f', dark: '#7a2e24', hp: 1.3, atk: 1.0, def: 1.3, spd: 1.0, range: 8 },
    archer:  { nm: '궁수', ic: '🏹', weapon: 'bow',   color: '#4f9c5f', dark: '#2d5f38', hp: 0.9, atk: 1.1, def: 0.8, spd: 1.3, range: 36 },
    mage:    { nm: '마법사', ic: '🔮', weapon: 'staff', color: '#4f6fd0', dark: '#2a3d80', hp: 0.8, atk: 1.5, def: 0.6, spd: 0.8, range: 32 },
    cleric:  { nm: '성직자', ic: '✨', weapon: 'mace',  color: '#e0c060', dark: '#8a7230', hp: 1.1, atk: 0.9, def: 1.1, spd: 0.9, range: 9, heal: true }
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
  var NAMES = ['아린', '벨', '카일', '루나', '데인', '미르', '세라', '유키', '하루', '라온', '단테', '로이', '피아', '제이', '소라', '노아', '엘리', '가온', '테오', '밀라', '수호', '리안', '하나', '이안', '라희', '준', '니아', '레오', '시온', '유나', '보리', '한결', '도윤', '채아', '지우'];
  var HAIR_COLORS = ['#2b2320', '#6b3f23', '#e8c060', '#d04a2a', '#e879b0', '#4f7fe0', '#4fb06a', '#9a5cf0', '#f0ede0', '#48b8b0', '#ff9a3c'];
  var SKINS = ['#f3d9b1', '#e3b88a', '#b07a4a'];
  var ZONES = [
    { nm: '초원', ic: '🌲', mons: ['슬라임', '들쥐', '고블린'], base: '#2f4a2a', light: '#3a5a33', dark: '#25391f', path: '#5a4a32', mon: ['#7bd37b', '#a88a6a', '#7aa04f'], boss: '고블린 대장', deco: 'grass' },
    { nm: '숲', ic: '🌳', mons: ['늑대', '거미', '오크'], base: '#22392a', light: '#2b4a33', dark: '#192b1f', path: '#4a3f2a', mon: ['#8a8f9a', '#4a4a5a', '#5f8a3a'], boss: '오크 족장', deco: 'forest' },
    { nm: '동굴', ic: '🕳️', mons: ['박쥐', '스켈레톤', '트롤'], base: '#2a2d38', light: '#353946', dark: '#1f2129', path: '#3f3a3a', mon: ['#5a4a7a', '#d8d8c8', '#6a7a5a'], boss: '트롤 왕', deco: 'cave' },
    { nm: '화산', ic: '🌋', mons: ['도마뱀', '임프', '골렘'], base: '#3a2420', light: '#4a2e26', dark: '#2a1a16', path: '#5a3a2a', mon: ['#d06a3a', '#c03a3a', '#6a5a5a'], boss: '용암 골렘', deco: 'lava' },
    { nm: '심연', ic: '🌑', mons: ['그림자', '악마', '와이번'], base: '#1f1830', light: '#2a2040', dark: '#161022', path: '#3a2e50', mon: ['#3a3050', '#8a2a5a', '#5a3a8a'], boss: '심연의 드래곤', deco: 'abyss' }
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
  var LINES = {
    idle: ['오늘 날씨 좋다~', '장비 좀 바꿔 주면 안 돼?', '배고프다…', '마을이 점점 커지네!', '다음엔 내가 보스 잡을 거야', '밥 먹고 하자', '심심하다…', '오늘은 뭐 주울까?', '부자 될 거야!', '열심히 벌어서 집 사야지', '죽기 딱 좋은 날씨네…', '레벨 올리러 가야지~'],
    kill: ['이 정도쯤이야!', '하나 더!', '돈 벌었다~', '좋았어!', '별거 아니네', '다음!'],
    lowhp: ['아야야…', '위험해!', '누가 좀 도와줘!', '약 좀 먹어야겠어…', '으… 아파'],
    down: ['으윽… 잠깐만 쉴게…', '다음엔 안 져…', '아이고, 삭신이야…'],
    levelup: ['더 강해진 기분이야!', '레벨 업!', '이제 좀 할 만하다'],
    item: ['이거 괜찮은데?', '오, 좋은 거 주웠다!', '이거 팔면 얼마지?'],
    equip: ['새 장비! 마음에 들어', '이제 진짜 시작이다', '오, 손에 착 감기네'],
    arrive: ['여기가 그 마을인가요?', '저 좀 써 주세요!', '실력은 확실합니다', '방 있어요?'],
    rested: ['다시 간다!', '푹 쉬었어', '이번엔 안 다칠 거야']
  };
  var DEFAULT_CFG = { spawnMin: 10, gateCap: 3, tierW: [40, 30, 18, 9, 3], expMul: 1, goldMul: 1, monMul: 1, dropPct: 8, restSec: 60, capBonus: 0, shake: 1, hitstop: 1, particles: 1, sound: true };
  var MISSION = { kills: 30, accept: 1, equip: 1 };

  // ---------- 상태 ----------
  var S = null;
  function fresh() {
    return {
      v: 2, gold: 300, gems: 3, mats: { wood: 10, ore: 10, gem: 0 }, hunters: [], gate: [], items: [], town: { inn: 1, forge: 1, camp: 0, shrine: 0 },
      zone: 1, zoneKills: 0, bossDone: false, lastTick: Date.now(), nextSpawnAt: Date.now() + 20000,
      cfg: JSON.parse(JSON.stringify(DEFAULT_CFG)), stats: { kills: 0, arrivals: 0, goldEarned: 0 }, log: [], chat: [], rate: 0, godSeen: false,
      daily: { date: today(), kills: 0, accept: 0, equip: 0, claimed: false }
    };
  }
  function genLook() { return { hair: ri(0, 4), hc: pick(HAIR_COLORS), skin: pick(SKINS) }; }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return fresh();
      var s = JSON.parse(raw), f = fresh();
      Object.keys(f).forEach(function (k) { if (s[k] === undefined) s[k] = f[k]; });
      Object.keys(DEFAULT_CFG).forEach(function (k) { if (s.cfg[k] === undefined) s.cfg[k] = DEFAULT_CFG[k]; });
      if (s.mats.gem) { s.gems += s.mats.gem; s.mats.gem = 0; }
      s.hunters.concat(s.gate).forEach(function (h) { if (!h.look) h.look = genLook(); h.target = null; h.cd = 0; h.anim = 0; h.flash = 0; h.y = h.y || 0; h.bubble = null; });
      return s;
    } catch (e) { return fresh(); }
  }
  var saveTimer = 0;
  function save() { S.lastTick = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function addLog(txt) {
    var d = new Date(); var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    S.log.unshift({ t: hh, txt: txt }); if (S.log.length > 80) S.log.length = 80; ui.dirty.log = true;
  }
  var toastTimer = 0;
  function toast(msg) { var el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2200); }
  // 헌터 수다: 채팅창 + 머리 위 말풍선
  function say(h, kind, force) {
    if (!force && Math.random() > 0.6) return;
    var txt = pick(LINES[kind]);
    S.chat.push({ nm: h.name, c: CLASSES[h.cls].color, txt: txt }); if (S.chat.length > 30) S.chat.shift();
    h.bubble = { txt: txt, until: Date.now() + 2600 };
    renderChat();
  }
  function sysChat(txt) { S.chat.push({ sys: true, txt: txt }); if (S.chat.length > 30) S.chat.shift(); renderChat(); }

  // ---------- 생성 ----------
  function weightedTier(w) { var sum = 0, i; for (i = 0; i < 5; i++) sum += w[i]; var r = Math.random() * sum; for (i = 0; i < 5; i++) { r -= w[i]; if (r < 0) return TIERS[i]; } return 'C'; }
  function makeHunter(opt) {
    opt = opt || {};
    var cls = opt.cls || pick(Object.keys(CLASSES)), tier = opt.tier || weightedTier(S.cfg.tierW);
    var traits = [], pool = TRAITS.slice(), n = ri(1, 2);
    while (traits.length < n && pool.length) traits.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].nm);
    var h = { id: uid(), name: opt.name || pick(NAMES), cls: cls, tier: tier, traits: traits, lv: 1, exp: 0, look: genLook(),
      weapon: null, armor: null, status: 'town', auto: true, restUntil: 0, kills: 0, hp: 1, x: 14, y: 0, cd: 0, anim: 0, flash: 0, target: null, bubble: null, nextTalk: 0, wx: 0, wy: 0, lowSaid: false };
    recalc(h); h.hp = h.maxHp; return h;
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
    var m = TIER_MUL[tier] * (1 + (S.zone - 1) * 0.18) * rnd(0.9, 1.15);
    var it = { id: uid(), kind: kind, type: type, tier: tier, name: TIER_PREFIX[tier] + ' ' + WEAPON_NOUN[type] };
    if (kind === 'weapon') it.atk = Math.round(6 * m); else { it.def = Math.round(3 * m); it.hp = Math.round(25 * m); }
    return it;
  }
  function sellPrice(it) { return Math.floor(20 * TIER_MUL[it.tier] * TIER_MUL[it.tier] * (1 + (S.zone - 1) * 0.1)); }
  function zoneInfo(z) { return ZONES[(z - 1) % ZONES.length]; }
  function zoneScale(z) { return Math.pow(1.32, z - 1) * S.cfg.monMul; }
  function makeMonster(boss) {
    var z = zoneInfo(S.zone), sc = zoneScale(S.zone), k = boss ? 2 : ri(0, 2);
    var m = { id: uid(), nm: boss ? z.boss : z.mons[k], boss: !!boss, kind: k, color: z.mon[k],
      maxHp: Math.round((boss ? 320 : 40 + k * 14) * sc), atk: Math.round((boss ? 14 : 5 + k * 2) * sc), def: Math.round(k * sc),
      spd: boss ? 0.7 : 0.9, gold: Math.round((boss ? 60 : 5 + k * 3) * sc), exp: Math.round((boss ? 90 : 8 + k * 4) * sc),
      x: F.w + 6 + Math.random() * 10, y: rnd(F.top + 4, F.h - 6), cd: Math.random(), anim: 0, flash: 0, walk: Math.random() * 10 };
    m.hp = m.maxHp; return m;
  }

  // ---------- 시뮬레이션 (2D 사냥터, 좌표는 내부 픽셀) ----------
  var F = { w: 130, h: 118, top: 26, mons: [], shots: [], fx: [], shake: 0, freeze: 0, spawnCd: 1, ctx: null, pix: 3, terrain: null, terrainZone: 0, time: 0 };
  function capacity() { return 3 + S.town.inn + (S.cfg.capBonus | 0); }
  function hunting() { return S.hunters.filter(function (h) { return h.status === 'hunt'; }); }
  function tierFx(tier) { return 1 + TIER_IDX[tier] * 0.6; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function moveToward(e, tx, ty, sp, dt) { var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1; var s = Math.min(d, sp * dt); e.x += dx / d * s; e.y += dy / d * s; e.walk = (e.walk || 0) + dt * 8; }

  function step(dt) {
    var now = Date.now(); F.time += dt;
    S.hunters.forEach(function (h) {
      if (h.status === 'town' && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.02 * dt);
      if (h.status === 'rest' && now >= h.restUntil) {
        h.hp = h.maxHp; h.status = h.auto ? 'hunt' : 'town'; h.x = 14; h.y = rnd(F.top + 10, F.h - 10); h.target = null; h.lowSaid = false;
        addLog('<b>' + esc(h.name) + '</b> 회복 완료' + (h.auto ? ', 다시 사냥터로' : '')); if (h.auto) say(h, 'rested', true);
        ui.dirty.hunters = true;
      }
      if (h.bubble && now > h.bubble.until) h.bubble = null;
    });
    var hs = hunting();
    var maxMon = S.bossDone ? 0 : Math.min(6, 3 + Math.floor(S.zone / 3));
    var bossTime = S.zoneKills >= ZONE_KILLS && !S.bossDone;
    if (hs.length) {
      F.spawnCd -= dt;
      if (bossTime) { if (F.mons.length === 0) { F.mons.push(makeMonster(true)); addLog('⚠️ <b>' + esc(zoneInfo(S.zone).boss) + '</b> 등장!'); sysChat('⚠️ ' + zoneInfo(S.zone).boss + '이(가) 나타났다!'); } }
      else if (F.mons.length < maxMon && F.spawnCd <= 0) { F.mons.push(makeMonster(false)); F.spawnCd = rnd(0.8, 1.8); }
    }
    // 헌터
    hs.forEach(function (h) {
      h.anim = Math.max(0, h.anim - dt); h.flash = Math.max(0, h.flash - dt);
      if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.004 * dt);
      if (h.hp / h.maxHp < 0.3 && !h.lowSaid) { h.lowSaid = true; say(h, 'lowhp'); } else if (h.hp / h.maxHp > 0.6) h.lowSaid = false;
      if (F.time > h.nextTalk) { h.nextTalk = F.time + rnd(12, 30); say(h, 'idle', true); }
      var tgt = null, best = 1e9;
      F.mons.forEach(function (m) { if (m.hp <= 0 || m.x > F.w - 8) return; var d = dist(h, m); if (d < best) { best = d; tgt = m; } }); // 화면에 들어온 몬스터만
      h.target = tgt;
      if (!tgt) { // 어슬렁
        if (!h.wx || dist(h, { x: h.wx, y: h.wy }) < 2) { h.wx = rnd(24, F.w * 0.6); h.wy = rnd(F.top + 6, F.h - 6); }
        if (Math.random() < dt * 0.8) moveToward(h, h.wx, h.wy, 9, dt); else if (Math.random() < 0.5) moveToward(h, h.wx, h.wy, 9, dt);
        return;
      }
      if (best > h.range) { moveToward(h, tgt.x - (h.range - 3), tgt.y, 22, dt); return; }
      h.cd -= dt * h.spd; if (h.cd <= 0) { h.cd = 1; attack(h, tgt); }
    });
    // 겹침 풀기
    for (var a = 0; a < hs.length; a++) for (var b = a + 1; b < hs.length; b++) {
      var d = dist(hs[a], hs[b]); if (d < 8 && d > 0) { var dx = (hs[b].x - hs[a].x) / d, dy = (hs[b].y - hs[a].y) / d, p = (8 - d) * 0.5; hs[a].x -= dx * p; hs[a].y -= dy * p; hs[b].x += dx * p; hs[b].y += dy * p; }
    }
    hs.forEach(function (h) { h.x = clamp(h.x, 12, F.w - 18); h.y = clamp(h.y, F.top + 2, F.h - 4); });
    // 몬스터
    F.mons.forEach(function (m) {
      m.anim = Math.max(0, m.anim - dt); m.flash = Math.max(0, m.flash - dt);
      var tgt = null, best = 1e9;
      hs.forEach(function (h) { var d = dist(m, h); if (d < best) { best = d; tgt = h; } });
      if (!tgt) { if (m.x > F.w - 14) moveToward(m, F.w - 14, m.y, 13, dt); return; }
      if (best > 7) { moveToward(m, tgt.x + 5, tgt.y, m.boss ? 9 : 13, dt); return; }
      m.cd -= dt * m.spd; if (m.cd <= 0) { m.cd = 1; monsterHit(m, tgt); }
    });
    F.mons.forEach(function (m) { m.y = clamp(m.y, F.top + 2, F.h - 4); });
    // 투사체
    for (var i = F.shots.length - 1; i >= 0; i--) {
      var s = F.shots[i]; s.t += dt;
      var tx = s.tgt.x, ty = s.tgt.y - 5, ddx = tx - s.x, ddy = ty - s.y, dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      s.dx = ddx / dd; s.dy = ddy / dd; var mv = s.sp * dt;
      if (dd <= mv || s.t > 1.5) { F.shots.splice(i, 1); if (s.tgt.hp > 0) land(s.src, s.tgt, s.dmg, s.crit, s.type, s.tier); }
      else { s.x += s.dx * mv; s.y += s.dy * mv; }
    }
    // 효과
    for (var j = F.fx.length - 1; j >= 0; j--) {
      var f = F.fx[j]; f.t += dt;
      if (f.kind === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 90 * dt; }
      if (f.kind === 'num') f.y -= 9 * dt;
      if (f.t > f.life) F.fx.splice(j, 1);
    }
    F.shake = Math.max(0, F.shake - dt * 10);
    F.mons = F.mons.filter(function (m) { return m.hp > 0; });
    if (!hs.length) { F.mons = []; F.shots = []; }
  }
  function attack(h, m) {
    h.anim = 0.25;
    var crit = Math.random() * 100 < h.crit;
    var dmg = Math.max(1, Math.round(h.atk * rnd(0.85, 1.15) - m.def * 0.5)) * (crit ? 2 : 1);
    var type = CLASSES[h.cls].weapon, tier = h.weapon ? h.weapon.tier : null;
    if (type === 'bow' || type === 'staff') { F.shots.push({ x: h.x + 3, y: h.y - 7, sp: type === 'bow' ? 110 : 80, t: 0, dmg: dmg, crit: crit, src: h, tgt: m, type: type, tier: tier, dx: 1, dy: 0 }); sound(type, tier, true); }
    else setTimeout(function () { if (m.hp > 0) land(h, m, dmg, crit, type, tier); }, 90);
    if (CLASSES[h.cls].heal) {
      var low = null; hunting().forEach(function (o) { if (o.hp < o.maxHp && (!low || o.hp / o.maxHp < low.hp / low.maxHp)) low = o; });
      if (low) { var amt = Math.round(h.atk * 0.6); low.hp = Math.min(low.maxHp, low.hp + amt); F.fx.push({ kind: 'num', x: low.x, y: low.y - 16, txt: '+' + amt, color: '#7fd36b', size: 6, t: 0, life: 0.9 }); }
    }
  }
  function land(h, m, dmg, crit, type, tier) {
    m.hp -= dmg; m.flash = 0.12;
    var power = (tier ? tierFx(tier) : 0.7) * (crit ? 1.5 : 1), c = S.cfg;
    F.shake = Math.max(F.shake, 1.2 * power * c.shake);
    F.freeze = Math.max(F.freeze, 0.012 * power * c.hitstop);
    var n = Math.round(4 * power * c.particles), col = tier ? TIER_COLOR[tier] : '#fff';
    for (var i = 0; i < n; i++) F.fx.push({ kind: 'spark', x: m.x, y: m.y - 5, vx: rnd(-40, 40) * power, vy: rnd(-60, -10) * power, color: col, t: 0, life: rnd(0.3, 0.6) });
    F.fx.push({ kind: 'num', x: m.x + rnd(-3, 3), y: m.y - 12, txt: String(dmg) + (crit ? '!' : ''), color: crit ? '#ffd34f' : '#fff', size: clamp(6 + Math.log(dmg + 1) * 0.9 + (crit ? 2 : 0), 6, 12), t: 0, life: 0.8 });
    sound(type, tier, false);
    if (m.hp <= 0) kill(h, m);
  }
  function monsterHit(m, h) {
    m.anim = 0.25;
    var dmg = Math.max(1, Math.round(m.atk * rnd(0.85, 1.15) - h.def * 0.5));
    h.hp -= dmg; h.flash = 0.12;
    F.fx.push({ kind: 'num', x: h.x, y: h.y - 14, txt: '-' + dmg, color: '#ff7a70', size: 6, t: 0, life: 0.7 });
    if (h.hp <= 0) {
      h.hp = 0; h.status = 'rest'; h.target = null; h.restUntil = Date.now() + S.cfg.restSec * 1000 * restMul(S.town.shrine);
      addLog('<b>' + esc(h.name) + '</b> 쓰러짐 — ' + esc(m.nm) + '에게 당했다. 마을에서 회복 중');
      say(h, 'down', true); toast('💫 ' + h.name + ' 쓰러짐! 회복 중');
      ui.dirty.hunters = true;
    }
  }
  function kill(h, m) {
    var gold = Math.round(m.gold * S.cfg.goldMul * (1 + traitSum(h, 'gold')));
    S.gold += gold; S.stats.goldEarned += gold; S.stats.kills++; h.kills++; S.daily.kills++;
    var expBase = m.exp * S.cfg.expMul * (1 + S.town.camp * 0.1);
    gainExp(h, expBase * (1 + traitSum(h, 'exp')));
    hunting().forEach(function (o) { if (o !== h) gainExp(o, expBase * 0.3 * (1 + traitSum(o, 'exp'))); });
    F.fx.push({ kind: 'num', x: m.x, y: m.y - 18, txt: '+' + gold, color: '#ffd34f', size: 6, t: 0, life: 1 });
    if (Math.random() < 0.15) say(h, 'kill', true);
    var z = S.zone;
    if (Math.random() < 0.35) S.mats.wood += ri(1, 2);
    if (Math.random() < 0.25) S.mats.ore += ri(1, 2);
    if (Math.random() < 0.02 + z * 0.004) { S.gems += 1; sysChat('💎 보석을 주웠다!'); }
    var dropP = (m.boss ? 100 : S.cfg.dropPct) / 100;
    if (Math.random() < dropP) {
      var w = [Math.max(5, 45 - z * 3), 30, 16 + z * 1.5, 7 + z, 2 + z * 0.5]; if (m.boss) w = [0, 20, 40, 30, 10];
      var it = makeItem({ w: w }); S.items.push(it);
      addLog('🎁 <b>' + esc(h.name) + '</b>이(가) <b>' + esc(it.name) + '</b>(' + TIER_LABEL[it.tier] + ') 획득');
      sysChat('🎁 ' + h.name + '이(가) ' + it.name + '(' + TIER_LABEL[it.tier] + ')을(를) 주웠다'); say(h, 'item');
      ui.dirty.items = true;
    }
    if (m.boss) {
      S.bossDone = true; addLog('🏆 <b>' + esc(m.nm) + '</b> 처치! 다음 구역이 열렸다'); toast('🏆 보스 처치! 다음 구역으로'); sysChat('🏆 ' + m.nm + ' 처치! 다음 구역으로 간다');
      setTimeout(function () { S.zone++; S.zoneKills = 0; S.bossDone = false; ui.dirty.hunters = true; save(); }, 1500);
    } else if (!S.bossDone && S.zoneKills < ZONE_KILLS) S.zoneKills++;
    ui.dirty.head = true; checkMission();
  }
  function gainExp(h, e) {
    h.exp += e; var up = false;
    while (h.exp >= expNeed(h.lv)) { h.exp -= expNeed(h.lv); h.lv++; up = true; }
    if (up) { recalc(h); h.hp = h.maxHp; F.fx.push({ kind: 'num', x: h.x, y: h.y - 18, txt: 'LV UP!', color: '#6fb3ff', size: 7, t: 0, life: 1.2 }); addLog('⬆️ <b>' + esc(h.name) + '</b> Lv.' + h.lv + ' 달성'); say(h, 'levelup'); ui.dirty.hunters = true; }
  }
  // 오늘 할 일
  function checkMission() {
    var d = S.daily;
    if (d.date !== today()) { S.daily = d = { date: today(), kills: 0, accept: 0, equip: 0, claimed: false }; }
    if (!d.claimed && d.kills >= MISSION.kills && d.accept >= MISSION.accept && d.equip >= MISSION.equip) {
      d.claimed = true; var g = 200 * S.zone; S.gems += 2; S.gold += g;
      addLog('✅ 오늘 할 일 완료! 💎2 🪙' + g + ' 보상'); toast('✅ 오늘 할 일 완료! 💎2 🪙' + fmt(g)); sysChat('✅ 오늘 할 일을 다 했다! 보상 💎2 🪙' + fmt(g));
    }
    ui.dirty.mission = true;
  }
  // 헌터 등장
  function spawnTick(now) {
    var changed = false, iv = S.cfg.spawnMin * 60000, guard = 0;
    while (S.nextSpawnAt <= now && guard++ < 50) {
      if (S.gate.length >= S.cfg.gateCap) { S.nextSpawnAt = now + iv; break; }
      var h = makeHunter(); S.gate.push(h); S.stats.arrivals++; changed = true; S.nextSpawnAt += iv;
      if (S.nextSpawnAt < now - iv * 50) S.nextSpawnAt = now + iv;
    }
    if (changed) {
      var last = S.gate[S.gate.length - 1];
      addLog('🚪 새 헌터 <b>' + esc(last.name) + '</b>(' + CLASSES[last.cls].nm + ' ' + TIER_LABEL[last.tier] + ') 이(가) 대기소에 도착');
      sysChat('🚪 ' + last.name + '(' + CLASSES[last.cls].nm + ' ' + TIER_LABEL[last.tier] + ')이(가) 마을에 찾아왔다');
      toast('🚪 새 헌터 ' + last.name + ' 도착! 대기소를 확인하세요');
      ui.dirty.gate = true;
    }
    return changed;
  }
  function offlineCatchUp() {
    var now = Date.now(), elapsed = now - S.lastTick;
    if (elapsed < 120000) return;
    var mins = Math.min(elapsed, 8 * 3600000) / 60000, before = S.gate.length;
    spawnTick(now);
    var arrived = S.gate.length - before, gold = Math.floor(S.rate * mins * 0.5);
    if (hunting().length === 0) gold = 0;
    S.gold += gold;
    var hrs = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    var txt = (hrs ? hrs + '시간 ' : '') + mm + '분 동안\n' + (arrived ? '헌터 ' + arrived + '명이 대기소에 왔고\n' : '새 헌터는 없었고\n') + (gold ? '헌터들이 🪙 ' + fmt(gold) + ' 을 벌어 왔습니다.' : '헌터들은 쉬고 있었습니다.');
    $('#welcomeText').textContent = txt; $('#welcome').hidden = false;
  }
  var rateWin = { gold: 0, t: 0 };
  function trackRate(dt) { rateWin.t += dt; if (rateWin.t >= 60) { S.rate = S.rate * 0.5 + (S.stats.goldEarned - rateWin.gold) * 0.5; rateWin.gold = S.stats.goldEarned; rateWin.t = 0; } }

  // ---------- 소리 ----------
  var AC = null;
  function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function sound(type, tier, launch) {
    if (!S.cfg.sound || !AC) return;
    var t = AC.currentTime, g = AC.createGain(), vol = (0.05 + (tier ? TIER_IDX[tier] * 0.03 : 0)) * (launch ? 0.4 : 1);
    g.connect(AC.destination);
    var o = AC.createOscillator(), f = { sword: 520, bow: 880, staff: 300, mace: 160 }[type] || 400; if (launch) f *= 1.6;
    o.type = { sword: 'square', bow: 'triangle', staff: 'sine', mace: 'sawtooth' }[type] || 'square';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * (type === 'staff' ? 2.2 : 0.4)), t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14 + (tier ? TIER_IDX[tier] * 0.02 : 0));
    o.connect(g); o.start(t); o.stop(t + 0.25);
    if (!launch && (type === 'sword' || type === 'mace')) {
      var len = AC.sampleRate * 0.08, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var n = AC.createBufferSource(), ng = AC.createGain(); n.buffer = buf; ng.gain.value = vol * 1.5; n.connect(ng); ng.connect(AC.destination); n.start(t);
    }
  }

  // ---------- 픽셀 그리기 ----------
  function P(ctx, x, y, c, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function resizeCanvas() {
    document.documentElement.style.setProperty('--navh', $('.nav').offsetHeight + 'px');
    var cv = $('#field'), cssW = cv.parentNode.getBoundingClientRect().width || 360;
    F.pix = Math.max(2, Math.floor(cssW / 125));
    F.w = Math.ceil(cssW / F.pix);
    var avail = window.innerHeight - $('.nav').offsetHeight - 150; // 수다창 최소 150px 남기고 나머지를 사냥터로
    F.h = clamp(Math.floor(avail / F.pix), 110, 190);
    cv.width = F.w; cv.height = F.h;
    cv.style.width = F.w * F.pix + 'px'; cv.style.height = F.h * F.pix + 'px';
    F.ctx = cv.getContext('2d'); F.ctx.imageSmoothingEnabled = false;
    F.terrainZone = 0;
  }
  // 지형은 구역마다 한 번만 그려 둔다 (시드 난수로 같은 구역이면 같은 모양)
  function seeded(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function buildTerrain() {
    var z = zoneInfo(S.zone), r = seeded(S.zone * 7 + 3), cv = document.createElement('canvas'); cv.width = F.w; cv.height = F.h;
    var c = cv.getContext('2d'), i, x, y;
    P(c, 0, 0, z.base, F.w, F.h);
    for (i = 0; i < 260; i++) { x = Math.floor(r() * F.w); y = Math.floor(r() * F.h); P(c, x, y, r() < 0.5 ? z.light : z.dark, 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); }
    // 흙길: 마을 문에서 오른쪽으로 구불구불
    var py = F.h / 2;
    for (x = 10; x < F.w; x++) { py += (r() - 0.5) * 1.6; py = clamp(py, F.top + 12, F.h - 14); P(c, x, py - 4, z.path, 1, 9); if (r() < 0.3) P(c, x, py - 5 + Math.floor(r() * 11), z.dark); }
    // 장식
    var n = z.deco === 'forest' ? 26 : 16;
    for (i = 0; i < n; i++) {
      x = 20 + Math.floor(r() * (F.w - 26)); y = F.top + Math.floor(r() * (F.h - F.top - 4)); var k = r();
      if (z.deco === 'cave' || (z.deco === 'lava' && k < 0.5)) { P(c, x, y, '#6a6f7a', 3, 2); P(c, x, y - 1, '#8a8f9a', 2, 1); }
      else if (z.deco === 'lava' && k < 0.8) { P(c, x, y, '#ff7a2a', 2, 1); P(c, x + 1, y + 1, '#ffb040', 1, 1); }
      else if (z.deco === 'abyss' && k < 0.5) { P(c, x, y, '#b07aff', 1, 1); P(c, x + 2, y + 1, '#7a4fd0', 1, 1); }
      else if (k < 0.45) { P(c, x + 2, y + 2, '#3a2a1a', 2, 3); P(c, x, y - 2, z.deco === 'forest' ? '#1f4a2a' : '#2f6a3a', 6, 4); P(c, x + 1, y - 3, z.deco === 'forest' ? '#2a5f36' : '#3f8a4a', 4, 1); }
      else if (k < 0.75) { P(c, x, y, z.dark, 4, 2); P(c, x + 1, y - 1, z.light, 2, 1); }
      else { P(c, x, y, r() < 0.5 ? '#ffd0e0' : '#fff6c0', 1, 1); }
    }
    // 마을: 돌담 + 문 + 등불 + 지붕
    for (y = F.top - 6; y < F.h; y++) for (x = 0; x < 12; x++) P(c, x, y, ((x + (y >> 1)) % 3 === 0) ? '#3a3f4c' : '#4a5060');
    P(c, 10, F.top - 6, '#2a2e38', 2, F.h);
    var gy = F.h / 2; P(c, 6, gy - 9, '#120d0a', 6, 18); P(c, 6, gy - 11, '#5a4030', 6, 2);
    P(c, 4, gy - 13, '#ffb040', 1, 1); P(c, 13, gy - 13, '#ffb040', 1, 1);
    c.globalAlpha = 0.18; c.fillStyle = '#ffb040'; c.beginPath(); c.arc(4, gy - 13, 6, 0, 7); c.fill(); c.beginPath(); c.arc(13, gy - 13, 6, 0, 7); c.fill(); c.globalAlpha = 1;
    P(c, 0, F.top - 16, '#6a3a2a', 10, 1); P(c, 1, F.top - 15, '#8a4a30', 8, 9); P(c, 3, F.top - 11, '#ffd070', 2, 2); P(c, 0, F.top - 17, '#3a2a1a', 11, 1);
    // 윗부분 밤하늘
    P(c, 12, 0, '#0e1a26', F.w, F.top - 2); P(c, 12, F.top - 2, '#1a2a30', F.w, 2);
    for (i = 0; i < 20; i++) P(c, 12 + Math.floor(r() * (F.w - 12)), Math.floor(r() * (F.top - 6)), r() < 0.3 ? '#fff' : '#9ab', 1, 1);
    P(c, F.w - 22, 6, '#ffe9a8', 6, 6); P(c, F.w - 21, 5, '#ffe9a8', 4, 8); P(c, F.w - 23, 7, '#ffe9a8', 8, 4); P(c, F.w - 20, 8, '#e8d090', 2, 2);
    F.terrain = cv; F.terrainZone = S.zone;
  }
  function draw() {
    var ctx = F.ctx; if (!ctx) return;
    if (F.terrainZone !== S.zone) buildTerrain();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var sx = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0, sy = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0;
    ctx.drawImage(F.terrain, sx, sy);
    ctx.translate(sx, sy);
    // 마을에서 쉬는 헌터는 문 앞에
    var townies = S.hunters.filter(function (h) { return h.status === 'town'; });
    townies.forEach(function (h, i) { h.x = 15 + (i % 2) * 6; h.y = F.h / 2 + 6 + Math.floor(i / 2) * 8; });
    var ents = hunting().concat(townies).map(function (h) { return { y: h.y, h: h }; }).concat(F.mons.map(function (m) { return { y: m.y, m: m }; }));
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { if (e.h) drawHunter(ctx, e.h, Math.round(e.h.x), Math.round(e.h.y)); else drawMonster(ctx, e.m, Math.round(e.m.x), Math.round(e.m.y)); });
    F.shots.forEach(function (s) {
      var col = s.tier ? TIER_COLOR[s.tier] : '#ddd';
      if (s.type === 'bow') { P(ctx, s.x, s.y, '#e8d8b0', 1, 1); P(ctx, s.x - s.dx * 1.5, s.y - s.dy * 1.5, col, 1, 1); P(ctx, s.x - s.dx * 3, s.y - s.dy * 3, '#a08860', 1, 1); }
      else { P(ctx, s.x - 1, s.y - 1, col, 2, 2); ctx.globalAlpha = 0.5; P(ctx, s.x - s.dx * 2 - 1, s.y - s.dy * 2 - 1, col, 2, 2); ctx.globalAlpha = 0.25; P(ctx, s.x - s.dx * 4 - 1, s.y - s.dy * 4 - 1, col, 2, 2); ctx.globalAlpha = 1; }
    });
    F.fx.forEach(function (f) {
      var a = 1 - f.t / f.life;
      if (f.kind === 'spark') { ctx.globalAlpha = a; P(ctx, f.x, f.y, f.color, 1, 1); }
      else { ctx.globalAlpha = Math.min(1, a * 1.5); ctx.font = 'bold ' + f.size + 'px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; var tx = Math.round(f.x), ty = Math.round(f.y); ctx.fillText(f.txt, tx - 1, ty); ctx.fillText(f.txt, tx + 1, ty); ctx.fillText(f.txt, tx, ty - 1); ctx.fillText(f.txt, tx, ty + 1); ctx.fillStyle = f.color; ctx.fillText(f.txt, tx, ty); }
      ctx.globalAlpha = 1;
    });
    // 밤 분위기
    ctx.fillStyle = 'rgba(10,16,40,.14)'; ctx.fillRect(-2, F.top - 2, F.w + 4, F.h);
    drawLabels();
  }
  // 헌터 스프라이트: 가로 10 × 세로 14, 발 가운데가 (x, y)
  function drawHunter(ctx, h, x, y, big) {
    var c = CLASSES[h.cls], L = h.look || { hair: 0, hc: '#2b2320', skin: '#f3d9b1' }, t = y - 14;
    var a = h.anim > 0 ? Math.sin((0.25 - h.anim) / 0.25 * Math.PI) : 0, lunge = Math.round(a * 2);
    var walk = h.status === 'hunt' && h.target && dist(h, h.target) > h.range ? Math.floor((h.walk || 0) % 2) : (h.status === 'town' ? Math.floor(F.time * 2 + x) % 2 : 0);
    x += lunge;
    var fl = h.flash > 0, skin = fl ? '#fff' : L.skin, hair = fl ? '#fff' : L.hc, body = fl ? '#fff' : c.color, bodyD = fl ? '#fff' : c.dark;
    var arm = h.armor, armC = arm ? TIER_COLOR[arm.tier] : null, ai = arm ? TIER_IDX[arm.tier] : -1;
    if (arm && !fl) { body = mix(c.color, armC, 0.55); bodyD = mix(c.dark, armC, 0.35); }
    // 망토(S+)와 뒤쪽 머리
    if (ai === 4) P(ctx, x - 5, t + 6, armC, 2, 6);
    if (L.hair === 1) { P(ctx, x - 4, t + 2, hair, 1, 7); P(ctx, x + 3, t + 2, hair, 1, 7); }
    if (L.hair === 2) { P(ctx, x - 5, t + 3, hair, 1, 6); P(ctx, x - 4, t + 2, hair, 1, 2); }
    // 머리
    P(ctx, x - 3, t + 2, skin, 6, 4);
    P(ctx, x - 3, t, hair, 6, 2); P(ctx, x - 3, t + 2, hair, 1, 1); P(ctx, x + 2, t + 2, hair, 1, 1);
    if (L.hair === 3) { P(ctx, x - 4, t + 1, hair, 8, 1); P(ctx, x - 2, t - 2, hair, 4, 2); P(ctx, x - 1, t - 3, hair, 2, 1); }
    if (L.hair === 4) { P(ctx, x - 1, t - 1, hair, 3, 1); P(ctx, x, t - 2, hair, 2, 1); }
    if (L.hair === 0) P(ctx, x - 3, t + 1, hair, 7, 1);
    P(ctx, x - 2, t + 4, '#1a1410', 1, 1); P(ctx, x + 1, t + 4, '#1a1410', 1, 1);
    // 몸
    P(ctx, x - 3, t + 6, body, 6, 5); P(ctx, x - 3, t + 9, bodyD, 6, 1);
    if (ai >= 2) { P(ctx, x - 4, t + 6, armC, 1, 2); P(ctx, x + 3, t + 6, armC, 1, 2); }
    if (ai >= 3) { P(ctx, x - 1, t + 7, armC, 2, 1); }
    if (ai >= 0) P(ctx, x - 3, t + 10, armC, 6, 1);
    // 팔(앞쪽, 피부) 과 다리
    P(ctx, x + 3, t + 7, skin, 1, 2);
    P(ctx, x - 2, t + 11, '#2a2119', 2, 3 - walk); P(ctx, x, t + 11, '#2a2119', 2, 2 + walk);
    // 무기 (오른손 x+3, t+8)
    drawWeapon(ctx, c.weapon, h.weapon ? h.weapon.tier : null, x + 3, t + 8, a);
    // 체력바(사냥 중)
    if (h.status === 'hunt' && !big) { P(ctx, x - 4, y + 1, '#000', 9, 1); P(ctx, x - 4, y + 1, h.hp / h.maxHp < 0.3 ? '#ff5a50' : '#7fd36b', Math.round(8 * clamp(h.hp / h.maxHp, 0, 1)) + 1, 1); }
  }
  function mix(a, b, k) { var pa = hex(a), pb = hex(b); return 'rgb(' + Math.round(pa[0] + (pb[0] - pa[0]) * k) + ',' + Math.round(pa[1] + (pb[1] - pa[1]) * k) + ',' + Math.round(pa[2] + (pb[2] - pa[2]) * k) + ')'; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function drawWeapon(ctx, type, tier, hx, hy, a) {
    var col = tier ? TIER_COLOR[tier] : '#8a8f9c', ti = tier ? TIER_IDX[tier] : -1, len = 3 + Math.max(0, ti), up = Math.round(a * 3), i;
    if (ti >= 3) { ctx.globalAlpha = 0.35; for (i = 0; i < len + 1; i++) P(ctx, hx + i, hy - i - up - 1, col, 3, 3); ctx.globalAlpha = 1; }
    if (type === 'sword') { for (i = 0; i < len + 1; i++) P(ctx, hx + 1 + i, hy - 1 - i - up, col, 1, 1); if (ti >= 1) for (i = 0; i < len; i++) P(ctx, hx + 2 + i, hy - 1 - i - up, mix(col, '#ffffff', 0.4), 1, 1); P(ctx, hx, hy - up, '#6b5a3a', 1, 1); P(ctx, hx + 1, hy + 1 - up, '#6b5a3a', 1, 1); }
    else if (type === 'bow') { P(ctx, hx + 2, hy - 3 - up, col, 1, 7); P(ctx, hx + 1, hy - 4 - up, col, 1, 1); P(ctx, hx + 1, hy + 3 - up, col, 1, 1); P(ctx, hx + 3, hy - 3 - up, '#ddd', 1, 6); if (ti >= 2) { P(ctx, hx + 2, hy - up, mix(col, '#fff', 0.5), 1, 1); } }
    else if (type === 'staff') { for (i = 0; i < 5; i++) P(ctx, hx + 1 + (i >> 1), hy + 2 - i - up, '#8a6a3a', 1, 1); P(ctx, hx + 3, hy - 4 - up, col, 2 + (ti >= 2 ? 1 : 0), 2 + (ti >= 2 ? 1 : 0)); if (ti >= 1) P(ctx, hx + 3, hy - 4 - up, '#fff', 1, 1); }
    else if (type === 'mace') { for (i = 0; i < 3; i++) P(ctx, hx + 1 + i, hy - i - up, '#6b5a3a', 1, 1); var r = 2 + (ti >= 2 ? 1 : 0); P(ctx, hx + 3, hy - 3 - up - (r - 2), col, r, r); if (ti >= 1) P(ctx, hx + 3, hy - 3 - up - (r - 2), mix(col, '#fff', 0.5), 1, 1); }
  }
  function drawMonster(ctx, m, x, y) {
    var fl = m.flash > 0, c = fl ? '#fff' : m.color, d = fl ? '#fff' : mix(m.color, '#000000', 0.35), s = m.boss ? 2 : 1;
    var a = m.anim > 0 ? Math.sin((0.25 - m.anim) / 0.25 * Math.PI) : 0; x -= Math.round(a * 2);
    var bob = Math.floor((m.walk || 0) % 2);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (m.kind === 0) { P(ctx, -3, -4 + bob, c, 7, 3); P(ctx, -4, -3 + bob, c, 9, 2); P(ctx, -2, -5 + bob, c, 5, 1); P(ctx, -3, -1, d, 7, 1); P(ctx, -2, -3 + bob, '#1a1410', 1, 1); P(ctx, 1, -3 + bob, '#1a1410', 1, 1); }
    else if (m.kind === 1) { P(ctx, -4, -5 + bob, c, 7, 4); P(ctx, -3, -7 + bob, c, 1, 2); P(ctx, 1, -7 + bob, c, 1, 2); P(ctx, 3, -4 + bob, d, 3, 1); P(ctx, -4, -1, d, 2, 1); P(ctx, 0, -1, d, 2, 1); P(ctx, -3, -4 + bob, '#ffd0d0', 1, 1); P(ctx, 0, -4 + bob, '#ffd0d0', 1, 1); }
    else { P(ctx, -4, -9 + bob, c, 8, 8); P(ctx, -5, -11 + bob, d, 1, 3); P(ctx, 4, -11 + bob, d, 1, 3); P(ctx, -5, -6 + bob, c, 1, 3); P(ctx, 4, -6 + bob, c, 1, 3); P(ctx, -3, -7 + bob, '#ff5050', 1, 1); P(ctx, 1, -7 + bob, '#ff5050', 1, 1); P(ctx, -3, -4 + bob, d, 6, 1); P(ctx, -3, -1, d, 2, 1); P(ctx, 1, -1, d, 2, 1); }
    if (m.boss) { P(ctx, -3, -12, '#ffd34f', 6, 1); P(ctx, -3, -13, '#ffd34f', 1, 1); P(ctx, -1, -14, '#ffd34f', 2, 2); P(ctx, 2, -13, '#ffd34f', 1, 1); }
    ctx.restore();
    var w = m.boss ? 20 : 9; P(ctx, x - w / 2, y + 1, '#000', w, 1); P(ctx, x - w / 2, y + 1, m.boss ? '#ff5a50' : '#7fd36b', Math.round(w * clamp(m.hp / m.maxHp, 0, 1)), 1);
  }
  // 이름표·말풍선은 DOM 으로 (픽셀 캔버스 글자는 너무 작다)
  var labelEls = {};
  function drawLabels() {
    var box = $('#labels'), seen = {}, p = F.pix;
    function el(id, cls) { var e = labelEls[id]; if (!e) { e = document.createElement('div'); e.className = cls; box.appendChild(e); labelEls[id] = e; } seen[id] = true; return e; }
    hunting().forEach(function (h) {
      var e = el(h.id, 'tag'); e.textContent = h.name; e.style.left = h.x * p + 'px'; e.style.top = (h.y + 3) * p + 'px';
      if (h.bubble) { var b = el(h.id + 'b', 'bubble'); b.textContent = h.bubble.txt; b.style.left = h.x * p + 'px'; b.style.top = (h.y - 17) * p + 'px'; }
    });
    F.mons.forEach(function (m) { if (!m.boss) return; var e = el(m.id, 'tag boss'); e.textContent = m.nm; e.style.left = m.x * p + 'px'; e.style.top = (m.y - 32) * p + 'px'; });
    Object.keys(labelEls).forEach(function (id) { if (!seen[id]) { labelEls[id].remove(); delete labelEls[id]; } });
  }
  function drawPortrait(cv, h, size) {
    var n = size || 20; cv.width = n; cv.height = n; var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, n, n);
    drawHunter(ctx, { cls: h.cls, look: h.look, armor: h.armor, weapon: h.weapon, anim: 0, flash: 0, status: 'town', hp: 1, maxHp: 1 }, Math.floor(n / 2) - 1, n - 2, true);
  }

  // ---------- 메인 루프 ----------
  var last = 0, acc = 0, uiTick = 0, secTick = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = Math.min(0.1, (ts - last) / 1000); last = ts;
    if (F.freeze > 0) { F.freeze -= dt; draw(); return; }
    acc += dt;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    trackRate(dt); draw();
    uiTick += dt; secTick += dt;
    if (uiTick >= 0.5) { uiTick = 0; refreshLive(); if (ui.dirty.chat) renderChat(); if (ui.dirty.mission) renderMission(); }
    if (secTick >= 1) {
      secTick = 0; spawnTick(Date.now()); renderTimer();
      if (ui.dirty.gate) renderGate(); if (ui.dirty.hunters) renderHunters(); if (ui.dirty.items) renderItems(); if (ui.dirty.log) renderLog(); if (ui.dirty.head) renderHead();
      if ((saveTimer = (saveTimer + 1) % 5) === 0) save();
    }
  }

  // ---------- 화면(DOM) ----------
  var ui = { dirty: { gate: true, hunters: true, items: true, town: true, log: true, head: true, chat: true, mission: true }, sheetHunter: null, pickSlot: null };
  function tierTag(t) { return '<span class="tier ' + t + '">' + TIER_LABEL[t] + '</span>'; }
  function renderHead() {
    ui.dirty.head = false;
    $('#gold').textContent = '🪙 ' + fmt(S.gold); $('#gem').textContent = '💎 ' + S.gems;
    $('#mats').textContent = '🪵 ' + S.mats.wood + ' · ⛏️ ' + S.mats.ore;
    var z = zoneInfo(S.zone); $('#zoneNo').textContent = S.zone; $('#zoneName').textContent = z.nm;
    $('#zoneProg').textContent = S.zoneKills >= ZONE_KILLS ? (S.bossDone ? '이동 중…' : '👑 보스!') : '👹 ' + S.zoneKills + ' / ' + ZONE_KILLS;
    $('#huntInfo').textContent = '사냥 중 ' + hunting().length + '명';
    $('#hunterCount').textContent = '👤 ' + S.hunters.length + '/' + capacity();
    $('#itemCount').textContent = '장비 ' + S.items.length + '개';
    $('#soundBtn').textContent = S.cfg.sound ? '🔊' : '🔇';
    var badge = $('#waitBadge'); badge.hidden = S.gate.length === 0; badge.textContent = S.gate.length;
  }
  function renderTimer() {
    var left = Math.max(0, S.nextSpawnAt - Date.now()), el = $('#spawnTimer');
    if (S.gate.length >= S.cfg.gateCap) el.textContent = '대기소 가득';
    else { var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000); el.textContent = '다음 ' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  }
  function renderMission() {
    ui.dirty.mission = false; var d = S.daily, rows = [[d.kills, MISSION.kills, '몬스터 처치'], [d.accept, MISSION.accept, '헌터 받아들이기'], [d.equip, MISSION.equip, '장비 바꿔 주기']];
    var done = rows.filter(function (r) { return r[0] >= r[1]; }).length;
    $('#missionDone').textContent = d.claimed ? '✅' : '(' + done + '/3)';
    $('#missionList').innerHTML = d.claimed ? '<div class="ok">오늘 할 일 모두 완료!</div>' : rows.map(function (r) { return '<div class="' + (r[0] >= r[1] ? 'ok' : '') + '">' + (r[0] >= r[1] ? '✓' : '·') + ' ' + r[2] + ' ' + Math.min(r[0], r[1]) + '/' + r[1] + '</div>'; }).join('');
  }
  function renderChat() {
    ui.dirty.chat = false;
    var el = $('#chatList');
    el.innerHTML = S.chat.slice(-10).map(function (c) { return c.sys ? '<div class="sys">' + esc(c.txt) + '</div>' : '<div><b style="color:' + c.c + '">' + esc(c.nm) + '</b> : ' + esc(c.txt) + '</div>'; }).join('') || '<div class="sys">헌터들이 오면 여기서 수다를 떱니다.</div>';
    el.scrollTop = el.scrollHeight;
  }
  function portraitHtml(h) { return '<div class="ic"><canvas data-portrait="' + h.id + '"></canvas></div>'; }
  function paintPortraits(root, list) { root.querySelectorAll('canvas[data-portrait]').forEach(function (cv) { var h = list.find(function (x) { return x.id === cv.dataset.portrait; }); if (h) drawPortrait(cv, h, 20); }); }
  function renderGate() {
    ui.dirty.gate = false; renderHead();
    $('#waitHint').textContent = S.gate.length ? '마을에 들어오고 싶어하는 헌터들입니다. 숙소 ' + S.hunters.length + '/' + capacity() : '아직 아무도 없어요. 시간이 지나면 찾아옵니다.';
    var el = $('#gateList');
    el.innerHTML = S.gate.map(function (h) {
      var c = CLASSES[h.cls];
      return '<div class="item" data-id="' + h.id + '">' + portraitHtml(h) + '<div class="body"><div class="nm">' + esc(h.name) + ' ' + tierTag(h.tier) + ' <span class="sub">' + c.ic + c.nm + '</span></div>' +
        '<div class="sub">' + h.traits.map(esc).join(', ') + ' · ❤️' + h.maxHp + ' ⚔️' + h.atk + ' 🛡️' + Math.round(h.def) + '</div>' +
        '<div class="row"><button class="btn primary" data-act="accept">받아들이기</button><button class="btn" data-act="reject">돌려보내기</button></div></div></div>';
    }).join('') + '<div class="item"><div class="ic">📯</div><div class="body"><div class="nm">지금 부르기</div><div class="sub">💎 5 를 써서 헌터를 바로 부릅니다</div></div><button class="btn" data-act="call" ' + (S.gems < 5 || S.gate.length >= S.cfg.gateCap ? 'disabled' : '') + '>💎 5</button></div>';
    paintPortraits(el, S.gate);
  }
  function statusTag(h) {
    if (h.status === 'hunt') return '<span class="status hunt">사냥 중</span>';
    if (h.status === 'rest') return '<span class="status rest">회복 중 ' + Math.max(0, Math.ceil((h.restUntil - Date.now()) / 1000)) + '초</span>';
    return '<span class="status">마을에서 쉼</span>';
  }
  function renderHunters() {
    ui.dirty.hunters = false; renderHead();
    var el = $('#hunterList');
    el.innerHTML = S.hunters.map(function (h) {
      var c = CLASSES[h.cls];
      return '<div class="item tap" data-id="' + h.id + '">' + portraitHtml(h) + '<div class="body">' +
        '<div class="nm">' + esc(h.name) + ' ' + tierTag(h.tier) + ' <span class="sub">Lv.' + h.lv + '</span> <span class="st">' + statusTag(h) + '</span></div>' +
        '<div class="sub">' + c.nm + ' · ' + (h.weapon ? WEAPON_IC[h.weapon.type] + esc(h.weapon.name) : '맨손') + ' · ' + (h.armor ? '🛡️' + esc(h.armor.name) : '천옷') + '</div>' +
        '<div class="bar"><i class="hp" style="width:' + Math.round(h.hp / h.maxHp * 100) + '%"></i></div><div class="bar exp"><i class="exp" style="width:' + Math.round(h.exp / expNeed(h.lv) * 100) + '%"></i></div></div></div>';
    }).join('');
    paintPortraits(el, S.hunters);
  }
  function refreshLive() {
    var list = $('#hunterList');
    S.hunters.forEach(function (h) {
      var el = list.querySelector('[data-id="' + h.id + '"]'); if (!el) return;
      el.querySelector('.hp').style.width = Math.round(h.hp / h.maxHp * 100) + '%';
      el.querySelector('.exp').style.width = Math.round(h.exp / expNeed(h.lv) * 100) + '%';
      el.querySelector('.st').innerHTML = statusTag(h);
    });
    $('#huntInfo').textContent = '사냥 중 ' + hunting().length + '명';
    $('#zoneProg').textContent = S.zoneKills >= ZONE_KILLS ? (S.bossDone ? '이동 중…' : '👑 보스!') : '👹 ' + S.zoneKills + ' / ' + ZONE_KILLS;
    $('#gold').textContent = '🪙 ' + fmt(S.gold); $('#gem').textContent = '💎 ' + S.gems;
    $('#mats').textContent = '🪵 ' + S.mats.wood + ' · ⛏️ ' + S.mats.ore;
    if (ui.sheetHunter && !$('#sheet').hidden) { var sh = $('#sheetHp'); if (sh) sh.textContent = h2hp(ui.sheetHunter); }
  }
  function h2hp(h) { return Math.round(h.hp) + ' / ' + h.maxHp; }
  function itemDesc(it) { return it.kind === 'weapon' ? '⚔️ +' + it.atk : '🛡️ +' + it.def + ' ❤️ +' + it.hp; }
  function clsForWeapon(type) { for (var k in CLASSES) if (CLASSES[k].weapon === type) return CLASSES[k].nm; return ''; }
  function renderItems() {
    ui.dirty.items = false; renderHead();
    var sorted = S.items.slice().sort(function (a, b) { return TIER_IDX[b.tier] - TIER_IDX[a.tier]; });
    $('#itemList').innerHTML = sorted.map(function (it) {
      return '<div class="item" data-id="' + it.id + '"><div class="ic">' + WEAPON_IC[it.type] + '</div><div class="body"><div class="nm">' + esc(it.name) + ' ' + tierTag(it.tier) + '</div>' +
        '<div class="sub">' + itemDesc(it) + (it.kind === 'weapon' ? ' · ' + clsForWeapon(it.type) + '용' : ' · 모두') + '</div></div><button class="btn" data-act="sell">🪙 ' + fmt(sellPrice(it)) + ' 팔기</button></div>';
    }).join('');
    var c = craftCost();
    $('#craftBtn').textContent = '🔨 만들기 (🪙' + fmt(c.gold) + ' 🪵' + c.wood + ' ⛏️' + c.ore + ')';
    $('#forgeLv').textContent = 'Lv.' + S.town.forge;
  }
  function craftCost() { return { gold: 80 * S.zone + 40 * S.town.forge, wood: 4 + S.zone, ore: 4 + S.zone }; }
  function craft() {
    var c = craftCost();
    if (S.gold < c.gold || S.mats.wood < c.wood || S.mats.ore < c.ore) return toast('재료가 모자라요');
    S.gold -= c.gold; S.mats.wood -= c.wood; S.mats.ore -= c.ore;
    var f = S.town.forge, w = [Math.max(5, 50 - f * 6), 30, 12 + f * 3, 5 + f * 2, 1 + f], used = false;
    if (S.gems > 0 && Math.random() < 0.5) { S.gems--; w[4] += 15; used = true; }
    var it = makeItem({ w: w }); S.items.push(it);
    addLog('🔨 대장간에서 <b>' + esc(it.name) + '</b>(' + TIER_LABEL[it.tier] + ') 제작');
    $('#craftResult').innerHTML = WEAPON_IC[it.type] + ' <b>' + esc(it.name) + '</b> ' + tierTag(it.tier) + ' ' + itemDesc(it) + (used ? ' <span class="sub">(💎 사용)</span>' : '');
    toast('🔨 ' + it.name + ' 완성!'); renderItems(); save();
  }
  function renderTown() {
    ui.dirty.town = false;
    $('#townList').innerHTML = BUILDINGS.map(function (b) {
      var lv = S.town[b.id], cost = buildCost(b, lv), maxed = lv >= b.max;
      return '<div class="item" data-id="' + b.id + '"><div class="ic">' + b.ic + '</div><div class="body"><div class="nm">' + b.nm + ' <span class="sub">Lv.' + lv + '</span></div><div class="sub">' + b.desc(lv) + (maxed ? '' : ' → ' + b.desc(lv + 1)) + '</div></div>' +
        '<button class="btn" data-act="up" ' + (maxed || S.gold < cost ? 'disabled' : '') + '>' + (maxed ? '최대' : '🪙 ' + fmt(cost)) + '</button></div>';
    }).join('') + '<div class="item"><div class="ic">📊</div><div class="body"><div class="nm">마을 기록</div><div class="sub">처치 ' + fmt(S.stats.kills) + ' · 방문 헌터 ' + S.stats.arrivals + ' · 번 돈 🪙' + fmt(S.stats.goldEarned) + '</div></div></div>';
  }
  function renderLog() { ui.dirty.log = false; $('#logList').innerHTML = S.log.map(function (l) { return '<div>' + l.t + ' ' + l.txt + '</div>'; }).join('') || '<div>아직 기록이 없어요.</div>'; }
  function renderAll() { renderHead(); renderGate(); renderHunters(); renderItems(); renderTown(); renderLog(); renderTimer(); renderChat(); renderMission(); }
  var PANEL_TITLE = { town: '🏗️ 건설', hunters: '🧑‍🤝‍🧑 헌터', items: '📦 마을 창고', forge: '🔨 대장간', log: '📜 기록' };
  function openPanel(name) {
    document.querySelectorAll('#panel .pane').forEach(function (p) { p.classList.toggle('on', p.id === 'tab-' + name); });
    $('#panelTitle').textContent = PANEL_TITLE[name];
    if (name === 'town') renderTown(); if (name === 'hunters') renderHunters(); if (name === 'items' || name === 'forge') renderItems(); if (name === 'log') renderLog();
    $('#panel').hidden = false;
    document.querySelectorAll('.navbtn').forEach(function (b) { b.classList.toggle('on', b.dataset.panel === name); });
  }
  // 헌터 상세
  function openSheet(h) {
    ui.sheetHunter = h; ui.pickSlot = null;
    var c = CLASSES[h.cls];
    $('#sheetContent').innerHTML = '<div class="h-head"><canvas id="portrait"></canvas><div><div class="nm">' + esc(h.name) + ' ' + tierTag(h.tier) + '</div><div class="sub">' + c.ic + ' ' + c.nm + ' · Lv.' + h.lv + ' · 처치 ' + h.kills + '</div><div class="sub">' + statusTag(h) + '</div></div></div>' +
      '<div class="traits">' + h.traits.map(function (nm) { var t = TRAITS.find(function (x) { return x.nm === nm; }); return '<span class="trait ' + (t && t.good ? 'good' : 'bad') + '">' + esc(nm) + '</span>'; }).join('') + '</div>' +
      '<div class="stats"><div>체력<b id="sheetHp">' + h2hp(h) + '</b></div><div>공격<b>' + h.atk + '</b></div><div>방어<b>' + Math.round(h.def) + '</b></div><div>속도<b>' + h.spd.toFixed(2) + '</b></div><div>치명타<b>' + h.crit + '%</b></div><div>경험치<b>' + Math.floor(h.exp) + '/' + expNeed(h.lv) + '</b></div></div>' +
      '<div class="slot" data-slot="weapon"><div><div>' + WEAPON_IC[c.weapon] + ' 무기</div><div class="sub">' + (h.weapon ? esc(h.weapon.name) + ' (' + TIER_LABEL[h.weapon.tier] + ') ' + itemDesc(h.weapon) : '맨손') + '</div></div><button class="btn" data-act="pick" data-slot="weapon">바꾸기</button></div>' +
      '<div class="slot" data-slot="armor"><div><div>🛡️ 갑옷</div><div class="sub">' + (h.armor ? esc(h.armor.name) + ' (' + TIER_LABEL[h.armor.tier] + ') ' + itemDesc(h.armor) : '천옷') + '</div></div><button class="btn" data-act="pick" data-slot="armor">바꾸기</button></div>' +
      '<div id="pickList" class="pick" hidden></div>' +
      '<div class="row"><button class="btn primary" data-act="toggle">' + (h.status === 'hunt' || (h.status === 'rest' && h.auto) ? '🏠 마을에서 쉬게 하기' : '⚔️ 사냥 보내기') + '</button><button class="btn danger" data-act="dismiss">내보내기</button><button class="btn" data-act="close">닫기</button></div>';
    $('#sheet').hidden = false;
    drawPortrait($('#portrait'), h, 20);
  }
  function showPick(slot) {
    var h = ui.sheetHunter, el = $('#pickList'); ui.pickSlot = slot;
    var list = S.items.filter(function (it) { return slot === 'weapon' ? (it.kind === 'weapon' && it.type === CLASSES[h.cls].weapon) : it.kind === 'armor'; }).sort(function (a, b) { return TIER_IDX[b.tier] - TIER_IDX[a.tier]; });
    el.hidden = false;
    el.innerHTML = '<div class="item tap" data-pick="none"><div class="ic">✋</div><div class="body"><div class="nm">해제</div></div></div>' +
      list.map(function (it) { return '<div class="item tap" data-pick="' + it.id + '"><div class="ic">' + WEAPON_IC[it.type] + '</div><div class="body"><div class="nm">' + esc(it.name) + ' ' + tierTag(it.tier) + '</div><div class="sub">' + itemDesc(it) + '</div></div></div>'; }).join('') +
      (list.length ? '' : '<div class="sub">맞는 장비가 없어요. 사냥에서 줍거나 대장간에서 만들어 보세요.</div>');
  }
  function equip(h, slot, id) {
    var cur = h[slot]; if (cur) { S.items.push(cur); h[slot] = null; }
    if (id !== 'none') { var i = S.items.findIndex(function (it) { return it.id === id; }); if (i >= 0) h[slot] = S.items.splice(i, 1)[0]; }
    recalc(h); h.flash = 0.2;
    for (var k = 0; k < 14; k++) F.fx.push({ kind: 'spark', x: h.x, y: h.y - 7, vx: rnd(-30, 30), vy: rnd(-50, -10), color: h[slot] ? TIER_COLOR[h[slot].tier] : '#fff', t: 0, life: 0.6 });
    addLog('🧷 <b>' + esc(h.name) + '</b> ' + (slot === 'weapon' ? '무기' : '갑옷') + ' → ' + (h[slot] ? esc(h[slot].name) : '해제'));
    if (h[slot]) { say(h, 'equip', true); S.daily.equip++; checkMission(); }
    ui.dirty.items = true; ui.dirty.hunters = true; renderHunters(); renderItems(); openSheet(h);
  }
  function acceptHunter(id) {
    var i = S.gate.findIndex(function (h) { return h.id === id; }); if (i < 0) return;
    if (S.hunters.length >= capacity()) return toast('숙소가 꽉 찼어요. 건설에서 숙소를 올리거나 헌터를 내보내세요');
    var h = S.gate.splice(i, 1)[0]; h.status = 'hunt'; h.x = 14; h.y = rnd(F.top + 10, F.h - 10); S.hunters.push(h); S.daily.accept++;
    addLog('🤝 <b>' + esc(h.name) + '</b> 합류! 바로 사냥터로'); toast('🤝 ' + h.name + ' 합류!'); say(h, 'arrive', true); checkMission();
    renderGate(); renderHunters(); save();
  }
  function rejectHunter(id) {
    var i = S.gate.findIndex(function (h) { return h.id === id; }); if (i < 0) return;
    var h = S.gate.splice(i, 1)[0]; addLog('👋 <b>' + esc(h.name) + '</b> 돌려보냄'); renderGate(); save();
  }
  function callHunter(label) {
    if (S.gate.length >= S.cfg.gateCap) return toast('대기소가 가득 찼어요');
    var h = makeHunter(); S.gate.push(h); S.stats.arrivals++;
    addLog(label + ' <b>' + esc(h.name) + '</b> 도착'); sysChat(label + ' ' + h.name + '(' + CLASSES[h.cls].nm + ' ' + TIER_LABEL[h.tier] + ')이(가) 왔다'); toast('📯 ' + h.name + ' 도착!'); renderGate(); save();
  }

  // ---------- 신 모드 ----------
  var godTaps = [];
  function openGod() {
    var c = S.cfg;
    $('#gSpawnMin').value = c.spawnMin; $('#gGateCap').value = c.gateCap; $('#gTierW').value = c.tierW.join(',');
    $('#gExpMul').value = c.expMul; $('#gGoldMul').value = c.goldMul; $('#gMonMul').value = c.monMul; $('#gDrop').value = c.dropPct; $('#gRest').value = c.restSec; $('#gCapBonus').value = c.capBonus;
    $('#gShake').value = c.shake; $('#gHitstop').value = c.hitstop; $('#gParticles').value = c.particles; $('#gData').value = '';
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
    S.hunters.forEach(recalc); save(); renderAll(); toast('✨ 규칙을 바꿨습니다');
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
    $('#zoneBadge').addEventListener('click', function () {
      var now = Date.now(); godTaps.push(now); godTaps = godTaps.filter(function (t) { return now - t < 3000; });
      if (godTaps.length >= 7) { godTaps = []; openGod(); } else if (godTaps.length >= 4) toast('✨ ' + (7 - godTaps.length) + '번 더…');
    });
    document.querySelectorAll('.navbtn').forEach(function (b) { b.addEventListener('click', function () { openPanel(b.dataset.panel); }); });
    $('#waitBtn').addEventListener('click', function () { renderGate(); $('#waitSheet').hidden = false; });
    $('#gateList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'call') { if (S.gems < 5) return toast('💎가 모자라요'); S.gems -= 5; callHunter('📯 뿔피리로 부른'); return; }
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
      S.gold -= cost; S.town[id]++; addLog('🏗️ <b>' + bd.nm + '</b> Lv.' + S.town[id] + ' 완성'); toast('🏗️ ' + bd.nm + ' Lv.' + S.town[id]); sysChat('🏗️ ' + bd.nm + '이(가) Lv.' + S.town[id] + '이 되었다');
      S.hunters.forEach(recalc); renderTown(); renderHead(); save();
    });
    $('#soundBtn').addEventListener('click', function () { S.cfg.sound = !S.cfg.sound; audio(); renderHead(); save(); });
    $('#welcomeOk').addEventListener('click', function () { $('#welcome').hidden = true; });
    document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('.sheet').hidden = true; if (b.closest('#panel')) document.querySelectorAll('.navbtn').forEach(function (x) { x.classList.remove('on'); }); }); });
    $('#sheetContent').addEventListener('click', function (e) {
      var h = ui.sheetHunter; if (!h) return;
      var p = e.target.closest('[data-pick]'); if (p) { equip(h, ui.pickSlot, p.dataset.pick); save(); return; }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;
      if (act === 'pick') showPick(b.dataset.slot);
      else if (act === 'close') $('#sheet').hidden = true;
      else if (act === 'toggle') {
        if (h.status === 'hunt') { h.status = 'town'; h.auto = false; h.target = null; addLog('🏠 <b>' + esc(h.name) + '</b> 마을에서 휴식'); }
        else if (h.status === 'rest') h.auto = !h.auto;
        else { h.status = 'hunt'; h.auto = true; h.x = 14; h.y = rnd(F.top + 10, F.h - 10); addLog('⚔️ <b>' + esc(h.name) + '</b> 사냥터로 출발'); }
        renderHunters(); openSheet(h); save();
      } else if (act === 'dismiss') {
        if (!confirm(h.name + ' 을(를) 마을에서 내보낼까요? 장비는 창고로 돌아옵니다.')) return;
        if (h.weapon) S.items.push(h.weapon); if (h.armor) S.items.push(h.armor);
        S.hunters = S.hunters.filter(function (x) { return x !== h; });
        addLog('👋 <b>' + esc(h.name) + '</b> 마을을 떠남'); $('#sheet').hidden = true; renderHunters(); renderItems(); save();
      }
    });
    // 신 모드
    $('#gApply').addEventListener('click', applyGod);
    $('#gCallNow').addEventListener('click', function () { callHunter('📯 신의 부름으로'); });
    $('#gMakeHunter').addEventListener('click', function () {
      if (S.gate.length >= S.cfg.gateCap) return toast('대기소가 가득 찼어요');
      var h = makeHunter({ name: $('#gHName').value.trim() || null, cls: $('#gHCls').value, tier: $('#gHTier').value });
      S.gate.push(h); S.stats.arrivals++; addLog('✨ 신이 빚은 헌터 <b>' + esc(h.name) + '</b> 도착'); toast('✨ ' + h.name + ' 도착!'); renderGate(); save();
    });
    $('#gMakeItem').addEventListener('click', function () {
      var t = $('#gIKind').value, it = makeItem({ kind: t === 'armor' ? 'armor' : 'weapon', type: t, tier: $('#gITier').value });
      S.items.push(it); addLog('✨ 신이 빚은 <b>' + esc(it.name) + '</b>(' + TIER_LABEL[it.tier] + ')'); toast('✨ ' + it.name); renderItems(); save();
    });
    $('#gGold').addEventListener('click', function () { S.gold += 10000; renderHead(); renderTown(); save(); });
    $('#gGem').addEventListener('click', function () { S.gems += 10; renderHead(); save(); });
    $('#gMats').addEventListener('click', function () { S.mats.wood += 100; S.mats.ore += 100; renderHead(); save(); });
    $('#gZoneUp').addEventListener('click', function () { S.zone++; S.zoneKills = 0; S.bossDone = false; F.mons = []; renderHead(); save(); });
    $('#gExport').addEventListener('click', function () { $('#gData').value = JSON.stringify(S); $('#gData').select(); toast('아래 칸의 내용을 복사해 두세요'); });
    $('#gImport').addEventListener('click', function () { try { var s = JSON.parse($('#gData').value); if (!s || !s.hunters) throw 0; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); location.reload(); } catch (e) { toast('저장 데이터 형식이 아니에요'); } });
    $('#gReset').addEventListener('click', function () { if (!confirm('정말 전부 지울까요? 되돌릴 수 없어요.')) return; localStorage.removeItem(SAVE_KEY); location.reload(); });
    if (location.hash === '#god') setTimeout(openGod, 300);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); else { last = 0; offlineCatchUp(); renderAll(); } });
    window.addEventListener('pagehide', save);
  }

  // ---------- 시작 ----------
  S = load();
  fillGodSelects(); resizeCanvas(); bind();
  S.hunters.forEach(function (h) { if (h.status === 'hunt' && (!h.y || h.y < F.top)) { h.x = 14; h.y = rnd(F.top + 10, F.h - 10); } });
  checkMission(); offlineCatchUp(); renderAll();
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__ht = { S: S, F: F, makeHunter: makeHunter, makeItem: makeItem, save: save }; // 테스트·디버그용
})();
