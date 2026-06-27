/**
 * 써브텍 재고관리 시스템 (Google Apps Script)
 * - 새 스프레드시트에 컨테이너 바인딩으로 붙여서 사용합니다.
 * - "초기 설정"을 실행하면 기존 써브텍 시트에서 현재 재고를 한 번 가져옵니다(연동).
 * - 이후 입고/출고는 모두 거래로그에 기록되고, 현재고는 자동으로 합산됩니다.
 */

// 기존 써브텍 스프레드시트 ID (초기 재고를 가져올 원본)
var OLD_SHEET_ID = '1yju8vEskIH0_SJvqhoe4-OGLD3SVm4T-wfiimOOY6VE';
var OLD_TAB_NAME = '전체(수정중)';

// 탭 이름
var TAB_MASTER = '품목마스터';
var TAB_LOG    = '거래로그';
var TAB_STOCK  = '현재고';
var TAB_CONFIG = '설정';

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
// 초기 설정: 탭 생성 + 기존 써브텍 재고 가져오기
// ---------------------------------------------------------------------------
function setup() {
  var ss = SpreadsheetApp.getActive();

  var master = getOrCreateSheet_(ss, TAB_MASTER);
  var log    = getOrCreateSheet_(ss, TAB_LOG);
  var stock  = getOrCreateSheet_(ss, TAB_STOCK);
  var config = getOrCreateSheet_(ss, TAB_CONFIG);

  setHeaders_(master, ['품목ID', '품명', '분류', '기본박스입수', '안전재고', '비고']);
  setHeaders_(log,    ['일시', '품목ID', '품명', '분류', '위치', '구분',
                       '박스수', '박스당수량', '총개수', '증감수량', '담당자', '메모']);
  setHeaders_(config, ['담당자']);

  // 담당자 기본값 (한 번만)
  if (config.getLastRow() < 2) {
    config.getRange(2, 1, 3, 1).setValues([['김반장'], ['이사원'], ['관리자']]);
  }

  importInitial_(master, log);
  buildStockView_(stock);
  cleanupDefaultSheet_(ss);

  SpreadsheetApp.getUi().alert(
    '초기 설정 완료!\n\n품목 ' + Math.max(0, master.getLastRow() - 1) + '건을 가져왔습니다.\n' +
    '이제 [배포 > 새 배포 > 웹 앱]으로 폰 화면을 배포하세요.');
}

/** 기존 써브텍 전체(수정중)에서 품목과 현재 재고(기초재고)를 가져온다. */
function importInitial_(master, log) {
  var old = SpreadsheetApp.openById(OLD_SHEET_ID).getSheetByName(OLD_TAB_NAME);
  if (!old) throw new Error('기존 써브텍에서 "' + OLD_TAB_NAME + '" 탭을 찾을 수 없습니다.');

  var vals = old.getDataRange().getValues();

  // 헤더 행 찾기 (품명/분류 포함 행)
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
  var cQ1   = idx['수량'], cQ2 = idx['수량2'], cLoc = idx['위치'];

  // 기존 데이터 초기화(재실행 대비): 마스터 데이터, 기초재고 로그 제거
  if (master.getLastRow() > 1) {
    master.getRange(2, 1, master.getLastRow() - 1, master.getLastColumn()).clearContent();
  }
  removeBaseRowsFromLog_(log);

  var masterRows = [], logRows = [], seen = {}, now = new Date();

  for (var i = hRow + 1; i < vals.length; i++) {
    var name = ('' + vals[i][cName]).trim();
    var cat  = cCat != null ? ('' + vals[i][cCat]).trim() : '';
    if (!name) continue;

    var id = name + '||' + cat;
    if (!seen[id]) {
      seen[id] = true;
      masterRows.push([id, name, cat, '', '', '']); // 기본박스입수/안전재고는 추후 입력
    }

    var q1  = cQ1  != null ? num_(vals[i][cQ1])  : 0;
    var q2  = cQ2  != null ? num_(vals[i][cQ2])  : 0;
    var tot = cTot != null ? num_(vals[i][cTot]) : 0;
    if (q1 === 0 && q2 === 0 && tot > 0) q1 = tot; // 분할 없이 총량만 있는 경우

    var loc1 = (cLoc != null && ('' + vals[i][cLoc]).trim()) ? ('' + vals[i][cLoc]).trim() : '1층';
    if (q1 > 0) logRows.push([now, id, name, cat, loc1, '기초', '', '', q1, q1, '시스템', '기존재고 가져옴']);
    if (q2 > 0) logRows.push([now, id, name, cat, '2층', '기초', '', '', q2, q2, '시스템', '기존재고 가져옴']);
  }

  if (masterRows.length) master.getRange(2, 1, masterRows.length, 6).setValues(masterRows);
  if (logRows.length)    log.getRange(log.getLastRow() + 1, 1, logRows.length, 12).setValues(logRows);
}

/** 거래로그에서 구분=기초 행만 삭제 (초기 설정 재실행 대비) */
function removeBaseRowsFromLog_(log) {
  if (log.getLastRow() < 2) return;
  var v = log.getRange(2, 1, log.getLastRow() - 1, 12).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    if (v[i][5] === '기초') log.deleteRow(i + 2);
  }
}

/** 현재고 탭: 거래로그를 자동 합산하는 수식 뷰 */
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
// 웹앱에서 호출하는 서버 함수
// ---------------------------------------------------------------------------
/** 앱 시작 시 품목 + 현재고 + 담당자 목록을 한 번에 내려준다. */
function bootstrap() {
  var ss = SpreadsheetApp.getActive();
  var m  = ss.getSheetByName(TAB_MASTER);
  var cf = ss.getSheetByName(TAB_CONFIG);
  var stock = computeStock_();

  var items = [];
  if (m && m.getLastRow() >= 2) {
    var mv = m.getRange(2, 1, m.getLastRow() - 1, 5).getValues();
    mv.forEach(function (r) {
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
  return { items: items, staff: staff };
}

/** 거래로그에서 품목ID별 / 위치별 현재 수량을 합산 */
function computeStock_() {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var map = {};
  if (!log || log.getLastRow() < 2) return map;
  var v = log.getRange(2, 1, log.getLastRow() - 1, 12).getValues();
  v.forEach(function (r) {
    var id = r[1]; if (!id) return;
    var loc = r[4] || '기타';
    var d = Number(r[9]) || 0;
    if (!map[id]) map[id] = { total: 0, locs: {} };
    map[id].total += d;
    map[id].locs[loc] = (map[id].locs[loc] || 0) + d;
  });
  return map;
}

/**
 * 입고/출고 저장.
 * payload = { id, name, cat, type:'입고'|'출고', loc, staff, memo,
 *             lines:[{boxes, per}] }
 */
function save(payload) {
  var log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
  var now = new Date();
  var sign = payload.type === '출고' ? -1 : 1;
  var rows = [];

  (payload.lines || []).forEach(function (ln) {
    var boxes = Number(ln.boxes) || 0;
    var per   = Number(ln.per) || 0;
    var t = boxes * per;
    if (t <= 0) return;
    rows.push([now, payload.id, payload.name, payload.cat, payload.loc || '1층',
               payload.type, boxes, per, t, sign * t, payload.staff || '', payload.memo || '']);
  });

  if (!rows.length) throw new Error('수량을 입력하세요.');

  log.getRange(log.getLastRow() + 1, 1, rows.length, 12).setValues(rows);

  var s = computeStock_()[payload.id] || { total: 0, locs: {} };
  return { ok: true, total: s.total, locs: s.locs };
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

/** 기본 생성되는 빈 시트(시트1/Sheet1) 정리 */
function cleanupDefaultSheet_(ss) {
  ['시트1', 'Sheet1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1 && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
}

/** 문자열에서 숫자만 안전하게 추출 ("?" 등은 0) */
function num_(v) {
  if (v === '' || v == null) return 0;
  var s = ('' + v).replace(/[^0-9.\-]/g, '');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
