/**
 * 가짜 Apps Script 환경 — 실제 Code.gs 를 node(vm)와 브라우저(mock-page)에서 그대로 돌리기 위한 것.
 *   makeGas(tabs) → { SpreadsheetApp, LockService, Utilities, HtmlService, __tabs }
 *   tabs: { '탭이름': [[줄…]] }  (재고앱 탭을 흉내 낼 때 넣음)
 */
function makeGas(tabs) {
  tabs = tabs || {};
  function sheet(name) {
    var rows = tabs[name];
    return {
      getName: function () { return name; },
      getLastRow: function () { return rows.length; },
      getLastColumn: function () { var m = 0; rows.forEach(function (r) { if (r.length > m) m = r.length; }); return m; },
      getMaxRows: function () { return Math.max(1000, rows.length); }, getMaxColumns: function () { return 26; },
      setFrozenRows: function () {}, appendRow: function (r) { rows.push(r.slice()); },
      getRange: function (r, c, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        return {
          getValues: function () { var out = []; for (var i = 0; i < nr; i++) { var src = rows[r - 1 + i] || [], a = []; for (var j = 0; j < nc; j++) { var v = src[c - 1 + j]; a.push(v === undefined ? '' : v); } out.push(a); } return out; },
          setValues: function (v) { if (v.length !== nr || v.some(function (x) { return x.length !== nc; })) throw new Error('setValues 크기가 범위와 다릅니다 (' + name + ')'); v.forEach(function (row, i) { var t = rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach(function (x, j) { t[c - 1 + j] = x; }); }); return this; },
          getValue: function () { var v = (rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; },
          setValue: function (v) { (rows[r - 1] = rows[r - 1] || [])[c - 1] = v; return this; },
          setNumberFormat: function () { return this; },
          clearContent: function () { for (var i = 0; i < nr; i++) { var t = rows[r - 1 + i]; if (t) for (var j = 0; j < nc; j++) t[c - 1 + j] = ''; } return this; }
        };
      }
    };
  }
  var ss = { getSheetByName: function (n) { return tabs[n] ? sheet(n) : null; }, insertSheet: function (n) { tabs[n] = []; return sheet(n); }, getSheets: function () { return Object.keys(tabs).map(sheet); } };
  function p(n, l) { n = String(n); while (n.length < (l || 2)) n = '0' + n; return n; }
  return {
    __tabs: tabs,
    SpreadsheetApp: { openById: function () { return ss; }, getActive: function () { return ss; } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Utilities: { formatDate: function (d, tz, f) { var k = new Date(d.getTime() + 9 * 3600000); return f.replace('yyyy', k.getUTCFullYear()).replace('yy', p(k.getUTCFullYear() % 100)).replace('MM', p(k.getUTCMonth() + 1)).replace('dd', p(k.getUTCDate())).replace('HH', p(k.getUTCHours())).replace('mm', p(k.getUTCMinutes())).replace('ss', p(k.getUTCSeconds())); } },
    HtmlService: {}
  };
}
if (typeof module !== 'undefined') module.exports = makeGas;
