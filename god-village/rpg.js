/* 신의 마을 — RPG 층 (6판): 시민 화신(지정·조종·자동 사냥·귀환), 사냥감, 탐험 이벤트, 장비·강화, 고대 미궁, 유성·습격, 출석, 오프라인 결과.
 * app.js 가 끝난 뒤 읽히고 window.__gv 로 내부 함수를 빌려 씁니다. 수치는 data.js 의 RPG 표. app.js 는 RPG.stepChamp/stepBeast/guard/onDie/onKill… 훅만 부릅니다. */
(function () {
  'use strict';
  var g = window.__gv, D = g.D, R = D.RPG, F = g.F, cam = g.cam, W = D.WORLD, WW = W.cols * W.cellW, WH = W.rows * W.cellH;
  var $ = function (s) { return document.querySelector(s); }, dist = g.dist, rnd = g.rnd, pick = g.pick, clamp = g.clamp, P = g.P, esc = g.esc;
  var RES_IC = { food: '🍖', wood: '🪵', stone: '🪨', metal: '⛏️', know: '📜', faith: '✨' };
  var S = null;
  // 조작 상태(저장 안 함). 화신 자체는 S.pop 의 시민이고 S.rpg.champ 가 그 id
  var C = { ctrl: false, joy: { x: 0, y: 0 }, tgt: null, cd: [0, 0], dashCd: 0, atkT: 0, hudT: 0, wanderT: 0 };
  var labelEls = {};

  // ---------- 상태 ----------
  function st() { S = g.S; if (!S.rpg) ensure(); if (!S.rpg.ev) S.rpg.ev = { meteorAt: Date.now() + R.events.meteorEvery, hordeAt: Date.now() + R.events.hordeEvery }; return S.rpg; }
  function ensure() {
    S.rpg = { lv: 1, xp: 0, equip: { weapon: null, armor: null, charm: null }, inv: [], attend: { last: '', streak: 0, pending: false }, ev: { meteorAt: Date.now() + R.events.meteorEvery, hordeAt: Date.now() + R.events.hordeEvery }, dg: null, kills: 0, deaths: 0, items: 0, hordeWins: 0, champ: null, avatars: 0, beastT: 0, eventAt: 0, seeded: false };
    placeDungeon();
  }
  function placeDungeon() {
    var r = g.seeded(S.world * 101 + 7), home = g.home(), cands = [];
    for (var rr = 0; rr < W.rows; rr++) for (var c = 0; c < W.cols; c++) { var k = { c: c, r: rr }; if (g.cellDist(k, home) < R.dungeon.minDist) continue; if (c === W.enemy.c && rr === W.enemy.r) continue; cands.push(k); }
    var cell = cands[Math.floor(r() * cands.length)] || { c: 0, r: Math.floor(W.rows / 2) }, cc = { x: cell.c * W.cellW + W.cellW / 2, y: cell.r * W.cellH + W.cellH / 2 };
    S.rpg.dg = { c: cell.c, r: cell.r, x: Math.round(cc.x), y: Math.round(cc.y + 20), floor: 0, best: 0, today: g.today(), cleared: 0, maxToday: 0, active: false };
    F.mapKey = '';
  }
  function dg() { return st().dg || (placeDungeon(), S.rpg.dg); }
  function av() { var r = st(); if (!r.champ) return null; var v = S.pop.find(function (o) { return o.id === r.champ; }); if (!v) { r.champ = null; } return v || null; }
  function isAvatar(v) { return !!v && st().champ === v.id; }
  function mark(v) { return isAvatar(v) ? '⚡' : ''; }

  // ---------- 장비 ----------
  function tierNow() { return clamp(1 + Math.floor(S.era / 2), 1, 5); }
  function rollRar(weights) { var sum = 0; weights.forEach(function (w) { sum += w; }); var x = Math.random() * sum; for (var i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; } return 0; }
  function makeItem(tier, rar, slot) {
    tier = clamp(tier, 1, 5); rar = clamp(rar, 0, 3); slot = slot || pick(Object.keys(R.SLOTS));
    var sl = R.SLOTS[slot], rd = R.RARITY[rar], pool = R.OPTS.slice(), opts = [];
    for (var i = 0; i < rd.opts && pool.length; i++) { var o = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; opts.push({ id: o.id, v: Math.max(1, Math.round(rnd(o.base[0], o.base[1]) * (1 + 0.3 * (tier - 1)) * rd.mult)) }); }
    return { id: g.uid(), slot: slot, rar: rar, tier: tier, nm: sl.names[tier - 1], opts: opts, plus: 0 };
  }
  function primary(it) { var sl = R.SLOTS[it.slot], rd = R.RARITY[it.rar]; return Math.round((sl.base[0] + sl.base[1] * it.tier) * rd.mult * (1 + R.enhance.step * it.plus)); }
  function itemStat(it, id) { if (!it) return 0; var v = R.SLOTS[it.slot].primary === id ? primary(it) : 0; it.opts.forEach(function (o) { if (o.id === id) v += o.v; }); return v; }
  function gearSum(eq, id) { var v = 0; Object.keys(eq).forEach(function (k) { v += itemStat(eq[k], id); }); return v; }
  function itemDesc(it) { var sl = R.SLOTS[it.slot], pn = { atk: '공격', hp: '체력', faith: '믿음 획득 %' }[sl.primary]; return pn + ' ' + primary(it) + it.opts.map(function (o) { var od = R.OPTS.find(function (x) { return x.id === o.id; }); return ' · ' + od.nm + ' +' + o.v + od.unit; }).join(''); }
  function itemName(it) { return R.SLOTS[it.slot].ic + ' ' + it.nm + (it.plus ? ' +' + it.plus : ''); }
  function addItem(it) {
    var r = st(); r.items++;
    if (r.inv.length >= R.invMax) { var low = r.inv.slice().sort(function (a, b) { return (a.rar * 10 + a.tier + a.plus) - (b.rar * 10 + b.tier + b.plus); })[0]; dismantle(low.id, true); g.toast('🎒 가방이 가득 차 ' + low.nm + '을(를) 분해했어요'); }
    r.inv.push(it); return it;
  }
  function drop(src, at, tierBonus) {
    if (!S) st(); var w = R.drops[src] || (Array.isArray(src) ? src : R.drops.floor), it = makeItem(tierNow() + (tierBonus || 0), rollRar(w)); addItem(it); var rd = R.RARITY[it.rar];
    if (at) { g.beam(at, rd.col, 50, 5, 0.8); F.fx.push({ kind: 'num', x: at.x, y: at.y - 18, txt: '📦 ' + it.nm, color: rd.col, size: 6, t: 0, life: 1.6 }); }
    g.sysChat('📦 ' + rd.nm + ' 장비 획득: ' + itemName(it) + ' (' + itemDesc(it) + ')'); g.toast('📦 ' + rd.nm + ' ' + itemName(it) + ' 획득!'); g.SFX.play(it.rar >= 2 ? 'fanfare' : 'gift'); return it;
  }
  function findItem(id) { var r = st(); return r.inv.find(function (x) { return x.id === id; }) || null; }
  function equip(id) { var r = st(), it = findItem(id); if (!it) return false; r.inv = r.inv.filter(function (x) { return x !== it; }); if (r.equip[it.slot]) r.inv.push(r.equip[it.slot]); r.equip[it.slot] = it; var v = av(); if (v) v.hp = Math.min(v.hp, maxHp()); g.toast(itemName(it) + ' 착용'); g.SFX.play('pop'); return true; }
  function unequip(slot) { var r = st(), it = r.equip[slot]; if (!it) return false; if (r.inv.length >= R.invMax) { g.toast('가방이 가득 찼어요'); return false; } r.equip[slot] = null; r.inv.push(it); var v = av(); if (v) v.hp = Math.min(v.hp, maxHp()); return true; }
  function enhance(id) {
    var r = st(), it = findItem(id) || r.equip.weapon && r.equip.weapon.id === id && r.equip.weapon || r.equip.armor && r.equip.armor.id === id && r.equip.armor || r.equip.charm && r.equip.charm.id === id && r.equip.charm; if (!it) it = villagerGear(id); if (!it) return false;
    if (it.plus >= R.enhance.max) { g.toast('더는 강화할 수 없어요 (최대 +' + R.enhance.max + ')'); return false; }
    var cost = R.enhance.costMetal * (it.plus + 1); if (S.res.metal < cost) { g.toast('⛏️ 금속이 모자라요 (' + cost + ' 필요)'); return false; }
    S.res.metal -= cost; var rate = R.enhance.rates[it.plus] || 0.2;
    if (Math.random() < rate) { it.plus++; g.toast('✨ 강화 성공! ' + itemName(it)); g.sysChat('✨ ' + itemName(it) + ' 강화 성공 (기본 능력 +' + Math.round(it.plus * R.enhance.step * 100) + '%)'); g.SFX.play('bell'); }
    else { g.toast('💥 강화 실패… 금속 ' + cost + ' 소모'); g.SFX.play('thud'); }
    return true;
  }
  function dismantle(id, silent) { var r = st(), it = findItem(id); if (!it) return false; r.inv = r.inv.filter(function (x) { return x !== it; }); var fa = R.dismantle.faith[it.rar], me = R.dismantle.metal[it.rar]; g.addFaith(fa); g.addRes('metal', me); if (!silent) g.toast('🔨 분해: ✨' + fa + ' ⛏️' + me); return true; }
  function villagerGear(id) { var found = null; S.pop.forEach(function (v) { if (!v.gear) return; ['weapon', 'armor'].forEach(function (k) { if (v.gear[k] && v.gear[k].id === id) found = v.gear[k]; }); }); return found; }
  function give(v, id) { var r = st(), it = findItem(id); if (!it || v.child || it.slot === 'charm') { if (it && it.slot === 'charm') g.toast('부적은 화신만 쓸 수 있어요'); return false; } if (isAvatar(v)) return equip(id); v.gear = v.gear || {}; r.inv = r.inv.filter(function (x) { return x !== it; }); if (v.gear[it.slot]) r.inv.push(v.gear[it.slot]); v.gear[it.slot] = it; v.hp = Math.min(v.hp, g.unitStat(v).hp); g.toast(v.name + '에게 ' + itemName(it) + ' 지급'); g.sysChat('🎁 ' + v.name + '이(가) ' + itemName(it) + '을(를) 받았다'); g.SFX.play('pop'); return true; }
  function unequipV(v, slot) { var r = st(); if (isAvatar(v)) return unequip(slot); if (!v.gear || !v.gear[slot]) return false; if (r.inv.length >= R.invMax) { g.toast('가방이 가득 찼어요'); return false; } r.inv.push(v.gear[slot]); v.gear[slot] = null; return true; }
  // app.js unitStat 가 부른다: 화신이면 능력치를 통째로 정하고, 아니면 장비·사기 보정만
  function vb(v) { if (isAvatar(v)) return { hp0: maxHp(), atk0: atk(), hp: 0, atk: 0, mul: 1 }; var hp = 0, a = 0; if (v.gear) { hp += itemStat(v.gear.armor, 'hp') + itemStat(v.gear.weapon, 'hp'); a += itemStat(v.gear.weapon, 'atk') + itemStat(v.gear.armor, 'atk'); } var A = av(), mul = A && g.fighter(v) && dist(v, A) < 40 ? R.morale : 1; return { hp: hp, atk: a, mul: mul }; }

  // ---------- 화신 능력치 ----------
  function maxHp() { var r = st(); return Math.round(R.base.hp + R.base.hpLv * (r.lv - 1) + gearSum(r.equip, 'hp')); }
  function atk() { var r = st(); return R.base.atk + R.base.atkLv * (r.lv - 1) + gearSum(r.equip, 'atk'); }
  function spd() { return R.base.spd * (1 + gearSum(st().equip, 'spd') / 100); }
  function crit() { return gearSum(st().equip, 'crit'); }
  function faithMul() { return 1 + gearSum(st().equip, 'faith') / 100; }
  function xpMul() { return 1 + gearSum(st().equip, 'xp') / 100; }
  function regen() { return gearSum(st().equip, 'regen'); }
  function xpNext() { return Math.round(R.xpBase * Math.pow(st().lv, R.xpPow)); }
  function gainXp(n) { var r = st(); r.xp += Math.round(n * xpMul()); var v = av(); while (r.xp >= xpNext()) { r.xp -= xpNext(); r.lv++; if (v) { v.hp = maxHp(); g.ring(v, '#ffd34f', 4, 30, 1, 2); g.beam(v, '#ffd34f', 80, 8, 0.8); } g.sysChat('⬆️ 화신' + (v ? ' ' + v.name : '') + ' 레벨 ' + r.lv + '! 체력 ' + maxHp() + ' · 공격 ' + atk()); g.toast('⬆️ 화신 Lv.' + r.lv + '!'); g.SFX.play('fanfare'); } }

  // ---------- 화신 지정·조종·귀환·죽음 ----------
  function canPick(v) { var r = st(); if (av()) return '화신 ' + av().name + '이(가) 살아 있는 동안은 바꿀 수 없어요'; if (!v) return '시민을 고르세요'; if (v.child) return '아이는 화신이 될 수 없어요'; if (S.faith < R.avatarCost) return '믿음이 모자라요 (' + R.avatarCost + ' 필요)'; return ''; }
  function setAvatar(v) {
    var why = canPick(v); if (why) { g.toast('⚡ ' + why); return false; }
    var r = st(); S.faith -= R.avatarCost; r.champ = v.id; r.avatars++; v.av = { rest: 0 }; v.job = 'warrior'; v.nudge = Date.now() + 1e12; v.state = 'idle'; v.node = null; v.bld = null; v.carry = null; v.doubt = false; v.hp = maxHp();
    g.beam(v, '#ffffff', 120, 10, 1); g.ring(v, '#ffd34f', 4, 40, 1.2, 2); g.burst(v, '#ffe9a8', 30); F.flash = 0.2; g.SFX.play('fanfare');
    g.sysChat('⚡ ' + v.name + '이(가) 신의 화신이 됐다! (화신 Lv.' + r.lv + ') 조종하지 않을 땐 마을 둘레에서 알아서 사냥하고, 위험하면 토템으로 돌아온다'); g.addLog('⚡ <b>' + v.name + '</b> 화신'); g.toast('⚡ ' + v.name + ', 화신이 되다'); g.say(v, 'avatar', true);
    S.pop.forEach(function (o) { if (o !== v && dist(o, v) < 60 && Math.random() < 0.5) g.say(o, 'avatar', true); });
    setCtrl(true); g.renderPop(); g.renderHead(); g.save(); return true;
  }
  function setCtrl(on) { var v = av(); C.ctrl = !!on && !!v; $('#rpgHud').hidden = !C.ctrl; $('.field').classList.toggle('ctrl', C.ctrl); C.joy.x = C.joy.y = 0; C.tgt = null; if (C.ctrl) { $('#panel').hidden = true; document.querySelectorAll('.navbtn').forEach(function (b) { b.classList.remove('on'); }); g.panTo(v); hudBar(); } hud(); }
  function retreat(v, why) { var t = g.totem() || g.home(); v.x = clamp(t.x + rnd(-6, 6), 6, WW - 6); v.y = clamp(t.y + 6, 6, WH - 6); v.hp = Math.max(v.hp, 1); v.av = v.av || {}; v.av.rest = S.simT + R.restSec; v.state = 'rest'; v.restUntil = S.simT + R.restSec; C.tgt = null; g.beam(v, '#ffffff', 90, 8, 0.8); g.burst(v, '#ffe9a8', 16); g.SFX.play('heal'); g.sysChat('🛡️ 화신 ' + v.name + '이(가) ' + (why || '위험해') + ' 토템으로 귀환했다. ' + R.restSec + '초 쉬면 다시 나선다'); if (C.ctrl) setCtrl(false); }
  // app.js attackV 가 피해를 준 뒤 부른다. 조종하지 않는 화신은 체력이 낮아지면 귀환하고 절대 죽지 않는다(true 면 평소 처리 건너뜀)
  function guard(v, h) { if (!isAvatar(v)) return false; if (v.av && v.av.rest > S.simT) { v.hp = Math.max(v.hp, 1); return true; } if (C.ctrl) return false; if (v.hp <= maxHp() * R.retreatPct) { retreat(v); return true; } return false; }
  function onDie(v, by) {
    var r = st(); if (!isAvatar(v)) return; r.champ = null; r.deaths++; if (C.ctrl) setCtrl(false); C.ctrl = false; $('#rpgHud').hidden = true;
    if (by !== '노환') S.faith = Math.max(0, S.faith - R.deathFaith);
    if (v.gear) { ['weapon', 'armor'].forEach(function (k) { if (v.gear[k]) { r.inv.push(v.gear[k]); v.gear[k] = null; } }); }
    g.sysChat('💀 화신 ' + v.name + '이(가) ' + (by || '') + '에 쓰러졌다… 화신의 자리(Lv.' + r.lv + '·장비)는 다음 시민이 이어받는다. 새 화신을 골라 주세요' + (by !== '노환' ? ' (믿음 -' + R.deathFaith + ')' : '')); g.addLog('💀 <b>화신 ' + v.name + '</b> 쓰러짐'); g.toast('💀 화신이 쓰러졌다. ⚡ 버튼으로 새 화신을 고르세요'); g.SFX.play('death'); F.flash = 0.3; if (dg().floor > 0) endRun('화신이 쓰러짐'); hud();
  }
  function useSkill(i) {
    var v = av(); if (!v) return false; var sk = R.skills[i]; if (C.cd[i] > 0) { g.toast(sk.ic + ' ' + sk.nm + ' ' + Math.ceil(C.cd[i]) + '초 뒤'); return false; }
    C.cd[i] = sk.cd; v.anim = 0.4;
    if (sk.id === 'bolt') { var n = 0, dmg = atk() * sk.mult; S.hostiles.concat(S.wolves).forEach(function (h) { if (dist(h, v) < sk.radius) { strike(v, h, dmg); n++; } }); g.bolt(v); g.ring(v, '#9ad0ff', 4, sk.radius, 0.5, 2); F.flash = 0.15; F.shake = 3; g.SFX.play('bolt'); if (!n) g.toast('⚡ 맞은 게 없다'); }
    else { v.hp = Math.min(maxHp(), v.hp + Math.round(maxHp() * sk.heal)); var m = 0; S.pop.forEach(function (o) { if (o !== v && dist(o, v) < sk.radius) { o.hp = g.unitStat(o).hp; m++; F.fx.push({ kind: 'heart', x: o.x, y: o.y - 14, t: 0, life: 1 }); } }); g.ring(v, '#ff9ac0', 4, sk.radius, 0.9, 2); g.SFX.play('heal'); g.sysChat('💗 치유 파동 — 화신 회복, 시민 ' + m + '명 회복'); }
    return true;
  }
  function dash() {
    var v = av(); if (!v || C.dashCd > 0) return false; var ds = R.dash; C.dashCd = ds.cd; v.anim = 0.45;
    var h = prey(v, ds.range); if (h) { var dx = h.x - v.x, dy = h.y - v.y, d = Math.sqrt(dx * dx + dy * dy) || 1, mv = Math.max(0, d - 8); v.x = clamp(v.x + dx / d * mv, 6, WW - 6); v.y = clamp(v.y + dy / d * mv, 6, WH - 6); v.face = dx < 0 ? -1 : 1; C.tgt = null; }
    var n = 0, dmg = atk() * ds.mult; S.hostiles.concat(S.wolves).forEach(function (o) { if (dist(o, v) < ds.radius) { strike(v, o, dmg); var kx = o.x - v.x, ky = o.y - v.y, kd = Math.sqrt(kx * kx + ky * ky) || 1; o.x = clamp(o.x + kx / kd * ds.knock, 4, WW - 4); o.y = clamp(o.y + ky / kd * ds.knock, 4, WH - 4); n++; } });
    g.ring(v, '#ffffff', 4, ds.radius, 0.25, 2); for (var i = 0; i < 10; i++) F.fx.push({ kind: 'spark', x: v.x + v.face * 8, y: v.y - 8, vx: v.face * rnd(10, 50), vy: rnd(-30, 10), color: '#ffe9a8', t: 0, life: 0.4 }); F.shake = n ? 3 : 1; g.SFX.play(n ? 'bolt' : 'hit');
    if (!n) F.fx.push({ kind: 'num', x: v.x, y: v.y - 20, txt: '휙', color: '#ddd', size: 5, t: 0, life: 0.5 });
    return true;
  }
  function strike(v, h, dmg) { var c = Math.random() * 100 < crit(); if (c) { dmg *= 2; F.fx.push({ kind: 'num', x: h.x, y: h.y - 18, txt: '치명!', color: '#ffd34f', size: 6, t: 0, life: 0.6 }); } g.hit(v, h, dmg); h.anim = 0.35; if (h.beast) { h.angry = true; h.aggro = v.id; } }
  // 화신이 공격할 수 있는 것: 적·늑대·사냥감 중 가장 가까운 것
  function prey(p, r, noBeast) { var best = null, bd = r; S.hostiles.forEach(function (h) { if (noBeast && h.beast) return; var d = dist(p, h); if (d < bd) { bd = d; best = h; } }); S.wolves.forEach(function (w) { var d = dist(p, w); if (d < bd) { bd = d; best = w; } }); return best; }
  function tap(p) {
    var v = av(); if (!v || !C.ctrl || g.ui.power) return false;
    var h = prey(p, 10); C.tgt = h ? { x: h.x, y: h.y, h: h } : { x: clamp(p.x, 6, WW - 6), y: clamp(p.y, 6, WH - 6) }; F.fx.push({ kind: 'ring', x: C.tgt.x, y: C.tgt.y, r0: 6, r1: 1, color: h ? '#ff6a5a' : '#ffe9a8', w: 1, t: 0, life: 0.4 }); return true;
  }
  // app.js stepVillager 가 매 프레임 부른다. 화신이면 여기서 움직이고(true), 아니면 평소 행동(false)
  function stepChamp(v, dt) {
    if (!isAvatar(v) || v.held || v.down) return false;
    var r = st(), sp = spd(), mv = false, mh = maxHp(); v.av = v.av || { rest: 0 };
    v.anim = Math.max(0, (v.anim || 0) - dt); C.cd[0] = Math.max(0, C.cd[0] - dt); C.cd[1] = Math.max(0, C.cd[1] - dt); C.dashCd = Math.max(0, C.dashCd - dt); C.atkT -= dt;
    // 토템에서 쉬는 중: 빠르게 회복, 공격받지 않음
    if (v.av.rest > S.simT) { v.state = 'rest'; v.hp = Math.min(mh, v.hp + mh / R.restSec * 1.2 * dt); if (Math.random() < dt * 0.4) F.fx.push({ kind: 'heart', x: v.x + rnd(-4, 4), y: v.y - 14, t: 0, life: 1 }); if (C.ctrl) hudBar(); return true; }
    if (v.hp < mh) v.hp = Math.min(mh, v.hp + (1 + regen()) * dt);
    var h = prey(v, R.base.range);
    if (C.ctrl) {
      if (Math.abs(C.joy.x) > 0.1 || Math.abs(C.joy.y) > 0.1) { v.x = clamp(v.x + C.joy.x * sp * dt, 6, WW - 6); v.y = clamp(v.y + C.joy.y * sp * dt, 6, WH - 6); v.face = C.joy.x < -0.1 ? -1 : C.joy.x > 0.1 ? 1 : v.face; C.tgt = null; mv = true; }
      else if (C.tgt) { if (C.tgt.h) { if (C.tgt.h.hp <= 0 || (S.hostiles.indexOf(C.tgt.h) < 0 && S.wolves.indexOf(C.tgt.h) < 0)) C.tgt = null; else { C.tgt.x = C.tgt.h.x; C.tgt.y = C.tgt.h.y; } } if (C.tgt && g.moveToward(v, C.tgt.x, C.tgt.y, sp, dt) < (C.tgt.h ? R.base.range - 4 : 1.5)) { if (!C.tgt.h) C.tgt = null; } else if (C.tgt) mv = true; }
      else if (!h) { var near = prey(v, R.chase); if (near) { g.moveToward(v, near.x, near.y, sp, dt); mv = true; } }
      v.state = mv ? 'march' : h ? 'fight' : 'guard';
    } else {
      // 알아서: 체력이 낮으면 귀환, 마을 둘레의 적을 먼저, 없으면 사냥감을 쫓고, 없으면 마을 근처를 어슬렁
      if (v.hp <= mh * R.retreatPct) { retreat(v); return true; }
      var home = g.settleOf(v), foe = prey(home, R.guard, true) || prey(home, R.hunt);
      if (foe && !h) { g.moveToward(v, foe.x, foe.y, sp * 0.85, dt); mv = true; v.state = 'fight'; }
      else if (!foe) { C.wanderT -= dt; if (C.wanderT <= 0) { C.wanderT = rnd(3, 7); v.tx = clamp(home.x + rnd(-40, 40), 6, WW - 6); v.ty = clamp(home.y + rnd(-20, 30), 6, WH - 6); } if (dist(v, { x: v.tx || home.x, y: v.ty || home.y }) > 2) { g.moveToward(v, v.tx || home.x, v.ty || home.y, sp * 0.5, dt); mv = true; v.state = 'wander'; } else v.state = 'guard'; }
      else v.state = 'fight';
    }
    if (mv) v.walk = (v.walk || 0) + dt * 8; else v.walk = 0;
    var cc = g.cellOf(v); if (!g.isExplored(cc.c, cc.r)) g.reveal(cc.c, cc.r);
    if (h) { if (h.x !== v.x) v.face = h.x < v.x ? -1 : 1; if (C.atkT <= 0) { C.atkT = R.base.atkCd; v.anim = 0.3; strike(v, h, atk()); v.fought = S.simT; F.fx.push({ kind: 'slash', x: h.x, y: h.y - 8, f: v.face, t: 0, life: 0.18 }); if (C.ctrl) F.shake = Math.max(F.shake, 0.6); } }
    S.pickups.forEach(function (pk) { if (pk.taken || dist(pk, v) > 10) return; if (pk.kind === 'meteor') takeMeteor(pk, v); else if (pk.kind === 'event') { pk.taken = true; resolveEvent(pk, v); } });
    var d = dg(); if (d.floor > 0) { if (dist(v, d) > R.dungeon.leaveDist) endRun('떠남'); else if (d.active && !S.hostiles.some(function (o) { return o.kind === 'dmob'; })) clearFloor(); }
    if (C.ctrl && (mv || h || v.anim > 0)) { var mx = F.vw * 0.2, my = F.vh * 0.2; if (v.x - cam.x < mx) cam.x = v.x - mx; if (v.x - cam.x > F.vw - mx) cam.x = v.x - (F.vw - mx); if (v.y - cam.y < my) cam.y = v.y - my; if (v.y - cam.y > F.vh - my) cam.y = v.y - (F.vh - my); g.clampCam(); }
    C.hudT -= dt; if (C.hudT <= 0) { C.hudT = 0.2; if (C.ctrl) hudBar(); }
    return true;
  }
  function onKill(h) {
    var r = st(), v = av(), kind = h.boss ? 'boss' : h.kind, xp = R.xp[kind] || 5, fa = R.faith[kind] || 1;
    if (h.beast) { var bd = beastDef(h); xp = bd.xp; fa = 0; if (h.lastHit === r.champ) { g.addRes('food', bd.food); F.fx.push({ kind: 'num', x: h.x, y: h.y - 6, txt: '+' + bd.food + '🍖', color: '#e06a5a', size: 5, t: 0, life: 0.9 }); r.hunted = (r.hunted || 0) + 1; if (bd.drop && Math.random() < 0.5) drop(bd.drop, h); } }
    if (v && h.lastHit === r.champ) { r.kills++; gainXp(xp); var f2 = Math.round(fa * faithMul()); if (f2) g.addFaith(f2); F.fx.push({ kind: 'num', x: h.x, y: h.y - 14, txt: (f2 ? '+' + f2 + '✨ ' : '') + '+' + Math.round(xp * xpMul()) + 'xp', color: '#ffd34f', size: 6, t: 0, life: 1.1 }); }
    if (h.horde && !S.hostiles.some(function (o) { return o.horde && o !== h; })) { r.hordeWins++; g.addFaith(R.events.hordeFaith); g.sysChat('🏆 습격 무리를 모두 물리쳤다! 믿음 +' + R.events.hordeFaith + ', 장비 상자'); g.addLog('🏆 <b>습격 격퇴</b>'); g.toast('🏆 습격 격퇴! 상자를 얻었다'); drop('horde', h); S.rally = null; }
  }

  // ---------- 사냥감 ----------
  function beastDef(h) { return R.BEASTS[h.bi] || R.BEASTS[0]; }
  function ringOf(c, r) { var d = g.cellDist({ c: c, r: r }, g.home()); return d <= 1 ? 0 : d <= 4 ? 1 : 2; }
  function spawnBeast(c, r) {
    var ring = ringOf(c, r), ws = R.BEASTS.map(function (b) { return b.weight[ring]; }), bi = rollRar(ws), bd = R.BEASTS[bi], k = 1 + S.era * 0.15;
    var x, y, tries = 0;
    do { x = c * W.cellW + rnd(12, W.cellW - 12); y = r * W.cellH + rnd(12, W.cellH - 12); tries++; } while (tries < 8 && S.settles.some(function (st) { return dist(st, { x: x, y: y }) < 36; }));
    if (tries >= 8) return null;
    var h = { id: g.uid(), kind: 'beast', beast: true, bi: bi, nm: bd.nm, x: x, y: y, hp: Math.round(bd.hp * k), mhp: Math.round(bd.hp * k), atk: bd.atk * k, home: { x: x, y: y }, timer: 0, walk: 0, face: Math.random() < 0.5 ? -1 : 1, angry: false, wt: rnd(0, 3) }; S.hostiles.push(h); return h;
  }
  function beastsTick() {
    var r = st(); if (S.simT - (r.beastT || 0) < R.beastEvery) return; r.beastT = S.simT; var total = S.hostiles.filter(function (h) { return h.beast; }).length; if (total >= R.beastsMax) return;
    var cells = []; for (var rr = 0; rr < W.rows; rr++) for (var c = 0; c < W.cols; c++) if (g.isExplored(c, rr)) cells.push({ c: c, r: rr });
    cells.forEach(function (k) { if (total >= R.beastsMax) return; var n = S.hostiles.filter(function (h) { return h.beast && g.cellOf(h).c === k.c && g.cellOf(h).r === k.r; }).length; while (n < R.beastsPerCell && total < R.beastsMax) { if (!spawnBeast(k.c, k.r)) break; n++; total++; } });
  }
  // app.js stepHostiles 가 부른다: 건드리면 공격자를 쫓고, 아니면 제자리 근처를 어슬렁
  function stepBeast(h, dt) {
    var bd = beastDef(h); h.anim = Math.max(0, (h.anim || 0) - dt);
    if (h.angry) { var tg = S.pop.find(function (v) { return v.id === h.aggro; }); if (!tg || dist(h, tg) > 90 || (tg.av && tg.av.rest > S.simT)) { h.angry = false; } else if (bd.atk <= 0) { var dx = h.x - tg.x, dy = h.y - tg.y, d = Math.sqrt(dx * dx + dy * dy) || 1; h.x = clamp(h.x + dx / d * bd.spd * 1.3 * dt, 4, WW - 4); h.y = clamp(h.y + dy / d * bd.spd * 1.3 * dt, 4, WH - 4); h.walk += dt * 8; h.face = dx < 0 ? -1 : 1; if (dist(h, tg) > 60) h.angry = false; return; } else { if (dist(h, tg) > 7) g.moveToward(h, tg.x, tg.y, bd.spd * 1.2, dt); else { h.timer = (h.timer || 0) - dt; if (h.timer <= 0) { h.timer = 1.4; h.anim = 0.3; var dmg = Math.round(bd.atk * (1 + S.era * 0.15) * rnd(0.8, 1.2)); tg.hp -= dmg; F.fx.push({ kind: 'num', x: tg.x, y: tg.y - 14, txt: '-' + dmg, color: '#ff7a70', size: 5, t: 0, life: 0.6 }); g.SFX.play('hurt'); if (window.RPG.guard(tg, h)) return; if (tg.hp <= 0 && g.fighter(tg)) { tg.hp = 0; } } } return; } }
    h.wt -= dt; if (h.wt <= 0) { h.wt = rnd(2, 6); h.tx = clamp(h.home.x + rnd(-30, 30), 4, WW - 4); h.ty = clamp(h.home.y + rnd(-24, 24), 4, WH - 4); }
    if (h.tx !== undefined && dist(h, { x: h.tx, y: h.ty }) > 2) g.moveToward(h, h.tx, h.ty, bd.spd * 0.5, dt); else h.walk = 0;
  }
  function drawBeast(ctx, h) {
    var x = Math.round(h.x), y = Math.round(h.y), b = Math.floor((h.walk || 0) % 2), f = h.face || 1, id = beastDef(h).id, flash = h.anim > 0;
    if (id === 'rabbit') { P(ctx, x - 2, y - 3 + b, flash ? '#fff' : '#e8e0d0', 5, 3); P(ctx, x + 2 * f, y - 4 + b, '#e8e0d0', 2, 2); P(ctx, x + 1 * f, y - 7 + b, '#e8e0d0', 1, 3); P(ctx, x + 3 * f, y - 7 + b, '#e8e0d0', 1, 3); P(ctx, x + 2 * f, y - 3 + b, '#ff8aa0', 1, 1); }
    else if (id === 'deer') { P(ctx, x - 3, y - 4 + b, flash ? '#fff' : '#a0703a', 6, 3); P(ctx, x + 3 * f, y - 6 + b, '#a0703a', 2, 3); P(ctx, x + 3 * f, y - 8 + b, '#6a4a2a', 1, 2); P(ctx, x + 5 * f, y - 8 + b, '#6a4a2a', 1, 2); P(ctx, x - 3, y - 1, '#6a4a2a', 1, 1); P(ctx, x + 1, y - 1, '#6a4a2a', 1, 1); }
    else if (id === 'boar') { P(ctx, x - 4, y - 4 + b, flash ? '#fff' : '#5a4030', 8, 4); P(ctx, x + 4 * f, y - 4 + b, '#5a4030', 2, 3); P(ctx, x + 5 * f, y - 2 + b, '#f0e0c0', 1, 1); P(ctx, x - 3, y, '#3a2a1a', 1, 1); P(ctx, x + 2, y, '#3a2a1a', 1, 1); if (h.angry) P(ctx, x + 4 * f, y - 4 + b, '#ff5050', 1, 1); }
    else { P(ctx, x - 6, y - 9 + b, flash ? '#fff' : '#5a3a28', 12, 8); P(ctx, x + 4 * f, y - 11 + b, '#5a3a28', 5, 5); P(ctx, x + 5 * f, y - 12 + b, '#4a2a18', 1, 1); P(ctx, x + 8 * f, y - 12 + b, '#4a2a18', 1, 1); P(ctx, x + 7 * f, y - 9 + b, h.angry ? '#ff3030' : '#1a1410', 1, 1); P(ctx, x - 5, y - 1, '#3a2418', 3, 2); P(ctx, x + 2, y - 1, '#3a2418', 3, 2); }
    if (h.hp < h.mhp) { P(ctx, x - 4, y + 2, '#000', 8, 1); P(ctx, x - 4, y + 2, '#e0a040', Math.round(8 * clamp(h.hp / h.mhp, 0, 1)), 1); }
  }

  // ---------- 탐험 이벤트 ----------
  function addEventSpot(c, r) { var x = Math.round(c * W.cellW + rnd(16, W.cellW - 16)), y = Math.round(r * W.cellH + rnd(16, W.cellH - 16)); if (S.settles.some(function (st) { return dist(st, { x: x, y: y }) < 40; })) return null; var pk = { id: g.uid(), kind: 'event', nm: '수상한 흔적', ic: '❓', c: c, r: r, x: x, y: y, reward: {}, taken: false }; S.pickups.push(pk); return pk; }
  function seedEvents() { var r = st(); if (r.seeded) return; r.seeded = true; var home = g.home(); for (var rr = 0; rr < W.rows; rr++) for (var c = 0; c < W.cols; c++) { if (c === home.c && rr === home.r) continue; var n = Math.round(rnd(R.eventsPerCell[0], R.eventsPerCell[1])); for (var i = 0; i < n; i++) addEventSpot(c, rr); } r.eventAt = Date.now() + R.eventEvery; g.ui.dirty.map = true; }
  function eventsRespawn(now) { var r = st(); if (now < (r.eventAt || 0)) return; r.eventAt = now + R.eventEvery; var cells = []; for (var rr = 0; rr < W.rows; rr++) for (var c = 0; c < W.cols; c++) if (g.isExplored(c, rr) && !(c === g.home().c && rr === g.home().r)) cells.push({ c: c, r: rr }); var k = pick(cells); if (k && addEventSpot(k.c, k.r)) { g.sysChat('❓ 어딘가에 새로운 흔적이 생겼다 (탐험가나 화신이 찾아낸다)'); g.ui.dirty.map = true; } }
  function resolveEvent(pk, v, forced) {
    var r = st(), sum = 0; R.EVENTS.forEach(function (e) { sum += e.weight; }); var x = Math.random() * sum, ev = R.EVENTS[0]; for (var i = 0; i < R.EVENTS.length; i++) { x -= R.EVENTS[i].weight; if (x < 0) { ev = R.EVENTS[i]; break; } } if (forced) ev = R.EVENTS.find(function (e) { return e.id === forced; }) || ev;
    var who = v ? v.name : '누군가', home = g.home(), msg = ev.ic + ' ' + who + '이(가) ' + ev.nm + '을(를) 찾았다! ';
    if (ev.item) { var it = drop(ev.item, pk); msg += itemName(it); }
    if (ev.res) { var got = []; Object.keys(ev.res).forEach(function (k) { var n = Math.round(rnd(ev.res[k][0], ev.res[k][1])); g.addRes(k, n); got.push(RES_IC[k] + n); }); msg += got.join(' '); }
    if (ev.faith) { var fa = Math.round(rnd(ev.faith[0], ev.faith[1])); g.addFaith(fa); msg += '믿음 +' + fa; g.beam(pk, '#ffd34f', 60, 6, 0.8); }
    if (ev.know) { var kn = Math.round(rnd(ev.know[0], ev.know[1])); S.res.know += kn; msg += '지식 +' + kn; }
    if (ev.pop) { var n = Math.round(rnd(ev.pop[0], ev.pop[1])); for (var j = 0; j < n; j++) { var nv = g.makeVillager(pk.x + rnd(-8, 8), pk.y + rnd(-4, 6), 'gather', home); nv.hp = g.unitStat(nv).hp; nv.state = 'migrate'; nv.tx = home.x + rnd(-10, 10); nv.ty = home.y + rnd(-4, 8); nv.mood = 55; S.pop.push(nv); g.say(nv, 'returned', true); } msg += n + '명이 마을에 합류한다 (인구 ' + S.pop.length + ')'; r.rescued = (r.rescued || 0) + n; g.ui.dirty.pop = true; }
    if (ev.warriors) { var w = Math.round(rnd(ev.warriors[0], ev.warriors[1])); for (var q = 0; q < w; q++) { var wv = g.makeVillager(pk.x + rnd(-8, 8), pk.y + rnd(-4, 6), 'warrior', home); wv.hp = g.unitStat(wv).hp; wv.nudge = Date.now() + 600000; wv.state = 'migrate'; wv.tx = home.x + rnd(-10, 10); wv.ty = home.y + rnd(-4, 8); S.pop.push(wv); } msg += '전사 ' + w + '명이 우리 편이 됐다'; g.ui.dirty.pop = true; }
    if (ev.child) { var kid = g.makeVillager(pk.x, pk.y, null, home, true); kid.state = 'migrate'; kid.tx = home.x; kid.ty = home.y + 6; S.pop.push(kid); msg += '아이 ' + kid.name + '을(를) 거두었다'; g.ui.dirty.pop = true; }
    if (ev.heal) { if (v) v.hp = g.unitStat(v).hp; S.pop.forEach(function (o) { if (dist(o, pk) < 40) o.hp = g.unitStat(o).hp; }); if (v && isAvatar(v)) v.bless = S.simT + 120; msg += '상처가 아물고 기운이 난다' + (v && isAvatar(v) ? ' (축복 120초)' : ''); g.ring(pk, '#7fd36b', 4, 24, 0.8, 2); }
    if (ev.hurt) { if (v) { var dmg = Math.round(g.unitStat(v).hp * ev.hurt); v.hp = Math.max(1, v.hp - dmg); F.fx.push({ kind: 'num', x: v.x, y: v.y - 14, txt: '-' + dmg, color: '#ff7a70', size: 6, t: 0, life: 0.8 }); } msg += '함정에 걸렸다!'; F.shake = 2; g.SFX.play('hurt'); }
    if (ev.bandits) { var b = Math.round(rnd(ev.bandits[0], ev.bandits[1])); for (var k2 = 0; k2 < b; k2++) S.hostiles.push({ id: g.uid(), kind: 'bandit', camp: 'ambush', x: pk.x + rnd(-14, 14), y: pk.y + rnd(-10, 10), hp: D.UNITS.bandit.hp * (1 + S.era * 0.2), atk: D.UNITS.bandit.atk * (1 + S.era * 0.2), home: { x: pk.x, y: pk.y }, timer: 0, walk: 0, face: 1 }); msg += '산적 ' + b + '명이 튀어나왔다!'; F.battle = { x: pk.x, y: pk.y, t: F.time + 2 }; g.SFX.play('horn'); }
    r.events = (r.events || 0) + 1; g.sysChat(msg); g.addLog(ev.ic + ' <b>' + ev.nm + '</b>'); g.toast(ev.ic + ' ' + ev.nm + '!'); g.burst(pk, '#ffe9a8', 14); if (!ev.hurt && !ev.bandits) g.SFX.play('gift'); g.ui.dirty.map = true; return ev;
  }
  function onPickup(pk, v) { if (pk.kind === 'meteor') { Object.keys(pk.reward).forEach(function (k) { if (k === 'metal') g.addRes('metal', pk.reward[k]); }); drop('meteor', pk); } else if (pk.kind === 'event') resolveEvent(pk, v); }

  // ---------- 미궁 ----------
  function enterDungeon() {
    var d = dg(), v = av(); if (!v) { g.toast('화신이 있어야 들어갈 수 있어요'); return false; } if (dist(v, d) > 24) { g.toast('미궁 입구 바로 옆에서 눌러 주세요'); return false; } if (d.active) return false;
    d.floor++; spawnFloor(d.floor); return true;
  }
  function spawnFloor(f) {
    var d = dg(), n = R.dungeon.mobsBase + Math.floor(f / 2), boss = f % R.dungeon.bossEvery === 0, k = 1 + S.era * 0.2;
    for (var i = 0; i < n; i++) { var hp = Math.round(R.dungeon.mobHp * (1 + R.dungeon.hpPer * f) * k); S.hostiles.push({ id: g.uid(), kind: 'dmob', dun: true, floor: f, boss: false, nm: '미궁의 그림자', hp: hp, mhp: hp, atk: R.dungeon.mobAtk * (1 + R.dungeon.atkPer * f) * k, home: { x: d.x, y: d.y }, x: d.x + rnd(-40, 40), y: d.y + rnd(10, 50), timer: rnd(0, 1), walk: 0, face: 1 }); }
    if (boss) { var bh = Math.round(R.dungeon.mobHp * (1 + R.dungeon.hpPer * f) * k * R.dungeon.bossMult); S.hostiles.push({ id: g.uid(), kind: 'dmob', dun: true, floor: f, boss: true, nm: '미궁의 주인', hp: bh, mhp: bh, atk: R.dungeon.mobAtk * (1 + R.dungeon.atkPer * f) * k * 1.5, home: { x: d.x, y: d.y }, x: d.x, y: d.y + 40, timer: 0, walk: 0, face: 1 }); }
    d.active = true; g.sysChat('🕳️ 고대 미궁 ' + f + '층 — 그림자 ' + n + (boss ? '마리와 미궁의 주인이' : '마리가') + ' 나타났다!'); g.toast('🕳️ 미궁 ' + f + '층' + (boss ? ' · 보스!' : '')); g.SFX.play('horn'); F.battle = { x: d.x, y: d.y, t: F.time + 2 }; F.shake = 2; hudBar();
  }
  function clearFloor() {
    var d = dg(), f = d.floor; d.active = false; var fa = R.dungeon.faithPerFloor * f; g.addFaith(fa);
    if (f > d.best) d.best = f;
    if (f > d.maxToday) { d.maxToday = f; d.cleared++; drop(f % R.dungeon.bossEvery === 0 ? 'boss' : 'floor', d, Math.floor(f / 3)); g.sysChat('🕳️ ' + f + '층 돌파! 믿음 +' + fa + ' (오늘 첫 돌파 보상 장비)'); }
    else g.sysChat('🕳️ ' + f + '층 돌파 (오늘 이미 받은 층: 믿음 +' + fa + '만)');
    g.toast('🕳️ ' + f + '층 돌파! 다음 층으로 가려면 ⬇️'); g.SFX.play('fanfare'); g.burst(d, '#c58cff', 24); g.checkAch(); hudBar();
  }
  function endRun(why) { var d = dg(); if (d.floor === 0) return; S.hostiles = S.hostiles.filter(function (o) { return o.kind !== 'dmob'; }); g.sysChat('🕳️ 미궁 ' + d.floor + '층에서 나왔다 (' + why + ')'); d.floor = 0; d.active = false; hudBar(); }
  function dungeonDaily() { var d = dg(), t = g.today(); if (d.today !== t) { d.today = t; d.maxToday = 0; d.cleared = 0; if (d.floor > 0) endRun('새 날'); } }

  // ---------- 시간 이벤트 ----------
  function spawnMeteor() {
    var r = st(), cells = []; for (var rr = 0; rr < W.rows; rr++) for (var c = 0; c < W.cols; c++) if (g.isExplored(c, rr)) cells.push({ c: c, r: rr });
    var cell = pick(cells) || { c: W.home.c, r: W.home.r }, x = Math.round(cell.c * W.cellW + rnd(20, W.cellW - 20)), y = Math.round(cell.r * W.cellH + rnd(20, W.cellH - 20));
    var pk = { id: g.uid(), kind: 'meteor', nm: '하늘에서 떨어진 돌', ic: '☄️', c: cell.c, r: cell.r, x: x, y: y, reward: R.events.meteorReward, taken: false, until: Date.now() + R.events.meteorLife };
    S.pickups.push(pk); r.ev.meteorAt = Date.now() + R.events.meteorEvery;
    F.fx.push({ kind: 'shoot', x: x - 60, y: y - 40, vx: 60, vy: 40, t: 0, life: 1 }); F.fx.push({ kind: 'ball', x: x, y: y, t: 0, life: 0.6 }); g.ring({ x: x, y: y }, '#ff9a3c', 4, 30, 1, 2); F.fx.push({ kind: 'scorch', x: x, y: y, r: 8, t: 0, life: 60 }); F.shake = 3; g.SFX.play('fire');
    g.sysChat('☄️ 유성이 떨어졌다! 1시간 안에 화신이나 탐험가가 주우면 금속·믿음과 장비'); g.addLog('☄️ <b>유성</b> 낙하'); g.toast('☄️ 유성 낙하! 미니맵의 주황 점'); S.pop.forEach(function (v) { if (dist(v, pk) < 80 && Math.random() < 0.5) g.say(v, 'meteor', true); }); g.ui.dirty.map = true; return pk;
  }
  function takeMeteor(pk, v) { pk.taken = true; Object.keys(pk.reward).forEach(function (k) { if (k === 'faith') g.addFaith(pk.reward[k]); else g.addRes(k, pk.reward[k]); }); g.sysChat('☄️ ' + (v ? v.name + '이(가)' : '누군가') + ' 유성을 주웠다! ' + Object.keys(pk.reward).map(function (k) { return RES_IC[k] + pk.reward[k]; }).join(' ')); g.burst(pk, '#ff9a3c', 20); drop('meteor', pk); g.ui.dirty.map = true; }
  function spawnHorde() {
    var r = st(), home = g.home(), n = R.events.hordeSize + S.era * R.events.hordePerEra, side = Math.floor(Math.random() * 3), sx = side === 0 ? 8 : side === 1 ? WW / 2 : 8, sy = side === 0 ? WH / 2 : side === 1 ? 8 : 8, EN = g.EN;
    for (var i = 0; i < n; i++) S.hostiles.push({ id: g.uid(), kind: 'enemy', raid: true, horde: true, nm: '습격 무리', fid: null, bid: null, x: sx + (i - (n - 1) / 2) * 6, y: sy + rnd(-3, 3), hp: EN.unitHp * (1 + S.era * 0.3) * 1.3, atk: EN.unitAtk * (1 + S.era * 0.3), target: { x: home.x, y: home.y }, ox: (i - (n - 1) / 2) * 6, oy: 0, until: 0, timer: 0, walk: 0, face: 1, pillage: 0 });
    r.ev.hordeAt = Date.now() + R.events.hordeEvery; S.rally = { x: home.x, y: home.y + 6, until: Date.now() + 300000, all: true };
    g.sysChat('👹 습격 무리 ' + n + '명이 먼 곳에서 몰려온다! 전부 물리치면 장비 상자. 화신으로 직접 막아도 된다'); g.addLog('👹 <b>습격</b> (' + n + '명)'); g.toast('👹 습격 무리가 몰려온다! 🎮 조종·🚩 집결'); g.SFX.play('horn'); F.battle = { x: sx, y: sy, t: F.time + 3 }; g.ui.dirty.map = true;
  }
  function eventsTick(now) {
    var r = st();
    if (now >= r.ev.meteorAt) spawnMeteor();
    if (now >= r.ev.hordeAt && S.pop.length >= 6 && !g.raidActive()) spawnHorde(); else if (now >= r.ev.hordeAt) r.ev.hordeAt = now + 600000;
    var before = S.pickups.length; S.pickups = S.pickups.filter(function (pk) { return !(pk.kind === 'meteor' && !pk.taken && pk.until && now > pk.until); }); if (S.pickups.length < before) { g.sysChat('☄️ 유성이 식어 사라졌다'); g.ui.dirty.map = true; }
    S.pickups = S.pickups.filter(function (pk) { return !((pk.kind === 'meteor' || pk.kind === 'event') && pk.taken); });
    eventsRespawn(now);
  }
  function slowTick(now) { st(); seedEvents(); eventsTick(now); dungeonDaily(); checkAttend(); beastsTick(); if (st().champ && !av()) hud(); }

  // ---------- 출석 ----------
  function yesterday() { var d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function checkAttend() { var r = st(), t = g.today(); if (r.attend.last === t) return; r.attend.streak = r.attend.last === yesterday() ? r.attend.streak + 1 : 1; r.attend.last = t; r.attend.pending = true; showAttend(); }
  function attendDay() { return ((st().attend.streak - 1) % 7 + 7) % 7; }
  function showAttend() { var r = st(), day = attendDay(); $('#attendText').textContent = '연속 ' + r.attend.streak + '일째 — 오늘 보상: ' + R.attend[day].ic + ' ' + R.attend[day].nm; $('#attendGrid').innerHTML = R.attend.map(function (a, i) { return '<div class="' + (i < day ? 'done' : i === day ? 'now' : '') + '"><b>' + (i + 1) + '일</b>' + a.ic + '<small>' + esc(a.nm) + '</small></div>'; }).join(''); $('#attendOk').hidden = !r.attend.pending; if ($('#welcome').hidden) $('#attend').hidden = false; else $('#welcomeOk').addEventListener('click', function () { $('#attend').hidden = false; }, { once: true }); }
  function claimAttend() { var r = st(); if (!r.attend.pending) return false; var a = R.attend[attendDay()]; r.attend.pending = false; if (a.faith) g.addFaith(a.faith); if (a.metal) g.addRes('metal', a.metal); if (a.item !== undefined) addItem(makeItem(tierNow(), a.item)); g.sysChat('📅 출석 ' + r.attend.streak + '일째 보상: ' + a.ic + ' ' + a.nm); g.toast('📅 출석 보상: ' + a.nm); g.SFX.play('gift'); $('#attend').hidden = true; g.renderHead(); g.save(); return true; }

  // ---------- 오프라인: 화신은 죽지 않고 알아서 사냥해 경험치를 얻는다 ----------
  function offline(mins) {
    var r = st(), hrs = mins / 60, msg = ''; if (hrs < 0.5) return msg;
    var bonus = Math.min(R.offline.returnMax, Math.round(hrs * R.offline.returnFaithPerH)); if (bonus > 0) { g.addFaith(bonus); msg += '\n⚡ 돌아온 신: 믿음 +' + bonus; }
    var v = av(); if (v) { var hh = Math.min(hrs, 24), xp = Math.round(hh * (R.offlineXpPerH + R.offlineXpLv * r.lv)), lv0 = r.lv, food = Math.round(hh * 6); gainXp(xp); g.addRes('food', food); r.hunted = (r.hunted || 0) + Math.round(hh * 3); v.hp = maxHp(); v.av = v.av || {}; v.av.rest = 0; msg += '\n🏹 화신 ' + v.name + '이(가) 사냥하며 경험치 +' + xp + ', 🍖' + food + (r.lv > lv0 ? ' → Lv.' + r.lv + '!' : ''); }
    if (hrs >= R.offline.dangerAfterH) { var n = 0; g.factions().forEach(function (f) { var b = f.bases.length; g.expandFaction(f); if (f.bases.length > b) n++; }); var ad = g.adults().filter(function (o) { return !o.doubt && !isAvatar(o); }); ad.slice(0, 2).forEach(function (o) { o.doubt = true; o.mood = Math.min(o.mood, 40); }); msg += '\n⚠️ ' + Math.floor(hrs) + '시간 비운 사이: ' + (n ? '적 세력 ' + n + '곳이 기지를 넓혔고, ' : '') + '시민 ' + Math.min(2, ad.length) + '명이 신을 의심하기 시작했다. 위로·축복으로 달래 주세요'; g.sysChat('⚠️ 오래 비운 사이 세상이 조금 험해졌다'); F.mapKey = ''; }
    return msg;
  }

  // ---------- 그리기 ----------
  function drawUnder(ctx) { var d = dg(); if (!g.inView(d, 40) || !g.isExplored(d.c, d.r)) return; var x = d.x, y = d.y; ctx.globalAlpha = 0.25 + 0.08 * Math.sin(F.time * 2); ctx.fillStyle = '#7a4aff'; ctx.beginPath(); ctx.arc(x, y - 4, 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1; P(ctx, x - 12, y - 2, '#2a2040', 24, 4); P(ctx, x - 10, y - 6, '#1a1428', 20, 5); P(ctx, x - 8, y - 10, '#0e0a18', 16, 5); P(ctx, x - 6, y - 13, '#06040c', 12, 4); P(ctx, x - 14, y - 14, '#5a4a7a', 3, 14); P(ctx, x + 11, y - 14, '#5a4a7a', 3, 14); P(ctx, x - 15, y - 16, '#7a6a9a', 5, 2); P(ctx, x + 10, y - 16, '#7a6a9a', 5, 2); P(ctx, x - 2 + Math.floor(F.time * 2) % 2, y - 8, '#c58cff', 1, 1); P(ctx, x + 3, y - 10, '#c58cff', 1, 1);
    var v = av(); if (v && g.inView(v, 20)) { ctx.globalAlpha = 0.16 + 0.06 * Math.sin(F.time * 4); ctx.fillStyle = C.ctrl ? '#ffd34f' : '#9ad0ff'; ctx.beginPath(); ctx.arc(v.x, v.y - 5, 11, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
  function paintMap(c) { var d = dg(); for (var y = d.y - 50; y < d.y + 50; y++) for (var x = d.x - 60; x < d.x + 60; x++) { if (x < 0 || y < 0 || x >= WW || y >= WH) continue; if (dist({ x: x, y: y }, d) < 48 && Math.random() < 0.45) P(c, x, y, Math.random() < 0.7 ? '#2a2438' : '#3a3050', 1, 1); } }
  function drawMob(ctx, h) { var x = Math.round(h.x), y = Math.round(h.y), b = Math.floor((h.walk || 0) % 2), s = h.boss ? 2 : 1, f = h.face || 1; ctx.globalAlpha = 0.5; P(ctx, x - 4 * s, y - 1, '#000', 8 * s, 2); ctx.globalAlpha = 1; var body = h.anim > 0 ? '#8a6aaa' : '#3a2a5a'; P(ctx, x - 4 * s, y - 8 * s + b, body, 8 * s, 7 * s); P(ctx, x - 3 * s, y - 10 * s + b, '#4a3a6a', 6 * s, 2 * s); P(ctx, x - 2 * s, y - 7 * s + b, '#ff4060', s, s); P(ctx, x + 1 * s, y - 7 * s + b, '#ff4060', s, s); if (h.anim > 0) P(ctx, x + 4 * s * f, y - 6 * s, '#c58cff', 2, 3); if (h.boss) { P(ctx, x - 4, y - 23 + b, '#ffd34f', 8, 2); P(ctx, x - 4, y - 25 + b, '#ffd34f', 2, 2); P(ctx, x + 2, y - 25 + b, '#ffd34f', 2, 2); P(ctx, x - 1, y - 26 + b, '#ffd34f', 2, 3); } P(ctx, x - 5 * s, y + 2, '#000', 10 * s, 1); P(ctx, x - 5 * s, y + 2, '#c58cff', Math.round(10 * s * clamp(h.hp / h.mhp, 0, 1)), 1); }
  function draw(ctx) {}
  // 화신 시민: 머리 위 후광, 체력 바, 장비 색. 다른 시민은 장비 색만
  function drawVillagerExtra(ctx, v, x, t, f) {
    if (isAvatar(v)) { var r = st(), sw = r.equip.weapon ? R.RARITY[r.equip.weapon.rar].col : '#c0c0c8', bob = Math.floor(F.time * 3) % 2; P(ctx, x - 3, t - 4 - bob, '#ffd34f', 6, 1); P(ctx, x - 4, t - 3 - bob, '#ffd34f', 1, 1); P(ctx, x + 3, t - 3 - bob, '#ffd34f', 1, 1); var a = v.anim > 0 ? 1 : 0; if (a) { P(ctx, x + 2 * f, t + 2, sw, 8, 1); P(ctx, x + 6 * f, t, '#fff', 2, 1); } else P(ctx, x + 4 * f, t + 3, sw, 1, 8); if (r.equip.armor) P(ctx, x - 3, t + 7, R.RARITY[r.equip.armor.rar].col, 6, 1); var mh = maxHp(); P(ctx, x - 6, t + 14, '#000', 12, 2); P(ctx, x - 6, t + 14, v.hp / mh < 0.3 ? '#ff5a50' : '#7fd36b', Math.round(12 * clamp(v.hp / mh, 0, 1)), 2); if (v.av && v.av.rest > S.simT) P(ctx, x + 4, t - 2, '#9ad0ff', 2, 2); return; }
    if (!v.gear) return; if (v.gear.weapon) { var c = R.RARITY[v.gear.weapon.rar].col; P(ctx, x + 3 * f, t + 3, c, 1, 5); P(ctx, x + 3 * f, t + 2, '#fff', 1, 1); } if (v.gear.armor) P(ctx, x - 3, t + 7, R.RARITY[v.gear.armor.rar].col, 6, 1);
  }
  function labels() {
    var box = $('#labels'), seen = {}, p = F.pix, ox = -cam.x, oy = -cam.y; if (!box) return;
    function el(id, cls) { var e = labelEls[id]; if (!e) { e = document.createElement('div'); e.className = cls; box.appendChild(e); labelEls[id] = e; } seen[id] = true; return e; }
    var d = dg(); if (g.isExplored(d.c, d.r) && g.inView(d, 20)) { var de = el('dg', 'tag dg'); de.textContent = '🕳️ 고대 미궁' + (d.floor ? ' ' + d.floor + '층' : '') + (d.best ? ' · 최고 ' + d.best : ''); de.style.left = (d.x + ox) * p + 'px'; de.style.top = (d.y + 12 + oy) * p + 'px'; }
    S.pickups.forEach(function (pk) { if (pk.taken || !g.inView(pk, 10)) return; if (pk.kind === 'meteor') { var me = el('mt' + pk.id, 'tag meteor'); me.textContent = '☄️ 유성 ' + Math.max(0, Math.ceil((pk.until - Date.now()) / 60000)) + '분'; me.style.left = (pk.x + ox) * p + 'px'; me.style.top = (pk.y + 2 + oy) * p + 'px'; } else if (pk.kind === 'event' && g.isExplored(pk.c, pk.r)) { var ee = el('ev' + pk.id, 'tag event'); ee.textContent = '❓'; ee.style.left = (pk.x + ox) * p + 'px'; ee.style.top = (pk.y + 2 + oy) * p + 'px'; } });
    Object.keys(labelEls).forEach(function (id) { if (!seen[id]) { labelEls[id].remove(); delete labelEls[id]; } });
  }

  // ---------- HUD·패널 ----------
  function fmtT(ms) { if (ms <= 0) return '지금'; var m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60) + '분' : m + '분'; }
  function fmtS(ms) { if (ms <= 0) return '지금'; var m = Math.ceil(ms / 60000); return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
  function hud() {
    var r = st(), now = Date.now(), b = $('#descendBtn'), v = av(); if (!b) return;
    b.textContent = v ? (v.av && v.av.rest > S.simT ? '💤 귀환 중' : C.ctrl ? '🎮 조종 중' : '🎮 조종') : '⚡ 화신 정하기'; b.classList.toggle('on', C.ctrl); b.classList.toggle('poor', !v && S.faith < R.avatarCost);
    var line = $('#rpgLine'); if (line) line.textContent = '☄️ ' + fmtS(r.ev.meteorAt - now) + ' · 👹 ' + fmtS(r.ev.hordeAt - now) + (v ? ' · ⚡ ' + v.name + ' Lv.' + r.lv + ' ❤️' + Math.round(v.hp) + '/' + maxHp() + (C.ctrl ? '' : v.av && v.av.rest > S.simT ? ' 휴식' : ' 사냥 중') : '');
    labels();
  }
  function hudBar() {
    var v = av(); if (!v) return; var r = st(), mh = maxHp(); $('#avLv').textContent = '⚡' + v.name + ' Lv.' + r.lv; $('#avHp').textContent = Math.round(v.hp) + '/' + mh; $('#avHpFill').style.width = clamp(v.hp / mh * 100, 0, 100) + '%';
    R.skills.forEach(function (sk, i) { var b = $('#sk' + i); b.classList.toggle('cd', C.cd[i] > 0); b.querySelector('small').textContent = C.cd[i] > 0 ? Math.ceil(C.cd[i]) + 's' : sk.nm; });
    $('#atkBtn').classList.toggle('cd', C.dashCd > 0);
    var d = dg(), near = dist(v, d) < 24, db = $('#dgBtn'); db.hidden = !(near || d.floor > 0); db.innerHTML = d.active ? '⚔️<small>' + d.floor + '층 전투</small>' : d.floor > 0 ? '⬇️<small>' + (d.floor + 1) + '층으로</small>' : '🕳️<small>입장</small>'; db.disabled = d.active || !near;
  }
  function renderPanel() {
    var r = st(), now = Date.now(), d = dg(), v = av();
    var eqHtml = Object.keys(R.SLOTS).map(function (k) { var sl = R.SLOTS[k], it = r.equip[k]; return '<div class="item rar' + (it ? it.rar : 'x') + '"><div class="ic">' + sl.ic + '</div><div class="body"><div class="nm">' + sl.nm + ': ' + (it ? '<span style="color:' + R.RARITY[it.rar].col + '">' + esc(itemName(it)) + '</span>' : '<span class="sub">비어 있음</span>') + '</div><div class="sub">' + (it ? esc(itemDesc(it)) : '가방에서 착용') + '</div></div>' + (it ? '<button class="btn small" data-rpg="enhance:' + it.id + '">강화</button><button class="btn small" data-rpg="unequip:' + k + '">해제</button>' : '') + '</div>'; }).join('');
    var invHtml = r.inv.map(function (it) { var rd = R.RARITY[it.rar], cost = R.enhance.costMetal * (it.plus + 1), rate = Math.round((R.enhance.rates[it.plus] || 0.2) * 100); return '<div class="item rar' + it.rar + '"><div class="ic">' + R.SLOTS[it.slot].ic + '</div><div class="body"><div class="nm" style="color:' + rd.col + '">' + esc(itemName(it)) + ' <span class="sub">' + rd.nm + ' · ' + R.SLOTS[it.slot].nm + '</span></div><div class="sub">' + esc(itemDesc(it)) + '</div></div><div class="col"><button class="btn small" data-rpg="equip:' + it.id + '">착용</button><button class="btn small" data-rpg="enhance:' + it.id + '" title="⛏️' + cost + ' · ' + rate + '%">강화 ⛏️' + cost + '</button><button class="btn small" data-rpg="dismantle:' + it.id + '">분해</button></div></div>'; }).join('') || '<div class="sub">장비가 없어요. 사냥감(곰)·괴물·산적 소굴·적 기지·유성·습격·미궁·탐험 이벤트에서 떨어집니다.</div>';
    var head;
    if (v) head = '<div class="rpgav"><div class="nm">⚡ 화신 ' + esc(v.name) + ' Lv.' + r.lv + ' <span class="sub">' + (v.av && v.av.rest > S.simT ? '토템에서 휴식 중' : C.ctrl ? '조종 중' : '마을 둘레에서 사냥 중') + ' · ❤️' + Math.round(v.hp) + '/' + maxHp() + '</span></div><div class="xpbar"><i style="width:' + Math.round(r.xp / xpNext() * 100) + '%"></i><span>XP ' + r.xp + '/' + xpNext() + '</span></div><div class="sub">❤️ ' + maxHp() + ' · ⚔️ ' + atk() + ' · 치명 ' + crit() + '% · 이동 +' + Math.round((spd() / R.base.spd - 1) * 100) + '% · 믿음 획득 +' + Math.round((faithMul() - 1) * 100) + '% · 경험치 +' + Math.round((xpMul() - 1) * 100) + '% · 회복 ' + (1 + regen()) + '/s · 처치 ' + r.kills + ' · 사냥 ' + (r.hunted || 0) + ' · 쓰러진 화신 ' + r.deaths + '</div>' +
      '<div class="row"><button class="btn primary" data-rpg="ctrl">' + (C.ctrl ? '🎮 조종 끄기' : '🎮 조종하기') + '</button></div>' +
      '<p class="hint">화신은 죽을 때까지 바꿀 수 없습니다. 🎮 조종: 왼쪽 조이스틱(WASD)으로 걷고, 지도를 탭하면 그쪽으로, 적이나 동물을 탭하면 쫓아갑니다. 가만히 있으면 가까운 사냥감에게 알아서 다가가 벱니다. ⚔️ 베기(스페이스)는 돌진해 주위를 크게 베고 밀쳐냅니다. ' + R.skills.map(function (s) { return s.ic + ' ' + s.nm + '(' + s.desc + ', ' + s.cd + '초)'; }).join(' · ') + '. <b>조종 중에는 죽을 수 있습니다.</b> 조종을 끄거나 접속하지 않을 땐 마을 둘레의 적·사냥감을 알아서 잡아 레벨업하고, 체력이 ' + Math.round(R.retreatPct * 100) + '% 아래로 떨어지면 토템으로 귀환해 ' + R.restSec + '초 쉽니다(죽지 않음). 오프라인에서도 시간당 경험치 ' + R.offlineXpPerH + '+레벨×' + R.offlineXpLv + '.</p></div>';
    else { var cands = S.pop.filter(function (o) { return !o.child && !o.held; }).slice(0, 30); head = '<div class="rpgav"><div class="nm">⚡ 화신 <span class="sub">없음 · 시민을 골라 주세요 (믿음 ' + R.avatarCost + ')</span></div><p class="hint">고른 시민이 신의 힘을 받아 화신이 됩니다. 화신의 레벨(지금 Lv.' + r.lv + ')과 장비는 자리에 남아 다음 시민이 이어받습니다. 전사·장군·영웅처럼 튼튼한 시민이 좋습니다.</p><div class="list">' + (cands.map(function (o) { return '<div class="item"><div class="ic">' + (D.TITLES[o.title] ? D.TITLES[o.title].ic : D.JOBS[o.job].ic) + '</div><div class="body"><div class="nm">' + esc(o.name) + ' <span class="sub">' + D.JOBS[o.job].nm + (o.title ? ' · ' + D.TITLES[o.title].nm : '') + ' · ❤️' + Math.round(o.hp) + '</span></div></div><button class="btn small primary" data-rpg="pick:' + o.id + '">⚡ 화신으로</button></div>'; }).join('') || '<div class="sub">어른 시민이 없어요</div>') + '</div></div>'; }
    $('#tab-rpg').innerHTML = head +
      '<h3>🗡️ 장비</h3><div class="list">' + eqHtml + '</div>' +
      '<h3>🎒 가방 ' + r.inv.length + '/' + R.invMax + '</h3><p class="hint">강화는 +1마다 기본 능력 +' + Math.round(R.enhance.step * 100) + '%, 금속 ' + R.enhance.costMetal + '×(현재 강화+1). +3까지는 100%, 그 뒤로 확률이 떨어지고 실패하면 금속만 잃습니다. 분해하면 믿음·금속. 장군·영웅 등 어른 시민에게도 시민 시트에서 무기·갑옷을 줄 수 있습니다.</p><div class="list">' + invHtml + '</div>' +
      '<h3>🏹 사냥·탐험</h3><p class="hint">탐험한 칸마다 토끼·사슴·멧돼지·곰이 돌아다닙니다(멀수록 센 놈, 60초마다 다시 나타남). 건드리지 않으면 공격하지 않고, 잡으면 경험치·식량, 곰은 장비도. 안개 속 칸마다 ❓ <b>수상한 흔적</b>이 1~2개 숨어 있어 화신이 밟거나 탐험가가 찾으면 보물·자원·난민 합류·용병단·옛 제단·약초·함정·매복·길 잃은 아이·떠돌이 현자 중 하나가 일어납니다. 20분마다 새 흔적이 생깁니다. 지금까지 이벤트 ' + (r.events || 0) + '회 · 거둔 사람 ' + (r.rescued || 0) + '명</p>' +
      '<h3>🕳️ ' + R.dungeon.nm + '</h3><p class="hint">지도 ' + (d.c + 1) + '열 ' + (d.r + 1) + '행 칸의 보라색 계단. 화신이 입구 옆에서 🕳️ 입장을 누르면 층마다 그림자 무리가 나오고 ' + R.dungeon.bossEvery + '층마다 보스. 층을 깰 때마다 믿음, 오늘 처음 깬 층은 장비(깊을수록 좋음). 입구에서 멀어지면 1층부터. 🚩 집결한 전사들이 같이 싸웁니다.<br>최고 ' + d.best + '층 · 오늘 ' + d.maxToday + '층까지' + (d.floor ? ' · 지금 ' + d.floor + '층' : '') + '</p>' +
      '<h3>⏰ 시간 이벤트</h3><p class="hint">☄️ 다음 유성 ' + fmtT(r.ev.meteorAt - now) + ' (3시간마다, 1시간 안에 주우면 금속·믿음·장비) · 👹 다음 습격 ' + fmtT(r.ev.hordeAt - now) + ' (6시간마다, 다 막으면 장비 상자) · 격퇴 ' + r.hordeWins + '회<br>24시간 넘게 비우면 적 세력이 기지를 넓히고 시민이 신을 의심합니다. 돌아오면 시간당 믿음 +' + R.offline.returnFaithPerH + '(최대 ' + R.offline.returnMax + ').</p>' +
      '<h3>📅 출석 — 연속 ' + r.attend.streak + '일</h3><div class="attgrid small">' + R.attend.map(function (a, i) { var day = attendDay(); return '<div class="' + (i < day || (i === day && !r.attend.pending) ? 'done' : i === day ? 'now' : '') + '"><b>' + (i + 1) + '일</b>' + a.ic + '<small>' + esc(a.nm) + '</small></div>'; }).join('') + '</div>' + (r.attend.pending ? '<div class="row"><button class="btn primary" data-rpg="attend">📅 오늘 출석 보상 받기</button></div>' : '');
  }
  function panelClick(e) {
    var b = e.target.closest('[data-rpg]'); if (!b) return; var m = b.dataset.rpg.split(':'), act = m[0], id = m[1];
    if (act === 'pick') { var o = S.pop.find(function (x) { return x.id === id; }); if (o && setAvatar(o)) return; }
    if (act === 'ctrl') { setCtrl(!C.ctrl); if (C.ctrl) return; }
    if (act === 'equip') equip(id); if (act === 'unequip') unequip(id); if (act === 'enhance') enhance(id); if (act === 'dismantle') dismantle(id); if (act === 'attend') claimAttend();
    renderPanel(); g.renderHead(); g.save();
  }
  function villagerSheet(v) {
    if (v.child) return ''; var r = st(), gear = isAvatar(v) ? r.equip : (v.gear || {}), rows = ['weapon', 'armor'].concat(isAvatar(v) ? ['charm'] : []).map(function (k) { var it = gear[k], sl = R.SLOTS[k]; return '<div class="sub">' + sl.ic + ' ' + sl.nm + ': ' + (it ? '<span style="color:' + R.RARITY[it.rar].col + '">' + esc(itemName(it)) + '</span> (' + esc(itemDesc(it)) + ') <button class="btn small" data-unequip="' + k + '">회수</button>' : '없음') + '</div>'; }).join('');
    var give = r.inv.filter(function (it) { return isAvatar(v) || it.slot !== 'charm'; }).map(function (it) { return '<button class="btn small" data-give="' + it.id + '" style="border-color:' + R.RARITY[it.rar].col + '">' + esc(itemName(it)) + '</button>'; }).join('');
    var head = isAvatar(v) ? '<div class="sub">⚡ <b>신의 화신</b> Lv.' + r.lv + ' · XP ' + r.xp + '/' + xpNext() + ' · 처치 ' + r.kills + ' · ' + (v.av && v.av.rest > S.simT ? '토템에서 휴식 중' : C.ctrl ? '조종 중' : '알아서 사냥 중') + '</div>' + (C.ctrl ? '' : '<div class="row"><button class="btn primary" data-ctrl="1">🎮 조종하기</button></div>') : (av() ? '' : '<div class="row"><button class="btn primary" data-champ="' + v.id + '">⚡ 화신으로 삼기 (✨' + R.avatarCost + ')</button></div>');
    return '<div class="np-txt">' + head + '<b>🗡️ 장비</b>' + rows + (give ? '<div class="row">' + give + '</div>' : '<div class="sub">가방에 줄 장비가 없어요</div>') + '</div>';
  }

  // ---------- 조작(조이스틱·버튼) ----------
  function bind() {
    var joy = $('#joy'), knob = $('#joyKnob'), jid = null;
    function setJoy(cx0, cy0) { var rct = joy.getBoundingClientRect(), cx = rct.left + rct.width / 2, cy = rct.top + rct.height / 2, dx = cx0 - cx, dy = cy0 - cy, d = Math.sqrt(dx * dx + dy * dy), max = rct.width / 2 - 8; if (d > max) { dx = dx / d * max; dy = dy / d * max; } C.joy.x = dx / max; C.joy.y = dy / max; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    function endJoy() { jid = null; C.joy.x = C.joy.y = 0; knob.style.transform = ''; }
    joy.addEventListener('pointerdown', function (e) { jid = e.pointerId; try { joy.setPointerCapture(jid); } catch (x) {} setJoy(e.clientX, e.clientY); e.preventDefault(); });
    joy.addEventListener('pointermove', function (e) { if (jid !== null && e.pointerId === jid) { setJoy(e.clientX, e.clientY); e.preventDefault(); } });
    joy.addEventListener('pointerup', function (e) { if (e.pointerId === jid) endJoy(); }); joy.addEventListener('pointercancel', function (e) { if (e.pointerId === jid) endJoy(); }); joy.addEventListener('lostpointercapture', endJoy);
    joy.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false }); joy.addEventListener('touchmove', function (e) { if (jid === null && e.touches[0]) setJoy(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false }); joy.addEventListener('touchend', function () { if (jid === null) endJoy(); });
    $('#atkBtn').addEventListener('click', function () { dash(); hudBar(); });
    $('#sk0').addEventListener('click', function () { useSkill(0); hudBar(); }); $('#sk1').addEventListener('click', function () { useSkill(1); hudBar(); });
    $('#ctrlOff').addEventListener('click', function () { setCtrl(false); }); $('#dgBtn').addEventListener('click', function () { enterDungeon(); hudBar(); });
    $('#descendBtn').addEventListener('click', function () { var v = av(); if (v) { if (v.av && v.av.rest > S.simT) { g.toast('💤 화신이 토템에서 쉬는 중 (' + Math.ceil(v.av.rest - S.simT) + '초)'); g.panTo(v); return; } setCtrl(!C.ctrl); g.renderHead(); return; } g.openPanel('rpg'); });
    $('#tab-rpg').addEventListener('click', panelClick); $('#attendOk').addEventListener('click', claimAttend); $('#attendClose').addEventListener('click', function () { $('#attend').hidden = true; });
    document.addEventListener('keydown', function (e) { if (!C.ctrl) return; var k = e.key.toLowerCase(); if (k === 'q') useSkill(0); if (k === 'e') useSkill(1); if (k === ' ') { dash(); e.preventDefault(); } var kv = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[k]; if (kv) { C.joy.x = kv[0]; C.joy.y = kv[1]; } });
    document.addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); if (/^(arrow(left|right|up|down)|[wasd])$/.test(k)) { C.joy.x = 0; C.joy.y = 0; } });
  }

  // ---------- 시작 ----------
  function init() {
    var r = st(); bind(); if (r.av) r.av.on = false;
    // 7판 이전 저장: 신 모습 화신 흔적 정리
    S.pop.forEach(function (o) { if (o.isAvatar) { delete o.isAvatar; o.nudge = 0; } });
    var v = av(); if (v) { v.job = 'warrior'; v.nudge = Date.now() + 1e12; v.av = v.av || { rest: 0 }; v.hp = Math.min(v.hp || maxHp(), maxHp()); }
    seedEvents();
    if (F.offlineMins) { var extra = offline(F.offlineMins); if (extra) $('#welcomeText').textContent += extra; }
    checkAttend(); hud(); g.renderHead();
  }
  window.RPG = { init: init, step: function () {}, slowTick: slowTick, draw: draw, drawUnder: drawUnder, drawMob: drawMob, drawBeast: drawBeast, drawVillagerExtra: drawVillagerExtra, paintMap: paintMap, hud: hud, tap: tap, target: function () { return null; }, hurt: function () {}, guard: guard, onDie: onDie, onKill: onKill, drop: drop, onPickup: onPickup, vb: vb, renderPanel: renderPanel, villagerSheet: villagerSheet, give: give, unequipV: unequipV, mark: mark, isAvatar: isAvatar, stepChamp: stepChamp, stepBeast: stepBeast, setAvatar: setAvatar, setCtrl: setCtrl, av: av,
    dash: dash, useSkill: useSkill, equip: equip, unequip: unequip, enhance: enhance, dismantle: dismantle, makeItem: makeItem, gainXp: gainXp, enterDungeon: enterDungeon, spawnMeteor: spawnMeteor, spawnHorde: spawnHorde, spawnBeast: spawnBeast, beastsTick: beastsTick, resolveEvent: resolveEvent, seedEvents: seedEvents, checkAttend: checkAttend, claimAttend: claimAttend, offline: offline, retreat: retreat, maxHp: maxHp, atk: atk, C: function () { return C; } };
  init();
})();
