/**
 * 브라우저 테스트용 페이지 만들기 — 실제 서버 대신, 진짜 Code.gs 를 가짜 시트(fake-gas.js) 위에서 브라우저 안에서 돌림
 *   node subtech-orders/dev/mock-page.js   → dev/out/page.html  (견본 주소록·송장기록 포함, 모두 지어낸 값)
 * 새로고침하면 가짜 시트는 처음 상태로 돌아갑니다.
 */
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const rd = f => fs.readFileSync(path.join(D, f), 'utf8');
let page = rd('Index.html').replace(/<\?!= inc\('(\w+)'\) \?>/g, (m, n) => rd(n + '.html'));
const tabs = {
  '품목마스터': [['품목ID', '품명', '분류'], ['SV7||완포', 'SV7', '완포'], ['H7||완포', 'H7', '완포'], ['STT-1.3||완포', 'STT-1.3', '완포'], ['STT-2.6DE||완포', 'STT-2.6DE', '완포']],
  '거래로그': [['일시', '품목ID']],
  '주문_거래처': [['거래처명', '전화', '전화2', '주소', '경동영업소', '대신영업소', '기본배송', '보내는분', '보내는분전화', '보내는분주소', '거래명세서', '계산서', '메모', '수정일시'],
    ['(대전)가나하우징', '042-000-7728', '', '대전광역시 대덕구 가나로 1062', '', '', '택배선불', '', '', '', 'O', 'O', '', ''],
    ['다라코퍼레이션', '010-0000-8108', '', '대전 유성구 다라로 54 4층', '', '', '', '', '', '', '', '', '', ''],
    ['마바이엔지', '033-000-0404', '', '', '원주 가나 692', '원주마바지점', '', '', '', '', '', '', '', '']],
  '주문_송장기록': [['일자', '운송', '받는분', '품목', '박스수', '박스타입', '운임', '출처'], ['01월 02일', 'CJ', 'a', 'SV7  X  50', 1, '대', '', '가져오기'], ['01월 02일', 'CJ', 'b', 'SV7  X  10', 1, '소', '', '가져오기'],
    ['01월 03일', 'CJ', 'c', 'STT-1.3    30', 1, '대', '', '가져오기'], ['01월 03일', 'CJ', 'd', 'STF-7S 1개', 1, '극소', '', '가져오기'], ['01월 03일', '대신', 'e', 'SV11 외출 X 50', 1, '소', 5000, '가져오기']]
};
const mock = `<script>
${fs.readFileSync(path.join(__dirname, 'fake-gas.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, '')}
(function(){
  var gas = makeGas(${JSON.stringify(tabs)}); window.GAS = gas; window.CALLS = [];
  var SpreadsheetApp = gas.SpreadsheetApp, LockService = gas.LockService, Utilities = gas.Utilities, HtmlService = gas.HtmlService;
  ${rd('Code.gs')}
  function runner(ok, fail){ return { withSuccessHandler:function(f){ return runner(f, fail); }, withFailureHandler:function(f){ return runner(ok, f); },
    api:function(pin, fn, arg){ window.CALLS.push(fn); setTimeout(function(){ var r; try { r = JSON.parse(JSON.stringify(api(pin, fn, JSON.parse(JSON.stringify(arg || {}))))); } catch(e){ if (fail) fail(e); return; } if (ok) ok(r); }, 15); } }; }
  window.google = { script: { get run(){ return runner(null, null); }, url: { getLocation: function (cb) { var p = {}; new URLSearchParams(location.search).forEach(function (v, k) { p[k] = v; }); setTimeout(function () { cb({ parameter: p }); }, 5); } } } };
})();
</script>`;
page = page.replace("<script>\nvar HTML_VERSION", () => mock + "\n<script>\nvar HTML_VERSION");
if (!page.includes('window.GAS')) throw new Error('가짜 서버를 끼워 넣지 못했습니다');
fs.writeFileSync(path.join(OUT, 'page.html'), page);
console.log('만듦: ' + path.join(OUT, 'page.html'));
