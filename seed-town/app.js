/* 씨앗 마을 화면. 규칙은 engine.js, 숫자·글은 data.js 에 있다. 여기는 그리기와 누르기만 한다. */
(function () {
  'use strict';
  var D = window.SEED_DATA, E = window.SeedEngine;
  var KEY = 'seedtown.v1';
  var INK = '#5a4632';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 저장 ---------- */
  var S = load();
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.players) return s; } catch (e) {}
    return { v: 1, cur: null, players: {}, opt: { voice: true, sound: true } };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  Object.keys(S.players).forEach(function (n) { E.upgrade(S.players[n], D); });
  function P() { return S.cur ? S.players[S.cur] : null; }
  function si() { var p = P(); return p ? E.stageIdx(p, D) : 0; }   // 0 씨앗 1 새싹 2 나무 3 숲
  // 나무 단계부터는 실제 말을 쓴다
  function T(k) { return (si() >= 2 ? { seed: '주식', price: '주가', fruit: '배당', plant: '사기', pull: '팔기' } : { seed: '씨앗', price: '씨앗 값', fruit: '열매', plant: '심기', pull: '꺼내기' })[k]; }
  function num(x) { return x === undefined || x === null ? '-' : (Math.round(x * 100) / 100).toLocaleString('ko-KR'); }
  function pctText(x) { return x === null || x === undefined ? '-' : Math.round(x * 100) + '%'; }
  function arrow(c) { var h = c.hist, n = h.length; if (n < 2) return ''; var d = h[n - 1].price - h[n - 2].price; return d > 0.005 ? '<i class="up">▲</i>' : d < -0.005 ? '<i class="dn">▼</i>' : ''; }
  // 값 그래프 (최근 16계절)
  function spark(c) {
    var v = c.hist.slice(-16).map(function (h) { return h.price; });
    if (v.length < 2) return '';
    var mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), w = 220, hgt = 54, pts = v.map(function (y, i) {
      return (6 + i * (w - 12) / (v.length - 1)).toFixed(1) + ',' + (hgt - 6 - (mx > mn ? (y - mn) / (mx - mn) : 0.5) * (hgt - 14)).toFixed(1);
    });
    var last = pts[pts.length - 1].split(',');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + hgt + '" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="#7a9e5a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="#e08a3c" stroke="' + INK + '" stroke-width="1.5"/></svg>' +
      '<p class="sparkcap">가장 낮을 때 ' + num(mn) + ' · 가장 높을 때 ' + num(mx) + '</p>';
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function shopDef(id) { for (var i = 0; i < D.SHOPS.length; i++) if (D.SHOPS[i].id === id) return D.SHOPS[i]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 소리·읽어 주기 ---------- */
  var actx = null;
  function beep(freq, dur, type) {
    if (!S.opt.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
    } catch (e) {}
  }
  function chime() { beep(660, 0.12); setTimeout(function () { beep(880, 0.18); }, 110); }
  function say(text) {
    if (!S.opt.voice || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------- 그림 (전부 코드로 그린다) ---------- */
  function shade(hex, k) {   // k<1 어둡게
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (x) { return Math.max(0, Math.min(255, Math.round(x * k))); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  function coinSvg(size) {
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5" fill="#edc04a" stroke="' + INK + '" stroke-width="1.6"/><circle cx="10" cy="10" r="5" fill="none" stroke="#b98a1e" stroke-width="1.3"/></svg>';
  }
  function starSvg(size) {
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 20 20"><path d="M10 1.8l2.5 5.3 5.7.7-4.2 4 1.1 5.7L10 14.7l-5.1 2.8 1.1-5.7-4.2-4 5.7-.7z" fill="#f0a84a" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  }
  function fruitSvg(size) {
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 20 20"><circle cx="10" cy="11.5" r="6.8" fill="#d2553f" stroke="' + INK + '" stroke-width="1.5"/><path d="M10 5q1-3.5 4.5-3.5Q14 5 10 5z" fill="#7a9e5a" stroke="' + INK + '" stroke-width="1.1"/></svg>';
  }
  function faceSvg(mood, size) {
    var fill = { good: '#f2c14e', ok: '#eadcbd', bad: '#b7c3cb', unknown: '#e6d3ee' }[mood] || '#eadcbd';
    var mouth = mood === 'good' ? '<path d="M-6 3Q0 10 6 3" />' : mood === 'bad' ? '<path d="M-6 8Q0 2 6 8" />' : mood === 'unknown' ? '' : '<path d="M-5 6H5" />';
    var eyes = mood === 'unknown'
      ? '<text x="0" y="6" text-anchor="middle" font-size="17" font-weight="700" fill="' + INK + '" stroke="none">?</text>'
      : '<circle cx="-5" cy="-3" r="1.6" fill="' + INK + '"/><circle cx="5" cy="-3" r="1.6" fill="' + INK + '"/>';
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="-15 -15 30 30"><g fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"><circle r="12.5" fill="' + fill + '"/>' + eyes + mouth + '</g></svg>';
  }
  function glyph(sign, x, y) {
    var g = '<g transform="translate(' + x + ' ' + y + ')" stroke="' + INK + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">';
    if (sign === 'bread') g += '<ellipse rx="10" ry="6.5" fill="#c98a4b"/><path d="M-5-3l2 5M0-4l2 6M5-3l1.5 4" fill="none"/>';
    else if (sign === 'apple') g += '<circle cy="1" r="7" fill="#d2553f"/><path d="M0-6q1-4 5-4" fill="none"/>';
    else if (sign === 'star') g += '<path d="M0-9l2.6 5.4 6 .8-4.4 4.1 1.1 5.9L0 8.3l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8z" fill="#f3d36b"/>';
    else if (sign === 'wheel') g += '<circle r="8" fill="#f7f0e1"/><path d="M-8 0H8M0-8V8M-5.6-5.6l11.2 11.2M-5.6 5.6L5.6-5.6" fill="none" stroke-width="1.1"/>';
    else if (sign === 'book') g += '<path d="M0-5q-5-3-10-1v11q5-2 10 1q5-3 10-1V-6q-5-2-10 1z" fill="#f7f0e1"/><path d="M0-5V6" fill="none"/>';
    else if (sign === 'cone') g += '<path d="M-5 0L0 10 5 0z" fill="#d9a35c"/><circle cy="-3" r="6" fill="#f6d6d0"/>';
    return g + '</g>';
  }
  var FRUIT_AT = [[-7, -4], [8, -8], [0, 6], [-10, 8], [11, 5]];
  function treeSvg(tier, h, x, gy) {
    var s = '';
    if (!tier) {
      return '<ellipse cx="' + x + '" cy="' + (gy - 1) + '" rx="13" ry="4" fill="#b99769" stroke="' + INK + '" stroke-width="1.4" stroke-dasharray="3 3"/>';
    }
    if (tier === 1) {
      s += '<path d="M' + x + ' ' + gy + 'v-13" stroke="#6f8f4c" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<path d="M' + x + ' ' + (gy - 11) + 'q-9-1-10-9q9 0 10 9zM' + x + ' ' + (gy - 12) + 'q9-2 10-10q-9 1-10 10z" fill="#8fb36a" stroke="' + INK + '" stroke-width="1.4"/>';
    } else {
      var th = [0, 0, 16, 25, 32][tier], r = [0, 0, 13, 18, 23][tier], cy = gy - th - r + 5;
      s += '<path d="M' + (x - 3) + ' ' + gy + 'L' + (x - 2) + ' ' + (gy - th) + 'h4L' + (x + 3) + ' ' + gy + 'z" fill="#9a7148" stroke="' + INK + '" stroke-width="1.5"/>';
      if (tier === 4) s += '<circle cx="' + (x - 19) + '" cy="' + (cy + 13) + '" r="13" fill="#9cbf74" stroke="' + INK + '" stroke-width="1.6"/><circle cx="' + (x + 18) + '" cy="' + (cy + 14) + '" r="12" fill="#84a85f" stroke="' + INK + '" stroke-width="1.6"/>';
      s += '<circle cx="' + x + '" cy="' + cy + '" r="' + r + '" fill="#8fb36a" stroke="' + INK + '" stroke-width="1.8"/>';
      var k = r / 18;
      for (var i = 0; i < Math.min(5, h.ripe); i++) s += '<circle cx="' + (x + FRUIT_AT[i][0] * k) + '" cy="' + (cy + FRUIT_AT[i][1] * k) + '" r="4.6" fill="#d2553f" stroke="' + INK + '" stroke-width="1.3"/>';
      if (h.fruit > 0.08 && h.ripe < 5) {
        var p = FRUIT_AT[Math.min(4, h.ripe)];
        s += '<circle cx="' + (x + p[0] * k) + '" cy="' + (cy + p[1] * k) + '" r="' + (1.4 + 2.6 * h.fruit).toFixed(1) + '" fill="' + (h.fruit > 0.6 ? '#e9a15a' : '#c9d98b') + '" stroke="' + INK + '" stroke-width="1"/>';
      }
      return s;
    }
    // 새싹에도 익은 열매·자라는 꽃망울을 보여 준다
    if (h.ripe) s += '<circle cx="' + (x + 2) + '" cy="' + (gy - 22) + '" r="4.6" fill="#d2553f" stroke="' + INK + '" stroke-width="1.3"/>';
    else if (h.fruit > 0.08) s += '<circle cx="' + x + '" cy="' + (gy - 16) + '" r="' + (1.4 + 2.2 * h.fruit).toFixed(1) + '" fill="' + (h.fruit > 0.6 ? '#e9a15a' : '#c9d98b') + '" stroke="' + INK + '" stroke-width="1"/>';
    return s;
  }
  function tierOf(v) { var t = D.RULES.treeTiers, n = 0; for (var i = 0; i < t.length; i++) if (v >= t[i]) n = i + 1; return n; }

  // 가게 + 내 나무. viewBox 170x140, 땅은 y=120
  function shopSvg(def, c, h, value, big) {
    var gy = 120, lvl = E.level(def, c), bw = 60 + lvl * 7, bh = 38 + lvl * 9, bx = 8, by = gy - bh;
    var closed = c.closed > 0, wall = closed ? '#cfc8bb' : def.color, roof = closed ? '#a39c90' : def.roof, edge = INK;
    var s = '<svg viewBox="0 0 170 140" class="shopart' + (big ? ' big' : '') + '" aria-hidden="true"><g filter="url(#cr)">';
    s += '<path d="M2 ' + gy + 'q40-3 84 0t82 0" stroke="' + INK + '" stroke-width="1.6" fill="none" opacity=".55"/>';
    s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="' + wall + '" stroke="' + edge + '" stroke-width="2.2"/>';
    s += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" fill="url(#hatch)" opacity=".5"/>';
    var cx = bx + bw / 2;
    if (def.shape === 'tri') s += '<path d="M' + (bx - 7) + ' ' + by + 'L' + cx + ' ' + (by - 24) + 'L' + (bx + bw + 7) + ' ' + by + 'z" fill="' + roof + '" stroke="' + edge + '" stroke-width="2.2" stroke-linejoin="round"/>';
    else if (def.shape === 'dome') s += '<path d="M' + (bx - 4) + ' ' + by + 'Q' + cx + ' ' + (by - 42) + ' ' + (bx + bw + 4) + ' ' + by + 'z" fill="' + roof + '" stroke="' + edge + '" stroke-width="2.2"/>';
    else if (def.shape === 'flat') s += '<rect x="' + (bx - 4) + '" y="' + (by - 9) + '" width="' + (bw + 8) + '" height="10" fill="' + roof + '" stroke="' + edge + '" stroke-width="2.2"/><rect x="' + (cx - 16) + '" y="' + (by - 27) + '" width="32" height="18" fill="#f7f0e1" stroke="' + edge + '" stroke-width="2"/>';
    else {   // awning: 줄무늬 차양
      s += '<rect x="' + (bx - 3) + '" y="' + (by - 7) + '" width="' + (bw + 6) + '" height="8" fill="' + roof + '" stroke="' + edge + '" stroke-width="2.2"/>';
      var n = 6, w = (bw + 10) / n;
      for (var i = 0; i < n; i++) s += '<path d="M' + (bx - 5 + i * w) + ' ' + (by + 1) + 'h' + w + 'v9q-' + (w / 2) + ' 6-' + w + ' 0z" fill="' + (i % 2 ? '#f7f0e1' : roof) + '" stroke="' + edge + '" stroke-width="1.4"/>';
    }
    // 문·창문
    var top = def.shape === 'awning' ? by + 19 : by + 7;
    s += '<rect x="' + (bx + bw - 23) + '" y="' + (gy - 27) + '" width="15" height="27" fill="' + (closed ? '#8c857a' : shade(wall, 0.62)) + '" stroke="' + edge + '" stroke-width="1.8"/>';
    s += '<rect x="' + (bx + 8) + '" y="' + (gy - 27) + '" width="' + (bw - 40) + '" height="17" fill="#fbf3dc" stroke="' + edge + '" stroke-width="1.8"/>';
    for (var f = 1; f < lvl; f++) {   // 층이 늘면 윗창이 생긴다
      var wy = gy - 27 - f * 13;
      if (wy > top) s += '<rect x="' + (bx + 9) + '" y="' + wy + '" width="9" height="8" fill="#fbf3dc" stroke="' + edge + '" stroke-width="1.4"/><rect x="' + (bx + bw - 19) + '" y="' + wy + '" width="9" height="8" fill="#fbf3dc" stroke="' + edge + '" stroke-width="1.4"/>';
    }
    if (closed) s += '<path d="M' + (bx + 6) + ' ' + (gy - 30) + 'L' + (bx + bw - 6) + ' ' + (gy - 4) + 'M' + (bx + bw - 6) + ' ' + (gy - 30) + 'L' + (bx + 6) + ' ' + (gy - 4) + '" stroke="#7a6a58" stroke-width="4" stroke-linecap="round"/>';
    else s += glyph(def.sign, def.shape === 'flat' ? cx : bx + 8 + (bw - 40) / 2, def.shape === 'flat' ? by - 18 : gy - 18.5);
    s += treeSvg(h ? Math.max(1, tierOf(value)) : 0, h || {}, 140, gy);
    return s + '</g></svg>';
  }

  // 하늘 띠: 계절 표시 + 소원으로 생긴 것들
  function skySvg(p, season) {
    var w = p.wishes, s = '<svg viewBox="0 0 360 74" class="skyart" aria-hidden="true"><g filter="url(#cr)" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">';
    if (w.rainbow) s += '<path d="M60 74a120 120 0 01240 0" fill="none" stroke="#d2553f" stroke-width="5"/><path d="M68 74a112 112 0 01224 0" fill="none" stroke="#edc04a" stroke-width="5"/><path d="M76 74a104 104 0 01208 0" fill="none" stroke="#7a9e5a" stroke-width="5"/>';
    // 계절
    if (season.id === 'summer') s += '<circle cx="34" cy="26" r="13" fill="#f2c14e"/><path d="M34 6v-4M34 50v-4M14 26h-4M58 26h-4M20 12l-3-3M48 12l3-3M20 40l-3 3M48 40l3 3" fill="none"/>';
    else if (season.id === 'spring') s += '<circle cx="34" cy="26" r="11" fill="#f5d98a"/><g fill="#f3b7b0"><circle cx="70" cy="14" r="3"/><circle cx="84" cy="30" r="2.5"/><circle cx="58" cy="40" r="2.5"/></g>';
    else if (season.id === 'fall') s += '<circle cx="34" cy="26" r="11" fill="#eeb05c"/><path d="M62 16q8-6 12 2q-6 6-12-2zM82 36q7-5 11 2q-6 5-11-2z" fill="#cf7a3c"/>';
    else s += '<circle cx="34" cy="26" r="10" fill="#f3efe2"/><g fill="#fff"><circle cx="64" cy="14" r="2.6"/><circle cx="80" cy="34" r="2.6"/><circle cx="56" cy="44" r="2.2"/><circle cx="96" cy="20" r="2.2"/></g>';
    if (w.balloon) s += '<path d="M118 30a14 16 0 1128 0q0 10-10 18h-8q-10-8-10-18z" fill="#e08a3c"/><rect x="127" y="52" width="10" height="7" fill="#c9a27a"/>';
    if (w.flower) for (var i = 0; i < 4; i++) s += '<path d="M' + (158 + i * 11) + ' 74v-12" fill="none" stroke="#6f8f4c"/><circle cx="' + (158 + i * 11) + '" cy="60" r="4.2" fill="' + ['#e8a9a0', '#f2c14e', '#d2553f', '#f6d6d0'][i] + '"/>';
    if (w.swing) s += '<path d="M208 74V44h30v30M214 44v20M232 44v20" fill="none"/><rect x="212" y="63" width="22" height="4" fill="#c98a4b"/>';
    if (w.fountain) s += '<path d="M252 74v-8h34v8zM262 66v-10h14v10z" fill="#cfd6d2"/><path d="M269 56q-10-14-14-2M269 56q10-14 14-2M269 56v-14" fill="none" stroke="#6fa3a0"/>';
    if (w.mill) s += '<path d="M300 74l4-34h12l4 34z" fill="#eadcbd"/><path d="M310 40l-16-14M310 40l16-14M310 40l-14 16M310 40l14 16" fill="none" stroke-width="3"/>';
    if (w.tower) s += '<rect x="332" y="22" width="18" height="52" fill="#d9c49a"/><path d="M329 22l12-14 12 14z" fill="#b5533c"/><circle cx="341" cy="36" r="6" fill="#fbf3dc"/><path d="M341 36v-4M341 36h3" fill="none" stroke-width="1.2"/>';
    return s + '</g></svg>';
  }

  /* ---------- 화면 ---------- */
  var app = $('app'), sheet = $('sheet'), sheetBody = $('sheetBody');
  var openShopId = null, lastReport = null;

  function seasonOf(p) { return D.SEASONS[p.world.turn % 4]; }
  function yearOf(p) { return Math.floor(p.world.turn / 4) + 1; }
  function nextWish(p) { for (var i = 0; i < D.WISHES.length; i++) if (!p.wishes[D.WISHES[i].id]) return D.WISHES[i]; return null; }

  function render() {
    var p = P();
    closeSheet(true);
    if (!p) return renderPick();
    E.touchDay(p, today()); save();
    if (!p.introDone) return renderIntro();
    var se = seasonOf(p), w = E.wealth(p), nw = nextWish(p);
    document.body.style.background = se.sky;
    var h = '<header class="top"><div class="when"><b>' + yearOf(p) + '년째</b> ' + se.name + (si() ? ' <small class="stg">' + D.STAGES[si()].name + '</small>' : '') + '</div>' +
      '<div class="purse" id="purse">' + coinSvg(24) + '<b id="coinN">' + p.coins + '</b></div>' +
      '<div class="purse">' + starSvg(22) + '<b>' + p.stars + '</b></div>' +
      '<button class="gear" data-act="parent" aria-label="어른 메뉴">어른</button></header>';
    h += '<div class="sky">' + skySvg(p, se) + '</div>';
    h += '<div class="goal"><span>마을 보물 <b>' + w + '</b></span>' +
      (nw ? '<span class="bar"><i style="width:' + Math.min(100, Math.round(w / nw.at * 100)) + '%"></i></span><span>' + nw.at + '개면 <b>' + nw.name + '</b></span>' : '<span>소원을 모두 이뤘어요</span>') + '</div>';
    h += '<main class="town" style="background:' + se.ground + '">';
    D.SHOPS.forEach(function (def) {
      var c = p.world.shops[def.id], hd = p.hold[def.id], v = E.valueOf(p, def.id);
      h += '<div class="lot"><button class="shop" data-act="shop" data-id="' + def.id + '">' + shopSvg(def, c, hd, v) +
        '<span class="nm">' + esc(def.name) + '</span>' +
        (c.closed > 0 ? '<span class="mine shut">문 닫음</span>' : hd ? '<span class="mine">' + coinSvg(15) + hd.put + ' → <b>' + v + '</b></span>' : '<span class="mine none">빈 자리</span>') +
        '</button>' +
        (si() >= 1 && !c.closed ? '<span class="px">' + T('price') + ' ' + num(c.price) + arrow(c) + '</span>' : '') +
        (c.hist.length && !c.closed ? '<span class="mood">' + faceSvg(c.mood, 26) + '</span>' : '') +
        (hd && hd.ripe ? '<button class="pick" data-act="pick" data-id="' + def.id + '">' + fruitSvg(22) + '<b>' + hd.ripe + '</b> 따기</button>' : '') +
        '</div>';
    });
    h += '</main>';
    var can = E.canPlay(p, D), nx = D.SEASONS[(p.world.turn + 1) % 4];
    h += '<footer class="foot">' + (can
      ? '<button class="go" data-act="next">' + nx.name + '으로 가기</button>'
      : '<button class="go rest" data-act="night">오늘은 여기까지</button>') +
      (si() >= 3 ? '<button class="link" data-act="journal">투자일지 · 복기 (' + p.journal.length + ')</button>' : '') + '</footer>';
    app.innerHTML = h;
    if (!can) return showNight();
    if (p.news && p.news.guess === null) showNews();
  }

  function renderPick() {
    document.body.style.background = '#f6ecd6';
    var names = Object.keys(S.players), h = '<div class="pickpage"><h1>씨앗 마을</h1><p class="sub">누가 할까요?</p><div class="who">';
    var all = names.slice();
    D.RULES.profiles.forEach(function (n) { if (all.indexOf(n) < 0) all.push(n); });
    all.forEach(function (n) {
      var pl = S.players[n];
      h += '<button data-act="who" data-id="' + esc(n) + '"><b>' + esc(n) + '</b><small>' + (pl ? yearOf(pl) + '년째 · 보물 ' + E.wealth(pl) : '처음') + '</small></button>';
    });
    h += '</div><form id="newWho" class="newwho"><input id="whoName" maxlength="8" placeholder="다른 이름" aria-label="다른 이름"><button>시작</button></form></div>';
    app.innerHTML = h;
    $('newWho').addEventListener('submit', function (e) { e.preventDefault(); var v = $('whoName').value.trim(); if (v) pick(v); });
  }
  function pick(name) {
    if (!S.players[name]) S.players[name] = E.newPlayer(name, D, (Date.now() % 2147483647) | 0);
    S.cur = name; save(); render();
  }

  function renderIntro() {
    var p = P(), def = D.SHOPS[0];
    document.body.style.background = '#f6ecd6';
    app.innerHTML = '<div class="pickpage"><h1>' + esc(p.name) + '의 씨앗 마을</h1>' +
      '<div class="introart">' + shopSvg(def, p.world.shops[def.id], { ripe: 2, fruit: 0.5 }, 9, true) + '</div>' +
      '<ol class="intro">' + D.TEXT.intro.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
      '<button class="go" data-act="introOk">시작하기</button><button class="link" data-act="read" data-text="' + esc(D.TEXT.intro.join(' ')) + '">들려줘</button></div>';
    say(D.TEXT.intro.join(' '));
  }

  /* ---------- 아래에서 올라오는 창 ---------- */
  function openSheet(html, lock) {
    sheetBody.innerHTML = html; sheet.hidden = false; sheet.dataset.lock = lock ? '1' : '';
    sheetBody.scrollTop = 0;
  }
  function closeSheet(force) {
    if (!force && sheet.dataset.lock) return;
    sheet.hidden = true; sheetBody.innerHTML = ''; openShopId = null;
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  }

  function showNews() {
    var p = P(), card = E.newsCard(p, D);
    if (!card) return;
    var def = card.shop === 'all' ? null : shopDef(card.shop);
    var h = '<h2>' + (card.kind === 'disc' ? '오늘의 공시' : '오늘의 소식') + '</h2>';
    if (card.title) h += '<p class="doctitle">' + esc(card.title) + '</p>';
    h += def ? '<div class="newsart">' + shopSvg(def, p.world.shops[def.id], null, 0, true) + '</div><p class="tag">' + esc(def.name) + '</p>' : '<p class="tag">마을 전체</p>';
    h += '<p class="newstext">' + esc(card.text) + '</p>';
    h += '<button class="link" data-act="read" data-text="' + esc(card.text) + '">들려줘</button>';
    h += '<p class="ask">가게에 어떤 소식일까요?</p><div class="guess">' +
      '<button data-act="guess" data-id="good">' + faceSvg('good', 46) + '<span>좋은 소식</span></button>' +
      '<button data-act="guess" data-id="bad">' + faceSvg('bad', 46) + '<span>나쁜 소식</span></button>' +
      (p.world.turn >= D.RULES.rumorFrom || si() >= 2 ? '<button data-act="guess" data-id="unknown">' + faceSvg('unknown', 46) + '<span>아직 몰라요</span></button>' : '') + '</div>';
    openSheet(h, true);
    say(card.text);
  }
  // 새싹부터: 성적표의 어느 줄이 바뀔까
  function showLine() {
    var card = E.newsCard(P(), D);
    openSheet('<h2>하나 더!</h2><p class="newstext">' + esc(card.text) + '</p><p class="ask">가게 성적표의 어느 줄이 바뀔까요?</p><div class="guess">' +
      '<button data-act="line" data-id="sales"><b class="big">번 돈</b><span>손님이 늘거나 줄어요</span></button>' +
      '<button data-act="line" data-id="cost"><b class="big">쓴 돈</b><span>만드는 데 드는 돈이 달라져요</span></button></div>', true);
  }

  function showShop(id) {
    var p = P(), def = shopDef(id), c = p.world.shops[id], hd = p.hold[id], v = E.valueOf(p, id);
    openShopId = id;
    var h = '<h2>' + esc(def.name) + '</h2><div class="newsart">' + shopSvg(def, c, hd, v, true) + '</div>';
    if (c.closed > 0) {
      h += '<p class="newstext">문을 닫았어요. 조금 기다리면 새 가게가 와요.</p><button class="go" data-act="close">알겠어요</button>';
      return openSheet(h);
    }
    h += '<p class="desc">' + esc(def.desc) + '</p>';
    if (c.hist.length) h += '<p class="moodline">' + faceSvg(c.mood, 28) + ' 지난 계절: ' + D.TEXT.mood[c.mood] + '</p>';
    if (si() >= 1) {
      p.looked[id] = p.world.turn; save();
      h += '<p class="pxline">' + T('price') + ' <b>' + num(c.price) + '</b> ' + arrow(c) + '</p>' + spark(c);
      var l = c.hist[c.hist.length - 1];
      if (l) {
        var top = Math.max(l.sales, l.cost, 1);
        h += '<div class="report"><h3>지난 계절 성적표</h3>' +
          '<p><span>번 돈</span><i style="width:' + Math.round(l.sales / top * 60) + '%"></i><b>' + num(l.sales) + '</b></p>' +
          '<p><span>쓴 돈</span><i class="c" style="width:' + Math.round(l.cost / top * 60) + '%"></i><b>' + num(l.cost) + '</b></p>' +
          '<p class="sum"><span>남은 돈</span><b class="' + (l.profit < 0 ? 'neg' : '') + '">' + num(l.profit) + '</b><em>' + (l.profit < 0 ? '손해를 봤어요' : '이 중 ' + num(l.div) + ' 을 주인들에게 나눠 줬어요') + '</em></p></div>';
      }
    }
    if (si() >= 2 && c.hist.length) {
      var r = E.ratios(def, c, D);
      h += '<div class="ratios"><span>PER <b>' + (r.per === null ? '적자' : num(r.per) + '배') + '</b></span><span>ROE <b>' + pctText(r.roe) + '</b></span><span>부채비율 <b>' + pctText(r.debtRatio) + '</b></span><span>배당수익률 <b>' + pctText(r.yield) + '</b></span></div>' +
        '<button class="link" data-act="fs">재무제표 3표 보기</button>' + (si() >= 3 ? '<button class="link" data-act="quiz">분기보고서 읽고 문제 풀기</button>' : '');
    }
    h += hd
      ? '<p class="mybox">내가 넣은 동전 <b>' + hd.put + '</b>개 → 지금 <b>' + v + '</b>개' + (hd.ripe ? ' · 익은 열매 <b>' + hd.ripe + '</b>개' : '') + '</p>'
      : '<p class="mybox">아직 씨앗을 심지 않았어요.</p>';
    h += '<p class="have">내 동전 ' + coinSvg(18) + ' <b>' + p.coins + '</b></p><div class="acts">';
    h += '<button class="go" data-act="plant" data-n="1"' + (p.coins < 1 ? ' disabled' : '') + '>동전 1개 ' + T('plant') + '</button>';
    if (p.coins >= 5) h += '<button class="go alt" data-act="plant" data-n="5">5개 ' + T('plant') + '</button>';
    h += '</div>';
    if (si() >= 3) h += '<input id="why" class="why" maxlength="120" placeholder="왜 사나요 / 왜 파나요? (적으면 투자일지에 남아요)" aria-label="이유">';
    if (hd && si() >= 1 && v >= 2) h += '<button class="link" data-act="pull" data-half="1">절반만 ' + T('pull') + '</button>';
    if (hd) h += '<button class="link" data-act="pull">모두 ' + T('pull') + ' (' + (v + hd.ripe) + '개 돌려받기)</button>';
    h += '<button class="link" data-act="close">닫기</button>';
    openSheet(h);
  }

  function showResult(out, from) {
    var p = P(), h = '<h2>' + from.name + '이 지났어요</h2>';
    if (out.news) {
      var n = out.news, label = { good: '좋은 소식', bad: '나쁜 소식', unknown: n.card.kind === 'disc' ? '이것만으로는 알 수 없는 공시' : '아직 모르는 소문' }[n.answer];
      h += '<div class="answer ' + (n.right ? 'right' : 'wrong') + '">' + faceSvg(n.answer, 34) +
        '<div><b>' + label + '이었어요.</b> ' + (n.right ? '맞혔어요! ' + starSvg(18) : '다음엔 맞힐 수 있어요.') +
        '<br><small>' + esc(n.card.kind === 'rumor' ? (n.real ? '이번 소문은 진짜가 됐어요. 하지만 소문은 틀릴 때도 많아요.' : '이번 소문은 사실이 아니었어요.') : n.card.after || '') + '</small></div></div>';
    }
    if (out.news && out.news.line) h += '<p class="note">성적표에서 바뀐 줄은 <b>' + (out.news.line.answer === 'cost' ? '쓴 돈' : '번 돈') + '</b>. ' + (out.news.line.right ? '맞혔어요! ' + starSvg(16) : '다음엔 맞힐 수 있어요.') + '</p>';
    if (out.news && out.news.card.explain) h += '<p class="note explain">' + esc(out.news.card.explain) + '</p>';
    if (out.news && out.news.card.note) h += '<p class="note explain">' + esc(out.news.card.note) + '</p>';
    h += '<ul class="rows">';
    D.SHOPS.forEach(function (def) {
      var o = out.shops[def.id], mine = p.hold[def.id];
      if (out.closed.indexOf(def.id) >= 0) { h += '<li class="shut">' + faceSvg('bad', 26) + '<span>' + esc(def.name) + '</span><em>문을 닫았어요</em></li>'; return; }
      if (out.reopened.indexOf(def.id) >= 0) { h += '<li>' + faceSvg('ok', 26) + '<span>' + esc(def.name) + '</span><em>새로 문을 열었어요</em></li>'; return; }
      if (o.closed) return;
      h += '<li' + (mine ? ' class="mine"' : '') + '>' + faceSvg(o.mood, 26) + '<span>' + esc(def.name) + '</span><em>' + D.TEXT.mood[o.mood] + '</em>' +
        (o.got ? '<i>' + fruitSvg(18) + '+' + o.got + '</i>' : '') + '</li>';
    });
    h += '</ul>';
    if (out.closed.length) h += '<p class="note">' + D.TEXT.closed + '</p>';
    h += '<p class="note">심부름 동전 ' + coinSvg(16) + ' +' + D.RULES.allowance + '</p>';
    out.wishes.forEach(function (w) { h += '<p class="prize">마을에 <b>' + w.name + '</b>이(가) 생겼어요!</p>'; });
    out.badges.forEach(function (b) { h += '<p class="prize">' + starSvg(20) + ' <b>' + esc(b.name) + '</b> 배지 — ' + esc(b.text) + '</p>'; });
    h += '<button class="go" data-act="resultOk">확인</button>';
    openSheet(h, true);
    if (out.badges.length || out.wishes.length || (out.news && out.news.right)) chime();
    var line = out.closed.length ? D.TEXT.closed : out.badges.length ? out.badges[0].name + ' 배지를 받았어요. ' + out.badges[0].text : out.fruits ? '열매가 ' + out.fruits + '개 열렸어요.' : '';
    if (line) say(line);
  }

  function showNight() {
    var p = P(), ys = [];
    for (var i = 3; i < p.history.length; i += 4) ys.push(p.history[i]);
    ys = ys.slice(-6);
    var max = Math.max.apply(null, ys.concat([10])), first = Math.floor(p.history.length / 4) - ys.length + 1;
    var h = '<h2>' + (yearOf(p) - 1) + '년이 지났어요</h2><p class="newstext">' + D.TEXT.night + '</p>';
    if (ys.length) {
      h += '<p class="tag">해마다 마을 보물</p><div class="years">';
      ys.forEach(function (v, i) { h += '<div><b>' + v + '</b><i style="height:' + Math.max(6, Math.round(v / max * 90)) + 'px"></i><span>' + (first + i) + '년</span></div>'; });
      h += '</div>';
    }
    h += '<button class="go" data-act="close2">마을 구경하기</button><button class="link" data-act="who0">다른 사람이 하기</button>';
    openSheet(h, true);
  }

  /* ---------- 나무: 재무제표 3표 ---------- */
  function showStatements(id) {
    var p = P(), def = shopDef(id), c = p.world.shops[id], l = c.hist[c.hist.length - 1];
    if (!l) return;
    var as = l.assets === undefined ? c.assets : l.assets, eq = l.cash + as - l.debt;
    var fin = (l.borrow || 0) - (l.repay || 0) - l.div, old = l.vc === undefined;
    function row(k, v, cls) { return '<tr class="' + (cls || '') + '"><td>' + k + '</td><td>' + num(v) + '</td></tr>'; }
    var h = '<h2>' + esc(def.name) + ' 재무제표</h2><p class="desc">지난 계절(분기) 기준. 숫자는 가게가 실제로 굴린 장부입니다.</p>';
    h += '<h3>손익계산서 — 얼마 벌고 얼마 남겼나</h3><table class="fs">' + row('매출', l.sales) + row('매출원가 (팔 때마다 드는 돈)', old ? undefined : -l.vc) + row('판매관리비 (가만히 있어도 나가는 돈)', old ? undefined : -l.fx) + row('이자비용', old ? undefined : -l.it) + row('순이익', l.profit, 'sum') + '</table>';
    h += '<h3>재무상태표 — 지금 가진 것과 갚을 것</h3><table class="fs">' + row('현금', l.cash) + row('설비자산 (가게·기계)', as) + row('자산총계', l.cash + as, 'sum') + row('부채 (빚)', l.debt) + row('자본 (주인 몫)', eq) + row('부채와 자본 총계', l.debt + eq, 'sum') + '</table>';
    h += '<h3>현금흐름표 — 현금이 어디서 와서 어디로 갔나</h3><table class="fs">' + row('영업활동 (장사로 번 현금)', l.profit) + row('투자활동 (가게를 키우는 데 쓴 현금)', old ? undefined : -l.inv) + row('재무활동 (빌린 돈 − 갚은 돈 − 배당)', old ? undefined : fin) + row('현금 증감', old ? undefined : l.profit - l.inv + fin, 'sum') + '</table>';
    h += '<p class="desc">읽는 순서: ① 순이익이 흑자인가 ② 부채가 자본보다 큰가 ③ 영업활동 현금이 플러스인가. 주식 수 ' + num(l.shares || c.shares) + '주.</p>';
    h += '<button class="go" data-act="shop" data-id="' + id + '">돌아가기</button>';
    openSheet(h);
  }

  /* ---------- 숲: 공시 원문 읽기 ---------- */
  var quiz = null;
  function showQuiz(id) {
    var p = P();
    p.quizDone = p.quizDone || {};
    quiz = E.makeQuiz(p, D, id);
    if (!quiz) return;
    quiz.done = p.quizDone[id] === p.world.turn; quiz.picked = {};
    var l = quiz.row, as = l.assets === undefined ? p.world.shops[id].assets : l.assets;
    function tbl(rows) { return '<table>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + num(r[1]) + '</td></tr>'; }).join('') + '</table>'; }
    var h = '<h2>공시 읽기</h2><div class="doc"><p class="dochead">분 기 보 고 서 (요약)</p><p>회사명: ' + esc(quiz.name) + ' · 업종: ' + esc(quiz.kind) + '<br>보고 기간: ' + (Math.floor(l.t / 4) + 1) + '년째 ' + D.SEASONS[l.t % 4].name + ' (단위: 동전)</p>' +
      '<p class="docsec">Ⅰ. 요약 손익</p>' + tbl([['매출액', l.sales], ['매출원가', l.vc], ['판매비와관리비', l.fx], ['이자비용', l.it], ['분기순이익', l.profit]]) +
      '<p class="docsec">Ⅱ. 요약 재무상태</p>' + tbl([['현금및현금성자산', l.cash], ['유형자산', as], ['부채총계', l.debt], ['자본총계', quiz.equity]]) +
      '<p class="docsec">Ⅲ. 배당에 관한 사항</p>' + tbl([['현금배당금총액', l.div], ['발행주식총수', l.shares]]) +
      '<p class="docfoot">※ 실제 전자공시(DART) 분기보고서의 짜임을 본떠 가게 장부에서 만든 연습용 문서입니다.</p></div>';
    if (quiz.done) h += '<p class="note">이 가게의 이번 계절 문제는 이미 풀었어요. 다음 계절에 새 보고서가 나옵니다.</p>';
    quiz.questions.forEach(function (q, i) {
      h += '<div class="q" id="q' + i + '"><p><b>문제 ' + (i + 1) + '.</b> ' + esc(q.q) + '</p>' + q.options.map(function (o, j) { return '<button data-act="ans" data-q="' + i + '" data-o="' + j + '">' + esc(o) + '</button>'; }).join('') + '<p class="why2" hidden></p></div>';
    });
    h += '<button class="go" data-act="shop" data-id="' + id + '">돌아가기</button>';
    openSheet(h);
  }
  function answerQuiz(b) {
    var p = P(), i = Number(b.dataset.q), o = Number(b.dataset.o), q = quiz.questions[i], box = $('q' + i);
    if (quiz.picked[i] !== undefined) return;
    quiz.picked[i] = o;
    var right = o === q.answer;
    box.querySelectorAll('button').forEach(function (x, j) { x.disabled = true; if (j === q.answer) x.classList.add('ok'); else if (j === o) x.classList.add('no'); });
    var w = box.querySelector('.why2'); w.hidden = false; w.textContent = (right ? '맞았습니다. ' : '아쉽습니다. ') + q.why;
    if (!quiz.done) {
      E.scoreQuiz(p, right);
      if (Object.keys(quiz.picked).length === quiz.questions.length) { p.quizDone[quiz.id] = p.world.turn; E.checkBadges(p, D, null); }
      save();
    }
    if (right) beep(700, 0.1); else beep(240, 0.15);
  }

  /* ---------- 숲: 투자일지와 복기 ---------- */
  function showJournal() {
    var p = P(), h = '<h2>투자일지 · 복기</h2><p class="desc">살 때·팔 때 적은 이유입니다. 4계절이 지나면 그 판단이 지금까지 맞았는지 표시됩니다. 값이 올랐는지보다 <b>적어 둔 이유가 맞았는지</b>를 봅니다.</p>';
    if (!p.journal.length) h += '<p class="note">아직 적은 일지가 없습니다. 가게 창에서 이유를 적고 사거나 팔아 보세요.</p>';
    p.journal.slice().reverse().forEach(function (j) {
      var c = p.world.shops[j.id], def = shopDef(j.id), now = c.price, ch = (now - j.price) / j.price, age = p.world.turn - j.t;
      var good = j.act === 'buy' ? ch > 0 : ch < 0;
      h += '<div class="jr"><p><b>' + (Math.floor(j.t / 4) + 1) + '년째 ' + D.SEASONS[j.t % 4].name + '</b> · ' + esc(def.name) + ' ' + (j.act === 'buy' ? '매수' : '매도') + ' ' + j.n + '개</p>' +
        '<p class="jwhy">"' + esc(j.why) + '"</p>' +
        '<p class="jres">그때 주가 ' + num(j.price) + ' → 지금 ' + num(now) + ' (' + (ch >= 0 ? '+' : '') + Math.round(ch * 100) + '%) · ' +
        (c.closed > 0 ? '가게가 문을 닫음' : age < 4 ? '복기까지 ' + (4 - age) + '계절 남음' : '<b class="' + (good ? 'ok' : 'no') + '">' + (good ? '지금까지는 맞은 판단' : '지금까지는 빗나간 판단') + '</b>') + '</p></div>';
    });
    h += '<button class="go" data-act="close2">닫기</button>';
    openSheet(h);
  }

  /* ---------- 어른 메뉴 ---------- */
  var gate = null;
  function showGate() {
    var a = 3 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 5);
    gate = a * b;
    openSheet('<h2>어른 메뉴</h2><p class="desc">어른만 들어올 수 있어요. ' + a + ' × ' + b + ' = ?</p>' +
      '<form id="gateF" class="newwho"><input id="gateIn" inputmode="numeric" aria-label="답"><button>들어가기</button></form><button class="link" data-act="close">닫기</button>');
    $('gateF').addEventListener('submit', function (e) { e.preventDefault(); if (Number($('gateIn').value) === gate) showParent(); else $('gateIn').value = ''; });
  }
  function showParent() {
    var p = P(), t = today(), h = '<h2>어른 메뉴 — ' + esc(p.name) + '</h2>';
    // 관찰 기록
    var days = p.log.slice(-14), week = p.log.filter(function (l) { return (new Date(t) - new Date(l.d)) / 864e5 < 7 && l.turns > 0; });
    var selfN = week.filter(function (l) { return l.self; }).length;
    h += '<section><h3>관찰 기록</h3><p class="desc">최근 7일: <b>' + week.length + '일</b> 플레이, 그중 스스로 연 날 <b>' + selfN + '일</b>. 날짜를 눌러 "스스로 열었는지" 표시하세요. (기준: 2주 동안 주 2회 이상 스스로 열면 다음 단계로)</p><div class="days">';
    days.forEach(function (l) { h += '<button data-act="self" data-id="' + l.d + '" class="' + (l.self ? 'on' : '') + '">' + l.d.slice(5) + '<small>' + l.turns + '계절' + (l.self ? ' · 스스로' : '') + '</small></button>'; });
    h += '</div></section>';
    // 대화 질문
    var got = D.BADGES.filter(function (b) { return p.badges[b.id] !== undefined && b.talk; }).sort(function (a, b) { return p.badges[b.id] - p.badges[a.id]; });
    h += '<section><h3>아이와 나눌 한마디</h3>' + (got.length ? '<p class="talk">"' + esc(got[0].talk) + '"</p><p class="desc">방금 받은 배지 「' + esc(got[0].name) + '」에서 나온 질문입니다.</p>' : '<p class="desc">배지를 받으면 여기에 질문이 뜹니다.</p>') + '</section>';
    // 배지
    h += '<section><h3>배지 ' + Object.keys(p.badges).length + ' / ' + D.BADGES.length + '</h3><ul class="badges">';
    D.BADGES.forEach(function (b) {
      var m = b.mentor ? D.MENTORS.filter(function (x) { return x.id === b.mentor; })[0] : null;
      h += '<li class="' + (p.badges[b.id] !== undefined ? 'on' : '') + '"><b>' + esc(b.name) + '</b> ' + esc(b.text) + (m ? '<small>' + esc(m.name) + '의 원칙: ' + esc(m.rule) + ' (' + esc(m.source) + ')</small>' : '') + '</li>';
    });
    h += '</ul><p class="desc">소식 ' + p.stats.seen + '번 중 ' + (p.stats.news + p.stats.rumor) + '번 맞힘 · 딴 열매 ' + p.stats.harvest + '개</p></section>';
    // 장부
    h += '<section><h3>장부 엿보기</h3><p class="desc">아이 화면에는 그림만 보이지만 가게마다 진짜 장부가 돌아갑니다. 새싹 단계부터 이 숫자가 조금씩 열립니다. (최근 계절 기준)</p><div class="ledger"><table><tr><th>가게</th><th>판 돈</th><th>쓴 돈</th><th>남은 돈</th><th>나눠 준 돈</th><th>가진 돈</th><th>빚</th><th>씨앗 값</th></tr>';
    D.SHOPS.forEach(function (def) {
      var c = p.world.shops[def.id], l = c.hist[c.hist.length - 1];
      h += '<tr><td>' + esc(def.kind) + '</td>' + (c.closed > 0 ? '<td colspan="7">문 닫음</td>' : l ? '<td>' + l.sales + '</td><td>' + l.cost + '</td><td>' + l.profit + '</td><td>' + l.div + '</td><td>' + l.cash + '</td><td>' + l.debt + '</td><td>' + l.price + '</td>' : '<td colspan="7">아직 기록 없음</td>') + '</tr>';
    });
    h += '</table></div></section>';
    // 단계
    h += '<section><h3>단계 고르기</h3><p class="desc">같은 마을을 보되 단계가 오를수록 더 많은 숫자가 열립니다. 바꿔도 마을과 기록은 그대로입니다.</p><div class="stagepick">';
    D.STAGES.forEach(function (s) { h += '<button data-act="stage" data-id="' + s.id + '" class="' + (p.stage === s.id ? 'on' : '') + '"' + (s.open ? '' : ' disabled') + '><b>' + s.name + '</b> ' + s.age + '<small>' + s.shows + '</small></button>'; });
    h += '</div></section>';
    // 설정
    h += '<section><h3>설정</h3><div class="sets">' +
      '<button data-act="opt" data-id="voice">읽어 주기 ' + (S.opt.voice ? '켜짐' : '꺼짐') + '</button>' +
      '<button data-act="opt" data-id="sound">소리 ' + (S.opt.sound ? '켜짐' : '꺼짐') + '</button>' +
      '<button data-act="more">오늘 한 해 더 열기</button>' +
      '<button data-act="who0">다른 사람으로 바꾸기</button>' +
      '<button data-act="backup">백업 글 만들기</button>' +
      '<button data-act="restore">백업 글로 되돌리기</button>' +
      '<button data-act="reset" class="danger">' + esc(p.name) + ' 처음부터</button></div>' +
      '<textarea id="bk" class="bk" hidden aria-label="백업 글"></textarea></section>';
    h += '<button class="go" data-act="close2">닫기</button>';
    openSheet(h);
  }

  /* ---------- 누르기 ---------- */
  function bump() { var el = $('purse'); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) { if (e.target === sheet) closeSheet(); return; }
    var act = b.dataset.act, id = b.dataset.id, p = P();
    if (act === 'who') return pick(id);
    if (act === 'who0') { S.cur = null; save(); return render(); }
    if (act === 'read') return say(b.dataset.text);
    if (act === 'introOk') { p.introDone = 1; save(); return render(); }
    if (act === 'close') return closeSheet(true);
    if (act === 'close2') { closeSheet(true); return; }
    if (act === 'night') return showNight();
    if (act === 'parent') return showGate();
    if (!p) return;

    if (act === 'guess') {
      E.guess(p, id); save(); beep(520, 0.1);
      if (si() >= 1 && E.lineOf(E.newsCard(p, D))) return showLine();
      closeSheet(true);
      return;
    }
    if (act === 'line') { E.guessLine(p, id); save(); beep(520, 0.1); return closeSheet(true); }
    if (act === 'shop') return showShop(id);
    if (act === 'fs') return showStatements(openShopId);
    if (act === 'quiz') return showQuiz(openShopId);
    if (act === 'ans') return answerQuiz(b);
    if (act === 'journal') return showJournal();
    if (act === 'stage') { p.stage = id; save(); render(); return showParent(); }
    if (act === 'pick') {
      var n = E.harvest(p, id);
      if (n) { save(); chime(); render(); bump(); }
      return;
    }
    if (act === 'plant') {
      if (E.invest(p, D, openShopId, Number(b.dataset.n), $('why') ? $('why').value : '')) {
        var got = E.checkBadges(p, D, null);
        save(); beep(440, 0.1); var keep = openShopId; render(); showShop(keep);
        if (got.length) { chime(); say(got[0].name + ' 배지를 받았어요. ' + got[0].text); }
      }
      return;
    }
    if (act === 'pull') {
      if (b.dataset.sure) { E.withdraw(p, openShopId, !!b.dataset.half, $('why') ? $('why').value : ''); save(); beep(330, 0.15); render(); bump(); }
      else { b.dataset.sure = '1'; b.textContent = b.dataset.half ? '절반을 꺼낼까요? 한 번 더 누르면 꺼내요.' : '정말 꺼낼까요? 나무가 없어져요. 한 번 더 누르면 꺼내요.'; b.classList.add('danger'); }
      return;
    }
    if (act === 'next') {
      if (!E.canPlay(p, D)) return showNight();
      if (p.news && p.news.guess === null) return showNews();
      var from = seasonOf(p), day = E.touchDay(p, today());
      lastReport = E.nextTurn(p, D); day.turns++; save();
      render(); showResult(lastReport, from);
      return;
    }
    if (act === 'resultOk') { closeSheet(true); return render(); }

    // 어른 메뉴
    if (act === 'self') { p.log.forEach(function (l) { if (l.d === id) l.self = !l.self; }); save(); return showParent(); }
    if (act === 'opt') { S.opt[id] = !S.opt[id]; save(); return showParent(); }
    if (act === 'more') { p.turnsToday = 0; save(); return render(); }
    if (act === 'backup') { var t = $('bk'); t.hidden = false; t.value = JSON.stringify(S); t.focus(); t.select(); return; }
    if (act === 'restore') {
      var ta = $('bk');
      if (ta.hidden || !ta.value.trim()) { ta.hidden = false; ta.value = ''; ta.placeholder = '백업 글을 여기에 붙여 넣고 다시 누르세요'; return; }
      try { var s = JSON.parse(ta.value); if (!s.players) throw 0; S = s; save(); render(); } catch (err) { ta.value = ''; ta.placeholder = '백업 글이 아닙니다. 다시 붙여 넣어 주세요'; }
      return;
    }
    if (act === 'reset') {
      if (b.dataset.sure) { delete S.players[S.cur]; S.cur = null; save(); render(); }
      else { b.dataset.sure = '1'; b.textContent = '정말 지울까요? 한 번 더 누르면 지워집니다'; }
      return;
    }
  });

  window.__st = { get S() { return S; }, P: P, D: D, E: E, render: render };
  render();
})();
