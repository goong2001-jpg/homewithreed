/* 기술 설명 8주 — 진단 → 8주 커리큘럼 → 질문 2문장 답하기 → 용어 → 학습 기록.
 * 기록은 이 기기 localStorage 에만 저장한다(서버 없음). */
(function () {
  'use strict';

  var STORE_KEY = 'hwr-tc-v1';
  var STEPS = [
    { t: '시작', s: '지난 기록 1줄 요약 + 복습 질문 2개' },
    { t: '개념 5분', s: '오늘 개념 1개를 업무 비유로' },
    { t: '실습 15분', s: '미니 앱에 기능 1개 + 내가 직접 고칠 곳 1개' },
    { t: '설명 5분', s: '"심사위원에게 설명한다면?" 2문장' },
    { t: '마무리', s: '기록 탭에 배운 것·헷갈린 것·다음 주제' }
  ];
  var GRADE = ['틀림', '애매', '정확'];

  var D = window.TC_DATA;
  var QA_BY_ID = {};
  D.QA.forEach(function (x) { QA_BY_ID[x.id] = x; });

  // ---------- 저장 ----------
  function fresh() {
    return { week: 1, diag: null, steps: {}, weekDone: {}, qa: {}, known: {}, logs: [], pitch: [] };
  }
  var state = fresh();
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) { var parsed = JSON.parse(raw); for (var k in parsed) state[k] = parsed[k]; }
  } catch (e) {}
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function today() { return ymd(new Date()); }
  function md(s) { var p = s.split('-'); return (+p[1]) + '/' + (+p[2]); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl(s) { return esc(s).replace(/\n/g, '<br>'); }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1800);
  }

  function curWeek() { return D.WEEKS[state.week - 1]; }
  function lastGrade(id) { var r = state.qa[id]; return r && r.g && r.g.length ? r.g[r.g.length - 1] : null; }
  function qaSolid() { return D.QA.filter(function (x) { return lastGrade(x.id) === 2; }).length; }
  function knownCount() { return D.TERMS.filter(function (t) { return state.known[t.t]; }).length; }

  // ---------- 화면 ----------
  var tab = 'home';
  var view = document.getElementById('view');
  var sess = document.getElementById('session');
  var openWeek = null;
  var qaFilter = 'all';

  function render() {
    document.getElementById('wk').textContent = 'W' + state.week + ' / 8';
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
    view.innerHTML = ({ home: homeView, course: courseView, qa: qaView, terms: termsView, log: logView })[tab]();
  }

  function homeView() {
    var w = curWeek();
    var h = '';
    if (!state.diag) {
      h += '<div class="hero warn"><span class="code">FIRST SESSION</span><h3>수준 진단 5문항부터</h3>' +
        '<p class="dim">아는 만큼만 한두 문장으로 적습니다. 적은 뒤에야 확인 포인트가 열립니다.</p>' +
        '<div class="btns"><button class="btn" data-act="diag">진단 시작</button></div></div>';
    }
    h += '<h2>이번 주 <small>W' + w.n + ' · ' + esc(w.title) + '</small></h2>';
    h += '<div class="hero"><span class="code">오늘 개념 1개</span><h3>' + esc(w.concept) + '</h3>' +
      '<div class="analogy"><b>업무 비유</b> · ' + esc(w.analogy) + '</div>' +
      '<p class="dim">실습: ' + esc(w.practice) + '</p>' +
      '<p class="dim">직접 고칠 곳: ' + esc(w.myEdit) + '</p></div>';

    var st = state.steps[w.n] || [];
    h += '<h2>30분 세션 순서 <small>' + st.filter(Boolean).length + '/5</small></h2><div class="ledger"><ul class="steps">';
    STEPS.forEach(function (s, i) {
      h += '<li><label><input type="checkbox" data-act="step" data-i="' + i + '"' + (st[i] ? ' checked' : '') + '>' +
        '<span><span class="t">' + (i + 1) + ' · ' + s.t + '</span><br><span class="' + (st[i] ? 'done' : '') + '">' + esc(s.s) + '</span></span></label></li>';
    });
    h += '</ul></div>';

    h += '<h2>바로 연습</h2><div class="quick">' +
      '<button data-act="ten"><b>10분 모드</b><span>설명 연습 3문</span></button>' +
      '<button data-act="interview"><b>면접모드</b><span>연속 5문</span></button>' +
      '<button data-act="pitch"><b>3분 설명</b><span>타이머</span></button></div>';

    h += '<h2>진행 상황</h2><div class="stat">' +
      '<div><b>' + Object.keys(state.weekDone).filter(function (k) { return state.weekDone[k]; }).length + '/8</b><span>완료 주차</span></div>' +
      '<div><b>' + qaSolid() + '/20</b><span>질문 정확</span></div>' +
      '<div><b>' + knownCount() + '/' + D.TERMS.length + '</b><span>용어 익힘</span></div></div>';
    if (state.diag) {
      h += '<p class="dim" style="margin-top:10px">진단 ' + md(state.diag.date) + ' · ' + diagSummary() + ' <button class="know" data-act="diag">다시 보기</button></p>';
    }
    return h;
  }

  function diagSummary() {
    var r = state.diag.rate || [];
    var n2 = r.filter(function (x) { return x === 2; }).length;
    var n0 = r.filter(function (x) { return x === 0; }).length;
    return '알았다 ' + n2 + ' · 몰랐다 ' + n0;
  }

  function courseView() {
    var h = '<p class="dim">한 주에 개념 1개. 눌러서 펼치고, 지금 할 주를 "이번 주로"로 정합니다.</p><div class="ledger">';
    D.WEEKS.forEach(function (w) {
      var done = state.weekDone[w.n];
      h += '<button class="row" data-act="week" data-n="' + w.n + '"><span class="k">W' + w.n + '</span>' +
        '<span class="b"><strong>' + esc(w.title) + '</strong><span class="dim">' + esc(w.concept) + '</span></span>' +
        '<span class="r">' + (w.n === state.week ? '<span class="tag" style="border-color:var(--ok);color:var(--ok)">이번 주</span>' : '') + (done ? ' 완료' : '') + '</span></button>';
      if (openWeek === w.n) {
        h += '<dl class="detail">' +
          '<dt>업무 비유</dt><dd>' + esc(w.analogy) + '</dd>' +
          '<dt>실습</dt><dd>' + esc(w.practice) + '</dd>' +
          '<dt>내가 직접 고칠 곳</dt><dd>' + esc(w.myEdit) + '</dd>' +
          '<dt>설명 연습 질문</dt><dd>' + esc(w.explain) + '</dd>' +
          '<dt>복습 질문</dt><dd>' + w.check.map(esc).join('<br>') + '</dd></dl>' +
          '<div class="btns" style="padding:0 4px 14px 50px;margin:0;border-bottom:1px solid var(--line)">' +
          '<button class="btn ghost" data-act="setWeek" data-n="' + w.n + '">이번 주로</button>' +
          '<button class="btn ' + (done ? 'ghost' : 'ok') + '" data-act="doneWeek" data-n="' + w.n + '">' + (done ? '완료 취소' : '완료 표시') + '</button></div>';
      }
    });
    return h + '</div>';
  }

  function qaView() {
    var h = '<p class="dim">질문을 누르면 내 답을 먼저 적고, 그다음에 모범 답과 비교합니다. 목표는 전부 2문장 이내 "정확".</p>';
    var f = [['all', '전체'], ['real', '공모전 실제'], ['open', '배운 범위'], ['weak', '다시 볼 것']];
    h += '<div class="chips">' + f.map(function (x) {
      return '<button class="chip' + (qaFilter === x[0] ? ' on' : '') + '" data-act="qaf" data-f="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    var list = D.QA.filter(function (x) {
      if (qaFilter === 'real') return x.tag === '공모전 실제 질문';
      if (qaFilter === 'open') return x.w <= state.week;
      if (qaFilter === 'weak') { var g = lastGrade(x.id); return g !== 2; }
      return true;
    });
    if (!list.length) return h + '<p class="dim">해당하는 질문이 없습니다.</p>';
    h += '<div class="ledger">';
    list.forEach(function (x) {
      var g = lastGrade(x.id);
      h += '<button class="row" data-act="qa" data-id="' + x.id + '"><span class="k">' + x.id.toUpperCase() + '</span>' +
        '<span class="b"><strong>' + esc(x.q) + '</strong><span class="dim">W' + x.w + ' · ' + esc(x.tag) +
        (x.w > state.week ? ' <span class="tag lock">아직 안 배움</span>' : '') + '</span></span>' +
        '<span class="r"><span class="dot' + (g == null ? '' : ' g' + g) + '"></span></span></button>';
    });
    return h + '</div>';
  }

  function termsView() {
    var h = '<p class="dim">용어 / 한 줄 정의 / 내 서비스에서 어디에 해당하나. 다 아는 건 "익힘"으로 표시합니다.</p>' +
      '<div class="btns" style="margin-bottom:6px"><button class="btn" data-act="termQuiz">용어 퀴즈 5문</button></div>';
    var byW = {};
    D.TERMS.forEach(function (t) { (byW[t.w] = byW[t.w] || []).push(t); });
    Object.keys(byW).forEach(function (w) {
      var wk = D.WEEKS[w - 1];
      h += '<h2>W' + w + ' · ' + esc(wk.title) + (w > state.week ? ' <small>아직 안 배움</small>' : '') + '</h2><div class="ledger">';
      byW[w].forEach(function (t) {
        var on = state.known[t.t];
        h += '<div class="term"><div class="h"><strong>' + esc(t.t) + '</strong>' +
          '<button class="know' + (on ? ' on' : '') + '" data-act="know" data-t="' + esc(t.t) + '">' + (on ? '익힘' : '익힘 표시') + '</button></div>' +
          '<div class="def">' + esc(t.d) + '</div>' +
          '<div class="map"><b>내 서비스</b> ' + esc(t.m) + '</div>' +
          '<div class="map"><b>FDS 비유</b> ' + esc(t.fds) + '</div></div>';
      });
      h += '</div>';
    });
    return h;
  }

  function logView() {
    var w = curWeek();
    var h = '<h2>오늘 기록</h2>' +
      '<div class="field"><label>날짜</label><input type="date" id="lgDate" value="' + today() + '"></div>' +
      '<div class="field"><label>배운 개념</label><input type="text" id="lgC" value="' + esc(w.concept) + '"></div>' +
      '<div class="field"><label>헷갈린 점</label><textarea id="lgX" rows="2" placeholder="예: 서버와 API가 같은 건 줄 알았다"></textarea></div>' +
      '<div class="field"><label>다음 주제</label><input type="text" id="lgN" placeholder="다음에 할 것"></div>' +
      '<button class="btn wide" data-act="addLog">기록 저장</button>';
    h += '<h2>지난 기록 <small>' + state.logs.length + '건</small></h2>';
    if (state.logs.length) {
      h += '<div class="ledger loglist">';
      state.logs.slice().reverse().forEach(function (l, ri) {
        var i = state.logs.length - 1 - ri;
        h += '<div class="row"><span class="code">' + esc(l.d) + ' · W' + l.w + '</span>' +
          '<strong>' + esc(l.c) + '</strong>' +
          (l.x ? '<span class="dim">헷갈림: ' + esc(l.x) + '</span>' : '') +
          (l.n ? '<span class="dim">다음: ' + esc(l.n) + '</span>' : '') +
          '<button class="know" style="align-self:flex-start;margin-top:4px" data-act="delLog" data-i="' + i + '">삭제</button></div>';
      });
      h += '</div>';
    } else {
      h += '<p class="dim">아직 기록이 없습니다.</p>';
    }
    h += '<h2>코치에게 넘기기</h2><p class="dim">아래 버튼으로 복사해서 Claude 코칭 세션에 붙여 넣으면 이어서 진행합니다.</p>' +
      '<div class="btns"><button class="btn ghost" data-act="copyLog">LEARNING_LOG 형식 복사</button></div>' +
      '<div class="btns"><button class="btn ghost" data-act="reset">이 기기 기록 모두 지우기</button></div>';
    return h;
  }

  function logText() {
    var out = ['# 학습 기록 (기술 설명 8주 앱에서 복사, ' + today() + ')', '', '- 현재 주차: W' + state.week + ' ' + curWeek().title];
    if (state.diag) out.push('- 수준 진단(' + state.diag.date + '): ' + diagSummary());
    var weak = D.QA.filter(function (x) { var g = lastGrade(x.id); return g != null && g < 2; });
    out.push('- 질문 정확 ' + qaSolid() + '/20' + (weak.length ? ', 다시 볼 것: ' + weak.map(function (x) { return x.id.toUpperCase(); }).join(', ') : ''));
    out.push('- 용어 익힘 ' + knownCount() + '/' + D.TERMS.length);
    if (state.pitch.length) out.push('- 3분 설명 최근: ' + state.pitch[state.pitch.length - 1].sec + '초');
    state.logs.forEach(function (l) {
      out.push('', '## ' + l.d + ' · W' + l.w, '- 배운 개념: ' + l.c, '- 헷갈린 점: ' + (l.x || '-'), '- 다음 주제: ' + (l.n || '-'));
    });
    return out.join('\n');
  }

  function copy(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('복사했습니다'); } catch (e) { toast('복사 실패: 길게 눌러 복사하세요'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('복사했습니다'); }, fallback);
    } else fallback();
  }

  // ---------- 세션(전체 화면) ----------
  var S = null;
  var timerId = null;

  function openSession(s) { S = s; document.body.classList.add('locked'); sess.hidden = false; sess.scrollTop = 0; renderSession(); }
  function closeSession() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    S = null; sess.hidden = true; document.body.classList.remove('locked'); render();
  }
  function head(title, i, n) {
    return '<div class="shead"><span class="code">' + esc(title) + (n ? ' · ' + (i + 1) + '/' + n : '') + '</span>' +
      '<button class="x" data-act="close" aria-label="닫기">×</button></div>' +
      (n ? '<div class="bar"><i style="width:' + Math.round((i / n) * 100) + '%"></i></div>' : '');
  }

  function renderSession() {
    var h = '<div class="inner">';
    if (S.kind === 'diag') h += diagScreen();
    else if (S.kind === 'qa') h += qaScreen();
    else if (S.kind === 'term') h += termScreen();
    else if (S.kind === 'pitch') h += pitchScreen();
    sess.innerHTML = h + '</div>';
  }

  // 진단: 적기 → 확인 포인트 → 스스로 표시
  function diagScreen() {
    if (S.i >= D.DIAG.length) {
      var r = S.rate;
      var weakIdx = [];
      r.forEach(function (x, i) { if (x < 2) weakIdx.push(i + 1); });
      var focus = r[2] < 2 ? '6주차(학습·추론·프롬프트)를 미리 맛보기로 1주차에 한 번 짚습니다.' :
        r[1] < 2 ? '4주차 전에 "화면-서버-AI-DB" 흐름 그림을 반복합니다.' : '계획대로 1주차부터 진행합니다.';
      return head('수준 진단 결과') +
        '<div class="hero"><span class="code">RESULT</span><h3>알았다 ' + r.filter(function (x) { return x === 2; }).length +
        ' · 반쯤 ' + r.filter(function (x) { return x === 1; }).length + ' · 몰랐다 ' + r.filter(function (x) { return x === 0; }).length + '</h3>' +
        '<p>' + (weakIdx.length ? '보강할 문항: ' + weakIdx.join(', ') + '번' : '5문항 모두 개념을 잡고 있습니다.') + '</p>' +
        '<p class="dim">' + focus + '</p></div>' +
        '<p class="dim">4번(오탐·미탐)은 FDS 실무 그대로라 7주차 평가 지표에서 강점이 됩니다.</p>' +
        '<div class="btns"><button class="btn ok" data-act="diagSave">저장하고 1주차 시작</button></div>';
    }
    var q = D.DIAG[S.i];
    var h = head('수준 진단', S.i, D.DIAG.length) + '<div class="qbox"><span class="code">Q' + (S.i + 1) + '</span><div class="q">' + esc(q.q) + '</div>';
    if (!S.shown) {
      h += '<textarea id="ans" rows="4" placeholder="아는 만큼만. 모르면 &quot;모름&quot;이라고 적어도 됩니다.">' + esc(S.ans[S.i] || '') + '</textarea>' +
        '<div class="btns"><button class="btn" data-act="diagShow" id="showBtn"' + ((S.ans[S.i] || '').trim() ? '' : ' disabled') + '>적었어요, 확인 포인트 보기</button></div>';
    } else {
      h += '<div class="dim">내 답</div><p>' + nl(S.ans[S.i]) + '</p>' +
        '<div class="model"><span class="code">확인 포인트</span>' + esc(q.hint) + '</div>' +
        '<div class="keys">핵심 단어 ' + q.keys.map(function (k) { return '<span>' + esc(k) + '</span>'; }).join('') + '</div>' +
        '<p class="dim" style="margin-top:14px">내 답은 어땠나요?</p>' +
        '<div class="grade"><button class="g0" data-act="diagRate" data-g="0">몰랐다</button><button class="g1" data-act="diagRate" data-g="1">반쯤</button><button class="g2" data-act="diagRate" data-g="2">알았다</button></div>';
    }
    return h + '</div>';
  }

  // 질문 연습: 내 답 → 모범 답 → 정확/애매/틀림
  function qaScreen() {
    if (S.i >= S.ids.length) {
      var res = S.ids.map(function (id, i) { return { x: QA_BY_ID[id], g: S.res[i] }; });
      var h = head(S.title + ' 결과') + '<div class="ledger">';
      res.forEach(function (r) {
        h += '<div class="row"><span class="k">' + r.x.id.toUpperCase() + '</span><span class="b">' + esc(r.x.q) + '</span>' +
          '<span class="r"><span class="dot g' + r.g + '"></span> ' + GRADE[r.g] + '</span></div>';
      });
      return h + '</div><p class="dim">애매·틀림은 질문 탭의 "다시 볼 것"에 모입니다.</p>' +
        '<div class="btns"><button class="btn" data-act="close">닫기</button></div>';
    }
    var x = QA_BY_ID[S.ids[S.i]];
    var mine = (state.qa[x.id] && state.qa[x.id].mine) || '';
    var h2 = head(S.title, S.ids.length > 1 ? S.i : 0, S.ids.length > 1 ? S.ids.length : 0) +
      '<div class="qbox"><span class="code">' + x.id.toUpperCase() + ' · W' + x.w + ' · ' + esc(x.tag) + '</span>' +
      '<div class="q">' + esc(x.q) + '</div>';
    if (!S.shown) {
      h2 += '<textarea id="ans" rows="5" placeholder="2문장 이내로. 심사위원 앞이라고 생각하고.">' + esc(S.draft != null ? S.draft : mine) + '</textarea>' +
        '<p class="dim" id="cnt"></p>' +
        '<div class="btns"><button class="btn" data-act="qaShow" id="showBtn"' + ((S.draft != null ? S.draft : mine).trim() ? '' : ' disabled') + '>모범 답과 비교</button></div>';
    } else {
      h2 += '<div class="dim">내 답</div><p>' + nl(S.draft) + '</p>' +
        '<div class="model"><span class="code">2문장 모범 답</span>' + esc(x.a) + '</div>' +
        (x.trap ? '<div class="trap"><b>주의</b> ' + esc(x.trap) + '</div>' : '') +
        '<p class="dim" style="margin-top:14px">용어까지 맞게 썼나요?</p>' +
        '<div class="grade"><button class="g0" data-act="qaRate" data-g="0">틀림</button><button class="g1" data-act="qaRate" data-g="1">애매</button><button class="g2" data-act="qaRate" data-g="2">정확</button></div>';
    }
    return h2 + '</div>';
  }

  function termScreen() {
    if (S.i >= S.qs.length) {
      return head('용어 퀴즈 결과') + '<div class="hero"><h3>' + S.ok + ' / ' + S.qs.length + ' 정답</h3>' +
        '<p class="dim">맞힌 용어는 "익힘"으로 표시했습니다.</p></div>' +
        '<div class="btns"><button class="btn" data-act="close">닫기</button></div>';
    }
    var q = S.qs[S.i];
    var h = head('용어 퀴즈', S.i, S.qs.length) + '<div class="qbox"><span class="code">이 설명에 맞는 용어는?</span>' +
      '<div class="q">' + esc(q.t.d) + '</div><p class="dim">FDS 비유: ' + esc(q.t.fds) + '</p>';
    q.opts.forEach(function (o, i) {
      var cls = '';
      if (S.pick != null) { if (o === q.t.t) cls = ' right'; else if (i === S.pick) cls = ' wrong'; }
      h += '<button class="opt' + cls + '" data-act="termPick" data-i="' + i + '"' + (S.pick != null ? ' disabled' : '') + '>' + esc(o) + '</button>';
    });
    if (S.pick != null) {
      h += '<div class="model"><span class="code">내 서비스에서</span>' + esc(q.t.m) + '</div>' +
        '<div class="btns"><button class="btn" data-act="termNext">다음</button></div>';
    }
    return h + '</div>';
  }

  function pitchScreen() {
    var sec = S.sec;
    var mm = Math.floor(sec / 60), ss = sec % 60;
    var h = head('3분 설명') +
      '<p class="dim">그림 없이 말로 서비스 구조를 설명합니다. 목표는 180초 안에 아래 5단계를 다 말하기.</p>' +
      '<div class="timer' + (sec > 180 ? ' over' : '') + '">' + mm + ':' + String(ss).padStart(2, '0') + '</div>' +
      '<div class="btns">' + (S.run ? '<button class="btn ok" data-act="pitchStop">끝 (기록)</button>' : '<button class="btn" data-act="pitchGo">' + (sec ? '다시 시작' : '시작') + '</button>') + '</div>' +
      '<h2>말할 순서</h2><div class="ledger pitch">';
    D.PITCH.forEach(function (p, i) {
      var next = D.PITCH[i + 1] ? D.PITCH[i + 1].s : 9999;
      var cls = sec >= next ? ' past' : (sec >= p.s && (S.run || sec) ? ' cur' : '');
      h += '<div class="row' + cls + '"><span class="k">' + p.label.split(' ')[0] + '</span><span class="b"><strong>' + esc(p.label.split(' ')[1]) + '</strong>' + esc(p.text) + '</span></div>';
    });
    h += '</div>';
    if (state.pitch.length) {
      h += '<p class="dim" style="margin-top:12px">최근 기록: ' + state.pitch.slice(-5).map(function (p) { return md(p.d) + ' ' + p.sec + '초'; }).join(' · ') + '</p>';
    }
    return h;
  }

  function startQA(ids, title) { openSession({ kind: 'qa', ids: ids, i: 0, res: [], shown: false, draft: null, title: title }); }
  function pool(n) {
    var open = D.QA.filter(function (x) { return x.w <= state.week; });
    var extra = D.QA.filter(function (x) { return x.w > state.week && x.tag === '공모전 실제 질문'; });
    var rest = D.QA.filter(function (x) { return x.w > state.week && x.tag !== '공모전 실제 질문'; }).sort(function (a, b) { return a.w - b.w; });
    // 안 맞힌 질문을 먼저 낸다
    var p = shuffle(open).sort(function (a, b) { return (lastGrade(a.id) === 2) - (lastGrade(b.id) === 2); });
    p = p.concat(shuffle(extra), rest);
    return p.slice(0, n).map(function (x) { return x.id; });
  }

  // ---------- 이벤트 ----------
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'ans' || !S) return;
    var v = e.target.value;
    if (S.kind === 'diag') S.ans[S.i] = v; else S.draft = v;
    var b = document.getElementById('showBtn');
    if (b) b.disabled = !v.trim();
    var c = document.getElementById('cnt');
    if (c) {
      var n = v.split(/[.?!。]\s*|\n+/).filter(function (s) { return s.trim(); }).length;
      c.textContent = n ? n + '문장' + (n > 2 ? ' · 2문장으로 줄여 보세요' : '') : '';
    }
  });

  document.addEventListener('change', function (e) {
    var a = e.target.getAttribute('data-act');
    if (a === 'step') {
      var n = state.week;
      var st = state.steps[n] || (state.steps[n] = [false, false, false, false, false]);
      st[+e.target.getAttribute('data-i')] = e.target.checked;
      save(); render();
    }
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var a = el.getAttribute('data-act');
    if (a === 'step') return;
    var n = +el.getAttribute('data-n');

    if (a === 'tab') { tab = el.getAttribute('data-tab'); render(); window.scrollTo(0, 0); }
    else if (a === 'week') { openWeek = openWeek === n ? null : n; render(); }
    else if (a === 'setWeek') { state.week = n; save(); toast('W' + n + '을 이번 주로 정했습니다'); render(); }
    else if (a === 'doneWeek') {
      state.weekDone[n] = !state.weekDone[n];
      if (state.weekDone[n] && n === state.week && n < 8) state.week = n + 1;
      save(); render();
    }
    else if (a === 'qaf') { qaFilter = el.getAttribute('data-f'); render(); }
    else if (a === 'qa') { startQA([el.getAttribute('data-id')], '질문 연습'); }
    else if (a === 'ten') { startQA(pool(3), '10분 모드'); }
    else if (a === 'interview') { startQA(pool(5), '면접모드'); }
    else if (a === 'know') { var t = el.getAttribute('data-t'); state.known[t] = !state.known[t]; save(); render(); }
    else if (a === 'termQuiz') {
      var names = D.TERMS.map(function (t) { return t.t; });
      var src = shuffle(D.TERMS.filter(function (t) { return t.w <= Math.max(state.week, 2); }));
      if (src.length < 5) src = src.concat(shuffle(D.TERMS.filter(function (t) { return src.indexOf(t) < 0; })));
      var qs = src.slice(0, 5).map(function (t) {
        var wrong = shuffle(names.filter(function (x) { return x !== t.t; })).slice(0, 3);
        return { t: t, opts: shuffle(wrong.concat([t.t])) };
      });
      openSession({ kind: 'term', qs: qs, i: 0, ok: 0, pick: null });
    }
    else if (a === 'pitch') { openSession({ kind: 'pitch', sec: 0, run: false }); }
    else if (a === 'diag') {
      var d = state.diag;
      openSession({ kind: 'diag', i: 0, shown: false, ans: d ? d.ans.slice() : [], rate: [] });
    }
    else if (a === 'close') { closeSession(); }

    // 진단
    else if (a === 'diagShow') { S.shown = true; renderSession(); }
    else if (a === 'diagRate') { S.rate[S.i] = +el.getAttribute('data-g'); S.i++; S.shown = false; renderSession(); sess.scrollTop = 0; }
    else if (a === 'diagSave') {
      state.diag = { date: today(), ans: S.ans, rate: S.rate };
      save(); closeSession(); tab = 'home'; render();
    }

    // 질문
    else if (a === 'qaShow') {
      var x = QA_BY_ID[S.ids[S.i]];
      if (S.draft == null) S.draft = (state.qa[x.id] && state.qa[x.id].mine) || '';
      var r = state.qa[x.id] || (state.qa[x.id] = { mine: '', g: [] });
      r.mine = S.draft; save();
      S.shown = true; renderSession();
    }
    else if (a === 'qaRate') {
      var g = +el.getAttribute('data-g');
      var rec = state.qa[S.ids[S.i]];
      rec.g.push(g); if (rec.g.length > 10) rec.g.shift();
      save();
      S.res.push(g); S.i++; S.shown = false; S.draft = null;
      if (S.ids.length === 1) { closeSession(); toast(GRADE[g] + '으로 기록했습니다'); return; }
      renderSession(); sess.scrollTop = 0;
    }

    // 용어 퀴즈
    else if (a === 'termPick') {
      var q = S.qs[S.i]; S.pick = +el.getAttribute('data-i');
      if (q.opts[S.pick] === q.t.t) { S.ok++; state.known[q.t.t] = true; save(); }
      renderSession();
    }
    else if (a === 'termNext') { S.i++; S.pick = null; renderSession(); }

    // 3분 설명
    else if (a === 'pitchGo') {
      S.sec = 0; S.run = true; renderSession();
      var t0 = Date.now();
      timerId = setInterval(function () { S.sec = Math.floor((Date.now() - t0) / 1000); renderSession(); }, 500);
    }
    else if (a === 'pitchStop') {
      clearInterval(timerId); timerId = null; S.run = false;
      state.pitch.push({ d: today(), sec: S.sec }); if (state.pitch.length > 30) state.pitch.shift();
      save(); renderSession();
      toast(S.sec <= 180 ? S.sec + '초 · 3분 안에 끝냈습니다' : S.sec + '초 · ' + (S.sec - 180) + '초 초과');
    }

    // 기록
    else if (a === 'addLog') {
      var c = document.getElementById('lgC').value.trim();
      if (!c) { toast('배운 개념을 적어 주세요'); return; }
      state.logs.push({
        d: document.getElementById('lgDate').value || today(), w: state.week, c: c,
        x: document.getElementById('lgX').value.trim(), n: document.getElementById('lgN').value.trim()
      });
      save(); toast('저장했습니다'); render();
    }
    else if (a === 'delLog') {
      if (!confirm('이 기록을 지울까요?')) return;
      state.logs.splice(+el.getAttribute('data-i'), 1); save(); render();
    }
    else if (a === 'copyLog') { copy(logText()); }
    else if (a === 'reset') {
      if (!confirm('이 기기에 저장된 진단·질문·용어·기록을 모두 지울까요?')) return;
      state = fresh(); save(); tab = 'home'; render();
    }
  });

  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
