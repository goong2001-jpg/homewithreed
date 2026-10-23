/* 엄마아빠 은행 (가족은행) 1단계: 입출금통장 + 연 이자 + 출금 승인
 * 서버 없음. 이 브라우저 localStorage 한 곳에만 있다. 은행 기기는 한 대로 정해서 쓴다.
 *
 * 통장 한 줄: { id, date, type: 'in'|'out'|'interest'|'tax', amount, memo, createdAt }
 *   엄마아빠 모드에서 날짜·금액·메모를 고칠 수 있다. 이미 이자를 준 달의 기록을 고쳐도 지난 이자는 다시 계산하지 않는다.
 * 출금 신청 알림: 설정에 habit-push 서버 주소·암호를 넣으면, 아이가 찾기 신청을 누를 때 부모 폰으로 푸시를 보낸다.
 * 이자: 하루 끝 잔액 × 연 이자율 ÷ 365 를 한 달 모아서, 다음 달 1일에 원 단위 버림으로 넣는다.
 *       기본은 시중은행 1년 정기예금 수준(연 3.5%). 세금을 떼면 물가와 겨우 비기는 수준이라
 *       나중에 "예금만으로는 돈이 크게 늘지 않는다"를 보여줄 수 있다.
 */
(function () {
  'use strict';

  // 배포할 때마다 index.html 의 ?v=, sw.js, version.json 과 같이 올린다
  var APP_VERSION = '6';

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
    in: { label: '누가 줬어요?', note: '왜 받았어요? (예: 생일 선물, 심부름)', hint: '지폐를 누르면 바로 통장에 들어가요. 이어서 누르면 한 줄로 합쳐져요. 진짜 돈은 엄마아빠가 보관해요.' },
    out: { label: '어디에 쓸 거예요?', note: '왜 찾아요? (예: 포켓몬 카드 사려고)', hint: '찾기는 신청만 돼요. 엄마아빠가 승인하면 통장에서 빠지고 진짜 돈을 받아요.' }
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
  var AMOUNT_MAX = 1000000000;   // 10억. 아이 목표(자동차 1억 2500만원)까지는 들어가되 오타로 터무니없는 금액은 막는다. 용돈기입장·가족은행 같은 값
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
      rate: 3.5, tax: false, showInflation: false, inflation: 2.9,
      kids: [
        { id: 'k1', name: '하율', opened: today(), settled: m, tx: [], requests: [] },
        { id: 'k2', name: '호윤', opened: today(), settled: m, tx: [], requests: [] }
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
  var OLD_NAMES = { k1: ['구름', '하율'], k2: ['열매', '호윤'] };   // 버전 2까지의 기본 이름 → 실제 이름
  function clean(s) {
    s.kids.forEach(function (k) {
      var o = OLD_NAMES[k.id];
      if (o && k.name === o[0]) k.name = o[1];
      k.tx = k.tx.filter(isTx);
      k.requests = Array.isArray(k.requests) ? k.requests.filter(function (r) { return r && r.id && r.amount > 0; }) : [];
      if (!(k.goal && typeof k.goal.name === 'string' && k.goal.amount > 0)) k.goal = null;
      k.gift = k.gift > 0 ? Math.floor(k.gift) : 0;
    });
    if (parseRate(s.rate) === null) s.rate = 3.5;
    if (parseRate(s.inflation) === null) s.inflation = 2.9;
    if (s.push && typeof s.push === 'object') {
      ['endpoint', 'passphrase', 'deviceId'].forEach(function (f) { if (typeof s.push[f] !== 'string') delete s.push[f]; });
      s.push.enabled = !!s.push.enabled;
    } else delete s.push;
    return s;
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (isState(s)) return migratePin(clean(s));
    } catch (e) {}
    return freshState();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { alert('저장에 실패했어요. 브라우저 저장공간을 확인해 주세요.'); }
  }

  // ---------- 비밀번호 저장 ----------
  // 비밀번호를 그대로 두지 않고 소금(salt) + 비밀번호의 SHA-256 만 저장한다.
  // crypto.subtle 은 https 또는 localhost 에서만 쓸 수 있다.
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }
  function newSalt() { var b = new Uint8Array(16); crypto.getRandomValues(b); return hex(b); }
  function hashPin(pin, salt) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('crypto.subtle 없음'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pin)).then(hex);
  }
  function hasPin() { return !!(state.pinHash || state.pin); }
  function setPin(pin) {
    var salt = newSalt();
    return hashPin(pin, salt).then(function (h) { state.pinSalt = salt; state.pinHash = h; delete state.pin; save(); });
  }
  // 입력한 비밀번호가 맞는지. 아직 옛 방식(그대로 저장)인 기기는 그대로 비교한다
  function checkPin(v) {
    if (state.pinHash) return hashPin(v, state.pinSalt).then(function (h) { return h === state.pinHash; });
    return Promise.resolve(v === state.pin);
  }
  // 버전 4까지 그대로 저장돼 있던 비밀번호를 해시로 바꾸고 원문은 지운다
  function migratePin(s) {
    if (s.pinHash) { delete s.pin; return s; }
    if (typeof s.pin !== 'string' || !s.pin) return s;
    var salt = newSalt();
    hashPin(s.pin, salt).then(function (h) {
      s.pinSalt = salt; s.pinHash = h; delete s.pin;
      if (s === state) save();
    }).catch(function () {});   // http 처럼 crypto.subtle 이 없으면 다음에 다시
    return s;
  }
  // 백업 파일에는 비밀번호(해시·소금 포함)와 알림 암호·구독을 넣지 않는다. 알림 서버 주소만 남긴다
  function forBackup(s) {
    var o = {};
    Object.keys(s).forEach(function (k) { if (k !== 'pin' && k !== 'pinHash' && k !== 'pinSalt' && k !== 'push') o[k] = s[k]; });
    if (s.push && s.push.endpoint) o.push = { endpoint: s.push.endpoint };
    return o;
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
  // 그 날짜가 든 달의 이자를 이미 줬나. 고치거나 지난 날짜로 맡기면 지난 이자는 다시 계산하지 않고 한 번 묻는다
  function inSettledMonth(k, date) { return date.slice(0, 7) <= k.settled; }
  var SETTLED_MSG = '이미 이자를 준 달의 기록이 바뀝니다. 지난 이자는 다시 계산하지 않아요. 그래도 바꿀까요?';

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
        k.gift = (k.gift || 0) + amt - tax;   // 아이 화면에서 한 번 축하하고 0으로
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
      checkPin(v).then(function (ok) {
        if (pinJob !== job) return;   // 그새 창을 닫았거나 다시 열었다
        if (!ok) return openPin('check', job.then, '비밀번호가 달라요. 다시 입력해 주세요.');
        closePin();
        unlockedUntil = Date.now() + UNLOCK_MS;
        render();
        if (job.then) job.then();
      });
    } else if (job.step === 'set1') {
      if (!/^\d{4,8}$/.test(v)) return openPin('set1', job.then, '숫자 4~8자리로 정해 주세요.');
      pinJob.first = v;
      openPin('set2', job.then);
    } else {
      if (v !== job.first) { pinJob.first = null; return openPin('set1', job.then, '두 번 입력한 비밀번호가 달라요. 처음부터 다시 정해 주세요.'); }
      setPin(v).then(function () {
        closePin();
        unlockedUntil = Date.now() + UNLOCK_MS;
        render();
        toast('비밀번호를 정했어요', false);
        if (job.then) job.then();
      }).catch(function () {
        closePin();
        alert('이 주소에서는 비밀번호를 안전하게 저장할 수 없어요. https 주소나 localhost 로 열어 주세요.');
      });
    }
  }
  // 엄마아빠만 하는 일. 잠겨 있으면 비밀번호부터 묻고, 맞으면 이어서 한다.
  function asParent(then) {
    if (unlocked()) { unlockedUntil = Date.now() + UNLOCK_MS; return then && then(); }
    pinJob = null;
    if (!hasPin()) openPin('set1', then, '처음이에요. 엄마아빠 비밀번호(숫자 4자리 이상)를 정해 주세요. 아이가 모르게!');
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
    renderGoal(k, bal);
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
    $('noteInput').placeholder = MODE_TEXT[mode].note;
    $('tags').innerHTML = TAGS[mode].map(function (g) {
      return '<button class="chip' + (g === tag ? ' on' : '') + '" data-tag="' + esc(g) + '">' + esc(g) + '</button>';
    }).join('');
    $('dateInput').max = now;
    $('dateInput').min = k.opened;
    if (!$('dateInput').value) $('dateInput').value = now;

    renderLedger(k);
    renderAdmin(isParent);
    renderGift(k);
  }

  // 갖고 싶은 것: 이름과 금액만. 다 모으면 바로 찾기 신청으로 이어진다.
  function renderGoal(k, bal) {
    var g = k.goal, box = $('goalCard');
    if (!g) {
      box.innerHTML = '<h2>갖고 싶은 게 있어요?</h2><p class="hint goalHint">목표를 정하면 얼마나 모았는지 보여줘요.</p>' +
        '<button class="primaryBtn" data-goal="set">목표 정하기</button>';
      return;
    }
    var p = Math.max(0, Math.min(100, Math.floor(bal / g.amount * 100))), left = g.amount - bal;   // 잔액이 음수여도 0~100%
    var slow = '';
    if (state.showInflation && left > 0 && bal > 0 && state.rate > 0) {
      // 더 넣지 않고 이자로만 모으면 걸리는 시간 (월복리로 어림)
      var months = Math.ceil(Math.log(g.amount / bal) / Math.log(1 + state.rate / 1200));
      slow = '<p class="hint">돈을 더 넣지 않고 이자로만 모으면 ' +
        (months >= 24 ? '약 ' + Math.round(months / 12) + '년' : '약 ' + months + '개월') + ' 걸려요.</p>';
    }
    box.innerHTML = '<div class="goalTop"><h2>' + esc(g.name) + '</h2><span class="goalAmt">' + won(g.amount) + '</span></div>' +
      '<div class="jar"><i style="width:' + p + '%"></i><span>' + p + '%</span></div>' +
      (left > 0
        ? '<p class="goalMsg">' + won(left) + ' 더 모으면 돼요!</p>' + slow
        : '<p class="goalMsg done">다 모았어요! 엄마아빠한테 찾기 신청해 볼까요?</p>' +
          '<button class="primaryBtn" data-goal="buy">' + won(g.amount) + ' 찾기 신청하기</button>') +
      '<div class="goalTools"><button class="linkBtn" data-goal="set">바꾸기</button><button class="linkBtn" data-goal="clear">지우기</button></div>';
  }

  function goalAction(act) {
    var k = kid();
    if (act === 'set') {
      var name = prompt('갖고 싶은 게 뭐예요? (예: 레고, 인형)', k.goal ? k.goal.name : '');
      if (name === null || !name.trim()) return;
      var amount = askAmount(name.trim() + ' 얼마예요?');
      if (!amount) return;
      k.goal = { name: name.trim().slice(0, 12), amount: amount };
    } else if (act === 'clear') {
      if (!confirm('목표를 지울까요?')) return;
      k.goal = null;
    } else if (act === 'buy') {
      mode = 'out';
      tag = '';
      $('noteInput').value = k.goal.name + ' 사려고';
      mergeable = null;
      return request(k.goal.amount, null);
    }
    save();
    render();
  }

  function renderGift(k) {
    var show = k.gift > 0;
    $('giftSheet').classList.toggle('hidden', !show);
    if (!show) return;
    $('giftTitle').textContent = '은행이 ' + callName(k.name) + '에게 이자를 줬어요!';
    $('giftAmount').textContent = '+' + won(k.gift);
    $('giftMsg').textContent = '돈을 은행에 맡겨 줘서 고맙다고 주는 돈이에요. 많이 맡길수록, 오래 맡길수록 이자도 커져요.';
  }
  function closeGift() {
    var k = kid();
    k.gift = 0;
    save();
    render();
  }

  // ---------- 소리 ----------
  var audio = null;
  function coinSound() {
    if (state.sound === false) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [[1568, 0], [2093, 0.09]].forEach(function (n) {   // 짤랑: 높은 음 두 개
        var o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + n[1];
        o.type = 'triangle';
        o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        o.connect(g).connect(audio.destination);
        o.start(t0);
        o.stop(t0 + 0.4);
      });
    } catch (e) {}
  }
  // 동전이 통장으로 떨어지는 그림
  function coinDrop() {
    var c = document.createElement('i');
    c.className = 'coin';
    document.querySelector('.book').appendChild(c);
    setTimeout(function () { c.remove(); }, 900);
    $('balance').classList.remove('bump');
    void $('balance').offsetWidth;
    $('balance').classList.add('bump');
  }
  // 받침 있는 이름은 '하율이', 없는 이름은 그대로 (아이를 부를 때처럼)
  function callName(n) {
    var c = n.charCodeAt(n.length - 1);
    return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? n + '이' : n;
  }
  function speak(text) {
    if (!window.speechSynthesis) { alert(text); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }
  function speakBalance() {
    var k = kid(), bal = balance(k), text = callName(k.name) + ' 통장에는 ' + bal + '원이 있어요.';
    if (k.goal) text += bal >= k.goal.amount ? ' ' + k.goal.name + ' 살 돈을 다 모았어요!'
      : ' ' + k.goal.name + ' 사려면 ' + (k.goal.amount - bal) + '원 더 모아야 해요.';
    speak(text);
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
        '<button class="editBtn" aria-label="고치기"></button></span><span class="num">' + (plus ? '' : num(t.amount)) + '</span><span class="num">' + (plus ? num(t.amount) : '') +
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
    $('soundInput').checked = state.sound !== false;
    $('inflRateInput').value = state.inflation;
    $('nameInputs').innerHTML = state.kids.map(function (x, i) {
      return '<label class="editField"><span>' + (i + 1) + '번째</span><input data-name="' + i + '" type="text" maxlength="6" value="' + esc(x.name) + '" /></label>';
    }).join('');
    var pc = pushCfg();
    $('pushEndpoint').value = pc.endpoint || '';
    $('pushPass').value = pc.passphrase || '';
    $('pushParent').checked = !!pc.enabled;
    pushStatus();
    showLastBackup();
  }

  function toast(text, withUndo) {
    $('toastText').textContent = text;
    $('undoBtn').classList.toggle('hidden', !withUndo);
    $('toast').classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.add('hidden'); lastAdded = null; mergeable = null; resetDate(); }, 5000);
  }
  var miniTimer = null;
  function miniToast(text) {   // 되돌리기 토스트를 덮지 않는 작은 알림
    $('pushToast').textContent = text;
    $('pushToast').classList.remove('hidden');
    clearTimeout(miniTimer);
    miniTimer = setTimeout(function () { $('pushToast').classList.add('hidden'); }, 3000);
  }
  // 맡긴 날짜 칸을 오늘로 되돌린다 (고르는 중이면 그대로 둔다)
  function resetDate() { if (document.activeElement !== $('dateInput')) $('dateInput').value = today(); }
  function shortDate(d) { return (+d.slice(5, 7)) + '/' + (+d.slice(8, 10)); }

  // ---------- 동작 ----------
  // 칩(누가/어디)과 이유 칸을 합쳐 한 줄 메모로. 둘 다 없으면 기본 말.
  function memoOf(fallback) {
    var note = $('noteInput').value.trim();
    return [tag, note].filter(Boolean).join(' · ') || fallback;
  }
  function freshEntry() { return !!(tag || $('noteInput').value.trim()); }

  // 맡긴 날짜 칸. 비어 있으면 오늘. 오늘보다 뒤거나 통장을 만든 날보다 앞이면 null
  function pickedDate(k) {
    var d = $('dateInput').value || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) d = today();
    if (d > today()) { alert('오늘보다 뒤의 날짜에는 맡길 수 없어요.'); return null; }
    if (d < k.opened) { alert('통장을 만든 날(' + k.opened + ') 이후 날짜만 돼요.'); return null; }
    return d;
  }

  function deposit(amount, btn) {
    var k = kid(), t = null, date = pickedDate(k);
    if (!date) return;
    if (btn && !freshEntry() && mergeable && mergeable.kidId === k.id) {
      t = k.tx.filter(function (x) { return x.id === mergeable.txId && x.date === date; })[0] || null;
    }
    if (t) t.amount += amount;
    else {
      if (date !== today() && inSettledMonth(k, date) && !confirm(SETTLED_MSG)) return;
      t = { id: newId(), date: date, type: 'in', amount: amount, memo: memoOf('맡김'), createdAt: Date.now() };
      k.tx.push(t);
    }
    save();
    lastAdded = { kidId: k.id, txId: t.id, kind: 'tx' };
    mergeable = btn ? { kidId: k.id, txId: t.id } : null;
    tag = '';
    $('noteInput').value = '';
    render();
    pop(btn);
    coinSound();
    coinDrop();
    toast('+' + won(t.amount) + ' 맡겼어요' + (date !== today() ? ' (' + shortDate(date) + ' 날짜로)' : '') + (btn ? ' · 더 누르면 합쳐져요' : ''), true);
  }

  function request(amount, btn) {
    var k = kid(), r = null;
    if (btn && !freshEntry() && mergeable && mergeable.kidId === k.id && mergeable.reqId) {
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
      r = { id: newId(), date: today(), amount: amount, memo: memoOf('찾기') };
      k.requests.push(r);
    }
    save();
    lastAdded = { kidId: k.id, reqId: r.id, kind: 'req' };
    mergeable = btn ? { kidId: k.id, reqId: r.id } : null;
    tag = '';
    $('noteInput').value = '';
    render();
    pop(btn);
    toast(won(r.amount) + ' 찾기 신청했어요. 엄마아빠 승인을 기다려요', true);
    notifyParents(k, r);
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
    closeEdit();
    lastAdded = { kidId: k.id, kind: 'del', tx: t };
    mergeable = null;
    render();
    toast('지웠어요', true);
  }

  // ---------- 통장 내역 고치기 ----------
  // 엄마아빠 모드면 날짜·금액·메모를 고치거나 지운다. 아이 모드면 보기만 한다.
  var editing = null;   // { id, readOnly }
  var KIND_TEXT = { in: '맡기신 돈', out: '찾으신 돈', interest: '이자', tax: '이자 세금' };
  // '할머니 · 생일 선물' 을 칩과 이유로 다시 나눈다
  function splitMemo(memo, type) {
    var parts = String(memo || '').split(' · ');
    if ((TAGS[type] || []).indexOf(parts[0]) >= 0) return { tag: parts[0], note: parts.slice(1).join(' · ') };
    return { tag: '', note: memo || '' };
  }
  function openEdit(id) {
    var k = kid(), t = k.tx.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var ro = !unlocked(), hasTag = t.type === 'in' || t.type === 'out', m = splitMemo(t.memo, t.type);
    editing = { id: id, readOnly: ro };
    $('editTitle').textContent = ro ? '통장 내역' : '기록 고치기';
    $('editKind').textContent = KIND_TEXT[t.type] + (ro ? '' : ' · 날짜는 통장을 만든 날부터 오늘까지만 돼요.');
    $('editDate').value = t.date;
    $('editDate').min = k.opened;
    $('editDate').max = today();
    $('editAmount').value = t.amount.toLocaleString('ko-KR');
    $('editTagRow').hidden = !hasTag;
    if (hasTag) {
      $('editTagLabel').textContent = MODE_TEXT[t.type].label;
      $('editTag').innerHTML = '<option value="">(없음)</option>' + TAGS[t.type].map(function (g) {
        return '<option' + (g === m.tag ? ' selected' : '') + '>' + esc(g) + '</option>';
      }).join('');
    }
    $('editNote').value = hasTag ? m.note : (t.memo || '');
    ['editDate', 'editAmount', 'editTag', 'editNote'].forEach(function (f) { $(f).disabled = ro; });
    $('editBtns').hidden = ro;
    $('editViewBtns').hidden = !ro;
    $('editSheet').classList.remove('hidden');
  }
  function closeEdit() {
    editing = null;
    $('editSheet').classList.add('hidden');
  }
  function saveEdit() {
    if (!editing || editing.readOnly || !unlocked()) return closeEdit();
    var k = kid(), t = k.tx.filter(function (x) { return x.id === editing.id; })[0];
    if (!t) return closeEdit();
    var amount = parseAmount($('editAmount').value);
    if (!amount) { alert('금액을 읽지 못했어요. 숫자로 적거나 "3만5천"처럼 적어 주세요.'); return; }
    var date = $('editDate').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert('날짜를 골라 주세요.'); return; }
    if (date > today()) { alert('오늘보다 뒤의 날짜는 안 돼요.'); return; }
    if (date < k.opened) { alert('통장을 만든 날(' + k.opened + ') 이후 날짜만 돼요.'); return; }
    var note = $('editNote').value.trim(), memo;
    if (t.type === 'in' || t.type === 'out') memo = [$('editTag').value, note].filter(Boolean).join(' · ') || (t.type === 'in' ? '맡김' : '찾기');
    else memo = note || t.memo;
    if (date === t.date && amount === t.amount && memo === t.memo) return closeEdit();
    // 이미 이자를 준 달이 끼면 한 번 묻는다. 지난 이자는 그대로 둔다 (다시 계산하지 않는다)
    if ((inSettledMonth(k, date) || inSettledMonth(k, t.date)) && !confirm(SETTLED_MSG)) return;
    t.date = date;
    t.amount = amount;
    t.memo = memo;
    k.tx = sorted(k);   // id 는 그대로, 날짜순으로 다시 정렬
    save();
    lastAdded = null;
    mergeable = null;
    closeEdit();
    render();
    toast('고쳤어요', false);
  }

  function saveSettings() {
    var rate = parseRate($('rateInput').value), infl = parseRate($('inflRateInput').value);
    if (rate === null) { alert('이자율은 0~20 사이 숫자로 적어 주세요. (예: 2, 0.1)'); return; }
    if (infl === null) { alert('물가 상승률은 0~20 사이 숫자로 적어 주세요. (예: 2.9)'); return; }
    var names = [].map.call(document.querySelectorAll('#nameInputs input'), function (i) { return i.value.trim(); });
    if (names.some(function (n) { return !n; })) { alert('아이 이름을 비워 둘 수 없어요.'); return; }
    var ep = normEndpoint($('pushEndpoint').value), pp = $('pushPass').value.trim();
    if (ep && !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1))/.test(ep)) { alert('알림 서버 주소는 https:// 로 시작해야 해요. (예: https://habit-push.계정.workers.dev)'); return; }
    if (rate !== state.rate) {
      if (!confirm('이자율을 연 ' + pct(rate) + '로 바꿀까요? 지난달까지 아직 안 준 이자는 지금 이자율(연 ' + pct(state.rate) + ')로 먼저 넣고, 그다음부터 새 이자율로 계산해요.')) return;
      settleAll();   // 밀린 달 이자는 옛 이자율로 먼저 정산한다
    }
    state.rate = rate;
    state.inflation = infl;
    state.tax = $('taxInput').checked;
    state.showInflation = $('inflInput').checked;
    state.sound = $('soundInput').checked;
    names.forEach(function (n, i) { state.kids[i].name = n; });
    var pc = pushCfg();
    pc.endpoint = ep;
    pc.passphrase = pp;
    if (!(ep && pp)) pc.enabled = false;   // 서버가 없으면 받을 수도 없다
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
    var data = { format: BACKUP_FORMAT, version: 1, exportedAt: Date.now(), state: forBackup(state) };
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
      var merge = confirm('백업 기록을 지금 통장에 합칠까요?\n[확인] 합치기: 같은 기록은 한 번만, 양쪽 기록을 모두 남겨요.\n[취소] 다음 질문에서 지금 통장을 백업 내용으로 바꿀 수 있어요.');
      if (!merge && !confirm('지금 통장을 백업 파일 내용으로 바꿀까요? 지금 기록은 사라져요.')) return;
      var keep = { pin: state.pin, pinHash: state.pinHash, pinSalt: state.pinSalt, push: state.push };   // 비밀번호·알림 설정은 이 기기 것을 그대로 둔다
      var inc = clean(data.state);
      if (merge) mergeState(inc); else state = inc;
      ['pin', 'pinHash', 'pinSalt'].forEach(function (f) { if (keep[f]) state[f] = keep[f]; else delete state[f]; });
      if (keep.push && (keep.push.endpoint || keep.push.enabled)) state.push = keep.push;
      kidIdx = 0;
      settleAll();
      save();
      render();
      toast(merge ? '백업을 합쳤어요' : '백업을 불러왔어요', false);
    };
    reader.readAsText(file);
  }
  // 백업의 통장 기록을 지금 통장에 합친다. 같은 id 는 더 나중 것(createdAt, 없으면 날짜) 하나만 남긴다.
  function mergeState(inc) {
    function newer(a, b) { return (a.createdAt || 0) > (b.createdAt || 0) || ((a.createdAt || 0) === (b.createdAt || 0) && (a.date || '') > (b.date || '')); }
    inc.kids.forEach(function (ik) {
      var k = state.kids.filter(function (x) { return x.id === ik.id; })[0];
      if (!k) { state.kids.push(ik); return; }
      ['tx', 'requests'].forEach(function (f) {
        var by = {};
        k[f].concat(ik[f]).forEach(function (t) { if (!by[t.id] || newer(t, by[t.id])) by[t.id] = t; });
        k[f] = Object.keys(by).map(function (id) { return by[id]; });
      });
      if (ik.settled > k.settled) k.settled = ik.settled;   // 어느 쪽이든 이미 준 이자를 또 주지 않게
      if (ik.opened < k.opened) k.opened = ik.opened;
      if (!k.goal && ik.goal) k.goal = ik.goal;
    });
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

  // ---------- 출금 신청 알림 (부모 폰 푸시) ----------
  // 서버는 habit-push(Cloudflare Worker). 아이가 찾기 신청을 누르면 이 기기가 /bank/notify 를 부르고,
  // Worker 가 등록된 부모 폰 전부에 푸시를 보낸다. 서버 주소·암호가 비어 있으면 아무 일도 하지 않는다.
  // 부모 폰은 설정의 스위치로 /bank/subscribe 에 자기 구독을 올린다. (habit-talk/src/push/register.ts 와 같은 흐름)
  function pushCfg() { if (!state.push || typeof state.push !== 'object') state.push = {}; return state.push; }
  function normEndpoint(v) { return String(v || '').trim().replace(/\/+$/, ''); }
  function postJson(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  function appUrl() { return location.href.replace(/[?#].*$/, ''); }
  function isIOS() { return /iPhone|iPod|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); }
  function standalone() { return navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function b64ToBytes(b) {
    var raw = atob((b + '='.repeat((4 - b.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function pushStatus() {
    var c = pushCfg();
    $('pushStatus').textContent = c.enabled
      ? '이 폰은 출금 신청 알림을 받아요' + (c.subscribedAt ? ' (' + new Date(c.subscribedAt).toLocaleDateString('ko-KR') + ' 켬)' : '') + '.'
      : c.endpoint && c.passphrase ? '아이가 찾기 신청을 하면 이 서버로 알림을 보내요. 부모 폰에서는 위 스위치를 켜 주세요.'
      : '서버 주소와 암호를 적고 설정 저장을 누르면, 찾기 신청 때 알림을 보내요.';
  }
  // 아이가 찾기 신청 → 부모 폰. 화면을 막지 않고, 실패해도 조용히 넘어간다 (콘솔에만 남긴다)
  function notifyParents(k, r) {
    var c = pushCfg();
    if (!(c.endpoint && c.passphrase) || !window.fetch) return;
    try {
      postJson(c.endpoint + '/bank/notify', {
        passphrase: c.passphrase,
        title: '엄마아빠 은행',
        body: callName(k.name) + '가 ' + won(r.amount) + ' 찾기 신청했어요' + (r.memo && r.memo !== '찾기' ? ' (' + r.memo + ')' : ''),
        url: appUrl(),
        tag: 'hwr-bank-req-' + r.id   // 이어 눌러 합쳐진 신청은 알림도 하나로
      }).then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)); })
        .then(function (d) {
          if (d && d.sent > 0) miniToast('엄마아빠 폰에 알림 보냄');
          else console.warn('알림을 받을 부모 폰이 없어요', d);
        })
        .catch(function (err) { console.warn('알림 보내기 실패', err); });
    } catch (err) { console.warn('알림 보내기 실패', err); }
  }
  // 이 폰을 부모 폰으로 등록. 반드시 스위치를 누른 동작 안에서 불러야 한다 (특히 아이폰)
  function enablePush() {
    var c = pushCfg(), endpoint = normEndpoint($('pushEndpoint').value), pass = $('pushPass').value.trim();
    function fail(msg) {
      c.enabled = false;
      save();
      $('pushParent').checked = false;
      pushStatus();
      alert(msg);
    }
    if (!endpoint || !pass) return fail('먼저 서버 주소와 암호를 적어 주세요.');
    c.endpoint = endpoint;
    c.passphrase = pass;
    if (!c.deviceId) c.deviceId = 'bank-' + newId();
    save();
    if (!window.isSecureContext) return fail('https 주소(또는 홈 화면에 추가한 앱)에서만 알림을 켤 수 있어요.');
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return fail('이 브라우저는 푸시 알림을 지원하지 않아요.' + (isIOS() ? ' 아이폰은 iOS 16.4 이상에서, 홈 화면에 추가한 앱 안에서만 돼요.' : ''));
    }
    if (isIOS() && !standalone()) return fail('아이폰은 먼저 사파리 공유 → 홈 화면에 추가로 설치한 뒤, 그 앱 안에서 켜야 해요.');
    var reg = null;
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') throw new Error('알림 권한이 허용되지 않았어요. 폰 설정에서 이 앱의 알림을 허용해 주세요.');
      return navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () { throw new Error('서비스워커를 등록하지 못했어요.'); });
    }).then(function () {
      // ready 가 영영 안 풀리는 경우가 있어서 기다리는 시간을 둔다
      return Promise.race([navigator.serviceWorker.ready, new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error('서비스워커가 준비되지 않았어요. 앱을 닫았다 다시 열고 시도해 주세요.')); }, 10000);
      })]);
    }).then(function (r) {
      reg = r;
      // 공개키는 서버의 /health 에서 받는다. 서버에서 키를 바꿔도 앱은 손댈 게 없다
      return fetch(endpoint + '/health', { cache: 'no-cache' }).catch(function () { throw new Error('알림 서버에 연결하지 못했어요. 주소와 인터넷을 확인해 주세요.'); });
    }).then(function (res) {
      if (!res.ok) throw new Error('알림 서버가 응답하지 않아요 (' + res.status + ').');
      return res.json();
    }).then(function (h) {
      var key = String(h && h.vapidPublicKey || '').trim();
      if (!key) throw new Error('알림 서버에 아직 키가 없어요. habit-push 설치를 마쳐 주세요.');
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      }).catch(function () { throw new Error('구독에 실패했어요. 잠시 뒤 다시 시도해 주세요.'); });
    }).then(function (sub) {
      return postJson(endpoint + '/bank/subscribe', { passphrase: pass, subscription: sub.toJSON(), deviceId: c.deviceId, role: 'parent' })
        .catch(function () { throw new Error('알림 서버에 연결하지 못했어요. 주소와 인터넷을 확인해 주세요.'); });
    }).then(function (res) {
      if (res.status === 401) throw new Error('암호가 맞지 않아요. habit-push 의 PASSPHRASE 와 같은지 확인해 주세요.');
      if (!res.ok) throw new Error('알림 서버가 응답하지 않아요 (' + res.status + ').');
      c.enabled = true;
      c.subscribedAt = Date.now();
      save();
      $('pushParent').checked = true;
      pushStatus();
      toast('이 폰으로 출금 신청 알림을 받아요', false);
    }).catch(function (err) { fail(err && err.message ? err.message : '알림을 켜지 못했어요.'); });
  }
  function disablePush() {
    var c = pushCfg();
    c.enabled = false;
    save();
    pushStatus();
    toast('이 폰에서는 알림을 받지 않아요', false);
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(function (reg) { return reg && reg.pushManager.getSubscription(); })
      .then(function (sub) { if (sub) return sub.unsubscribe(); })
      .then(function () {
        if (c.endpoint && c.passphrase && c.deviceId) return postJson(c.endpoint + '/bank/unsubscribe', { passphrase: c.passphrase, deviceId: c.deviceId });
      })
      .catch(function () {});
  }

  // ---------- 연결 ----------
  $('kids').addEventListener('click', function (e) {
    var b = e.target.closest('[data-kid]');
    if (!b) return;
    kidIdx = +b.dataset.kid;
    tag = '';
    $('noteInput').value = '';
    $('dateInput').value = '';   // 통장마다 만든 날이 달라서 오늘로
    mergeable = null;
    ledgerShown = LEDGER_STEP;
    render();
  });
  $('modeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.dataset.mode === mode) return;
    mode = b.dataset.mode;
    tag = '';
    $('noteInput').value = '';
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
    if (row) openEdit(row.dataset.id);
  });
  $('editSave').addEventListener('click', saveEdit);
  $('editCancel').addEventListener('click', closeEdit);
  $('editClose').addEventListener('click', closeEdit);
  $('editDelete').addEventListener('click', function () { if (editing) removeTx(editing.id); });
  $('editSheet').addEventListener('click', function (e) { if (e.target === $('editSheet')) closeEdit(); });
  $('pushParent').addEventListener('change', function (e) { if (e.target.checked) enablePush(); else disablePush(); });
  $('goalCard').addEventListener('click', function (e) {
    var b = e.target.closest('[data-goal]');
    if (b) goalAction(b.dataset.goal);
  });
  $('speakBtn').addEventListener('click', speakBalance);
  $('giftOk').addEventListener('click', function () { coinSound(); closeGift(); });
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
