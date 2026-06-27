/**
 * 써브텍 재고관리 시스템 (Google Apps Script)
 * - 새 스프레드시트에 컨테이너 바인딩으로 붙여서 사용합니다.
 * - "초기 설정"으로 기존 써브텍 재고를 한 번 가져오고(연동), 이후 입출고는 거래로그에 누적됩니다.
 * - 메모 탭: 업체별 사양(명판/스티커/케이스/프로그램 O·X + 사진)을 기록/검색.
 */

var OLD_SHEET_ID = '1yju8vEskIH0_SJvqhoe4-OGLD3SVm4T-wfiimOOY6VE';
var OLD_TAB_NAME = '전체(수정중)';

var TAB_MASTER   = '품목마스터';
var TAB_LOG      = '거래로그';
var TAB_STOCK    = '현재고';
var TAB_CONFIG   = '설정';
var TAB_LOCATION = '위치';
var TAB_MEMO     = '메모';

var DEFAULT_LOCATIONS = ['A동1층', 'A동2층', 'A동3층', 'B동1층', '창고'];

// 메모 탭 컬럼: 1일시 2업체 3명판 4상호스티커 5날짜스티커 6전용케이스 7프로그램
//              8프로그램명 9비고 10상호스티커사진 11명판사진 12추가사진 13작성자
var MEMO_HEADERS = ['일시', '업체', '명판', '상호스티커', '날짜스티커', '전용케이스',
                    '프로그램', '프로그램명', '비고', '상호스티커사진', '명판사진', '추가사진', '작성자'];

// ---------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📦 재고관리')
    .addItem('① 초기 설정 / 기존 재고 가져오기', 'setup')
    .addSeparator()
    .addItem('웹앱(폰 화면) 주소 보기', 'showUrl')
    .addToUi();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('써브텍 재고')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function showUrl() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(url
    ? '폰 화면 주소입니다:\n\n' + url
    : '아직 웹앱이 배포되지 않았습니다. [배포 > 새 배포 > 웹 앱]을 먼저 진행하세요.');
}

// ---------------------------------------------------------------------------
// 초기 설정 (재실행해도 안전)
// ---------------------------------------------------------------------------
function setup() {
  var ss = SpreadsheetApp.getActive();
  var master = getOrCreateSheet_(ss, TAB_MASTER);
  var log    = getOrCreateSheet_(ss, TAB_LOG);
  var stock  = getOrCreateSheet_(ss, TAB_STOCK);
  var config = getOrCreateSheet_(ss, TAB_CONFIG);
  var locSh  = getOrCreateSheet_(ss, TAB_LOCATION);
  var memo   = getOrCreateSheet_(ss, TAB_MEMO);

  setHeaders_(master, ['품목ID', '품명', '분류', '기본박스입수', '안전재고', '비고']);
  setHeaders_(log,    ['일시', '품목ID', '품명', '분류', '위치', '구분',
                       '박스수', '박스당수량', '총개수', '증감수량', '담당자', '메모']);
  setHeaders_(config, ['담당자']);
  setHeaders_(locSh,  ['위치']);
  setHeaders_(memo,   MEMO_HEADERS);

  if (config.getLastRow() < 2) config.getRange(2, 1, 3, 1).setValues([['김반장'], ['이사원'], ['관리자']]);
  if (locSh.getLastRow() < 2)
    locSh.getRange(2, 1, DEFAULT_LOCATIONS.length, 1).setValues(DEFAULT_LOCATIONS.map(function (x) { return [x]; }));

  importInitial_(master, log);
  buildStockView_(stock);
  getMemoFolder_();
  cleanupDefaultSheet_(ss);

  SpreadsheetApp.getUi().alert('초기 설정 완료! 품목 ' + Math.max(0, master.getLastRow() - 1) + '건.\n' +
    '코드를 새로 붙여넣었다면 [배포 > 배포 관리 > 수정 > 새 버전 > 배포] 로 갱신하세요.');
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
  var cTot  = idx['총 박스수량'] != null ? idx['총 박스수량'] : idx['총박스수량'];
  var cQ1 = idx['수량'], cQ2 = idx['수량2'];

  var existing = {};
  if (master.getLastRow() > 1)
    master.getRange(2, 1, master.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) existing[r[0]] = true; });

  removeBaseRowsFromLog_(log);

  var newMasterRows = [], logRows = [], seen = {}, now = new Date();
  var LOC1 = DEFAULT_LOCATIONS[0], LOC2 = DEFAULT_LOCATIONS[1];
  for (var i = hRow + 1; i < vals.length; i++) {
    var name = ('' + vals[i][cName]).trim();
    var cat = cCat != null ? ('' + vals[i][cCat]).trim() : '';
    if (!name) continue;
    var id = name + '||' + cat;
    if (!existing[id] && !seen[id]) newMasterRows.push([id, name, cat, '', '', '']);
    seen[id] = true;
    var q1 = cQ1 != null ? num_(vals[i][cQ1]) : 0;
    var q2 = cQ2 != null ? num_(vals[i][cQ2]) : 0;
    var tot = cTot != null ? num_(vals[i][cTot]) : 0;
    if (q1 === 0 && q2 === 0 && tot > 0) q1 = tot;
    if (q1 > 0) logRows.push([now, id, name, cat, LOC1, '기초', '', '', q1, q1, '시스템', '기존재고 가져옴']);
    if (q2 > 0) logRows.push([now, id, name, cat, LOC2, '기초', '', '', q2, q2, '시스템', '기존재고 가져옴']);
  }
  if (newMasterRows.length) master.getRange(master.getLastRow() + 1, 1, newMasterRows.length, 6).setValues(newMasterRows);
  if (logRows.length) log.getRange(log.getLastRow() + 1, 1, logRows.length, 12).setValues(logRows);
}

function removeBaseRowsFromLog_(log) {
  if (log.getLastRow() < 2) return;
  var v = log.getRange(2, 1, log.getLastRow() - 1, 12).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (v[i][5] === '기초') log.deleteRow(i + 2);
}

function buildStockView_(stock) {
  stock.clear();
  stock.getRange(1, 1, 1, 4).setValues([['품명', '분류', '위치', '현재수량']]).setFontWeight('bold');
  stock.getRange('A2').setFormula(
    "=QUERY(거래로그!A2:L, \"select C, D, E, sum(J) where C is not null group by C, D, E order by D, C label sum(J) ''\", 0)");
  stock.setFrozenRows(1);
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
      var s = stock[r[0]] || { total: 0, locs: {} };
      items.push({ id: r[0], name: r[1], cat: r[2], unit: r[3], safe: Number(r[4]) || 0, total: s.total, locs: s.locs });
    });
  var staff = [];
  if (cf && cf.getLastRow() >= 2)
    cf.getRange(2, 1, cf.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) staff.push('' + r[0]); });
  var locs = [];
  var locSh = ss.getSheetByName(TAB_LOCATION);
  if (locSh && locSh.getLastRow() >= 2)
    locSh.getRange(2, 1, locSh.getLastRow() - 1, 1).getValues().forEach(function (r) { if (r[0]) locs.push('' + r[0]); });
  if (!locs.length) locs = DEFAULT_LOCATIONS.slice();
  return { items: items, staff: staff, locations: locs };
}

function computeStock_() {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var map = {};
  if (!log || log.getLastRow() < 2) return map;
  log.getRange(2, 1, log.getLastRow() - 1, 12).getValues().forEach(function (r) {
    var id = r[1]; if (!id) return;
    var loc = r[4] || '기타', d = Number(r[9]) || 0;
    if (!map[id]) map[id] = { total: 0, locs: {} };
    map[id].total += d; map[id].locs[loc] = (map[id].locs[loc] || 0) + d;
  });
  return map;
}

function save(payload) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var now = new Date(), sign = payload.type === '출고' ? -1 : 1, rows = [];
  (payload.lines || []).forEach(function (ln) {
    var boxes = Number(ln.boxes) || 0, per = Number(ln.per) || 0, t = boxes * per;
    if (t <= 0) return;
    rows.push([now, payload.id, payload.name, payload.cat, payload.loc || DEFAULT_LOCATIONS[0],
               payload.type, boxes, per, t, sign * t, payload.staff || '', payload.memo || '']);
  });
  if (!rows.length) throw new Error('수량을 입력하세요.');
  log.getRange(log.getLastRow() + 1, 1, rows.length, 12).setValues(rows);
  var s = computeStock_()[payload.id] || { total: 0, locs: {} };
  return { ok: true, total: s.total, locs: s.locs };
}

function addItem(p) {
  var name = ('' + (p.name || '')).trim(), cat = ('' + (p.cat || '')).trim();
  if (!name) throw new Error('품명을 입력하세요.');
  var m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER), id = name + '||' + cat;
  if (m.getLastRow() > 1) {
    var ids = m.getRange(2, 1, m.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) throw new Error('이미 같은 품명+분류가 있습니다.');
  }
  m.appendRow([id, name, cat, Number(p.unit) || '', Number(p.safe) || '', '']);
  return { id: id, name: name, cat: cat, unit: Number(p.unit) || '', safe: Number(p.safe) || 0, total: 0, locs: {} };
}

/** 품명/분류 수정: 마스터 + 거래로그 모두 갱신 */
function renameItem(oldId, name, cat) {
  name = ('' + name).trim(); cat = ('' + cat).trim();
  if (!name) throw new Error('품명을 입력하세요.');
  var ss = SpreadsheetApp.getActive(), m = ss.getSheetByName(TAB_MASTER), log = ss.getSheetByName(TAB_LOG);
  var newId = name + '||' + cat, targetRow = -1;
  if (m.getLastRow() > 1) {
    var ids = m.getRange(2, 1, m.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === oldId) targetRow = i + 2;
      else if (ids[i][0] === newId && newId !== oldId) throw new Error('이미 같은 품명+분류가 있습니다.');
    }
  }
  if (targetRow < 0) throw new Error('품목을 찾을 수 없습니다.');
  m.getRange(targetRow, 1, 1, 3).setValues([[newId, name, cat]]);
  if (log.getLastRow() > 1) {
    var rng = log.getRange(2, 2, log.getLastRow() - 1, 3), lv = rng.getValues(), ch = false;
    for (var j = 0; j < lv.length; j++) if (lv[j][0] === oldId) { lv[j] = [newId, name, cat]; ch = true; }
    if (ch) rng.setValues(lv);
  }
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

/** 선택 품목의 최근 입출고 이력 (최신순, 최대 20건) */
function getHistory(id) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG), out = [];
  if (!log || log.getLastRow() < 2) return out;
  var v = log.getRange(2, 1, log.getLastRow() - 1, 11).getValues();
  for (var i = v.length - 1; i >= 0 && out.length < 20; i--) {
    if (v[i][1] !== id) continue;
    out.push({ date: v[i][0] ? fmtDt_(v[i][0]) : '', type: v[i][5], loc: v[i][4],
               delta: Number(v[i][9]) || 0, staff: v[i][10] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 메모 (업체 사양 + 사진)
// ---------------------------------------------------------------------------
function imgObj_(id) {
  id = ('' + id).trim(); if (!id) return null;
  return { id: id, thumb: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w600',
           url: 'https://drive.google.com/file/d/' + id + '/view' };
}

function getMemos() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 13).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    var r = v[i]; if (!r[1] && !r[8]) continue;
    var extras = ('' + r[11]).split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(imgObj_).filter(Boolean);
    out.push({ row: i + 2, date: r[0] ? fmtDt2_(r[0]) : '', company: r[1],
      plate: r[2], bizSticker: r[3], dateSticker: r[4], caseO: r[5], program: r[6], programName: r[7], note: r[8],
      sticker: imgObj_(r[9]), nameplate: imgObj_(r[10]), extras: extras, author: r[12] });
  }
  return out;
}

function saveMemo(p) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO);
  var oldIds = [];
  if (p.row) {
    var o = sh.getRange(p.row, 1, 1, 13).getValues()[0];
    oldIds = [o[9], o[10]].concat(('' + o[11]).split(',')).map(function (s) { return ('' + s).trim(); }).filter(Boolean);
  }
  var stickerId = resolveImg_(p.sticker), nameplateId = resolveImg_(p.nameplate);
  var extraIds = (p.extras || []).map(resolveImg_).filter(Boolean);
  var newIds = [stickerId, nameplateId].concat(extraIds).filter(Boolean);
  oldIds.forEach(function (id) { if (id && newIds.indexOf(id) < 0) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} } });

  var dateVal = p.row ? (sh.getRange(p.row, 1).getValue() || new Date()) : new Date();
  var row = [dateVal, p.company || '', ox_(p.plate), ox_(p.bizSticker), ox_(p.dateSticker), ox_(p.caseO),
             ox_(p.program), p.programName || '', p.note || '', stickerId, nameplateId, extraIds.join(','), p.author || ''];
  if (p.row) sh.getRange(p.row, 1, 1, 13).setValues([row]); else sh.appendRow(row);
  return { ok: true };
}

function deleteMemo(row) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO);
  var o = sh.getRange(row, 1, 1, 13).getValues()[0];
  [o[9], o[10]].concat(('' + o[11]).split(',')).map(function (s) { return ('' + s).trim(); }).filter(Boolean)
    .forEach(function (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} });
  sh.deleteRow(row);
  return { ok: true };
}

function resolveImg_(img) {
  if (!img) return '';
  if (img.id) return img.id;
  if (img.data) return saveImage_(img.data, img.mime || 'image/jpeg', img.name || 'memo.jpg').id;
  return '';
}
function ox_(v) { return v === 'O' ? 'O' : (v === 'X' ? 'X' : ''); }

function saveImage_(base64, mime, name) {
  var folder = getMemoFolder_();
  var f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, name));
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
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}
function cleanupDefaultSheet_(ss) {
  ['시트1', 'Sheet1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
}
function num_(v) { if (v === '' || v == null) return 0; var n = parseFloat(('' + v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function fmtDt_(d) { return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'MM-dd HH:mm'); }
function fmtDt2_(d) { return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'); }
