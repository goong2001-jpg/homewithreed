/* 구름이 용돈기입장
 * 서버 없음. 기록은 이 브라우저 localStorage 한 곳에만 있다.
 * 그래서 백업 파일(JSON)이 유일한 안전장치다.
 *
 * 기록 한 줄: { id, date, amount, type: 'in'|'out', giver(받은 돈), use(쓴 돈), createdAt }
 * type 이 없는 옛 기록은 전부 받은 돈이다.
 */
(function () {
  'use strict';

  var STORE_KEY = 'hwr-allowance-v1';
  var BACKUP_KEY = 'hwr-allowance-last-backup';
  var BACKUP_FORMAT = 'hwr-allowance-backup';
  var GOAL_KEY = 'hwr-allowance-goal';
  var TAG_KEYS = { in: 'hwr-allowance-givers', out: 'hwr-allowance-uses' };

  var BILLS = [
    { amount: 1000, name: '천원', color: 'var(--w1000)' },
    { amount: 5000, name: '오천원', color: 'var(--w5000)' },
    { amount: 10000, name: '만원', color: 'var(--w10000)' },
    { amount: 50000, name: '오만원', color: 'var(--w50000)' }
  ];
  var DEFAULT_TAGS = {
    in: ['할머니', '할아버지', '외할머니', '외할아버지', '엄마', '아빠', '이모·삼촌', '기타'],
    out: ['과자·간식', '장난감', '책·문구', '선물', '놀이', '기타']
  };
  var TAG_FIELD = { in: 'giver', out: 'use' };
  var TAG_TEXT = {
    in: { label: '누가 줬어요?', ask: '누가 줬어요? (예: 고모, 옆집 할머니)' },
    out: { label: '어디에 썼어요?', ask: '어디에 썼어요? (예: 포켓몬 카드)' }
  };
  var TAG_MAX = 10;   // 칩 한 개에 들어가는 글자 수

  var $ = function (id) { return document.getElementById(id); };

  // ---------- 저장 ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(isRecord) : [];
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(records)); }
    catch (e) { alert('저장에 실패했어요. 브라우저 저장공간을 확인해 주세요.'); }
  }
  function loadTags(kind) {
    try {
      var arr = JSON.parse(localStorage.getItem(TAG_KEYS[kind]));
      if (Array.isArray(arr)) return arr.filter(function (g) { return typeof g === 'string' && g; });
    } catch (e) {}
    return DEFAULT_TAGS[kind].slice();
  }
  function saveTags(kind) {
    try { localStorage.setItem(TAG_KEYS[kind], JSON.stringify(tags[kind])); } catch (e) {}
  }
  function isGoal(g) { return g && typeof g.name === 'string' && typeof g.amount === 'number' && g.amount > 0; }
  function loadGoal() {
    try { var g = JSON.parse(localStorage.getItem(GOAL_KEY)); return isGoal(g) ? g : null; } catch (e) { return null; }
  }
  function saveGoal() {
    try {
      if (goal) localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
      else localStorage.removeItem(GOAL_KEY);
    } catch (e) {}
  }
  function isRecord(r) {
    return r && typeof r.id === 'string' && typeof r.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date) && typeof r.amount === 'number' && r.amount > 0;
  }

  // ---------- 유틸 ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function won(n) { return n.toLocaleString('ko-KR') + '원'; }
  function yearOf(r) { return +r.date.slice(0, 4); }
  function typeOf(r) { return r.type === 'out' ? 'out' : 'in'; }
  function signed(r) { return typeOf(r) === 'out' ? -r.amount : r.amount; }
  function tagOf(r) { return r[TAG_FIELD[typeOf(r)]] || ''; }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function billOf(amount) {
    for (var i = 0; i < BILLS.length; i++) if (BILLS[i].amount === amount) return BILLS[i];
    return null;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function dateLabel(s) {
    var p = s.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return (+p[1]) + '월 ' + (+p[2]) + '일 (' + DOW[d.getDay()] + ')';
  }
  // "1,500원", "1500" 같은 입력을 숫자로. 못 읽으면 0.
  function parseAmount(v) {
    if (v === null) return 0;
    var n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    return n > 0 && n <= 100000000 ? n : 0;
  }
  function balance() { return records.reduce(function (s, r) { return s + signed(r); }, 0); }

  // ---------- 상태 ----------
  var records = load();
  var viewYear = new Date().getFullYear();
  var mode = 'in';                                  // 지금 적는 게 받은 돈인지 쓴 돈인지
  var tags = { in: loadTags('in'), out: loadTags('out') };
  var tag = '';                                     // 고른 칩
  var editingTags = false;
  var goal = loadGoal();
  var lastAdded = null;
  var undoGoal = null;   // '샀어요'를 되돌리면 목표도 되살린다
  var toastTimer = null;

  // ---------- 화면 ----------
  function yearBounds() {
    var cur = new Date().getFullYear();
    var min = cur, max = cur;
    records.forEach(function (r) { var y = yearOf(r); if (y < min) min = y; if (y > max) max = y; });
    return { min: min, max: max };
  }

  function render() {
    var b = yearBounds();
    $('prevYear').disabled = viewYear <= b.min;
    $('nextYear').disabled = viewYear >= b.max;
    $('yearLabel').textContent = viewYear + '년';
    $('summaryTitle').textContent = viewYear + '년 요약';
    $('listTitle').textContent = viewYear + '년 기록';

    var yr = records.filter(function (r) { return yearOf(r) === viewYear; });
    var yin = yr.filter(function (r) { return typeOf(r) === 'in'; });
    var yout = yr.filter(function (r) { return typeOf(r) === 'out'; });
    var sumIn = yin.reduce(function (s, r) { return s + r.amount; }, 0);
    var sumOut = yout.reduce(function (s, r) { return s + r.amount; }, 0);
    var bal = balance();

    $('balance').textContent = won(bal);
    $('balance').classList.toggle('minus', bal < 0);
    $('yearIn').textContent = '+' + won(sumIn);
    $('yearOut').textContent = '−' + won(sumOut);
    $('yearInCount').textContent = yin.length + '번';
    $('yearOutCount').textContent = yout.length + '번';

    renderGoal(bal);

    // 받은 지폐 장수
    $('billCounts').innerHTML = BILLS.map(function (bill) {
      var n = yin.filter(function (r) { return r.amount === bill.amount; }).length;
      return '<div class="bc"><div class="name"><span class="dot" style="background:' + bill.color + '"></span>' +
        bill.name + '</div><div class="cnt">' + n + '장</div></div>';
    }).join('');

    // 월별 막대 (받은 돈·쓴 돈 나란히)
    var mIn = [], mOut = [];
    for (var m = 0; m < 12; m++) { mIn.push(0); mOut.push(0); }
    yr.forEach(function (r) { (typeOf(r) === 'out' ? mOut : mIn)[+r.date.slice(5, 7) - 1] += r.amount; });
    var peak = Math.max.apply(null, mIn.concat(mOut)) || 1;
    function bar(v, cls) {
      return '<div class="bar ' + cls + (v ? '' : ' zero') + '" style="height:' + Math.round((v / peak) * 100) + '%"></div>';
    }
    $('months').innerHTML = mIn.map(function (v, i) {
      return '<div class="mo" title="' + (i + 1) + '월 받은 돈 ' + won(v) + ' · 쓴 돈 ' + won(mOut[i]) + '">' +
        '<div class="barWrap">' + bar(v, 'in') + bar(mOut[i], 'out') + '</div><div class="lbl">' + (i + 1) + '</div></div>';
    }).join('');

    // 어디에 썼나
    var byUse = {};
    yout.forEach(function (r) { var k = r.use || '안 적음'; byUse[k] = (byUse[k] || 0) + r.amount; });
    var uses = Object.keys(byUse).sort(function (a, b) { return byUse[b] - byUse[a]; });
    $('useBreak').innerHTML = uses.length
      ? '<div class="subHead">어디에 썼나</div>' + uses.map(function (k) {
        return '<div class="ub"><span>' + esc(k) + '</span><div class="ubBar"><i style="width:' +
          Math.round(byUse[k] / sumOut * 100) + '%"></i></div><b>' + won(byUse[k]) + '</b></div>';
      }).join('')
      : '';

    // 목록 (최신순, 월별 묶음)
    var list = $('list');
    if (!yr.length) {
      list.innerHTML = '<div class="empty">' + viewYear + '년엔 아직 기록이 없어요</div>';
      return;
    }
    yr.sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0);
    });
    var html = '', curMonth = null;
    yr.forEach(function (r) {
      var mo = +r.date.slice(5, 7);
      if (mo !== curMonth) {
        curMonth = mo;
        html += '<div class="monthHead"><span>' + mo + '월</span><span>+' + won(mIn[mo - 1]) +
          (mOut[mo - 1] ? ' · <em>−' + won(mOut[mo - 1]) + '</em>' : '') + '</span></div>';
      }
      var out = typeOf(r) === 'out';
      var bill = billOf(r.amount);
      var color = out ? 'var(--spend)' : (bill ? bill.color : 'var(--accent)');
      var t = tagOf(r);
      html += '<div class="row' + (out ? ' out' : '') + '"><span class="tag" style="background:' + color + '"></span>' +
        '<div class="info"><div class="date">' + dateLabel(r.date) + '</div>' +
        '<div class="who">' + (out ? '썼어요' : '받았어요') + (t ? ' · ' + esc(t) : '') + '</div></div>' +
        '<span class="amt">' + (out ? '−' : '+') + won(r.amount) + '</span>' +
        '<button class="del" data-id="' + esc(r.id) + '" aria-label="지우기">×</button></div>';
    });
    list.innerHTML = html;
  }

  function renderGoal(bal) {
    var box = $('goalBody');
    if (!goal) {
      box.innerHTML = '<p class="goalEmpty">모으고 싶은 게 있어요? 목표를 정하면 얼마나 모였는지 보여줘요.</p>' +
        '<button class="primaryBtn" data-goal="set">🎯 목표 정하기</button>';
      return;
    }
    var have = Math.max(0, bal);
    var pct = Math.min(100, Math.floor(have / goal.amount * 100));
    var left = goal.amount - have;
    var done = left <= 0;
    box.innerHTML =
      '<div class="goalName">🎯 ' + esc(goal.name) + '</div>' +
      '<div class="goalNums"><b>' + won(have) + '</b> / ' + won(goal.amount) + '</div>' +
      '<div class="progress' + (done ? ' done' : '') + '"><i style="width:' + pct + '%"></i><span>' + pct + '%</span></div>' +
      (done
        ? '<p class="goalMsg done">🎉 목표 달성! 이제 살 수 있어요</p>' +
          '<button class="primaryBtn" data-goal="buy">샀어요! 쓴 돈으로 적기</button>'
        : '<p class="goalMsg">' + won(left) + ' 더 모으면 돼요!</p>') +
      '<div class="goalTools"><button class="linkBtn" data-goal="set">목표 바꾸기</button>' +
      '<button class="linkBtn" data-goal="clear">목표 지우기</button></div>';
  }

  function renderMode() {
    document.querySelectorAll('.seg button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.mode === mode);
    });
    $('recordCard').classList.toggle('modeOut', mode === 'out');
    $('recordTitle').textContent = mode === 'out' ? '용돈 썼어요 🛍️' : '용돈 받았어요! 💰';
    $('dateLabel').textContent = mode === 'out' ? '쓴 날' : '받은 날';
    $('tagLabel').textContent = TAG_TEXT[mode].label;
    renderTags();
  }

  function renderTags() {
    var list = tags[mode];
    var html;
    if (editingTags) {
      html = list.map(function (g, i) {
        return '<span class="chip edit"><button class="chipName" data-rename="' + i + '">' + esc(g) + ' ✏️</button>' +
          '<button class="chipDel" data-remove="' + i + '" aria-label="' + esc(g) + ' 지우기">×</button></span>';
      }).join('') +
        '<button class="chip add" data-act="add">+ 추가</button>' +
        '<button class="chip done" data-act="done">완료</button>';
    } else {
      html = list.map(function (g) {
        return '<button class="chip' + (g === tag ? ' on' : '') + '" data-tag="' + esc(g) + '">' + esc(g) + '</button>';
      }).join('') +
        '<button class="chip add" data-act="add">+ 추가</button>' +
        '<button class="chip tool" data-act="edit">편집</button>';
    }
    $('tags').innerHTML = html;
  }

  // 이름 입력 받기. 취소하면 null.
  function askName(title, current) {
    var v = prompt(title, current || '');
    if (v === null) return null;
    v = v.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX);
    return v || null;
  }

  function addTag() {
    var name = askName(TAG_TEXT[mode].ask, '');
    if (!name) return;
    if (tags[mode].indexOf(name) === -1) { tags[mode].push(name); saveTags(mode); }
    if (!editingTags) tag = name;   // 추가한 걸 바로 골라 둔다
    renderTags();
  }

  function renameTag(i) {
    var list = tags[mode], old = list[i];
    var name = askName('이름 고치기', old);
    if (!name || name === old) return;
    if (list.indexOf(name) !== -1) { alert('"' + name + '"은(는) 이미 있어요.'); return; }
    list[i] = name;
    saveTags(mode);
    // 지난 기록에 적힌 이름도 같이 바꾼다 — 같은 사람(같은 곳)이니까
    var field = TAG_FIELD[mode], n = 0;
    records.forEach(function (r) { if (typeOf(r) === mode && r[field] === old) { r[field] = name; n++; } });
    if (n) save();
    if (tag === old) tag = name;
    renderTags();
    render();
    if (n) toast('지난 기록 ' + n + '개도 "' + name + '"(으)로 바꿨어요', false);
  }

  function removeTag(i) {
    var g = tags[mode][i];
    if (!confirm('"' + g + '"을(를) 목록에서 뺄까요? 지난 기록은 그대로 남아요.')) return;
    tags[mode].splice(i, 1);
    saveTags(mode);
    if (tag === g) tag = '';
    renderTags();
  }

  function toast(text, withUndo) {
    $('toastText').textContent = text;
    $('undoBtn').classList.toggle('hidden', !withUndo);
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.add('hidden'); lastAdded = null; }, 5000);
  }

  // ---------- 동작 ----------
  function add(amount, btn, forced) {
    undoGoal = null;
    var kind = forced ? forced.type : mode;
    var label = forced ? forced.tag : tag;
    if (kind === 'out' && !forced && amount > balance() &&
        !confirm('가진 돈(' + won(balance()) + ')보다 많아요. 그래도 적을까요?')) return;
    var date = $('dateInput').value || today();
    var r = { id: newId(), date: date, amount: amount, type: kind, createdAt: Date.now() };
    r[TAG_FIELD[kind]] = label;
    records.push(r);
    save();
    lastAdded = r.id;
    viewYear = yearOf(r);   // 다른 해 날짜로 적었으면 그 해로 넘어가서 보여준다
    tag = '';
    editingTags = false;
    renderTags();
    render();
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    if (navigator.vibrate) navigator.vibrate(30);
    toast((kind === 'out' ? '−' : '+') + won(amount) + ' 적었어요' + (label ? ' · ' + label : ''), true);
  }

  function addCustom() {
    var n = parseAmount(prompt(mode === 'out' ? '얼마 썼어요? (숫자만, 예: 1500)' : '얼마 받았어요? (숫자만, 예: 3000)', ''));
    if (n) add(n, null);
  }

  function undo() {
    if (!lastAdded) return;
    records = records.filter(function (r) { return r.id !== lastAdded; });
    lastAdded = null;
    if (undoGoal) { goal = undoGoal; undoGoal = null; saveGoal(); }
    save();
    render();
    toast('취소했어요', false);
  }

  function remove(id) {
    var r = records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (!confirm(dateLabel(r.date) + ' ' + (typeOf(r) === 'out' ? '쓴 돈 ' : '받은 돈 ') + won(r.amount) + ' 기록을 지울까요?')) return;
    records = records.filter(function (x) { return x.id !== id; });
    save();
    render();
  }

  function goalAction(act) {
    if (act === 'set') {
      var name = askName('뭘 사고 싶어요? (예: 레고 성)', goal ? goal.name : '');
      if (!name) return;
      var amount = parseAmount(prompt('얼마예요? (숫자만, 예: 50000)', goal ? String(goal.amount) : ''));
      if (!amount) { alert('금액을 숫자로 적어 주세요.'); return; }
      goal = { name: name, amount: amount, createdAt: goal ? goal.createdAt : Date.now() };
      saveGoal();
      render();
    } else if (act === 'clear') {
      if (!confirm('"' + goal.name + '" 목표를 지울까요?')) return;
      goal = null;
      saveGoal();
      render();
    } else if (act === 'buy') {
      if (!confirm('"' + goal.name + '" ' + won(goal.amount) + '을(를) 쓴 돈으로 적을까요?')) return;
      var g = goal;
      goal = null;
      saveGoal();
      $('dateInput').value = today();
      add(g.amount, null, { type: 'out', tag: g.name });
      undoGoal = g;
      toast('🎉 ' + g.name + ' 샀어요! 다음 목표도 정해 봐요', true);
    }
  }

  function exportBackup() {
    var data = {
      format: BACKUP_FORMAT, version: 1, exportedAt: Date.now(),
      records: records, givers: tags.in, uses: tags.out, goal: goal
    };
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '구름이용돈_' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    try { localStorage.setItem(BACKUP_KEY, String(Date.now())); } catch (e) {}
    showLastBackup();
  }

  function mergeTags(kind, incoming) {
    var n = 0;
    if (Array.isArray(incoming)) incoming.forEach(function (g) {
      if (typeof g === 'string' && g && tags[kind].indexOf(g) === -1) { tags[kind].push(g); n++; }
    });
    if (n) saveTags(kind);
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { alert('백업 파일을 읽을 수 없어요.'); return; }
      if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.records)) {
        alert('구름이 용돈기입장 백업 파일이 아니에요.'); return;
      }
      // 칩 목록은 없는 이름만 더하고, 목표는 지금 없을 때만 가져온다
      mergeTags('in', data.givers);
      mergeTags('out', data.uses);
      if (!goal && isGoal(data.goal)) { goal = data.goal; saveGoal(); }
      renderTags();
      render();
      // 기록 합치기: 같은 id 는 한 번만. 지금 기록은 지우지 않는다.
      var have = {};
      records.forEach(function (r) { have[r.id] = true; });
      var incoming = data.records.filter(function (r) { return isRecord(r) && !have[r.id]; });
      if (!incoming.length) { alert('새로 추가할 기록이 없어요. (이미 다 있어요)'); return; }
      if (!confirm(incoming.length + '개 기록을 추가할까요? 지금 기록은 그대로 둬요.')) return;
      records = records.concat(incoming);
      save();
      render();
      toast(incoming.length + '개 기록을 불러왔어요', false);
    };
    reader.readAsText(file);
  }

  function showLastBackup() {
    var t = null;
    try { t = +localStorage.getItem(BACKUP_KEY); } catch (e) {}
    $('lastBackup').textContent = t ? '마지막 백업: ' + new Date(t).toLocaleDateString('ko-KR') : '아직 백업한 적이 없어요.';
  }

  // ---------- 연결 ----------
  $('dateInput').value = today();
  $('dateInput').max = today();

  document.querySelector('.seg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    tag = '';
    editingTags = false;
    renderMode();
  });
  document.querySelector('.bills').addEventListener('click', function (e) {
    var btn = e.target.closest('.bill');
    if (btn) add(+btn.dataset.amount, btn);
  });
  $('customBtn').addEventListener('click', addCustom);
  $('tags').addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    var act = t.dataset.act;
    if (act === 'add') return addTag();
    if (act === 'edit' || act === 'done') { editingTags = act === 'edit'; tag = ''; return renderTags(); }
    if (t.dataset.rename) return renameTag(+t.dataset.rename);
    if (t.dataset.remove) return removeTag(+t.dataset.remove);
    if (t.dataset.tag) { tag = tag === t.dataset.tag ? '' : t.dataset.tag; renderTags(); }
  });
  $('goalBody').addEventListener('click', function (e) {
    var b = e.target.closest('[data-goal]');
    if (b) goalAction(b.dataset.goal);
  });
  $('list').addEventListener('click', function (e) {
    var d = e.target.closest('.del');
    if (d) remove(d.dataset.id);
  });
  $('prevYear').addEventListener('click', function () { viewYear--; render(); });
  $('nextYear').addEventListener('click', function () { viewYear++; render(); });
  $('undoBtn').addEventListener('click', undo);
  $('exportBtn').addEventListener('click', exportBackup);
  $('importInput').addEventListener('change', function (e) {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });

  // 다른 탭에서 바꾼 내용 반영
  window.addEventListener('storage', function (e) {
    if (e.key === STORE_KEY) { records = load(); render(); }
    if (e.key === TAG_KEYS.in) { tags.in = loadTags('in'); renderTags(); }
    if (e.key === TAG_KEYS.out) { tags.out = loadTags('out'); renderTags(); }
    if (e.key === GOAL_KEY) { goal = loadGoal(); render(); }
  });

  renderMode();
  render();
  showLastBackup();
  window.__allowanceReady = true;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
