/* 헌터 마을 — 나만의 방치형 헌터 타이쿤 (v3: 마을·상점·정비·옵션·절전/오프라인).
 * 서버 없이 이 기기 브라우저(localStorage)에만 저장합니다.
 * 구성: 데이터 정의 → 생성 → 시뮬레이션(사냥터 / 마을 정비) → 픽셀 그리기 → 화면(DOM) → 신 모드 → 시작
 * 경제: 몬스터 골드·잡템은 헌터 개인 것. 마을(사용자) 수입은 잡템 판매 세금 + 헌터들이 상점에서 쓰는 돈. */
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
  // 장비 옵션: 등급별로 개수와 수치 범위가 다르다 (파밍 요소)
  var OPTS = [
    { k: 'atk', nm: '공격력', u: '%' }, { k: 'aspd', nm: '공격속도', u: '%' }, { k: 'mspd', nm: '이동속도', u: '%' },
    { k: 'crit', nm: '치명타', u: '%p' }, { k: 'cdmg', nm: '치명타 피해', u: '%' }, { k: 'hp', nm: '체력', u: '%' },
    { k: 'def', nm: '방어력', u: '%' }, { k: 'gold', nm: '골드 획득', u: '%' }, { k: 'exp', nm: '경험치', u: '%' },
    { k: 'drop', nm: '드롭률', u: '%' }, { k: 'ls', nm: '흡혈', u: '%' }
  ];
  var OPT_COUNT = { C: 0, B: 1, A: 2, S: 3, SP: 4 };
  var OPT_RANGE = { C: [0, 0], B: [2, 5], A: [3, 8], S: [5, 12], SP: [8, 18] };
  var ENH_CHANCE = [100, 95, 90, 80, 70, 60, 50, 40, 30, 20];
  var JUNK = [{ nm: '가죽', v: 3 }, { nm: '이빨', v: 4 }, { nm: '뼛조각', v: 5 }, { nm: '깃털', v: 3 }, { nm: '약초', v: 4, herb: true }, { nm: '마석 조각', v: 9 }];
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
    { nm: '초원', mons: ['슬라임', '들쥐', '고블린'], base: '#2f4a2a', light: '#3a5a33', dark: '#25391f', path: '#5a4a32', mon: ['#7bd37b', '#a88a6a', '#7aa04f'], boss: '고블린 대장', deco: 'grass' },
    { nm: '숲', mons: ['늑대', '거미', '오크'], base: '#22392a', light: '#2b4a33', dark: '#192b1f', path: '#4a3f2a', mon: ['#8a8f9a', '#4a4a5a', '#5f8a3a'], boss: '오크 족장', deco: 'forest' },
    { nm: '동굴', mons: ['박쥐', '스켈레톤', '트롤'], base: '#2a2d38', light: '#353946', dark: '#1f2129', path: '#3f3a3a', mon: ['#5a4a7a', '#d8d8c8', '#6a7a5a'], boss: '트롤 왕', deco: 'cave' },
    { nm: '화산', mons: ['도마뱀', '임프', '골렘'], base: '#3a2420', light: '#4a2e26', dark: '#2a1a16', path: '#5a3a2a', mon: ['#d06a3a', '#c03a3a', '#6a5a5a'], boss: '용암 골렘', deco: 'lava' },
    { nm: '심연', mons: ['그림자', '악마', '와이번'], base: '#1f1830', light: '#2a2040', dark: '#161022', path: '#3a2e50', mon: ['#3a3050', '#8a2a5a', '#5a3a8a'], boss: '심연의 드래곤', deco: 'abyss' }
  ];
  var ZONE_KILLS = 20;
  var BUILDINGS = [
    { id: 'inn', nm: '숙소', ic: '🏠', col: '#8a4a30', roof: '#c2552f', max: 20, base: 150, desc: function (lv) { return lv ? '헌터 정원 ' + (3 + lv) + '명' : '헌터 정원 3명'; }, fx: 0.18, fy: 0.3 },
    { id: 'forge', nm: '대장간', ic: '🔥', col: '#4a4a52', roof: '#2e2e36', max: 10, base: 200, desc: function (lv) { return lv ? '제작 등급 ↑ · 강화 성공률 +' + lv * 2 + '%' : '장비 제작·강화'; }, fx: 0.5, fy: 0.28 },
    { id: 'camp', nm: '훈련소', ic: '🎯', col: '#5a6a3a', roof: '#3a4a22', max: 20, base: 150, desc: function (lv) { return '경험치 +' + lv * 10 + '%'; }, fx: 0.82, fy: 0.3 },
    { id: 'potion', nm: '물약상점', ic: '🧪', col: '#3a6a6a', roof: '#2a8a7a', max: 10, base: 120, desc: function (lv) { return lv ? '헌터가 물약을 사 감 · 재고 최대 ' + (10 + lv * 5) : '헌터에게 물약 판매'; }, fx: 0.18, fy: 0.6 },
    { id: 'shrine', nm: '회복의 성소', ic: '⛲', col: '#6a7a9a', roof: '#4a5a8a', max: 10, base: 180, desc: function (lv) { return lv ? '쓰러진 뒤 회복 ' + Math.round((1 - restMul(lv)) * 100) + '% 빠름' : '쓰러진 헌터 회복 가속'; }, fx: 0.5, fy: 0.58 },
    { id: 'weapon', nm: '무기상점', ic: '🗡️', col: '#7a3a3a', roof: '#a03a2a', max: 10, base: 180, desc: function (lv) { return lv ? '진열 ' + (2 + lv) + '칸 · 헌터가 무기 구매' : '헌터에게 무기 판매'; }, fx: 0.82, fy: 0.6 },
    { id: 'armor', nm: '방어구상점', ic: '🛡️', col: '#3a4a7a', roof: '#2a5aa0', max: 10, base: 180, desc: function (lv) { return lv ? '진열 ' + (2 + lv) + '칸 · 헌터가 갑옷 구매' : '헌터에게 갑옷 판매'; }, fx: 0.33, fy: 0.8 },
    { id: 'market', nm: '잡화상', ic: '🧺', col: '#8a6a3a', roof: '#c08a3a', max: 10, base: 100, desc: function (lv) { return lv ? '잡템 매입가 +' + lv * 5 + '% · 세금 ' + (10 + lv) + '%' : '헌터 잡템 매입'; }, fx: 0.67, fy: 0.8 }
  ];
  function bld(id) { return BUILDINGS.find(function (b) { return b.id === id; }); }
  function restMul(lv) { return Math.max(0.3, 1 - lv * 0.08); }
  function buildCost(b, lv) { return Math.floor(b.base * Math.pow(1.7, lv)); }
  var LINES = {
    idle: ['오늘 날씨 좋다~', '장비 좀 바꿔 주면 안 돼?', '배고프다…', '마을이 점점 커지네!', '다음엔 내가 보스 잡을 거야', '밥 먹고 하자', '심심하다…', '오늘은 뭐 주울까?', '부자 될 거야!', '열심히 벌어서 집 사야지', '죽기 딱 좋은 날씨네…', '레벨 올리러 가야지~'],
    kill: ['이 정도쯤이야!', '하나 더!', '돈 벌었다~', '좋았어!', '별거 아니네', '다음!'],
    lowhp: ['아야야…', '위험해!', '누가 좀 도와줘!', '물약 어디 갔지…', '으… 아파'],
    down: ['으윽… 잠깐만 쉴게…', '다음엔 안 져…', '아이고, 삭신이야…'],
    levelup: ['더 강해진 기분이야!', '레벨 업!', '이제 좀 할 만하다'],
    item: ['이거 괜찮은데?', '오, 좋은 거 주웠다!', '이거 팔면 얼마지?'],
    equip: ['새 장비! 마음에 들어', '이제 진짜 시작이다', '오, 손에 착 감기네'],
    arrive: ['여기가 그 마을인가요?', '저 좀 써 주세요!', '실력은 확실합니다', '방 있어요?'],
    rested: ['다시 간다!', '푹 쉬었어', '이번엔 안 다칠 거야'],
    sell: ['부자가 된 기분이야!', '하나도 못 팔았어…', '이거 다 얼마야?', '열심히 벌어서 부자돼야지!'],
    potion: ['물약 좀 사 가자', '링겔 좀 맞을까?', '약이 비싸네…', '이거면 충분해'],
    nopotion: ['물약이 없잖아!', '재고 좀 채워 줘요~', '빈손으로 가야 하나…'],
    shop: ['구입할 게 없네', '이거 사도 될까?', '음… 안 살래', '돈이 모자라…'],
    buy: ['이거 샀다!', '새 장비 득템!', '잘 쓸게요!'],
    leave: ['사냥 가자!', '다녀올게~', '오늘도 열심히!', '가보자고'],
    back: ['돌아왔다!', '가방이 꽉 찼어', '휴, 힘들었다']
  };
  var DEFAULT_CFG = { spawnMin: 10, gateCap: 3, tierW: [40, 30, 18, 9, 3], expMul: 1, goldMul: 1, monMul: 1, dropPct: 8, restSec: 60, capBonus: 0, shake: 1, hitstop: 1, particles: 1, sound: true, offPct: 50, offHours: 24 };
  var MISSION = { kills: 30, accept: 1, sales: 5 };

  // ---------- 상태 ----------
  var S = null;
  function fresh() {
    return {
      v: 3, gold: 300, gems: 3, mats: { wood: 10, ore: 10, herb: 5 }, hunters: [], gate: [], items: [],
      town: { inn: 1, forge: 1, camp: 0, shrine: 0, potion: 1, weapon: 0, armor: 0, market: 1 },
      shops: { potionStock: 5, potionPrice: 15, weapon: [], armor: [], brew: 0 },
      zone: 1, zoneKills: 0, bossDone: false, lastTick: Date.now(), nextSpawnAt: Date.now() + 20000,
      cfg: JSON.parse(JSON.stringify(DEFAULT_CFG)), stats: { kills: 0, arrivals: 0, goldEarned: 0, sales: 0, strikes: 0 }, log: [], chat: [],
      rate: { gold: 0, exp: 0, kills: 0, drops: 0, hgold: 0 }, godSeen: false, shoutUntil: 0, shoutCd: 0,
      daily: { date: today(), kills: 0, accept: 0, sales: 0, claimed: false }
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
      Object.keys(f.town).forEach(function (k) { if (s.town[k] === undefined) s.town[k] = f.town[k]; });
      Object.keys(f.shops).forEach(function (k) { if (s.shops[k] === undefined) s.shops[k] = f.shops[k]; });
      Object.keys(f.stats).forEach(function (k) { if (s.stats[k] === undefined) s.stats[k] = f.stats[k]; });
      if (typeof s.rate !== 'object') s.rate = f.rate;
      if (s.mats.gem) { s.gems += s.mats.gem; delete s.mats.gem; } if (s.mats.herb === undefined) s.mats.herb = 5;
      if (s.daily.sales === undefined) s.daily.sales = 0;
      s.hunters.concat(s.gate).forEach(function (h) {
        if (!h.look) h.look = genLook(); h.target = null; h.cd = 0; h.anim = 0; h.flash = 0; h.y = h.y || 0; h.bubble = null;
        if (h.gold === undefined) h.gold = 0; if (!h.bag) h.bag = []; if (h.potions === undefined) h.potions = 0; if (!h.trip) h.trip = { kills: 0, need: 12 };
        if (!h.phase) h.phase = h.status === 'town' ? (h.auto ? 'sell' : 'idle') : 'sell'; h.act = 0; h.potCd = 0;
        [h.weapon, h.armor].concat(h.bag).forEach(migrateItem);
      });
      s.items.concat(s.shops.weapon, s.shops.armor).forEach(migrateItem);
      return s;
    } catch (e) { return fresh(); }
  }
  function migrateItem(it) { if (it && it.kind && !it.opts) { it.opts = rollOpts(it.tier); it.plus = 0; } }
  var saveTimer = 0;
  function save() { if (window.__ht && window.__ht.lock) return; S.lastTick = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function addLog(txt) { var d = new Date(); var hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); S.log.unshift({ t: hh, txt: txt }); if (S.log.length > 80) S.log.length = 80; ui.dirty.log = true; }
  var toastTimer = 0;
  function toast(msg) { var el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2200); }
  function say(h, kind, force) {
    if (!force && Math.random() > 0.6) return;
    var txt = pick(LINES[kind]);
    S.chat.push({ nm: h.name, c: CLASSES[h.cls].color, txt: txt }); if (S.chat.length > 30) S.chat.shift();
    h.bubble = { txt: txt, until: Date.now() + 2600 }; renderChat();
  }
  function sysChat(txt) { S.chat.push({ sys: true, txt: txt }); if (S.chat.length > 30) S.chat.shift(); renderChat(); }
  function townGold(n, why) { S.gold += n; S.stats.goldEarned += n; }

  // ---------- 생성 ----------
  function weightedTier(w) { var sum = 0, i; for (i = 0; i < 5; i++) sum += w[i]; var r = Math.random() * sum; for (i = 0; i < 5; i++) { r -= w[i]; if (r < 0) return TIERS[i]; } return 'C'; }
  function makeHunter(opt) {
    opt = opt || {};
    var cls = opt.cls || pick(Object.keys(CLASSES)), tier = opt.tier || weightedTier(S.cfg.tierW);
    var traits = [], pool = TRAITS.slice(), n = ri(1, 2);
    while (traits.length < n && pool.length) traits.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].nm);
    var h = { id: uid(), name: opt.name || pick(NAMES), cls: cls, tier: tier, traits: traits, lv: 1, exp: 0, look: genLook(),
      weapon: null, armor: null, status: 'town', phase: 'sell', auto: true, restUntil: 0, kills: 0, hp: 1, gold: 20, bag: [], potions: 0, trip: { kills: 0, need: 12 },
      x: 14, y: 0, cd: 0, anim: 0, flash: 0, target: null, bubble: null, nextTalk: 0, wx: 0, wy: 0, lowSaid: false, act: 0, potCd: 0 };
    recalc(h); h.hp = h.maxHp; return h;
  }
  function traitSum(h, key) { var s = 0; h.traits.forEach(function (nm) { var t = TRAITS.find(function (x) { return x.nm === nm; }); if (t && t[key]) s += t[key]; }); return s; }
  function optSum(h) { var o = {}; OPTS.forEach(function (x) { o[x.k] = 0; }); [h.weapon, h.armor].forEach(function (it) { if (it && it.opts) it.opts.forEach(function (p) { o[p.k] += p.v; }); }); return o; }
  function plusMul(it) { return 1 + (it && it.plus ? it.plus * 0.1 : 0); }
  function recalc(h) {
    var c = CLASSES[h.cls], m = TIER_MUL[h.tier], g = Math.pow(1.07, h.lv - 1), o = optSum(h);
    h.maxHp = Math.round((100 * c.hp * m * g * (1 + traitSum(h, 'hp')) + (h.armor ? h.armor.hp * plusMul(h.armor) : 0)) * (1 + o.hp / 100));
    h.atk = Math.round((10 * c.atk * m * g * (1 + traitSum(h, 'atk')) + (h.weapon ? h.weapon.atk * plusMul(h.weapon) : 0)) * (1 + o.atk / 100));
    h.def = (3 * c.def * m * g + (h.armor ? h.armor.def * plusMul(h.armor) : 0)) * (1 + traitSum(h, 'def')) * (1 + o.def / 100);
    h.spd = c.spd * (1 + traitSum(h, 'spd')) * (1 + o.aspd / 100);
    h.mspd = 1 + o.mspd / 100;
    h.crit = 5 + TIER_IDX[h.tier] * 3 + traitSum(h, 'crit') + o.crit;
    h.cdmg = 2 + o.cdmg / 100;
    h.goldB = traitSum(h, 'gold') + o.gold / 100; h.expB = traitSum(h, 'exp') + o.exp / 100; h.dropB = o.drop / 100; h.ls = o.ls / 100;
    h.range = c.range;
    if (h.hp > h.maxHp) h.hp = h.maxHp;
  }
  function expNeed(lv) { return Math.floor(30 * Math.pow(lv, 1.5)); }
  function rollOpts(tier) {
    var n = OPT_COUNT[tier] || 0, pool = OPTS.slice(), out = [], r = OPT_RANGE[tier];
    while (out.length < n && pool.length) { var o = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; out.push({ k: o.k, v: ri(r[0], r[1]) }); }
    return out;
  }
  function makeItem(opt) {
    opt = opt || {};
    var kind = opt.kind || (Math.random() < 0.65 ? 'weapon' : 'armor');
    var type = kind === 'armor' ? 'armor' : (opt.type || pick(['sword', 'bow', 'staff', 'mace']));
    var tier = opt.tier || weightedTier(opt.w || [45, 30, 16, 7, 2]);
    var m = TIER_MUL[tier] * (1 + (S.zone - 1) * 0.18) * rnd(0.9, 1.15);
    var it = { id: uid(), kind: kind, type: type, tier: tier, name: TIER_PREFIX[tier] + ' ' + WEAPON_NOUN[type], opts: rollOpts(tier), plus: 0 };
    if (kind === 'weapon') it.atk = Math.round(6 * m); else { it.def = Math.round(3 * m); it.hp = Math.round(25 * m); }
    return it;
  }
  function makeJunk() { var j = pick(JUNK); return { id: uid(), junk: true, nm: j.nm, herb: !!j.herb, v: Math.round(j.v * (1 + (S.zone - 1) * 0.25)) }; }
  function itemValue(it) { return Math.floor(20 * TIER_MUL[it.tier] * TIER_MUL[it.tier] * (1 + (S.zone - 1) * 0.1) * (1 + (it.plus || 0) * 0.3) + (it.opts ? it.opts.length * 8 : 0)); }
  function itemScore(it) { if (!it) return 0; var base = it.kind === 'weapon' ? it.atk : it.def * 2 + it.hp / 5; var o = 0; (it.opts || []).forEach(function (p) { o += p.v; }); return base * plusMul(it) + o * 0.6; }
  function optName(k) { return OPTS.find(function (o) { return o.k === k; }); }
  function optsHtml(it) { return (it.opts && it.opts.length) ? '<div class="opt">' + it.opts.map(function (p) { var o = optName(p.k); return o.nm + ' +' + p.v + (o.u === '%p' ? '%' : '%'); }).join(' · ') + '</div>' : ''; }
  function itemName(it) { return esc(it.name) + (it.plus ? ' <span class="plus">+' + it.plus + '</span>' : ''); }
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

  // ---------- 시뮬레이션 ----------
  var F = { w: 130, h: 118, top: 26, mons: [], shots: [], fx: [], shake: 0, freeze: 0, spawnCd: 1, ctx: null, pix: 3, terrain: null, terrainZone: 0, townMap: null, townKey: '', time: 0 };
  function capacity() { return 3 + S.town.inn + (S.cfg.capBonus | 0); }
  function hunting() { return S.hunters.filter(function (h) { return h.status === 'hunt'; }); }
  function inTown() { return S.hunters.filter(function (h) { return h.status === 'town'; }); }
  function tierFx(tier) { return 1 + TIER_IDX[tier] * 0.6; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function moveToward(e, tx, ty, sp, dt) { var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1; var s = Math.min(d, sp * dt); e.x += dx / d * s; e.y += dy / d * s; e.walk = (e.walk || 0) + dt * 8; return d - s; }
  function townSpot(id) { var b = bld(id); return { x: Math.round(F.w * b.fx), y: Math.round(F.top + (F.h - F.top) * b.fy) + 4 }; }
  function gateSpot() { return { x: F.w - 6, y: Math.round((F.top + F.h) / 2) }; }
  function shoutOn() { return Date.now() < S.shoutUntil; }

  function step(dt) {
    var now = Date.now(); F.time += dt;
    S.hunters.forEach(function (h) {
      if (h.bubble && now > h.bubble.until) h.bubble = null;
      h.anim = Math.max(0, h.anim - dt); h.flash = Math.max(0, h.flash - dt); h.potCd = Math.max(0, h.potCd - dt);
      if (h.status === 'rest' && now >= h.restUntil) {
        h.hp = h.maxHp; h.status = 'town'; h.phase = h.auto ? 'sell' : 'idle'; var g = gateSpot(); h.x = g.x; h.y = g.y; h.target = null; h.lowSaid = false;
        addLog('<b>' + esc(h.name) + '</b> 회복 완료' + (h.auto ? ', 정비 시작' : '')); if (h.auto) say(h, 'rested', true);
        ui.dirty.hunters = true;
      }
      if (h.status === 'town') stepTown(h, dt);
    });
    var hs = hunting();
    var maxMon = S.bossDone ? 0 : Math.min(6, 3 + Math.floor(S.zone / 3));
    var bossTime = S.zoneKills >= ZONE_KILLS && !S.bossDone;
    if (hs.length) {
      F.spawnCd -= dt;
      if (bossTime) { if (F.mons.length === 0) { F.mons.push(makeMonster(true)); addLog('⚠️ <b>' + esc(zoneInfo(S.zone).boss) + '</b> 등장!'); sysChat('⚠️ ' + zoneInfo(S.zone).boss + '이(가) 나타났다!'); } }
      else if (F.mons.length < maxMon && F.spawnCd <= 0) { F.mons.push(makeMonster(false)); F.spawnCd = rnd(0.8, 1.8); }
    }
    hs.forEach(function (h) {
      if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.004 * dt);
      if (h.hp / h.maxHp < 0.4 && h.potions > 0 && h.potCd <= 0) { h.potions--; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.5); h.potCd = 3; F.fx.push({ kind: 'num', x: h.x, y: h.y - 16, txt: '🧪', color: '#7fd3c0', size: 7, t: 0, life: 0.9 }); }
      if (h.hp / h.maxHp < 0.3 && !h.lowSaid) { h.lowSaid = true; say(h, 'lowhp'); } else if (h.hp / h.maxHp > 0.6) h.lowSaid = false;
      if (F.time > h.nextTalk) { h.nextTalk = F.time + rnd(12, 30); say(h, 'idle', true); }
      // 돌아갈 때: 목표 처치 수 채움 / 가방 가득 / 체력 낮은데 물약 없음
      if (h.trip.kills >= h.trip.need || h.bag.length >= 10 || (h.hp < h.maxHp * 0.25 && h.potions === 0)) { goHome(h); return; }
      var tgt = null, best = 1e9;
      F.mons.forEach(function (m) { if (m.hp <= 0 || m.x > F.w - 8) return; var d = dist(h, m); if (d < best) { best = d; tgt = m; } });
      h.target = tgt;
      if (!tgt) {
        if (!h.wx || dist(h, { x: h.wx, y: h.wy }) < 2) { h.wx = rnd(24, F.w * 0.6); h.wy = rnd(F.top + 6, F.h - 6); }
        if (Math.random() < 0.6) moveToward(h, h.wx, h.wy, 9 * h.mspd, dt);
        return;
      }
      if (best > h.range) { moveToward(h, tgt.x - (h.range - 3), tgt.y, 22 * h.mspd, dt); return; }
      h.cd -= dt * h.spd * (shoutOn() ? 1.4 : 1); if (h.cd <= 0) { h.cd = 1; attack(h, tgt); }
    });
    for (var a = 0; a < hs.length; a++) for (var b = a + 1; b < hs.length; b++) {
      var d = dist(hs[a], hs[b]); if (d < 8 && d > 0) { var dx = (hs[b].x - hs[a].x) / d, dy = (hs[b].y - hs[a].y) / d, p = (8 - d) * 0.5; hs[a].x -= dx * p; hs[a].y -= dy * p; hs[b].x += dx * p; hs[b].y += dy * p; }
    }
    hs.forEach(function (h) { h.x = clamp(h.x, 12, F.w - 18); h.y = clamp(h.y, F.top + 2, F.h - 4); });
    F.mons.forEach(function (m) {
      m.anim = Math.max(0, m.anim - dt); m.flash = Math.max(0, m.flash - dt);
      var tgt = null, best = 1e9;
      hs.forEach(function (h) { var d = dist(m, h); if (d < best) { best = d; tgt = h; } });
      if (!tgt) { if (m.x > F.w - 14) moveToward(m, F.w - 14, m.y, 13, dt); return; }
      if (best > 7) { moveToward(m, tgt.x + 5, tgt.y, m.boss ? 9 : 13, dt); return; }
      m.cd -= dt * m.spd; if (m.cd <= 0) { m.cd = 1; monsterHit(m, tgt); }
    });
    F.mons.forEach(function (m) { m.y = clamp(m.y, F.top + 2, F.h - 4); });
    for (var i = F.shots.length - 1; i >= 0; i--) {
      var s = F.shots[i]; s.t += dt;
      var tx = s.tgt.x, ty = s.tgt.y - 5, ddx = tx - s.x, ddy = ty - s.y, dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      s.dx = ddx / dd; s.dy = ddy / dd; var mv = s.sp * dt;
      if (dd <= mv || s.t > 1.5) { F.shots.splice(i, 1); if (s.tgt.hp > 0) land(s.src, s.tgt, s.dmg, s.crit, s.type, s.tier); }
      else { s.x += s.dx * mv; s.y += s.dy * mv; }
    }
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
  // ---- 마을 정비: 잡템 판매 → 물약 → 무기·방어구 상점 → 출발 ----
  function stepTown(h, dt) {
    if (!h.auto || h.phase === 'idle') {
      h.phase = 'idle'; var c = townSpot('shrine');
      if (!h.wx || dist(h, { x: h.wx, y: h.wy }) < 2) { h.wx = c.x + rnd(-18, 18); h.wy = c.y + rnd(-6, 10); }
      if (Math.random() < 0.4) moveToward(h, h.wx, h.wy, 7, dt);
      if (F.time > h.nextTalk) { h.nextTalk = F.time + rnd(15, 35); say(h, 'idle', true); }
      return;
    }
    var spotId = { sell: 'market', potion: 'potion', shop: h.shopStep ? 'armor' : 'weapon', ready: null }[h.phase];
    var spot = spotId ? townSpot(spotId) : gateSpot();
    if (spotId && !S.town[spotId]) { nextPhase(h); return; } // 안 지은 건물은 건너뜀
    if (spotId) spot = { x: spot.x + (h.phase === 'shop' ? 6 : -6), y: spot.y + 3 };
    var left = moveToward(h, spot.x, spot.y, 16 * h.mspd, dt);
    if (left > 1.5) return;
    if (!h.act) { h.act = 1.2; h.bubble = { txt: { sell: '🧺 잡템 팔기', potion: '🧪 물약 사기', shop: h.shopStep ? '🛡️ 방어구 구경' : '🗡️ 무기 구경', ready: '⚔️ 출발!' }[h.phase], until: Date.now() + 1300 }; return; }
    h.act -= dt; if (h.act > 0) return;
    h.act = 0; doPhase(h); nextPhase(h);
  }
  function nextPhase(h) {
    if (h.phase === 'sell') h.phase = 'potion';
    else if (h.phase === 'potion') { h.phase = 'shop'; h.shopStep = 0; }
    else if (h.phase === 'shop') { if (!h.shopStep) h.shopStep = 1; else { h.phase = 'ready'; h.shopStep = 0; } }
    else if (h.phase === 'ready') { /* doPhase 에서 출발 */ }
    ui.dirty.hunters = true;
  }
  function doPhase(h) {
    if (h.phase === 'sell') {
      var junk = h.bag.filter(function (b) { return b.junk; }), gear = h.bag.filter(function (b) { return !b.junk; });
      var lvM = S.town.market, total = 0, herbs = 0;
      junk.forEach(function (j) { total += Math.round(j.v * (1 + lvM * 0.05)); if (j.herb) herbs++; });
      gear.forEach(function (it) { // 주운 장비: 지금 것보다 좋으면 장착, 아니면 헐값에 판다
        var slot = it.kind, ok = it.kind === 'armor' || it.type === CLASSES[h.cls].weapon;
        if (ok && itemScore(it) > itemScore(h[slot])) { if (h[slot]) S.items.push(h[slot]); h[slot] = it; recalc(h); addLog('🧷 <b>' + esc(h.name) + '</b> 주운 <b>' + esc(it.name) + '</b> 장착'); say(h, 'equip'); }
        else total += Math.floor(itemValue(it) * 0.5);
      });
      h.bag = [];
      if (total > 0) {
        var tax = Math.round(total * (0.1 + lvM * 0.01)); h.gold += total - tax; townGold(tax); S.mats.herb += herbs;
        sysChat('🧺 ' + h.name + '이(가) 잡템 ' + junk.length + '개를 팔아 🪙' + fmt(total - tax) + ' (세금 🪙' + tax + (herbs ? ', 🌿' + herbs : '') + ')');
        say(h, 'sell');
      } else say(h, 'sell', false);
    } else if (h.phase === 'potion') {
      var need = 3 - h.potions, price = S.shops.potionPrice, n = Math.max(0, Math.min(need, S.shops.potionStock, Math.floor(h.gold / price)));
      if (n > 0) { h.potions += n; h.gold -= n * price; S.shops.potionStock -= n; townGold(n * price); S.stats.sales += n; S.daily.sales += n; sysChat('🧪 ' + h.name + '이(가) 물약 ' + n + '개 구매 → 마을 금고 +🪙' + n * price); say(h, 'potion'); checkMission(); ui.dirty.shop = true; }
      else if (need > 0 && S.shops.potionStock <= 0) say(h, 'nopotion', true);
      else say(h, 'potion');
    } else if (h.phase === 'shop') {
      var shelfId = h.shopStep ? 'armor' : 'weapon', shelf = S.shops[shelfId], best = null;
      shelf.forEach(function (it) { if (it.kind === 'weapon' && it.type !== CLASSES[h.cls].weapon) return; if (it.price > h.gold) return; if (itemScore(it) <= itemScore(h[it.kind])) return; if (!best || itemScore(it) > itemScore(best)) best = it; });
      if (best) {
        S.shops[shelfId] = shelf.filter(function (x) { return x !== best; }); h.gold -= best.price; townGold(best.price); S.stats.sales++; S.daily.sales++;
        if (h[best.kind]) S.items.push(h[best.kind]); delete best.price; h[best.kind] = best; recalc(h);
        addLog('🛒 <b>' + esc(h.name) + '</b>이(가) <b>' + esc(best.name) + '</b>(' + TIER_LABEL[best.tier] + ') 구매 → 금고 +🪙' + fmt(S.gold)); sysChat('🛒 ' + h.name + '이(가) ' + best.name + '(' + TIER_LABEL[best.tier] + ')을(를) 샀다! 금고 +🪙' + fmt(itemValue(best) * 2));
        say(h, 'buy', true); h.flash = 0.2; checkMission(); ui.dirty.shop = true; ui.dirty.items = true;
      } else if (shelf.length) say(h, 'shop');
    } else if (h.phase === 'ready') {
      h.status = 'hunt'; h.x = 14; h.y = rnd(F.top + 10, F.h - 10); h.trip = { kills: 0, need: 10 + h.lv * 2 }; h.lowSaid = false; h.target = null;
      say(h, 'leave'); ui.dirty.hunters = true;
    }
  }
  function goHome(h) {
    h.status = 'town'; h.phase = 'sell'; var g = gateSpot(); h.x = g.x; h.y = g.y; h.target = null; h.act = 0;
    say(h, 'back'); ui.dirty.hunters = true;
  }
  function attack(h, m) {
    h.anim = 0.25;
    var crit = Math.random() * 100 < h.crit;
    var dmg = Math.max(1, Math.round(h.atk * rnd(0.85, 1.15) - m.def * 0.5)); if (crit) dmg = Math.round(dmg * h.cdmg);
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
    if (h && h.ls > 0) h.hp = Math.min(h.maxHp, h.hp + dmg * h.ls);
    var power = (tier ? tierFx(tier) : 0.7) * (crit ? 1.5 : 1), c = S.cfg;
    F.shake = Math.max(F.shake, 1.2 * power * c.shake);
    F.freeze = Math.max(F.freeze, 0.012 * power * c.hitstop);
    var n = Math.round(4 * power * c.particles), col = tier ? TIER_COLOR[tier] : '#fff';
    for (var i = 0; i < n; i++) F.fx.push({ kind: 'spark', x: m.x, y: m.y - 5, vx: rnd(-40, 40) * power, vy: rnd(-60, -10) * power, color: col, t: 0, life: rnd(0.3, 0.6) });
    F.fx.push({ kind: 'num', x: m.x + rnd(-3, 3), y: m.y - 12, txt: String(dmg) + (crit ? '!' : ''), color: crit ? '#ffd34f' : (h ? '#fff' : '#ff9a3c'), size: clamp(6 + Math.log(dmg + 1) * 0.9 + (crit ? 2 : 0), 6, 12), t: 0, life: 0.8 });
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
      say(h, 'down', true); toast('💫 ' + h.name + ' 쓰러짐! 회복 중'); ui.dirty.hunters = true;
    }
  }
  function kill(h, m) {
    if (!h) { var near = null, bd = 1e9; hunting().forEach(function (x) { var d = dist(x, m); if (d < bd) { bd = d; near = x; } }); h = near; }
    S.stats.kills++; S.daily.kills++;
    if (!S.bossDone && S.zoneKills < ZONE_KILLS && !m.boss) S.zoneKills++;
    if (h) {
      var gold = Math.round(m.gold * S.cfg.goldMul * (1 + h.goldB));
      h.gold += gold; h.kills++; h.trip.kills++;
      var expBase = m.exp * S.cfg.expMul * (1 + S.town.camp * 0.1);
      gainExp(h, expBase * (1 + h.expB));
      hunting().forEach(function (o) { if (o !== h) gainExp(o, expBase * 0.3 * (1 + o.expB)); });
      F.fx.push({ kind: 'num', x: m.x, y: m.y - 18, txt: '+' + gold, color: '#ffd34f', size: 6, t: 0, life: 1 });
      if (Math.random() < 0.15) say(h, 'kill', true);
      if (Math.random() < 0.6 + h.dropB && h.bag.length < 10) h.bag.push(makeJunk());
      if (Math.random() < 0.02 + S.zone * 0.004) { S.gems += 1; sysChat('💎 ' + h.name + '이(가) 보석을 주웠다! (마을에 바침)'); }
      var dropP = (m.boss ? 1 : S.cfg.dropPct / 100) * (1 + h.dropB);
      if (Math.random() < dropP) {
        var z = S.zone, w = [Math.max(5, 45 - z * 3), 30, 16 + z * 1.5, 7 + z, 2 + z * 0.5]; if (m.boss) w = [0, 20, 40, 30, 10];
        var it = makeItem({ w: w }); if (h.bag.length < 10) h.bag.push(it); else S.items.push(it);
        addLog('🎁 <b>' + esc(h.name) + '</b>이(가) <b>' + esc(it.name) + '</b>(' + TIER_LABEL[it.tier] + (it.opts.length ? ', 옵션 ' + it.opts.length : '') + ') 획득');
        sysChat('🎁 ' + h.name + '이(가) ' + it.name + '(' + TIER_LABEL[it.tier] + ')을(를) 주웠다'); say(h, 'item'); rateAcc.drops++;
      }
    } else { townGold(Math.round(m.gold * S.cfg.goldMul)); if (Math.random() < 0.3) S.mats.wood++; }
    if (Math.random() < 0.3) S.mats.wood += 1; if (Math.random() < 0.2) S.mats.ore += 1;
    if (m.boss) {
      S.bossDone = true; addLog('🏆 <b>' + esc(m.nm) + '</b> 처치! 다음 구역이 열렸다'); toast('🏆 보스 처치! 다음 구역으로'); sysChat('🏆 ' + m.nm + ' 처치! 다음 구역으로 간다');
      setTimeout(function () { S.zone++; S.zoneKills = 0; S.bossDone = false; ui.dirty.hunters = true; save(); }, 1500);
    }
    rateAcc.kills++; ui.dirty.head = true; checkMission();
  }
  function gainExp(h, e) {
    h.exp += e; rateAcc.exp += e; var up = false;
    while (h.exp >= expNeed(h.lv)) { h.exp -= expNeed(h.lv); h.lv++; up = true; }
    if (up) { recalc(h); h.hp = h.maxHp; F.fx.push({ kind: 'num', x: h.x, y: h.y - 18, txt: 'LV UP!', color: '#6fb3ff', size: 7, t: 0, life: 1.2 }); addLog('⬆️ <b>' + esc(h.name) + '</b> Lv.' + h.lv + ' 달성'); say(h, 'levelup'); ui.dirty.hunters = true; }
  }
  // 촌장의 일격: 사냥터에서 몬스터를 탭
  function chiefStrike(x, y) {
    var tgt = null, best = 14;
    F.mons.forEach(function (m) { var d = Math.sqrt((m.x - x) * (m.x - x) + (m.y - 6 - y) * (m.y - 6 - y)); if (d < best) { best = d; tgt = m; } });
    if (!tgt) return false;
    var dmg = Math.max(3, Math.round(tgt.maxHp * 0.08 + zoneScale(S.zone) * 4));
    S.stats.strikes++;
    F.fx.push({ kind: 'num', x: tgt.x, y: tgt.y - 20, txt: '⚡', color: '#ffe9a8', size: 9, t: 0, life: 0.5 });
    land(null, tgt, dmg, false, 'mace', 'SP'); return true;
  }
  function shout() {
    var now = Date.now(); if (now < S.shoutCd) return toast('함성은 ' + Math.ceil((S.shoutCd - now) / 1000) + '초 뒤에');
    if (!hunting().length) return toast('사냥 중인 헌터가 없어요');
    S.shoutUntil = now + 20000; S.shoutCd = now + 90000;
    sysChat('📣 촌장의 함성! 20초 동안 공격 속도 +40%'); hunting().forEach(function (h) { h.bubble = { txt: pick(['우오오!', '가자!', '힘난다!']), until: now + 1500 }; });
    renderHead();
  }
  // 오늘 할 일
  function checkMission() {
    var d = S.daily;
    if (d.date !== today()) S.daily = d = { date: today(), kills: 0, accept: 0, sales: 0, claimed: false };
    if (!d.claimed && d.kills >= MISSION.kills && d.accept >= MISSION.accept && d.sales >= MISSION.sales) {
      d.claimed = true; var g = 200 * S.zone; S.gems += 2; townGold(g);
      addLog('✅ 오늘 할 일 완료! 💎2 🪙' + g + ' 보상'); toast('✅ 오늘 할 일 완료! 💎2 🪙' + fmt(g)); sysChat('✅ 오늘 할 일을 다 했다! 보상 💎2 🪙' + fmt(g));
    }
    ui.dirty.mission = true;
  }
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
      toast('🚪 새 헌터 ' + last.name + ' 도착! 대기소를 확인하세요'); ui.dirty.gate = true;
    }
    return changed;
  }
  // 수입률(분당) 측정 — 오프라인 정산에 쓴다
  var rateAcc = { gold: 0, exp: 0, kills: 0, drops: 0, hgold: 0, t: 0, goldAt: 0, hgoldAt: 0 };
  function sumHunterGold() { var s = 0; S.hunters.forEach(function (h) { s += h.gold; }); return s; }
  function trackRate(dt) {
    rateAcc.t += dt;
    if (rateAcc.t >= 60) {
      var active = S.hunters.length > 0, r = S.rate, k = 0.5;
      var g = Math.max(0, S.stats.goldEarned - rateAcc.goldAt), hg = Math.max(0, sumHunterGold() - rateAcc.hgoldAt);
      if (active) { r.gold = r.gold * k + g * (1 - k); r.exp = r.exp * k + rateAcc.exp * (1 - k); r.kills = r.kills * k + rateAcc.kills * (1 - k); r.drops = r.drops * k + rateAcc.drops * (1 - k); r.hgold = r.hgold * k + hg * (1 - k); }
      rateAcc.goldAt = S.stats.goldEarned; rateAcc.hgoldAt = sumHunterGold(); rateAcc.exp = rateAcc.kills = rateAcc.drops = 0; rateAcc.t = 0;
    }
  }
  function offlineCatchUp() {
    var now = Date.now(), elapsed = now - S.lastTick;
    if (elapsed < 120000) return;
    var capMin = S.cfg.offHours * 60, mins = Math.min(elapsed / 60000, capMin), pct = S.cfg.offPct / 100, before = S.gate.length;
    spawnTick(now);
    var arrived = S.gate.length - before, r = S.rate, active = S.hunters.filter(function (h) { return h.status !== 'rest' || true; });
    var gold = Math.floor(r.gold * mins * pct), kills = Math.floor(r.kills * mins * pct), drops = Math.floor(r.drops * mins * pct + (Math.random() < (r.drops * mins * pct) % 1 ? 1 : 0));
    var n = S.hunters.length, expEach = n ? r.exp * mins * pct / n : 0, hgEach = n ? r.hgold * mins * pct / n : 0;
    if (n) { townGold(gold); S.stats.kills += kills; S.hunters.forEach(function (h) { gainExp(h, expEach); h.gold += Math.floor(hgEach); }); }
    var got = [];
    for (var i = 0; i < Math.min(drops, 20); i++) { var it = makeItem(); S.items.push(it); got.push(it); }
    S.hunters.forEach(function (h) { h.restUntil = Math.min(h.restUntil, now); });
    var hrs = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    var txt = (hrs ? hrs + '시간 ' : '') + mm + '분 동안 (오프라인 보상 ' + S.cfg.offPct + '%' + (elapsed / 60000 > capMin ? ', 최대 ' + S.cfg.offHours + '시간까지만' : '') + ')\n';
    txt += arrived ? '헌터 ' + arrived + '명이 대기소에 왔고\n' : '새 헌터는 없었고\n';
    txt += n ? '몬스터 ' + fmt(kills) + '마리 처치, 마을 금고 +🪙' + fmt(gold) + (got.length ? ', 장비 ' + got.length + '개가 창고에' : '') : '헌터가 없어 사냥은 없었습니다';
    txt += '\n\n💡 절전 모드로 켜 두면 보상 100%를 받습니다.';
    $('#welcomeText').textContent = txt; $('#welcome').hidden = false;
    ui.dirty.items = true; ui.dirty.hunters = true;
  }

  // ---------- 소리 ----------
  var AC = null;
  function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function sound(type, tier, launch) {
    if (!S.cfg.sound || !AC || ui.sleep) return;
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
      var nn = AC.createBufferSource(), ng = AC.createGain(); nn.buffer = buf; ng.gain.value = vol * 1.5; nn.connect(ng); ng.connect(AC.destination); nn.start(t);
    }
  }

  // ---------- 픽셀 그리기 ----------
  function P(ctx, x, y, c, w, h) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function resizeCanvas() {
    document.documentElement.style.setProperty('--navh', $('.nav').offsetHeight + 'px');
    var cv = $('#field'), cssW = cv.parentNode.getBoundingClientRect().width || 360;
    F.pix = Math.max(2, Math.floor(cssW / 125));
    F.w = Math.ceil(cssW / F.pix);
    var avail = window.innerHeight - $('.nav').offsetHeight - 150;
    F.h = clamp(Math.floor(avail / F.pix), 110, 190);
    cv.width = F.w; cv.height = F.h; cv.style.width = F.w * F.pix + 'px'; cv.style.height = F.h * F.pix + 'px';
    F.ctx = cv.getContext('2d'); F.ctx.imageSmoothingEnabled = false;
    F.terrainZone = 0; F.townKey = '';
  }
  function seeded(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function buildTerrain() {
    var z = zoneInfo(S.zone), r = seeded(S.zone * 7 + 3), cv = document.createElement('canvas'); cv.width = F.w; cv.height = F.h;
    var c = cv.getContext('2d'), i, x, y;
    P(c, 0, 0, z.base, F.w, F.h);
    for (i = 0; i < 260; i++) { x = Math.floor(r() * F.w); y = Math.floor(r() * F.h); P(c, x, y, r() < 0.5 ? z.light : z.dark, 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2)); }
    var py = F.h / 2;
    for (x = 10; x < F.w; x++) { py += (r() - 0.5) * 1.6; py = clamp(py, F.top + 12, F.h - 14); P(c, x, py - 4, z.path, 1, 9); if (r() < 0.3) P(c, x, py - 5 + Math.floor(r() * 11), z.dark); }
    var n = z.deco === 'forest' ? 26 : 16;
    for (i = 0; i < n; i++) {
      x = 20 + Math.floor(r() * (F.w - 26)); y = F.top + Math.floor(r() * (F.h - F.top - 4)); var k = r();
      if (z.deco === 'cave' || (z.deco === 'lava' && k < 0.5)) { P(c, x, y, '#6a6f7a', 3, 2); P(c, x, y - 1, '#8a8f9a', 2, 1); }
      else if (z.deco === 'lava' && k < 0.8) { P(c, x, y, '#ff7a2a', 2, 1); P(c, x + 1, y + 1, '#ffb040', 1, 1); }
      else if (z.deco === 'abyss' && k < 0.5) { P(c, x, y, '#b07aff', 1, 1); P(c, x + 2, y + 1, '#7a4fd0', 1, 1); }
      else if (k < 0.45) { P(c, x + 2, y + 2, '#3a2a1a', 2, 3); P(c, x, y - 2, z.deco === 'forest' ? '#1f4a2a' : '#2f6a3a', 6, 4); P(c, x + 1, y - 3, z.deco === 'forest' ? '#2a5f36' : '#3f8a4a', 4, 1); }
      else if (k < 0.75) { P(c, x, y, z.dark, 4, 2); P(c, x + 1, y - 1, z.light, 2, 1); }
      else P(c, x, y, r() < 0.5 ? '#ffd0e0' : '#fff6c0', 1, 1);
    }
    for (y = F.top - 6; y < F.h; y++) for (x = 0; x < 12; x++) P(c, x, y, ((x + (y >> 1)) % 3 === 0) ? '#3a3f4c' : '#4a5060');
    P(c, 10, F.top - 6, '#2a2e38', 2, F.h);
    var gy = F.h / 2; P(c, 6, gy - 9, '#120d0a', 6, 18); P(c, 6, gy - 11, '#5a4030', 6, 2);
    P(c, 4, gy - 13, '#ffb040', 1, 1); P(c, 13, gy - 13, '#ffb040', 1, 1);
    c.globalAlpha = 0.18; c.fillStyle = '#ffb040'; c.beginPath(); c.arc(4, gy - 13, 6, 0, 7); c.fill(); c.beginPath(); c.arc(13, gy - 13, 6, 0, 7); c.fill(); c.globalAlpha = 1;
    P(c, 0, F.top - 16, '#6a3a2a', 10, 1); P(c, 1, F.top - 15, '#8a4a30', 8, 9); P(c, 3, F.top - 11, '#ffd070', 2, 2); P(c, 0, F.top - 17, '#3a2a1a', 11, 1);
    drawSky(c, r);
    F.terrain = cv; F.terrainZone = S.zone;
  }
  function drawSky(c, r) {
    var i; P(c, 12, 0, '#0e1a26', F.w, F.top - 2); P(c, 12, F.top - 2, '#1a2a30', F.w, 2);
    for (i = 0; i < 20; i++) P(c, 12 + Math.floor(r() * (F.w - 12)), Math.floor(r() * (F.top - 6)), r() < 0.3 ? '#fff' : '#9ab', 1, 1);
    P(c, F.w - 22, 6, '#ffe9a8', 6, 6); P(c, F.w - 21, 5, '#ffe9a8', 4, 8); P(c, F.w - 23, 7, '#ffe9a8', 8, 4); P(c, F.w - 20, 8, '#e8d090', 2, 2);
  }
  // 마을 배경(건물은 매 프레임 그린다: 헌터와 앞뒤 정렬)
  function buildTownMap() {
    var r = seeded(11), cv = document.createElement('canvas'); cv.width = F.w; cv.height = F.h; var c = cv.getContext('2d'), i, x, y;
    P(c, 0, 0, '#2f4a2a', F.w, F.h);
    for (i = 0; i < 200; i++) { x = Math.floor(r() * F.w); y = Math.floor(r() * F.h); P(c, x, y, r() < 0.5 ? '#3a5a33' : '#25391f', 1 + Math.floor(r() * 3), 1); }
    // 돌바닥 광장과 길
    var cx = Math.round(F.w / 2), cy = Math.round(F.top + (F.h - F.top) * 0.58) + 4;
    for (y = F.top + 2; y < F.h; y++) for (x = 0; x < F.w; x++) {
      var onPlaza = Math.abs(x - cx) < 22 && Math.abs(y - cy) < 11, onRow = Math.abs(y - (F.top + (F.h - F.top) * 0.3 + 6)) < 3 || Math.abs(y - cy) < 3 || Math.abs(y - (F.top + (F.h - F.top) * 0.8 + 6)) < 3, onCol = Math.abs(x - cx) < 3 || Math.abs(x - Math.round(F.w * 0.18)) < 3 || Math.abs(x - Math.round(F.w * 0.82)) < 3;
      if (onPlaza || onRow || (onCol && y > F.top + (F.h - F.top) * 0.3)) P(c, x, y, ((x * 7 + y * 3) % 5 === 0) ? '#6a6050' : ((x + y) % 2 ? '#8a8070' : '#7a7060'), 1, 1);
    }
    // 오른쪽 돌담 + 문(사냥터로 나가는 길)
    for (y = F.top - 6; y < F.h; y++) for (x = F.w - 10; x < F.w; x++) P(c, x, y, ((x + (y >> 1)) % 3 === 0) ? '#3a3f4c' : '#4a5060');
    var gy = Math.round((F.top + F.h) / 2); P(c, F.w - 10, gy - 9, '#120d0a', 10, 18); P(c, F.w - 10, gy - 11, '#5a4030', 10, 2); P(c, F.w - 12, gy - 13, '#ffb040', 1, 1);
    c.globalAlpha = 0.18; c.fillStyle = '#ffb040'; c.beginPath(); c.arc(F.w - 12, gy - 13, 6, 0, 7); c.fill(); c.globalAlpha = 1;
    // 꽃·나무
    for (i = 0; i < 14; i++) { x = 4 + Math.floor(r() * (F.w - 20)); y = F.top + Math.floor(r() * (F.h - F.top)); if (r() < 0.5) P(c, x, y, r() < 0.5 ? '#ffd0e0' : '#fff6c0', 1, 1); else { P(c, x + 2, y + 2, '#3a2a1a', 2, 3); P(c, x, y - 2, '#2f6a3a', 6, 4); P(c, x + 1, y - 3, '#3f8a4a', 4, 1); } }
    drawSky(c, r);
    F.townMap = cv; F.townKey = F.w + 'x' + F.h;
  }
  function drawHouse(ctx, b, lv, x, y) {
    if (!lv) { P(ctx, x - 7, y - 3, '#4a3a22', 14, 4); P(ctx, x - 5, y - 2, '#5a4a2a', 10, 2); P(ctx, x + 3, y - 8, '#6a5a3a', 1, 6); P(ctx, x + 1, y - 9, '#c0a070', 5, 3); return; }
    var w = 14 + Math.min(lv, 8), hh = 10 + Math.floor(Math.min(lv, 8) * 0.75), two = lv >= 4, top = y - hh - (two ? 6 : 0);
    var dark = mix(b.col, '#000000', 0.35);
    P(ctx, x - w / 2 + 1, y - 1, dark, w - 2, 1);
    P(ctx, x - w / 2, top + 4, b.col, w, hh + (two ? 6 : 0) - 4);
    P(ctx, x - w / 2, top + 4, dark, 1, hh + (two ? 6 : 0) - 4); P(ctx, x + w / 2 - 1, top + 4, dark, 1, hh + (two ? 6 : 0) - 4);
    // 지붕(사다리꼴)
    for (var i = 0; i < 5; i++) P(ctx, x - w / 2 - 1 + i, top + i, b.roof, w + 2 - i * 2, 1);
    P(ctx, x - w / 2 - 1, top + 4, mix(b.roof, '#000', 0.3), w + 2, 1);
    // 문·창
    P(ctx, x - 2, y - 6, '#2a1a10', 4, 6); P(ctx, x, y - 4, '#ffd070', 1, 1);
    P(ctx, x - w / 2 + 3, y - 8, '#ffd070', 3, 3); P(ctx, x + w / 2 - 6, y - 8, '#ffd070', 3, 3);
    if (two) { P(ctx, x - w / 2 + 3, top + 7, '#ffd070', 3, 3); P(ctx, x + w / 2 - 6, top + 7, '#ffd070', 3, 3); P(ctx, x - 1, top + 7, '#ffd070', 2, 3); }
    if (lv >= 7) { P(ctx, x + w / 2 - 5, top - 2, '#3a3a3a', 3, 5); P(ctx, x + w / 2 - 4, top - 5 - Math.floor(F.time * 2) % 3, '#bbb8', 2, 2); }
    if (lv >= 10) { P(ctx, x, top - 5, '#6a5a3a', 1, 6); P(ctx, x + 1, top - 5, TIER_COLOR.SP, 4, 3); }
    // 간판 색 띠
    P(ctx, x - w / 2 + 1, y - 10, mix(b.roof, '#fff', 0.3), w - 2, 1);
  }
  function draw() {
    var ctx = F.ctx; if (!ctx) return;
    if (ui.sleep) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (ui.scene === 'town') drawTownScene(ctx); else drawHuntScene(ctx);
    drawLabels();
  }
  function drawTownScene(ctx) {
    if (F.townKey !== F.w + 'x' + F.h) buildTownMap();
    ctx.drawImage(F.townMap, 0, 0);
    var ents = BUILDINGS.map(function (b) { var s = townSpot(b.id); return { y: s.y - 2, b: b, x: s.x, sy: s.y }; });
    inTown().forEach(function (h) { ents.push({ y: h.y, h: h }); });
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { if (e.h) drawHunter(ctx, e.h, Math.round(e.h.x), Math.round(e.h.y)); else drawHouse(ctx, e.b, S.town[e.b.id], e.x, e.sy); });
    F.fx.forEach(function (f) { if (f.kind === 'spark') { ctx.globalAlpha = 1 - f.t / f.life; P(ctx, f.x, f.y, f.color, 1, 1); ctx.globalAlpha = 1; } });
    ctx.fillStyle = 'rgba(10,16,40,.12)'; ctx.fillRect(0, F.top - 2, F.w, F.h);
  }
  function drawHuntScene(ctx) {
    if (F.terrainZone !== S.zone) buildTerrain();
    var sx = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0, sy = F.shake > 0.05 ? Math.round(rnd(-F.shake, F.shake)) : 0;
    ctx.drawImage(F.terrain, sx, sy); ctx.translate(sx, sy);
    var ents = hunting().map(function (h) { return { y: h.y, h: h }; }).concat(F.mons.map(function (m) { return { y: m.y, m: m }; }));
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
    if (shoutOn()) { ctx.globalAlpha = 0.08 + 0.05 * Math.sin(F.time * 10); ctx.fillStyle = '#ffd34f'; ctx.fillRect(0, F.top - 2, F.w, F.h); ctx.globalAlpha = 1; }
    ctx.fillStyle = 'rgba(10,16,40,.14)'; ctx.fillRect(-2, F.top - 2, F.w + 4, F.h);
  }
  function drawHunter(ctx, h, x, y, big) {
    var c = CLASSES[h.cls], L = h.look || { hair: 0, hc: '#2b2320', skin: '#f3d9b1' }, t = y - 14;
    var a = h.anim > 0 ? Math.sin((0.25 - h.anim) / 0.25 * Math.PI) : 0, lunge = Math.round(a * 2);
    var moving = h.status === 'hunt' ? (h.target && dist(h, h.target) > h.range) : (h.status === 'town' && h.act === 0 && h.phase !== 'idle');
    var walk = moving ? Math.floor((h.walk || 0) % 2) : 0;
    x += lunge;
    var fl = h.flash > 0, skin = fl ? '#fff' : L.skin, hair = fl ? '#fff' : L.hc, body = fl ? '#fff' : c.color, bodyD = fl ? '#fff' : c.dark;
    var arm = h.armor, armC = arm ? TIER_COLOR[arm.tier] : null, ai = arm ? TIER_IDX[arm.tier] : -1;
    if (arm && !fl) { body = mix(c.color, armC, 0.55); bodyD = mix(c.dark, armC, 0.35); }
    if (ai === 4) P(ctx, x - 5, t + 6, armC, 2, 6);
    if (L.hair === 1) { P(ctx, x - 4, t + 2, hair, 1, 7); P(ctx, x + 3, t + 2, hair, 1, 7); }
    if (L.hair === 2) { P(ctx, x - 5, t + 3, hair, 1, 6); P(ctx, x - 4, t + 2, hair, 1, 2); }
    P(ctx, x - 3, t + 2, skin, 6, 4);
    P(ctx, x - 3, t, hair, 6, 2); P(ctx, x - 3, t + 2, hair, 1, 1); P(ctx, x + 2, t + 2, hair, 1, 1);
    if (L.hair === 3) { P(ctx, x - 4, t + 1, hair, 8, 1); P(ctx, x - 2, t - 2, hair, 4, 2); P(ctx, x - 1, t - 3, hair, 2, 1); }
    if (L.hair === 4) { P(ctx, x - 1, t - 1, hair, 3, 1); P(ctx, x, t - 2, hair, 2, 1); }
    if (L.hair === 0) P(ctx, x - 3, t + 1, hair, 7, 1);
    P(ctx, x - 2, t + 4, '#1a1410', 1, 1); P(ctx, x + 1, t + 4, '#1a1410', 1, 1);
    P(ctx, x - 3, t + 6, body, 6, 5); P(ctx, x - 3, t + 9, bodyD, 6, 1);
    if (ai >= 2) { P(ctx, x - 4, t + 6, armC, 1, 2); P(ctx, x + 3, t + 6, armC, 1, 2); }
    if (ai >= 3) P(ctx, x - 1, t + 7, armC, 2, 1);
    if (ai >= 0) P(ctx, x - 3, t + 10, armC, 6, 1);
    P(ctx, x + 3, t + 7, skin, 1, 2);
    P(ctx, x - 2, t + 11, '#2a2119', 2, 3 - walk); P(ctx, x, t + 11, '#2a2119', 2, 2 + walk);
    if (h.status === 'town' && h.bag && h.bag.length) P(ctx, x - 5, t + 7, '#8a6a3a', 2, 4); // 가방
    drawWeapon(ctx, c.weapon, h.weapon ? h.weapon.tier : null, x + 3, t + 8, a);
    if (h.status === 'hunt' && !big) { P(ctx, x - 4, y + 1, '#000', 9, 1); P(ctx, x - 4, y + 1, h.hp / h.maxHp < 0.3 ? '#ff5a50' : '#7fd36b', Math.round(8 * clamp(h.hp / h.maxHp, 0, 1)) + 1, 1); }
  }
  function mix(a, b, k) { var pa = hex(a), pb = hex(b); return 'rgb(' + Math.round(pa[0] + (pb[0] - pa[0]) * k) + ',' + Math.round(pa[1] + (pb[1] - pa[1]) * k) + ',' + Math.round(pa[2] + (pb[2] - pa[2]) * k) + ')'; }
  function hex(h) { if (h[0] !== '#') return [120, 120, 120]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function drawWeapon(ctx, type, tier, hx, hy, a) {
    var col = tier ? TIER_COLOR[tier] : '#8a8f9c', ti = tier ? TIER_IDX[tier] : -1, len = 3 + Math.max(0, ti), up = Math.round(a * 3), i;
    if (ti >= 3) { ctx.globalAlpha = 0.35; for (i = 0; i < len + 1; i++) P(ctx, hx + i, hy - i - up - 1, col, 3, 3); ctx.globalAlpha = 1; }
    if (type === 'sword') { for (i = 0; i < len + 1; i++) P(ctx, hx + 1 + i, hy - 1 - i - up, col, 1, 1); if (ti >= 1) for (i = 0; i < len; i++) P(ctx, hx + 2 + i, hy - 1 - i - up, mix(col, '#ffffff', 0.4), 1, 1); P(ctx, hx, hy - up, '#6b5a3a', 1, 1); P(ctx, hx + 1, hy + 1 - up, '#6b5a3a', 1, 1); }
    else if (type === 'bow') { P(ctx, hx + 2, hy - 3 - up, col, 1, 7); P(ctx, hx + 1, hy - 4 - up, col, 1, 1); P(ctx, hx + 1, hy + 3 - up, col, 1, 1); P(ctx, hx + 3, hy - 3 - up, '#ddd', 1, 6); if (ti >= 2) P(ctx, hx + 2, hy - up, mix(col, '#fff', 0.5), 1, 1); }
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
  var labelEls = {};
  function drawLabels() {
    var box = $('#labels'), seen = {}, p = F.pix;
    function el(id, cls) { var e = labelEls[id]; if (!e) { e = document.createElement('div'); e.className = cls; box.appendChild(e); labelEls[id] = e; } e.className = cls; seen[id] = true; return e; }
    var list = ui.scene === 'town' ? inTown() : hunting();
    list.forEach(function (h) {
      var e = el(h.id, 'tag'); e.textContent = h.name; e.style.left = h.x * p + 'px'; e.style.top = (h.y + 3) * p + 'px';
      if (h.bubble) { var b = el(h.id + 'b', 'bubble'); b.textContent = h.bubble.txt; b.style.left = h.x * p + 'px'; b.style.top = (h.y - 17) * p + 'px'; }
    });
    if (ui.scene === 'town') BUILDINGS.forEach(function (b) { var s = townSpot(b.id), lv = S.town[b.id], e = el('bld' + b.id, lv ? 'tag bld' : 'tag lot'); e.textContent = lv ? b.ic + b.nm + ' Lv.' + lv : '빈 터 · ' + b.nm; e.style.left = s.x * p + 'px'; e.style.top = (s.y + 1) * p + 'px'; });
    else F.mons.forEach(function (m) { if (!m.boss) return; var e = el(m.id, 'tag boss'); e.textContent = m.nm; e.style.left = m.x * p + 'px'; e.style.top = (m.y - 32) * p + 'px'; });
    Object.keys(labelEls).forEach(function (id) { if (!seen[id]) { labelEls[id].remove(); delete labelEls[id]; } });
  }
  function drawPortrait(cv, h, size) {
    var n = size || 20; cv.width = n; cv.height = n; var ctx = cv.getContext('2d'); ctx.clearRect(0, 0, n, n);
    drawHunter(ctx, { cls: h.cls, look: h.look, armor: h.armor, weapon: h.weapon, anim: 0, flash: 0, status: 'x', hp: 1, maxHp: 1, act: 0 }, Math.floor(n / 2) - 1, n - 2, true);
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
    if (uiTick >= 0.5) { uiTick = 0; refreshLive(); if (ui.dirty.mission) renderMission(); if (ui.dirty.shop) renderShop(); }
    if (secTick >= 1) {
      secTick = 0; spawnTick(Date.now()); renderTimer(); if (ui.sleep) renderSleep();
      if (ui.dirty.gate) renderGate(); if (ui.dirty.hunters) renderHunters(); if (ui.dirty.items) renderItems(); if (ui.dirty.log) renderLog(); if (ui.dirty.head) renderHead();
      if ((saveTimer = (saveTimer + 1) % 5) === 0) save();
    }
  }

  // ---------- 화면(DOM) ----------
  var ui = { dirty: { gate: true, hunters: true, items: true, town: true, log: true, head: true, chat: true, mission: true, shop: true }, sheetHunter: null, pickSlot: null, scene: 'hunt', sleep: false, sleepAt: 0, sleepGold: 0, sleepKills: 0, wake: null };
  function tierTag(t) { return '<span class="tier ' + t + '">' + TIER_LABEL[t] + '</span>'; }
  function renderHead() {
    ui.dirty.head = false;
    $('#gold').textContent = '🪙 ' + fmt(S.gold); $('#gem').textContent = '💎 ' + S.gems;
    $('#mats').textContent = '🪵 ' + S.mats.wood + ' · ⛏️ ' + S.mats.ore + ' · 🌿 ' + S.mats.herb;
    var z = zoneInfo(S.zone); $('#zoneNo').textContent = S.zone; $('#zoneName').textContent = z.nm;
    $('#zoneProg').textContent = S.zoneKills >= ZONE_KILLS ? (S.bossDone ? '이동 중…' : '👑 보스!') : '👹 ' + S.zoneKills + ' / ' + ZONE_KILLS;
    $('#huntInfo').textContent = '사냥 중 ' + hunting().length + '명 · 마을 ' + inTown().length + '명';
    $('#hunterCount').textContent = '👤 ' + S.hunters.length + '/' + capacity();
    $('#itemCount').textContent = '창고 장비 ' + S.items.length + '개';
    $('#soundBtn').textContent = S.cfg.sound ? '🔊' : '🔇';
    $('#sceneBtn').textContent = ui.scene === 'town' ? '⚔️ 사냥터 보기' : '🏘️ 마을 보기';
    $('#hint').textContent = ui.scene === 'town' ? '👆 건물을 탭하면 관리 화면' : '👆 몬스터를 탭하면 촌장의 일격!';
    var left = S.shoutCd - Date.now(); $('#shoutBtn').textContent = left > 0 ? '📣 ' + Math.ceil(left / 1000) + 's' : '📣 함성'; $('#shoutBtn').disabled = left > 0;
    var badge = $('#waitBadge'); badge.hidden = S.gate.length === 0; badge.textContent = S.gate.length;
  }
  function renderTimer() {
    var left = Math.max(0, S.nextSpawnAt - Date.now()), el = $('#spawnTimer');
    if (S.gate.length >= S.cfg.gateCap) el.textContent = '대기소 가득';
    else { var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000); el.textContent = '다음 ' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    if (S.shoutCd > Date.now() || $('#shoutBtn').disabled) { var l = S.shoutCd - Date.now(); $('#shoutBtn').textContent = l > 0 ? '📣 ' + Math.ceil(l / 1000) + 's' : '📣 함성'; $('#shoutBtn').disabled = l > 0; }
  }
  function renderMission() {
    ui.dirty.mission = false; var d = S.daily, rows = [[d.kills, MISSION.kills, '몬스터 처치'], [d.accept, MISSION.accept, '헌터 받아들이기'], [d.sales, MISSION.sales, '상점 판매']];
    var done = rows.filter(function (r) { return r[0] >= r[1]; }).length;
    $('#missionDone').textContent = d.claimed ? '✅' : '(' + done + '/3)';
    $('#missionList').innerHTML = d.claimed ? '<div class="ok">오늘 할 일 모두 완료!</div>' : rows.map(function (r) { return '<div class="' + (r[0] >= r[1] ? 'ok' : '') + '">' + (r[0] >= r[1] ? '✓' : '·') + ' ' + r[2] + ' ' + Math.min(r[0], r[1]) + '/' + r[1] + '</div>'; }).join('');
  }
  function renderChat() {
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
  var PHASE_NM = { sell: '잡템 판매', potion: '물약 구매', shop: '상점 구경', ready: '출발 준비', idle: '휴식' };
  function statusTag(h) {
    if (h.status === 'hunt') return '<span class="status hunt">사냥 중 ' + h.trip.kills + '/' + h.trip.need + '</span>';
    if (h.status === 'rest') return '<span class="status rest">회복 중 ' + Math.max(0, Math.ceil((h.restUntil - Date.now()) / 1000)) + '초</span>';
    return '<span class="status">' + (h.phase === 'idle' ? '마을에서 쉼' : '정비: ' + PHASE_NM[h.phase]) + '</span>';
  }
  function renderHunters() {
    ui.dirty.hunters = false; renderHead();
    var el = $('#hunterList');
    el.innerHTML = S.hunters.map(function (h) {
      var c = CLASSES[h.cls];
      return '<div class="item tap" data-id="' + h.id + '">' + portraitHtml(h) + '<div class="body">' +
        '<div class="nm">' + esc(h.name) + ' ' + tierTag(h.tier) + ' <span class="sub">Lv.' + h.lv + '</span> <span class="st">' + statusTag(h) + '</span></div>' +
        '<div class="sub">' + c.nm + ' · 🪙' + fmt(h.gold) + ' 🧪' + h.potions + ' 🎒' + h.bag.length + ' · ' + (h.weapon ? WEAPON_IC[h.weapon.type] + esc(h.weapon.name) + (h.weapon.plus ? '+' + h.weapon.plus : '') : '맨손') + ' · ' + (h.armor ? '🛡️' + esc(h.armor.name) + (h.armor.plus ? '+' + h.armor.plus : '') : '천옷') + '</div>' +
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
    $('#huntInfo').textContent = '사냥 중 ' + hunting().length + '명 · 마을 ' + inTown().length + '명';
    $('#zoneProg').textContent = S.zoneKills >= ZONE_KILLS ? (S.bossDone ? '이동 중…' : '👑 보스!') : '👹 ' + S.zoneKills + ' / ' + ZONE_KILLS;
    $('#gold').textContent = '🪙 ' + fmt(S.gold); $('#gem').textContent = '💎 ' + S.gems;
    $('#mats').textContent = '🪵 ' + S.mats.wood + ' · ⛏️ ' + S.mats.ore + ' · 🌿 ' + S.mats.herb;
    if (ui.sheetHunter && !$('#sheet').hidden) { var sh = $('#sheetHp'); if (sh) sh.textContent = h2hp(ui.sheetHunter); }
  }
  function h2hp(h) { return Math.round(h.hp) + ' / ' + h.maxHp; }
  function itemDesc(it) { return (it.kind === 'weapon' ? '⚔️ +' + it.atk : '🛡️ +' + it.def + ' ❤️ +' + it.hp) + (it.plus ? ' ×' + plusMul(it).toFixed(1) : ''); }
  function clsForWeapon(type) { for (var k in CLASSES) if (CLASSES[k].weapon === type) return CLASSES[k].nm; return ''; }
  function itemCard(it, btns) {
    return '<div class="item" data-id="' + it.id + '"><div class="ic">' + WEAPON_IC[it.type] + '</div><div class="body"><div class="nm">' + itemName(it) + ' ' + tierTag(it.tier) + '</div>' +
      '<div class="sub">' + itemDesc(it) + (it.kind === 'weapon' ? ' · ' + clsForWeapon(it.type) + '용' : ' · 모두') + (it.price ? ' · 🪙' + fmt(it.price) : '') + '</div>' + optsHtml(it) + '</div><div class="btns">' + btns + '</div></div>';
  }
  function enhCost(it) { var p = it.plus || 0; return { ore: 2 + p * 2, gold: 30 * (p + 1) * TIER_MUL[it.tier] | 0, chance: Math.min(100, (ENH_CHANCE[p] || 10) + S.town.forge * 2) }; }
  function renderItems() {
    ui.dirty.items = false; renderHead();
    var sorted = S.items.slice().sort(function (a, b) { return TIER_IDX[b.tier] - TIER_IDX[a.tier] || itemScore(b) - itemScore(a); });
    $('#itemList').innerHTML = sorted.map(function (it) {
      var e = enhCost(it), shop = it.kind === 'weapon' ? 'weapon' : 'armor', can = S.town[shop] > 0 && S.shops[shop].length < 2 + S.town[shop];
      return itemCard(it, '<button class="btn" data-act="shelf" ' + (can ? '' : 'disabled') + '>🏪 진열 🪙' + fmt(itemValue(it) * 2) + '</button>' +
        '<button class="btn" data-act="enh" ' + (it.plus >= 10 ? 'disabled' : '') + '>⚒️ +' + ((it.plus || 0) + 1) + ' (⛏️' + e.ore + ' 🪙' + e.gold + ' ' + e.chance + '%)</button>' +
        '<button class="btn" data-act="sell">🪙 ' + fmt(itemValue(it)) + ' 팔기</button>');
    }).join('');
    var c = craftCost();
    $('#craftBtn').textContent = '🔨 만들기 (🪙' + fmt(c.gold) + ' 🪵' + c.wood + ' ⛏️' + c.ore + ')';
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
    $('#craftResult').innerHTML = WEAPON_IC[it.type] + ' <b>' + esc(it.name) + '</b> ' + tierTag(it.tier) + ' ' + itemDesc(it) + optsHtml(it) + (used ? ' <span class="sub">(💎 사용)</span>' : '');
    toast('🔨 ' + it.name + ' 완성!'); renderItems(); save();
  }
  function enhance(it) {
    var e = enhCost(it);
    if (S.mats.ore < e.ore || S.gold < e.gold) return toast('광석이나 골드가 모자라요');
    S.mats.ore -= e.ore; S.gold -= e.gold;
    if (Math.random() * 100 < e.chance) { it.plus = (it.plus || 0) + 1; toast('✨ 강화 성공! ' + it.name + ' +' + it.plus); addLog('⚒️ <b>' + esc(it.name) + '</b> 강화 성공 → +' + it.plus); }
    else { toast('💥 강화 실패… 재료만 날아갔다'); addLog('⚒️ <b>' + esc(it.name) + '</b> 강화 실패'); }
    renderItems(); save();
  }
  function shelve(it) {
    var shop = it.kind === 'weapon' ? 'weapon' : 'armor';
    if (!S.town[shop]) return toast(bld(shop).nm + '을 먼저 지어야 해요');
    if (S.shops[shop].length >= 2 + S.town[shop]) return toast('진열대가 꽉 찼어요. 상점을 올리면 늘어납니다');
    var def = itemValue(it) * 2, p = prompt(it.name + ' 가격 (헌터는 지금 것보다 좋고 돈이 있으면 삽니다)', def);
    if (p === null) return; p = Math.max(1, parseInt(p, 10) || def);
    S.items = S.items.filter(function (x) { return x !== it; }); it.price = p; S.shops[shop].push(it);
    addLog('🏪 <b>' + esc(it.name) + '</b> ' + bld(shop).nm + '에 진열 (🪙' + fmt(p) + ')'); toast('🏪 진열했어요'); renderItems(); renderShop(); save();
  }
  function renderShop() {
    ui.dirty.shop = false;
    $('#potionLv').textContent = S.town.potion ? 'Lv.' + S.town.potion : '(안 지음)'; $('#potionStock').textContent = '재고 ' + S.shops.potionStock + ' / ' + (10 + S.town.potion * 5) + ' · 🌿 ' + S.mats.herb;
    $('#brewBar').style.width = S.shops.brew + '%';
    document.querySelectorAll('.price .seg').forEach(function (b) { b.classList.toggle('on', +b.dataset.price === S.shops.potionPrice); });
    ['weapon', 'armor'].forEach(function (k) {
      $('#' + k + 'Lv').textContent = S.town[k] ? 'Lv.' + S.town[k] : '(안 지음)'; $('#' + k + 'Cnt').textContent = '진열 ' + S.shops[k].length + ' / ' + (S.town[k] ? 2 + S.town[k] : 0);
      $('#' + k + 'Shelf').innerHTML = S.shops[k].map(function (it) { return itemCard(it, '<button class="btn" data-act="unshelf">회수</button>'); }).join('');
    });
  }
  function brew() {
    if (!S.town.potion) return toast('물약상점을 먼저 지어야 해요');
    if (S.shops.potionStock >= 10 + S.town.potion * 5) return toast('재고가 가득 찼어요');
    if (S.mats.herb <= 0) return toast('🌿 약초가 없어요. 헌터가 잡화상에 팔면 마을에 쌓입니다');
    S.shops.brew += 25;
    if (S.shops.brew >= 100) { S.shops.brew = 0; S.mats.herb--; S.shops.potionStock++; toast('🧪 물약 +1 (재고 ' + S.shops.potionStock + ')'); }
    renderShop();
  }
  function renderTown() {
    ui.dirty.town = false;
    $('#townList').innerHTML = BUILDINGS.map(function (b) {
      var lv = S.town[b.id], cost = buildCost(b, lv), maxed = lv >= b.max;
      return '<div class="item" data-id="' + b.id + '"><div class="ic">' + b.ic + '</div><div class="body"><div class="nm">' + b.nm + ' <span class="sub">' + (lv ? 'Lv.' + lv : '빈 터') + '</span></div><div class="sub">' + b.desc(lv) + (maxed ? '' : ' → ' + b.desc(lv + 1)) + '</div></div>' +
        '<button class="btn" data-act="up" ' + (maxed || S.gold < cost ? 'disabled' : '') + '>' + (maxed ? '최대' : (lv ? '🪙 ' : '🏗️ 짓기 🪙 ') + fmt(cost)) + '</button></div>';
    }).join('') + '<div class="item"><div class="ic">📊</div><div class="body"><div class="nm">마을 기록</div><div class="sub">처치 ' + fmt(S.stats.kills) + ' · 방문 헌터 ' + S.stats.arrivals + ' · 상점 판매 ' + S.stats.sales + '건 · 누적 수입 🪙' + fmt(S.stats.goldEarned) + ' · 촌장의 일격 ' + S.stats.strikes + '회</div></div></div>';
  }
  function renderLog() { ui.dirty.log = false; $('#logList').innerHTML = S.log.map(function (l) { return '<div>' + l.t + ' ' + l.txt + '</div>'; }).join('') || '<div>아직 기록이 없어요.</div>'; }
  function renderSleep() {
    var d = new Date(); $('#sleepClock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var mins = Math.floor((Date.now() - ui.sleepAt) / 60000);
    $('#sleepStats').textContent = '절전 ' + mins + '분 · 금고 +🪙' + fmt(S.stats.goldEarned - ui.sleepGold) + ' · 처치 ' + (S.stats.kills - ui.sleepKills) + ' · 사냥 중 ' + hunting().length + '명 · 대기소 ' + S.gate.length + '명';
  }
  function setSleep(on) {
    ui.sleep = on; $('#sleep').hidden = !on;
    if (on) { ui.sleepAt = Date.now(); ui.sleepGold = S.stats.goldEarned; ui.sleepKills = S.stats.kills; renderSleep(); if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { ui.wake = l; }).catch(function () {}); }
    else { if (ui.wake) { ui.wake.release().catch(function () {}); ui.wake = null; } renderAll(); }
  }
  function renderAll() { renderHead(); renderGate(); renderHunters(); renderItems(); renderTown(); renderLog(); renderTimer(); renderChat(); renderMission(); renderShop(); }
  var PANEL_TITLE = { town: '🏗️ 건설', hunters: '🧑‍🤝‍🧑 헌터', items: '📦 마을 창고', shop: '🏪 상점 운영', log: '📜 기록' };
  function openPanel(name) {
    document.querySelectorAll('#panel .pane').forEach(function (p) { p.classList.toggle('on', p.id === 'tab-' + name); });
    $('#panelTitle').textContent = PANEL_TITLE[name];
    if (name === 'town') renderTown(); if (name === 'hunters') renderHunters(); if (name === 'items') renderItems(); if (name === 'shop') renderShop(); if (name === 'log') renderLog();
    $('#panel').hidden = false;
    document.querySelectorAll('.navbtn').forEach(function (b) { b.classList.toggle('on', b.dataset.panel === name); });
  }
  function openSheet(h) {
    ui.sheetHunter = h; ui.pickSlot = null;
    var c = CLASSES[h.cls];
    var bag = h.bag.length ? '<div class="bag">' + h.bag.map(function (b) { return b.junk ? '<span>' + esc(b.nm) + ' 🪙' + b.v + '</span>' : '<span>' + WEAPON_IC[b.type] + esc(b.name) + ' <b class="tier ' + b.tier + '">' + TIER_LABEL[b.tier] + '</b></span>'; }).join('') + '</div>' : '<div class="sub">가방이 비어 있어요.</div>';
    $('#sheetContent').innerHTML = '<div class="h-head"><canvas id="portrait"></canvas><div><div class="nm">' + esc(h.name) + ' ' + tierTag(h.tier) + '</div><div class="sub">' + c.ic + ' ' + c.nm + ' · Lv.' + h.lv + ' · 처치 ' + h.kills + '</div><div class="sub">' + statusTag(h) + '</div></div></div>' +
      '<div class="traits">' + h.traits.map(function (nm) { var t = TRAITS.find(function (x) { return x.nm === nm; }); return '<span class="trait ' + (t && t.good ? 'good' : 'bad') + '">' + esc(nm) + '</span>'; }).join('') + '</div>' +
      '<div class="stats"><div>체력<b id="sheetHp">' + h2hp(h) + '</b></div><div>공격<b>' + h.atk + '</b></div><div>방어<b>' + Math.round(h.def) + '</b></div><div>공격속도<b>' + h.spd.toFixed(2) + '</b></div><div>이동속도<b>' + h.mspd.toFixed(2) + '</b></div><div>치명타<b>' + h.crit + '% ×' + h.cdmg.toFixed(1) + '</b></div><div>골드/경험<b>+' + Math.round(h.goldB * 100) + '%/+' + Math.round(h.expB * 100) + '%</b></div><div>드롭/흡혈<b>+' + Math.round(h.dropB * 100) + '%/' + Math.round(h.ls * 100) + '%</b></div><div>경험치<b>' + Math.floor(h.exp) + '/' + expNeed(h.lv) + '</b></div></div>' +
      '<div class="sub">🪙 주머니 ' + fmt(h.gold) + ' · 🧪 물약 ' + h.potions + ' · 🎒 가방 ' + h.bag.length + '/10</div>' + bag +
      '<div class="slot" data-slot="weapon"><div><div>' + WEAPON_IC[c.weapon] + ' 무기</div><div class="sub">' + (h.weapon ? itemName(h.weapon) + ' (' + TIER_LABEL[h.weapon.tier] + ') ' + itemDesc(h.weapon) : '맨손') + '</div>' + (h.weapon ? optsHtml(h.weapon) : '') + '</div><button class="btn" data-act="pick" data-slot="weapon">바꾸기</button></div>' +
      '<div class="slot" data-slot="armor"><div><div>🛡️ 갑옷</div><div class="sub">' + (h.armor ? itemName(h.armor) + ' (' + TIER_LABEL[h.armor.tier] + ') ' + itemDesc(h.armor) : '천옷') + '</div>' + (h.armor ? optsHtml(h.armor) : '') + '</div><button class="btn" data-act="pick" data-slot="armor">바꾸기</button></div>' +
      '<div id="pickList" class="pick" hidden></div>' +
      '<div class="row"><button class="btn primary" data-act="toggle">' + (h.auto ? '🏠 마을에서 쉬게 하기' : '⚔️ 정비하고 사냥 보내기') + '</button><button class="btn danger" data-act="dismiss">내보내기</button><button class="btn" data-act="close">닫기</button></div>';
    $('#sheet').hidden = false;
    drawPortrait($('#portrait'), h, 20);
  }
  function showPick(slot) {
    var h = ui.sheetHunter, el = $('#pickList'); ui.pickSlot = slot;
    var list = S.items.filter(function (it) { return slot === 'weapon' ? (it.kind === 'weapon' && it.type === CLASSES[h.cls].weapon) : it.kind === 'armor'; }).sort(function (a, b) { return itemScore(b) - itemScore(a); });
    el.hidden = false;
    el.innerHTML = '<div class="item tap" data-pick="none"><div class="ic">✋</div><div class="body"><div class="nm">해제</div></div></div>' +
      list.map(function (it) { return '<div class="item tap" data-pick="' + it.id + '"><div class="ic">' + WEAPON_IC[it.type] + '</div><div class="body"><div class="nm">' + itemName(it) + ' ' + tierTag(it.tier) + '</div><div class="sub">' + itemDesc(it) + '</div>' + optsHtml(it) + '</div></div>'; }).join('') +
      (list.length ? '' : '<div class="sub">창고에 맞는 장비가 없어요. 사냥에서 줍거나 대장간에서 만들어 보세요.</div>');
  }
  function equip(h, slot, id) {
    var cur = h[slot]; if (cur) { S.items.push(cur); h[slot] = null; }
    if (id !== 'none') { var i = S.items.findIndex(function (it) { return it.id === id; }); if (i >= 0) h[slot] = S.items.splice(i, 1)[0]; }
    recalc(h); h.flash = 0.2;
    for (var k = 0; k < 14; k++) F.fx.push({ kind: 'spark', x: h.x, y: h.y - 7, vx: rnd(-30, 30), vy: rnd(-50, -10), color: h[slot] ? TIER_COLOR[h[slot].tier] : '#fff', t: 0, life: 0.6 });
    addLog('🧷 <b>' + esc(h.name) + '</b> ' + (slot === 'weapon' ? '무기' : '갑옷') + ' → ' + (h[slot] ? esc(h[slot].name) : '해제'));
    if (h[slot]) say(h, 'equip', true);
    ui.dirty.items = true; ui.dirty.hunters = true; renderHunters(); renderItems(); openSheet(h);
  }
  function acceptHunter(id) {
    var i = S.gate.findIndex(function (h) { return h.id === id; }); if (i < 0) return;
    if (S.hunters.length >= capacity()) return toast('숙소가 꽉 찼어요. 건설에서 숙소를 올리거나 헌터를 내보내세요');
    var h = S.gate.splice(i, 1)[0]; h.status = 'town'; h.phase = 'sell'; h.auto = true; var g = gateSpot(); h.x = g.x; h.y = g.y; S.hunters.push(h); S.daily.accept++;
    addLog('🤝 <b>' + esc(h.name) + '</b> 합류! 정비 뒤 사냥터로'); toast('🤝 ' + h.name + ' 합류!'); say(h, 'arrive', true); checkMission();
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
    $('#gExpMul').value = c.expMul; $('#gGoldMul').value = c.goldMul; $('#gMonMul').value = c.monMul; $('#gDrop').value = c.dropPct; $('#gRest').value = c.restSec; $('#gCapBonus').value = c.capBonus; $('#gOffPct').value = c.offPct; $('#gOffHours').value = c.offHours;
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
    c.offPct = clamp(num('#gOffPct', 0, 50), 0, 100); c.offHours = clamp(num('#gOffHours', 1, 24), 1, 72);
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
    $('#sceneBtn').addEventListener('click', function () { ui.scene = ui.scene === 'town' ? 'hunt' : 'town'; renderHead(); });
    $('#shoutBtn').addEventListener('click', shout);
    $('#sleepBtn').addEventListener('click', function () { setSleep(true); save(); });
    $('#sleep').addEventListener('click', function () { setSleep(false); });
    // 캔버스 탭: 사냥터 = 촌장의 일격, 마을 = 건물 열기
    $('#field').addEventListener('pointerdown', function (e) {
      var r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / F.pix, y = (e.clientY - r.top) / F.pix;
      if (ui.scene === 'hunt') { if (chiefStrike(x, y)) renderHead(); return; }
      var hit = null; BUILDINGS.forEach(function (b) { var s = townSpot(b.id); if (Math.abs(x - s.x) < 12 && y > s.y - 22 && y < s.y + 4) hit = b; });
      if (hit) openPanel(hit.id === 'potion' || hit.id === 'weapon' || hit.id === 'armor' ? 'shop' : hit.id === 'inn' ? 'hunters' : hit.id === 'forge' ? 'items' : 'town');
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
      var b = e.target.closest('[data-act]'); if (!b) return;
      var id = b.closest('[data-id]').dataset.id, it = S.items.find(function (x) { return x.id === id; }); if (!it) return;
      if (b.dataset.act === 'sell') { S.items = S.items.filter(function (x) { return x !== it; }); S.gold += itemValue(it); addLog('💰 <b>' + esc(it.name) + '</b> 판매 +' + itemValue(it)); renderItems(); save(); }
      else if (b.dataset.act === 'enh') enhance(it);
      else if (b.dataset.act === 'shelf') shelve(it);
    });
    $('#craftBtn').addEventListener('click', craft);
    $('#brewBtn').addEventListener('click', brew);
    document.querySelectorAll('.price .seg').forEach(function (b) { b.addEventListener('click', function () { S.shops.potionPrice = +b.dataset.price; renderShop(); save(); }); });
    ['weapon', 'armor'].forEach(function (k) {
      $('#' + k + 'Shelf').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act="unshelf"]'); if (!b) return;
        var id = b.closest('[data-id]').dataset.id, it = S.shops[k].find(function (x) { return x.id === id; }); if (!it) return;
        S.shops[k] = S.shops[k].filter(function (x) { return x !== it; }); delete it.price; S.items.push(it); renderShop(); renderItems(); save();
      });
    });
    $('#townList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act="up"]'); if (!b) return;
      var id = b.closest('[data-id]').dataset.id, bd = bld(id), lv = S.town[id], cost = buildCost(bd, lv);
      if (lv >= bd.max || S.gold < cost) return;
      S.gold -= cost; S.town[id]++;
      var msg = lv ? bd.nm + ' Lv.' + S.town[id] : bd.nm + ' 완공!';
      addLog('🏗️ <b>' + msg + '</b>'); toast('🏗️ ' + msg); sysChat('🏗️ ' + msg + (lv ? '' : ' 마을 화면에서 확인해 보세요'));
      var s = townSpot(id); for (var k = 0; k < 16; k++) F.fx.push({ kind: 'spark', x: s.x + rnd(-8, 8), y: s.y - 8, vx: rnd(-20, 20), vy: rnd(-40, -5), color: '#ffe9a8', t: 0, life: 0.8 });
      S.hunters.forEach(recalc); renderTown(); renderHead(); renderShop(); save();
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
        if (h.auto) { h.auto = false; if (h.status === 'hunt') goHome(h); h.phase = 'idle'; h.target = null; addLog('🏠 <b>' + esc(h.name) + '</b> 마을에서 휴식'); }
        else { h.auto = true; if (h.status === 'town') { h.phase = 'sell'; h.act = 0; } addLog('⚔️ <b>' + esc(h.name) + '</b> 정비 뒤 사냥터로'); }
        renderHunters(); openSheet(h); save();
      } else if (act === 'dismiss') {
        if (!confirm(h.name + ' 을(를) 마을에서 내보낼까요? 장비는 창고로 돌아옵니다.')) return;
        if (h.weapon) S.items.push(h.weapon); if (h.armor) S.items.push(h.armor);
        S.hunters = S.hunters.filter(function (x) { return x !== h; });
        addLog('👋 <b>' + esc(h.name) + '</b> 마을을 떠남'); $('#sheet').hidden = true; renderHunters(); renderItems(); save();
      }
    });
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
    $('#gMats').addEventListener('click', function () { S.mats.wood += 100; S.mats.ore += 100; S.mats.herb += 100; renderHead(); save(); });
    $('#gHunterGold').addEventListener('click', function () { S.hunters.forEach(function (h) { h.gold += 500; }); renderHunters(); save(); });
    $('#gZoneUp').addEventListener('click', function () { S.zone++; S.zoneKills = 0; S.bossDone = false; F.mons = []; renderHead(); save(); });
    $('#gExport').addEventListener('click', function () { $('#gData').value = JSON.stringify(S); $('#gData').select(); toast('아래 칸의 내용을 복사해 두세요'); });
    $('#gImport').addEventListener('click', function () { try { var s = JSON.parse($('#gData').value); if (!s || !s.hunters) throw 0; localStorage.setItem(SAVE_KEY, JSON.stringify(s)); location.reload(); } catch (e) { toast('저장 데이터 형식이 아니에요'); } });
    $('#gReset').addEventListener('click', function () { if (!confirm('정말 전부 지울까요? 되돌릴 수 없어요.')) return; localStorage.removeItem(SAVE_KEY); location.reload(); });
    if (location.hash === '#god') setTimeout(openGod, 300);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); else { last = 0; offlineCatchUp(); renderAll(); if (ui.sleep && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { ui.wake = l; }).catch(function () {}); } });
    window.addEventListener('pagehide', save);
  }

  // ---------- 시작 ----------
  S = load();
  fillGodSelects(); resizeCanvas(); bind();
  S.hunters.forEach(function (h) { if (h.status === 'hunt' && (!h.y || h.y < F.top)) { h.x = 14; h.y = rnd(F.top + 10, F.h - 10); } if (h.status === 'town' && (!h.y || h.y < F.top)) { var g = gateSpot(); h.x = g.x; h.y = g.y; } recalc(h); });
  rateAcc.goldAt = S.stats.goldEarned; rateAcc.hgoldAt = sumHunterGold();
  checkMission(); offlineCatchUp(); renderAll();
  requestAnimationFrame(loop);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__ht = { S: S, F: F, ui: ui, makeHunter: makeHunter, makeItem: makeItem, save: save, townSpot: townSpot }; // 테스트·디버그용
})();
