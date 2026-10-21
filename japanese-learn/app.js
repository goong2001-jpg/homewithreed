/* 일본어 한 걸음 — 레벨테스트 → 커리큘럼(초급·중급·상급) → 하루 한 단원 + 간격 복습.
 * 기록은 이 기기 localStorage 에만 저장한다(서버 없음). */
(function () {
  'use strict';

  // 배포할 때마다 index.html 의 ?v=, sw.js, version.json 과 같이 올린다
  var APP_VERSION = '1';
  var STORE_KEY = 'hwr-jp-v1';
  var PASS_RATE = 0.7;                 // 첫 시도 정답률이 이 이상이면 단원 완료
  var REVIEW_MAX = 20;                 // 복습 한 번에 최대 단어 수
  var INTERVAL = [0, 1, 3, 7, 14, 30]; // 복습 상자(1~5)별 다음 복습까지 날짜
  var KANA_QUIZ = 10;

  var D = window.JP_DATA;
  var UNITS = [];
  D.LEVELS.forEach(function (L) {
    L.units.forEach(function (u, i) { u.level = L; u.no = i + 1; u.gi = UNITS.length; UNITS.push(u); });
  });
  var UNIT_BY_ID = {};
  UNITS.forEach(function (u) { UNIT_BY_ID[u.id] = u; });

  // ---------- 저장 ----------
  function fresh() {
    return { start: null, done: {}, srs: {}, wrong: {}, log: {}, test: null, showKana: true, slow: false };
  }
  var state = fresh();
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) { var parsed = JSON.parse(raw); for (var k in parsed) state[k] = parsed[k]; }
  } catch (e) {}
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

  // ---------- 날짜 ----------
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function today() { return ymd(new Date()); }
  function addDays(s, n) {
    var p = s.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return ymd(d);
  }
  function md(s) { var p = s.split('-'); return (+p[1]) + '/' + (+p[2]); }
  function markStudy(kind) {
    var t = today();
    var e = state.log[t] || (state.log[t] = { u: 0, r: 0 });
    e[kind] = (e[kind] || 0) + 1;
  }
  function streak() {
    var d = today();
    if (!state.log[d]) d = addDays(d, -1);
    var n = 0;
    while (state.log[d]) { n++; d = addDays(d, -1); }
    return n;
  }

  // ---------- 진도 ----------
  function passed(u) { return !!(state.done[u.id] && state.done[u.id].pass); }
  function currentUnit() {
    if (state.start == null) return null;
    // 시작점보다 앞 단원은 건너뛴 것으로 보고, 커리큘럼 탭에서 골라서만 한다
    for (var i = state.start; i < UNITS.length; i++) if (!passed(UNITS[i])) return UNITS[i];
    return null;
  }
  function currentLevel() {
    var u = currentUnit();
    if (u) return u.level;
    return state.start == null ? null : D.LEVELS[D.LEVELS.length - 1];
  }
  // 건너뛴 단원(레벨테스트로 시작점보다 앞)도 진도에서는 지나간 것으로 센다
  function levelProgress(L) {
    var n = 0;
    L.units.forEach(function (u) { if (passed(u) || (state.start != null && u.gi < state.start)) n++; });
    return n;
  }
  function wordKey(u, w) { return u.id + '|' + w.jp; }
  function wordByKey(key) {
    var p = key.split('|');
    var u = UNIT_BY_ID[p[0]];
    if (!u) return null;
    for (var i = 0; i < u.words.length; i++) if (u.words[i].jp === p[1]) return { unit: u, word: u.words[i] };
    return null;
  }
  function dueKeys() {
    var t = today();
    return Object.keys(state.srs).filter(function (k) { return state.srs[k].due <= t && wordByKey(k); })
      .sort(function (a, b) { return state.srs[a].due < state.srs[b].due ? -1 : 1; });
  }
  function nextDue() {
    var t = today(), best = null, n = 0;
    Object.keys(state.srs).forEach(function (k) {
      var d = state.srs[k].due;
      if (d <= t) return;
      if (!best || d < best) { best = d; n = 1; } else if (d === best) n++;
    });
    return best ? { day: best, n: n } : null;
  }

  // ---------- 음성 ----------
  var jaVoice = null;
  function loadVoices() {
    if (!window.speechSynthesis) return;
    var vs = speechSynthesis.getVoices() || [];
    jaVoice = null;
    for (var i = 0; i < vs.length; i++) if (/^ja/i.test(vs[i].lang)) { jaVoice = vs[i]; break; }
  }
  if (window.speechSynthesis) {
    loadVoices();
    try { speechSynthesis.addEventListener('voiceschanged', function () { loadVoices(); if (S && S.voiceWait) render(); }); } catch (e) {}
  }
  function hasVoice() { return !!jaVoice; }
  function speak(text, slow) {
    if (!window.speechSynthesis || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      if (jaVoice) u.voice = jaVoice;
      u.rate = slow ? 0.6 : (state.slow ? 0.8 : 1);
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ---------- 유틸 ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  // 같은 단원에서 오답 보기를 뽑는다. 값이 겹치는 단어는 빼서 정답이 둘이 되지 않게 한다.
  function distractors(pool, value, field, n) {
    var seen = {}; seen[value] = 1;
    var out = [];
    shuffle(pool).forEach(function (w) {
      if (out.length < n && !seen[w[field]]) { seen[w[field]] = 1; out.push(w[field]); }
    });
    return out;
  }
  function blankHtml(q) {
    return esc(q).replace('＿＿', '<span class="blank">　　</span>');
  }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- 문제 만들기 ----------
  var qid = 0;
  function wordQ(u, w, type) {
    var pool = u.words;
    var q = { id: ++qid, key: wordKey(u, w), speak: w.kana, word: w };
    if (type === 'reading' && w.jp === w.kana) type = 'meaning';
    if (type === 'listen' && !hasVoice()) type = 'reverse';
    if (type === 'meaning') {
      q.label = '뜻 고르기'; q.prompt = w.jp; q.pClass = 'jp';
      q.sub = state.showKana && w.jp !== w.kana ? w.kana : '';
      q.answer = w.ko; q.options = shuffle([w.ko].concat(distractors(pool, w.ko, 'ko', 3))); q.oClass = 'ko';
    } else if (type === 'reverse') {
      q.label = '일본어 고르기'; q.prompt = w.ko; q.pClass = 'ko';
      q.answer = w.jp; q.options = shuffle([w.jp].concat(distractors(pool, w.jp, 'jp', 3))); q.oClass = 'jp';
    } else if (type === 'reading') {
      q.label = '읽기 고르기'; q.prompt = w.jp; q.pClass = 'jp';
      q.answer = w.kana; q.options = shuffle([w.kana].concat(distractors(pool, w.kana, 'kana', 3))); q.oClass = 'jp';
    } else if (type === 'listen') {
      q.label = '듣고 뜻 고르기'; q.listen = true;
      q.answer = w.ko; q.options = shuffle([w.ko].concat(distractors(pool, w.ko, 'ko', 3))); q.oClass = 'ko';
    } else if (type === 'kana') {
      q.label = '읽기 고르기'; q.prompt = w.jp; q.pClass = 'jp kana';
      q.answer = w.ko; q.options = shuffle([w.ko].concat(distractors(pool, w.ko, 'ko', 3))); q.oClass = 'ko';
    }
    return q;
  }
  function grammarQ(g) {
    return {
      id: ++qid, label: '문형 빈칸', blank: g.q, sub: g.hint, pClass: 'jp sentence',
      answer: g.a, options: shuffle(g.o), oClass: 'jp', speak: null
    };
  }
  function unitQuiz(u) {
    if (u.type === 'kana') {
      return shuffle(u.words).slice(0, KANA_QUIZ).map(function (w) { return wordQ(u, w, 'kana'); });
    }
    var types = ['meaning', 'reverse', 'reading', 'listen'];
    var qs = shuffle(u.words).map(function (w, i) { return wordQ(u, w, types[i % types.length]); });
    var gs = u.grammar.quiz.map(grammarQ);
    qs.splice(4, 0, gs[0]);
    qs.push(gs[1]);
    return qs;
  }
  function copyQ(q) {
    var c = {}; for (var k in q) c[k] = q[k]; // id 는 그대로 두어 첫 시도 정답만 센다
    c.options = shuffle(q.options);
    return c;
  }

  // ---------- 세션(전체 화면) ----------
  var S = null;
  var tab = 'home';

  function openSession(s) {
    S = s;
    document.getElementById('session').hidden = false;
    document.body.classList.add('locked');
    render();
  }
  function closeSession() {
    S = null;
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
    document.getElementById('session').hidden = true;
    document.body.classList.remove('locked');
    render();
  }

  function startQuiz(s, qs) {
    s.step = 'quiz'; s.queue = qs; s.total = qs.length; s.missed = {}; s.firstOk = 0; s.picked = null; s.missWords = {};
    return s;
  }

  // ---------- 레벨테스트 ----------
  function startTest() {
    openSession({
      type: 'test', stage: -1, qi: 0, scores: [], kanaOk: true, picks: [],
      stages: D.PLACEMENT.map(function (st) {
        return st.map(function (q) {
          var ans = q.o[q.a];
          return { q: q.q, hint: q.hint, kana: q.kana, answer: ans, options: shuffle(q.o) };
        });
      })
    });
  }
  function placeFromScores(sc, kanaOk) {
    var P = D.PASS_STAGE;
    if (sc[0] < P) return { unit: kanaOk ? 'b3' : 'b1', why: kanaOk ? '가나는 읽을 수 있어서 자기소개부터 시작합니다.' : '가나부터 차근차근 시작합니다.' };
    if (sc[1] <= 1) return { unit: 'b6', why: '기초 문장은 탄탄합니다. 동사 활용부터 이어 갑니다.' };
    if (sc[1] < P) return { unit: 'm1', why: '초급은 충분합니다. 중급 첫 단원부터 시작합니다.' };
    if (sc[2] < 3) return { unit: 'm4', why: '중급 전반은 익숙합니다. 사역·경어부터 다집니다.' };
    return { unit: 'a1', why: '상급 문형도 상당히 알고 있습니다. 상급 첫 단원부터 시작합니다.' };
  }
  function testPick(i) {
    var st = S.stages[S.stage];
    var q = st[S.qi];
    var ok = i >= 0 && q.options[i] === q.answer;
    S.picks.push(ok);
    if (!ok && q.kana) S.kanaOk = false;
    S.qi++;
    if (S.qi < st.length) return render();
    var score = S.picks.filter(Boolean).length;
    S.scores.push(score);
    S.picks = []; S.qi = 0;
    var last = S.stage === S.stages.length - 1;
    if (!last && score >= D.PASS_STAGE) { S.stage++; S.stageIntro = true; return render(); }
    S.result = placeFromScores(S.scores.concat([0, 0, 0]).slice(0, 3), S.kanaOk);
    S.result.stagesTaken = S.scores.length;
    S.stage = 'done';
    render();
  }
  // 결과가 부담스러우면 한 단계 아래에서 시작할 수 있다
  var STEP_DOWN = { b3: 'b1', b6: 'b3', m1: 'b6', m4: 'm1', a1: 'm4' };
  function acceptPlacement(unitId) {
    var u = UNIT_BY_ID[unitId];
    state.start = u.gi;
    state.test = { at: today(), scores: S.scores.slice(), unit: unitId };
    save();
    closeSession();
    tab = 'home';
    render();
    toast(u.level.name + ' ' + u.no + '과 「' + u.title + '」부터 시작합니다');
  }

  // ---------- 단원 학습 ----------
  function startLesson(id) {
    var u = UNIT_BY_ID[id];
    if (state.start == null) { state.start = u.gi; save(); }
    openSession({ type: 'lesson', unit: u, step: 'words', i: 0, hide: !state.showKana });
    if (u.type !== 'kana') speak(u.words[0].kana);
  }
  function toQuiz() {
    startQuiz(S, unitQuiz(S.unit));
    render();
    autoListen();
  }
  function autoListen() {
    if (S && S.queue && S.queue[0] && S.queue[0].listen) setTimeout(function () { if (S && S.queue[0]) speak(S.queue[0].speak); }, 250);
  }
  function quizPick(i) {
    if (S.picked != null) return;
    var q = S.queue[0];
    S.picked = i;
    var ok = q.options[i] === q.answer;
    S.lastOk = ok;
    if (ok) {
      if (!S.missed[q.id]) S.firstOk++;
      if (q.speak && !q.listen) speak(q.speak);
    } else {
      if (!S.missed[q.id]) {
        S.missed[q.id] = true;
        if (q.key) S.missWords[q.key] = true;
      }
      if (q.speak) speak(q.speak);
    }
    if (S.type === 'review' || S.type === 'wrong') reviewMark(q, ok);
    render();
    if (ok) {
      var cur = S;
      setTimeout(function () { if (S === cur && S.picked != null) quizNext(); }, 650);
    }
  }
  function quizNext() {
    var q = S.queue.shift();
    if (S.picked != null && !S.lastOk) {
      // 틀린 문제는 보기 순서를 바꿔 두 문제 뒤에 다시 낸다
      var at = Math.min(2, S.queue.length);
      S.queue.splice(at, 0, copyQ(q));
    }
    S.picked = null;
    if (!S.queue.length) return finishQuiz();
    render();
    autoListen();
  }
  function finishQuiz() {
    var rate = S.firstOk / S.total;
    S.step = 'result';
    S.rate = rate;
    Object.keys(S.missWords).forEach(function (k) { state.wrong[k] = (state.wrong[k] || 0) + 1; });
    if (S.type === 'lesson') {
      var u = S.unit;
      var before = currentLevel();
      var prev = state.done[u.id] || {};
      var pct = Math.round(rate * 100);
      var pass = rate >= PASS_RATE;
      state.done[u.id] = { pass: pass || !!prev.pass, best: Math.max(pct, prev.best || 0), at: today() };
      if (pass) {
        var due = addDays(today(), 1);
        u.words.forEach(function (w) {
          var k = wordKey(u, w);
          if (!state.srs[k]) state.srs[k] = { box: 1, due: due };
        });
      }
      S.pass = pass;
      var after = currentLevel();
      S.promoted = pass && before && after && before.id !== after.id ? after : null;
    }
    markStudy(S.type === 'lesson' ? 'u' : 'r');
    save();
    render();
  }

  // ---------- 복습 ----------
  function startReview() {
    var keys = dueKeys().slice(0, REVIEW_MAX);
    if (!keys.length) return toast('오늘 복습할 단어가 없습니다');
    openSession(startQuiz({ type: 'review', seen: {} }, keys.map(function (k, i) {
      var r = wordByKey(k);
      var t = r.unit.type === 'kana' ? 'kana' : (i % 3 === 2 && hasVoice() ? 'listen' : (i % 2 ? 'reverse' : 'meaning'));
      return wordQ(r.unit, r.word, t);
    })));
    autoListen();
  }
  function startWrong() {
    var keys = Object.keys(state.wrong).filter(wordByKey);
    if (!keys.length) return toast('오답 노트가 비어 있습니다');
    openSession(startQuiz({ type: 'wrong', seen: {} }, shuffle(keys).slice(0, REVIEW_MAX).map(function (k, i) {
      var r = wordByKey(k);
      return wordQ(r.unit, r.word, r.unit.type === 'kana' ? 'kana' : (i % 2 ? 'reverse' : 'meaning'));
    })));
  }
  // 단어마다 첫 답만 복습 상자에 반영한다
  function reviewMark(q, ok) {
    if (!q.key || S.seen[q.key]) return;
    S.seen[q.key] = true;
    var s = state.srs[q.key] || { box: 1, due: today() };
    if (ok) {
      s.box = Math.min(5, s.box + 1);
      s.due = addDays(today(), INTERVAL[s.box]);
      if (state.wrong[q.key]) { state.wrong[q.key]--; if (state.wrong[q.key] <= 0) delete state.wrong[q.key]; }
    } else {
      s.box = 1;
      s.due = addDays(today(), 1);
    }
    state.srs[q.key] = s;
    save();
  }

  // ---------- 화면: 탭 ----------
  function lvBadge(L) { return '<span class="lv lv-' + L.color + '">' + esc(L.name) + '</span>'; }

  function homeView() {
    var u = currentUnit();
    if (state.start == null) {
      return '' +
        '<section class="welcome">' +
          '<div class="hello" lang="ja">はじめまして。</div>' +
          '<p>18문항 레벨테스트로 지금 실력에 맞는 단원부터 시작합니다. 모르는 문제는 <b>모르겠어요</b>를 누르면 됩니다.</p>' +
          '<button class="btn primary" data-act="startTest">레벨테스트 시작 <small>약 5분</small></button>' +
          '<button class="btn ghost" data-act="startLesson" data-id="b1">테스트 없이 히라가나부터</button>' +
        '</section>' +
        '<h3 class="sec">커리큘럼</h3>' +
        '<ul class="lvList">' + D.LEVELS.map(function (L) {
          return '<li>' + lvBadge(L) + '<div><b>' + esc(L.jlpt) + ' · ' + L.units.length + '단원</b><p>' + esc(L.desc) + '</p></div></li>';
        }).join('') + '</ul>';
    }
    var t = today();
    var studied = state.log[t] && state.log[t].u > 0;
    var due = dueKeys().length;
    var L = currentLevel();
    var html = '';
    var prog = levelProgress(L);
    html += '<div class="lvLine">' + lvBadge(L) + '<span>' + esc(L.jlpt) + '</span><span class="dim">' + prog + ' / ' + L.units.length + ' 단원</span></div>' +
      '<div class="bar"><i class="lv-' + L.color + '" style="width:' + Math.round(prog / L.units.length * 100) + '%"></i></div>';

    if (!u) {
      html += '<section class="today allDone"><div class="seal" lang="ja">修了</div><h2>전 과정을 마쳤습니다</h2>' +
        '<p class="goal">이제는 복습으로 기억을 유지하세요. 커리큘럼에서 어느 단원이든 다시 할 수 있습니다.</p></section>';
    } else {
      var rec = state.done[u.id];
      var steps = u.type === 'kana' ? ['46자 보기', '퀴즈 ' + KANA_QUIZ] : ['단어 ' + u.words.length, '문형 1', '퀴즈 ' + (u.words.length + 2)];
      html += '<section class="today' + (studied ? ' studied' : '') + '">' +
        (studied ? '<div class="seal" lang="ja">済</div>' : '') +
        '<div class="todayLabel">' + (studied ? '오늘 학습 완료 · 다음 단원' : '오늘의 단원') + '</div>' +
        '<div class="ka" lang="ja">第' + u.no + '課</div>' +
        '<h2>' + esc(u.title) + '</h2>' +
        '<p class="goal">' + esc(u.goal) + '</p>' +
        '<ol class="steps">' + steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
        (rec && !rec.pass ? '<p class="retry">지난번 ' + rec.best + '점 · 70점 이상이면 완료</p>' : '') +
        '<button class="btn ' + (studied ? 'ghost' : 'primary') + '" data-act="startLesson" data-id="' + u.id + '">' +
          (studied ? '한 단원 더 하기' : '시작하기') + ' <small>약 ' + (u.type === 'kana' ? 6 : 8) + '분</small></button>' +
      '</section>';
    }

    if (due) {
      html += '<button class="strip" data-act="startReview"><span>복습할 단어</span><b>' + due + '</b><span class="go">시작</span></button>';
    } else {
      var nd = nextDue();
      html += '<div class="strip calm"><span>' + (nd ? '오늘 복습 끝 · 다음 복습 ' + md(nd.day) + ' (' + nd.n + '개)' : '단원을 마치면 다음 날부터 복습 단어가 쌓입니다') + '</span></div>';
    }

    html += weekRow();
    return html;
  }

  function weekRow() {
    var names = ['일', '월', '화', '수', '목', '금', '토'];
    var t = today();
    var cells = '';
    for (var i = 6; i >= 0; i--) {
      var d = addDays(t, -i);
      var p = d.split('-');
      var wd = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
      cells += '<li class="' + (state.log[d] ? 'on' : '') + (i === 0 ? ' now' : '') + '"><i></i><span>' + names[wd] + '</span></li>';
    }
    return '<h3 class="sec">이번 주</h3><ul class="week">' + cells + '</ul>';
  }

  function courseView() {
    var cur = currentUnit();
    var html = '';
    D.LEVELS.forEach(function (L) {
      html += '<section class="lvSec">' +
        '<div class="lvHead">' + lvBadge(L) + '<b>' + esc(L.jlpt) + '</b><span class="dim">' + levelProgress(L) + ' / ' + L.units.length + '</span></div>' +
        '<p class="lvDesc">' + esc(L.desc) + '</p><ol class="line lv-' + L.color + '">';
      L.units.forEach(function (u) {
        var rec = state.done[u.id];
        var skipped = state.start != null && u.gi < state.start && !passed(u);
        var cls = passed(u) ? 'done' : (cur && cur.id === u.id ? 'now' : (skipped ? 'skip' : ''));
        var st = passed(u) ? rec.best + '점' : (cur && cur.id === u.id ? '지금' : (skipped ? '건너뜀' : (rec ? rec.best + '점' : '')));
        html += '<li class="' + cls + '"><button data-act="startLesson" data-id="' + u.id + '">' +
          '<span class="no">' + u.no + '</span>' +
          '<span class="ut"><b>' + esc(u.title) + '</b><small>' + esc(u.goal) + '</small></span>' +
          '<span class="st">' + st + '</span></button></li>';
      });
      html += '</ol></section>';
    });
    html += '<button class="btn ghost" data-act="startTest">레벨테스트 다시 보기</button>';
    return html;
  }

  function reviewView() {
    var due = dueKeys().length;
    var boxes = [0, 0, 0, 0, 0];
    var keys = Object.keys(state.srs);
    keys.forEach(function (k) { boxes[Math.min(5, state.srs[k].box) - 1]++; });
    var html = '<section class="revHead">' +
      '<div><div class="bigNum">' + due + '</div><div class="dim">오늘 복습할 단어</div></div>' +
      (due ? '<button class="btn primary" data-act="startReview">복습 시작</button>' : '<span class="dim">' + (keys.length ? '오늘 몫은 끝났습니다' : '아직 복습 단어가 없습니다') + '</span>') +
    '</section>';
    if (keys.length) {
      var labels = ['새로', '익히는 중', '', '거의', '장기 기억'];
      html += '<h3 class="sec">기억 상자 <small>' + keys.length + '단어</small></h3><div class="boxes">' +
        boxes.map(function (n, i) {
          return '<div class="bx b' + (i + 1) + '" style="flex:' + Math.max(n, 0.0001) + '"></div>';
        }).join('') + '</div>' +
        '<ul class="boxLegend">' + boxes.map(function (n, i) {
          return '<li><i class="b' + (i + 1) + '"></i>' + (labels[i] || ('상자 ' + (i + 1))) + ' ' + n + '</li>';
        }).join('') + '</ul>' +
        '<p class="note">맞히면 다음 상자로 옮겨 1·3·7·14·30일 뒤에 다시 나오고, 틀리면 첫 상자로 돌아옵니다.</p>';
    }
    var wrong = Object.keys(state.wrong).filter(wordByKey).sort(function (a, b) { return state.wrong[b] - state.wrong[a]; });
    html += '<h3 class="sec">오답 노트 <small>' + wrong.length + '</small></h3>';
    if (!wrong.length) {
      html += '<p class="note">퀴즈에서 틀린 단어가 여기 모입니다. 복습에서 맞히면 빠집니다.</p>';
    } else {
      html += '<button class="btn ghost" data-act="startWrong">오답만 다시 풀기</button><ul class="wrongList">' + wrong.map(function (k) {
        var r = wordByKey(k);
        return '<li><button class="say" data-act="say" data-t="' + esc(r.word.kana) + '" aria-label="듣기">▶</button>' +
          '<span class="wj" lang="ja">' + esc(r.word.jp) + (r.word.jp !== r.word.kana ? '<small>' + esc(r.word.kana) + '</small>' : '') + '</span>' +
          '<span class="wk">' + esc(r.word.ko) + '</span><span class="wc">×' + state.wrong[k] + '</span></li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  function recordView() {
    var days = Object.keys(state.log).length;
    var learned = Object.keys(state.srs).length;
    var doneN = UNITS.filter(passed).length;
    var html = '<ul class="stats">' +
      '<li><b>' + days + '</b><span>학습한 날</span></li>' +
      '<li><b>' + streak() + '</b><span>연속</span></li>' +
      '<li><b>' + learned + '</b><span>익힌 단어</span></li>' +
      '<li><b>' + doneN + '</b><span>완료 단원</span></li></ul>';
    html += monthGrid();
    html += '<h3 class="sec">레벨테스트</h3>';
    if (state.test) {
      var u = UNIT_BY_ID[state.test.unit];
      html += '<div class="testRec"><div>' + md(state.test.at) + ' 응시 · ' + esc(u.level.name) + ' ' + u.no + '과부터 시작</div>' +
        '<div class="dim">' + state.test.scores.map(function (s, i) { return D.LEVELS[i].name + ' ' + s + '/6'; }).join(' · ') + '</div></div>';
    } else {
      html += '<p class="note">아직 보지 않았습니다.</p>';
    }
    html += '<button class="btn ghost" data-act="startTest">' + (state.test ? '다시 보기' : '레벨테스트 보기') + '</button>';
    html += '<h3 class="sec">설정</h3><ul class="settings">' +
      '<li><span>단어 읽기(가나) 함께 보기</span><button class="sw' + (state.showKana ? ' on' : '') + '" data-act="toggle" data-k="showKana" aria-label="읽기 보기"><i></i></button></li>' +
      '<li><span>천천히 읽어 주기</span><button class="sw' + (state.slow ? ' on' : '') + '" data-act="toggle" data-k="slow" aria-label="천천히"><i></i></button></li>' +
      '<li><span>일본어 음성</span><span class="dim">' + (hasVoice() ? '사용 가능' : '찾지 못함') + '</span></li></ul>';
    if (!hasVoice()) {
      html += '<p class="note">소리가 안 나면 안드로이드 <b>설정 → 일반 → 언어 → 텍스트 음성 변환</b>에서 일본어 음성을 받으세요. 아이폰은 <b>설정 → 손쉬운 사용 → 읽기 및 말하기 → 음성</b>에서 일본어를 추가합니다.</p>';
    }
    html += '<button class="btn danger" data-act="reset">기록 전체 지우기</button>' +
      '<p class="note">기록은 이 기기 브라우저에만 저장됩니다. v' + APP_VERSION + '</p>';
    return html;
  }

  function monthGrid() {
    var t = today();
    var cells = '';
    for (var i = 27; i >= 0; i--) {
      var d = addDays(t, -i);
      var e = state.log[d];
      var lv = !e ? 0 : (e.u && e.r ? 2 : 1);
      cells += '<i class="m' + lv + (i === 0 ? ' now' : '') + '" title="' + md(d) + '"></i>';
    }
    return '<h3 class="sec">최근 4주</h3><div class="month">' + cells + '</div>' +
      '<p class="note"><i class="key m1"></i>학습 <i class="key m2"></i>학습+복습</p>';
  }

  // ---------- 화면: 세션 ----------
  function sessionHead(title, progress) {
    return '<header class="sHead"><button class="x" data-act="close" aria-label="닫기">✕</button>' +
      '<div class="sTitle">' + title + '</div>' +
      '<div class="sBar"><i style="width:' + Math.round(progress * 100) + '%"></i></div></header>';
  }

  function testView() {
    if (S.stage === -1) {
      return sessionHead('레벨테스트', 0) + '<div class="sBody center">' +
        '<div class="hello" lang="ja">実力チェック</div>' +
        '<p>초급 → 중급 → 상급 순서로 6문항씩 나옵니다.<br>한 단계에서 4개 이상 맞히면 다음 단계로 넘어가고, 아니면 거기서 끝납니다.</p>' +
        '<ul class="stageList">' + D.LEVELS.map(function (L) { return '<li>' + lvBadge(L) + '<span>' + esc(L.jlpt) + '</span></li>'; }).join('') + '</ul>' +
        '<button class="btn primary" data-act="testBegin">시작</button></div>';
    }
    if (S.stage === 'done') {
      var r = S.result;
      var u = UNIT_BY_ID[r.unit];
      var lower = UNIT_BY_ID[STEP_DOWN[u.id]];
      return sessionHead('레벨테스트 결과', 1) + '<div class="sBody">' +
        '<div class="resultLv">' + lvBadge(u.level) + '<div class="ka" lang="ja">第' + u.no + '課</div><h2>' + esc(u.title) + '부터</h2><p>' + esc(r.why) + '</p></div>' +
        '<ul class="scoreBars">' + D.LEVELS.map(function (L, i) {
          var s = S.scores[i];
          return '<li>' + lvBadge(L) + '<div class="bar"><i class="lv-' + L.color + '" style="width:' + (s == null ? 0 : s / 6 * 100) + '%"></i></div><span>' + (s == null ? '—' : s + '/6') + '</span></li>';
        }).join('') + '</ul>' +
        '<button class="btn primary" data-act="accept" data-id="' + u.id + '">이 단원부터 시작</button>' +
        (lower ? '<button class="btn ghost" data-act="accept" data-id="' + lower.id + '">한 단계 아래 「' + esc(lower.title) + '」부터</button>' : '') +
        '</div>';
    }
    var st = S.stages[S.stage];
    var L = D.LEVELS[S.stage];
    var done = S.scores.length * 6 + S.qi;
    if (S.stageIntro) {
      return sessionHead('레벨테스트', done / 18) + '<div class="sBody center">' +
        lvBadge(L) + '<h2>' + esc(L.name) + ' 문제로 넘어갑니다</h2><p class="dim">앞 단계 ' + S.scores[S.scores.length - 1] + '/6 정답</p>' +
        '<button class="btn primary" data-act="testGo">계속</button></div>';
    }
    var q = st[S.qi];
    return sessionHead('레벨테스트 · ' + esc(L.name) + ' ' + (S.qi + 1) + '/6', done / 18) +
      '<div class="sBody">' +
        '<div class="qLabel">' + lvBadge(L) + '</div>' +
        '<div class="prompt jp sentence" lang="ja">' + blankHtml(q.q) + '</div>' +
        (q.hint ? '<div class="hint">' + esc(q.hint) + '</div>' : '') +
        '<div class="opts">' + q.options.map(function (o, i) {
          return '<button class="opt jp" lang="ja" data-act="testPick" data-i="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>' +
        '<button class="btn link" data-act="testPick" data-i="-1">모르겠어요</button>' +
      '</div>';
  }

  function lessonSteps() {
    var u = S.unit;
    var names = u.type === 'kana' ? [['words', '글자'], ['quiz', '퀴즈']] : [['words', '단어'], ['grammar', '문형'], ['quiz', '퀴즈']];
    var order = names.map(function (n) { return n[0]; }).concat(['result']);
    var at = order.indexOf(S.step);
    return '<ol class="stepTabs">' + names.map(function (n, i) {
      return '<li class="' + (i < at ? 'past' : (i === at ? 'on' : '')) + '">' + n[1] + '</li>';
    }).join('') + '</ol>';
  }

  function lessonView() {
    var u = S.unit;
    var title = esc(u.level.name) + ' ' + u.no + '과 · ' + esc(u.title);
    if (S.step === 'words' && u.type === 'kana') {
      return sessionHead(title, 0.1) + '<div class="sBody">' + lessonSteps() +
        '<p class="note">글자를 누르면 소리를 들려 줍니다. 행(あかさたな…) 단위로 소리 내어 읽어 보세요.</p>' +
        kanaGrid(u) +
        '<button class="btn primary" data-act="toQuiz">퀴즈 ' + KANA_QUIZ + '문제</button></div>';
    }
    if (S.step === 'words') {
      var w = u.words[S.i];
      var n = u.words.length;
      return sessionHead(title, (S.i + 1) / (n + 1) * 0.5) + '<div class="sBody">' + lessonSteps() +
        '<div class="wordCard">' +
          '<div class="cnt">' + (S.i + 1) + ' / ' + n + '</div>' +
          (w.jp !== w.kana ? '<button class="yomi' + (S.hide ? ' hid' : '') + '" data-act="peek" lang="ja">' + (S.hide ? '읽기 보기' : esc(w.kana)) + '</button>' : '<div class="yomi none"></div>') +
          '<div class="big" lang="ja">' + esc(w.jp) + '</div>' +
          '<div class="mean">' + esc(w.ko) + '</div>' +
          '<div class="sayRow"><button class="btn ghost sm" data-act="say" data-t="' + esc(w.kana) + '">듣기</button>' +
          '<button class="btn ghost sm" data-act="say" data-t="' + esc(w.kana) + '" data-slow="1">천천히</button></div>' +
        '</div>' +
        '<div class="navRow"><button class="btn ghost" data-act="prevWord"' + (S.i === 0 ? ' disabled' : '') + '>이전</button>' +
        '<button class="btn primary" data-act="nextWord">' + (S.i === n - 1 ? '문형으로' : '다음') + '</button></div>' +
        '<div class="dots">' + u.words.map(function (_, i) { return '<i class="' + (i <= S.i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '</div>';
    }
    if (S.step === 'grammar') {
      var g = u.grammar;
      return sessionHead(title, 0.55) + '<div class="sBody">' + lessonSteps() +
        '<section class="gram">' +
          '<div class="pattern" lang="ja">' + esc(g.pattern) + '</div>' +
          '<div class="pko">' + esc(g.ko) + '</div>' +
          '<p class="explain">' + esc(g.explain) + '</p>' +
          '<ol class="exs">' + g.examples.map(function (e) {
            return '<li><button class="say" data-act="say" data-t="' + esc(e.yomi) + '" aria-label="듣기">▶</button><div>' +
              '<div class="ej" lang="ja">' + esc(e.jp) + '</div>' +
              (state.showKana && e.yomi !== e.jp ? '<div class="ey" lang="ja">' + esc(e.yomi) + '</div>' : '') +
              '<div class="ek">' + esc(e.ko) + '</div></div></li>';
          }).join('') + '</ol>' +
        '</section>' +
        '<div class="navRow"><button class="btn ghost" data-act="backWords">단어 다시</button>' +
        '<button class="btn primary" data-act="toQuiz">퀴즈 ' + (u.words.length + 2) + '문제</button></div>' +
      '</div>';
    }
    if (S.step === 'quiz') return quizView(title, lessonSteps(), 0.6);
    return resultView(title);
  }

  function kanaGrid(u) {
    // 46자를 오십음도 모양(5열)으로 놓는다. や행·わ행의 빈칸은 비워 둔다.
    var ws = u.words;
    var layout = [];
    for (var i = 0; i < 35; i++) layout.push(ws[i]);
    layout.push(ws[35], null, ws[36], null, ws[37]);
    for (i = 38; i < 43; i++) layout.push(ws[i]);
    layout.push(ws[43], null, null, null, ws[44]);
    layout.push(ws[45], null, null, null, null);
    return '<div class="kanaGrid" lang="ja">' + layout.map(function (w) {
      if (!w) return '<span class="empty"></span>';
      return '<button data-act="say" data-t="' + esc(w.jp) + '"><b>' + esc(w.jp) + '</b><small>' + esc(w.ko) + '</small></button>';
    }).join('') + '</div>';
  }

  function quizView(title, top, base) {
    var q = S.queue[0];
    var done = S.total - S.queue.length;
    var prog = base + (1 - base) * done / (S.total + Object.keys(S.missed).length);
    var picked = S.picked;
    var head = '';
    if (q.listen) {
      head = '<button class="listenBig" data-act="say" data-t="' + esc(q.speak) + '" aria-label="다시 듣기">▶<small>다시 듣기</small></button>';
      if (picked != null) head += '<div class="reveal" lang="ja">' + esc(q.word.jp) + (q.word.jp !== q.word.kana ? ' · ' + esc(q.word.kana) : '') + '</div>';
    } else if (q.blank) {
      head = '<div class="prompt ' + q.pClass + '" lang="ja">' + blankHtml(q.blank) + '</div>';
    } else {
      head = '<div class="prompt ' + q.pClass + '"' + (q.pClass.indexOf('jp') >= 0 ? ' lang="ja"' : '') + '>' + esc(q.prompt) + '</div>' +
        (q.sub ? '<div class="sub" lang="ja">' + esc(q.sub) + '</div>' : '');
    }
    var foot = '';
    if (picked != null) {
      if (S.lastOk) {
        foot = '<div class="fb ok">정답</div>';
      } else {
        var extra = q.word && !q.listen ? ' · ' + esc(q.word.jp) + (q.word.jp !== q.word.kana ? '(' + esc(q.word.kana) + ')' : '') + ' = ' + esc(q.word.ko) : '';
        foot = '<div class="fb ng"><b>정답: ' + esc(q.answer) + '</b>' + extra + '<span>이 문제는 잠시 뒤에 다시 나옵니다</span></div>' +
          '<button class="btn primary" data-act="quizNext">다음</button>';
      }
    }
    return sessionHead(title, prog) + '<div class="sBody">' + (top || '') +
      '<div class="qLabel"><span>' + esc(q.label) + '</span><span class="dim">' + Math.min(done + 1, S.total) + ' / ' + S.total + '</span></div>' +
      head +
      (q.blank && q.sub ? '<div class="hint">' + esc(q.sub) + '</div>' : '') +
      '<div class="opts">' + q.options.map(function (o, i) {
        var cls = 'opt ' + q.oClass;
        if (picked != null) {
          if (o === q.answer) cls += ' right';
          else if (i === picked) cls += ' wrong';
          else cls += ' fade';
        }
        return '<button class="' + cls + '"' + (q.oClass === 'jp' ? ' lang="ja"' : '') + ' data-act="pick" data-i="' + i + '"' + (picked != null ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div>' + foot + '</div>';
  }

  function resultView(title) {
    var pct = Math.round(S.rate * 100);
    var missed = Object.keys(S.missWords).map(wordByKey).filter(Boolean);
    var html = sessionHead(title, 1) + '<div class="sBody">';
    if (S.type === 'lesson') {
      html += lessonSteps();
      var next = currentUnit();
      html += '<section class="result">' +
        '<div class="seal big' + (S.pass ? '' : ' grey') + '" lang="ja">' + (S.pass ? '合格' : '再挑戦') + '</div>' +
        '<div class="pct">' + pct + '<small>점</small></div>' +
        '<p>' + (S.pass ? '단원 완료. 이 단원 단어는 내일부터 복습에 나옵니다.' : '첫 시도 정답 70% 이상이면 완료됩니다. 한 번 더 해 볼까요?') + '</p>' +
        (S.promoted ? '<p class="promo">' + lvBadge(S.promoted) + ' 과정으로 올라갑니다</p>' : '') +
      '</section>';
      html += missedList(missed);
      html += S.pass
        ? (next ? '<button class="btn primary" data-act="startLesson" data-id="' + next.id + '">다음: ' + esc(next.title) + '</button>' : '') +
          '<button class="btn ghost" data-act="close">오늘은 여기까지</button>'
        : '<button class="btn primary" data-act="startLesson" data-id="' + S.unit.id + '">다시 하기</button>' +
          '<button class="btn ghost" data-act="close">나중에</button>';
    } else {
      html += '<section class="result"><div class="seal big" lang="ja">' + (S.type === 'review' ? '復習' : '直し') + '</div>' +
        '<div class="pct">' + pct + '<small>점</small></div>' +
        '<p>' + S.total + '단어 중 ' + S.firstOk + '개를 한 번에 맞혔습니다.' + (missed.length ? ' 틀린 단어는 내일 다시 나옵니다.' : '') + '</p></section>';
      html += missedList(missed);
      html += '<button class="btn primary" data-act="close">확인</button>';
    }
    return html + '</div>';
  }

  function missedList(list) {
    if (!list.length) return '';
    return '<h3 class="sec">틀린 단어 <small>오답 노트에 담았습니다</small></h3><ul class="wrongList">' + list.map(function (r) {
      return '<li><button class="say" data-act="say" data-t="' + esc(r.word.kana) + '" aria-label="듣기">▶</button>' +
        '<span class="wj" lang="ja">' + esc(r.word.jp) + (r.word.jp !== r.word.kana ? '<small>' + esc(r.word.kana) + '</small>' : '') + '</span>' +
        '<span class="wk">' + esc(r.word.ko) + '</span></li>';
    }).join('') + '</ul>';
  }

  // ---------- 렌더 ----------
  function render() {
    var st = streak();
    document.getElementById('streak').innerHTML = st ? '연속 <b>' + st + '</b>일' : '';
    var views = { home: homeView, course: courseView, review: reviewView, record: recordView };
    document.getElementById('view').innerHTML = views[tab]();
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    var box = document.getElementById('session');
    if (S) {
      var html = S.type === 'test' ? testView() : (S.type === 'lesson' ? lessonView() : (S.step === 'result' ? resultView(S.type === 'review' ? '오늘의 복습' : '오답 다시 풀기') : quizView(S.type === 'review' ? '오늘의 복습' : '오답 다시 풀기', '', 0)));
      box.innerHTML = html;
    }
  }

  // ---------- 동작 ----------
  var ACT = {
    tab: function (d) { tab = d.tab; render(); window.scrollTo(0, 0); },
    startTest: startTest,
    testBegin: function () { S.stage = 0; render(); },
    testGo: function () { S.stageIntro = false; render(); },
    testPick: function (d) { testPick(+d.i); },
    accept: function (d) { acceptPlacement(d.id); },
    startLesson: function (d) { startLesson(d.id); },
    close: function () {
      if (S && S.type !== 'test' && S.step === 'quiz' && S.queue && S.queue.length < S.total && !confirm('퀴즈를 그만둘까요? 지금까지 푼 것은 저장되지 않습니다.')) return;
      closeSession();
    },
    peek: function () { S.hide = !S.hide; render(); },
    nextWord: function () {
      if (S.i < S.unit.words.length - 1) { S.i++; render(); speak(S.unit.words[S.i].kana); }
      else { S.step = 'grammar'; render(); }
    },
    prevWord: function () { if (S.i > 0) { S.i--; render(); speak(S.unit.words[S.i].kana); } },
    backWords: function () { S.step = 'words'; S.i = 0; render(); },
    toQuiz: toQuiz,
    pick: function (d) { quizPick(+d.i); },
    quizNext: quizNext,
    say: function (d) { speak(d.t, !!d.slow); },
    startReview: startReview,
    startWrong: startWrong,
    toggle: function (d) { state[d.k] = !state[d.k]; save(); render(); },
    reset: function () {
      if (!confirm('레벨테스트 결과, 진도, 복습 기록을 모두 지울까요? 되돌릴 수 없습니다.')) return;
      state = fresh(); save(); tab = 'home'; render();
    }
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    var fn = ACT[t.dataset.act];
    if (fn) fn(t.dataset, t);
  });

  // 휴대폰 뒤로가기로 학습 화면만 닫히게 한다
  window.addEventListener('popstate', function () { if (S) closeSession(); });
  var openRaw = openSession;
  openSession = function (s) {
    if (!S) try { history.pushState({ s: 1 }, ''); } catch (e) {}
    openRaw(s);
  };
  var closeRaw = closeSession;
  closeSession = function () {
    var wasOpen = !!S;
    closeRaw();
    if (wasOpen && history.state && history.state.s) try { history.back(); } catch (e) {}
  };

  // ---------- 업데이트 확인 ----------
  function checkUpdate() {
    if (!window.fetch) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (v) {
      if (!v || !v.version || String(v.version) === APP_VERSION) {
        try { sessionStorage.removeItem('hwr-jp-autoupdated'); } catch (e) {}
        return;
      }
      var tried = null;
      try { tried = sessionStorage.getItem('hwr-jp-autoupdated'); } catch (e) {}
      if (tried === String(v.version)) return;
      try { sessionStorage.setItem('hwr-jp-autoupdated', String(v.version)); } catch (e) {}
      if (!S) location.replace(location.pathname + '?u=' + Date.now());
    }).catch(function () {});
  }

  // 자동 테스트(test/smoke.js)가 지금 문제의 정답을 알 수 있게 한다
  window.__jpDebug = {
    answer: function () { return S && S.queue && S.queue[0] ? S.queue[0].answer : null; },
    missed: function () { return S && S.queue && S.queue[0] ? !!S.missed[S.queue[0].id] : false; }
  };

  render();
  window.__jpReady = true;
  checkUpdate();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
