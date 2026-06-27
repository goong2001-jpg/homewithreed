/**
 * 써브텍 재고관리 시스템 (Google Apps Script)
 * - 새 스프레드시트에 컨테이너 바인딩으로 붙여서 사용합니다.
 * - "초기 설정"을 실행하면 기존 써브텍 시트에서 현재 재고를 한 번 가져옵니다(연동).
 * - 이후 입고/출고는 모두 거래로그에 기록되고, 현재고는 자동으로 합산됩니다.
 * - 메모 탭: 업체별 특이사항(스티커/명판/프로그램 등)을 텍스트+이미지로 기록/검색.
 */

// 기존 써브텍 스프레드시트 ID (초기 재고를 가져올 원본)
var OLD_SHEET_ID = '1yju8vEskIH0_SJvqhoe4-OGLD3SVm4T-wfiimOOY6VE';
var OLD_TAB_NAME = '전체(수정중)';

// 탭 이름
var TAB_MASTER   = '품목마스터';
var TAB_LOG      = '거래로그';
var TAB_STOCK    = '현재고';
var TAB_CONFIG   = '설정';
var TAB_LOCATION = '위치';
var TAB_MEMO     = '메모';

// 위치 기본 목록 (위치 탭이 비어있을 때 채워짐)
var DEFAULT_LOCATIONS = ['A동1층', 'A동2층', 'A동3층', 'B동1층', '창고'];

// ---------------------------------------------------------------------------
// 메뉴 / 웹앱 진입점
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
  SpreadsheetApp.getUi().alert(
    url
      ? '폰 화면 주소입니다. 휴대폰에서 열고 홈화면에 추가하세요:\n\n' + url
      : '아직 웹앱이 배포되지 않았습니다. [배포 > 새 배포 > 웹 앱]을 먼저 진행하세요.');
}

// ---------------------------------------------------------------------------
// 초기 설정: 탭 생성 + 기존 써브텍 재고 가져오기 (재실행해도 안전)
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
  setHeaders_(memo,   ['일시', '업체', '제목', '내용', '태그', '이미지ID', '이미지URL', '작성자']);

  if (config.getLastRow() < 2) {
    config.getRange(2, 1, 3, 1).setValues([['김반장'], ['이사원'], ['관리자']]);
  }
  if (locSh.getLastRow() < 2) {
    locSh.getRange(2, 1, DEFAULT_LOCATIONS.length, 1)
         .setValues(DEFAULT_LOCATIONS.map(function (x) { return [x]; }));
  }

  importInitial_(master, log);
  buildStockView_(stock);
  getMemoFolder_();           // 메모 이미지용 Drive 권한을 미리 받아둠
  cleanupDefaultSheet_(ss);

  SpreadsheetApp.getUi().alert(
    '초기 설정 완료!\n\n품목 ' + Math.max(0, master.getLastRow() - 1) + '건.\n' +
    '코드를 새로 붙여넣었다면 [배포 > 배포 관리 > 수정 > 버전: 새 버전 > 배포] 로 갱신하세요.');
}

/** 기존 써브텍 전체(수정중)에서 품목과 현재 재고(기초재고)를 가져온다. (비파괴적) */
function importInitial_(master, log) {
  var old = SpreadsheetApp.openById(OLD_SHEET_ID).getSheetByName(OLD_TAB_NAME);
  if (!old) throw new Error('기존 써브텍에서 "' + OLD_TAB_NAME + '" 탭을 찾을 수 없습니다.');

  var vals = old.getDataRange().getValues();

  var hRow = -1, idx = {};
  for (var r = 0; r < Math.min(6, vals.length); r++) {
    var row = vals[r].map(function (x) { return ('' + x).trim(); });
    if (row.indexOf('품명') >= 0 && row.indexOf('분류') >= 0) {
      hRow = r;
      row.forEach(function (h, i) { if (h) idx[h] = i; });
      break;
    }
  }
  if (hRow < 0) throw new Error('기존 시트에서 "품명/분류" 헤더를 찾지 못했습니다.');

  var cName = idx['품명'], cCat = idx['분류'];
  var cTot  = idx['총 박스수량'] != null ? idx['총 박스수량'] : idx['총박스수량'];
  var cQ1   = idx['수량'], cQ2 = idx['수량2'];

  // 이미 있는 품목ID 수집(비파괴: 사용자가 추가한 품목/안전재고는 보존)
  var existing = {};
  if (master.getLastRow() > 1) {
    master.getRange(2, 1, master.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { if (r[0]) existing[r[0]] = true; });
  }

  // 기초재고 로그만 제거 후 다시 적재(재실행 시 위치명/수량 갱신)
  removeBaseRowsFromLog_(log);

  var newMasterRows = [], logRows = [], seen = {}, now = new Date();
  var LOC1 = DEFAULT_LOCATIONS[0], LOC2 = DEFAULT_LOCATIONS[1]; // A동1층 / A동2층

  for (var i = hRow + 1; i < vals.length; i++) {
    var name = ('' + vals[i][cName]).trim();
    var cat  = cCat != null ? ('' + vals[i][cCat]).trim() : '';
    if (!name) continue;

    var id = name + '||' + cat;
    if (!existing[id] && !seen[id]) { newMasterRows.push([id, name, cat, '', '', '']); }
    seen[id] = true;

    var q1  = cQ1  != null ? num_(vals[i][cQ1])  : 0;
    var q2  = cQ2  != null ? num_(vals[i][cQ2])  : 0;
    var tot = cTot != null ? num_(vals[i][cTot]) : 0;
    if (q1 === 0 && q2 === 0 && tot > 0) q1 = tot;

    if (q1 > 0) logRows.push([now, id, name, cat, LOC1, '기초', '', '', q1, q1, '시스템', '기존재고 가져옴']);
    if (q2 > 0) logRows.push([now, id, name, cat, LOC2, '기초', '', '', q2, q2, '시스템', '기존재고 가져옴']);
  }

  if (newMasterRows.length) master.getRange(master.getLastRow() + 1, 1, newMasterRows.length, 6).setValues(newMasterRows);
  if (logRows.length)       log.getRange(log.getLastRow() + 1, 1, logRows.length, 12).setValues(logRows);
}

function removeBaseRowsFromLog_(log) {
  if (log.getLastRow() < 2) return;
  var v = log.getRange(2, 1, log.getLastRow() - 1, 12).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    if (v[i][5] === '기초') log.deleteRow(i + 2);
  }
}

function buildStockView_(stock) {
  stock.clear();
  stock.getRange(1, 1, 1, 4).setValues([['품명', '분류', '위치', '현재수량']]);
  stock.getRange(1, 1, 1, 4).setFontWeight('bold');
  stock.getRange('A2').setFormula(
    "=QUERY(거래로그!A2:L, \"select C, D, E, sum(J) " +
    "where C is not null group by C, D, E order by D, C label sum(J) ''\", 0)");
  stock.setFrozenRows(1);
}

// ---------------------------------------------------------------------------
// 웹앱 호출 - 재고
// ---------------------------------------------------------------------------
function bootstrap() {
  var ss = SpreadsheetApp.getActive();
  var m  = ss.getSheetByName(TAB_MASTER);
  var cf = ss.getSheetByName(TAB_CONFIG);
  var stock = computeStock_();

  var items = [];
  if (m && m.getLastRow() >= 2) {
    m.getRange(2, 1, m.getLastRow() - 1, 5).getValues().forEach(function (r) {
      if (!r[0]) return;
      var s = stock[r[0]] || { total: 0, locs: {} };
      items.push({ id: r[0], name: r[1], cat: r[2], unit: r[3],
                   safe: Number(r[4]) || 0, total: s.total, locs: s.locs });
    });
  }

  var staff = [];
  if (cf && cf.getLastRow() >= 2) {
    cf.getRange(2, 1, cf.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { if (r[0]) staff.push('' + r[0]); });
  }

  var locs = [];
  var locSh = ss.getSheetByName(TAB_LOCATION);
  if (locSh && locSh.getLastRow() >= 2) {
    locSh.getRange(2, 1, locSh.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { if (r[0]) locs.push('' + r[0]); });
  }
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
    map[id].total += d;
    map[id].locs[loc] = (map[id].locs[loc] || 0) + d;
  });
  return map;
}

/** 입고/출고 저장 */
function save(payload) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var now = new Date();
  var sign = payload.type === '출고' ? -1 : 1;
  var rows = [];
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

/** 새 품목 추가 */
function addItem(p) {
  var name = ('' + (p.name || '')).trim();
  var cat  = ('' + (p.cat  || '')).trim();
  if (!name) throw new Error('품명을 입력하세요.');
  var m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER);
  var id = name + '||' + cat;
  if (m.getLastRow() > 1) {
    var ids = m.getRange(2, 1, m.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === id) throw new Error('이미 같은 품명+분류가 있습니다.');
    }
  }
  m.appendRow([id, name, cat, Number(p.unit) || '', Number(p.safe) || '', '']);
  return { id: id, name: name, cat: cat, unit: Number(p.unit) || '', safe: Number(p.safe) || 0, total: 0, locs: {} };
}

/** 품목 삭제 (마스터 + 해당 거래로그 모두 제거) - 중복/오입력 정리용 */
function deleteItem(id) {
  var ss = SpreadsheetApp.getActive();
  var m = ss.getSheetByName(TAB_MASTER), log = ss.getSheetByName(TAB_LOG);
  if (m.getLastRow() > 1) {
    var mv = m.getRange(2, 1, m.getLastRow() - 1, 1).getValues();
    for (var i = mv.length - 1; i >= 0; i--) if (mv[i][0] === id) m.deleteRow(i + 2);
  }
  if (log.getLastRow() > 1) {
    var lv = log.getRange(2, 1, log.getLastRow() - 1, 12).getValues();
    for (var j = lv.length - 1; j >= 0; j--) if (lv[j][1] === id) log.deleteRow(j + 2);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 웹앱 호출 - 메모 (업체 특이사항 + 이미지)
// ---------------------------------------------------------------------------
function getMemos() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO);
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues();
  for (var i = v.length - 1; i >= 0; i--) {       // 최신순
    var r = v[i];
    if (!r[1] && !r[2] && !r[3]) continue;
    var imgId = r[5];
    out.push({
      row: i + 2, date: r[0] ? Utilities.formatDate(new Date(r[0]), 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : '',
      company: r[1], title: r[2], body: r[3], tags: r[4],
      imageId: imgId, imageUrl: r[6],
      thumb: imgId ? ('https://drive.google.com/thumbnail?id=' + imgId + '&sz=w600') : '',
      author: r[7]
    });
  }
  return out;
}

function addMemo(p) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO);
  var imgId = '', imgUrl = '';
  if (p.imageData) {
    var img = saveImage_(p.imageData, p.imageMime || 'image/jpeg', p.imageName || 'memo.jpg');
    imgId = img.id; imgUrl = img.url;
  }
  sh.appendRow([new Date(), p.company || '', p.title || '', p.body || '',
                p.tags || '', imgId, imgUrl, p.author || '']);
  return { ok: true };
}

function deleteMemo(row) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB_MEMO);
  var imgId = sh.getRange(row, 6).getValue();
  if (imgId) { try { DriveApp.getFileById(imgId).setTrashed(true); } catch (e) {} }
  sh.deleteRow(row);
  return { ok: true };
}

function saveImage_(base64, mime, name) {
  var folder = getMemoFolder_();
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, name);
  var f = folder.createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: f.getId(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view' };
}

function getMemoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('MEMO_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var folder = DriveApp.createFolder('써브텍 재고 - 메모 이미지');
  props.setProperty('MEMO_FOLDER', folder.getId());
  return folder;
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
function setHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0 ||
      ('' + sheet.getRange(1, 1).getValue()).trim() !== headers[0]) {
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
function num_(v) {
  if (v === '' || v == null) return 0;
  var n = parseFloat(('' + v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
