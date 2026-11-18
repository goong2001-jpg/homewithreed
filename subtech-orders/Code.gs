/**
 * 써브텍 주문앱 — 서버 (Google Apps Script 웹앱)
 * 재고 스프레드시트를 같이 쓰되 "주문…" 탭만 만들고 고친다.
 *   · 품목마스터 = 읽기만   · 거래로그·위치도 등 재고앱 탭 = 절대 건드리지 않음
 * 화면(Index.html)은 api(pin, fn, arg) 하나만 부른다.
 */
var APP_VERSION = 'v2';
var SS_ID = '1ZsMIBsYPHO5bPx0tuvyx15OPq9ljmZ_vY-1C_jF4LiI';
var TZ = 'Asia/Seoul';
var T = { ORD: '주문', CUST: '주문_거래처', HIST: '주문_송장기록', SET: '주문_설정', RPT: '주문_출하기록', DEL: '주문_삭제기록' };
var OWN = [T.ORD, T.CUST, T.HIST, T.SET, T.RPT, T.DEL];
var DH = ['삭제일시', '주문ID', '거래처', '품목', '내용'];   // 삭제기록: 내용 = 주문 줄 전체(JSON). 30일 지나면 지움
var KEEP_DAYS = 30;   // 이 앱이 쓰는 탭 (이 밖의 탭엔 쓰지 않는다)

// 주문 탭 열 (순서 바꾸지 말 것 — 뒤에 덧붙이기만)
var OH = ['주문ID', '접수일시', '상태', '출고예정', '거래처', '품목', '적요', '받는분', '전화', '전화2', '주소', '배송방법', '운송', '운임구분', '청구',
  '영업소', '보내는분', '보내는분전화', '보내는분주소', '배송메시지', '박스', '송장출력일시', '출고일', '거래명세서', '계산서', '올린사람', '원문', '품목JSON', '재고차감', '수정일시', '운송방식', '원주문'];
var OK_ = ['id', 'at', 'st', 'due', 'cust', 'itemsText', 'memo', 'recv', 'phone', 'phone2', 'addr', 'ship', 'carrier', 'pay', 'claim',
  'branch', 'sender', 'senderPhone', 'senderAddr', 'msg', 'box', 'printed', 'shipped', 'stmt', 'tax', 'who', 'raw', 'items', 'stock', 'upd', 'mode', 'parent'];
var CH = ['거래처명', '전화', '전화2', '주소', '경동영업소', '대신영업소', '기본배송', '보내는분', '보내는분전화', '보내는분주소', '거래명세서', '계산서', '메모', '수정일시'];
var CK_ = ['name', 'phone', 'phone2', 'addr', 'kd', 'ds', 'ship', 'sender', 'senderPhone', 'senderAddr', 'stmt', 'tax', 'memo', 'upd'];
var HH = ['일자', '운송', '받는분', '품목', '박스수', '박스타입', '운임', '출처'];
var DEF_SET = [['암호', '', '비워 두면 주소만 알면 누구나 열림. 값을 넣으면 앱을 열 때 이 암호를 물어봄'],
  ['보내는분', '써브텍', '송장 보내는분 기본값'], ['보내는분전화', '02-3141-5204', ''], ['보내는분주소', '경기도 포천시 소흘읍 호국로 217-25 (A동), 3층', '']];

function doGet() {
  var t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate().setTitle('써브텍 주문').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function inc(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/* ---------- 공통 ---------- */
function ss_() { return SpreadsheetApp.openById(SS_ID); }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function str_(v) { if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss').replace(/ 00:00:00$/, ''); return v == null ? '' : String(v); }
function sheet_(name, head) {
  if (OWN.indexOf(name) < 0) throw new Error('이 앱이 쓰는 탭이 아닙니다: ' + name);
  var ss = ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name, ss.getSheets().length); sh.getRange(1, 1, 1, head.length).setValues([head]); sh.getRange(1, 1, sh.getMaxRows(), Math.max(head.length, sh.getMaxColumns())).setNumberFormat('@'); sh.setFrozenRows(1);
    if (name === T.SET) sh.getRange(2, 1, DEF_SET.length, 3).setValues(DEF_SET); }
  else if (sh.getLastColumn() < head.length) sh.getRange(1, 1, 1, head.length).setValues([head]);   // 새 열이 생겼으면 머리줄만 보충
  return sh;
}
function rows_(sh, ncol) { var n = sh.getLastRow(); return n < 2 ? [] : sh.getRange(2, 1, n - 1, ncol).getValues(); }
function lock_(fn) { var l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function settings_() { var o = {}; rows_(sheet_(T.SET, ['항목', '값', '설명']), 2).forEach(function (r) { if (r[0]) o[str_(r[0])] = str_(r[1]); }); return o; }

/* ---------- 주문 ↔ 시트 줄 ---------- */
function itemsText_(items) { return (items || []).map(function (i) { return i.name + (i.sensor ? ' ' + i.sensor : '') + (i.qty === '' || i.qty == null ? '' : ' ' + i.qty + (i.unit || '')) + (i.note ? ' (' + i.note + ')' : ''); }).join(' / '); }
function toRow_(o) {
  return OK_.map(function (k) {
    if (k === 'itemsText') return itemsText_(o.items);
    if (k === 'items' || k === 'box') return JSON.stringify(o[k] || []);
    if (k === 'claim') return o.claim ? 'O' : '';
    return o[k] == null ? '' : String(o[k]);
  });
}
function fromRow_(r) {
  var o = {};
  OK_.forEach(function (k, i) {
    var v = str_(r[i]);
    if (k === 'itemsText') return;
    if (k === 'items' || k === 'box') { try { o[k] = v ? JSON.parse(v) : []; } catch (e) { o[k] = []; } return; }
    if (k === 'claim') { o.claim = v === 'O'; return; }
    o[k] = v;
  });
  return o;
}
function allOrders_() { return rows_(sheet_(T.ORD, OH), OH.length).filter(function (r) { return r[0]; }).map(fromRow_); }
function recent_(list) {   // 화면에 보낼 주문: 대기 전부 + 최근 21일 안에 끝난 것
  var d = new Date(); d.setDate(d.getDate() - 21); var cut = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return list.filter(function (o) { return o.st === '대기' || (o.shipped || o.upd || o.at).slice(0, 10) >= cut; });
}

/* ---------- 화면이 부르는 단 하나의 입구 ---------- */
function api(pin, fn, arg) {
  var set = settings_();
  if (set['암호'] && String(pin || '') !== set['암호']) return { needPin: true, version: APP_VERSION };
  if (!API.hasOwnProperty(fn)) throw new Error('없는 기능: ' + fn);
  return API[fn](arg || {}, set);
}
var API = {
  boot: function (a, set) {
    var items = [];
    try { var m = ss_().getSheetByName('품목마스터'); if (m && m.getLastRow() > 1) { var seen = {}; m.getRange(2, 1, m.getLastRow() - 1, 3).getValues().forEach(function (r) { var n = str_(r[1]); if (n && !seen[n]) { seen[n] = 1; items.push(n); } }); } } catch (e) {}
    return { version: APP_VERSION, today: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), orders: recent_(allOrders_()), custs: custs_(), items: items,
      sender: { name: set['보내는분'] || '써브텍', phone: set['보내는분전화'] || '', addr: set['보내는분주소'] || '' }, histCount: Math.max(0, sheet_(T.HIST, HH).getLastRow() - 1) };
  },

  // 주문 저장: id 없으면 새로, 있으면 그 줄을 고침. {orders:[…]} → {orders:[저장된 것]}
  saveOrders: function (a) {
    var list = a.orders || []; if (!list.length) throw new Error('저장할 주문이 없습니다');
    return lock_(function () {
      var sh = sheet_(T.ORD, OH), n = sh.getLastRow(), ids = n < 2 ? [] : sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return str_(r[0]); }), used = ids.concat(deletedIds_());
      var stamp = now_(), base = Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss'), add = [], out = [];
      list.forEach(function (o, i) {
        if (!o.items || !o.items.length) throw new Error('품목이 없는 주문이 있습니다' + (o.cust ? ': ' + o.cust : ''));
        o.upd = stamp;
        if (o.id) { var k = ids.indexOf(o.id); if (k < 0) throw new Error('주문을 찾을 수 없습니다: ' + o.id); sh.getRange(k + 2, 1, 1, OH.length).setValues([toRow_(o)]); }
        else { var j = 1; while (used.indexOf('O' + base + '-' + j) >= 0) j++; o.id = 'O' + base + '-' + j; used.push(o.id); o.at = o.at || stamp; o.st = o.st || '대기'; add.push(toRow_(o)); }   // 같은 초에 저장해도 ID가 겹치지 않게
        out.push(o);
      });
      if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, OH.length).setValues(add);
      learn_(out);
      return { orders: out, custs: custs_() };
    });
  },

  // 상태 바꾸기: {ids, st:'대기'|'출고완료'|'취소', shipped:'yyyy-MM-dd'}
  setStatus: function (a) {
    if (['대기', '출고완료', '취소'].indexOf(a.st) < 0) throw new Error('상태가 올바르지 않습니다');
    return lock_(function () { return { orders: patch_(a.ids, function (o) { o.st = a.st; o.shipped = a.st === '출고완료' ? (a.shipped || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')) : ''; }) }; });
  },

  // 송장 엑셀을 뽑았다고 표시 + 박스·운임을 송장기록에 남김(다음 추천에 씀). {ids, hist:[[일자,운송,받는분,품목,박스수,박스타입,운임]]}
  markPrinted: function (a) {
    return lock_(function () {
      var stamp = now_(), out = patch_(a.ids, function (o) { o.printed = a.undo ? '' : stamp; if (a.box && a.box[o.id]) o.box = a.box[o.id]; });
      if (!a.undo && a.hist && a.hist.length) { var h = sheet_(T.HIST, HH); h.getRange(h.getLastRow() + 1, 1, a.hist.length, HH.length).setValues(a.hist.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], r[5], r[6] || '', '앱']; })); }
      return { orders: out };
    });
  },

  // 하루 마감(출하서): 나간 주문을 출고완료로, 그날 나간 것·남은 것을 출하기록에 남김. {date, shippedIds}
  closeDay: function (a) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) throw new Error('날짜가 올바르지 않습니다');
    return lock_(function () {
      var changed = (a.shippedIds && a.shippedIds.length) ? patch_(a.shippedIds, function (o) { o.st = '출고완료'; o.shipped = a.date; }) : [];
      var all = allOrders_(), slim = function (o) { var own = !!o.recv || !!o.sender || (!!o.addr && nz_(o.raw).indexOf(nz_(o.addr).slice(0, 8)) >= 0);   // 받는분·주소가 주문에 따로 적힌 건만 출하서 '받는분' 칸에
        return { id: o.id, due: o.due, cust: o.cust, items: o.items, memo: o.memo, recv: o.recv, phone: own ? o.phone : '', addr: own ? o.addr : '', branch: o.branch, ship: o.ship, stmt: o.stmt, tax: o.tax }; };
      var snap = { date: a.date, made: now_(), shipped: all.filter(function (o) { return o.st === '출고완료' && o.shipped === a.date; }).map(slim), pending: all.filter(function (o) { return o.st === '대기'; }).map(slim) };
      var js = JSON.stringify(snap), parts = [a.date, snap.made, snap.shipped.length, snap.pending.length];
      for (var i = 0; i < js.length; i += 40000) parts.push(js.slice(i, i + 40000));
      var sh = sheet_(T.RPT, ['날짜', '만든시각', '출고건수', '대기건수', '내용']), n = sh.getLastRow(), row = n + 1;
      if (n > 1) { var ds = sh.getRange(2, 1, n - 1, 1).getValues(); for (var k = 0; k < ds.length; k++) if (str_(ds[k][0]).slice(0, 10) === a.date) { row = k + 2; sh.getRange(row, 1, 1, sh.getLastColumn()).clearContent(); break; } }
      sh.getRange(row, 1, 1, parts.length).setValues([parts]);
      return { orders: changed, report: snap };
    });
  },
  reports: function () { return { list: rows_(sheet_(T.RPT, ['날짜', '만든시각', '출고건수', '대기건수', '내용']), 4).filter(function (r) { return r[0]; }).map(function (r) { return { date: str_(r[0]).slice(0, 10), made: str_(r[1]), shipped: +r[2] || 0, pending: +r[3] || 0 }; }).reverse().slice(0, 60) }; },
  report: function (a) {
    var sh = sheet_(T.RPT, ['날짜', '만든시각', '출고건수', '대기건수', '내용']), n = sh.getLastRow(); if (n < 2) throw new Error('출하 기록이 없습니다');
    var v = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < v.length; i++) if (str_(v[i][0]).slice(0, 10) === a.date) return { report: JSON.parse(v[i].slice(4).map(str_).join('')) };
    throw new Error('그 날짜의 출하 기록이 없습니다');
  },

  // 출고 기록 (일부 출고·날짜): {id, date, lines:[{k:품목번호, qty:실제 출고, why:사유}], rest:'keep'|'drop'}
  //  · 주문 줄은 '나간 만큼'으로 바뀌고 출고완료(출고일=date). 품목마다 ord(주문 수량)·why(사유)를 남김 → 출하서 적요
  //  · 덜 나간 수량은 rest='keep' 이면 잔량 주문(대기, 원주문=id)으로 새로 만듦, 'drop' 이면 안 만듦
  shipOrder: function (a) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) throw new Error('출고 날짜가 올바르지 않습니다');
    return lock_(function () {
      var sh = sheet_(T.ORD, OH), n = sh.getLastRow(), v = n < 2 ? [] : sh.getRange(2, 1, n - 1, OH.length).getValues(), k = -1, ids = {};
      v.forEach(function (r, i) { var id = str_(r[0]); ids[id] = 1; if (id === a.id) k = i; }); deletedIds_().forEach(function (id) { ids[id] = 1; });
      if (k < 0) throw new Error('주문을 찾을 수 없습니다: ' + a.id);
      var o = fromRow_(v[k]); if (o.st !== '대기') throw new Error('대기 중인 주문만 출고할 수 있습니다 (지금: ' + o.st + ')');
      var lines = a.lines || [], shipped = [], rest = [], stamp = now_();
      o.items.forEach(function (it, i) {
        var L = lines.filter(function (x) { return +x.k === i; })[0], full = it.qty === '' || it.qty == null ? null : +it.qty;
        var q = L ? L.qty : full; q = q === '' || q == null ? full : +q;
        if (q != null && (!isFinite(q) || q < 0)) throw new Error('출고 수량이 올바르지 않습니다: ' + it.name);
        if (full != null && q > full) throw new Error(it.name + ': 주문(' + full + ')보다 많이 출고할 수 없습니다');
        var why = L && L.why ? String(L.why) : '';
        if (full != null && q < full) {
          if (q > 0) shipped.push(Object.assign({}, it, { qty: q, ord: it.ord || full, why: why }));
          var rr = Object.assign({}, it, { qty: full - q }); delete rr.ord; delete rr.why; rest.push(rr);
        } else shipped.push(Object.assign({}, it, why ? { why: why } : {}));
        if (full != null && q < full && !why) throw new Error(it.name + ': 덜 나간 사유를 골라주세요');
      });
      if (!shipped.length) throw new Error('나간 품목이 없습니다. 하나도 안 나갔으면 출고하지 말고 대기로 두세요');
      var out = [], whyAll = shipped.filter(function (x) { return x.why; }).map(function (x) { return x.why; });
      o.items = shipped; o.st = '출고완료'; o.shipped = a.date; o.upd = stamp;
      sh.getRange(k + 2, 1, 1, OH.length).setValues([toRow_(o)]); out.push(o);
      if (rest.length && a.rest !== 'drop') {
        var r = JSON.parse(JSON.stringify(o)), base = String(o.parent || o.id).replace(/-r\d+$/, ''), j = 1;
        while (ids[base + '-r' + j]) j++;
        r.id = base + '-r' + j; r.parent = o.parent || o.id; r.items = rest; r.st = '대기'; r.shipped = ''; r.printed = ''; r.box = [];
        r.due = '준비되면'; r.memo = ['잔량' + (whyAll.length ? ' (' + uniq_(whyAll).join(', ') + ')' : ''), o.memo].filter(Boolean).join(' / '); r.upd = stamp;
        sh.getRange(sh.getLastRow() + 1, 1, 1, OH.length).setValues([toRow_(r)]); out.push(r);
      }
      return { orders: out };
    });
  },

  // 삭제: 주문 줄을 지우고 삭제기록 탭에 30일 보관 (되살리기 가능). {ids}
  deleteOrders: function (a) {
    if (!a.ids || !a.ids.length) throw new Error('지울 주문을 고르세요');
    return lock_(function () {
      var sh = sheet_(T.ORD, OH), n = sh.getLastRow(), v = n < 2 ? [] : sh.getRange(2, 1, n - 1, OH.length).getValues(), at = {}, stamp = now_();
      v.forEach(function (r, i) { at[str_(r[0])] = i; });
      a.ids.forEach(function (id) { if (!(id in at)) throw new Error('주문을 찾을 수 없습니다: ' + id); });
      var d = sheet_(T.DEL, DH), add = a.ids.map(function (id) { var r = v[at[id]].map(str_), o = fromRow_(v[at[id]]); return [stamp, id, o.cust, itemsText_(o.items), JSON.stringify(r)]; });
      d.getRange(d.getLastRow() + 1, 1, add.length, DH.length).setValues(add);
      a.ids.map(function (id) { return at[id] + 2; }).sort(function (x, y) { return y - x; }).forEach(function (row) { sh.deleteRow(row); });
      purgeDeleted_();
      return { deleted: a.ids };
    });
  },
  deletedList: function () {
    return lock_(function () { purgeDeleted_(); return { list: rows_(sheet_(T.DEL, DH), 4).map(function (r, i) { return { row: i + 2, at: str_(r[0]), id: str_(r[1]), cust: str_(r[2]), items: str_(r[3]) }; }).reverse() }; });
  },
  restoreOrders: function (a) {   // {ids} → 주문 탭에 다시 넣고 삭제기록에서 뺌
    return lock_(function () {
      var d = sheet_(T.DEL, DH), v = rows_(d, DH.length), sh = sheet_(T.ORD, OH), n = sh.getLastRow(), have = {}, out = [], rm = [];
      (n < 2 ? [] : sh.getRange(2, 1, n - 1, 1).getValues()).forEach(function (r) { have[str_(r[0])] = 1; });
      v.forEach(function (r, i) {
        var id = str_(r[1]); if ((a.ids || []).indexOf(id) < 0) return;
        var row = JSON.parse(str_(r[4])); while (row.length < OH.length) row.push(''); row = row.slice(0, OH.length);
        if (have[id]) { var j = 1; while (have[id + '-b' + j]) j++; id = id + '-b' + j; row[0] = id; }   // 같은 ID가 이미 있으면 새 ID로 되살림
        sh.getRange(sh.getLastRow() + 1, 1, 1, OH.length).setValues([row]); have[id] = 1; out.push(fromRow_(row));
        rm.push(i + 2);
      });
      if (!rm.length) throw new Error('되살릴 주문을 찾을 수 없습니다');
      rm.sort(function (x, y) { return y - x; }).forEach(function (row) { d.deleteRow(row); });
      return { orders: out };
    });
  },

  /* ----- 거래처 주소록 ----- */
  custSave: function (a) {   // {row(시트 줄 번호, 없으면 새로), cust:{…}}
    var c = a.cust || {}; if (!String(c.name || '').trim()) throw new Error('거래처 이름을 넣어주세요');
    return lock_(function () { var sh = sheet_(T.CUST, CH); c.upd = now_(); var r = a.row >= 2 && a.row <= sh.getLastRow() ? a.row : sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, CH.length).setValues([CK_.map(function (k) { return c[k] == null ? '' : String(c[k]); })]); return { custs: custs_() }; });
  },
  // 엑셀에서 읽은 주소록 가져오기: 이름+주소가 같은 줄은 건너뛰고, 영업소만 있는 줄은 같은 이름에 채움
  custImport: function (a) {
    return lock_(function () {
      var sh = sheet_(T.CUST, CH), cur = rows_(sh, CH.length), key = function (n, ad) { return nz_(n) + '|' + nz_(ad); }, seen = {}, byName = {}, add = [], fill = 0;
      cur.forEach(function (r, i) { seen[key(r[0], r[3])] = 1; (byName[nz_(r[0])] = byName[nz_(r[0])] || []).push(i); });
      (a.rows || []).forEach(function (c) {
        var nm = String(c.name || '').trim(); if (!nm) return; var idx = byName[nz_(nm)];
        if (!c.addr && (c.kd || c.ds)) {   // 영업소만
          if (idx) { idx.forEach(function (i) { if (c.kd && !cur[i][4]) { cur[i][4] = c.kd; fill++; } if (c.ds && !cur[i][5]) { cur[i][5] = c.ds; fill++; } }); return; }
        } else if (seen[key(nm, c.addr)]) { if (idx) idx.forEach(function (i) { if (c.kd && !cur[i][4]) { cur[i][4] = c.kd; fill++; } if (c.ds && !cur[i][5]) { cur[i][5] = c.ds; fill++; } if (c.phone && !cur[i][1]) { cur[i][1] = c.phone; fill++; } }); return; }
        seen[key(nm, c.addr)] = 1; var row = CK_.map(function (k) { return c[k] == null ? '' : String(c[k]); }); row[13] = now_();
        cur.push(row); (byName[nz_(nm)] = byName[nz_(nm)] || []).push(cur.length - 1); add.push(row);
      });
      if (cur.length) sh.getRange(2, 1, cur.length, CH.length).setValues(cur.map(function (r) { return r.map(str_); }));
      return { added: add.length, filled: fill, custs: custs_() };
    });
  },

  /* ----- 송장 기록 (박스 추천용) ----- */
  histImport: function (a) {   // {rows:[[일자,운송,받는분,품목,박스수,박스타입,운임]]} — 이미 있는 줄은 건너뜀
    return lock_(function () {
      var sh = sheet_(T.HIST, HH), seen = {}, add = [], k = function (r) { return [str_(r[0]), r[1], r[2], r[3], r[4], r[5]].join('|'); };
      rows_(sh, HH.length).forEach(function (r) { seen[k(r)] = 1; });
      (a.rows || []).forEach(function (r) { if (!r[3] || seen[k(r)]) return; seen[k(r)] = 1; add.push([r[0] || '', r[1], r[2] || '', r[3], r[4] || '', r[5] || '', r[6] || '', '가져오기']); });
      if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, HH.length).setValues(add);
      return { added: add.length, total: sh.getLastRow() - 1 };
    });
  },
  recData: function () {   // 추천 계산용: [운송, 받는분, 품목, 박스수, 박스타입, 운임] 최근 8000줄
    var r = rows_(sheet_(T.HIST, HH), HH.length); if (r.length > 8000) r = r.slice(r.length - 8000);
    return { hist: r.map(function (x) { return [str_(x[1]), str_(x[2]), str_(x[3]), +x[4] || 0, str_(x[5]), +x[6] || 0]; }) };
  },
  setPin: function (a) {   // 암호 켜기/바꾸기/끄기 (지금 암호를 알고 들어온 사람만 여기까지 옴)
    return lock_(function () { var sh = sheet_(T.SET, ['항목', '값', '설명']), v = rows_(sh, 1); for (var i = 0; i < v.length; i++) if (str_(v[i][0]) === '암호') { sh.getRange(i + 2, 2).setValue(String(a.pin || '')); return { ok: true }; }
      sh.appendRow(['암호', String(a.pin || ''), '']); return { ok: true }; });
  }
};

function uniq_(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }
function deletedIds_() { return rows_(sheet_(T.DEL, DH), 2).map(function (r) { return str_(r[1]); }); }
function purgeDeleted_() {   // 삭제기록에서 30일 지난 줄 지우기
  var d = sheet_(T.DEL, DH), v = rows_(d, 1), cut = new Date(); cut.setDate(cut.getDate() - KEEP_DAYS);
  var c = Utilities.formatDate(cut, TZ, 'yyyy-MM-dd');
  for (var i = v.length - 1; i >= 0; i--) if (str_(v[i][0]).slice(0, 10) < c) d.deleteRow(i + 2);
}
function nz_(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^0-9a-z가-힣]/g, ''); }
function custs_() { return rows_(sheet_(T.CUST, CH), CH.length).map(function (r, i) { var o = { row: i + 2 }; CK_.forEach(function (k, j) { o[k] = str_(r[j]); }); return o; }).filter(function (o) { return o.name; }); }
function patch_(ids, fn) {   // 주문 여러 건을 id 로 찾아 고침 (없는 id 가 하나라도 있으면 아무것도 안 바꿈)
  if (!ids || !ids.length) throw new Error('주문을 고르세요');
  var sh = sheet_(T.ORD, OH), n = sh.getLastRow(), v = n < 2 ? [] : sh.getRange(2, 1, n - 1, OH.length).getValues(), map = {}, stamp = now_(), out = [];
  v.forEach(function (r, i) { map[str_(r[0])] = i; });
  ids.forEach(function (id) { if (!(id in map)) throw new Error('주문을 찾을 수 없습니다: ' + id); });
  ids.forEach(function (id) { var o = fromRow_(v[map[id]]); fn(o); o.upd = stamp; sh.getRange(map[id] + 2, 1, 1, OH.length).setValues([toRow_(o)]); out.push(o); });
  return out;
}
// 거래처별 기본값 기억: 배송방법·보내는분·영업소·명세서/계산서 (주소는 자동으로 바꾸지 않는다 — 직송 주소가 섞이지 않게)
function learn_(orders) {
  var sh = sheet_(T.CUST, CH), cur = rows_(sh, CH.length), idx = {}, dirty = false;
  cur.forEach(function (r, i) { var k = nz_(r[0]); if (!(k in idx)) idx[k] = i; });
  orders.forEach(function (o) {
    var k = nz_(o.cust); if (!k) return; var i = idx[k];
    if (i == null) { var row = CK_.map(function () { return ''; }); row[0] = o.cust; cur.push(row); i = idx[k] = cur.length - 1; dirty = true; }
    var r = cur[i], set = function (c, v) { if (v && str_(r[c]) !== String(v)) { r[c] = String(v); dirty = true; } };
    set(6, o.ship); set(7, o.sender); set(8, o.senderPhone); set(9, o.senderAddr); set(10, o.stmt); set(11, o.tax);
    if (o.carrier === '경동') set(4, o.branch); if (o.carrier === '대신') set(5, o.branch);
  });
  if (dirty) sh.getRange(2, 1, cur.length, CH.length).setValues(cur.map(function (r) { return r.map(str_); }));
}
