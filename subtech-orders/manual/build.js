/**
 * 실무자용 미니북 PDF 만들기 (A5) —  node subtech-orders/manual/build.js
 *   먼저 node subtech-orders/dev/mock-page.js && node subtech-orders/manual/shots.js 로 img/*.png 를 만듦.
 *   글꼴: FONT_DIR 에 Pretendard-*.woff2 가 있으면 그것을 씀 (npm i pretendard → node_modules/pretendard/dist/web/static/woff2).
 *   없으면 시스템 한글 글꼴로 나옴.
 * 결과: manual/써브텍주문앱_실무가이드.pdf
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const M = __dirname, IMG = f => 'img/' + f + '.png';
const FD = process.env.FONT_DIR || '';
const font = (w, n) => { const f = path.join(FD, 'Pretendard-' + n + '.woff2'); return FD && fs.existsSync(f) ? `@font-face{font-family:P;font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2')}` : ''; };
const FONTS = [[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold']].map(a => font(a[0], a[1])).join('');

const VER = (fs.readFileSync(path.join(M, '..', 'Code.gs'), 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1];
const TOTAL = 14;
let pg = 0;
const page = (body, o = {}) => { pg++; return `<section class="page ${o.cls || ''}">${o.bare ? '' : `<div class="run"><span>SUBTECH ORDERS</span><span>${o.sec || ''}</span></div>`}${body}${o.bare ? '' : `<div class="folio">${String(pg).padStart(2, '0')}<i></i>${TOTAL}</div>`}</section>`; };
const phone = (f, w) => `<figure class="phone" style="width:${w || 50}mm"><img src="${IMG(f)}"></figure>`;
const shot = (f, cap, cls) => `<figure class="shot ${cls || ''}"><img src="${IMG(f)}">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
const steps = a => `<ol class="steps">${a.map(s => `<li><b>${s[0]}</b>${s[1] ? `<span>${s[1]}</span>` : ''}</li>`).join('')}</ol>`;
const note = (t, h) => `<div class="note">${h ? `<strong>${h}</strong>` : ''}${t}</div>`;
const head = (k, t, lead, isNew) => `<div class="kicker">${k}${isNew ? '<em>NEW</em>' : ''}</div><h2>${t}</h2>${lead ? `<p class="lead">${lead}</p>` : ''}`;

const P = [];
// 01 표지
P.push(page(`
  <div class="frame"></div>
  <div class="cv-top">SUBTECH · ORDER MANAGEMENT</div>
  <div class="cv-title"><small>실무자를 위한</small>써브텍 주문앱<span>사용 안내서</span></div>
  <div class="cv-rule"></div>
  <div class="cv-sub">카톡 발주부터 송장, 생산 준비, 출하서까지<br>하루 업무를 한 화면에서</div>
  <div class="cv-phone">${phone('l2-items', 64).replace('class="phone"', 'class="phone flat"')}</div>
  <div class="cv-foot"><span>사무실 · 생산라인 공용</span><span>${VER} · 2026. 11</span></div>
`, { cls: 'cover', bare: true }));

// 02 시작하기
P.push(page(`
  ${head('BEFORE YOU START', '시작하기', '앱은 인터넷 주소 하나로 엽니다. 설치는 필요 없고, 처음 한 번만 홈 화면에 추가해 두면 앱처럼 쓸 수 있습니다.')}
  <div class="addr">
    <div><span>사무실</span><b>주문앱 주소</b><p>PC 크롬에서 열고 즐겨찾기</p></div>
    <div><span>생산라인</span><b>주소 끝에 <code>?view=line</code></b><p>휴대폰에서 열고 홈 화면에 추가</p></div>
  </div>
  ${note('카톡에서 링크를 누르면 "현재 파일을 열 수 없습니다"가 뜰 수 있습니다. 오른쪽 위 <b>⋮ → 다른 브라우저로 열기</b>를 누르세요. 크롬·삼성 인터넷에서는 바로 열립니다.', '카톡 안에서는 안 열려요')}
  <div class="toc">
    <h3>차례</h3>
    <p><span>하루 흐름 한눈에</span><i></i>03</p>
    <p class="g">사무실</p>
    <p><span>카톡 발주 붙여넣기</span><i></i>04</p>
    <p><span>주문 확인하고 고치기</span><i></i>05</p>
    <p><span>주문 목록 보기</span><i></i>06</p>
    <p><span>송장 엑셀 받기</span><i></i>07</p>
    <p><span>출하서 · 하루 마감</span><i></i>08</p>
    <p><span>일부 출고 · 백업</span><i></i>09</p>
    <p class="g">생산라인</p>
    <p><span>오늘 할 일 보기</span><i></i>10</p>
    <p><span>품목별 준비 체크</span><i></i>11</p>
    <p><span>준비완료 · 송장부착</span><i></i>12</p>
    <p class="g">부록</p>
    <p><span>자주 묻는 질문</span><i></i>13</p>
    <p><span>한 장 요약</span><i></i>14</p>
  </div>
`, { sec: '시작하기' }));

// 03 하루 흐름
P.push(page(`
  ${head('THE DAILY FLOW', '하루 흐름 한눈에', '주문 한 건은 다섯 단계를 지나 출하서에 남습니다. 사무실과 생산라인이 같은 주문을 보고, 누가 무엇을 했는지 바로 서로의 화면에 나타납니다.')}
  <div class="flow">
    <div><em>1</em><b>카톡 발주</b><span>단톡방 발주를 복사해 붙여넣기</span><small>사무실</small></div>
    <div><em>2</em><b>주문 저장</b><span>거래처·품목·주소가 자동으로 나뉨</span><small>사무실</small></div>
    <div><em>3</em><b>송장 엑셀</b><span>CJ · 경동 · 대신 양식 그대로</span><small>사무실</small></div>
    <div><em>4</em><b>준비 · 송장부착</b><span>품목별로 체크, 다 되면 준비완료</span><small class="ln">생산라인</small></div>
    <div><em>5</em><b>출하서 마감</b><span>실제 나간 것만 체크해 출고 처리</span><small>사무실</small></div>
  </div>
  <div class="two">
    <div class="role"><h4>사무실이 하는 일</h4><p>발주 입력, 주문 고치기, 송장 출력, 하루 마감. 주로 PC에서.</p></div>
    <div class="role ln"><h4>생산라인이 하는 일</h4><p>오늘 만들 것 확인, 품목별 준비 체크, 송장부착 표시. 휴대폰에서.</p></div>
  </div>
`, { sec: '하루 흐름' }));

// 04 붙여넣기
P.push(page(`
  ${head('OFFICE · 01', '카톡 발주 붙여넣기', '단톡방 대화를 길게 눌러 복사한 뒤 그대로 붙여넣습니다. 잡담과 "확인했습니다" 같은 답은 알아서 빠집니다.')}
  <div class="row">
    ${phone('o1-paste', 44)}${phone('o2-drafts', 44)}
  </div>
  ${steps([['새 주문 탭 → 칸에 붙여넣기', '여러 건을 한 번에 넣어도 됩니다.'], ['나누기', '아래에 주문 카드가 쌓입니다. 주소 없는 단골은 주소록에서 채워집니다.'], ['노란 표시 확인 후 저장', '"배송방법 없음", "품목마스터에 없음"은 카드를 눌러 고칩니다.']])}
`, { sec: '사무실' }));

// 05 고치기
P.push(page(`
  ${head('OFFICE · 02', '주문 확인하고 고치기', '카드를 누르면 고치는 창이 열립니다. 배송 버튼만 누르면 출하서 표기(택배선불, 경동택배선불 등)는 자동으로 맞춰집니다.')}
  <div class="row">
    ${phone('o3-edit', 50)}
    <div class="col">
      ${steps([['품목 · 수량', '줄 단위로 고치고, 품목 추가도 여기서.'], ['출고 예정', '오늘 · 내일 · 준비되면 중에서 고르거나 날짜 직접 선택.'], ['배송', '택배(CJ) · 경동 · 대신 · 직납 · <b>차량출고</b>. 카톡에 "차량출고"라고 쓰면 자동으로 골라집니다.'], ['저장', '생산라인 화면에 바로 반영됩니다.']])}
      ${note('사무실에서 다시 저장해도 생산라인이 해둔 준비 체크는 지워지지 않습니다. 단, 품목 이름을 바꾸면 그 품목의 체크는 새로 해야 합니다.')}
    </div>
  </div>
`, { sec: '사무실' }));

// 06 목록
P.push(page(`
  ${head('OFFICE · 03', '주문 목록 보기', '대기 · 오늘 접수 · 출고완료 · 취소 · 전체로 나눠 봅니다. 검색은 띄어 쓴 낱말이 모두 들어간 주문만 보여 줍니다.')}
  ${shot('p1-list', 'PC 화면 — 날짜별로 묶이고, 생산 진행이 태그로 보입니다', 'wide')}
  <div class="tags">
    <p><span class="t warn">품목 준비 1/2</span>품목 일부만 준비됨</p>
    <p><span class="t ok">준비완료</span>모든 품목 준비 끝</p>
    <p><span class="t ok">송장부착</span>박스에 송장까지 붙임</p>
  </div>
  ${note('<b>고르기</b>를 누르면 여러 건을 한 번에 삭제·출고완료할 수 있습니다. 지운 주문은 더보기 → 삭제기록에서 되살립니다.')}
`, { sec: '사무실' }));

// 07 송장
P.push(page(`
  ${head('OFFICE · 04', '송장 엑셀 받기', '택배사별 업로드 양식 그대로 엑셀을 만듭니다. 열 순서와 머리줄은 기존 양식과 같습니다.')}
  <div class="row">
    ${phone('o5-print', 50)}
    <div class="col">
      ${steps([['택배사 고르기', 'CJ대한통운 · 경동 · 대신.'], ['박스 크기 · 개수', '카드마다 입력. 다른 크기가 섞이면 "+ 다른 크기".'], ['체크한 N건 엑셀 받기', '받은 주문에는 "송장 뽑음" 표시가 붙습니다.'], ['받는 곳 고치기', '직송·지점 배송은 카드에서 바로 수정.']])}
      ${note('맨 위 "오늘 송장 출력" 숫자로 오늘 뽑은 건수를 택배사별로 확인할 수 있습니다. <b>카톡 보고 복사</b>를 누르면 보고용 문장이 복사됩니다.')}
    </div>
  </div>
`, { sec: '사무실' }));

// 08 출하서
P.push(page(`
  ${head('OFFICE · 05', '출하서 · 하루 마감', '실제로 나간 주문만 체크해서 출고 처리합니다. 체크하지 않은 주문은 대기로 남고, 자동으로 체크되는 것은 없습니다.')}
  <div class="row">
    ${phone('o6-close', 50)}
    <div class="col">
      ${steps([['빠른 체크', '송장부착된 것 · 오늘 송장 뽑은 것 · 전체 선택.'], ['출하서 확인용 받기', '중간 확인용. 아무것도 바뀌지 않습니다.'], ['체크한 N건 출고 처리', '출고완료로 바뀌고 출하서 파일이 내려받아집니다.']])}
      ${note('지난 날짜에 송장을 붙이고 출고 처리를 빠뜨린 주문이 있으면 출하서 맨 위에 <b>"출고 처리 안 된 주문 N건"</b>이 뜹니다. <b>그 날짜로 체크</b>를 누르면 날짜를 맞춰 바로 처리할 수 있습니다.', '빠진 마감 알림')}
    </div>
  </div>
  <p class="small">출하서 받는분 칸: 택배·화물은 받는분이 따로 없어도 거래처 / 전화 / 주소가 항상 들어갑니다.</p>
`, { sec: '사무실' }));

// 09 일부 출고 · 백업
P.push(page(`
  ${head('OFFICE · 06', '일부 출고 · 백업', '자재나 검사 때문에 일부만 나가는 날이 있습니다. 나간 수량만 적으면 남은 양은 새 대기 주문으로 자동으로 만들어집니다.')}
  <div class="row">
    ${phone('o7-ship', 44)}${phone('o8-more', 44)}
  </div>
  <div class="two">
    <div class="role"><h4>일부 출고 · 다른 날짜</h4><p>출하서 카드의 버튼. 생산라인이 준비해 둔 수량이 미리 채워져 있습니다. 덜 나간 품목은 사유(자재부족 등)를 고릅니다.</p></div>
    <div class="role"><h4>주문 전체 백업</h4><p>더보기 맨 아래. 모든 주문과 주소록을 엑셀 하나로 받습니다. 한 달에 한 번 받아 두기를 권합니다.</p></div>
  </div>
`, { sec: '사무실' }));

// 10 생산 오늘
P.push(page(`
  ${head('PRODUCTION · 01', '오늘 할 일 보기', '맨 위 카드에 오늘 남은 일이 크게 나옵니다. 운송사별 칸을 누르면 그 운송사 주문만 모아 볼 수 있습니다.')}
  <div class="row">
    ${phone('l1-today', 44)}${phone('l1b-cards', 44)}
  </div>
  ${steps([['내 이름 정하기', '처음 한 번. 누가 준비했는지 사무실에 같이 보입니다.'], ['오늘 · 다음 · 만들 양', '아래 탭으로 오늘 출고, 내일 이후, 품목별 합계를 봅니다.'], ['색으로 구분', 'CJ 파랑 · 경동 빨강 · 대신 초록 · 직납 갈색.']])}
`, { sec: '생산라인', cls: 'ln' }));

// 11 품목별 준비
P.push(page(`
  ${head('PRODUCTION · 02', '품목별 준비 체크', '검사나 자재 사정으로 한 업체 주문이 한 번에 다 안 될 때 씁니다. 품목마다 준비된 만큼 표시해 두면 사무실이 바로 압니다.', true)}
  ${shot('l2-items', '', 'card')}
  <div class="legend">
    <div><i class="ok"></i><b>품목 줄 누르기</b><span>전부 준비. 한 번 더 누르면 취소.</span></div>
    <div><i class="pt"></i><b>수량 버튼</b><span>준비된 개수만 입력. "20 준비"처럼 표시.</span></div>
  </div>
  ${note('STT-1.3 30개 · STT-2.6DE 60개 주문에서 STT-2.6DE만 다 되고 STT-1.3은 20개뿐이라면 — STT-2.6DE 줄을 누르고, STT-1.3은 수량에 20. 사무실 카드에는 "품목 준비 1/2", 만들 양에는 남은 10개만 나옵니다.', '이럴 때')}
`, { sec: '생산라인', cls: 'ln' }));

// 12 준비완료 · 송장부착
P.push(page(`
  ${head('PRODUCTION · 03', '준비완료 · 송장부착', '주문 전체가 끝났으면 카드 아래 버튼 하나로 끝냅니다. 누르면 품목 체크가 모두 자동으로 채워집니다.', true)}
  <div class="row">
    <div class="col">${shot('l3-auto', '', 'card')}
      ${steps([['준비완료', '모든 품목이 ✓ 로 바뀝니다.'], ['송장부착', '준비완료도 같이 켜지고 품목 전부 ✓. 직납은 "출고준비".'], ['자동으로 켜짐', '품목을 하나씩 다 체크해도 준비완료가 저절로 켜집니다.'], ['하나라도 모자라면', '품목 수량을 줄이면 준비완료 · 송장부착이 꺼집니다.']])}
    </div>
    ${phone('l4-sum', 40)}
  </div>
`, { sec: '생산라인', cls: 'ln' }));

// 13 FAQ
const faq = [
  ['화면에 "새 버전이 있습니다"가 떠요', '띠를 누르면 새로고침되어 최신 화면으로 바뀝니다. 입력 중이던 내용이 있으면 저장부터 하세요.'],
  ['생산 체크가 사무실에 안 보여요', '사무실 화면에서 새로고침을 누르세요. 저장은 바로 되지만 화면은 새로고침해야 갱신됩니다.'],
  ['체크를 잘못 눌렀어요', '같은 줄을 한 번 더 누르면 취소됩니다. 준비완료를 끄면 품목 체크도 함께 지워집니다.'],
  ['일부만 보냈는데 남은 건 어디 있나요', '주문 목록 대기에 "잔량"이 붙은 새 주문으로 있습니다. 원래 주문과 연결되어 있습니다.'],
  ['"다음주 목요일" 같은 날짜가 안 잡혀요', '내일 · 준비되면만 자동으로 알아봅니다. 그 밖의 날짜는 주문을 열어 직접 고르세요.'],
  ['사진으로 온 발주는요', '읽지 못합니다. 새 주문 → 직접 입력으로 넣어 주세요.'],
  ['데이터가 날아갈까 걱정돼요', '모든 주문은 회사 구글 시트에 저장됩니다. 더보기 → 주문 전체 백업으로 엑셀도 받아 둘 수 있습니다.'],
];
P.push(page(`
  ${head('APPENDIX', '자주 묻는 질문')}
  <div class="faq">${faq.map(q => `<div><b>${q[0]}</b><p>${q[1]}</p></div>`).join('')}</div>
`, { sec: '부록' }));

// 14 요약
P.push(page(`
  <div class="kicker light">QUICK REFERENCE</div><h2 class="light">한 장 요약</h2>
  <div class="qr">
    <div><h4>사무실 · 아침</h4><p>카톡 발주 붙여넣기 → 나누기 → 노란 표시 고치고 저장</p></div>
    <div><h4>사무실 · 오후</h4><p>송장 탭에서 택배사별 엑셀 받기 → 택배사 사이트에 올리기</p></div>
    <div><h4>생산라인 · 하루 종일</h4><p>품목 줄 누르기(전부) · 수량(일부) → 다 되면 송장부착</p></div>
    <div><h4>사무실 · 마감</h4><p>출하서 → 실제 나간 것만 체크 → 출고 처리. 빠진 마감 알림 확인</p></div>
    <div><h4>한 달에 한 번</h4><p>더보기 → 주문 전체 백업 받아 두기</p></div>
  </div>
  <div class="bk-foot"><span>써브텍 주문앱 사용 안내서</span><span>${VER} · 2026. 11</span></div>
`, { sec: '요약', cls: 'back' }));

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><style>
${FONTS}
@page{size:148mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:P,'Pretendard','WenQuanYi Zen Hei',sans-serif;color:#1D2024;-webkit-print-color-adjust:exact;print-color-adjust:exact;word-break:keep-all}
.page{width:148mm;height:210mm;position:relative;overflow:hidden;page-break-after:always;background:#FAF8F4;padding:17mm 14mm 16mm}
.run{position:absolute;top:8mm;left:14mm;right:14mm;display:flex;justify-content:space-between;font-size:5.6pt;letter-spacing:.24em;color:#A39A8C;font-weight:600}
.run span:last-child{letter-spacing:.06em}
.folio{position:absolute;bottom:8mm;right:14mm;font-size:6.5pt;color:#8C8375;font-weight:600;display:flex;align-items:center;gap:2mm;letter-spacing:.05em}
.folio i{display:inline-block;width:6mm;height:.25mm;background:#C9BFAF}
.kicker{font-size:6.6pt;letter-spacing:.28em;color:#9C6B2F;font-weight:700;display:flex;align-items:center;gap:2mm}
.kicker em{font-style:normal;letter-spacing:.12em;background:#1D2024;color:#E9D8B8;font-size:5.6pt;padding:.6mm 1.8mm;border-radius:.8mm}
h2{font-size:18.5pt;font-weight:800;letter-spacing:-.03em;margin:1.8mm 0 2.6mm;line-height:1.2}
.lead{font-size:8.4pt;line-height:1.7;color:#50555D;margin:0 0 5mm}
.row{display:flex;gap:6mm;align-items:flex-start;justify-content:center}
.col{flex:1;min-width:0}
.phone{margin:0;flex:none;border:1.8mm solid #1D2024;border-radius:5.5mm;overflow:hidden;background:#1D2024;box-shadow:0 2.5mm 6mm rgba(29,32,36,.16),0 .5mm 1.2mm rgba(29,32,36,.12)}
.phone img{display:block;width:100%;border-radius:3.6mm}
.phone.flat{box-shadow:0 4mm 10mm rgba(0,0,0,.35)}
.shot{margin:0 0 4mm}
.shot img{display:block;width:100%;border-radius:2.5mm;box-shadow:0 2mm 5mm rgba(29,32,36,.14);border:.25mm solid #E4DDD1}
.shot.card img{border-radius:3mm}
.shot figcaption{font-size:6.6pt;color:#8C8375;margin-top:2mm;text-align:center}
.steps{list-style:none;margin:5mm 0 0;padding:0;counter-reset:s}
.col .steps{margin-top:0}
.steps li{counter-increment:s;position:relative;padding:0 0 3.2mm 8mm;font-size:8pt;line-height:1.55}
.steps li:before{content:counter(s);position:absolute;left:0;top:.2mm;width:5mm;height:5mm;border-radius:50%;border:.3mm solid #9C6B2F;color:#9C6B2F;font-size:6.6pt;font-weight:700;display:flex;align-items:center;justify-content:center}
.steps li>b{display:block;font-weight:700;font-size:8.6pt;color:#1D2024}
.steps li span{color:#5C6169}
.note{background:#F1EBE0;border-left:.8mm solid #9C6B2F;padding:3mm 3.5mm;font-size:7.6pt;line-height:1.65;color:#3E434A;margin-top:4mm;border-radius:0 1.5mm 1.5mm 0}
.note strong{display:block;font-size:7.8pt;color:#7A5222;margin-bottom:.8mm}
.small{font-size:7pt;color:#6B7078;line-height:1.6;margin-top:4mm;border-top:.25mm solid #E1D9CC;padding-top:2.5mm}
.two{display:flex;gap:4mm;margin-top:5mm}
.role{flex:1;background:#fff;border:.25mm solid #E4DDD1;border-radius:2mm;padding:3.5mm}
.role h4{margin:0 0 1.2mm;font-size:8.6pt;font-weight:700}
.role p{margin:0;font-size:7.4pt;line-height:1.6;color:#5C6169}
.role.ln{border-top:.8mm solid #9C6B2F}
.addr{display:flex;flex-direction:column;gap:2.5mm;margin-bottom:2mm}
.addr div{background:#fff;border:.25mm solid #E4DDD1;border-radius:2mm;padding:3mm 3.5mm;display:grid;grid-template-columns:16mm 1fr;row-gap:.6mm}
.addr span{grid-row:span 2;font-size:6.6pt;font-weight:700;letter-spacing:.1em;color:#9C6B2F;align-self:center}
.addr b{font-size:9pt}
.addr p{margin:0;font-size:7.2pt;color:#6B7078}
code{font-family:inherit;background:#F1EBE0;padding:.2mm 1.2mm;border-radius:.8mm;color:#7A5222}
.toc{margin-top:5mm}
.toc h3{font-size:7pt;letter-spacing:.28em;color:#9C6B2F;margin:0 0 2mm}
.toc p{display:flex;align-items:baseline;gap:2mm;margin:0;font-size:8pt;line-height:1.95}
.toc p i{flex:1;border-bottom:.25mm dotted #BDB2A1;transform:translateY(-1mm)}
.toc p.g{font-size:6.4pt;letter-spacing:.2em;color:#A39A8C;font-weight:700;margin-top:1.6mm;line-height:1.6}
.flow{position:relative;margin:2mm 0 3mm;padding-left:2mm}
.flow:before{content:'';position:absolute;left:6.5mm;top:5mm;bottom:5mm;width:.3mm;background:#CDBFA8}
.flow div{position:relative;display:grid;grid-template-columns:11mm 1fr auto;align-items:center;padding:2.6mm 0}
.flow em{font-style:normal;width:9mm;height:9mm;border-radius:50%;background:#1D2024;color:#E9D8B8;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:9pt;z-index:1}
.flow b{font-size:9.4pt;display:block}
.flow span{grid-column:2;font-size:7.2pt;color:#6B7078;margin-top:.4mm}
.flow small{grid-column:3;grid-row:1/span 2;font-size:6.2pt;letter-spacing:.08em;border:.25mm solid #CDBFA8;color:#6B7078;padding:.6mm 2mm;border-radius:5mm}
.flow small.ln{background:#9C6B2F;border-color:#9C6B2F;color:#fff}
.tags{display:flex;flex-direction:column;gap:1.8mm;margin:1mm 0}
.tags p{margin:0;font-size:7.6pt;color:#50555D;display:flex;align-items:center;gap:3mm}
.t{display:inline-block;min-width:24mm;text-align:center;font-size:6.8pt;font-weight:700;padding:.8mm 2mm;border-radius:1mm}
.t.warn{background:#FCEFD9;color:#9A5B07}
.t.ok{background:#E3F2E6;color:#256A35}
.legend{display:flex;gap:4mm}
.legend div{flex:1;background:#fff;border:.25mm solid #E4DDD1;border-radius:2mm;padding:3mm;display:grid;grid-template-columns:7mm 1fr;row-gap:.6mm}
.legend i{grid-row:span 2;width:5mm;height:5mm;border-radius:1.2mm;align-self:center}
.legend i.ok{background:#256A35}
.legend i.pt{background:#C98A1B}
.legend b{font-size:8pt}
.legend span{font-size:7pt;color:#6B7078;line-height:1.5}
.faq div{padding:3mm 0;border-bottom:.25mm solid #E1D9CC}
.faq div:first-child{border-top:.25mm solid #1D2024}
.faq b{font-size:8.4pt;display:flex;gap:2mm}
.faq b:before{content:'Q';color:#9C6B2F;font-weight:800}
.faq p{margin:1mm 0 0 4.2mm;font-size:7.5pt;line-height:1.65;color:#5C6169}
/* 표지 · 뒷표지 */
.cover,.back{background:#1C1F23;color:#F4EEE3}
.frame{position:absolute;inset:7mm;border:.3mm solid #8E6B3A}
.cv-top{position:absolute;top:15mm;left:0;right:0;text-align:center;font-size:6pt;letter-spacing:.42em;color:#B89463;font-weight:600}
.cv-title{position:absolute;top:31mm;left:0;right:0;text-align:center;font-size:27pt;font-weight:800;letter-spacing:-.03em;line-height:1.2}
.cv-title small{display:block;font-size:8pt;font-weight:500;letter-spacing:.3em;color:#B89463;margin-bottom:3mm}
.cv-title span{display:block;font-size:13pt;font-weight:500;letter-spacing:.18em;color:#D9CBB3;margin-top:2mm}
.cv-rule{position:absolute;top:72mm;left:50%;width:14mm;margin-left:-7mm;height:.3mm;background:#B89463}
.cv-sub{position:absolute;top:77mm;left:0;right:0;text-align:center;font-size:7.6pt;line-height:1.8;color:#A9A194}
.cv-phone{position:absolute;top:100mm;left:0;right:0;display:flex;justify-content:center}
.cv-phone .phone{border-color:#2A2E34}
.cv-foot,.bk-foot{position:absolute;bottom:13mm;left:14mm;right:14mm;display:flex;justify-content:space-between;font-size:6pt;letter-spacing:.16em;color:#8E8578}
.back .run{color:#6F675C}
.back .folio{color:#6F675C}
.kicker.light{color:#B89463}
h2.light{color:#F4EEE3}
.qr{margin-top:6mm;border-top:.3mm solid #8E6B3A}
.qr div{display:grid;grid-template-columns:30mm 1fr;gap:3mm;padding:4.2mm 0;border-bottom:.25mm solid #3A3E44}
.qr h4{margin:0;font-size:7.6pt;color:#D9B98A;font-weight:700;letter-spacing:.04em}
.qr p{margin:0;font-size:8pt;line-height:1.6;color:#E6DFD3}
</style></head><body>${P.join('')}</body></html>`;

(async () => {
  const out = path.join(M, 'book.html'); fs.writeFileSync(out, html);
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + out); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const pdf = path.join(M, '써브텍주문앱_실무가이드.pdf');
  await p.pdf({ path: pdf, width: '148mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
  // 확인용 페이지 그림
  await p.setViewportSize({ width: 560, height: 794 });
  const n = await p.locator('.page').count();
  for (let i = 0; i < n; i++) await p.locator('.page').nth(i).screenshot({ path: path.join(process.env.PREVIEW_DIR || M, 'pv-' + String(i + 1).padStart(2, '0') + '.png') });
  await b.close(); fs.unlinkSync(out); console.log('PDF →', pdf, n + '쪽');
})().catch(e => { console.error(e); process.exit(1); });
