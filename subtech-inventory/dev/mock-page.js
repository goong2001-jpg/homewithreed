/**
 * 브라우저 테스트용 페이지 만들기 — 실제 서버(google.script.run) 대신 가짜 서버를 끼운 Index.html
 *   node subtech-inventory/dev/mock-page.js            → dev/out/page.html (견본 데이터)
 *   node subtech-inventory/dev/mock-page.js data.json  → 실제 데이터로 ({map:"위치도 JSON 문자열", items:[{id,name,cat,unit,total,locs}], ver:숫자})
 * 실제 데이터 파일(시트 내보내기)은 저장소에 올리지 마세요.
 */
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const loc = fs.readFileSync(path.join(D, 'Location.html'), 'utf8');
const index = fs.readFileSync(path.join(D, 'Index.html'), 'utf8');
const VER = (index.match(/HTML_VERSION = '([^']+)'/) || [])[1] || 'v0';
// 서버가 locInclude()로 끼워 넣는 부분을 그대로 재현
const page0 = index.replace('<?!= locInclude() ?>', () => loc);

const sample = {
  ver: 1,
  map: JSON.stringify({ sheets: [{ id: 's1', name: '1층', rows: 3, cols: 3, cells: {
    '0,0': { type: 'slot', label: '1자리', layers: [{ t: '', p: [{ id: 'SV7||기판', name: 'SV7' }] }], rs: 1, cs: 1, kind: '파렛트' },
    '0,1': { type: 'slot', label: '2자리', layers: [{ t: '', p: [{ id: 'SV7||기판', name: 'SV7' }] }], rs: 1, cs: 1 },
    '1,0': { type: 'slot', label: '', layers: [{ t: '', p: [{ id: 'X1||완포', name: 'X1' }] }, { t: '메모', p: [{ id: 'SV7||완포', name: 'SV7' }] }], rs: 1, cs: 1 } } }], cur: 0 }),
  items: [
    { id: 'SV7||기판', name: 'SV7', cat: '기판', unit: 100, safe: 0, total: 50, boxes: 0, locs: { '1층 B2': 50 } },
    { id: 'SV7||완포', name: 'SV7', cat: '완포', unit: 0, safe: 0, total: 0, boxes: 0, locs: {} },
    { id: 'X1||완포', name: 'X1', cat: '완포', unit: 0, safe: 0, total: 0, boxes: 0, locs: {} }],
};
const data = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : sample;

// 가짜 서버: 실제 Code.gs/Location.gs 함수와 같은 이름·같은 모양의 결과
// - withSuccessHandler 마다 새 runner (실제 google.script.run 과 같게)
// - 결과는 JSON 복사본으로 (서버 응답처럼 참조가 공유되지 않게)
// - window.CALLS 에 서버 호출 기록, localStorage 'mockDelay' 로 appBoot 지연(ms)
const mock = `<script>
(function(){
var DATA=${JSON.stringify(data)};
var ITEMS=DATA.items, MAP=localStorage.getItem('mockMap')||DATA.map, SV=+(localStorage.getItem('mockSV')||DATA.ver||1);
window.CALLS=[];
function boot(){return {items:ITEMS,staff:['홍길동','김철수'],locations:[],layout:[],version:'${VER}',appUrl:'',loc:{version:SV,data:MAP}}}
var DELAY=+(localStorage.getItem('mockDelay')||20);
function item(id){return ITEMS.filter(function(x){return x.id===id})[0]}
function sumLocs(it){it.total=Object.keys(it.locs).reduce(function(a,k){return a+it.locs[k]},0)}
var F={
 appBoot:boot, bootstrap:boot, getBomRows:function(){return []}, getMemos:function(){return []},
 locGet:function(){return {version:SV,data:MAP}},
 locSave:function(j,v){CALLS.push({save:v});if(v!==SV)return {conflict:true,version:SV,data:MAP};MAP=j;SV++;localStorage.setItem('mockMap',MAP);localStorage.setItem('mockSV',SV);return {ok:true,version:SV}},
 locApply:function(j,v,mv){CALLS.push({apply:v,mv:mv});if(v!==SV)return {conflict:true,version:SV,data:MAP};MAP=j;SV++;return {ok:true,version:SV}},
 locSetQty:function(p){CALLS.push({setQty:p});var out=[];p.rows.forEach(function(r){var it=item(r.id);if(!it)throw new Error('품목을 찾을 수 없어요');it.locs[r.loc]=r.qty;sumLocs(it);if(out.indexOf(it)<0)out.push(it)});return {ok:true,changed:p.rows.length,items:out}},
 locQuickIn:function(p){CALLS.push({quickIn:p});var it=item(p.id);var t=p.lines.reduce(function(a,l){return a+l.boxes*l.per},0);it.locs[p.loc]=(it.locs[p.loc]||0)+t;sumLocs(it);return {item:it,created:false}},
 locQuickOut:function(p){CALLS.push({quickOut:p});var it=item(p.id);var t=p.loose+p.lines.reduce(function(a,l){return a+l.boxes*l.per},0);it.locs[p.loc]=(it.locs[p.loc]||0)-t;sumLocs(it);return {item:it}},
 save:function(p){CALLS.push({save:p});var it=item(p.id);var t=p.lines.reduce(function(a,l){return a+(+l.boxes||0)*(+l.per||0)},0)*(p.type==='출고'?-1:1);it.locs[p.loc]=(it.locs[p.loc]||0)+t;sumLocs(it);return {ok:true,total:it.total,locs:it.locs}},
 getHistory:function(){return []},
 resetAllStock:function(p){if(p.confirm!=='초기화')throw new Error('확인 문구');ITEMS.forEach(function(it){Object.keys(it.locs).forEach(function(k){it.locs[k]=0});it.total=0});return {ok:true,rows:ITEMS.length}}};
function runner(s,f){var o={withSuccessHandler:function(h){return runner(h,f)},withFailureHandler:function(h){return runner(s,h)}};
 Object.keys(F).forEach(function(n){o[n]=function(){var a=arguments;setTimeout(function(){try{var r=JSON.parse(JSON.stringify(F[n].apply(null,a)));s&&s(r)}catch(e){f&&f(e)}},n==='appBoot'?DELAY:20)}});return o}
window.google={script:{run:runner(null,null),url:{getLocation:function(cb){cb({parameter:{}})}}}};
})();</script>`;
const out = path.join(OUT, 'page.html');
fs.writeFileSync(out, page0.replace('<head>', '<head>' + mock));
console.log('wrote', out, '(' + VER + ')');
