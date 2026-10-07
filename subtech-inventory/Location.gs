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

// ---------------------------------------------------------------------------
// 재고앱 연동: 위치도 칸 = 보관 위치
//   위치 이름(거래로그 E열) = "시트이름 칸코드" (예: "A동1층 A3"), 2층 이상은 "A동1층 A3 2층".
//   칸 이름(선반1 등)은 키에 넣지 않으므로 이름을 바꿔도 재고가 끊기지 않습니다.
//   시트 이름 자체(예: "A동1층")에 있는 재고는 그 시트의 "칸 미지정" 재고로 보입니다.
//   ※ Location.html 의 slotsOf() 와 같은 규칙을 써야 합니다.
// ---------------------------------------------------------------------------
function locCode_(r, c) { return String.fromCharCode(65 + r) + (c + 1); }

/** 위치도 JSON → 보관칸 목록 [{key, sheet, code, label, layer, n, note(손으로 적은 첫 자재)}] (시트·줄·칸 순) */
function locSlots_(obj) {
  const out = [];
  ((obj && obj.sheets) || []).forEach(s => {
    const sheet = String(s.name || '').trim();
    if (!sheet) return;
    Object.keys(s.cells || {}).map(k => k.split(',').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .forEach(rc => {
        const x = s.cells[rc[0] + ',' + rc[1]];
        if (!x || x.type !== 'slot') return;
        const code = locCode_(rc[0], rc[1]), n = Math.max(1, (x.layers || []).length);
        for (let i = 0; i < n; i++)
          out.push({ key: sheet + ' ' + code + (i ? ' ' + (i + 1) + '층' : ''), sheet: sheet, code: code,
                     label: String(x.label || '').trim(), layer: i, n: n,
                     note: String(((x.layers || [])[i] || {}).t || '').split('\n').map(t => t.trim()).filter(Boolean)[0] || '' });
      });
  });
  return out;
}

/** 재고앱 bootstrap 용: {sheets:[시트이름], slots:[...]} — 위치도가 없으면 빈 목록 */
function locSlotsForApp_() {
  try {
    const g = locGet();
    const obj = g.data ? JSON.parse(g.data) : null;
    return { sheets: ((obj && obj.sheets) || []).map(s => String(s.name || '').trim()).filter(String), slots: locSlots_(obj) };
  } catch (e) {
    return { sheets: [], slots: [] };
  }
}

/** 위치도 화면용: 위치 이름별 현재 재고 {stock:{위치:[{id,name,cat,qty}]}, appUrl} */
function locStock() {
  const names = {};
  const m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER);
  if (m && m.getLastRow() >= 2)
    m.getRange(2, 1, m.getLastRow() - 1, 3).getValues().forEach(r => { if (r[0]) names[r[0]] = { name: String(r[1]), cat: String(r[2] || '') }; });
  const st = computeStock_(), stock = {};
  Object.keys(st).forEach(id => {
    const it = names[id] || { name: String(id).split('||')[0], cat: '' };
    Object.keys(st[id].locs || {}).forEach(loc => {
      const q = Number(st[id].locs[loc]) || 0;
      if (!q) return;
      (stock[loc] = stock[loc] || []).push({ id: id, name: it.name, cat: it.cat, qty: q });
    });
  });
  Object.keys(stock).forEach(k => stock[k].sort((a, b) => b.qty - a.qty));
  let appUrl = '';
  try { appUrl = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return { stock: stock, appUrl: appUrl };
}
