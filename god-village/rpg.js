/* 신의 마을 — RPG 층 (5판): 화신 강림·전투, 장비·강화, 고대 미궁, 유성·습격 이벤트, 출석, 오프라인 결과.
 * app.js 가 끝난 뒤 읽히고 window.__gv 로 내부 함수를 빌려 씁니다. 수치는 data.js 의 RPG 표. app.js 는 RPG.step/draw/onKill 등 훅만 부릅니다. */
(function () {
  'use strict';
  var g = window.__gv, D = g.D, R = D.RPG, F = g.F, cam = g.cam, W = D.WORLD, WW = W.cols * W.cellW, WH = W.rows * W.cellH;
  var $ = function (s) { return document.querySelector(s); }, dist = g.dist, rnd = g.rnd, pick = g.pick, clamp = g.clamp, P = g.P, esc = g.esc;
  var RES_IC = { food: '🍖', wood: '🪵', stone: '🪨', metal: '⛏️', know: '📜', faith: '✨' };
  var S = null;
  // 화신(실행 중 상태. 저장 안 함 — 새로고침하면 승천 상태)
  var A = { on: false, isAvatar: true, id: 'avatar', x: 0, y: 0, face: 1, walk: 0, anim: 0, atkT: 0, cd: [0, 0], joy: { x: 0, y: 0 }, tgt: null, aim: false, hp: 0, hudT: 0, state: 'fight' };
  var labelEls = {};

  // ---------- 상태 ----------
  function st() { S = g.S; if (!S.rpg) ensure(); return S.rpg; }
  function ensure() {
    S.rpg = { lv: 1, xp: 0, charges: R.charges, chargeT: Date.now(), cd: 0, equip: { weapon: null, armor: null, charm: null }, inv: [], attend: { last: '', streak: 0, pending: false }, ev: { meteorAt: Date.now() + R.events.meteorEvery, hordeAt: Date.now() + R.events.hordeEvery }, dg: null, kills: 0, deaths: 0, items: 0, hordeWins: 0 };
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
    if (!S) st(); var w = R.drops[src] || R.drops.floor, it = makeItem(tierNow() + (tierBonus || 0), rollRar(w)); addItem(it); var rd = R.RARITY[it.rar];
    if (at) { g.beam(at, rd.col, 50, 5, 0.8); F.fx.push({ kind: 'num', x: at.x, y: at.y - 18, txt: '📦 ' + it.nm, color: rd.col, size: 6, t: 0, life: 1.6 }); }
    g.sysChat('📦 ' + rd.nm + ' 장비 획득: ' + itemName(it) + ' (' + itemDesc(it) + ')'); g.toast('📦 ' + rd.nm + ' ' + itemName(it) + ' 획득!'); g.SFX.play(it.rar >= 2 ? 'fanfare' : 'gift'); return it;
  }
  function findItem(id) { var r = st(); return r.inv.find(function (x) { return x.id === id; }) || null; }
  function equip(id) { var r = st(), it = findItem(id); if (!it) return false; r.inv = r.inv.filter(function (x) { return x !== it; }); if (r.equip[it.slot]) r.inv.push(r.equip[it.slot]); r.equip[it.slot] = it; if (A.on) A.hp = Math.min(A.hp, maxHp()); g.toast(itemName(it) + ' 착용'); g.SFX.play('pop'); return true; }
  function unequip(slot) { var r = st(), it = r.equip[slot]; if (!it) return false; if (r.inv.length >= R.invMax) { g.toast('가방이 가득 찼어요'); return false; } r.equip[slot] = null; r.inv.push(it); if (A.on) A.hp = Math.min(A.hp, maxHp()); return true; }
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
  // 시민 장비(장군·영웅 등 어른 전사에게)
  function villagerGear(id) { var found = null; S.pop.forEach(function (v) { if (!v.gear) return; ['weapon', 'armor'].forEach(function (k) { if (v.gear[k] && v.gear[k].id === id) found = v.gear[k]; }); }); return found; }
  function give(v, id) { var r = st(), it = findItem(id); if (!it || v.child || it.slot === 'charm') { if (it && it.slot === 'charm') g.toast('부적은 화신만 쓸 수 있어요'); return false; } v.gear = v.gear || {}; r.inv = r.inv.filter(function (x) { return x !== it; }); if (v.gear[it.slot]) r.inv.push(v.gear[it.slot]); v.gear[it.slot] = it; v.hp = Math.min(v.hp, g.unitStat(v).hp); g.toast(v.name + '에게 ' + itemName(it) + ' 지급'); g.sysChat('🎁 ' + v.name + '이(가) ' + itemName(it) + '을(를) 받았다'); g.SFX.play('pop'); return true; }
  function unequipV(v, slot) { var r = st(); if (!v.gear || !v.gear[slot]) return false; if (r.inv.length >= R.invMax) { g.toast('가방이 가득 찼어요'); return false; } r.inv.push(v.gear[slot]); v.gear[slot] = null; return true; }
  function vb(v) { var hp = 0, atk = 0; if (v.gear) { hp += itemStat(v.gear.armor, 'hp') + itemStat(v.gear.weapon, 'hp'); atk += itemStat(v.gear.weapon, 'atk') + itemStat(v.gear.armor, 'atk'); } var mul = A.on && g.fighter(v) && dist(v, A) < 40 ? R.morale : 1; return { hp: hp, atk: atk, mul: mul }; }

  // ---------- 화신 능력치 ----------
  function maxHp() { var r = st(); return Math.round(R.base.hp + R.base.hpLv * (r.lv - 1) + gearSum(r.equip, 'hp')); }
  function atk() { var r = st(); return R.base.atk + R.base.atkLv * (r.lv - 1) + gearSum(r.equip, 'atk'); }
  function spd() { return R.base.spd * (1 + gearSum(st().equip, 'spd') / 100); }
  function crit() { return gearSum(st().equip, 'crit'); }
  function faithMul() { return 1 + gearSum(st().equip, 'faith') / 100; }
  function xpMul() { return 1 + gearSum(st().equip, 'xp') / 100; }
  function regen() { return gearSum(st().equip, 'regen'); }
  function xpNext() { return Math.round(R.xpBase * Math.pow(st().lv, R.xpPow)); }
  function gainXp(n) { var r = st(); r.xp += Math.round(n * xpMul()); while (r.xp >= xpNext()) { r.xp -= xpNext(); r.lv++; A.hp = maxHp(); g.sysChat('⬆️ 화신 레벨 ' + r.lv + '! 체력 ' + maxHp() + ' · 공격 ' + atk()); g.toast('⬆️ 화신 Lv.' + r.lv + '!'); if (A.on) { g.ring(A, '#ffd34f', 4, 30, 1, 2); g.beam(A, '#ffd34f', 80, 8, 0.8); } g.SFX.play('fanfare'); } }

  // ---------- 강림·승천·전투 ----------
  function canDescend() { var r = st(); if (A.on) return '이미 강림 중'; if (Date.now() < r.cd) return '쓰러진 뒤 쉬는 중 (' + Math.ceil((r.cd - Date.now()) / 60000) + '분)'; if (r.charges <= 0) return '강림 횟수가 없어요 (8시간마다 1회 충전)'; if (S.faith < R.descendCost) return '믿음이 모자라요 (' + R.descendCost + ' 필요)'; return ''; }
  function descend(x, y) {
    var why = canDescend(); if (why) { g.toast('⚡ ' + why); return false; }
    var r = st(); S.faith -= R.descendCost; if (r.charges === R.charges) r.chargeT = Date.now(); r.charges--;
    A.on = true; A.x = clamp(x, 6, WW - 6); A.y = clamp(y, 6, WH - 6); A.hp = maxHp(); A.tgt = null; A.joy.x = A.joy.y = 0; A.cd = [0, 0]; A.aim = false;
    g.beam(A, '#ffffff', 120, 10, 1); g.ring(A, '#ffd34f', 4, 40, 1.2, 2); g.burst(A, '#ffe9a8', 30); F.flash = 0.2; g.SFX.play('fanfare');
    g.sysChat('⚡ 신이 화신으로 강림했다! (Lv.' + r.lv + ', 믿음이 초당 ' + R.drain + ' 줄어듭니다)'); g.addLog('⚡ <b>강림</b> Lv.' + r.lv);
    S.pop.forEach(function (v) { if (dist(v, A) < 60 && Math.random() < 0.5) g.say(v, 'avatar', true); });
    $('#rpgHud').hidden = false; $('#panel').hidden = true; document.querySelectorAll('.navbtn').forEach(function (b) { b.classList.remove('on'); }); g.panTo(A); g.ui.dirty.map = true; g.renderHead(); g.save(); return true;
  }
  function ascend(reason) {
    if (!A.on) return; A.on = false; A.tgt = null; A.joy.x = A.joy.y = 0; $('#rpgHud').hidden = true;
    g.beam(A, '#ffffff', 120, 8, 1); g.burst(A, '#ffe9a8', 20); g.SFX.play('heal');
    if (reason === 'faith') g.sysChat('🕊️ 믿음이 다해 화신이 하늘로 돌아갔다'); else if (reason !== 'death') g.sysChat('🕊️ 화신이 하늘로 돌아갔다');
    if (dg().floor > 0) endRun('승천');
    g.renderHead(); g.save();
  }
  function hurt(dmg, h) {
    if (!A.on) return; var r = st(); A.hp -= dmg; F.fx.push({ kind: 'num', x: A.x, y: A.y - 20, txt: '-' + dmg, color: '#ff7a70', size: 6, t: 0, life: 0.7 }); F.shake = Math.max(F.shake, 1);
    if (A.hp > 0) return;
    r.deaths++; S.faith = Math.max(0, S.faith - R.deathFaith); r.cd = Date.now() + R.deathCd * 1000; A.hp = 0;
    g.sysChat('💀 화신이 쓰러졌다… 믿음 -' + R.deathFaith + ', ' + Math.round(R.deathCd / 60) + '분 뒤에 다시 강림할 수 있다'); g.addLog('💀 <b>화신</b>이 쓰러짐'); g.toast('💀 화신이 쓰러졌다 (믿음 -' + R.deathFaith + ')'); g.SFX.play('death'); F.flash = 0.3;
    ascend('death');
  }
  function useSkill(i) {
    if (!A.on) return false; var sk = R.skills[i]; if (A.cd[i] > 0) { g.toast(sk.ic + ' ' + sk.nm + ' ' + Math.ceil(A.cd[i]) + '초 뒤'); return false; }
    A.cd[i] = sk.cd; A.anim = 0.4;
    if (sk.id === 'bolt') { var n = 0, dmg = atk() * sk.mult; S.hostiles.concat(S.wolves).forEach(function (h) { if (dist(h, A) < sk.radius) { g.hit(A, h, dmg); n++; } }); g.bolt(A); g.ring(A, '#9ad0ff', 4, sk.radius, 0.5, 2); F.flash = 0.15; g.SFX.play('bolt'); if (!n) g.toast('⚡ 맞은 적이 없다'); }
    else { A.hp = Math.min(maxHp(), A.hp + Math.round(maxHp() * sk.heal)); var m = 0; S.pop.forEach(function (v) { if (dist(v, A) < sk.radius) { v.hp = g.unitStat(v).hp; m++; F.fx.push({ kind: 'heart', x: v.x, y: v.y - 14, t: 0, life: 1 }); } }); g.ring(A, '#ff9ac0', 4, sk.radius, 0.9, 2); g.SFX.play('heal'); g.sysChat('💗 치유 파동 — 화신 회복, 시민 ' + m + '명 회복'); }
    return true;
  }
  function target() { return A.on ? A : null; }
  function tap(p) {
    if (A.aim) { A.aim = false; $('.field').classList.remove('aiming'); return descend(p.x, p.y); }
    if (A.on && !g.ui.power) { A.tgt = { x: clamp(p.x, 6, WW - 6), y: clamp(p.y, 6, WH - 6) }; F.fx.push({ kind: 'ring', x: A.tgt.x, y: A.tgt.y, r0: 6, r1: 1, color: '#ffe9a8', w: 1, t: 0, life: 0.4 }); return true; }
    return false;
  }
  function step(dt, now) {
    var r = st();
    if (!A.on) return;
    S.faith -= R.drain * dt; if (S.faith <= 0) { S.faith = 0; ascend('faith'); return; }
    // 이동: 조이스틱 > 탭 목표
    var mv = false, sp = spd();
    if (Math.abs(A.joy.x) > 0.1 || Math.abs(A.joy.y) > 0.1) { A.x = clamp(A.x + A.joy.x * sp * dt, 6, WW - 6); A.y = clamp(A.y + A.joy.y * sp * dt, 6, WH - 6); A.face = A.joy.x < -0.1 ? -1 : A.joy.x > 0.1 ? 1 : A.face; A.tgt = null; mv = true; }
    else if (A.tgt) { if (g.moveToward(A, A.tgt.x, A.tgt.y, sp, dt) < 1.5) A.tgt = null; else mv = true; }
    if (mv) A.walk += dt * 8;
    var cc = g.cellOf(A); if (!g.isExplored(cc.c, cc.r)) g.reveal(cc.c, cc.r);
    A.anim = Math.max(0, A.anim - dt); A.cd[0] = Math.max(0, A.cd[0] - dt); A.cd[1] = Math.max(0, A.cd[1] - dt);
    if (A.hp < maxHp()) A.hp = Math.min(maxHp(), A.hp + (1 + regen()) * dt);
    // 자동 공격: 가까운 적
    A.atkT -= dt; var h = g.nearestHostile(A, R.base.range);
    if (h) { if (h.x !== A.x) A.face = h.x < A.x ? -1 : 1; if (A.atkT <= 0) { A.atkT = R.base.atkCd; A.anim = 0.3; var dmg = atk(); if (Math.random() * 100 < crit()) { dmg *= 2; F.fx.push({ kind: 'num', x: h.x, y: h.y - 16, txt: '치명!', color: '#ffd34f', size: 5, t: 0, life: 0.6 }); } g.hit(A, h, dmg); } }
    // 유성 줍기
    S.pickups.forEach(function (pk) { if (!pk.taken && pk.kind === 'meteor' && dist(pk, A) < 10) takeMeteor(pk, null); });
    // 미궁
    var d = dg();
    if (d.floor > 0) { if (dist(A, d) > R.dungeon.leaveDist) endRun('떠남'); else if (d.active && !S.hostiles.some(function (o) { return o.kind === 'dmob'; })) clearFloor(); }
    // 카메라: 화신이 움직이거나 싸우는 중에 가운데 60% 를 벗어나면 따라간다 (가만히 서 있으면 지도를 자유롭게 볼 수 있음)
    if (mv || h) { var mx = F.vw * 0.2, my = F.vh * 0.2; if (A.x - cam.x < mx) cam.x = A.x - mx; if (A.x - cam.x > F.vw - mx) cam.x = A.x - (F.vw - mx); if (A.y - cam.y < my) cam.y = A.y - my; if (A.y - cam.y > F.vh - my) cam.y = A.y - (F.vh - my); g.clampCam(); }
    A.hudT -= dt; if (A.hudT <= 0) { A.hudT = 0.2; hudBar(); }
  }
  function onKill(h) {
    var r = st(), kind = h.boss ? 'boss' : h.kind, xp = R.xp[kind] || 5, fa = R.faith[kind] || 1;
    if (h.lastHit === 'avatar') { r.kills++; gainXp(xp); var f2 = Math.round(fa * faithMul()); if (f2) { g.addFaith(f2); F.fx.push({ kind: 'num', x: h.x, y: h.y - 14, txt: '+' + f2 + '✨ +' + Math.round(xp * xpMul()) + 'xp', color: '#ffd34f', size: 5, t: 0, life: 1 }); } }
    if (h.horde && !S.hostiles.some(function (o) { return o.horde && o !== h; })) { r.hordeWins++; g.addFaith(R.events.hordeFaith); g.sysChat('🏆 습격 무리를 모두 물리쳤다! 믿음 +' + R.events.hordeFaith + ', 장비 상자'); g.addLog('🏆 <b>습격 격퇴</b>'); g.toast('🏆 습격 격퇴! 상자를 얻었다'); drop('horde', h); S.rally = null; }
  }

  // ---------- 미궁 ----------
  function enterDungeon() {
    var d = dg(); if (!A.on) { g.toast('화신이 강림해 있어야 들어갈 수 있어요'); return false; } if (dist(A, d) > 24) { g.toast('미궁 입구 바로 옆에서 눌러 주세요'); return false; } if (d.active) return false;
    d.floor++; spawnFloor(d.floor); return true;
  }
  function spawnFloor(f) {
    var d = dg(), n = R.dungeon.mobsBase + Math.floor(f / 2), boss = f % R.dungeon.bossEvery === 0, k = 1 + S.era * 0.2;
    for (var i = 0; i < n; i++) { var hp = Math.round(R.dungeon.mobHp * (1 + R.dungeon.hpPer * f) * k); S.hostiles.push({ id: g.uid(), kind: 'dmob', dun: true, floor: f, boss: false, nm: '미궁의 그림자', hp: hp, mhp: hp, atk: R.dungeon.mobAtk * (1 + R.dungeon.atkPer * f) * k, home: { x: d.x, y: d.y }, x: d.x + rnd(-40, 40), y: d.y + rnd(10, 50), timer: rnd(0, 1), walk: 0, face: 1 }); }
    if (boss) { var bh = Math.round(R.dungeon.mobHp * (1 + R.dungeon.hpPer * f) * k * R.dungeon.bossMult); S.hostiles.push({ id: g.uid(), kind: 'dmob', dun: true, floor: f, boss: true, nm: '미궁의 주인', hp: bh, mhp: bh, atk: R.dungeon.mobAtk * (1 + R.dungeon.atkPer * f) * k * 1.5, home: { x: d.x, y: d.y }, x: d.x, y: d.y + 40, timer: 0, walk: 0, face: 1 }); }
    d.active = true; g.sysChat('🕳️ 고대 미궁 ' + f + '층 — 그림자 ' + n + (boss ? '마리와 미궁의 주인이' : '마리가') + ' 나타났다!'); g.toast('🕳️ 미궁 ' + f + '층' + (boss ? ' · 보스!' : '')); g.SFX.play('horn'); F.battle = { x: d.x, y: d.y, t: F.time + 2 }; F.shake = 2; hudBar();
  }
  function clearFloor() {
    var d = dg(), f = d.floor, r = st(); d.active = false; var fa = R.dungeon.faithPerFloor * f; g.addFaith(fa);
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
  function takeMeteor(pk, v) { pk.taken = true; Object.keys(pk.reward).forEach(function (k) { if (k === 'faith') g.addFaith(pk.reward[k]); else g.addRes(k, pk.reward[k]); }); g.sysChat('☄️ ' + (v ? v.name + '이(가)' : '화신이') + ' 유성을 주웠다! ' + Object.keys(pk.reward).map(function (k) { return RES_IC[k] + pk.reward[k]; }).join(' ')); g.burst(pk, '#ff9a3c', 20); drop('meteor', pk); g.ui.dirty.map = true; }
  function onPickup(pk, v) { if (pk.kind === 'meteor') { Object.keys(pk.reward).forEach(function (k) { if (k === 'metal') g.addRes('metal', pk.reward[k]); }); drop('meteor', pk); } }
  function spawnHorde() {
    var r = st(), home = g.home(), n = R.events.hordeSize + S.era * R.events.hordePerEra, side = Math.floor(Math.random() * 3), sx = side === 0 ? 8 : side === 1 ? WW / 2 : 8, sy = side === 0 ? WH / 2 : side === 1 ? 8 : 8, EN = g.EN;
    for (var i = 0; i < n; i++) S.hostiles.push({ id: g.uid(), kind: 'enemy', raid: true, horde: true, nm: '습격 무리', fid: null, bid: null, x: sx + (i - (n - 1) / 2) * 6, y: sy + rnd(-3, 3), hp: EN.unitHp * (1 + S.era * 0.3) * 1.3, atk: EN.unitAtk * (1 + S.era * 0.3), target: { x: home.x, y: home.y }, ox: (i - (n - 1) / 2) * 6, oy: 0, until: 0, timer: 0, walk: 0, face: 1, pillage: 0 });
    r.ev.hordeAt = Date.now() + R.events.hordeEvery; S.rally = { x: home.x, y: home.y + 6, until: Date.now() + 300000, all: true };
    g.sysChat('👹 습격 무리 ' + n + '명이 먼 곳에서 몰려온다! 전부 물리치면 장비 상자. 강림해서 직접 막아도 된다'); g.addLog('👹 <b>습격</b> (' + n + '명)'); g.toast('👹 습격 무리가 몰려온다! ⚡ 강림·🚩 집결'); g.SFX.play('horn'); F.battle = { x: sx, y: sy, t: F.time + 3 }; g.ui.dirty.map = true;
  }
  function eventsTick(now) {
    var r = st(); if (!r.ev) r.ev = { meteorAt: now + R.events.meteorEvery, hordeAt: now + R.events.hordeEvery };
    if (now >= r.ev.meteorAt) spawnMeteor();
    if (now >= r.ev.hordeAt && S.pop.length >= 6 && !g.raidActive()) spawnHorde(); else if (now >= r.ev.hordeAt) r.ev.hordeAt = now + 600000;
    var before = S.pickups.length; S.pickups = S.pickups.filter(function (pk) { return !(pk.kind === 'meteor' && !pk.taken && pk.until && now > pk.until); }); if (S.pickups.length < before) { g.sysChat('☄️ 유성이 식어 사라졌다'); g.ui.dirty.map = true; }
    S.pickups = S.pickups.filter(function (pk) { return !(pk.kind === 'meteor' && pk.taken); });
  }
  function recharge(now) { var r = st(); while (r.charges < R.charges && now - r.chargeT >= R.chargeEvery) { r.charges++; r.chargeT += R.chargeEvery; g.sysChat('⚡ 강림 횟수가 충전됐다 (' + r.charges + '/' + R.charges + ')'); } if (r.charges >= R.charges) r.chargeT = now; }
  function slowTick(now) { recharge(now); eventsTick(now); dungeonDaily(); checkAttend(); }

  // ---------- 출석 ----------
  function yesterday() { var d = new Date(Date.now() - 864e5); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function checkAttend() { var r = st(), t = g.today(); if (r.attend.last === t) return; r.attend.streak = r.attend.last === yesterday() ? r.attend.streak + 1 : 1; r.attend.last = t; r.attend.pending = true; showAttend(); }
  function attendDay() { return ((st().attend.streak - 1) % 7 + 7) % 7; }
  function showAttend() { var r = st(), day = attendDay(); $('#attendText').textContent = '연속 ' + r.attend.streak + '일째 — 오늘 보상: ' + R.attend[day].ic + ' ' + R.attend[day].nm; $('#attendGrid').innerHTML = R.attend.map(function (a, i) { return '<div class="' + (i < day ? 'done' : i === day ? 'now' : '') + '"><b>' + (i + 1) + '일</b>' + a.ic + '<small>' + esc(a.nm) + '</small></div>'; }).join(''); $('#attendOk').hidden = !r.attend.pending; if ($('#welcome').hidden) $('#attend').hidden = false; else $('#welcomeOk').addEventListener('click', function () { $('#attend').hidden = false; }, { once: true }); }
  function claimAttend() { var r = st(); if (!r.attend.pending) return false; var a = R.attend[attendDay()]; r.attend.pending = false; if (a.faith) g.addFaith(a.faith); if (a.metal) g.addRes('metal', a.metal); if (a.charges) { r.charges = R.charges; r.chargeT = Date.now(); } if (a.item !== undefined) addItem(makeItem(tierNow(), a.item)); g.sysChat('📅 출석 ' + r.attend.streak + '일째 보상: ' + a.ic + ' ' + a.nm); g.toast('📅 출석 보상: ' + a.nm); g.SFX.play('gift'); $('#attend').hidden = true; g.renderHead(); g.save(); return true; }

  // ---------- 오프라인 ----------
  function offline(mins) {
    var r = st(), hrs = mins / 60, msg = ''; if (hrs < 0.5) return msg;
    var bonus = Math.min(R.offline.returnMax, Math.round(hrs * R.offline.returnFaithPerH)); if (bonus > 0) { g.addFaith(bonus); msg += '\n⚡ 돌아온 신: 믿음 +' + bonus; }
    if (hrs >= R.offline.dangerAfterH) { var n = 0; g.factions().forEach(function (f) { var b = f.bases.length; g.expandFaction(f); if (f.bases.length > b) n++; }); var ad = g.adults().filter(function (v) { return !v.doubt; }); ad.slice(0, 2).forEach(function (v) { v.doubt = true; v.mood = Math.min(v.mood, 40); }); msg += '\n⚠️ ' + Math.floor(hrs) + '시간 비운 사이: ' + (n ? '적 세력 ' + n + '곳이 기지를 넓혔고, ' : '') + '시민 ' + Math.min(2, ad.length) + '명이 신을 의심하기 시작했다. 위로·축복으로 달래 주세요'; g.sysChat('⚠️ 오래 비운 사이 세상이 조금 험해졌다'); F.mapKey = ''; }
    recharge(Date.now()); return msg;
  }

  // ---------- 그리기 ----------
  function drawUnder(ctx) { var d = dg(); if (!g.inView(d, 40) || !g.isExplored(d.c, d.r)) return; var x = d.x, y = d.y; ctx.globalAlpha = 0.25 + 0.08 * Math.sin(F.time * 2); ctx.fillStyle = '#7a4aff'; ctx.beginPath(); ctx.arc(x, y - 4, 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1; P(ctx, x - 12, y - 2, '#2a2040', 24, 4); P(ctx, x - 10, y - 6, '#1a1428', 20, 5); P(ctx, x - 8, y - 10, '#0e0a18', 16, 5); P(ctx, x - 6, y - 13, '#06040c', 12, 4); P(ctx, x - 14, y - 14, '#5a4a7a', 3, 14); P(ctx, x + 11, y - 14, '#5a4a7a', 3, 14); P(ctx, x - 15, y - 16, '#7a6a9a', 5, 2); P(ctx, x + 10, y - 16, '#7a6a9a', 5, 2); P(ctx, x - 2 + Math.floor(F.time * 2) % 2, y - 8, '#c58cff', 1, 1); P(ctx, x + 3, y - 10, '#c58cff', 1, 1); }
  function paintMap(c) { var d = dg(); for (var y = d.y - 50; y < d.y + 50; y++) for (var x = d.x - 60; x < d.x + 60; x++) { if (x < 0 || y < 0 || x >= WW || y >= WH) continue; if (dist({ x: x, y: y }, d) < 48 && Math.random() < 0.45) P(c, x, y, Math.random() < 0.7 ? '#2a2438' : '#3a3050', 1, 1); } }
  function drawMob(ctx, h) { var x = Math.round(h.x), y = Math.round(h.y), b = Math.floor((h.walk || 0) % 2), s = h.boss ? 2 : 1, f = h.face || 1; ctx.globalAlpha = 0.5; P(ctx, x - 4 * s, y - 1, '#000', 8 * s, 2); ctx.globalAlpha = 1; P(ctx, x - 4 * s, y - 8 * s + b, '#3a2a5a', 8 * s, 7 * s); P(ctx, x - 3 * s, y - 10 * s + b, '#4a3a6a', 6 * s, 2 * s); P(ctx, x - 2 * s, y - 7 * s + b, '#ff4060', s, s); P(ctx, x + 1 * s, y - 7 * s + b, '#ff4060', s, s); if (h.anim > 0) P(ctx, x + 4 * s * f, y - 6 * s, '#c58cff', 2, 3); if (h.boss) { P(ctx, x - 4, y - 23 + b, '#ffd34f', 8, 2); P(ctx, x - 4, y - 25 + b, '#ffd34f', 2, 2); P(ctx, x + 2, y - 25 + b, '#ffd34f', 2, 2); P(ctx, x - 1, y - 26 + b, '#ffd34f', 2, 3); } P(ctx, x - 5 * s, y + 2, '#000', 10 * s, 1); P(ctx, x - 5 * s, y + 2, '#c58cff', Math.round(10 * s * clamp(h.hp / h.mhp, 0, 1)), 1); }
  function draw(ctx) {
    if (!A.on) return; var r = st(), x = Math.round(A.x), y = Math.round(A.y), t = y - 17, f = A.face, a = A.anim > 0 ? 1 : 0, walk = (A.joy.x || A.joy.y || A.tgt) ? Math.floor(A.walk % 2) : 0;
    ctx.globalAlpha = 0.18 + 0.06 * Math.sin(F.time * 4); ctx.fillStyle = '#ffd34f'; ctx.beginPath(); ctx.arc(x, y - 7, 13, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    var armor = r.equip.armor, robe = armor ? g.mix('#f4f4ff', R.RARITY[armor.rar].col, 0.35) : '#f4f4ff', sw = r.equip.weapon ? R.RARITY[r.equip.weapon.rar].col : '#c0c0c8';
    P(ctx, x - 3, t - 4 - Math.floor(F.time * 3) % 2, '#ffd34f', 6, 1); P(ctx, x - 4, t - 3 - Math.floor(F.time * 3) % 2, '#ffd34f', 1, 1); P(ctx, x + 3, t - 3 - Math.floor(F.time * 3) % 2, '#ffd34f', 1, 1);
    P(ctx, x - 3, t, '#ffe9a8', 6, 2); P(ctx, x - 3, t + 2, '#f3d9b1', 6, 4); P(ctx, x - 2 * f, t + 4, '#4a3a9a', 1, 1); P(ctx, x + (f > 0 ? 1 : -1), t + 4, '#4a3a9a', 1, 1);
    P(ctx, x - 4, t + 6, robe, 8, 8); P(ctx, x - 4, t + 9, '#ffd34f', 8, 1); P(ctx, x - 4, t + 13, '#ffd34f', 8, 1); P(ctx, x - 1, t + 6, '#ffd34f', 2, 3);
    P(ctx, x - 2, t + 14, '#e0e0f0', 2, 3 + walk); P(ctx, x, t + 14, '#e0e0f0', 2, 4 - walk);
    P(ctx, x + 4 * f, t + 3 - a * 3, sw, 1, 9); P(ctx, x + 4 * f + (f > 0 ? 1 : -2), t + 9 - a * 3, '#8a6a3a', 2, 2); if (a) P(ctx, x + 6 * f, t + 1, '#fff', 2, 1);
    P(ctx, x - 7, y + 3, '#000', 14, 2); P(ctx, x - 7, y + 3, A.hp / maxHp() < 0.3 ? '#ff5a50' : '#7fd36b', Math.round(14 * clamp(A.hp / maxHp(), 0, 1)), 2);
  }
  function drawVillagerExtra(ctx, v, x, t, f) { if (!v.gear) return; if (v.gear.weapon) { var c = R.RARITY[v.gear.weapon.rar].col; P(ctx, x + 3 * f, t + 3, c, 1, 5); P(ctx, x + 3 * f, t + 2, '#fff', 1, 1); } if (v.gear.armor) P(ctx, x - 3, t + 7, R.RARITY[v.gear.armor.rar].col, 6, 1); }
  function labels() {
    var box = $('#labels'), seen = {}, p = F.pix, ox = -cam.x, oy = -cam.y; if (!box) return;
    function el(id, cls) { var e = labelEls[id]; if (!e) { e = document.createElement('div'); e.className = cls; box.appendChild(e); labelEls[id] = e; } seen[id] = true; return e; }
    if (A.on && g.inView(A, 10)) { var e = el('av', 'tag watch'); e.textContent = '⚡ 화신 Lv.' + st().lv; e.style.left = (A.x + ox) * p + 'px'; e.style.top = (A.y + 4 + oy) * p + 'px'; }
    var d = dg(); if (g.isExplored(d.c, d.r) && g.inView(d, 20)) { var de = el('dg', 'tag dg'); de.textContent = '🕳️ 고대 미궁' + (d.floor ? ' ' + d.floor + '층' : '') + (d.best ? ' · 최고 ' + d.best : ''); de.style.left = (d.x + ox) * p + 'px'; de.style.top = (d.y + 12 + oy) * p + 'px'; }
    S.pickups.forEach(function (pk) { if (pk.kind !== 'meteor' || pk.taken || !g.inView(pk, 10)) return; var me = el('mt' + pk.id, 'tag meteor'); me.textContent = '☄️ 유성 ' + Math.max(0, Math.ceil((pk.until - Date.now()) / 60000)) + '분'; me.style.left = (pk.x + ox) * p + 'px'; me.style.top = (pk.y + 2 + oy) * p + 'px'; });
    Object.keys(labelEls).forEach(function (id) { if (!seen[id]) { labelEls[id].remove(); delete labelEls[id]; } });
  }

  // ---------- HUD·패널 ----------
  function fmtT(ms) { if (ms <= 0) return '지금'; var m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60) + '분' : m + '분'; }
  function fmtS(ms) { if (ms <= 0) return '지금'; var m = Math.ceil(ms / 60000); return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
  function hud() {
    var r = st(), now = Date.now(), b = $('#descendBtn'); if (!b) return;
    b.textContent = A.on ? '⚡ 강림 중' : '⚡ 강림 ' + r.charges + '/' + R.charges; b.classList.toggle('on', A.aim); b.classList.toggle('poor', !A.on && !!canDescend());
    var line = $('#rpgLine'); if (line) line.textContent = '☄️ ' + fmtS(r.ev.meteorAt - now) + ' · 👹 ' + fmtS(r.ev.hordeAt - now) + (r.charges < R.charges ? ' · ⚡ ' + fmtS(r.chargeT + R.chargeEvery - now) : '') + (now < r.cd ? ' · 💀 ' + fmtS(r.cd - now) : '');
    labels();
  }
  function hudBar() {
    if (!A.on) return; var r = st(), mh = maxHp(); $('#avLv').textContent = 'Lv.' + r.lv; $('#avHp').textContent = Math.round(A.hp) + '/' + mh; $('#avHpFill').style.width = clamp(A.hp / mh * 100, 0, 100) + '%';
    R.skills.forEach(function (sk, i) { var b = $('#sk' + i); b.classList.toggle('cd', A.cd[i] > 0); b.querySelector('small').textContent = A.cd[i] > 0 ? Math.ceil(A.cd[i]) + 's' : sk.nm; });
    var d = dg(), near = dist(A, d) < 24, db = $('#dgBtn'); db.hidden = !(near || d.floor > 0); db.innerHTML = d.active ? '⚔️<small>' + d.floor + '층 전투</small>' : d.floor > 0 ? '⬇️<small>' + (d.floor + 1) + '층으로</small>' : '🕳️<small>입장</small>'; db.disabled = d.active || !near;
  }
  function renderPanel() {
    var r = st(), now = Date.now(), d = dg(), why = canDescend();
    var eqHtml = Object.keys(R.SLOTS).map(function (k) { var sl = R.SLOTS[k], it = r.equip[k]; return '<div class="item rar' + (it ? it.rar : 'x') + '"><div class="ic">' + sl.ic + '</div><div class="body"><div class="nm">' + sl.nm + ': ' + (it ? '<span style="color:' + R.RARITY[it.rar].col + '">' + esc(itemName(it)) + '</span>' : '<span class="sub">비어 있음</span>') + '</div><div class="sub">' + (it ? esc(itemDesc(it)) : '가방에서 착용') + '</div></div>' + (it ? '<button class="btn small" data-rpg="enhance:' + it.id + '">강화</button><button class="btn small" data-rpg="unequip:' + k + '">해제</button>' : '') + '</div>'; }).join('');
    var invHtml = r.inv.map(function (it) { var rd = R.RARITY[it.rar], cost = R.enhance.costMetal * (it.plus + 1), rate = Math.round((R.enhance.rates[it.plus] || 0.2) * 100); return '<div class="item rar' + it.rar + '"><div class="ic">' + R.SLOTS[it.slot].ic + '</div><div class="body"><div class="nm" style="color:' + rd.col + '">' + esc(itemName(it)) + ' <span class="sub">' + rd.nm + ' · ' + R.SLOTS[it.slot].nm + '</span></div><div class="sub">' + esc(itemDesc(it)) + '</div></div><div class="col"><button class="btn small" data-rpg="equip:' + it.id + '">착용</button><button class="btn small" data-rpg="enhance:' + it.id + '" title="⛏️' + cost + ' · ' + rate + '%">강화 ⛏️' + cost + '</button><button class="btn small" data-rpg="dismantle:' + it.id + '">분해</button></div></div>'; }).join('') || '<div class="sub">장비가 없어요. 괴물·산적 소굴·적 기지·유성·습격·미궁에서 떨어집니다.</div>';
    $('#tab-rpg').innerHTML = '<div class="rpgav"><div class="nm">⚡ 화신 Lv.' + r.lv + ' <span class="sub">' + (A.on ? '강림 중 · ❤️' + Math.round(A.hp) + '/' + maxHp() : '하늘에 있음') + '</span></div><div class="xpbar"><i style="width:' + Math.round(r.xp / xpNext() * 100) + '%"></i><span>XP ' + r.xp + '/' + xpNext() + '</span></div><div class="sub">❤️ ' + maxHp() + ' · ⚔️ ' + atk() + ' · 치명 ' + crit() + '% · 이동 +' + Math.round((spd() / R.base.spd - 1) * 100) + '% · 믿음 획득 +' + Math.round((faithMul() - 1) * 100) + '% · 경험치 +' + Math.round((xpMul() - 1) * 100) + '% · 회복 ' + (1 + regen()) + '/s</div><div class="sub">강림 ' + r.charges + '/' + R.charges + (r.charges < R.charges ? ' (다음 충전 ' + fmtT(r.chargeT + R.chargeEvery - now) + ')' : '') + ' · 처치 ' + r.kills + ' · 쓰러짐 ' + r.deaths + (now < r.cd ? ' · 💀 쿨타임 ' + fmtT(r.cd - now) : '') + '</div>' +
      '<div class="row">' + (A.on ? '<button class="btn" data-rpg="ascend">🕊️ 승천</button>' : '<button class="btn primary" data-rpg="descend" ' + (why ? 'disabled' : '') + '>⚡ 강림 (믿음 ' + R.descendCost + ')' + (why ? ' — ' + esc(why) : '') + '</button>') + '</div>' +
      '<p class="hint">강림을 누른 뒤 지도를 탭하면 그 자리에 내려옵니다. 왼쪽 조이스틱으로 움직이고(지도를 탭해도 그쪽으로 걸어감), 가까운 적은 자동으로 벱니다. ' + R.skills.map(function (s) { return s.ic + ' ' + s.nm + '(' + s.desc + ', ' + s.cd + '초)'; }).join(' · ') + '. 강림 중엔 믿음이 분당 ' + Math.round(R.drain * 60) + ' 줄고, 쓰러지면 믿음 -' + R.deathFaith + '과 ' + Math.round(R.deathCd / 60) + '분 쿨타임. 화신 곁의 전사는 공격 ' + R.morale + '배.</p></div>' +
      '<h3>🗡️ 장비</h3><div class="list">' + eqHtml + '</div>' +
      '<h3>🎒 가방 ' + r.inv.length + '/' + R.invMax + '</h3><p class="hint">강화는 +1마다 기본 능력 +' + Math.round(R.enhance.step * 100) + '%, 금속 ' + R.enhance.costMetal + '×(현재 강화+1). +3까지는 100%, 그 뒤로 확률이 떨어지고 실패하면 금속만 잃습니다. 분해하면 믿음·금속. 장군·영웅 등 어른 시민에게도 시민 시트에서 무기·갑옷을 줄 수 있습니다.</p><div class="list">' + invHtml + '</div>' +
      '<h3>🕳️ ' + R.dungeon.nm + '</h3><p class="hint">지도 ' + (d.c + 1) + '열 ' + (d.r + 1) + '행 칸의 보라색 계단. 화신이 입구 옆에서 🕳️ 입장을 누르면 층마다 그림자 무리가 나오고 ' + R.dungeon.bossEvery + '층마다 보스. 층을 깰 때마다 믿음, 오늘 처음 깬 층은 장비(깊을수록 좋음). 입구에서 멀어지거나 승천하면 1층부터. 전사들을 🚩 집결로 데려가면 같이 싸웁니다.<br>최고 ' + d.best + '층 · 오늘 ' + d.maxToday + '층까지' + (d.floor ? ' · 지금 ' + d.floor + '층' : '') + '</p>' +
      '<h3>⏰ 시간 이벤트</h3><p class="hint">☄️ 다음 유성 ' + fmtT(r.ev.meteorAt - now) + ' (3시간마다, 1시간 안에 주우면 금속·믿음·장비) · 👹 다음 습격 ' + fmtT(r.ev.hordeAt - now) + ' (6시간마다, 다 막으면 장비 상자) · 격퇴 ' + r.hordeWins + '회<br>24시간 넘게 비우면 적 세력이 기지를 넓히고 시민이 신을 의심합니다. 돌아오면 시간당 믿음 +' + R.offline.returnFaithPerH + '(최대 ' + R.offline.returnMax + ').</p>' +
      '<h3>📅 출석 — 연속 ' + r.attend.streak + '일</h3><div class="attgrid small">' + R.attend.map(function (a, i) { var day = attendDay(); return '<div class="' + (i < day || (i === day && !r.attend.pending) ? 'done' : i === day ? 'now' : '') + '"><b>' + (i + 1) + '일</b>' + a.ic + '<small>' + esc(a.nm) + '</small></div>'; }).join('') + '</div>' + (r.attend.pending ? '<div class="row"><button class="btn primary" data-rpg="attend">📅 오늘 출석 보상 받기</button></div>' : '');
  }
  function panelClick(e) {
    var b = e.target.closest('[data-rpg]'); if (!b) return; var m = b.dataset.rpg.split(':'), act = m[0], id = m[1];
    if (act === 'descend') { if (canDescend()) return g.toast('⚡ ' + canDescend()); A.aim = true; $('.field').classList.add('aiming'); $('#panel').hidden = true; document.querySelectorAll('.navbtn').forEach(function (x) { x.classList.remove('on'); }); g.toast('⚡ 지도를 탭하면 그 자리에 강림합니다'); hud(); return; }
    if (act === 'ascend') ascend('panel'); if (act === 'equip') equip(id); if (act === 'unequip') unequip(id); if (act === 'enhance') enhance(id); if (act === 'dismantle') dismantle(id); if (act === 'attend') claimAttend();
    renderPanel(); g.renderHead(); g.save();
  }
  function villagerSheet(v) {
    if (v.child) return ''; var r = st(), gear = v.gear || {}, rows = ['weapon', 'armor'].map(function (k) { var it = gear[k], sl = R.SLOTS[k]; return '<div class="sub">' + sl.ic + ' ' + sl.nm + ': ' + (it ? '<span style="color:' + R.RARITY[it.rar].col + '">' + esc(itemName(it)) + '</span> (' + esc(itemDesc(it)) + ') <button class="btn small" data-unequip="' + k + '">회수</button>' : '없음') + '</div>'; }).join('');
    var give = r.inv.filter(function (it) { return it.slot !== 'charm'; }).map(function (it) { return '<button class="btn small" data-give="' + it.id + '" style="border-color:' + R.RARITY[it.rar].col + '">' + esc(itemName(it)) + '</button>'; }).join('');
    return '<div class="np-txt"><b>🗡️ 장비</b>' + rows + (give ? '<div class="row">' + give + '</div>' : '<div class="sub">가방에 줄 무기·갑옷이 없어요</div>') + '</div>';
  }

  // ---------- 조작(조이스틱·버튼) ----------
  function bind() {
    var joy = $('#joy'), knob = $('#joyKnob'), jid = null;
    function setJoy(e) { var rct = joy.getBoundingClientRect(), cx = rct.left + rct.width / 2, cy = rct.top + rct.height / 2, dx = e.clientX - cx, dy = e.clientY - cy, d = Math.sqrt(dx * dx + dy * dy), max = rct.width / 2 - 8; if (d > max) { dx = dx / d * max; dy = dy / d * max; } A.joy.x = dx / max; A.joy.y = dy / max; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    joy.addEventListener('pointerdown', function (e) { jid = e.pointerId; joy.setPointerCapture(jid); setJoy(e); e.preventDefault(); });
    joy.addEventListener('pointermove', function (e) { if (e.pointerId === jid) setJoy(e); });
    function end(e) { if (e.pointerId !== jid) return; jid = null; A.joy.x = A.joy.y = 0; knob.style.transform = ''; }
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    $('#sk0').addEventListener('click', function () { useSkill(0); hudBar(); }); $('#sk1').addEventListener('click', function () { useSkill(1); hudBar(); });
    $('#ascendBtn').addEventListener('click', function () { ascend('button'); }); $('#dgBtn').addEventListener('click', function () { enterDungeon(); hudBar(); });
    $('#descendBtn').addEventListener('click', function () { if (A.on) { g.panTo(A); return; } var why = canDescend(); if (why) return g.toast('⚡ ' + why); A.aim = !A.aim; $('.field').classList.toggle('aiming', A.aim); g.ui.power = null; if (A.aim) g.toast('⚡ 지도를 탭하면 그 자리에 강림합니다 (믿음 ' + R.descendCost + ')'); hud(); g.renderHead(); });
    $('#tab-rpg').addEventListener('click', panelClick); $('#attendOk').addEventListener('click', claimAttend); $('#attendClose').addEventListener('click', function () { $('#attend').hidden = true; });
    document.addEventListener('keydown', function (e) { if (!A.on) return; var k = e.key.toLowerCase(); if (k === 'q') useSkill(0); if (k === 'e') useSkill(1); });
  }

  // ---------- 시작 ----------
  function init() {
    st(); bind(); recharge(Date.now());
    if (F.offlineMins) { var extra = offline(F.offlineMins); if (extra) $('#welcomeText').textContent += extra; }
    checkAttend(); hud(); g.renderHead();
  }
  window.RPG = { init: init, step: step, slowTick: slowTick, draw: draw, drawUnder: drawUnder, drawMob: drawMob, drawVillagerExtra: drawVillagerExtra, paintMap: paintMap, hud: hud, tap: tap, target: target, hurt: hurt, onKill: onKill, drop: drop, onPickup: onPickup, vb: vb, renderPanel: renderPanel, villagerSheet: villagerSheet, give: give, unequipV: unequipV,
    descend: descend, ascend: ascend, useSkill: useSkill, equip: equip, unequip: unequip, enhance: enhance, dismantle: dismantle, makeItem: makeItem, gainXp: gainXp, enterDungeon: enterDungeon, spawnMeteor: spawnMeteor, spawnHorde: spawnHorde, checkAttend: checkAttend, claimAttend: claimAttend, offline: offline, A: function () { return A; }, maxHp: maxHp, atk: atk };
  init();
})();
