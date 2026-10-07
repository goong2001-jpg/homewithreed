/**
 * 써브텍 자재 위치도 — 서버 코드
 * 기존 재고앱 프로젝트에 파일 하나로 추가합니다. (함수 이름은 loc 로 시작해서 기존 코드와 안 겹칩니다)
 * 데이터 저장 위치: 이 스크립트가 붙은 스프레드시트의 "위치도" 시트
 *   (독립 스크립트라면 내 드라이브에 "써브텍 위치도 DB" 시트를 새로 만듭니다)
 * 사람이 보기 좋은 표는 "위치목록" 시트에 자동으로 정리됩니다. (시트 / 칸 / 이름 / 층 / 자재)
 */
const LOC_SHEET = '위치도';
const LOC_LIST = '위치목록';
const LOC_CHUNK = 40000; // 셀 1칸 최대 5만자 → 4만자씩 나눠 저장

function locBook_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (ss) return ss;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LOC_SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  const created = SpreadsheetApp.create('써브텍 위치도 DB');
  props.setProperty('LOC_SS_ID', created.getId());
  return created;
}

function locSheet_() {
  const ss = locBook_();
  return ss.getSheetByName(LOC_SHEET) || ss.insertSheet(LOC_SHEET);
}

/** 화면에서 불러오기: {version, data(JSON 문자열 또는 null)} */
function locGet() {
  const sh = locSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { version: 0, data: null };
  const version = Number(sh.getRange(1, 1).getValue()) || 0;
  const json = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0] || '')).join('');
  return { version: version, data: json || null };
}

/** 화면에서 저장하기. 다른 사람이 먼저 저장했으면 저장하지 않고 최신본을 돌려줌 */
function locSave(json, baseVersion) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = locSheet_();
    const cur = Number(sh.getRange(1, 1).getValue()) || 0;
    if (cur !== Number(baseVersion)) {
      const g = locGet();
      return { ok: false, conflict: true, version: g.version, data: g.data };
    }
    const obj = JSON.parse(json); // 형식 검사
    const chunks = [];
    for (let i = 0; i < json.length; i += LOC_CHUNK) chunks.push(["'" + json.slice(i, i + LOC_CHUNK)]);
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, 1).clearContent();
    sh.getRange(2, 1, chunks.length, 1).setValues(chunks);
    const v = cur + 1;
    sh.getRange(1, 1, 1, 3).setValues([[v, new Date(), '← 위치도 앱 데이터. 직접 수정하지 마세요']]);
    locWriteList_(obj);
    return { ok: true, version: v };
  } finally {
    lock.releaseLock();
  }
}

/** "위치목록" 시트: 검색·필터용 평평한 표 */
function locWriteList_(obj) {
  const ss = locBook_();
  const sh = ss.getSheetByName(LOC_LIST) || ss.insertSheet(LOC_LIST);
  const rows = [['시트', '칸', '이름', '층', '자재']];
  (obj.sheets || []).forEach(s => {
    Object.keys(s.cells || {}).forEach(k => {
      const x = s.cells[k];
      if (!x || x.type !== 'slot') return;
      const rc = k.split(',').map(Number);
      const code = String.fromCharCode(65 + rc[0]) + (rc[1] + 1);
      const split = (x.layers || []).length > 1;
      (x.layers || []).forEach((L, i) => {
        String(L.t || '').split('\n').map(t => t.trim()).filter(Boolean)
          .forEach(t => rows.push([s.name, code, x.label || '', split ? (i + 1) + '층' : '', t]));
      });
    });
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 5).setNumberFormat('@').setValues(rows);
  sh.setFrozenRows(1);
}

/** 위치도 단독 화면 (doGet 에서 ?page=location 일 때 호출) */
function locPage() {
  return HtmlService.createHtmlOutputFromFile('Location')
    .setTitle('써브텍 자재 위치도')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 재고앱 ↔ 위치도 이동용 주소 */
function locUrl() {
  return ScriptApp.getService().getUrl();
}

/** (선택) 기존 화면이 템플릿 방식이면 탭 안에 <?!= locInclude() ?> 로 바로 넣을 수 있음 */
function locInclude() {
  return HtmlService.createHtmlOutputFromFile('Location').getContent();
}
