/**
 * 써브텍 주문앱 테스트 (node 만 있으면 됨) —   node subtech-orders/dev/test.js
 *  1) 카톡 나누기(Parse.html)  2) 엑셀 양식(Out.html)·엑셀 만들기/읽기(Xlsx.html)  3) 서버(Code.gs, 가짜 시트)  4) 템플릿·버전 검사
 * 견본의 이름·전화·주소는 모두 지어낸 것입니다 (실제 고객 정보 넣지 말 것).
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const D = path.join(__dirname, '..');
const load = f => { const m = { exports: {} }; new Function('module', 'XL', fs.readFileSync(path.join(D, f), 'utf8').replace(/<\/?script>/g, ''))(m, global.XL); return m.exports; };
const OP = load('Parse.html'), XL = global.XL = load('Xlsx.html'), OUT = load('Out.html');
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : '\n      받은 값 ' + JSON.stringify(a) + '\n      기대 값 ' + JSON.stringify(b)));
const throws = (fn, m) => { try { fn(); ok(false, m); } catch (e) { ok(true, m + ' → ' + e.message); } };
const it = l => { const i = OP.itemParse(l); return i ? [i.name, i.sensor, i.qty, i.unit, i.note] : null; };

console.log('1) 카톡 나누기');
eq(it('H10    7단계    X    6  스티커있음'), ['H10 7단계', 'X', 6, '', '스티커있음'], '센서 X + 수량 + 메모');
eq(it('SV7 O 1000개 명판있슴'), ['SV7', 'O', 1000, '개', '명판있슴'], '센서 O + 개');
eq(it('STT-1.3 - 10개'), ['STT-1.3', '', 10, '개', ''], '이름 - 수량');
eq(it('STT-2.6DE       90'), ['STT-2.6DE', '', 90, '', ''], '이름 + 숫자만');
eq(it('습식센서 2M 5개'), ['습식센서 2M', '', 5, '개', ''], '규격 숫자(2M)와 수량 구분');
eq(it('SV500    7단계     X     4회로  1세트'), ['SV500 7단계 4회로', 'X', 1, '세트', ''], '세트');
eq(it('H200WF(화이트)-20'), ['H200WF(화이트)', '', 20, '', ''], '붙여 쓴 이름-수량');
eq(it('STF-7S-30'), ['STF-7S', '', 30, '', ''], '모델명 안의 - 와 수량 -');
eq(it('H10   X    50(스티커 있음)'), ['H10', 'X', 50, '', '(스티커 있음)'], '수량 뒤 괄호 메모');
eq(it('Sv7 블랙 8개(무센서)'), ['Sv7 블랙', 'X', 8, '개', '(무센서)'], '(무센서) → 센서 X');
ok(it('STT-2.6') === null && it('STT-10D') === null && it('네 알겠습니다') === null, '수량 없는 모델명·잡담은 품목 아님');
let o = OP.parseOrder('가나상사 발주\n\nSV7 - 30개\nSTT-1.3 - 10개\n\n광주광역시 북구 가나대로86\n홍길동대리 010-0000-1234\n * 세금계산서 가나상사로 발행요망', { today: '2026-11-17' });
ok(o.isOrder && o.cust === '가나상사' && o.items.length === 2 && o.addr === '광주광역시 북구 가나대로86' && o.recv === '홍길동대리' && o.phone === '010-0000-1234' && /세금계산서/.test(o.memo), '거래처·품목·주소·받는분·전화·메모');
o = OP.parseOrder('다라시스템 \n\nH10    7단계    X    6  스티커있음 \n파워코드2.5 2C      6개\n\n택배선불 청구 \n\n충북 증평군 증평읍 증천리21 마바건축\n01000005597');
ok(o.carrier === 'CJ' && o.pay === '선불' && o.claim && o.ship === undefined && o.shipRaw === '택배선불 청구' && o.phone === '010-0000-5597' && /증천리21/.test(o.addr), '택배선불 청구 → CJ·선불·청구, 붙여 쓴 전화');
o = OP.parseOrder('사아이엔지 \n\n더블습식센서 황백 10미터   50개\nSV11  외출  X    50\n\n대신화물 \n센서는 다른 곳에서 직송할거에요');
ok(o.carrier === '대신' && o.mode === '화물' && o.shipRaw === '대신화물' && o.items[1].name === 'SV11 외출' && /직송/.test(o.memo), '대신화물 + 메모 줄');
o = OP.parseOrder('자차코퍼레이션\nSTF-7S 1개\n김철수\n010-0000-8453\n경상북도 상주시 가나마루1길 17-40 주택\n부재 시 문 앞에 놓아주세요.');
ok(o.recv === '김철수' && o.msg === '부재 시 문 앞에 놓아주세요.' && !o.carrier && /주택$/.test(o.addr), '이름 줄 + 전화 줄, 배송 메시지는 주소에 안 붙음');
o = OP.parseOrder('카타전기\nSTT-2.6  30\n경동화물\n원주 우산 692 지점\n내일 출고', { today: '2026-11-17' });
ok(o.carrier === '경동' && o.branch === '원주 우산 692 지점' && o.due === '2026-11-18' && o.shipRaw === '경동화물', '경동 + 지점 + 내일');
o = OP.parseOrder('파하종합상사 \nSV7  X   100개\n직접수령해 가셨습니다');
ok(o.carrier === '방문' && o.shipRaw === '직접수령', '직접수령');
o = OP.parseOrder('천지상사 \n보내는분 하늘무역으로 032-000-7106\n\nSTF-7S  X  10\n\n받는분 이몽룡\n010-0000-4827\n서산 고북면 고북1로 343-22 신우\n택배선불 청구');
ok(o.sender === '하늘무역' && o.senderPhone === '032-000-7106' && o.recv === '이몽룡' && o.phone === '010-0000-4827', '보내는분·받는분 줄');
ok(!OP.parseOrder('택배 30건\n반품 1건').isOrder && !OP.parseOrder('사진 3장').isOrder && !OP.parseOrder('네').isOrder, '발주가 아닌 메시지');
let ms = OP.splitMessages('2026년 11월 17일 오전 9:49, 홍길동 : 가나상사 \nSV5 X  29개\n2026년 11월 17일 오전 9:58, 홍길동 : 대신화물\n\n2026년 11월 17일 오후 1:10\n2026년 11월 17일 오후 1:10, 김영희 : 네');
ok(ms.length === 3 && ms[0].who === '홍길동' && ms[0].time === '09:49' && ms[2].time === '13:10' && ms[0].body === '가나상사 \nSV5 X  29개', '폰 내보내기 형식 나누기');
ms = OP.splitMessages('--------------- 2026년 11월 17일 화요일 ---------------\n[홍길동] [오전 11:06] 가나상사\nH10 X 6\n택배\n[김영희] [오후 12:04] 다라상사\nSV7 O 5');
ok(ms.length === 2 && ms[0].date === '2026-11-17' && ms[1].time === '12:04' && /택배$/.test(ms[0].body), 'PC 카톡 복사 형식 나누기');
ok(OP.splitMessages('가나상사\nSV7 X 5').length === 1, '형식 없는 글은 1건');
const custs = [{ name: '(경기 광주)가나난방', addr: 'A' }, { name: '(경기 광주)가나난방', addr: 'B' }, { name: '다라테크', addr: 'C' }, { name: '광주 다라보일러상사', addr: 'D' }];
ok(OP.findCust(custs, '가나난방').length === 2 && OP.findCust(custs, '다라테크')[0].addr === 'C' && OP.findCust(custs, '없는곳').length === 0, '거래처 찾기 (지역 표시 무시, 같은 이름 여러 주소)');
o = OP.parseOrder('다라테크 몰딩센서 2M 1000개\n금일 경동택배 출고', { custs });
ok(o.cust === '다라테크' && o.items[0].name === '몰딩센서 2M' && o.carrier === '경동', '거래처+품목이 한 줄');

console.log('1-2) v4: 옵션 줄 펼치기·배송 메시지·학습');
const its = o => o.items.map(i => [i.name, i.sensor, i.qty, i.note].join('|'));
o = OP.parseOrder('가나코퍼레이션\nH300WF\n색상:화이트,종류:조절기+온도센서 2개\n홍길동\n010-0000-1172\n경기도 안산시 상록구 가나물길 26-5\n(양상동) 다라시스템');
eq(its(o), ['H300WF|X|2|화이트', '온도센서||2|'], '모델 줄 + "색상:화이트,종류:조절기+온도센서 2개" → H300WF 2 · 온도센서 2 (둘 다 주문 수량)');
ok(/다라시스템$/.test(o.addr) && !o.msg && !o.memo, '  주소 다음 줄 상세주소는 주소에');
o = OP.parseOrder('가나코퍼레이션\n\nSV7\n조절기+온도센서+파워코드 2개\n김가나\n0502-0000-9714\n충청남도 천안시 동남구 병천면 가나길 113-1\n직접 받고 부재 시 문 앞');
eq(its(o), ['SV7|X|2|', '온도센서||2|', '파워코드||2|'], '조절기+온도센서+파워코드 → 품목 3줄');
ok(o.msg === '직접 받고 부재 시 문 앞', '  배송 요청은 배송 메시지로');
o = OP.parseOrder('가나코퍼레이션\n\nH200WF\n실버 조절기만 1개\n이가나\n0502-0000-4934\n경기도 시흥시 가나섬1로 4 다라프라자 6층\n마바 프론트 ( 정왕동 )\n물건 프론트 안쪽으로 넣어주시고\n던지지마세요 파손시 책임물어 바로 환불조치합니다');
eq(its(o), ['H200WF|X|1|실버'], '실버 조절기만 → H200WF 센서 X, 메모 실버');
ok(/정왕동 \)$/.test(o.addr) && o.msg === '물건 프론트 안쪽으로 넣어주시고 던지지마세요 파손시 책임물어 바로 환불조치합니다' && !o.memo, '주소 뒤 부탁 문장 여러 줄 → 배송 메시지 (주소·적요에 안 붙음)');
o = OP.parseOrder('라마썬\n\nH5R 실버 (리모컨포함)-1\n몰딩센서2M  2개\n박가나 / 010-0000-0978\n경기도 안산시 단원구 가나로 325 6층');
eq(its(o), ['H5R||1|실버', '리모컨||1|', '몰딩센서2M||2|'], '"H5R 실버 (리모컨포함)-1" → H5R 1 · 리모컨 1 (메모 실버)');
eq(its(OP.parseOrder('가나\nSV7 리모컨없음 조절기+온도센서 5')), ['SV7|X|5|리모컨 없음', '온도센서||5|'], '"리모컨없음"은 품목이 아니라 메모');
eq(its(OP.parseOrder('가나\nSTF-7L 리모컨 없음 X 3 (무센서)')), ['STF-7L|X|3|리모컨 없음'], '"리모컨 없음"(띄어쓰기)도 메모');
eq(its(OP.parseOrder('가나\nH200WF실버 O 10')), ['H200WF|O|10|실버'], '모델명에 붙은 색상 (H200WF실버) — 모델명이 잘리지 않음');
eq(its(OP.parseOrder('가나\nSV7 C485 조절기만 X 6')), ['SV7 C485|X|6|'], 'C485 같은 규격은 품목명에 남음');
eq(its(OP.parseOrder('가나\nH10    7단계    X    6  스티커있음')), ['H10 7단계|X|6|스티커있음'], '옵션 단어 없는 일반 발주는 그대로');
eq(its(OP.parseOrder('가나\nsv7 조절기 20개 (서산 가까운지점으로 보내주세요)')), ['sv7||20|(서산 가까운지점으로 보내주세요)'], '괄호 속 일반 메모는 쪼개지 않음');
eq(its(OP.parseOrder('가나\nH200WF+ X 1개')), ['H200WF+|X|1|'], 'H200WF+ 모델명 그대로');
o = OP.parseOrder('가나\nH300WF\n종류:조절기+진동모듈 2개');
ok(o.items.length === 1 && o.items[0].note === '진동모듈' && JSON.stringify(o.items[0].ask) === '["진동모듈"]', '처음 보는 옵션(진동모듈) → 메모에 두고 물어보기 표시');
const learn = [{ kind: 'opt', from: '진동모듈', to: 'item' }, { kind: 'name', cust: '가나', from: '온도센서', to: '몰딩센서 2M' }];
o = OP.parseOrder('가나\nH300WF\n종류:조절기+온도센서+진동모듈 2개', { learn });
eq(its(o), ['H300WF|X|2|', '몰딩센서 2M||2|', '진동모듈||2|'], '학습 적용: 진동모듈 → 품목, (가나) 온도센서 → 몰딩센서 2M');
eq(its(OP.parseOrder('다라\nH300WF\n종류:조절기+온도센서 1개', { learn })), ['H300WF|X|1|', '온도센서||1|'], '품목명 학습은 그 거래처에만');
o = OP.parseOrder('가나상사\nH5-W X 10\n카다로그 동봉\n신제품 카다로그도 넣어주세요\n택배선불');
ok(!o.msg && /카다로그도 넣어주세요/.test(o.memo), '포장 지시(카다로그 넣어주세요)는 적요에 남음');
o = OP.parseOrder('가나전기 직송건\nSV3K 2개 김가나님\n0504 0000 8331\n강원도 강릉시 가나로2874번길35 안내데스크\n택배로 보내주세요');
ok(!o.msg && o.carrier === 'CJ', '"택배로 보내주세요"는 배송방법');
o = OP.parseOrder('가나썬\n이가나 / 010-0000-5824\n경북 구미시 가나 9길 15-2 203호\n1층 택배실에 놓아주세요\nH7-1(무센서)');
ok(o.msg === '1층 택배실에 놓아주세요', '"택배실에 놓아주세요"는 배송 메시지');
console.log('2) 박스 추천');
const hist = [['CJ', 'a', 'SV7  X  50', 1, '대', 0], ['CJ', 'b', 'SV7  X  10', 1, '소', 0], ['CJ', 'c', 'SV7  X  2', 1, '극소', 0], ['CJ', 'd', 'STT-1.3DE      60/\nSTT-2.6DE      60', 4, '대', 0], ['CJ', 'd', 'STT-1.3DE      60/\nSTT-2.6DE      60', 1, '중', 0], ['경동', 'e', 'H7 X 50', 1, '소', 5000]];
const M = OP.buildRec(hist);
eq(OP.suggest(M, [{ name: 'STT-1.3DE', qty: 60 }, { name: 'STT-2.6DE', qty: 60 }], 'CJ').box, [{ k: '대', b: 4 }, { k: '중', b: 1 }], '같은 주문 기록 → 그대로 (대4 + 중1)');
eq(OP.suggest(M, [{ name: 'SV7', qty: 100 }], 'CJ').box, [{ k: '대', b: 2 }], 'SV7 100 → 대 2');
eq(OP.suggest(M, [{ name: 'SV7', qty: 8 }], 'CJ').box, [{ k: '소', b: 1 }], 'SV7 8 → 소 1');
eq(OP.suggest(M, [{ name: 'H7', qty: 50 }], '경동').box, [{ k: '소', b: 1, f: 5000 }], '경동 운임도 같이');
ok(OP.suggest(M, [{ name: '처음보는것', qty: 3 }], 'CJ') === null, '기록 없으면 추천 안 함');

console.log('3) 엑셀 양식');
const def = { name: '써브텍', phone: '02-0000-0000', addr: '경기도 포천시' };
const A = { id: 'A', cust: '가나상사', due: '2026-11-17', items: [{ name: 'STT-1.3DE', sensor: '', qty: 60, unit: '', note: '' }, { name: 'H7', sensor: 'X', qty: 100, unit: '', note: '스티커 있음' }, { name: '파워코드 2C', sensor: '', qty: 50, unit: '개', note: '' }], memo: '', recv: '', phone: '042-000-7728', phone2: '', addr: '대전광역시 대덕구 대전로 1', ship: '택배선불', carrier: 'CJ', pay: '선불', box: [{ k: '대', b: 4 }, { k: '중', b: 1 }], stmt: 'O', tax: '월말발행' };
const B = { id: 'B', cust: '자차코퍼레이션', due: '준비되면', items: [{ name: 'STF-7S', sensor: '', qty: 1, unit: '개', note: '' }], memo: '직송건', recv: '김철수', phone: '010-0000-8453', addr: '(37100) 경상북도 상주시 가나길 1', msg: '문 앞', sender: '자차코퍼레이션', senderPhone: '010-0000-8108', senderAddr: '대전 유성구', ship: '택배선불 청구', carrier: 'CJ', pay: '선불', branch: '상주영업소', mode: '화물', box: [{ k: '극소', b: 1, f: 4000 }] };
let x = OUT.cj([A, B], def, '2026-11-17');
ok(x.rows.length === 3 && x.rows[0][0] === '써브텍' && x.rows[0][4] === '가나상사' && x.rows[0][9] === 4 && x.rows[0][10] === '대' && x.rows[1][10] === '중' && x.rows[0][12] === '신용', 'CJ: 박스 크기마다 한 줄, 운임구분 신용');
ok(x.rows[2][0] === '자차코퍼레이션' && x.rows[2][3] === '대전 유성구' && x.rows[2][4] === '김철수' && x.rows[2][13] === '문 앞/김철수', 'CJ: 직송은 보내는분=거래처, 배송메세지 "메시지/이름"');
eq(x.sheets[0].rows[0].map(c => c.v), ['보내는분성명', '보내는분전화번호', '보내는분기타연락처', '보내는분주소(전체, 분할)', '받는분성명', '받는분전화번호', '받는분기타연락처', '받는분주소(전체, 분할)', '품목명', '박스수량', '박스타입', '기본운임', '운임구분', '배송메세지1'], 'CJ 머리줄 = 원래 양식');
ok(x.rows[0][8] === 'STT-1.3DE    60/\nH7    X    100/\n파워코드 2C    50개' && x.hist.length === 3 && x.hist[0][1] === 'CJ', 'CJ 품목명 줄바꿈 표기 + 송장기록');
x = OUT.kd([B], def, '2026-11-17');
ok(x.sheets[0].rows[0].length === 26 && x.rows[0][7] === '37100' && x.rows[0][3] === '경상북도 상주시 가나길 1' && x.rows[0][8] === '상주영업소' && x.rows[0][11] === '선불' && x.rows[0][20] === 4000 && x.rows[0][25] === '김철수/극소', '경동: 26열, 우편번호 분리, 영업소, 운임, 메모 "이름/크기"');
x = OUT.ds([A, B], def, '2026-11-17');
ok(x.sheets[0].name === '11월 17일' && x.sheets[0].rows[2][0].v === '발화주 :써브텍,02-0000-0000' && x.sheets[0].rows.some(r => r[0] && r[0].v === '발화주 :자차코퍼레이션,010-0000-8108') && x.rows[2][0] === '상주영업소' && x.rows[2][7] === '현불' && x.rows[2][10] === 4000, '대신: 날짜 탭, 발화주별 표, 도착지=영업소, 현불, 총운임');
const rep = OUT.report({ date: '2026-11-17', shipped: [A], pending: [B] }, OP.isAcc), RR = rep.sheets[0].rows;
ok(RR[0][0].v === '2026/11/17-출고현황' && RR[1].map(c => c.v).join('|') === 'no.|일자-No.|거래처명|품목명[규격]|센서|수량|적요|받는분|배송방법|거래명세서|계산서 발행 여부', '출하서: 제목·머리줄 = 원래 양식');
ok(RR[2][0].v === 1 && RR[2][1].v === '11월 17일' && RR[2][5].v === 60 && RR[3][6].v === '스티커 있음' && RR[4][5].v === '50개' && RR[5][0].v === '합계' && RR[5][5].v === 160, '출하서: 번호·일자·수량, 부자재는 "50개"로 쓰고 합계에서 제외');
ok(RR[6][1].v === '준비되면' && RR[6][0].v === '' && RR[6][7].v === '김철수 / 010-0000-8453 (37100) 경상북도 상주시 가나길 1' && RR[7][0].v === '출고 대기 합계', '출하서: 아래쪽 = 못 나간 주문(대기)');
ok(rep.sheets[0].merges.some(m => m.join() === '2,2,4,2') && rep.sheets[0].merges.some(m => m.join() === '0,0,0,10'), '출하서: 여러 품목이면 거래처 칸 병합');

(async () => {
  console.log('4) 엑셀 만들기 → 다시 읽기');
  const bytes = XL.build(rep.sheets.concat(OUT.cj([A, B], def, '2026-11-17').sheets));
  const R = await XL.read(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  ok(Object.keys(R).join() === '11월 17일,건별출력' && R['11월 17일'][2][2] === '가나상사' && R['11월 17일'][2][5] === 60 && R['건별출력'][1][8] === 'STT-1.3DE    60/\nH7    X    100/\n파워코드 2C    50개', '만든 엑셀을 다시 읽으면 같은 값');
  const imp = OUT.importBook({ '매출처 주소록': [['거래처 주소록'], ['No'], [], [1, '(가나)다라난방', '010-0000-9225', '', '강원도 강릉시 교동 1'], ['', '(가나)다라난방', '', '', '경동: 강릉교동9']],
    '송장출력건': [['01월 02일'], [], ['써브텍', '02', '', '주소', '가나상사', '042', '', '대전', 'SV7  X  50', 1, '대', '', '신용', '가나상사']],
    '발송기록': [KDH(), ['', '', '마바전기', '충북 청주시 가나로 15', '', '', '', '28481', '청주가나648영업소', '043-000-4000', '', '착불', 'SV7 X 20', 1, '박스', 10, 10, 10, 10, 50, 5000, 100, '', '', '', '마바전기/소']],
    '11월 13일': [['11월 13일'], [], ['발화주 :써브텍,02'], ['도착지', '수화주전화', '수화주명', '품명', '소/대 구분', '포장방법', '수량', '현/착불', '운임', '운송방법', '총운임'], ['인천가나지점', '010-0000-5097', '사아코리아', 'SV7 X  30개', '소', '박스', 1, '현불', 5000, '화물', 5000]] }, def);
  function KDH() { return ['보내는분']; }
  ok(imp.custs.length === 4 && imp.custs[1].kd === '강릉교동9' && imp.custs[2].kd === '청주가나648영업소' && imp.custs[3].ds === '인천가나지점' && imp.hist.length === 3 && imp.hist[1][5] === '소' && imp.hist[1][6] === 5000 && imp.hist[2][1] === '대신', '옛 엑셀 가져오기: 주소록·영업소·송장기록');

  console.log('5) 서버 (가짜 시트)');
  const makeGas = require('./fake-gas.js');
  const master = [['품목ID', '품명', '분류'], ['SV7||기판', 'SV7', '기판'], ['SV7||완포', 'SV7', '완포'], ['H7||완포', 'H7', '완포']], log = [['일시', '품목ID'], ['x', 'SV7||기판']];
  const gas = makeGas({ '품목마스터': master, '거래로그': log }), keep = JSON.stringify([master, log]);
  const ctx = Object.assign({ console }, gas); vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(D, 'Code.gs'), 'utf8'), ctx);
  const api = (fn, arg, pin) => JSON.parse(JSON.stringify(vm.runInContext('api', ctx)(pin || '', fn, arg)));
  let b = api('boot');
  eq(b.items, ['SV7', 'H7'], 'boot: 품목마스터 품명(중복 없이) 읽기');
  ok(b.orders.length === 0 && b.sender.name === '써브텍' && ['주문', '주문_거래처', '주문_송장기록', '주문_설정'].every(t => gas.__tabs[t]), 'boot: 주문용 탭을 스스로 만듦');
  let s = api('saveOrders', { orders: [Object.assign({}, A, { id: undefined, box: [] }), Object.assign({}, B, { id: undefined })] });
  ok(s.orders.length === 2 && /^O\d{6}-\d{6}-1$/.test(s.orders[0].id) && s.orders[0].st === '대기' && gas.__tabs['주문'].length === 3 && gas.__tabs['주문'][1][5] === 'STT-1.3DE 60 / H7 X 100 (스티커 있음) / 파워코드 2C 50개', '주문 저장: ID·상태, 품목 칸은 읽기 쉬운 글');
  ok(s.custs.some(c => c.name === '가나상사' && c.ship === '택배선불' && c.tax === '월말발행') && s.custs.some(c => c.name === '자차코퍼레이션' && c.sender === '자차코퍼레이션' && !c.addr), '거래처 기본값 기억 (배송방법·계산서·보내는분), 주소는 자동으로 안 바꿈');
  const [ia, ib] = s.orders.map(o => o.id);
  s = api('saveOrders', { orders: [Object.assign({}, s.orders[0], { memo: '급함' })] });
  ok(gas.__tabs['주문'].length === 3 && gas.__tabs['주문'][1][6] === '급함', '주문 고치기: 줄이 늘지 않고 그 줄만 바뀜');
  throws(() => api('saveOrders', { orders: [{ cust: 'x', items: [] }] }), '품목 없는 주문 거절');
  throws(() => api('saveOrders', { orders: [Object.assign({}, A, { id: 'NOPE' })] }), '없는 주문 ID 거절');
  s = api('markPrinted', { ids: [ia], box: { [ia]: [{ k: '대', b: 4 }] }, hist: [['2026-11-17', 'CJ', '가나상사', 'x', 4, '대', '']] });
  ok(s.orders[0].printed && s.orders[0].box[0].b === 4 && gas.__tabs['주문_송장기록'].length === 2 && gas.__tabs['주문_송장기록'][1][7] === '앱', '송장 뽑음 표시 + 박스 저장 + 송장기록');
  throws(() => api('setStatus', { ids: [ia], st: '이상한값' }), '잘못된 상태 거절');
  throws(() => api('setStatus', { ids: [ia, 'NOPE'], st: '취소' }), '없는 ID가 섞이면 아무것도 안 바꿈');
  ok(api('boot').orders.every(o => o.st === '대기'), '  (위 실패 뒤에도 둘 다 대기 그대로)');
  s = api('closeDay', { date: '2026-11-17', shippedIds: [ia] });
  ok(s.orders[0].st === '출고완료' && s.orders[0].shipped === '2026-11-17' && s.report.shipped.length === 1 && s.report.pending.length === 1 && s.report.pending[0].id === ib, '하루 마감: 나간 것 출고완료, 못 나간 것은 대기로 기록');
  api('closeDay', { date: '2026-11-17', shippedIds: [] });
  ok(gas.__tabs['주문_출하기록'].length === 2 && api('reports').list[0].shipped === 1 && api('report', { date: '2026-11-17' }).report.shipped[0].cust === '가나상사', '같은 날 다시 마감하면 그 날짜 줄만 갱신, 지난 출하서 다시 받기');
  throws(() => api('report', { date: '2020-01-01' }), '없는 날짜');
  s = api('setStatus', { ids: [ia], st: '대기' }); ok(s.orders[0].st === '대기' && s.orders[0].shipped === '', '대기로 되돌리기');
  s = api('custImport', { rows: imp.custs.concat(imp.custs) });
  ok(s.added === 3 && s.custs.filter(c => c.name === '(가나)다라난방').length === 1 && s.custs.find(c => c.name === '(가나)다라난방').kd === '강릉교동9', '주소록 가져오기: 겹치는 줄 건너뜀, 영업소는 같은 이름에 채움');
  ok(api('custImport', { rows: imp.custs }).added === 0, '같은 파일 다시 넣어도 안 늘어남');
  ok(api('histImport', { rows: imp.hist }).added === 3 && api('histImport', { rows: imp.hist }).added === 0 && api('recData').hist.length === 4, '송장기록 가져오기: 겹치지 않게');
  s = api('custSave', { row: 0, cust: { name: '새거래처', addr: '서울' } }); ok(s.custs.some(c => c.name === '새거래처'), '거래처 추가');
  api('setPin', { pin: '1234' });
  ok(api('boot').needPin === true && api('boot', {}, '0000').needPin === true && api('boot', {}, '1234').orders.length === 2, '암호를 켜면 암호 없이는 아무것도 못 봄');
  api('setPin', { pin: '' }, '1234'); ok(!api('boot').needPin, '암호 끄기');
  ok(JSON.stringify([master, log]) === keep, '품목마스터·거래로그는 한 글자도 안 바뀜');
  throws(() => vm.runInContext('sheet_', ctx)('거래로그', ['x']), '주문용 탭이 아니면 쓰기용으로 열 수 없음');
  ok(!/getSheetByName\('거래로그'\)|getSheetByName\("거래로그"\)/.test(fs.readFileSync(path.join(D, 'Code.gs'), 'utf8')), 'Code.gs 는 거래로그 탭을 부르지 않음');

  console.log('6) v2: 출고 기록·삭제');
  { const ids = api('boot').orders.map(o => o.id), x = api('saveOrders', { orders: [Object.assign({}, B, { id: undefined }), Object.assign({}, B, { id: undefined })] }).orders.map(o => o.id), all = ids.concat(x);
    ok(new Set(all).size === all.length, '같은 초에 여러 번 저장해도 주문 ID가 겹치지 않음 (v2에서 고친 버그)');
    api('deleteOrders', { ids: x }); }
  { const base = Object.assign({}, A, { id: undefined, box: [], memo: '급함', items: [{ name: 'STT-2.6', sensor: '', qty: 120, unit: '', note: '' }, { name: 'H7', sensor: 'X', qty: 50, unit: '', note: '스티커 있음' }] });
    const o1 = api('saveOrders', { orders: [base] }).orders[0], n0 = gas.__tabs['주문'].length;
    let r = api('shipOrder', { id: o1.id, date: '2026-11-17', lines: [{ k: 0, qty: 60, why: '자재부족' }] });
    const [d1, rest] = r.orders;
    ok(d1.st === '출고완료' && d1.shipped === '2026-11-17' && d1.items[0].qty === 60 && d1.items[0].ord === 120 && d1.items[0].why === '자재부족' && d1.items[1].qty === 50 && !d1.items[1].ord, '일부 출고: 나간 수량·주문 수량·사유 기록, 다 나간 품목은 그대로');
    ok(rest && rest.st === '대기' && rest.id === o1.id + '-r1' && rest.parent === o1.id && rest.items.length === 1 && rest.items[0].qty === 60 && rest.due === '준비되면' && /^잔량 \(자재부족\) \/ 급함$/.test(rest.memo) && gas.__tabs['주문'].length === n0 + 1, '잔량 60 → 대기 주문(원주문 연결) 자동 생성');
    r = api('shipOrder', { id: rest.id, date: '2026-11-18', lines: [{ k: 0, qty: 20, why: '업체요청' }], rest: 'drop' });
    ok(r.orders.length === 1 && r.orders[0].items[0].qty === 20 && r.orders[0].items[0].ord === 60 && gas.__tabs['주문'].length === n0 + 1, '안 보냄: 잔량 주문을 만들지 않음');
    throws(() => api('shipOrder', { id: rest.id, date: '2026-11-18', lines: [] }), '이미 출고된 주문은 다시 출고 안 됨');
    const rep2 = OUT.report({ date: '2026-11-17', shipped: [d1], pending: [] }, OP.isAcc).sheets[0].rows;
    ok(rep2[2][5].v === 60 && rep2[2][6].v === '급함 / 주문 120 중 60 출고 (자재부족)' && rep2[3][6].v === '스티커 있음', '출하서 적요: "주문 120 중 60 출고 (자재부족)"');
    // 삭제·되살리기
    const before = gas.__tabs['주문'].length, keep2 = JSON.stringify(gas.__tabs['주문'][1]);
    throws(() => api('deleteOrders', { ids: [d1.id, 'NOPE'] }), '없는 ID가 섞이면 아무것도 안 지움');
    ok(gas.__tabs['주문'].length === before, '  (위 실패 뒤 줄 수 그대로)');
    api('deleteOrders', { ids: [d1.id, rest.id] });
    ok(gas.__tabs['주문'].length === before - 2 && !api('boot').orders.some(o => o.id === d1.id) && JSON.stringify(gas.__tabs['주문'][1]) === keep2, '삭제: 그 줄만 지워짐 (다른 주문 그대로)');
    const dl = api('deletedList').list;
    ok(dl.filter(x => x.id === d1.id || x.id === rest.id).length === 2 && dl.some(x => x.id === d1.id && /STT-2.6 60/.test(x.items)), '삭제기록 탭에 보관');
    api('restoreOrders', { ids: [d1.id] });
    const back = api('boot').orders.find(o => o.id === d1.id);
    ok(back && back.items[0].ord === 120 && back.shipped === '2026-11-17' && !api('deletedList').list.some(x => x.id === d1.id) && api('deletedList').list.some(x => x.id === rest.id), '되살리기: 그대로 돌아오고 삭제기록에서 빠짐');
    { const t = api('saveOrders', { orders: [Object.assign({}, B, { id: undefined })] }).orders[0];
      ok(t.id !== rest.id && t.id !== d1.id, '지운 주문의 ID는 새 주문에 다시 쓰지 않음');
      gas.__tabs['주문_삭제기록'].push([vm.runInContext('now_', ctx)(), t.id, 'x', 'x', JSON.stringify(gas.__tabs['주문'].find(r => r[0] === t.id))]);
      const rb = api('restoreOrders', { ids: [t.id] }).orders[0];
      ok(rb.id === t.id + '-b1' && api('boot').orders.filter(o => o.id.indexOf(t.id) === 0).length === 2, '같은 ID가 이미 있으면 새 ID로 되살림 (사라지지 않음)');
      api('deleteOrders', { ids: [t.id, rb.id] }); }
    gas.__tabs['주문_삭제기록'].push(['2020-01-01 00:00:00', 'OLD', 'x', 'x', '[]']);
    ok(api('deletedList').list.every(x => x.id !== 'OLD'), '30일 지난 삭제기록은 자동으로 지움');
    ok(JSON.stringify([master, log]) === keep, '품목마스터·거래로그는 그대로 (v2 기능 뒤에도)');
  }

  console.log('7) v3: 하루 파일·월 파일·최근 주소');
  { const C1 = Object.assign({}, A, { id: undefined, box: [{ k: '대', b: 2 }], carrier: 'CJ', items: [{ name: 'SV7', sensor: 'X', qty: 50, unit: '', note: '' }, { name: '파워코드 2C', sensor: '', qty: 50, unit: '개', note: '' }] });
    const K1 = Object.assign({}, B, { id: undefined, carrier: '경동', ship: '경동택배선불', branch: '상주영업소', box: [{ k: '소', b: 1, f: 5000 }] });
    const J1 = Object.assign({}, A, { id: undefined, carrier: '직납', ship: '직납', box: [], items: [{ name: 'H10', sensor: 'X', qty: 300, unit: '', note: '' }] });
    const W1 = Object.assign({}, A, { id: undefined, carrier: '대신', ship: '대신화물', box: [], due: '준비되면', items: [{ name: 'SV11', sensor: 'O', qty: 10, unit: '', note: '' }] });
    const [c1, k1, j1, w1] = api('saveOrders', { orders: [C1, K1, J1, W1] }).orders;
    api('shipOrder', { id: j1.id, date: '2026-11-19', lines: [{ k: 0, qty: 200, why: '자재부족' }], rest: 'drop' });
    const snap = api('closeDay', { date: '2026-11-19', shippedIds: [c1.id, k1.id] }).report;
    ok(snap.shipped.length === 3 && snap.shipped.every(o => o.carrier && 'box' in o && 'own' in o) && snap.pending.some(o => o.id === w1.id), '마감 기록에 운송·박스·보내는분까지 남음 (하루 파일용)');
    const dayf = OUT.day(snap, def, OP.isAcc), names = dayf.sheets.map(x => x.name);
    eq(names, ['출하서', 'CJ', '경동', '직납·방문 등', '미출고'], '하루 파일 탭: 출하서·CJ·경동·직납·미출고 (그날 없는 대신 탭은 생략)');
    const cjS = dayf.sheets[1], kdS = dayf.sheets[2];
    ok(cjS.rows[0][0].v === '보내는분성명' && cjS.rows.length === 2 && cjS.rows[1][9].v === 2 && cjS.rows[1][10].v === '대', 'CJ 탭 = CJ 양식 그대로, 저장된 박스(대 2)');
    ok(kdS.rows[0].length === 26 && kdS.rows[1][8].v === '상주영업소' && kdS.rows[1][20].v === 5000, '경동 탭 = 경동 양식 그대로');
    ok(dayf.sheets[3].rows[1][2].v === 'H10' && dayf.sheets[3].rows[1][4].v === 200 && /주문 300 중 200 출고 \(자재부족\)/.test(dayf.sheets[3].rows[1][5].v), '직납 탭: 일부 출고 적요');
    ok(dayf.sheets[4].rows.some(r => r[1].v === '가나상사' && r[2].v === 'SV11'), '미출고 탭에 대기 주문');
    const R0 = dayf.sheets[0].rows, gana = R0.find(r => r[2].v === '가나상사' && r[3].v === 'SV7');
    ok(gana && gana[7].v === '', '출하서 받는분 칸: 단골 기본 주소(주문에 안 적힌 것)는 비움');
    // 월 파일
    api('shipOrder', { id: w1.id, date: '2026-11-20', lines: [] });
    const md2 = api('monthData', { month: '2026-11' });
    ok(md2.shipped.length >= 4 && md2.pending['2026-11-19'] && md2.pending['2026-11-19'].length >= 1, 'monthData: 그 달 출고 주문 + 마감한 날의 대기 목록');
    throws(() => api('monthData', { month: '11월' }), '달 형식 거절');
    const mf = OUT.month(md2, OP.isAcc), mn = mf.sheets.map(x => x.name);
    ok(mn[0] === '거래처별' && mn[1] === '품목별' && mn[2] === '출고목록' && mn[3] === '11월 20일' && mn[4] === '11월 19일' && mf.name === '2026년 11월_출고현황', '월 파일 탭: 거래처별·품목별·출고목록 + 날짜별 출하서(최근 날짜 먼저)');
    const cr = mf.sheets[0].rows, gRow = cr.find(r => r[0].v === '가나상사'), tot = cr[cr.length - 1];
    ok(gRow && gRow[3].v >= 260 && gRow[4].v >= 50 && tot[0].v === '합계', '거래처별: 제품 수량과 부자재 수량을 따로 합계');
    const ir = mf.sheets[1].rows; ok(ir.some(r => r[0].v === 'H10' && r[1].v === 'X' && r[2].v === 200), '품목별: 실제 나간 수량(200)으로 합계');
    ok(mf.sheets[2].rows.some(r => r[2].v === 'H10' && r[4].v === 200 && r[5].v === 300 && r[6].v === '자재부족'), '출고목록: 출고·주문 수량·사유');
    // 만든 파일이 엑셀로 열리는지 (다시 읽기)
    const by = XL.build(mf.sheets), RR = await XL.read(by.buffer.slice(by.byteOffset, by.byteOffset + by.byteLength));
    ok(Object.keys(RR).length === mf.sheets.length && RR['품목별'][0][0] === '품목명[규격]', '월 파일 엑셀 다시 읽기 OK');
    // 최근 주소
    const ah = api('boot').addrHist['자차코퍼레이션'];
    ok(Array.isArray(ah) && ah.length >= 1 && ah.length <= 5 && ah[0].recv === '김철수' && ah.every((x, i) => ah.findIndex(y => y.addr === x.addr && y.recv === x.recv && y.branch === x.branch) === i), 'boot: 거래처별 최근 받는 곳 (겹침 없이 최대 5개)');
    ok(OUT.report({ date: '2026-11-19', shipped: [{ cust: 'x', items: [], recv: '홍', phone: '010', addr: '서울' }], pending: [] }).sheets[0].rows[2][7].v === '홍 / 010 서울', '옛 마감 기록(own 없음)은 받는분 그대로 표시');
  }

  console.log('8) v4: 학습 저장');
  { let r = api('learnSave', { rows: [{ kind: 'opt', from: '진동모듈', to: 'item' }, { kind: 'name', cust: '가나', from: '온도센서', to: '몰딩센서 2M' }] });
    ok(r.learn.length === 2 && gas.__tabs['주문_학습'].length === 3, '학습 2건 저장 (주문_학습 탭)');
    r = api('learnSave', { rows: [{ kind: 'opt', from: '진동모듈', to: 'memo' }] });
    ok(r.learn.length === 2 && r.learn.find(x => x.from === '진동모듈').to === 'memo', '같은 것을 다시 고르면 덮어씀 (줄 안 늘어남)');
    throws(() => api('learnSave', { rows: [{ kind: 'x', from: 'a', to: 'b' }] }), '잘못된 학습 거절');
    ok(api('boot').learn.length === 2, 'boot 에 학습 목록');
    r = api('learnDelete', { rows: [{ kind: 'name', cust: '가나', from: '온도센서' }] });
    ok(r.learn.length === 1 && r.learn[0].kind === 'opt', '학습 지우기');
    ok(JSON.stringify([master, log]) === keep, '품목마스터·거래로그는 그대로 (v4 뒤에도)'); }

  console.log('9) 템플릿·버전');
  const idx = fs.readFileSync(path.join(D, 'Index.html'), 'utf8'), tags = idx.match(/<\?[\s\S]*?\?>/g) || [];
  ok((idx.match(/<\?/g) || []).length === 3 && tags.join() === "<?!= inc('Parse') ?>,<?!= inc('Xlsx') ?>,<?!= inc('Out') ?>", 'Index.html 의 <? ?> 는 끼워넣기 3개뿐 (다른 곳에 있으면 앱이 안 열림)');
  const av = (fs.readFileSync(path.join(D, 'Code.gs'), 'utf8').match(/var APP_VERSION = '([^']+)'/) || [])[1], hv = (idx.match(/var HTML_VERSION = '([^']+)'/) || [])[1];
  ok(av && av === hv, '버전 짝: Code.gs ' + av + ' = Index.html ' + hv);
  console.log(fail ? `\n실패 ${fail}개` : '\n모두 통과'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
