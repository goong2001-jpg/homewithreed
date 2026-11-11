/**
 * 서버 함수(Code.gs + Location.gs) 테스트 — 가짜 스프레드시트로 node 에서 실행
 *   node subtech-inventory/dev/server-test.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const D = path.join(__dirname, '..');
function sheet(rows) { return { rows, getLastRow() { return this.rows.length }, getRange(r, c, nr, nc) { const self = this; return {
  getValues() { return self.rows.slice(r - 1, r - 1 + nr).map(x => { const a = x.slice(c - 1, c - 1 + nc); while (a.length < nc) a.push(''); return a }) },
  setValues(v) { v.forEach((row, i) => { self.rows[r - 1 + i] = row.slice() }) } } } } }
const master = sheet([['ID', '품명', '분류', '단위', '안전'], ['SV7||기판', 'SV7', '기판', 100, 0], ['SV7||완포', 'SV7', '완포', 0, 0]]);
const log = sheet([['일시']]);
const sheets = { '품목마스터': master, '거래로그': log };
const ctx = { SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] }) }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, Utilities: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(D, 'Code.gs'), 'utf8') + '\n' + fs.readFileSync(path.join(D, 'Location.gs'), 'utf8'), ctx);
const R = (f, ...a) => vm.runInContext(f, ctx)(...a);
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const throws = (fn, m) => { try { fn(); ok(false, m) } catch (e) { ok(true, m + ' → ' + e.message) } };

R('save', { id: 'SV7||기판', name: 'SV7', cat: '기판', type: '입고', loc: '1층 A1', lines: [{ boxes: 2, per: 100 }] });
ok(R('computeStock_')['SV7||기판'].total === 200, '입고 200');
let r = R('locSetQty', { rows: [{ id: 'SV7||기판', loc: '1층 A1', qty: 230, note: '2박스×100+30낱개' }] });
ok(r.items[0].locs['1층 A1'] === 230 && /2박스×100\+30낱개/.test(log.rows[log.rows.length - 1][11]), '수량 입력 230 (조정, 메모에 구성)');
ok(R('locSetQty', { rows: [{ id: 'SV7||기판', loc: '1층 A1', qty: 230 }] }).changed === 0, '같은 수량이면 기록 안 함');
r = R('locQuickOut', { id: 'SV7||기판', loc: '1층 A1', lines: [{ boxes: 1, per: 100 }], loose: 30, memo: 'OO납품' });
ok(r.item.locs['1층 A1'] === 100, '출고 130 → 100');
throws(() => R('locQuickOut', { id: 'SV7||기판', loc: '1층 A1', lines: [], loose: 0 }), '출고 수량 없음');
throws(() => R('locSetQty', { rows: [{ id: 'NO', loc: 'x', qty: 1 }] }), '없는 품목');
throws(() => R('resetAllStock', { confirm: 'no' }), '초기화 확인 문구');
R('resetAllStock', { confirm: '초기화' });
const st = R('computeStock_');
ok(Object.values(st).every(s => s.total === 0 && s.boxes === 0), '전체 초기화 → 모두 0 (박스 수 포함)');
console.log(fail ? `\n실패 ${fail}개` : '\n모두 통과'); process.exit(fail ? 1 : 0);
