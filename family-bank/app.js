/* 엄마아빠 은행 (가족은행) 1단계: 입출금통장 + 연 이자 + 출금 승인
 * 서버 없음. 이 브라우저 localStorage 한 곳에만 있다. 은행 기기는 한 대로 정해서 쓴다.
 *
 * 통장 한 줄: { id, date, type: 'in'|'out'|'interest'|'tax', amount, memo, createdAt }
 * 이자: 하루 끝 잔액 × 연 이자율 ÷ 365 를 한 달 모아서, 다음 달 1일에 원 단위 버림으로 넣는다.
 *       기본은 시중은행 1년 정기예금 수준(연 3.5%). 세금을 떼면 물가와 겨우 비기는 수준이라
 *       나중에 "예금만으로는 돈이 크게 늘지 않는다"를 보여줄 수 있다.
 */
(function () {
  'use strict';

  // 배포할 때마다 index.html 의 ?v=, sw.js, version.json 과 같이 올린다
  var APP_VERSION = '2';

  var STORE_KEY = 'hwr-bank-v1';
  var BACKUP_KEY = 'hwr-bank-last-backup';
  var BACKUP_FORMAT = 'hwr-bank-backup';
  var ALLOWANCE_KEY = 'hwr-allowance-v1';   // 같은 사이트의 구름이 용돈기입장
  var TAX_RATE = 0.154;                     // 이자소득세 14% + 지방소득세 1.4%
  var UNLOCK_MS = 10 * 60 * 1000;           // 엄마아빠 모드는 10분 뒤 저절로 잠긴다
  var LEDGER_STEP = 20;

  var TAGS = {
    in: ['할머니', '할아버지', '외할머니', '외할아버지', '엄마', '아빠', '이모·삼촌', '용돈', '기타'],
    out: ['과자·간식', '장난감', '책·문구', '선물', '놀이', '기타']
  };
  var MODE_TEXT = {
    in: { label: '누가 줬어요?', hint: '지폐를 누르면 바로 통장에 들어가요. 이어서 누르면 한 줄로 합쳐져요. 진짜 돈은 엄마아빠가 보관해요.' },
    out: { label: '어디에 쓸 거예요?', hint: '찾기는 신청만 돼요. 엄마아빠가 승인하면 통장에서 빠지고 진짜 돈을 받아요.' }
  };

  var $ = function (id) { return document.getElementById(id); };

  // ---------- 유틸 ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dstr(new Date()); }
  function parseD(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); }
  function nextMonth(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) + 1;
    if (mo > 12) { y++; mo = 1; }
    return y + '-' + pad(mo);
  }
  function prevMonth(m) {
    var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1;
    if (mo < 1) { y--; mo = 12; }
    return y + '-' + pad(mo);
  }
  function lastDay(m) { return m + '-' + pad(new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate()); }
  function num(n) { return Math.round(n).toLocaleString('ko-KR'); }   // 통장 내역은 실제 통장처럼 숫자만
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function wonFine(n) {   // 쌓이는 이자처럼 1원이 안 되는 돈도 보이게
    return n < 10 ? (Math.floor(n * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1 }) + '원' : won(Math.floor(n));
  }
  function pct(n) { return (Math.round(n * 100) / 100).toLocaleString('ko-KR') + '%'; }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // "1,500원", "3만5천" 같은 입력을 숫자로. 못 읽으면 0. (용돈기입장과 같은 규칙)
  var AMOUNT_MAX = 100000000;
  var UNIT = { '억': 100000000, '만': 10000, '천': 1000 };
  function parseAmount(v) {
    if (v === null || v === undefined) return 0;
    var t = String(v).replace(/[,\s원]/g, '');
    var n = 0;
    if (/^\d+$/.test(t)) n = parseInt(t, 10);
    else if (/^(\d*(\.\d+)?[억만천]?)+$/.test(t) && /[억만천]/.test(t)) {
      var rest = t, total = 0;
      ['억', '만', '천'].forEach(function (u) {
        var i = rest.indexOf(u);
        if (i === -1) return;
        var head = rest.slice(0, i);
        total += (head === '' ? 1 : parseFloat(head)) * UNIT[u];
        rest = rest.slice(i + 1);
      });
      if (rest) total += parseFloat(rest) || 0;
      n = Math.round(total);
    }
    return n > 0 && n <= AMOUNT_MAX ? n : 0;
  }
  function askAmount(title) {
    var v = '';
    for (;;) {
      var input = prompt(title, v);
      if (input === null) return 0;
      var n = parseAmount(input);
      if (n) return n;
      alert('금액을 읽지 못했어요. 숫자로 적거나 "3만5천"처럼 적어 주세요.');
      v = input;
    }
  }
  function parseRate(v) {
    var n = parseFloat(String(v).replace(/[%\s]/g, ''));
    return isFinite(n) && n >= 0 && n <= 20 ? Math.round(n * 100) / 100 : null;
  }

  // ---------- 저장 ----------
  function freshState() {
    var m = prevMonth(today().slice(0, 7));
    return {
      rate: 3.5, tax: false, showInflation: false, inflation: 2.9, pin: null,
      kids: [
        { id: 'k1', name: '구름', opened: today(), settled: m, tx: [], requests: [] },
        { id: 'k2', name: '열매', opened: today(), settled: m, tx: [], requests: [] }
      ]
    };
  }
  function isTx(t) {
    return t && typeof t.id === 'string' && typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
      typeof t.amount === 'number' && t.amount > 0 && /^(in|out|interest|tax)$/.test(t.type);
  }
  function isState(s) {
    return s && Array.isArray(s.kids) && s.kids.length && s.kids.every(function (k) {
      return k && typeof k.id === 'string' && typeof k.name === 'string' && Array.isArray(k.tx) &&
        /^\d{4}-\d{2}-\d{2}$/.test(k.opened) && /^\d{4}-\d{2}$/.test(k.settled);
    });
  }
  function clean(s) {
    s.kids.forEach(function (k) {
      k.tx = k.tx.filter(isTx);
      k.requests = Array.isArray(k.requests) ? k.requests.filter(function (r) { return r && r.id && r.amount > 0; }) : [];
    });
    if (parseRate(s.rate) === null) s.rate = 3.5;
    if (parseRate(s.inflation) === null) s.inflation = 2.9;
    return s;
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (isState(s)) return clean(s);
    } catch (e) {}
    return freshState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { alert('저장에 실패했어요. 브라우저 저장공간을 확인해 주세요.'); }
  }

  var state = load();
  var kidIdx = 0;
  var mode = 'in';
  var tag = '';
  var unlockedUntil = 0;
  var ledgerShown = LEDGER_STEP;
  var lastAdded = null;     // { kidId, txId } 되돌리기용
  var mergeable = null;     // 5초 안에 이어 누른 지폐를 합칠 기록
  var toastTimer = null;

  function kid() { return state.kids[kidIdx]; }

  // ---------- 계산 ----------
  function sign(t) { return t.type === 'in' || t.type === 'interest' ? t.amount : -t.amount; }
  function sorted(k) {
    return k.tx.slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0);
    });
  }
  function balance(k) { return k.tx.reduce(function (s, t) { return s + sign(t); }, 0); }

  // from~to(포함) 매일 끝 잔액 × 연 이자율 ÷ 365 의 합 (소수점 그대로)
  function interestBetween(k, from, to) {
    if (from < k.opened) from = k.opened;
    if (from > to) return 0;
    var list = sorted(k), i = 0, bal = 0, sum = 0;
    for (var d = from; d <= to; d = addDays(d, 1)) {
      while (i < list.length && list[i].date <= d) { bal += sign(list[i]); i++; }
      if (bal > 0) sum += bal;
    }
    return sum * state.rate / 100 / 365;
  }

  // 지난달까지 아직 안 준 이자를 한 달씩 넣는다. 앱을 몇 달 안 열어도 빠지지 않는다.
  function settle(k) {
    var cur = today().slice(0, 7), changed = false;
    for (var m = nextMonth(k.settled); m < cur; m = nextMonth(m)) {
      var amt = Math.floor(interestBetween(k, m + '-01', lastDay(m)));
      var pay = nextMonth(m) + '-01', label = (+m.slice(5, 7)) + '월 이자';
      if (amt > 0) {
        k.tx.push({ id: newId(), date: pay, type: 'interest', amount: amt, memo: label, createdAt: Date.now() });
        var tax = state.tax ? Math.floor(amt * TAX_RATE) : 0;
        if (tax > 0) k.tx.push({ id: newId(), date: pay, type: 'tax', amount: tax, memo: '이자 세금', createdAt: Date.now() + 1 });
      }
      k.settled = m;
      changed = true;
    }
    return changed;
  }
  function settleAll() {
    var changed = false;
    state.kids.forEach(function (k) { if (settle(k)) changed = true; });
    if (changed) save();
  }

  // ---------- 엄마아빠 잠금 ----------
  function unlocked() { return Date.now() < unlockedUntil; }
  function lock() { unlockedUntil = 0; render(); }
  var pinJob = null;   // { step: 'check'|'set1'|'set2', first, then }
  function openPin(step, then, msg) {
    pinJob = { step: step, then: then, first: pinJob && pinJob.first };
    $('pinTitle').textContent = step === 'check' ? '엄마아빠 비밀번호' : step === 'set1' ? '새 비밀번호 정하기' : '한 번 더 입력';
    $('pinMsg').textContent = msg || (step === 'check' ? '출금 승인과 설정은 엄마아빠만 할 수 있어요.' :
      step === 'set1' ? '숫자 4자리 이상으로 정해 주세요. 아이가 모르게!' : '확인을 위해 같은 비밀번호를 한 번 더 입력해 주세요.');
    $('pinInput').value = '';
    $('pinSheet').classList.remove('hidden');
    setTimeout(function () { $('pinInput').focus(); }, 50);
  }
  function closePin() { $('pinSheet').classList.add('hidden'); pinJob = null; }
  function submitPin() {
    if (!pinJob) return;
    var v = $('pinInput').value.trim(), job = pinJob;
    if (job.step === 'check') {
      if (v !== state.pin) return openPin('check', job.then, '비밀번호가 달라요. 다시 입력해 주세요.');
      closePin();
      unlockedUntil = Date.now() + UNLOCK_MS;
      render();
      if (job.then) job.then();
    } else if (job.step === 'set1') {
      if (!/^\d{4,8}$/.test(v)) return openPin('set1', job.then, '숫자 4~8자리로 정해 주세요.');
      pinJob.first = v;
      openPin('set2', job.then);
    } else {
      if (v !== job.first) { pinJob.first = null; return openPin('set1', job.then, '두 번 입력한 비밀번호가 달라요. 처음부터 다시 정해 주세요.'); }
      state.pin = v;
      save();
      closePin();
      unlockedUntil = Date.now() + UNLOCK_MS;
      render();
      toast('비밀번호를 정했어요', false);
      if (job.then) job.then();
    }
  }
  // 엄마아빠만 하는 일. 잠겨 있으면 비밀번호부터 묻고, 맞으면 이어서 한다.
  function asParent(then) {
    if (unlocked()) { unlockedUntil = Date.now() + UNLOCK_MS; return then && then(); }
    pinJob = null;
    if (!state.pin) openPin('set1', then, '처음이에요. 엄마아빠 비밀번호(숫자 4자리 이상)를 정해 주세요. 아이가 모르게!');
    else openPin('check', then);
  }

  // ---------- 그리기 ----------
  function render() {
    var k = kid(), bal = balance(k), now = today(), cur = now.slice(0, 7);
    var isParent = unlocked();

    $('kids').innerHTML = state.kids.map(function (x, i) {
      var n = x.requests.length;
      return '<button data-kid="' + i + '" class="' + (i === kidIdx ? 'on' : '') + '">' + esc(x.name) +
        (n ? ' <i class="badge">' + n + '</i>' : '') + '</button>';
    }).join('');
    $('lockBtn').textContent = isParent ? '잠그기' : '엄마아빠';
    $('lockBtn').classList.toggle('open', isParent);
    document.body.classList.toggle('parent', isParent);

    $('bookName').textContent = k.name + ' 입출금통장';
    $('bookNo').textContent = 'No. ' + k.opened.replace(/-/g, '') + '-' + pad(kidIdx + 1);
    $('balance').textContent = won(bal);
    $('rate').textContent = '연 ' + pct(state.rate);
    var acc = interestBetween(k, cur + '-01', now);
    $('accrued').textContent = wonFine(acc);
    $('nextPay').textContent = '이자는 매일 조금씩 쌓이고, ' + (+nextMonth(cur).slice(5, 7)) + '월 1일에 통장에 들어와요.' +
      (state.tax ? ' 들어올 때 세금 15.4%를 떼요.' : '');

    renderInflation(bal);

    // 승인 대기
    $('pendingCard').hidden = !k.requests.length;
    $('pending').innerHTML = k.requests.map(function (r) {
      return '<div class="req"><div class="reqInfo"><b>' + won(r.amount) + '</b><span>' + esc(r.memo || '찾기') + ' · ' +
        (+r.date.slice(5, 7)) + '/' + (+r.date.slice(8, 10)) + '</span></div>' +
        '<button class="ghost small" data-reject="' + r.id + '">거절</button>' +
        '<button class="primaryBtn small" data-approve="' + r.id + '">승인</button></div>';
    }).join('');

    // 맡기기 / 찾기
    document.querySelectorAll('#modeSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); });
    $('recordCard').classList.toggle('modeOut', mode === 'out');
    $('tagLabel').textContent = MODE_TEXT[mode].label;
    $('modeHint').textContent = MODE_TEXT[mode].hint;
    $('tags').innerHTML = TAGS[mode].map(function (g) {
      return '<button class="chip' + (g === tag ? ' on' : '') + '" data-tag="' + esc(g) + '">' + esc(g) + '</button>';
    }).join('');

    renderLedger(k);
    renderAdmin(isParent);
  }

  function renderInflation(bal) {
    var box = $('inflation');
    box.hidden = !state.showInflation;
    if (!state.showInflation) return;
    var base = bal > 0 ? bal : 100000;
    var net = state.rate * (state.tax ? 1 - TAX_RATE : 1);
    var mine = base * (1 + net / 100), price = base * (1 + state.inflation / 100);
    var gap = price - mine;
    box.innerHTML = '<h2>내 돈, 1년 뒤에는?</h2>' +
      (bal > 0 ? '' : '<p class="hint">통장이 비어 있어서 10만원으로 계산했어요.</p>') +
      '<div class="cmp"><div><span>통장 (이자 연 ' + pct(net) + (state.tax ? ', 세금 뗀 뒤' : '') + ')</span><b>' + won(mine) + '</b></div>' +
      '<div><span>같은 물건 값 (물가 연 ' + pct(state.inflation) + ')</span><b>' + won(price) + '</b></div></div>' +
      '<p class="cmpMsg ' + (gap > 0 ? 'lose' : 'win') + '">' + (gap > 0
        ? '이자보다 물건 값이 더 많이 올라요. 지금 ' + won(base) + '으로 살 수 있는 물건을 1년 뒤엔 ' + won(gap) + ' 모자라서 못 사요.'
        : -gap < base * 0.01
          ? '이자가 물가를 겨우 따라가요. 1년 동안 맡겨도 ' + won(-gap) + '어치만 더 살 수 있어요.'
          : '이자가 물가보다 많아요. 1년 뒤 ' + won(-gap) + '어치 더 살 수 있어요.') + '</p>';
  }

  function renderLedger(k) {
    var list = sorted(k), bal = 0, year = today().slice(0, 4);
    var rows = list.map(function (t) {
      bal += sign(t);
      var plus = sign(t) > 0;
      var d = (t.date.slice(0, 4) !== year ? t.date.slice(2, 4) + '.' : '') + (+t.date.slice(5, 7)) + '.' + (+t.date.slice(8, 10));
      return '<div class="lrow ' + t.type + '" data-id="' + t.id + '"><span>' + d + '</span><span class="memo">' + esc(t.memo || '') +
        '</span><span class="num">' + (plus ? '' : num(t.amount)) + '</span><span class="num">' + (plus ? num(t.amount) : '') +
        '</span><span class="num bal">' + num(bal) + '</span></div>';
    });
    var shown = rows.slice(Math.max(0, rows.length - ledgerShown));
    $('ledger').innerHTML = rows.length ? shown.join('') : '<div class="empty">아직 맡긴 돈이 없어요. 위에서 지폐를 눌러 맡겨 보세요.</div>';
    $('moreBtn').hidden = rows.length <= ledgerShown;
  }

  function renderAdmin(isParent) {
    $('admin').hidden = !isParent;
    if (!isParent) return;
    if (document.activeElement && $('admin').contains(document.activeElement)) return;   // 입력 중엔 덮어쓰지 않는다
    $('rateInput').value = state.rate;
    $('taxInput').checked = !!state.tax;
    $('inflInput').checked = !!state.showInflation;
    $('inflRateInput').value = state.inflation;
    $('nameInputs').innerHTML = state.kids.map(function (x, i) {
      return '<label class="editField"><span>' + (i + 1) + '번째</span><input data-name="' + i + '" type="text" maxlength="6" value="' + esc(x.name) + '" /></label>';
    }).join('');
    showLastBackup();
  }

  function toast(text, withUndo) {
    $('toastText').textContent = text;
    $('undoBtn').classList.toggle('hidden', !withUndo);
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.add('hidden'); lastAdded = null; mergeable = null; }, 5000);
  }

  // ---------- 동작 ----------
  function deposit(amount, btn) {
    var k = kid(), t = null;
    if (btn && !tag && mergeable && mergeable.kidId === k.id) {
      t = k.tx.filter(function (x) { return x.id === mergeable.txId; })[0] || null;
    }
    if (t) t.amount += amount;
    else {
      t = { id: newId(), date: today(), type: 'in', amount: amount, memo: tag || '맡김', createdAt: Date.now() };
      k.tx.push(t);
    }
    save();
    lastAdded = { kidId: k.id, txId: t.id, kind: 'tx' };
    mergeable = btn ? { kidId: k.id, txId: t.id } : null;
    tag = '';
    render();
    pop(btn);
    toast('+' + won(t.amount) + ' 맡겼어요' + (btn ? ' · 더 누르면 합쳐져요' : ''), true);
  }

  function request(amount, btn) {
    var k = kid(), r = null;
    if (btn && !tag && mergeable && mergeable.kidId === k.id && mergeable.reqId) {
      r = k.requests.filter(function (x) { return x.id === mergeable.reqId; })[0] || null;
    }
    var want = (r ? r.amount : 0) + amount;
    // 이미 승인을 기다리는 다른 신청까지 합쳐서 잔액을 넘으면 안 된다
    var waiting = k.requests.reduce(function (s, x) { return x === r ? s : s + x.amount; }, 0);
    var can = balance(k) - waiting;
    if (want > can) {
      alert((waiting ? '승인 기다리는 ' + won(waiting) + '을 빼면 ' : '통장에 ') + won(Math.max(0, can)) + '밖에 없어서 ' + won(want) + '은 찾을 수 없어요.');
      return;
    }
    if (r) r.amount = want;
    else {
      r = { id: newId(), date: today(), amount: amount, memo: tag || '찾기' };
      k.requests.push(r);
    }
    save();
    lastAdded = { kidId: k.id, reqId: r.id, kind: 'req' };
    mergeable = btn ? { kidId: k.id, reqId: r.id } : null;
    tag = '';
    render();
    pop(btn);
    toast(won(r.amount) + ' 찾기 신청했어요. 엄마아빠 승인을 기다려요', true);
  }

  function pop(btn) {
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function undo() {
    if (!lastAdded) return;
    var k = state.kids.filter(function (x) { return x.id === lastAdded.kidId; })[0];
    if (k) {
      if (lastAdded.kind === 'tx') k.tx = k.tx.filter(function (x) { return x.id !== lastAdded.txId; });
      else if (lastAdded.kind === 'req') k.requests = k.requests.filter(function (x) { return x.id !== lastAdded.reqId; });
      else if (lastAdded.kind === 'del') k.tx.push(lastAdded.tx);
      save();
    }
    lastAdded = null;
    mergeable = null;
    $('toast').classList.add('hidden');
    render();
  }

  function approve(id) {
    asParent(function () {
      var k = kid(), r = k.requests.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      if (r.amount > balance(k)) { alert('통장 잔액(' + won(balance(k)) + ')이 모자라요.'); return; }
      k.requests = k.requests.filter(function (x) { return x.id !== id; });
      k.tx.push({ id: newId(), date: today(), type: 'out', amount: r.amount, memo: r.memo, createdAt: Date.now() });
      save();
      render();
      toast(won(r.amount) + ' 승인했어요. 진짜 돈을 건네주세요', false);
    });
  }
  function reject(id) {
    asParent(function () {
      var k = kid();
      k.requests = k.requests.filter(function (x) { return x.id !== id; });
      save();
      render();
      toast('찾기 신청을 거절했어요', false);
    });
  }

  function removeTx(id) {
    if (!unlocked()) return;
    var k = kid(), t = k.tx.filter(function (x) { return x.id === id; })[0];
    if (!t || !confirm(t.date + ' ' + (t.memo || '') + ' ' + won(t.amount) + ' 기록을 지울까요?')) return;
    k.tx = k.tx.filter(function (x) { return x.id !== id; });
    save();
    lastAdded = { kidId: k.id, kind: 'del', tx: t };
    mergeable = null;
    render();
    toast('지웠어요', true);
  }

  function saveSettings() {
    var rate = parseRate($('rateInput').value), infl = parseRate($('inflRateInput').value);
    if (rate === null) { alert('이자율은 0~20 사이 숫자로 적어 주세요. (예: 2, 0.1)'); return; }
    if (infl === null) { alert('물가 상승률은 0~20 사이 숫자로 적어 주세요. (예: 2.9)'); return; }
    var names = [].map.call(document.querySelectorAll('#nameInputs input'), function (i) { return i.value.trim(); });
    if (names.some(function (n) { return !n; })) { alert('아이 이름을 비워 둘 수 없어요.'); return; }
    if (rate !== state.rate && !confirm('이자율을 연 ' + pct(rate) + '로 바꿀까요? 아직 안 준 이번 달 이자부터 새 이자율로 계산해요.')) return;
    state.rate = rate;
    state.inflation = infl;
    state.tax = $('taxInput').checked;
    state.showInflation = $('inflInput').checked;
    names.forEach(function (n, i) { state.kids[i].name = n; });
    save();
    if (document.activeElement) document.activeElement.blur();
    render();
    toast('설정을 저장했어요', false);
  }

  function importAllowance() {
    var recs;
    try { recs = JSON.parse(localStorage.getItem(ALLOWANCE_KEY)); } catch (e) {}
    if (!Array.isArray(recs) || !recs.length) { alert('이 기기에 용돈기입장 기록이 없어요. 용돈기입장을 쓰던 기기에서 해 주세요.'); return; }
    var bal = recs.reduce(function (s, r) {
      return r && typeof r.amount === 'number' ? s + (r.type === 'out' ? -r.amount : r.amount) : s;
    }, 0);
    if (bal <= 0) { alert('용돈기입장에 남은 돈이 없어요.'); return; }
    var k = kid();
    if (state.importedAllowance && !confirm('이미 ' + state.importedAllowance + '에 옮겨온 적이 있어요. 또 옮기면 두 번 들어가요. 계속할까요?')) return;
    if (!confirm('용돈기입장에 남은 ' + won(bal) + '을 ' + k.name + ' 통장에 맡길까요?\n용돈기입장 기록은 그대로 둬요.')) return;
    k.tx.push({ id: newId(), date: today(), type: 'in', amount: bal, memo: '용돈기입장에서 옮김', createdAt: Date.now() });
    state.importedAllowance = today();
    save();
    render();
    toast(k.name + ' 통장에 ' + won(bal) + ' 옮겼어요', false);
  }

  function exportBackup() {
    var data = { format: BACKUP_FORMAT, version: 1, exportedAt: Date.now(), state: state };
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '가족은행_' + today() + '.json';
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
      if (!data || data.format !== BACKUP_FORMAT || !isState(data.state)) { alert('가족은행 백업 파일이 아니에요.'); return; }
      if (!confirm('지금 통장을 백업 파일 내용으로 바꿀까요? 지금 기록은 사라져요.')) return;
      state = clean(data.state);
      kidIdx = 0;
      settleAll();
      save();
      render();
      toast('백업을 불러왔어요', false);
    };
    reader.readAsText(file);
  }
  function showLastBackup() {
    var t = null;
    try { t = +localStorage.getItem(BACKUP_KEY); } catch (e) {}
    $('lastBackup').textContent = t ? '마지막 백업: ' + new Date(t).toLocaleDateString('ko-KR') : '아직 백업한 적이 없어요.';
  }

  function hardReload() {
    var jobs = [];
    if (window.caches) jobs.push(caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); }));
    if (navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (r) { return Promise.all(r.map(function (x) { return x.unregister(); })); }));
    Promise.all(jobs).catch(function () {}).then(function () { location.replace(location.pathname + '?r=' + Date.now()); });
  }
  function checkUpdate() {
    if (!window.fetch) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (v) {
      if (!v || !v.version || String(v.version) === APP_VERSION) {
        try { sessionStorage.removeItem('hwr-bank-autoupdated'); } catch (e) {}
        return;
      }
      var tried = null;
      try { tried = sessionStorage.getItem('hwr-bank-autoupdated'); } catch (e) {}
      if (tried !== String(v.version)) {
        try { sessionStorage.setItem('hwr-bank-autoupdated', String(v.version)); } catch (e) {}
        hardReload();
      } else {
        $('update').hidden = false;
      }
    }).catch(function () {});
  }

  // ---------- 연결 ----------
  $('kids').addEventListener('click', function (e) {
    var b = e.target.closest('[data-kid]');
    if (!b) return;
    kidIdx = +b.dataset.kid;
    tag = '';
    mergeable = null;
    ledgerShown = LEDGER_STEP;
    render();
  });
  $('modeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    tag = '';
    mergeable = null;
    render();
  });
  $('tags').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tag]');
    if (!b) return;
    tag = tag === b.dataset.tag ? '' : b.dataset.tag;
    mergeable = null;
    render();
  });
  document.querySelector('.bills').addEventListener('click', function (e) {
    var b = e.target.closest('.bill');
    if (!b) return;
    if (mode === 'in') deposit(+b.dataset.amount, b); else request(+b.dataset.amount, b);
  });
  $('customBtn').addEventListener('click', function () {
    var n = askAmount(mode === 'in' ? '얼마를 맡길까요?' : '얼마를 찾을까요?');
    if (!n) return;
    mergeable = null;
    if (mode === 'in') deposit(n, null); else request(n, null);
  });
  $('pending').addEventListener('click', function (e) {
    var a = e.target.closest('[data-approve]'), r = e.target.closest('[data-reject]');
    if (a) approve(a.dataset.approve);
    if (r) reject(r.dataset.reject);
  });
  $('ledger').addEventListener('click', function (e) {
    var row = e.target.closest('.lrow');
    if (row) removeTx(row.dataset.id);
  });
  $('moreBtn').addEventListener('click', function () { ledgerShown += LEDGER_STEP; render(); });
  $('lockBtn').addEventListener('click', function () { if (unlocked()) lock(); else asParent(null); });
  $('pinOk').addEventListener('click', submitPin);
  $('pinCancel').addEventListener('click', closePin);
  $('pinInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitPin(); });
  $('pinSheet').addEventListener('click', function (e) { if (e.target === $('pinSheet')) closePin(); });
  $('saveSettings').addEventListener('click', saveSettings);
  $('importAllowance').addEventListener('click', importAllowance);
  $('changePin').addEventListener('click', function () { pinJob = null; openPin('set1', null); });
  $('exportBtn').addEventListener('click', exportBackup);
  $('importInput').addEventListener('change', function (e) {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });
  $('undoBtn').addEventListener('click', undo);
  $('updateBtn').addEventListener('click', hardReload);
  $('updateNow').addEventListener('click', hardReload);

  // 다른 탭에서 바꾼 내용 반영
  window.addEventListener('storage', function (e) {
    if (e.key === STORE_KEY) { state = load(); if (kidIdx >= state.kids.length) kidIdx = 0; render(); }
  });
  // 화면을 떠나면 엄마아빠 모드를 잠그고, 돌아오면 날짜가 바뀌었을 수 있으니 이자를 다시 본다
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { unlockedUntil = 0; return; }
    settleAll();
    render();
    checkUpdate();
  });

  settleAll();
  render();
  window.__bankReady = true;
  $('verLabel').textContent = '버전 ' + APP_VERSION;
  checkUpdate();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
