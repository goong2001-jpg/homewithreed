/**
 * 써브텍 재고관리 시스템 (Google Apps Script)
 * - 새 스프레드시트에 컨테이너 바인딩으로 붙여서 사용합니다.
 * - 초기 설정으로 기존 써브텍 재고 + 업체 사양표를 한 번 가져옵니다(연동).
 * - 입출고는 거래로그에 누적, 현재고는 자동 합산.
 * - 메모(업체 사양), 조립 가능 수량(BOM), 월별 입출고 리포트 포함.
 */

var APP_VERSION = 'v8'; // 업데이트 확인용 버전 (Index.html의 HTML_VERSION과 짝)

var OLD_SHEET_ID = '1yju8vEskIH0_SJvqhoe4-OGLD3SVm4T-wfiimOOY6VE';
var OLD_TAB_NAME = '전체(수정중)';

var TAB_MASTER   = '품목마스터';
var TAB_LOG      = '거래로그';
var TAB_STOCK    = '현재고';
var TAB_CONFIG   = '설정';
var TAB_LOCATION = '위치';
var TAB_MEMO     = '메모';
var TAB_BOM      = 'BOM';
var TAB_REPORT   = '월별리포트';

var DEFAULT_LOCATIONS = ['A동1층', 'A동2층', 'A동3층', 'B동1층', 'B동2층'];

// 메모: 1일시 2업체 3명판 4상호스티커 5날짜스티커 6전용케이스 7프로그램 8프로그램명
//       9비고 10상호스티커사진 11명판사진 12날짜스티커사진 13추가사진 14작성자
var MEMO_HEADERS = ['일시', '업체', '명판', '상호스티커', '날짜스티커', '전용케이스', '프로그램', '프로그램명',
                    '비고', '상호스티커사진', '명판사진', '날짜스티커사진', '추가사진', '작성자'];

// ---------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📦 재고관리')
    .addItem('① 초기 설정 (탭/구조 생성)', 'setup')
    .addItem('🧹 전체 재고 0으로 초기화', 'resetStock')
    .addSeparator()
    .addItem('(선택) 기존 써브텍에서 한 번 가져오기', 'importFromOld')
    .addItem('웹앱(폰 화면) 주소 보기', 'showUrl')
    .addToUi();
}
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('써브텍 재고')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}
function showUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url ? '폰 화면 주소:\n\n' + url : '아직 배포되지 않았습니다. [배포 > 새 배포 > 웹 앱].');
}

// ---------------------------------------------------------------------------
function setup() {
  var ss = SpreadsheetApp.getActive();
  var master = getOrCreateSheet_(ss, TAB_MASTER);
  var log    = getOrCreateSheet_(ss, TAB_LOG);
  var stock  = getOrCreateSheet_(ss, TAB_STOCK);
  var config = getOrCreateSheet_(ss, TAB_CONFIG);
  var locSh  = getOrCreateSheet_(ss, TAB_LOCATION);
  var memo   = getOrCreateSheet_(ss, TAB_MEMO);
  var bom    = getOrCreateSheet_(ss, TAB_BOM);
  var report = getOrCreateSheet_(ss, TAB_REPORT);

  setHeaders_(master, ['품목ID', '품명', '분류', '기본박스입수', '안전재고', '비고']);
  log.getRange(1, 1, 1, 13).setValues([['일시', '품목ID', '품명', '분류', '위치', '구분', '박스수', '박스당수량', '총개수', '증감수량', '담당자', '메모', '사진']]).setFontWeight('bold');
  log.setFrozenRows(1);
  setHeaders_(config, ['담당자']);
  setHeaders_(locSh,  ['위치']);
  memo.getRange(1, 1, 1, MEMO_HEADERS.length).setValues([MEMO_HEADERS]).setFontWeight('bold'); // 항상 최신 헤더
  memo.setFrozenRows(1);
  setHeaders_(bom, ['완제품품명', '완제품분류', '부품품명', '부품분류', '소요수량']);
  bom.getRange('A1').setNote('완제품 1개를 만드는 데 필요한 부품을 한 줄씩 적으세요.\n예) STT1.3 | 완포 | STT1.3 | 기판 | 1');

  if (config.getLastRow() < 2) config.getRange(2, 1, 3, 1).setValues([['김반장'], ['이사원'], ['관리자']]);
  // 위치: 기본 위치(A동1층 등)로 정리. 이후 위치 탭을 직접 수정하면 앱에 바로 반영됩니다.
  if (locSh.getLastRow() > 1) locSh.getRange(2, 1, locSh.getLastRow() - 1, 1).clearContent();
  locSh.getRange(2, 1, DEFAULT_LOCATIONS.length, 1).setValues(DEFAULT_LOCATIONS.map(function (x) { return [x]; }));

  // ※ 재고 가져오기는 더 이상 자동으로 하지 않습니다(재실행 시 재고가 꼬이는 것 방지).
  //    기존 써브텍에서 가져오려면 메뉴의 "(선택) 기존 써브텍에서 한 번 가져오기"를 사용하세요.
  buildStockView_(stock);
  buildMonthlyView_(report);
  getMemoFolder_();
  cleanupDefaultSheet_(ss);

  SpreadsheetApp.getUi().alert('초기 설정 완료! (탭/구조 생성)\n' +
    '재고는 그대로 두었습니다. 이 메뉴는 재실행해도 재고를 건드리지 않습니다.\n\n' +
    '· 재고를 모두 0으로 비우려면: "🧹 전체 재고 0으로 초기화"\n' +
    '· 코드를 새로 붙여넣었다면: [배포 > 배포 관리 > 수정 > 새 버전 > 배포]');
}

/** (선택) 기존 써브텍에서 재고+업체사양을 1회 가져오기 */
function importFromOld() {
  var ss = SpreadsheetApp.getActive(), ui = SpreadsheetApp.getUi();
  var resp = ui.alert('기존 써브텍에서 가져오기',
    '기존 써브텍의 현재 재고와 업체 사양표를 가져옵니다.\n' +
    '(이미 입력한 입출고 기록은 유지되고, 기초재고만 다시 맞춥니다.)\n계속할까요?', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  importInitial_(getOrCreateSheet_(ss, TAB_MASTER), getOrCreateSheet_(ss, TAB_LOG));
  importMemos_(getOrCreateSheet_(ss, TAB_MEMO));
  ui.alert('가져오기 완료!');
}

/** 전체 재고 0으로 초기화: 거래로그를 비움 (품목 목록·메모·BOM은 유지) */
function resetStock() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.alert('전체 재고 0으로 초기화',
    '거래로그를 모두 비워 모든 품목의 재고를 0으로 만듭니다.\n' +
    '품목 목록·메모·BOM·위치는 그대로 유지됩니다.\n\n계속할까요?', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  if (log && log.getLastRow() > 1) log.deleteRows(2, log.getLastRow() - 1);
  ui.alert('완료! 모든 재고가 0이 되었습니다.\n이제 입출고 화면에서 입고로 다시 입력하세요.');
}

function importInitial_(master, log) {
  var old = SpreadsheetApp.openById(OLD_SHEET_ID).getSheetByName(OLD_TAB_NAME);
  if (!old) throw new Error('기존 써브텍에서 "' + OLD_TAB_NAME + '" 탭을 찾을 수 없습니다.');
  var vals = old.getDataRange().getValues();
  var hRow = -1, idx = {};
  for (var r = 0; r < Math.min(6, vals.length); r++) {
    var row = vals[r].map(function (x) { return ('' + x).trim(); });
    if (row.indexOf('품명') >= 0 && row.indexOf('분류') >= 0) { hRow = r; row.forEach(function (h, i) { if (h) idx[h] = i; }); break; }
  }
  if (hRow < 0) throw new Error('기존 시트에서 "품명/분류" 헤더를 찾지 못했습니다.');
  var cName = idx['품명'], cCat = idx['분류'];
  var cTot = idx['총 박스수량'] != null ? idx['총 박스수량'] : idx['총박스수량'];
  var cQ1 = idx['수량'], cQ2 = idx['수량2'];
  var existing = {};
  if (master.getLastRow() > 1)
    master.getRange(2, 1, master.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) existing[r[0]] = true; });
  removeBaseRowsFromLog_(log);
  var newMasterRows = [], logRows = [], seen = {}, now = new Date();
  var LOC1 = DEFAULT_LOCATIONS[0], LOC2 = DEFAULT_LOCATIONS[1];
  for (var i = hRow + 1; i < vals.length; i++) {
    var name = ('' + vals[i][cName]).trim(), cat = cCat != null ? ('' + vals[i][cCat]).trim() : '';
    if (!name) continue;
    var id = name + '||' + cat;
    if (!existing[id] && !seen[id]) newMasterRows.push([id, name, cat, '', '', '']);
    seen[id] = true;
    var q1 = cQ1 != null ? num_(vals[i][cQ1]) : 0, q2 = cQ2 != null ? num_(vals[i][cQ2]) : 0, tot = cTot != null ? num_(vals[i][cTot]) : 0;
    if (q1 === 0 && q2 === 0 && tot > 0) q1 = tot;
    if (q1 > 0) logRows.push([now, id, name, cat, LOC1, '기초', '', '', q1, q1, '시스템', '기존재고 가져옴']);
    if (q2 > 0) logRows.push([now, id, name, cat, LOC2, '기초', '', '', q2, q2, '시스템', '기존재고 가져옴']);
  }
  if (newMasterRows.length) master.getRange(master.getLastRow() + 1, 1, newMasterRows.length, 6).setValues(newMasterRows);
  if (logRows.length) log.getRange(log.getLastRow() + 1, 1, logRows.length, 12).setValues(logRows);
}

/** 기존 써브텍의 "업체 사양표" 탭을 찾아 메모로 가져옴 (메모가 비어있을 때만) */
function importMemos_(memoSh) {
  if (memoSh.getLastRow() >= 2) return;
  var sheets = SpreadsheetApp.openById(OLD_SHEET_ID).getSheets();
  var src = null, idx = {};
  for (var s = 0; s < sheets.length; s++) {
    var h = sheets[s].getRange(1, 1, 1, sheets[s].getLastColumn() || 1).getValues()[0].map(function (x) { return ('' + x).trim(); });
    if (h.indexOf('명판유무') >= 0 && h.indexOf('상호스티커유무') >= 0) { src = sheets[s]; h.forEach(function (c, i) { if (c) idx[c] = i; }); break; }
  }
  if (!src) return;
  var v = src.getDataRange().getValues(), rows = [], now = new Date();
  for (var i = 1; i < v.length; i++) {
    var comp = ('' + v[i][idx['업체명']]).trim();
    if (!comp) continue;
    var plate = oxParse_(v[i][idx['명판유무']]), biz = oxParse_(v[i][idx['상호스티커유무']]),
        dts = oxParse_(v[i][idx['날짜스티커유무']]), prog = oxParse_(v[i][idx['프로그램유무']]);
    var caseTxt = idx['전용케이스'] != null ? ('' + v[i][idx['전용케이스']]).trim() : '';
    var memoTxt = idx['비고(메모)'] != null ? ('' + v[i][idx['비고(메모)']]).trim() : '';
    var notes = [];
    if (plate[1]) notes.push('명판: ' + plate[1]);
    if (biz[1]) notes.push('상호스티커: ' + biz[1]);
    if (caseTxt) notes.push('전용케이스: ' + caseTxt);
    if (prog[1]) notes.push('프로그램: ' + prog[1]);
    if (memoTxt) notes.push(memoTxt);
    rows.push([now, comp, plate[0], biz[0], dts[0], caseTxt ? 'O' : '', prog[0], '', notes.join(' / '), '', '', '', '', '시스템']);
  }
  if (rows.length) memoSh.getRange(memoSh.getLastRow() + 1, 1, rows.length, 14).setValues(rows);
}

function removeBaseRowsFromLog_(log) {
  if (log.getLastRow() < 2) return;
  var v = log.getRange(2, 1, log.getLastRow() - 1, 12).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (v[i][5] === '기초') log.deleteRow(i + 2);
}
function buildStockView_(stock) {
  stock.clear();
  stock.getRange(1, 1, 1, 4).setValues([['품명', '분류', '위치', '현재수량']]).setFontWeight('bold');
  stock.getRange('A2').setFormula("=QUERY(거래로그!A2:L, \"select C, D, E, sum(J) where C is not null group by C, D, E order by D, C label sum(J) ''\", 0)");
  stock.setFrozenRows(1);
}
function buildMonthlyView_(sh) {
  sh.clear();
  sh.getRange(1, 1, 1, 4).setValues([['연', '월', '구분', '합계']]).setFontWeight('bold');
  sh.getRange('A2').setFormula("=QUERY(거래로그!A2:L, \"select year(A), month(A), F, sum(I) where F='입고' or F='출고' group by year(A), month(A), F order by year(A), month(A), F label sum(I) ''\", 0)");
  sh.setFrozenRows(1);
}

// ---------------------------------------------------------------------------
// 재고
// ---------------------------------------------------------------------------
function bootstrap() {
  var ss = SpreadsheetApp.getActive();
  var m = ss.getSheetByName(TAB_MASTER), cf = ss.getSheetByName(TAB_CONFIG);
  var stock = computeStock_();
  var items = [];
  if (m && m.getLastRow() >= 2)
    m.getRange(2, 1, m.getLastRow() - 1, 5).getValues().forEach(function (r) {
      if (!r[0]) return;
      var s = stock[r[0]] || { total: 0, boxes: 0, locs: {} };
      items.push({ id: r[0], name: r[1], cat: r[2], unit: r[3], safe: Number(r[4]) || 0, total: s.total, boxes: s.boxes || 0, locs: s.locs });
    });
  var staff = [];
  if (cf && cf.getLastRow() >= 2) cf.getRange(2, 1, cf.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) staff.push('' + r[0]); });
  var locs = [];
  var locSh = ss.getSheetByName(TAB_LOCATION);
  if (locSh && locSh.getLastRow() >= 2) locSh.getRange(2, 1, locSh.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) locs.push('' + r[0]); });
  // 옛 기본 위치 목록이 남아있으면 자동으로 새 목록으로 교체 (초기 설정 없이도 반영)
  var OLD_SETS = ['1층,2층,A동,B동,창고', 'A동1층,A동2층,A동3층,B동1층,창고'];
  if (!locs.length || OLD_SETS.indexOf(locs.join(',')) >= 0) {
    locs = DEFAULT_LOCATIONS.slice();
    if (locSh) {
      if (locSh.getLastRow() > 1) locSh.getRange(2, 1, locSh.getLastRow() - 1, 1).clearContent();
      locSh.getRange(2, 1, locs.length, 1).setValues(locs.map(function (x) { return [x]; }));
    }
  }
  return { items: items, staff: staff, locations: locs, version: APP_VERSION };
}
function computeStock_() {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG), map = {};
  if (!log || log.getLastRow() < 2) return map;
  log.getRange(2, 1, log.getLastRow() - 1, 12).getValues().forEach(function (r) {
    var id = r[1]; if (!id) return;
    var loc = r[4] || '기타', d = Number(r[9]) || 0, box = (Number(r[6]) || 0) * (d >= 0 ? 1 : -1);
    if (!map[id]) map[id] = { total: 0, boxes: 0, locs: {} };
    map[id].total += d; map[id].boxes += box; map[id].locs[loc] = (map[id].locs[loc] || 0) + d;
  });
  return map;
}
function save(payload) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var now = new Date(), sign = payload.type === '출고' ? -1 : 1, rows = [];
  var imgIds = resolveImgs_(payload.images);
  (payload.lines || []).forEach(function (ln) {
    var boxes = Number(ln.boxes) || 0, per = Number(ln.per) || 0, t = boxes * per;
    if (t <= 0) return;
    rows.push([now, payload.id, payload.name, payload.cat, payload.loc || DEFAULT_LOCATIONS[0], payload.type, boxes, per, t, sign * t, payload.staff || '', payload.memo || '', imgIds]);
  });
  if (!rows.length) throw new Error('수량을 입력하세요.');
  log.getRange(log.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
  var s = computeStock_()[payload.id] || { total: 0, locs: {} };
  return { ok: true, total: s.total, locs: s.locs };
}

/** 수량 변동 없이 사진/메모/위치만 기록 (구분=기록, 증감 0) */
function saveNote(payload) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var imgIds = resolveImgs_(payload.images);
  if (!imgIds && !payload.memo) throw new Error('사진 또는 메모를 입력하세요.');
  log.getRange(log.getLastRow() + 1, 1, 1, 13).setValues([[new Date(), payload.id, payload.name, payload.cat,
    payload.loc || DEFAULT_LOCATIONS[0], '기록', '', '', 0, 0, payload.staff || '', payload.memo || '', imgIds]]);
  var s = computeStock_()[payload.id] || { total: 0, locs: {} };
  return { ok: true, total: s.total, locs: s.locs };
}
function addItem(p) {
  var name = ('' + (p.name || '')).trim(), cat = ('' + (p.cat || '')).trim();
  if (!name) throw new Error('품명을 입력하세요.');
  var m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER), id = name + '||' + cat;
  if (m.getLastRow() > 1) { var ids = m.getRange(2, 1, m.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) throw new Error('이미 같은 품명+분류가 있습니다.'); }
  m.appendRow([id, name, cat, Number(p.unit) || '', Number(p.safe) || '', '']);
  return { id: id, name: name, cat: cat, unit: Number(p.unit) || '', safe: Number(p.safe) || 0, total: 0, locs: {} };
}
function renameItem(oldId, name, cat) {
  name = ('' + name).trim(); cat = ('' + cat).trim();
  if (!name) throw new Error('품명을 입력하세요.');
  var ss = SpreadsheetApp.getActive(), m = ss.getSheetByName(TAB_MASTER), log = ss.getSheetByName(TAB_LOG);
  var newId = name + '||' + cat, targetRow = -1;
  if (m.getLastRow() > 1) { var ids = m.getRange(2, 1, m.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) { if (ids[i][0] === oldId) targetRow = i + 2; else if (ids[i][0] === newId && newId !== oldId) throw new Error('이미 같은 품명+분류가 있습니다.'); } }
  if (targetRow < 0) throw new Error('품목을 찾을 수 없습니다.');
  m.getRange(targetRow, 1, 1, 3).setValues([[newId, name, cat]]);
  if (log.getLastRow() > 1) { var rng = log.getRange(2, 2, log.getLastRow() - 1, 3), lv = rng.getValues(), ch = false;
    for (var j = 0; j < lv.length; j++) if (lv[j][0] === oldId) { lv[j] = [newId, name, cat]; ch = true; }
    if (ch) rng.setValues(lv); }
  return { id: newId, name: name, cat: cat };
}
function deleteItem(id) {
  var ss = SpreadsheetApp.getActive(), m = ss.getSheetByName(TAB_MASTER), log = ss.getSheetByName(TAB_LOG);
  if (m.getLastRow() > 1) { var mv = m.getRange(2, 1, m.getLastRow() - 1, 1).getValues();
    for (var i = mv.length - 1; i >= 0; i--) if (mv[i][0] === id) m.deleteRow(i + 2); }
  if (log.getLastRow() > 1) { var lv = log.getRange(2, 1, log.getLastRow() - 1, 12).getValues();
    for (var j = lv.length - 1; j >= 0; j--) if (lv[j][1] === id) log.deleteRow(j + 2); }
  return { ok: true };
}
function getHistory(id) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG), out = [];
  if (!log || log.getLastRow() < 2) return out;
  var v = log.getRange(2, 1, log.getLastRow() - 1, 13).getValues();
  for (var i = v.length - 1; i >= 0 && out.length < 20; i--) {
    if (v[i][1] !== id) continue;
    out.push({ row: i + 2, date: v[i][0] ? fmtDt_(v[i][0]) : '', type: v[i][5], loc: v[i][4],
               boxes: Number(v[i][6]) || 0, delta: Number(v[i][9]) || 0, staff: v[i][10], imgs: imgList_(v[i][12]) });
  }
  return out;
}

/** 이력에서 거래 한 건 취소(삭제) → 재고 자동 원복 */
function undoTransaction(row) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var r = log.getRange(row, 1, 1, 13).getValues()[0], id = r[1];
  ('' + r[12]).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    .forEach(function (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} });
  log.deleteRow(row);
  var s = computeStock_()[id] || { total: 0, locs: {} };
  return { ok: true, id: id, total: s.total, locs: s.locs };
}

/** 재고 조정(실사): 선택 위치의 재고를 target 값으로 맞춤 (차액만 기록) */
function adjustStock(p) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var loc = p.loc || DEFAULT_LOCATIONS[0];
  var st = computeStock_()[p.id], curLoc = st ? (st.locs[loc] || 0) : 0;
  var target = Number(p.target) || 0, delta = target - curLoc;
  if (delta !== 0)
    log.getRange(log.getLastRow() + 1, 1, 1, 13).setValues([[new Date(), p.id, p.name, p.cat, loc, '조정',
      '', '', Math.abs(delta), delta, p.staff || '', p.memo || ('실사조정 ' + curLoc + '→' + target), resolveImgs_(p.images)]]);
  var s = computeStock_()[p.id] || { total: 0, locs: {} };
  return { ok: true, total: s.total, locs: s.locs };
}

// ---------------------------------------------------------------------------
// 조립 가능 수량 (BOM)
// ---------------------------------------------------------------------------
function getBuildable() {
  var ss = SpreadsheetApp.getActive(), bom = ss.getSheetByName(TAB_BOM);
  if (!bom || bom.getLastRow() < 2) return [];
  var stock = computeStock_(), rows = bom.getRange(2, 1, bom.getLastRow() - 1, 5).getValues(), fin = {};
  rows.forEach(function (r) {
    var fn = ('' + r[0]).trim(), fc = ('' + r[1]).trim(), pn = ('' + r[2]).trim(), pc = ('' + r[3]).trim(), per = Number(r[4]) || 0;
    if (!fn || !pn || per <= 0) return;
    var fid = fn + '||' + fc;
    if (!fin[fid]) fin[fid] = { name: fn, cat: fc, parts: [] };
    fin[fid].parts.push({ id: pn + '||' + pc, name: pn, cat: pc, per: per });
  });
  var out = [];
  Object.keys(fin).forEach(function (fid) {
    var f = fin[fid], buildable = Infinity, parts = [];
    f.parts.forEach(function (p) {
      var have = stock[p.id] ? stock[p.id].total : 0, can = Math.floor(have / p.per);
      if (can < buildable) buildable = can;
      parts.push({ name: p.name, cat: p.cat, per: p.per, have: have, can: can });
    });
    if (buildable === Infinity) buildable = 0;
    var bottleneck = parts.filter(function (p) { return Math.floor(p.have / p.per) === buildable; }).map(function (p) { return p.name + (p.cat ? ('(' + p.cat + ')') : ''); });
    out.push({ name: f.name, cat: f.cat, buildable: buildable, parts: parts, bottleneck: bottleneck });
  });
  out.sort(function (a, b) { return a.buildable - b.buildable; });
  return out;
}

/** 조립 레시피 저장(추가/수정): 완제품 1개당 필요한 부품 목록 */
function saveBOM(p) {
  var bom = SpreadsheetApp.getActive().getSheetByName(TAB_BOM);
  var name = ('' + (p.name || '')).trim(), cat = ('' + (p.cat || '')).trim();
  if (!name) throw new Error('완제품 품명을 입력하세요.');
  var parts = (p.parts || []).filter(function (x) { return ('' + x.name).trim() && (Number(x.per) || 0) > 0; });
  if (!parts.length) throw new Error('부품을 1개 이상 입력하세요.');
  removeBomRows_(bom, [(p.origName || '') + '||' + (p.origCat || ''), name + '||' + cat]);
  var rows = parts.map(function (x) { return [name, cat, ('' + x.name).trim(), ('' + x.cat).trim(), Number(x.per) || 1]; });
  bom.getRange(bom.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  return { ok: true };
}
function deleteBOM(name, cat) {
  var bom = SpreadsheetApp.getActive().getSheetByName(TAB_BOM);
  removeBomRows_(bom, [('' + name).trim() + '||' + ('' + cat).trim()]);
  return { ok: true };
}
function removeBomRows_(bom, ids) {
  if (!bom || bom.getLastRow() < 2) return;
  var v = bom.getRange(2, 1, bom.getLastRow() - 1, 2).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    var id = ('' + v[i][0]).trim() + '||' + ('' + v[i][1]).trim();
    if (ids.indexOf(id) >= 0) bom.deleteRow(i + 2);
  }
}

// ---------------------------------------------------------------------------
// 월별 입출고 리포트
// ---------------------------------------------------------------------------
function getMonthlyReport() {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG), map = {};
  if (!log || log.getLastRow() < 2) return [];
  log.getRange(2, 1, log.getLastRow() - 1, 9).getValues().forEach(function (r) {
    if (!r[0]) return;
    var ym = Utilities.formatDate(new Date(r[0]), 'Asia/Seoul', 'yyyy-MM'), t = Number(r[8]) || 0;
    if (!map[ym]) map[ym] = { ym: ym, inQ: 0, outQ: 0 };
    if (r[5] === '입고') map[ym].inQ += t; else if (r[5] === '출고') map[ym].outQ += t;
  });
  var arr = Object.keys(map).map(function (k) { var m = map[k]; m.net = m.inQ - m.outQ; return m; });
  arr.sort(function (a, b) { return a.ym < b.ym ? 1 : -1; });
  return arr;
}

// ---------------------------------------------------------------------------
// 메모
// ---------------------------------------------------------------------------
function imgObj_(id) {
  id = ('' + id).trim(); if (!id) return null;
  return { id: id, thumb: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w600', url: 'https://drive.google.com/file/d/' + id + '/view' };
}
function getMemos() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    var r = v[i]; if (!r[1] && !r[8]) continue;
    out.push({ row: i + 2, date: r[0] ? fmtDt2_(r[0]) : '', company: r[1], plate: r[2], bizSticker: r[3], dateSticker: r[4],
      caseO: r[5], program: r[6], programName: r[7], note: r[8],
      stickerImgs: imgList_(r[9]), nameplateImgs: imgList_(r[10]), dateStickerImgs: imgList_(r[11]), extras: imgList_(r[12]), author: r[13] });
  }
  return out;
}
function saveMemo(p) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO), oldIds = [];
  if (p.row) {
    var o = sh.getRange(p.row, 1, 1, 14).getValues()[0];
    oldIds = [o[9], o[10], o[11], o[12]].join(',').split(',').map(function (s) { return ('' + s).trim(); }).filter(Boolean);
  }
  var stickerIds = resolveImgs_(p.stickers), nameplateIds = resolveImgs_(p.nameplates), dateStickerIds = resolveImgs_(p.dateStickers), extraIds = resolveImgs_(p.extras);
  var newIds = (stickerIds + ',' + nameplateIds + ',' + dateStickerIds + ',' + extraIds).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  oldIds.forEach(function (id) { if (id && newIds.indexOf(id) < 0) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} } });
  var dateVal = p.row ? (sh.getRange(p.row, 1).getValue() || new Date()) : new Date();
  var row = [dateVal, p.company || '', ox_(p.plate), ox_(p.bizSticker), ox_(p.dateSticker), ox_(p.caseO), ox_(p.program),
             p.programName || '', p.note || '', stickerIds, nameplateIds, dateStickerIds, extraIds, p.author || ''];
  if (p.row) sh.getRange(p.row, 1, 1, 14).setValues([row]); else sh.appendRow(row);
  return { ok: true };
}
function deleteMemo(row) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO);
  var o = sh.getRange(row, 1, 1, 14).getValues()[0];
  [o[9], o[10], o[11], o[12]].join(',').split(',').map(function (s) { return ('' + s).trim(); }).filter(Boolean)
    .forEach(function (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} });
  sh.deleteRow(row); return { ok: true };
}
function resolveImg_(img) { if (!img) return ''; if (img.id) return img.id; if (img.data) return saveImage_(img.data, img.mime || 'image/jpeg', img.name || 'memo.jpg').id; return ''; }
function resolveImgs_(arr) { return (arr || []).map(resolveImg_).filter(Boolean).join(','); }
function imgList_(cell) { return ('' + cell).split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(imgObj_).filter(Boolean); }
function ox_(v) { return v === 'O' ? 'O' : (v === 'X' ? 'X' : ''); }
function oxParse_(v) { v = ('' + v).trim(); if (!v) return ['', '']; var c = v.charAt(0).toUpperCase(); var base = c === 'O' ? 'O' : (c === 'X' ? 'X' : ''); var rest = base ? v.substring(1).trim() : v; return [base, rest]; }
function saveImage_(base64, mime, name) {
  var f = getMemoFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, name));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: f.getId() };
}
function getMemoFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('MEMO_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var folder = DriveApp.createFolder('써브텍 재고 - 메모 이미지');
  props.setProperty('MEMO_FOLDER', folder.getId());
  return folder;
}

// ---------------------------------------------------------------------------
function getOrCreateSheet_(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
function setHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0 || ('' + sheet.getRange(1, 1).getValue()).trim() !== headers[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold'); sheet.setFrozenRows(1);
  }
}
function cleanupDefaultSheet_(ss) {
  ['시트1', 'Sheet1'].forEach(function (n) { var sh = ss.getSheetByName(n); if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh); });
}
function num_(v) { if (v === '' || v == null) return 0; var n = parseFloat(('' + v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function fmtDt_(d) { return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'MM-dd HH:mm'); }
function fmtDt2_(d) { return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
