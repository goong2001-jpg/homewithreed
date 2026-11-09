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
    return { ok: true, version: locWrite_(sh, json, cur) };
  } finally {
    lock.releaseLock();
  }
}

/** 위치도 JSON 저장 (잠금·버전 검사는 호출하는 쪽에서) → 새 버전 */
function locWrite_(sh, json, cur) {
  const obj = JSON.parse(json); // 형식 검사
  const chunks = [];
  for (let i = 0; i < json.length; i += LOC_CHUNK) chunks.push(["'" + json.slice(i, i + LOC_CHUNK)]);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 1).clearContent();
  sh.getRange(2, 1, chunks.length, 1).setValues(chunks);
  const v = cur + 1;
  sh.getRange(1, 1, 1, 3).setValues([[v, new Date(), '← 위치도 앱 데이터. 직접 수정하지 마세요']]);
  locWriteList_(obj);
  return v;
}

/**
 * 위치도 저장 + 재고 이동을 한 번에 (줄·칸 옮기기, 메모·지정 제품까지 옮기는 이동).
 * 다른 사람이 먼저 저장했으면 아무것도 안 하고 최신본을 돌려줌. 재고가 모자라면 오류(역시 아무것도 안 씀).
 * mv = {staff, memo, groups:[...]} (locMove 와 같은 형식, 없어도 됨) → {ok, version, stock}
 */
function locApply(json, baseVersion, mv) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = locSheet_();
    const cur = Number(sh.getRange(1, 1).getValue()) || 0;
    if (cur !== Number(baseVersion)) {
      const g = locGet();
      return { ok: false, conflict: true, version: g.version, data: g.data };
    }
    JSON.parse(json);
    const hasMoves = mv && (mv.groups || []).some(g => (g.moves || []).some(m => Number(m.qty) > 0));
    const rows = (hasMoves ? locMoveRows_(mv) : []).concat(mv && mv.clears ? locClearRows_(mv) : []);   // 검사 먼저 (틀리면 여기서 오류)
    if (rows.length) {
      const log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
      log.getRange(log.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
    }
    const v = locWrite_(sh, json, cur);
    return { ok: true, version: v, stock: locStock().stock };
  } finally {
    lock.releaseLock();
  }
}

/** "위치목록" 시트: 검색·필터용 평평한 표 */
function locWriteList_(obj) {
  const ss = locBook_();
  const sh = ss.getSheetByName(LOC_LIST) || ss.insertSheet(LOC_LIST);
  const rows = [['시트', '칸', '이름', '층', '자재', '적재방식']];
  (obj.sheets || []).forEach(s => {
    Object.keys(s.cells || {}).forEach(k => {
      const x = s.cells[k];
      if (!x || x.type !== 'slot') return;
      const rc = k.split(',').map(Number);
      const code = locCode_(rc[0], rc[1]);
      const split = (x.layers || []).length > 1;
      (x.layers || []).forEach((L, i) => {
        (L.p || []).forEach(pr => rows.push([s.name, code, x.label || '', split ? (i + 1) + '층' : '', '[제품] ' + (pr.name || pr.id), x.kind || '']));
        String(L.t || '').split('\n').map(t => t.trim()).filter(Boolean)
          .forEach(t => rows.push([s.name, code, x.label || '', split ? (i + 1) + '층' : '', t, x.kind || '']));
      });
    });
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 6).setNumberFormat('@').setValues(rows);
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
/** 칸 코드: 줄은 A~Z 다음 AA, AB … (엑셀식), 칸은 1부터. Location.html 의 code() 와 같은 규칙 */
function locCode_(r, c) {
  let s = '', n = r + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s + (c + 1);
}

/** 위치도 JSON → 보관칸 목록 [{key, sheet, code, label, layer, n, p(지정 제품 id들), note(첫 지정 제품명 또는 손으로 적은 첫 자재)}] (시트·줄·칸 순) */
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
                     label: String(x.label || '').trim(), kind: x.kind || '', layer: i, n: n,
                     p: (((x.layers || [])[i] || {}).p || []).map(pr => pr.id),
                     note: ((((x.layers || [])[i] || {}).p || [])[0] || {}).name ||
                           String(((x.layers || [])[i] || {}).t || '').split('\n').map(t => t.trim()).filter(Boolean)[0] || '' });
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
  const names = {}, items = [];
  const m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER);
  if (m && m.getLastRow() >= 2)
    m.getRange(2, 1, m.getLastRow() - 1, 3).getValues().forEach(r => {
      if (!r[0]) return;
      names[r[0]] = { name: String(r[1]), cat: String(r[2] || '') };
      items.push({ id: String(r[0]), name: String(r[1]), cat: String(r[2] || '') });
    });
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
  const staff = [], cf = SpreadsheetApp.getActive().getSheetByName(TAB_CONFIG);
  if (cf && cf.getLastRow() >= 2) cf.getRange(2, 1, cf.getLastRow() - 1, 1).getValues().forEach(r => { if (r[0]) staff.push(String(r[0])); });
  return { stock: stock, appUrl: appUrl, staff: staff, items: items };
}

/**
 * 위치도에서 이동 (품목 하나 / 층 전체 / 칸 전체). 거래로그에 품목마다 '이동' 2행 — 앱의 moveStock 과 같은 형식.
 * p = {staff, memo, groups:[{fromLoc, toLoc, moves:[{id, qty}]}]}
 * 전부 검사한 뒤 한 번에 기록합니다(하나라도 틀리면 아무것도 안 씀). → 갱신된 locStock() 반환
 */
function locMove(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rows = locMoveRows_(p);
    const log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
    log.getRange(log.getLastRow() + 1, 1, rows.length, 13).setValues(rows);
  } finally {
    lock.releaseLock();
  }
  return locStock();
}

/**
 * 칸 삭제 때 그 칸 위치들의 재고를 0으로: mv.clears = {mode:'조정'|'출고', locs:[위치 이름…]}
 * 지금 거래로그 기준 수량을 다시 읽어 그만큼 빼므로(마이너스면 더함) 그 사이 바뀐 재고도 정확히 0이 됨.
 * '출고'를 골라도 마이너스 재고는 출고로 쓸 수 없어 '조정'으로 기록.
 */
function locClearRows_(mv) {
  const c = mv.clears || {}, mode = c.mode === '출고' ? '출고' : '조정';
  const locs = (c.locs || []).map(l => String(l || '').trim()).filter(String);
  if (!locs.length) return [];
  const m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER), info = {};
  if (m && m.getLastRow() >= 2)
    m.getRange(2, 1, m.getLastRow() - 1, 3).getValues().forEach(r => { if (r[0]) info[r[0]] = { name: r[1], cat: r[2] }; });
  const st = computeStock_(), now = new Date(), rows = [];
  Object.keys(st).forEach(id => locs.forEach(loc => {
    const cur = Number((st[id].locs || {})[loc]) || 0;
    if (!cur) return;
    const it = info[id] || { name: String(id).split('||')[0], cat: '' }, type = cur > 0 ? mode : '조정';
    rows.push([now, id, it.name, it.cat, loc, type, '', '', Math.abs(cur), -cur, mv.staff || '',
               '위치도 칸 삭제' + (mv.memo ? ' ' + mv.memo : '') + ' (' + cur + '→0)', '']);
  }));
  return rows;
}

/** 이동 요청 검사 → 거래로그 행들 (하나라도 틀리면 오류, 아무것도 안 씀). 잠금은 호출하는 쪽에서 */
function locMoveRows_(p) {
  p = p || {};
  const groups = (p.groups || []).map(g => ({
    from: String(g.fromLoc || '').trim(), to: String(g.toLoc || '').trim(),
    moves: (g.moves || []).map(m => ({ id: m.id, qty: Number(m.qty) || 0 })).filter(m => m.id && m.qty > 0)
  })).filter(g => g.moves.length);
  if (!groups.length) throw new Error('옮길 수량을 입력하세요.');
  groups.forEach(g => { if (!g.from || !g.to || g.from === g.to) throw new Error('보내는 칸과 받는 칸을 다르게 골라주세요.'); });
  const ss = SpreadsheetApp.getActive(), m = ss.getSheetByName(TAB_MASTER);
  const info = {};
  if (m && m.getLastRow() >= 2)
    m.getRange(2, 1, m.getLastRow() - 1, 3).getValues().forEach(r => { if (r[0]) info[r[0]] = { name: r[1], cat: r[2] }; });
  const st = computeStock_(), used = {}, now = new Date(), rows = [];
  groups.forEach(g => {
    const route = g.from + '→' + g.to, memo = (p.memo ? route + ' / ' + p.memo : route) + ' (위치도)';
    g.moves.forEach(mv => {
      const it = info[mv.id];
      if (!it) throw new Error('품목을 찾을 수 없어요: ' + mv.id);
      const k = mv.id + '\n' + g.from, have = (((st[mv.id] || {}).locs || {})[g.from] || 0) - (used[k] || 0);
      if (mv.qty > have) throw new Error(it.name + ': ' + g.from + ' 재고(' + have + '개)보다 많이 옮길 수 없어요. 새로고침 후 다시 해주세요.');
      used[k] = (used[k] || 0) + mv.qty;
      rows.push([now, mv.id, it.name, it.cat, g.from, '이동', '', '', mv.qty, -mv.qty, p.staff || '', memo, '']);
      rows.push([now, mv.id, it.name, it.cat, g.to,   '이동', '', '', mv.qty,  mv.qty, p.staff || '', memo, '']);
    });
  });
  return rows;
}

/**
 * 위치도에서 바로 입고 (재고앱으로 넘어가지 않음). 없는 품목이면 품목마스터에 새로 만들고 입고까지 한 번에.
 * p = {id} 또는 {newItem:{name, cat, unit}}, loc, lines:[{boxes, per}], staff, memo
 * → {item:{id,name,cat,unit,safe,total,boxes,locs}, created}
 */
function locQuickIn(p) {
  p = p || {};
  const loc = String(p.loc || '').trim();
  if (!loc) throw new Error('입고할 칸을 고르세요.');
  const lines = (p.lines || []).map(l => ({ boxes: Number(l.boxes) || 0, per: Number(l.per) || 0 })).filter(l => l.boxes * l.per > 0);
  if (!lines.length) throw new Error('수량을 입력하세요.');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER), info = {};
    if (m && m.getLastRow() >= 2)
      m.getRange(2, 1, m.getLastRow() - 1, 5).getValues().forEach(r => {
        if (r[0]) info[r[0]] = { id: String(r[0]), name: String(r[1]), cat: String(r[2] || ''), unit: Number(r[3]) || '', safe: Number(r[4]) || 0 };
      });
    let it, created = false;
    if (p.newItem) {
      const name = String(p.newItem.name || '').trim(), cat = String(p.newItem.cat || '').trim();
      if (!name) throw new Error('품명을 입력하세요.');
      it = info[name + '||' + cat];               // 같은 품명+분류가 이미 있으면 그 품목에 입고
      if (!it) { it = addItem({ name: name, cat: cat, unit: p.newItem.unit }); created = true; }
    } else {
      it = info[p.id];
      if (!it) throw new Error('품목을 찾을 수 없어요. 새로고침 후 다시 해주세요.');
    }
    save({ id: it.id, name: it.name, cat: it.cat, type: '입고', loc: loc, lines: lines,
           staff: p.staff || '', memo: p.memo || '위치도에서 입고', images: [] });
    const s = computeStock_()[it.id] || { total: 0, boxes: 0, locs: {} };
    return { item: { id: it.id, name: it.name, cat: it.cat, unit: it.unit, safe: it.safe || 0,
                     total: s.total, boxes: s.boxes || 0, locs: s.locs }, created: created };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 칸별 수량 바로 입력 · 전체 수량 초기화 ----------
   둘 다 거래로그를 지우지 않고 '조정' 줄만 덧붙입니다 (이력이 남고, 필요하면 되돌릴 수 있음). */
function locMasterInfo_() {
  const m = SpreadsheetApp.getActive().getSheetByName(TAB_MASTER), info = {};
  if (m && m.getLastRow() >= 2)
    m.getRange(2, 1, m.getLastRow() - 1, 5).getValues().forEach(r => {
      if (r[0]) info[r[0]] = { id: String(r[0]), name: String(r[1]), cat: String(r[2] || ''), unit: Number(r[3]) || '', safe: Number(r[4]) || 0 };
    });
  return info;
}
/** 위치도에서 칸별 수량 입력: rows=[{id, loc, qty}] → 지금 그 칸 수량과의 차이만 '조정'으로 기록 */
function locSetQty(p) {
  p = p || {};
  const rows = (p.rows || []).map(r => ({ id: String(r.id || ''), loc: String(r.loc || '').trim(), qty: Number(r.qty), note: String(r.note || '').slice(0, 200) }))
    .filter(r => r.id && r.loc);
  if (!rows.length) throw new Error('입력한 수량이 없어요.');
  rows.forEach(r => { if (!(r.qty >= 0) || Math.floor(r.qty) !== r.qty) throw new Error('수량은 0 이상의 정수로 입력하세요.'); });
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const info = locMasterInfo_(), st = computeStock_(), now = new Date(), out = [], ids = [];
    rows.forEach(r => {
      const it = info[r.id];
      if (!it) throw new Error('품목을 찾을 수 없어요 (' + r.id.split('||')[0] + '). 새로고침 후 다시 해주세요.');
      const s = st[r.id] = st[r.id] || { total: 0, boxes: 0, locs: {} };
      const cur = Number(s.locs[r.loc]) || 0, d = r.qty - cur;
      if (ids.indexOf(r.id) < 0) ids.push(r.id);
      if (!d) return;
      out.push([now, it.id, it.name, it.cat, r.loc, '조정', '', '', Math.abs(d), d, p.staff || '', '위치도 수량 입력 ' + cur + '→' + r.qty + (r.note ? ' (' + r.note + ')' : ''), '']);
      s.locs[r.loc] = r.qty;
    });
    const log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
    if (out.length) log.getRange(log.getLastRow() + 1, 1, out.length, 13).setValues(out);
    const s2 = out.length ? computeStock_() : st;
    return { ok: true, changed: out.length, items: ids.map(id => {
      const it = info[id], s = s2[id] || { total: 0, boxes: 0, locs: {} };
      return { id: it.id, name: it.name, cat: it.cat, unit: it.unit, safe: it.safe, total: s.total, boxes: s.boxes || 0, locs: s.locs };
    }) };
  } finally {
    lock.releaseLock();
  }
}
/** 모든 품목·위치의 수량을 0으로 만드는 '조정' 줄들 (박스 수도 0이 되게 한 줄에 실어 뺌) */
function locResetRows_(staff) {
  const st = computeStock_(), info = locMasterInfo_(), now = new Date(), out = [];
  Object.keys(st).forEach(id => {
    const s = st[id], it = info[id] || { name: String(id).split('||')[0], cat: String(id).split('||')[1] || '' };
    let boxLeft = Number(s.boxes) || 0;   // 박스 수: 줄 수량이 빠지면(-) 빼지고, 더해지면(+) 더해짐
    Object.keys(s.locs).forEach(loc => {
      const cur = Number(s.locs[loc]) || 0;
      if (!cur) return;
      let bx = '';
      if (boxLeft && (boxLeft > 0) === (cur > 0)) { bx = Math.abs(boxLeft); boxLeft = 0; }
      out.push([now, id, it.name, it.cat, loc, '조정', bx, '', Math.abs(cur), -cur, staff || '', '전체 수량 초기화 ' + cur + '→0', '']);
    });
  });
  return out;
}
/** 전체 수량 0으로 (재고앱 총수량 탭에서 "초기화"를 입력해야 실행) */
function resetAllStock(p) {
  if (!p || String(p.confirm || '').trim() !== '초기화') throw new Error('확인 문구("초기화")가 맞지 않아 아무것도 바꾸지 않았어요.');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const out = locResetRows_(p.staff || ''), log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
    if (out.length) log.getRange(log.getLastRow() + 1, 1, out.length, 13).setValues(out);
    return { ok: true, rows: out.length };
  } finally {
    lock.releaseLock();
  }
}

/** 위치도에서 바로 출고: lines=[{boxes,per}] + loose(낱개) → '출고' 줄 (박스 줄마다 한 줄, 낱개는 한 줄) */
function locQuickOut(p) {
  p = p || {};
  const loc = String(p.loc || '').trim();
  if (!loc) throw new Error('출고할 칸을 고르세요.');
  const lines = (p.lines || []).map(l => ({ boxes: Math.floor(Number(l.boxes) || 0), per: Math.floor(Number(l.per) || 0) })).filter(l => l.boxes > 0 && l.per > 0);
  const loose = Math.max(0, Math.floor(Number(p.loose) || 0));
  if (!lines.length && !loose) throw new Error('출고할 수량을 넣으세요.');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const it = locMasterInfo_()[p.id];
    if (!it) throw new Error('품목을 찾을 수 없어요. 새로고침 후 다시 해주세요.');
    const now = new Date(), staff = p.staff || '', memo = ('위치도에서 출고' + (p.memo ? ' · ' + String(p.memo).slice(0, 200) : '')), out = [];
    lines.forEach(l => out.push([now, it.id, it.name, it.cat, loc, '출고', l.boxes, l.per, l.boxes * l.per, -l.boxes * l.per, staff, memo, '']));
    if (loose) out.push([now, it.id, it.name, it.cat, loc, '출고', '', '', loose, -loose, staff, memo, '']);
    const log = SpreadsheetApp.getActive().getSheetByName(TAB_LOG);
    log.getRange(log.getLastRow() + 1, 1, out.length, 13).setValues(out);
    const s = computeStock_()[it.id] || { total: 0, boxes: 0, locs: {} };
    return { item: { id: it.id, name: it.name, cat: it.cat, unit: it.unit, safe: it.safe, total: s.total, boxes: s.boxes || 0, locs: s.locs } };
  } finally {
    lock.releaseLock();
  }
}
