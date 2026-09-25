/* 구름이 용돈기입장
 * 서버 없음. 기록은 이 브라우저 localStorage 한 곳에만 있다.
 * 그래서 백업 파일(JSON)이 유일한 안전장치다.
 */
(function () {
  'use strict';

  var STORE_KEY = 'hwr-allowance-v1';
  var BACKUP_KEY = 'hwr-allowance-last-backup';
  var BACKUP_FORMAT = 'hwr-allowance-backup';

  var BILLS = [
    { amount: 1000, name: '천원', color: 'var(--w1000)' },
    { amount: 5000, name: '오천원', color: 'var(--w5000)' },
    { amount: 10000, name: '만원', color: 'var(--w10000)' },
    { amount: 50000, name: '오만원', color: 'var(--w50000)' }
  ];
  var GIVERS = ['할머니', '할아버지', '외할머니', '외할아버지', '엄마', '아빠', '이모·삼촌', '기타'];

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

  // ---------- 상태 ----------
  var records = load();
  var viewYear = new Date().getFullYear();
  var giver = '';
  var lastAdded = null;
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
    var sum = yr.reduce(function (s, r) { return s + r.amount; }, 0);
    var all = records.reduce(function (s, r) { return s + r.amount; }, 0);
    var isThisYear = viewYear === new Date().getFullYear();
    document.querySelector('.totalLabel').textContent = (isThisYear ? '올해' : viewYear + '년에') + ' 받은 용돈';
    $('yearTotal').textContent = won(sum);
    $('yearCount').textContent = yr.length + '번 받았어요';
    $('allTotal').textContent = won(all);

    // 지폐별 장수
    $('billCounts').innerHTML = BILLS.map(function (bill) {
      var n = yr.filter(function (r) { return r.amount === bill.amount; }).length;
      return '<div class="bc"><div class="name"><span class="dot" style="background:' + bill.color + '"></span>' +
        bill.name + '</div><div class="cnt">' + n + '장</div></div>';
    }).join('');

    // 월별 막대
    var byMonth = [];
    for (var m = 0; m < 12; m++) byMonth.push(0);
    yr.forEach(function (r) { byMonth[+r.date.slice(5, 7) - 1] += r.amount; });
    var peak = Math.max.apply(null, byMonth) || 1;
    $('months').innerHTML = byMonth.map(function (v, i) {
      var h = Math.round((v / peak) * 100);
      return '<div class="mo" title="' + (i + 1) + '월 ' + won(v) + '"><div class="barWrap"><div class="bar' +
        (v ? '' : ' zero') + '" style="height:' + h + '%"></div></div><div class="lbl">' + (i + 1) + '</div></div>';
    }).join('');

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
        var mSum = byMonth[mo - 1];
        html += '<div class="monthHead"><span>' + mo + '월</span><span>' + won(mSum) + '</span></div>';
      }
      var bill = billOf(r.amount);
      html += '<div class="row"><span class="tag" style="background:' + (bill ? bill.color : 'var(--accent)') + '"></span>' +
        '<div class="info"><div class="date">' + dateLabel(r.date) + '</div>' +
        (r.giver ? '<div class="who">' + esc(r.giver) + '</div>' : '') + '</div>' +
        '<span class="amt">' + won(r.amount) + '</span>' +
        '<button class="del" data-id="' + esc(r.id) + '" aria-label="지우기">×</button></div>';
    });
    list.innerHTML = html;
  }

  function renderGivers() {
    $('givers').innerHTML = GIVERS.map(function (g) {
      return '<button class="chip' + (g === giver ? ' on' : '') + '" data-giver="' + esc(g) + '">' + esc(g) + '</button>';
    }).join('');
  }

  function toast(text, withUndo) {
    $('toastText').textContent = text;
    $('undoBtn').classList.toggle('hidden', !withUndo);
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.add('hidden'); lastAdded = null; }, 5000);
  }

  // ---------- 동작 ----------
  function add(amount, btn) {
    var date = $('dateInput').value || today();
    var r = { id: newId(), date: date, amount: amount, giver: giver, createdAt: Date.now() };
    records.push(r);
    save();
    lastAdded = r.id;
    viewYear = yearOf(r);   // 다른 해 날짜로 적었으면 그 해로 넘어가서 보여준다
    giver = '';
    renderGivers();
    render();
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    if (navigator.vibrate) navigator.vibrate(30);
    toast(won(amount) + ' 적었어요' + (r.giver ? ' · ' + r.giver : ''), true);
  }

  function undo() {
    if (!lastAdded) return;
    records = records.filter(function (r) { return r.id !== lastAdded; });
    lastAdded = null;
    save();
    render();
    toast('취소했어요', false);
  }

  function remove(id) {
    var r = records.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (!confirm(dateLabel(r.date) + ' ' + won(r.amount) + ' 기록을 지울까요?')) return;
    records = records.filter(function (x) { return x.id !== id; });
    save();
    render();
  }

  function exportBackup() {
    var data = { format: BACKUP_FORMAT, version: 1, exportedAt: Date.now(), records: records };
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

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (e) { alert('백업 파일을 읽을 수 없어요.'); return; }
      if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.records)) {
        alert('구름이 용돈기입장 백업 파일이 아니에요.'); return;
      }
      // 합치기: 같은 id 는 한 번만. 지금 기록은 지우지 않는다.
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

  document.querySelector('.bills').addEventListener('click', function (e) {
    var btn = e.target.closest('.bill');
    if (btn) add(+btn.dataset.amount, btn);
  });
  $('givers').addEventListener('click', function (e) {
    var c = e.target.closest('.chip');
    if (!c) return;
    giver = giver === c.dataset.giver ? '' : c.dataset.giver;
    renderGivers();
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

  // 다른 탭에서 적은 기록 반영
  window.addEventListener('storage', function (e) {
    if (e.key === STORE_KEY) { records = load(); render(); }
  });

  renderGivers();
  render();
  showLastBackup();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
