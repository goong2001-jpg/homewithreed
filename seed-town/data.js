/* 씨앗 마을 — 숫자·가게·소식·배지·스승이 전부 이 파일에 있다.
 * 밸런스나 내용은 여기만 고치면 된다. 고친 뒤 index.html·sw.js 의 ?v= 숫자와 version.json 을 올린다.
 * 브라우저(window.SEED_DATA)와 node(test/smoke.js) 양쪽에서 읽는다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SEED_DATA = factory();
})(this, function () {

  var RULES = {
    startCoins: 12,     // 처음 가진 동전
    allowance: 2,       // 계절마다 받는 심부름 동전
    turnsPerDay: 4,     // 하루에 넘길 수 있는 계절 수 (4 = 하루에 1년). 아래 표에 없는 단계에 쓴다
    turnsByStage: { seed: 0, sprout: 0, tree: 0, forest: 0, world: 0 },   // 단계별 하루 제한. 0 = 제한 없음. 지금은 모든 단계가 제한 없음(다시 걸려면 숫자만 넣는다)
    profileStage: { '구름': 'seed', '열매': 'seed', '아빠': 'world', '엄마': 'world' },   // 처음 시작할 때의 단계. 어른 메뉴에서 바꿀 수 있다
    shares: 50,         // 가게 하나의 전체 씨앗(주식) 수. 작을수록 열매가 자주 열린다
    welcomeFruit: 0.75,  // 가게에 처음 심을 때 열매가 이만큼 자란 채로 시작한다(가게마다 한 번). 첫날 열매를 보게 하려는 것
    reinvestRoi: 0.13,  // 가게가 남긴 돈을 다시 쓸 때 장사가 커지는 비율
    interest: 0.02,     // 빚 이자 (계절마다)
    closeDebt: 1.6,      // 빚이 기본 매출의 이 배수를 넘으면 문을 닫는다
    reopenAfter: 4,     // 문 닫은 자리에 새 가게가 들어오기까지 계절 수
    rumorFrom: 8,       // 이 계절부터 "소문" 카드가 섞인다
    treeTiers: [1, 3, 8, 20],   // 내 몫이 이 동전 이상이면 새싹 → 작은 나무 → 큰 나무 → 아주 큰 나무
    profiles: ['구름', '열매', '아빠', '엄마']
  };

  var SEASONS = [
    { id: 'spring', name: '봄', sky: '#f6ecd6', ground: '#cfd9a4' },
    { id: 'summer', name: '여름', sky: '#eaf0d4', ground: '#b9cf8e' },
    { id: 'fall', name: '가을', sky: '#f6e2c0', ground: '#dcc189' },
    { id: 'winter', name: '겨울', sky: '#e9eeee', ground: '#e6e4d8' }
  ];

  /* 가게(회사). 씨앗 단계에서는 그림만 보이지만 뒤에서는 매 계절 진짜 장부가 돌아간다.
   * base 한 계절 기본 매출 / varCost 팔 때마다 드는 돈 비율 / fixed 가만히 있어도 나가는 돈
   * payout 번 돈 중 주인에게 나눠 주는 비율 / reinvest 남긴 돈 중 가게를 키우는 데 쓰는 비율
   * season [봄,여름,가을,겨울] 매출 배수 / vol 들쭉날쭉한 정도 / cash 가진 돈 / debt 빚 */
  var SHOPS = [
    { id: 'bread', name: '솔솔 빵집', kind: '빵집', color: '#d99a4e', roof: '#b5533c', shape: 'awning', sign: 'bread',
      desc: '날마다 빵을 구워요. 손님이 꾸준히 와요.',
      base: 30, varCost: 0.55, fixed: 9, payout: 0.6, reinvest: 0.3, season: [1, 1, 1, 1.05], vol: 0.05, cash: 10, debt: 0 },
    { id: 'fruit', name: '달콤 과일가게', kind: '과일가게', color: '#8fb36a', roof: '#d1673f', shape: 'tri', sign: 'apple',
      desc: '제철 과일을 팔아요. 여름에 손님이 많아요.',
      base: 26, varCost: 0.6, fixed: 6.5, payout: 0.5, reinvest: 0.4, season: [1, 1.25, 1.05, 0.75], vol: 0.1, cash: 8, debt: 0 },
    { id: 'toy', name: '반짝 장난감', kind: '장난감 가게', color: '#e3b23c', roof: '#7c6aa8', shape: 'flat', sign: 'star',
      desc: '겨울에 아주 잘 팔려요. 그런데 빚이 좀 있어요.',
      base: 34, varCost: 0.5, fixed: 14.6, payout: 0.2, reinvest: 0.5, season: [0.9, 0.9, 0.95, 1.4], vol: 0.25, cash: 3, debt: 40 },
    { id: 'bike', name: '씽씽 자전거', kind: '자전거 가게', color: '#6fa3a0', roof: '#3f6f6c', shape: 'dome', sign: 'wheel',
      desc: '아직 작지만 번 돈으로 가게를 키워요. 열매는 적게 줘요.',
      base: 22, varCost: 0.5, fixed: 8, payout: 0.1, reinvest: 0.6, season: [1.2, 1.15, 1, 0.65], vol: 0.12, cash: 6, debt: 0 },
    { id: 'book', name: '별빛 책방', kind: '책방', color: '#c9a27a', roof: '#5c7a4a', shape: 'tri', sign: 'book',
      desc: '조용하지만 늘 그대로예요. 열매를 많이 나눠 줘요.',
      base: 20, varCost: 0.45, fixed: 7.5, payout: 0.7, reinvest: 0.2, season: [1, 1, 1, 1], vol: 0.04, cash: 8, debt: 0 },
    { id: 'ice', name: '눈꽃 아이스크림', kind: '아이스크림 가게', color: '#e8a9a0', roof: '#c96a7a', shape: 'awning', sign: 'cone',
      desc: '여름엔 줄을 서요. 겨울엔 손님이 거의 없어요.',
      base: 28, varCost: 0.45, fixed: 11.5, payout: 0.5, reinvest: 0.4, season: [0.9, 1.7, 0.8, 0.4], vol: 0.12, cash: 12, debt: 0 }
  ];

  /* 소식 카드. kind: good(좋은 소식) / bad(나쁜 소식) / rumor(소문 — 정답은 "아직 몰라요")
   * sales 매출이 이만큼 늘거나 줆(0.3 = 30%) / cost 계절마다 더 나가는 돈 / turns 몇 계절 이어지는지
   * 소문의 dir: -1 은 사실일 때 나쁜 쪽으로 움직인다는 뜻(없으면 좋은 쪽).
   * shop 'all' 은 마을 전체. after 는 계절이 지난 뒤 보여 주는 한 줄. */
  var NEWS = [
    { id: 'bread1', shop: 'bread', kind: 'good', sales: 0.3, turns: 2, text: '빵집에 새 오븐이 들어왔어요. 빵을 더 많이 구울 수 있어요.', after: '빵이 많이 팔렸어요.' },
    { id: 'bread2', shop: 'bread', kind: 'bad', cost: 4, turns: 2, text: '밀가루 값이 올랐어요. 빵 만드는 데 돈이 더 들어요.', after: '빵집이 남긴 돈이 줄었어요.' },
    { id: 'bread3', shop: 'bread', kind: 'good', sales: 0.25, turns: 2, text: '빵집의 새 크림빵이 맛있다고 모두 말해요.', after: '크림빵이 금방 다 팔렸어요.' },
    { id: 'bread4', shop: 'bread', kind: 'bad', sales: 0.3, turns: 2, text: '빵집 앞 길을 고쳐서 손님이 지나가기 힘들어요.', after: '빵집 손님이 줄었어요.' },
    { id: 'fruit1', shop: 'fruit', kind: 'good', sales: 0.3, turns: 2, text: '올해 과일이 아주 달게 익었어요.', after: '과일이 잘 팔렸어요.' },
    { id: 'fruit2', shop: 'fruit', kind: 'bad', sales: 0.35, turns: 2, text: '태풍이 와서 과일이 많이 떨어졌어요.', after: '팔 과일이 모자랐어요.' },
    { id: 'fruit3', shop: 'fruit', kind: 'good', sales: 0.25, turns: 2, text: '과일가게가 과일 주스도 팔기 시작했어요.', after: '주스를 사러 손님이 왔어요.' },
    { id: 'fruit4', shop: 'fruit', kind: 'bad', cost: 3, turns: 2, text: '과일가게 냉장고가 고장 나서 고쳐야 해요.', after: '고치는 데 돈이 들었어요.' },
    { id: 'toy1', shop: 'toy', kind: 'good', sales: 0.4, turns: 2, text: '장난감 가게의 새 로봇이 친구들 사이에서 인기예요.', after: '로봇이 불티나게 팔렸어요.' },
    { id: 'toy2', shop: 'toy', kind: 'bad', sales: 0.35, turns: 2, text: '장난감 가게 장난감이 잘 부서진다는 말이 많아요.', after: '장난감을 사는 사람이 줄었어요.' },
    { id: 'toy3', shop: 'toy', kind: 'bad', cost: 5, turns: 2, text: '장난감 가게가 빌린 돈을 갚아야 할 날이 왔어요.', after: '돈을 갚느라 남은 게 적어요.' },
    { id: 'toy4', shop: 'toy', kind: 'good', sales: 0.3, turns: 2, text: '장난감 가게에서 만화 주인공 인형을 팔게 됐어요.', after: '인형이 많이 팔렸어요.' },
    { id: 'bike1', shop: 'bike', kind: 'good', sales: 0.35, turns: 2, text: '마을에 자전거 길이 새로 생겼어요.', after: '자전거를 사는 사람이 늘었어요.' },
    { id: 'bike2', shop: 'bike', kind: 'bad', sales: 0.3, turns: 2, text: '비가 오래 와서 자전거 타는 사람이 없어요.', after: '자전거가 잘 안 팔렸어요.' },
    { id: 'bike3', shop: 'bike', kind: 'good', sales: 0.25, turns: 3, text: '자전거 가게가 고장 난 자전거도 고쳐 주기로 했어요.', after: '고치러 오는 손님이 생겼어요.' },
    { id: 'bike4', shop: 'bike', kind: 'bad', cost: 3, turns: 2, text: '자전거 바퀴 값이 올랐어요.', after: '자전거 만드는 데 돈이 더 들었어요.' },
    { id: 'book1', shop: 'book', kind: 'good', sales: 0.3, turns: 2, text: '책방에 재미있는 새 그림책이 나왔어요.', after: '그림책을 사러 많이 왔어요.' },
    { id: 'book2', shop: 'book', kind: 'bad', sales: 0.25, turns: 2, text: '옆 마을에 큰 책방이 새로 생겼어요.', after: '책방 손님이 조금 줄었어요.' },
    { id: 'book3', shop: 'book', kind: 'good', sales: 0.25, turns: 2, text: '학교에서 책 읽기 대회를 열어요.', after: '책이 많이 팔렸어요.' },
    { id: 'book4', shop: 'book', kind: 'bad', cost: 2.5, turns: 2, text: '책방 지붕에서 비가 새서 고쳐야 해요.', after: '고치는 데 돈이 들었어요.' },
    { id: 'ice1', shop: 'ice', kind: 'good', sales: 0.35, turns: 2, text: '올해는 날씨가 아주 덥대요.', after: '아이스크림이 많이 팔렸어요.' },
    { id: 'ice2', shop: 'ice', kind: 'bad', sales: 0.35, turns: 2, text: '올해는 날씨가 서늘하대요.', after: '아이스크림을 찾는 사람이 적었어요.' },
    { id: 'ice3', shop: 'ice', kind: 'good', sales: 0.3, turns: 2, text: '아이스크림 가게에 딸기 맛이 새로 나왔어요.', after: '딸기 맛이 인기였어요.' },
    { id: 'ice4', shop: 'ice', kind: 'bad', cost: 4, turns: 2, text: '우유 값이 올랐어요. 아이스크림 만드는 데 돈이 더 들어요.', after: '남긴 돈이 줄었어요.' },
    { id: 'all1', shop: 'all', kind: 'good', sales: 0.2, turns: 1, text: '마을에 큰 축제가 열려요. 사람이 많이 놀러 와요.', after: '가게마다 손님이 많았어요.' },
    { id: 'all2', shop: 'all', kind: 'bad', sales: 0.2, turns: 1, text: '감기가 돌아서 사람들이 집에만 있어요.', after: '가게마다 손님이 적었어요.' },
    { id: 'rum1', shop: 'toy', kind: 'rumor', sales: 0.4, turns: 2, text: '장난감 가게가 아주 큰 가게가 된다는 소문이 있어요.', after: '소문이었어요.' },
    { id: 'rum2', shop: 'bike', kind: 'rumor', dir: -1, sales: 0.35, turns: 2, text: '자전거 가게가 곧 문을 닫는다는 소문이 돌아요.', after: '소문이었어요.' },
    { id: 'rum3', shop: 'ice', kind: 'rumor', sales: 0.35, turns: 2, text: '누가 그러는데 아이스크림 가게가 대박이 난대요.', after: '소문이었어요.' },
    { id: 'rum4', shop: 'bread', kind: 'rumor', dir: -1, sales: 0.3, turns: 2, text: '빵집 빵이 맛없어졌다는 소문이 있어요.', after: '소문이었어요.' },
    // ---- 나무 단계부터: 공시 카드(kind 'disc'). answer 가 정답, sales 는 부호를 직접 적는다.
    // sharesMul 주식 수 배수(유상증자 >1, 소각 <1) / priceMul 값만 잠깐 움직임 / explain 결과 창의 풀이
    { id: 'd_raise1', stage: 'tree', shop: 'toy', kind: 'disc', answer: 'bad', sharesMul: 1.25, title: '주요사항보고서 (유상증자 결정)',
      text: '장난감 가게가 새 주식을 25% 더 찍어서 팔기로 했습니다. 받은 돈은 빚을 갚는 데 씁니다.',
      explain: '주식 수가 늘면 한 주가 갖는 몫이 줄어듭니다(희석). 회사에는 돈이 들어오지만, 기존 주주에게는 보통 나쁜 소식입니다. 그 돈을 어디에 쓰는지 꼭 봅니다.' },
    { id: 'd_raise2', stage: 'tree', shop: 'bike', kind: 'disc', answer: 'bad', sharesMul: 1.2, title: '주요사항보고서 (유상증자 결정)',
      text: '자전거 가게가 새 주식을 20% 더 찍어서 팔기로 했습니다. 받은 돈으로 가게를 넓힙니다.',
      explain: '주식 수가 늘어 한 주의 몫은 줄었습니다. 다만 그 돈으로 장사를 키우면 나중에 만회할 수도 있습니다. 당장은 희석이 먼저 옵니다.' },
    { id: 'd_burn1', stage: 'tree', shop: 'bread', kind: 'disc', answer: 'good', sharesMul: 0.92, title: '주요사항보고서 (자기주식 취득 및 소각 결정)',
      text: '빵집이 가진 돈으로 자기 주식을 8% 사들여 없애기로 했습니다.',
      explain: '주식 수가 줄면 남은 한 주가 갖는 몫이 커집니다. 회사 돈은 줄지만 주주에게는 보통 좋은 소식입니다.' },
    { id: 'd_burn2', stage: 'tree', shop: 'book', kind: 'disc', answer: 'good', sharesMul: 0.93, title: '주요사항보고서 (자기주식 취득 및 소각 결정)',
      text: '책방이 가진 돈으로 자기 주식을 7% 사들여 없애기로 했습니다.',
      explain: '같은 이익을 더 적은 주식이 나눠 갖게 됩니다. 주주에게 돈을 돌려주는 방법 중 하나입니다.' },
    { id: 'd_sell1', stage: 'tree', shop: 'ice', kind: 'disc', answer: 'unknown', priceMul: 0.9, title: '임원·주요주주 특정증권등 소유상황보고서',
      text: '아이스크림 가게의 가장 큰 주인이 자기 주식 일부를 팔았습니다.',
      explain: '주가는 잠깐 내렸지만 가게 장부(매출·이익)는 그대로입니다. 왜 팔았는지에 따라 뜻이 달라서, 이 공시만으로는 좋다 나쁘다를 알 수 없습니다.' },
    { id: 'd_sell2', stage: 'tree', shop: 'fruit', kind: 'disc', answer: 'unknown', priceMul: 0.92, title: '임원·주요주주 특정증권등 소유상황보고서',
      text: '과일가게의 가장 큰 주인이 자기 주식 일부를 팔았습니다.',
      explain: '장부는 바뀌지 않았습니다. 큰 주인이 판 이유(개인 사정인지, 회사 앞날을 어둡게 보는지)를 더 알아봐야 합니다.' },
    { id: 'd_earn1', stage: 'tree', shop: 'bike', kind: 'disc', answer: 'good', sales: 0.3, turns: 2, title: '영업(잠정)실적 공시',
      text: '자전거 가게의 이번 분기 매출이 예상보다 30% 많았다고 발표했습니다.',
      explain: '실적 공시는 소문이 아니라 회사가 직접 밝힌 숫자입니다. 매출이 늘면 고정비는 그대로라 이익은 더 크게 늡니다.' },
    { id: 'd_earn2', stage: 'tree', shop: 'ice', kind: 'disc', answer: 'bad', sales: -0.3, turns: 2, title: '영업(잠정)실적 공시',
      text: '아이스크림 가게의 이번 분기 매출이 예상보다 30% 적었다고 발표했습니다.',
      explain: '매출이 줄어도 고정비는 그대로 나가서 이익은 더 크게 줄어듭니다.' },
    // 위기 카드: 실제 있었던 일을 본뜬 마을 전체 충격. note 는 결과 창에 뜨는 역사 한 줄.
    { id: 'c1997', stage: 'tree', shop: 'all', kind: 'bad', sales: 0.35, turns: 3, title: '위기: 나라에 달러가 모자라요',
      text: '나라 전체에 돈이 말라서 가게마다 손님이 뚝 끊겼습니다.',
      after: '모든 가게가 힘든 계절을 보냈어요.', note: '본뜬 일: 1997년 외환위기. 한국은 1997년 11월 IMF 에 구제금융을 신청했습니다.' },
    { id: 'c2008', stage: 'tree', shop: 'all', kind: 'bad', sales: 0.3, turns: 3, title: '위기: 큰 은행이 무너졌어요',
      text: '먼 나라의 큰 은행이 망하면서 온 세상 사람들이 지갑을 닫았습니다.',
      after: '모든 가게가 힘든 계절을 보냈어요.', note: '본뜬 일: 2008년 글로벌 금융위기. 2008년 9월 미국 투자은행 리먼 브러더스가 파산했습니다.' },
    { id: 'c2020', stage: 'tree', shop: 'all', kind: 'bad', sales: 0.3, turns: 2, title: '위기: 큰 전염병이 돌아요',
      text: '전염병이 퍼져서 사람들이 밖에 나오지 못합니다.',
      after: '모든 가게가 힘든 계절을 보냈어요.', note: '본뜬 일: 2020년 코로나19. 2020년 3월 세계보건기구(WHO)가 세계적 대유행을 선언했습니다.' },
    { id: 'rum5', shop: 'fruit', kind: 'rumor', sales: 0.3, turns: 2, text: '과일가게에 임금님이 오신다는 소문이 있어요.', after: '소문이었어요.' }
  ];

  /* 배지 = 배움 하나. type 은 engine.js 의 checkBadges 가 판정한다.
   * first 첫 씨앗 / shops n곳에 심기 / hold 한 가게에 n계절 그대로 두기 / harvest 열매 n개 따기
   * news 소식 n번 맞히기 / rumor 소문 n번 알아보기 / year n년 지나기 / wealth 마을 보물 n개
   * storm 힘든 가게가 있었는데도 보물이 늘어남 / buyBad 힘들었던 가게에 심기
   * talk 는 어른 메뉴에 뜨는 "아이와 나눌 한마디". mentor 는 MENTORS 의 id. */
  var BADGES = [
    { id: 'owner', type: 'first', name: '나도 주인', text: '가게에 처음으로 동전을 심었어요.', talk: '동전을 심으면 그 가게의 주인 중 한 명이 되는 거야. 어느 가게 주인이 됐어?' },
    { id: 'three', type: 'shops', n: 3, name: '나눠 담기', text: '가게 세 곳에 나눠 심었어요.', talk: '한 가게가 힘들어도 다른 가게가 있으면 괜찮아. 왜 나눠 심으면 좋을까?' },
    { id: 'all', type: 'shops', n: 6, name: '온 마을 주인', text: '모든 가게에 씨앗을 심었어요.', mentor: 'bogle', talk: '어느 가게가 잘될지 몰라도 다 조금씩 가지면 마을이 크는 만큼 같이 커.' },
    { id: 'wait', type: 'hold', n: 8, name: '기다림', text: '한 가게를 2년 동안 꺼내지 않고 기다렸어요.', mentor: 'buffett', talk: '기다리는 동안 나무가 얼마나 자랐는지 같이 봐 볼까?' },
    { id: 'fruit10', type: 'harvest', n: 10, name: '열매 열 개', text: '열매를 열 개 땄어요.', talk: '열매는 가게가 번 돈을 주인에게 나눠 주는 거야. 딴 열매로 뭘 했어?' },
    { id: 'news5', type: 'news', n: 5, name: '소식 박사', text: '소식을 다섯 번 맞혔어요.', talk: '오늘 소식은 왜 좋은 소식(나쁜 소식)이라고 생각했어?' },
    { id: 'rumor3', type: 'rumor', n: 3, name: '소문은 소문', text: '소문을 세 번 알아봤어요.', talk: '"~라는 소문이 있어요"는 아직 아무도 모르는 이야기야. 진짜 소식이랑 뭐가 달라?' },
    { id: 'storm', type: 'storm', name: '비 와도 괜찮아', text: '힘든 가게가 있었지만 마을 보물은 늘었어요.', talk: '한 가게가 힘들었는데 왜 전체는 늘었을까?' },
    { id: 'brave', type: 'buyBad', name: '겁내지 않기', text: '힘든 계절을 보낸 가게에 씨앗을 심었어요.', mentor: 'templeton', talk: '힘들 때 심은 가게가 나중에 어떻게 되는지 지켜보자.' },
    // ---- 새싹부터 (stage 가 있으면 그 단계부터 받을 수 있다). stat 은 engine 의 P.stats 이름 ----
    { id: 'lines', type: 'stat', stat: 'line', n: 5, stage: 'sprout', name: '성적표 읽기', text: '소식이 성적표의 어느 줄을 바꾸는지 다섯 번 맞혔어요.', talk: '번 돈이 늘어나는 소식이랑 쓴 돈이 늘어나는 소식은 뭐가 달라?' },
    { id: 'know', type: 'stat', stat: 'informed', n: 5, stage: 'sprout', name: '알고 심기', text: '성적표를 보고 나서 심기를 다섯 번 했어요.', mentor: 'lynch', talk: '그 가게가 뭘 팔아서 돈을 버는지 말해 줄 수 있어?' },
    { id: 'margin', type: 'stat', stat: 'cheap', n: 3, stage: 'tree', name: '싸게 사기', text: '평소 값보다 20% 넘게 쌀 때 세 번 샀어요.', mentor: 'graham', talk: '값이 싸진 이유가 잠깐의 일인지, 가게가 정말 나빠진 건지 어떻게 구별할까?' },
    { id: 'why5', type: 'stat', stat: 'reasoned', n: 5, stage: 'forest', name: '이유 있는 투자', text: '이유를 적고 사기를 다섯 번 했어요.', mentor: 'munger', talk: '이유를 한 줄로 적을 수 없는 투자는 하지 않는다.' },
    { id: 'read9', type: 'stat', stat: 'quiz', n: 9, stage: 'forest', name: '공시 읽기', text: '공시 읽기 문제를 아홉 개 맞혔어요.' },
    { id: 'real3', type: 'stat', stat: 'real', n: 3, stage: 'world', name: '세계로', text: '실제 회사 세 곳의 재무제표를 넣고 읽었어요.', talk: '세 회사 중 빚이 가장 적은 곳은 어디였나?' },
    { id: 'pred3', type: 'stat', stat: 'pred', n: 3, stage: 'world', name: '복기하는 투자자', text: '다음 실적 예측을 세 번 맞혔어요.', talk: '맞힌 예측은 이유도 맞았나, 운이었나?' },
    { id: 'year3', type: 'year', n: 3, name: '세 해', text: '마을에서 3년을 보냈어요.', talk: '처음보다 마을 보물이 얼마나 늘었어?' },
    { id: 'w50', type: 'wealth', n: 50, name: '보물 50', text: '마을 보물이 50개가 됐어요.' },
    { id: 'w100', type: 'wealth', n: 100, name: '보물 100', text: '마을 보물이 100개가 됐어요.' }
  ];

  /* 마을 보물(동전 + 나무 값)이 이만큼 되면 마을에 생기는 것 */
  var WISHES = [
    { id: 'flower', at: 20, name: '꽃밭' },
    { id: 'swing', at: 40, name: '그네' },
    { id: 'fountain', at: 70, name: '분수' },
    { id: 'mill', at: 110, name: '풍차' },
    { id: 'rainbow', at: 160, name: '무지개' },
    { id: 'balloon', at: 240, name: '열기구' },
    { id: 'tower', at: 360, name: '시계탑' }
  ];

  /* 투자 고수. 이름과 널리 알려진 원칙만 쓴다(지어낸 말은 넣지 않는다).
   * stage: 이 단계부터 미션으로 나온다 (seed 씨앗 / sprout 새싹 / tree 나무 / forest 숲) */
  var MENTORS = [
    { id: 'bogle', name: '존 보글', stage: 'seed', rule: '시장 전체를 조금씩 사서 오래 들고 간다(인덱스 펀드).', source: '『모든 주식을 소유하라』' },
    { id: 'buffett', name: '워런 버핏', stage: 'seed', rule: '좋은 회사를 사서 오래 들고 간다.', source: '버크셔 해서웨이 주주서한' },
    { id: 'templeton', name: '존 템플턴', stage: 'seed', rule: '모두가 비관할 때 산다.', source: '『템플턴 플랜』' },
    { id: 'lynch', name: '피터 린치', stage: 'sprout', rule: '내가 잘 아는 회사에 투자한다.', source: '『전설로 떠나는 월가의 영웅』' },
    { id: 'graham', name: '벤저민 그레이엄', stage: 'tree', rule: '가치보다 충분히 싸게 산다(안전마진).', source: '『현명한 투자자』' },
    { id: 'munger', name: '찰리 멍거', stage: 'forest', rule: '모르는 것은 하지 않는다(능력 범위).', source: '『가난한 찰리의 연감』' }
  ];

  /* 단계. 같은 세계를 보되 단계가 오를수록 더 많은 숫자가 열린다. 어른 메뉴에서 바꾼다. */
  var STAGES = [
    { id: 'seed', name: '씨앗', age: '5~7세', open: true, shows: '가게 그림 · 동전 · 열매' },
    { id: 'sprout', name: '새싹', age: '초등', open: true, shows: '가격 · 뉴스 카드 · 가게 성적표 3줄' },
    { id: 'tree', name: '나무', age: '청소년', open: true, shows: '재무제표 3표 · 공시 카드 · PER·ROE' },
    { id: 'forest', name: '숲', age: '성인', open: true, shows: '공시 원문 읽기 · 투자일지 · 복기' },
    { id: 'world', name: '세계', age: '실전', open: true, shows: '실제 회사 재무제표 넣기 · 비율·점검 · 문제 · 다음 실적 예측과 복기' }
  ];

  /* 세계 단계: 실제 재무제표에서 읽어 올 칸. find 는 붙여넣은 글에서 그 항목을 찾는 정규식(문자열).
   * need: 꼭 있어야 하는 칸. money: 금액 단위(원·백만원·억원)를 따르는 칸. */
  var REAL_FIELDS = [
    { id: 'sales', label: '매출액', need: true, money: true, find: '매출액|영업수익|매출(?!원가|총|채권)' },
    { id: 'cogs', label: '매출원가', money: true, find: '매출원가' },
    { id: 'sga', label: '판매비와관리비', money: true, find: '판매비와\\s?관리비|판매관리비|판관비' },
    { id: 'op', label: '영업이익', money: true, find: '영업이익(?!률)|영업손익' },
    { id: 'interest', label: '이자비용', money: true, find: '이자비용|금융비용' },
    { id: 'net', label: '당기순이익', need: true, money: true, find: '당기순이익|분기순이익|반기순이익|당기순손익|순이익(?!률)' },
    { id: 'cash', label: '현금및현금성자산', money: true, find: '현금\\s?및\\s?현금성\\s?자산' },
    { id: 'assets', label: '자산총계', money: true, find: '자산\\s?총계' },
    { id: 'debt', label: '부채총계', need: true, money: true, find: '부채\\s?총계' },
    { id: 'equity', label: '자본총계', need: true, money: true, find: '(?<!부채와|부채및|부채 및 |부채와 )자본\\s?총계' },
    { id: 'cfo', label: '영업활동현금흐름', money: true, find: '영업활동[^\\d\\n]{0,12}현금흐름' },
    { id: 'div', label: '배당금총액', money: true, find: '현금배당금총액|배당금총액|배당금' },
    { id: 'shares', label: '발행주식수 (주)', find: '발행주식총수|발행주식수|발행한 주식의 총수|주식수' },
    { id: 'price', label: '주가 (원)', find: '주가|종가' }
  ];
  var REAL_UNITS = [{ v: 1, name: '원' }, { v: 1e6, name: '백만원' }, { v: 1e8, name: '억원' }];

  /* 길잡이(튜토리얼). 씨앗·새싹 단계에서 처음 한 번, 한 걸음씩 알려 준다.
   * where 어느 화면에 뜨는지(news 소식 창 / town 마을 / shop 가게 창 / result 계절 결과 창)
   * next 무엇을 하면 다음 걸음으로 가는지(guess 소식 고르기 / openShop 가게 열기 / plant 심기 / closeShop 가게 닫기 / nextTurn 계절 넘기기 / resultOk 결과 확인 / tap "다음" 누르기)
   * target 반짝이게 할 곳(CSS 선택자) */
  var TUTORIAL = [
    { where: 'news', next: 'guess', text: '가게에 소식이 왔어요. 잘 듣고, 가게한테 좋은 일이면 웃는 얼굴을, 나쁜 일이면 우는 얼굴을 눌러요.' },
    { where: 'town', next: 'openShop', target: '[data-act=shop][data-id=bread]', text: '잘했어요! 여기는 가게가 여섯 개 있는 마을이에요. 위에 있는 노란 동그라미가 내 동전이에요. 이제 반짝이는 빵집을 눌러 보세요.' },
    { where: 'shop', next: 'plant', target: '[data-act=plant][data-n="1"]', text: '동전을 가게에 심으면 나도 이 가게의 주인이 돼요. "동전 1개 심기"를 눌러 보세요.' },
    { where: 'shop', next: 'closeShop', target: '.sheetbody [data-act=close]', text: '가게 옆에 내 새싹이 났어요! 가게가 돈을 잘 벌면 새싹이 자라서 나무가 되고 열매가 열려요. 더 심어도 돼요. 다 했으면 "닫기"를 눌러요.' },
    { where: 'town', next: 'nextTurn', target: '[data-act=next]', text: '다른 가게에도 심어 보세요. 여러 가게에 나눠 심으면 한 가게가 힘들어도 괜찮아요. 다 심었으면 아래 큰 단추를 눌러요. 계절이 지나가요.' },
    { where: 'result', next: 'resultOk', text: '계절이 지났어요. 웃는 얼굴은 손님이 많았던 가게, 우는 얼굴은 힘들었던 가게예요. 그리고 계절마다 심부름 동전을 받아요.' },
    { where: 'news', next: 'guess', text: '새 소식이 왔어요. 계절마다 소식이 하나씩 와요. 이번에도 잘 듣고 골라 보세요.' },
    { where: 'town', next: 'tap', target: '.mine:not(.none)', text: '가게 밑의 숫자를 보세요. 앞의 숫자는 내가 심은 동전, 뒤의 숫자는 지금 값이에요. 가게가 잘되면 뒤의 숫자가 커지고, 힘들면 작아져요.' },
    { where: 'town', next: 'tap', target: '.goal', text: '마을 보물은 내 동전과 내 나무를 모두 더한 거예요. 보물이 늘어나면 마을에 꽃밭과 그네가 생겨요.' },
    { where: 'town', next: 'tap', target: '.help', text: '이제 혼자 할 수 있어요! 서두르지 않아도 돼요. 기다리면 나무가 자라요. 모르는 게 있으면 위에 있는 물음표를 눌러요.' }
  ];
  /* 물음표(?) 도움말. icon: coin 동전 / tree 나무 / fruit 열매 / good·bad 얼굴 / none */
  var HELP = [
    { icon: 'coin', title: '동전', text: '내 돈이에요. 가게에 심을 수 있어요. 계절이 지날 때마다 심부름 동전을 받아요.' },
    { icon: 'tree', title: '새싹과 나무', text: '가게에 동전을 심으면 가게 옆에 새싹이 나요. 내가 그 가게의 주인이라는 표시예요. 가게가 잘되면 새싹이 나무로 자라요.' },
    { icon: 'fruit', title: '열매', text: '가게가 번 돈을 주인들에게 나눠 주는 거예요. 열매가 익으면 "따기"를 눌러요. 딴 열매는 동전이 돼요.' },
    { icon: 'good', title: '웃는 얼굴', text: '지난 계절에 손님이 많았던 가게예요.' },
    { icon: 'bad', title: '우는 얼굴', text: '지난 계절에 힘들었던 가게예요. 힘든 계절이 지나면 다시 좋아지기도 해요.' },
    { icon: 'none', title: '가게 밑의 숫자', text: '"2 → 3"은 내가 심은 동전 2개가 지금 3개가 됐다는 뜻이에요.' },
    { icon: 'none', title: '소식과 소문', text: '소식은 정말로 있었던 일이에요. "~라는 소문이 있어요"는 아직 아무도 모르는 이야기예요. 소문이 나오면 "아직 몰라요"를 골라요.' },
    { icon: 'none', title: '나눠 심기', text: '힘든 일이 계속되면 가게가 문을 닫을 수도 있어요. 그러면 거기 심은 씨앗도 사라져요. 그래서 여러 가게에 나눠 심어요.' },
    { icon: 'none', title: '꺼내기', text: '심은 동전은 가게를 눌러서 다시 꺼낼 수 있어요. 그런데 오래 기다릴수록 나무가 크게 자라요.' },
    { icon: 'none', title: '마을 보물', text: '내 동전과 내 나무를 모두 더한 숫자예요. 보물이 늘면 마을에 새로운 것이 생겨요.' }
  ];

  var TEXT = {
    introAdult: ['가게(회사)에 동전을 넣으면 그 회사의 주주가 됩니다.', '가게 창에서 성적표·재무제표·공시를 읽고, 이유를 적고 사고팝니다.', '하루 제한 없이 계절을 넘길 수 있습니다. 단계는 어른 메뉴에서 바꿉니다.'],
    intro: ['가게에 동전을 심으면 나도 그 가게 주인이 돼요.', '가게가 잘되면 나무에 열매가 열려요.', '계절이 지나가길 기다려 보세요.'],
    // 씨앗·새싹 단계에서 늘 보이는 "왜 할까요?" 한 줄
    why: {
      news: '소식을 들으면 그 가게가 잘될지 힘들지 미리 생각해 볼 수 있어요. 잘될 것 같은 가게에 심을지 정해 봐요.',
      plant: '동전은 그냥 두면 그대로예요. 가게에 심으면 가게가 번 돈을 열매로 나눠 받고, 가게가 커지면 내 나무도 같이 커져요.'
    },
    // 씨앗·새싹 단계에서 늘 보이는 "왜 할까요?" 한 줄
    why: {
      news: '소식을 들으면 그 가게가 잘될지 힘들지 미리 생각해 볼 수 있어요. 잘될 것 같은 가게에 심을지 정해 봐요.',
      plant: '동전은 그냥 두면 그대로예요. 가게에 심으면 가게가 번 돈을 열매로 나눠 받고, 가게가 커지면 내 나무도 같이 커져요.'
    },
    mood: { good: '손님이 많았어요', ok: '보통이었어요', bad: '힘들었어요' },
    closed: '가게가 문을 닫았어요. 심은 씨앗도 사라졌어요. 그래서 여러 가게에 나눠 심는 거예요.',
    reopened: '빈자리에 새 가게가 문을 열었어요.',
    night: '오늘은 여기까지예요. 나무는 밤에도 자라요. 내일 또 만나요.'
  };

  return { RULES: RULES, SEASONS: SEASONS, SHOPS: SHOPS, NEWS: NEWS, BADGES: BADGES, WISHES: WISHES, MENTORS: MENTORS, STAGES: STAGES, TEXT: TEXT, TUTORIAL: TUTORIAL, HELP: HELP, REAL_FIELDS: REAL_FIELDS, REAL_UNITS: REAL_UNITS };
});
