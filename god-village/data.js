/* 신의 마을 — 게임 데이터 (여기 숫자와 표만 고쳐도 게임이 바뀝니다)
 * 로직은 app.js 에 있고, 이 파일은 "무엇이 있고 얼마인지"만 적습니다.
 * 새 시대·기술·건물·소원·업적을 추가하려면 README 의 "고치는 법"을 보세요. */
window.GV = {
  // ---------- 기본 수치 ----------
  CFG: {
    startPop: 3,          // 처음 시민 수
    startFaith: 12,       // 처음 믿음
    foodPerPop: 0.025,    // 시민 1명이 초당 먹는 식량
    growthFood: 20,       // 아이 한 명이 태어날 때 드는 식량
    knowPerWork: 1,       // 학자가 한 번 생각할 때 쌓이는 지식(건물 배율 전)
    storageBase: 120,     // 창고 없을 때 자원 보관 한도
    storagePer: 150,      // 창고 하나당 늘어나는 한도
    gatherTime: 2.6,      // 한 번 채집에 걸리는 초
    gatherAmount: 3,      // 한 번에 가져오는 양
    prayTime: 3,          // 기도 한 번(초)
    prayFaith: 1,         // 기도 한 번에 쌓이는 믿음
    wishEvery: 90,        // 소원이 올라오는 간격(초)
    wishTime: 90,         // 소원 제한 시간(초)
    wishFaith: 8,         // 소원 들어주면 받는 믿음
    wolfEvery: 300,       // 늑대가 오는 간격(초), 중세 이후엔 안 옴
    wolfHp: 40,
    oracleTime: 120,      // 신탁 지속(초)
    voiceEvery: 60,       // 시민이 신에게 말을 거는 간격(초) — 제물·원망·부탁·질문
    voiceTime: 75,        // 답을 기다리는 시간(초). 원망을 무시하면 믿음이 깎이고 그 시민은 신을 의심한다
    blessCost: 4,         // 축복 비용(믿음). 축복받은 시민은 blessTime 동안 일 1.4배
    blessTime: 120,
    comfortCost: 3,       // 위로 비용(믿음)
    offPct: 50,           // 오프라인 보상 비율(%)
    offHours: 24,         // 오프라인 최대 정산 시간
    dayLength: 150        // 낮밤 한 바퀴(초)
  },

  // ---------- 세계(지도) ----------
  // 가로 cols × 세로 rows 칸(5×10 = 50칸). 우리 마을은 home 칸(오른쪽 아래), 첫 적 부족은 enemy 칸(왼쪽 위). 안 가 본 칸은 안개.
  WORLD: { cols: 5, rows: 10, cellW: 130, cellH: 150, home: { c: 4, r: 9 }, enemy: { c: 0, r: 0 } },
  // 가운데 칸들에 무작위로 놓이는 것들 (weight 가 클수록 자주)
  OBJECTS: [
    { id: 'hunt',     nm: '사냥터',     ic: '🦌', weight: 3, desc: '사슴과 멧돼지가 많다' },
    { id: 'grove',    nm: '열매 숲',    ic: '🍇', weight: 3, desc: '열매 덤불이 빽빽하다' },
    { id: 'quarry',   nm: '채석장',     ic: '⛰️', weight: 2, desc: '바위와 광맥' },
    { id: 'bandit',   nm: '산적 소굴',  ic: '🏴‍☠️', weight: 2, units: 3, loot: { faith: 15, food: 40, wood: 40 }, desc: '산적 셋이 지키고 있다. 전사로 물리치면 전리품' },
    { id: 'treasure', nm: '보물 상자',  ic: '💎', weight: 2, reward: { faith: 25 }, desc: '탐험가가 찾아오면 믿음 +25' },
    { id: 'ruins',    nm: '옛 유적',    ic: '🏛️', weight: 2, reward: { know: 80 }, desc: '탐험가가 찾아오면 지식 +80' },
    { id: 'lair',     nm: '괴물의 둥지', ic: '👹', weight: 1, max: 5, desc: '괴물이 산다. 쓰러뜨린 전사는 영웅이 된다 (세계에 최대 5개)' }
  ],
  // 괴물 (둥지가 우리 마을에서 멀수록 센 놈). hp·atk 는 시대마다 +30%
  MONSTERS: [
    { id: 'boarking', nm: '거대 멧돼지', ic: '🐗', hp: 120, atk: 8,  loot: { faith: 30, food: 60 } },
    { id: 'wolfking', nm: '늑대 왕',     ic: '🐺', hp: 170, atk: 10, loot: { faith: 40, food: 40 } },
    { id: 'bear',     nm: '동굴 곰',     ic: '🐻', hp: 230, atk: 13, loot: { faith: 50, stone: 60 } },
    { id: 'troll',    nm: '트롤',        ic: '👹', hp: 320, atk: 17, loot: { faith: 70, metal: 40 } }
  ],
  // 적 세력 공통 수치. 세력은 여럿 생기고(FACTIONS), 각 세력은 기지(base)를 여러 개 가질 수 있다
  ENEMY: { nm: '회색 부족', units: 4, growEvery: 240, growMax: 14, raidEvery: 360, firstRaid: 900, raidSize: 3, raidTime: 45, lootPct: 0.15, unitHp: 30, unitAtk: 5, conquerFaith: 120 },
  FACTIONS: {
    max: 3,            // 동시에 살아 있는 세력 수
    newEvery: 600,     // 이 간격(초)마다 자리가 비면 새 부족이 먼 땅에 생긴다
    expandAt: 9,       // 세력의 전사 합이 이만큼 되면 옆 칸에 기지를 하나 더 세운다
    maxBases: 3,       // 세력 하나의 최대 기지 수
    schismMin: 3,      // 신을 의심하는 어른이 이만큼(그리고 어른의 20%) 모이면 마을을 떠나 자기들 군락을 세운다
    schismPct: 0.2,
    exileWary: 600,    // 떠난 자들은 이 시간(초) 동안은 쳐들어오지 않는다. 그 안에 신탁 "돌아오라"로 되돌릴 수 있다
    names: ['회색 부족', '검은 늑대 부족', '붉은 모래 부족', '서리 부족', '안개 부족', '불꽃 부족', '돌가면 부족'],
    colors: ['#a02a2a', '#3a3a4a', '#b06a2a', '#4a7aa0', '#6a6a8a', '#c04a2a', '#7a6a4a']
  },
  // 전투 수치 (hp, atk). 우리 쪽은 시대마다 +20%, 무기 기술 효과 추가
  UNITS: { warrior: { hp: 44, atk: 7 }, hunter: { hp: 30, atk: 4 }, citizen: { hp: 16, atk: 1 }, child: { hp: 8, atk: 0 }, bandit: { hp: 30, atk: 5 }, enemy: { hp: 30, atk: 5 } },
  // 가족·세대·군락
  FAMILY: { adultAfter: 480, marryEvery: 90, birthEvery: 150, maxChildren: 3, lifeSec: 5400, settleAt: 16, settleGroup: 4, maxSettlements: 8, settleCost: { wood: 60, food: 40 } },
  SETTLE_NAMES: ['새벽골', '물가 마을', '바람 언덕', '돌밭 마을', '해 뜨는 터', '달빛 고을', '푸른 들', '눈꽃 마을', '별내 마을', '소나무 골'],

  // ---------- 칭호 ----------
  // 시민이 살아온 길에 따라 하나씩 붙습니다(app.js checkTitles). 효과는 app.js 에서 칭호 id 로 찾습니다.
  TITLES: {
    hero:       { nm: '영웅',   ic: '🦸', desc: '괴물을 쓰러뜨린 자. 체력 1.5배, 모두가 우러러본다(행복 +3)' },
    general:    { nm: '장군',   ic: '🎖️', desc: '전투에서 세 번 이긴 전사. 공격력 1.3배, 대열 맨 앞에 선다' },
    prophet:    { nm: '예언자', ic: '🔮', desc: '기도 200번. 믿음 1.3배' },
    sage:       { nm: '현자',   ic: '📜', desc: '지식 500을 쌓은 학자. 연구 1.3배' },
    master:     { nm: '명장',   ic: '🔨', desc: '건물 5채를 올린 건축가. 건설 1.3배' },
    pathfinder: { nm: '탐험왕', ic: '🧭', desc: '땅 5칸을 밝힌 탐험가. 걸음이 빠르다' },
    elder:      { nm: '장로',   ic: '🧓', desc: '오래 산 시민. 곁에 있으면 마을이 차분해진다(행복 +2, 셋까지)' },
    matriarch:  { nm: '대가족', ic: '👨‍👩‍👧‍👦', desc: '아이 셋을 둔 부모. 아이들이 더 빨리 자란다' }
  },
  // 신이 자원과 믿음으로 명하는 것 (신탁 창의 "군대"·"축제")
  ORDERS: {
    arm:  { nm: '군대 무장', ic: '🛡️', cost: { metal: 40, faith: 10 }, max: 5, desc: '단계마다 전사·사냥꾼의 전투력·체력 +10% (비용은 단계마다 오름)' },
    fest: { nm: '축제 열기', ic: '🎉', cost: { food: 60, faith: 15 }, desc: '30초 축제. 행복 +10, 모두의 기분 +10, 출산이 앞당겨짐' }
  },

  // ---------- 시대 ----------
  // house: 그 시대 집 모양(app.js drawBuilding 의 style), cloth: 시민 옷 색 [몸, 어두운 부분], hat: 머리 장식 종류
  // key: 시대를 넘기려면 지어야 하는 건물. minPop: 다음 시대로 가려면 필요한 인구. 그 시대 기술을 다 발견하고 key 건물이 있고 인구가 차면 다음 시대로.
  ERAS: [
    { id: 'stone',  nm: '석기 시대',   ic: '🪨', cloth: ['#8a6a4a', '#5a4030'], hat: 'none',   house: 'hut',     key: 'totem', minPop: 8,    ground: '#2f4a2a', msg: '돌을 깎고 열매를 따며 살아간다.' },
    { id: 'bronze', nm: '청동기 시대', ic: '🥉', cloth: ['#c9a66b', '#8a6a3a'], hat: 'none',   house: 'thatch',  key: 'forge', minPop: 15,    ground: '#2f4d2c', msg: '청동으로 도구를 만들고 밭을 간다.' },
    { id: 'iron',   nm: '철기 시대',   ic: '⚔️', cloth: ['#7a7f8a', '#4a4f5a'], hat: 'helmet', house: 'wood',    key: 'school', minPop: 25,   ground: '#2d4a30', msg: '철로 무기와 쟁기를 만든다. 늑대가 두렵지 않다.' },
    { id: 'medieval', nm: '중세',      ic: '🏰', cloth: ['#4a5a9a', '#2a3a6a'], hat: 'helmet', house: 'stone',   key: 'market', minPop: 40,   ground: '#2a4a2a', msg: '돌로 집과 성을 쌓고 시장이 선다.' },
    { id: 'renaissance', nm: '르네상스', ic: '🎨', cloth: ['#9a4a6a', '#6a2a4a'], hat: 'cap',  house: 'brick',   key: 'university', minPop: 60, ground: '#2d4a2d', msg: '배움과 예술이 꽃핀다.' },
    { id: 'industrial', nm: '산업 시대', ic: '🏭', cloth: ['#3a3a3a', '#1a1a1a'], hat: 'cap',  house: 'rowhouse', key: 'factory', minPop: 90,  ground: '#3a4a3a', msg: '증기와 기계가 세상을 바꾼다.' },
    { id: 'modern', nm: '현대',        ic: '🏙️', cloth: ['#2a6aaa', '#1a3a6a'], hat: 'none',   house: 'tower',   key: 'lab', minPop: 130,      ground: '#3a4a40', msg: '전기와 정보의 시대.' },
    { id: 'space',  nm: '우주 시대',   ic: '🚀', cloth: ['#e0e8f0', '#8a9ab0'], hat: 'visor',  house: 'dome',    key: 'rocket', minPop: 200,   ground: '#34484a', msg: '별을 향해 떠날 준비를 한다. 새 세계를 열 수 있다.' }
  ],

  // ---------- 기술(발견) ----------
  // cost: 필요한 지식(📜). 같은 시대 기술은 위에서부터 차례로 발견됩니다.
  // effect: 배율 (food/wood/stone/metal/know/faith/build/growth). unlock: 지을 수 있게 되는 건물.
  TECHS: [
    { id: 'fire',      era: 0, nm: '불',       ic: '🔥', cost: 60,  effect: { know: 1.3, food: 1.1 }, unlock: 'campfire', msg: '불을 발견했다! 밤이 따뜻해지고 모닥불 곁에서 생각이 깊어진다.' },
    { id: 'tools',     era: 0, nm: '돌도끼',   ic: '🪓', cost: 110,  effect: { wood: 1.4, stone: 1.3 }, msg: '돌도끼를 만들었다. 나무와 돌을 더 빨리 모은다.' },
    { id: 'hunting',   era: 0, nm: '사냥',     ic: '🏹', cost: 170,  effect: { food: 1.3 }, job: 'hunter', msg: '창으로 사슴을 사냥한다. 늑대와도 맞선다.' },
    { id: 'weapons',   era: 0, nm: '창과 방패', ic: '🛡️', cost: 240,  effect: { atk: 1.2 }, job: 'warrior', msg: '전사가 생겼다. 산적과 적 부족에 맞선다.' },
    { id: 'farming',   era: 1, nm: '농사',     ic: '🌾', cost: 420,  effect: { food: 1.3 }, unlock: 'farm', job: 'farmer', msg: '씨앗을 심었다. 밭에서 식량이 자란다.' },
    { id: 'bronze',    era: 1, nm: '청동',     ic: '🥉', cost: 600,  effect: { metal: 1.5, build: 1.2 }, unlock: 'forge', job: 'smith', msg: '구리와 주석을 녹여 청동을 만들었다.' },
    { id: 'writing',   era: 1, nm: '문자',     ic: '✍️', cost: 850, effect: { know: 1.5 }, msg: '문자를 만들었다. 지식이 쌓여 전해진다.' },
    { id: 'iron',      era: 2, nm: '철',       ic: '⚔️', cost: 1300, effect: { metal: 1.5, wood: 1.2, stone: 1.3 }, msg: '철을 다룬다. 도구가 단단해졌다.' },
    { id: 'tactics',   era: 2, nm: '진법',     ic: '🏹', cost: 1600, effect: { atk: 1.3, hp: 1.2 }, msg: '전사들이 대열을 이뤄 싸운다.' },
    { id: 'wheel',     era: 2, nm: '수레',     ic: '🛞', cost: 1900, effect: { food: 1.2, wood: 1.2, stone: 1.2, build: 1.3 }, msg: '수레를 만들었다. 짐을 한 번에 많이 나른다.' },
    { id: 'school',    era: 2, nm: '학문',     ic: '📚', cost: 2300, effect: { know: 1.5 }, unlock: 'school', msg: '학당을 세워 아이들을 가르친다.' },
    { id: 'masonry',   era: 3, nm: '석공술',   ic: '🧱', cost: 3200, effect: { build: 1.4, stone: 1.3 }, unlock: 'castle', msg: '돌을 다듬어 튼튼한 집과 성을 쌓는다.' },
    { id: 'trade',     era: 3, nm: '교역',     ic: '⚖️', cost: 3800, effect: { food: 1.2, faith: 1.2 }, unlock: 'market', msg: '시장이 열리고 물건이 오간다.' },
    { id: 'mill',      era: 3, nm: '물레방아', ic: '🌀', cost: 4500, effect: { food: 1.4 }, msg: '물레방아가 곡식을 빻는다.' },
    { id: 'printing',  era: 4, nm: '인쇄술',   ic: '📖', cost: 6500, effect: { know: 1.8 }, unlock: 'university', msg: '책을 찍어낸다. 지식이 널리 퍼진다.' },
    { id: 'art',       era: 4, nm: '예술',     ic: '🎭', cost: 7500, effect: { faith: 1.3 }, unlock: 'theater', msg: '극장과 그림이 마음을 풍요롭게 한다.' },
    { id: 'science',   era: 4, nm: '과학',     ic: '🔭', cost: 9000, effect: { know: 1.5, build: 1.2 }, msg: '별을 관측하고 실험을 한다.' },
    { id: 'steam',     era: 5, nm: '증기기관', ic: '♨️', cost: 13000, effect: { metal: 1.8, build: 1.5 }, unlock: 'factory', msg: '증기기관이 돌아간다. 공장이 들어선다.' },
    { id: 'railway',   era: 5, nm: '철도',     ic: '🚂', cost: 16000, effect: { food: 1.4, wood: 1.4, stone: 1.4 }, msg: '철도가 놓였다. 자원이 쏟아져 들어온다.' },
    { id: 'electric',  era: 5, nm: '전기',     ic: '💡', cost: 20000, effect: { know: 1.6, faith: 1.2 }, unlock: 'powerplant', msg: '밤에도 불이 꺼지지 않는다.' },
    { id: 'computer',  era: 6, nm: '컴퓨터',   ic: '💻', cost: 30000, effect: { know: 2 }, unlock: 'lab', msg: '계산기가 사람보다 빠르게 생각한다.' },
    { id: 'medicine',  era: 6, nm: '의학',     ic: '💉', cost: 38000, effect: { growth: 1.5, faith: 1.2 }, unlock: 'park', msg: '병을 고친다. 아이들이 건강하게 자란다.' },
    { id: 'rocketry',  era: 6, nm: '로켓',     ic: '🚀', cost: 48000, effect: { build: 1.5 }, unlock: 'rocket', msg: '하늘 너머를 꿈꾼다.' },
    { id: 'fusion',    era: 7, nm: '핵융합',   ic: '☀️', cost: 75000, effect: { metal: 2, know: 1.5 }, msg: '작은 태양을 손에 넣었다.' },
    { id: 'warp',      era: 7, nm: '항성 항해', ic: '🌌', cost: 110000, effect: { faith: 2 }, msg: '별 사이를 건너는 법을 알아냈다. 새 세계가 기다린다.' }
  ],

  // ---------- 건물 ----------
  // cost: 짓는 데 드는 자원. work: 건축가가 일해야 하는 양(초). housing: 수용 인원.
  // role: research(지식) / faith(믿음) / storage(보관) / food(밭) / metal / happy(행복) / launch(새 세계)
  // auto: 시민이 알아서 짓는 조건 — 'house'(집 부족), 'one'(시대에 하나), 'storage'(창고 부족), 'farm'(인구 6명당 1), 'need'(지식 건물 없을 때)
  BUILDINGS: {
    hut:        { nm: '움막',     ic: '⛺', era: 0, cost: { wood: 16 }, work: 16, housing: 3, style: 'hut', auto: 'house' },
    totem:      { nm: '토템',     ic: '🗿', era: 0, cost: { wood: 8, stone: 6 }, work: 10, role: 'faith', research: true, style: 'totem', auto: 'one', msg: '토템을 세웠다. 시민들이 신에게 기도한다.' },
    storage:    { nm: '창고',     ic: '📦', era: 0, cost: { wood: 20, stone: 8 }, work: 24, role: 'storage', style: 'storage', auto: 'storage' },
    campfire:   { nm: '모닥불',   ic: '🔥', era: 0, cost: { wood: 10, stone: 4 }, work: 12, role: 'research', research: 1.5, style: 'campfire', auto: 'one', msg: '모닥불 곁에 모여 이야기를 나눈다.' },
    thatch:     { nm: '초가집',   ic: '🏠', era: 1, cost: { wood: 25, stone: 10 }, work: 28, housing: 5, style: 'thatch', auto: 'house' },
    farm:       { nm: '밭',       ic: '🌾', era: 1, cost: { wood: 15 }, work: 20, role: 'food', style: 'farm', auto: 'farm' },
    forge:      { nm: '대장간',   ic: '🔥', era: 1, cost: { wood: 30, stone: 25 }, work: 40, role: 'metal', style: 'forge', auto: 'one', msg: '대장간이 생겼다. 금속을 다룬다.' },
    wood:       { nm: '목조집',   ic: '🏡', era: 2, cost: { wood: 50, stone: 15, metal: 5 }, work: 40, housing: 8, style: 'wood', auto: 'house' },
    school:     { nm: '학당',     ic: '📚', era: 2, cost: { wood: 50, stone: 30, metal: 10 }, work: 56, role: 'research', research: 2.5, style: 'school', auto: 'one', msg: '학당에서 글을 배운다.' },
    stone:      { nm: '석조집',   ic: '🏘️', era: 3, cost: { stone: 70, wood: 30, metal: 10 }, work: 52, housing: 12, style: 'stone', auto: 'house' },
    market:     { nm: '시장',     ic: '🛒', era: 3, cost: { wood: 80, stone: 50, metal: 20 }, work: 60, role: 'happy', happy: 8, style: 'market', auto: 'one', msg: '시장이 열렸다. 마을이 활기차다.' },
    castle:     { nm: '성',       ic: '🏰', era: 3, cost: { stone: 200, metal: 40 }, work: 120, role: 'faith', faith: 2, style: 'castle', auto: 'one', msg: '성이 완성됐다. 늑대가 더는 오지 않는다.' },
    brick:      { nm: '벽돌집',   ic: '🏚️', era: 4, cost: { stone: 90, wood: 40, metal: 20 }, work: 60, housing: 16, style: 'brick', auto: 'house' },
    university: { nm: '대학',     ic: '🎓', era: 4, cost: { stone: 150, wood: 80, metal: 40 }, work: 100, role: 'research', research: 4, style: 'university', auto: 'one', msg: '대학이 문을 열었다.' },
    theater:    { nm: '극장',     ic: '🎭', era: 4, cost: { wood: 120, stone: 80 }, work: 80, role: 'happy', happy: 10, style: 'theater', auto: 'one', msg: '극장에서 연극을 본다.' },
    rowhouse:   { nm: '연립주택', ic: '🏢', era: 5, cost: { stone: 150, metal: 60, wood: 60 }, work: 72, housing: 24, style: 'rowhouse', auto: 'house' },
    factory:    { nm: '공장',     ic: '🏭', era: 5, cost: { metal: 150, stone: 150 }, work: 140, role: 'metal', metal: 3, style: 'factory', auto: 'one', msg: '공장 굴뚝에서 연기가 오른다.' },
    powerplant: { nm: '발전소',   ic: '⚡', era: 5, cost: { metal: 200, stone: 120 }, work: 140, role: 'research', research: 5, style: 'powerplant', auto: 'one', msg: '발전소가 돌아간다. 밤이 사라졌다.' },
    tower:      { nm: '고층빌딩', ic: '🏙️', era: 6, cost: { metal: 250, stone: 200 }, work: 120, housing: 48, style: 'tower', auto: 'house' },
    lab:        { nm: '연구소',   ic: '🔬', era: 6, cost: { metal: 300, stone: 150 }, work: 160, role: 'research', research: 8, style: 'lab', auto: 'one', msg: '연구소가 세워졌다.' },
    park:       { nm: '공원',     ic: '🌳', era: 6, cost: { wood: 150, stone: 80 }, work: 80, role: 'happy', happy: 12, style: 'park', auto: 'one', msg: '공원에서 쉰다.' },
    dome:       { nm: '돔 주거지', ic: '🛖', era: 7, cost: { metal: 500, stone: 300 }, work: 160, housing: 80, style: 'dome', auto: 'house' },
    rocket:     { nm: '우주선',   ic: '🚀', era: 7, cost: { metal: 1200, stone: 400 }, work: 400, role: 'launch', style: 'rocket', auto: 'one', msg: '우주선이 완성됐다! 새 세계를 열 수 있다.' },
    // ---- 대역사: 시민이 알아서 짓지 않고(auto: 'order') 신이 신탁 창에서 자원+믿음으로 명한다. effect 는 기술처럼 배율, storage 는 보관 추가 ----
    shrine:     { nm: '신전',     ic: '⛩️', era: 0, cost: { wood: 80, stone: 60, faith: 20 }, work: 80, role: 'faith', faith: 2, effect: { faith: 1.3 }, style: 'shrine', auto: 'order', wonder: true, msg: '신전이 섰다. 믿음이 더 빨리 쌓인다.', desc: '믿음 1.3배, 사제가 기도하는 곳' },
    monument:   { nm: '기념비',   ic: '🗿', era: 0, cost: { stone: 120, faith: 15 }, work: 60, role: 'happy', happy: 6, style: 'monument', auto: 'order', wonder: true, msg: '기념비가 섰다.', desc: '행복 +6' },
    wall:       { nm: '성벽',     ic: '🧱', era: 1, cost: { stone: 200, wood: 60, faith: 25 }, work: 120, style: 'wall', auto: 'order', wonder: true, msg: '성벽이 마을을 두른다.', desc: '침략군 규모 -2, 늑대가 못 들어옴' },
    granary:    { nm: '대창고',   ic: '🏺', era: 1, cost: { wood: 150, stone: 80, faith: 15 }, work: 80, role: 'storage', storage: 400, style: 'granary', auto: 'order', wonder: true, msg: '대창고가 완성됐다.', desc: '보관 +400' },
    library:    { nm: '대도서관', ic: '📚', era: 2, cost: { wood: 200, stone: 150, metal: 30, faith: 40 }, work: 160, role: 'research', research: 4, style: 'library', auto: 'order', wonder: true, msg: '대도서관이 문을 열었다.', desc: '지식 ×4 연구 건물' },
    arena:      { nm: '훈련장',   ic: '🏟️', era: 2, cost: { stone: 150, metal: 40, faith: 30 }, work: 120, effect: { atk: 1.2, hp: 1.2 }, style: 'arena', auto: 'order', wonder: true, msg: '훈련장에서 전사들이 단련한다.', desc: '전투력·체력 1.2배' },
    garden:     { nm: '공중정원', ic: '🌺', era: 3, cost: { wood: 300, stone: 300, faith: 60 }, work: 200, role: 'happy', happy: 15, effect: { growth: 1.3 }, style: 'garden', auto: 'order', wonder: true, msg: '공중정원이 피어났다.', desc: '행복 +15, 출산 1.3배' },
    beacon:     { nm: '등대',     ic: '🗼', era: 3, cost: { stone: 250, metal: 80, faith: 50 }, work: 160, style: 'beacon', auto: 'order', wonder: true, msg: '등대가 먼 땅을 비춘다.', desc: '탐험가 걸음 1.5배, 보물·유적 보상 2배' }
  },

  // ---------- 직업 ----------
  // res: 모아 오는 자원(node 종류). at: 일하는 건물 role. tech: 필요한 기술.
  JOBS: {
    gather:  { nm: '채집꾼',   ic: '🍓', res: 'food', node: 'bush' },
    hunter:  { nm: '사냥꾼',   ic: '🏹', res: 'food', node: 'deer', tech: 'hunting' },
    farmer:  { nm: '농부',     ic: '🌾', res: 'food', at: 'food', tech: 'farming' },
    lumber:  { nm: '나무꾼',   ic: '🪵', res: 'wood', node: 'tree' },
    miner:   { nm: '광부',     ic: '🪨', res: 'stone', node: 'rock' },
    smith:   { nm: '대장장이', ic: '⚒️', res: 'metal', node: 'ore', tech: 'bronze' },
    builder: { nm: '건축가',   ic: '🔨' },
    scout:   { nm: '탐험가',   ic: '🧭' },
    warrior: { nm: '전사',     ic: '⚔️', tech: 'weapons' },
    child:   { nm: '아이',     ic: '🧒' },
    scholar: { nm: '학자',     ic: '📜', res: 'know', at: 'research' },
    priest:  { nm: '사제',     ic: '🙏', at: 'faith' }
  },

  // ---------- 신의 힘 ----------
  // 지도를 탭해서 떨어뜨립니다. cost: 믿음. amount: 떨어지는 양.
  POWERS: [
    { id: 'food',  nm: '식량',  ic: '🍖', cost: 5,  amount: 30, hint: '시민들이 달려와 주워 갑니다' },
    { id: 'wood',  nm: '나무',  ic: '🪵', cost: 5,  amount: 30, hint: '집 지을 나무' },
    { id: 'stone', nm: '돌',    ic: '🪨', cost: 5,  amount: 25, hint: '토템·창고에 필요' },
    { id: 'idea',  nm: '영감',  ic: '💡', cost: 8,  amount: 15, hint: '지식 +15(시대 보정), 발견이 빨라집니다' },
    { id: 'rain',  nm: '비',    ic: '🌧️', cost: 10, amount: 60, hint: '밭이 자라고 모두 기뻐합니다 (행복 +5)' },
    { id: 'smite', nm: '번개',  ic: '⚡', cost: 6,  hint: '늑대·산적·적에게 30 피해. 시민에게 치면 혼냅니다' },
    { id: 'rally', nm: '집결',  ic: '🚩', cost: 3,  hint: '깃발을 꽂으면 전사·사냥꾼이 모여 근처의 적과 싸웁니다 (60초)' },
    { id: 'fire',  nm: '불벼락', ic: '🔥', cost: 14, hint: '그 자리 근처 적·산적 모두에게 큰 피해' },
    { id: 'heal',  nm: '치유',  ic: '💗', cost: 8,  hint: '근처 시민들의 상처를 고칩니다' }
  ],
  ORACLES: [
    { id: 'food',  nm: '먹을 것을 모아라', ic: '🍖', cost: 15, weight: { gather: 4, hunter: 4, farmer: 4 } },
    { id: 'build', nm: '집을 지어라',     ic: '🏠', cost: 15, weight: { builder: 4, lumber: 3, miner: 3 } },
    { id: 'know',  nm: '지혜를 구하라',   ic: '📜', cost: 15, weight: { scholar: 5 } },
    { id: 'pray',  nm: '기도하라',        ic: '🙏', cost: 10, weight: { priest: 5 } },
    { id: 'explore', nm: '세상을 보라',   ic: '🧭', cost: 10, weight: { scout: 5 } },
    { id: 'arm',   nm: '무기를 들어라',   ic: '⚔️', cost: 15, weight: { warrior: 6 } },
    { id: 'invade', nm: '적을 쳐라',      ic: '🔥', cost: 25, miracle: 'invade', hint: '전사들이 적 부족 마을로 진군합니다. 이기면 그 마을이 우리 군락이 됩니다' },
    { id: 'harvest', nm: '풍년의 기적',   ic: '🌟', cost: 30, miracle: 'harvest', era: 1, hint: '60초 동안 식량 3배' },
    { id: 'insight', nm: '계시의 기적',   ic: '✨', cost: 45, miracle: 'insight', era: 2, hint: '지금 연구 중인 것을 바로 발견' },
    { id: 'return', nm: '돌아오라',       ic: '🕊️', cost: 30, miracle: 'return', hint: '신을 원망하고 떠난 자들의 마을을 찾았고 행복이 60 이상이면, 그들이 돌아옵니다' }
  ],

  // ---------- 소원 (시민이 올리고, 들어주면 믿음) ----------
  // when: 이 조건일 때만 나옴. done: 이렇게 하면 들어준 것.
  WISHES: [
    // act: 시민을 탭했을 때 팝업에 뜨는 버튼. power:힘id / oracle:신탁id / move:totem / match(짝 맺기). @wolf·@bandit·@enemy·@home 을 붙이면 그 대상 자리에 씁니다.
    { id: 'food',  txt: '배가 고파요…',          ic: '🍖', when: 'foodLow',  done: 'power:food', act: ['power:food'], hint: '🍖 식량을 떨어뜨려 주세요' },
    { id: 'wood',  txt: '집 지을 나무가 없어요',  ic: '🪵', when: 'woodLow',  done: 'power:wood', act: ['power:wood'], hint: '🪵 나무를 떨어뜨려 주세요' },
    { id: 'stone', txt: '돌이 모자라요',          ic: '🪨', when: 'stoneLow', done: 'power:stone', act: ['power:stone'], hint: '🪨 돌을 떨어뜨려 주세요' },
    { id: 'idea',  txt: '좋은 생각이 안 나요',    ic: '💡', when: 'research', done: 'power:idea', act: ['power:idea'], hint: '💡 영감을 내려 주세요' },
    { id: 'rain',  txt: '밭이 말라요',            ic: '🌧️', when: 'farm',     done: 'power:rain', act: ['power:rain'], hint: '🌧️ 비를 내려 주세요' },
    { id: 'wolf',  txt: '늑대가 무서워요!',       ic: '🐺', when: 'wolf',     done: 'wolfDead', act: ['power:smite@wolf'], hint: '⚡ 번개로 늑대를 쫓아 주세요' },
    { id: 'move',  txt: '토템 곁에 가고 싶어요',  ic: '🗿', when: 'totem',    done: 'nearTotem', act: ['move:totem'], hint: '이 시민을 집어서 토템 옆에 내려 주세요' },
    { id: 'home',  txt: '잘 곳이 없어요',         ic: '🏠', when: 'homeless', done: 'housing', act: ['oracle:build', 'power:wood'], hint: '집이 지어지면 들어준 것. 신탁 "집을 지어라"가 빠릅니다' },
    { id: 'bandit', txt: '산적이 무서워요',       ic: '🏴‍☠️', when: 'bandit',   done: 'banditDead', act: ['power:rally@bandit', 'power:fire@bandit'], hint: '🚩 집결로 전사를 보내거나 🔥 불벼락으로 소굴을 치세요' },
    { id: 'love',  txt: '짝을 만나고 싶어요',     ic: '💕', when: 'single',   done: 'married', act: ['match'], hint: '💞 짝 맺어 주기(믿음 6)로 바로 맺어 주거나, 기다리면 알아서 합니다' },
    { id: 'enemy', txt: '적이 쳐들어와요!',       ic: '⚔️', when: 'raid',     done: 'raidOver', act: ['power:rally@home', 'power:fire@enemy'], hint: '🚩 집결·⚡ 번개·🔥 불벼락으로 막으세요' }
  ],

  // ---------- 목소리 (시민이 신에게 거는 말: 제물·원망·부탁·질문) ----------
  // kind: offer(제물) / complaint(원망) / wish(부탁) / question(질문). when: app.js voiceCond 의 조건 이름, event: 사건이 나면 바로(grief 죽음, smited 벼락, newborn 출생).
  // opts: 팝업 버튼. act 종류 — accept(제물 받기) return(축복으로 돌려주기) comfort(위로) bless(축복) scold(혼내기) rename(이름 짓기) grantjob/deny(직업 부탁)
  //   rest(쉬게 하기) remember(기억한다) star(별똥별) value:지혜|힘|화합(마을의 가치) power:힘id oracle:신탁id. {name} {job} 은 자동으로 채워집니다.
  // 답을 안 하면: 원망 → 믿음 -2, 그 시민은 신을 의심(기도 안 함). 제물 → 믿음 +1 만. 부탁 → 기분 -8.
  VOICES: [
    { id: 'hungry',    kind: 'complaint', when: 'foodLow',  weight: 3, txt: '며칠째 굶고 있어요. 신은 보고만 계시나요…', opts: [{ act: 'power:food' }, { act: 'comfort' }] },
    { id: 'forgotten', kind: 'complaint', when: 'unhappy',  weight: 2, txt: '신께서 우리를 잊으신 것 같아요.', opts: [{ act: 'comfort' }, { act: 'power:rain' }, { act: 'scold' }] },
    { id: 'homeless',  kind: 'complaint', when: 'homeless', weight: 2, txt: '밤마다 밖에서 자요. 집이 필요해요.', opts: [{ act: 'oracle:build' }, { act: 'power:wood' }, { act: 'comfort' }] },
    { id: 'fear',      kind: 'complaint', when: 'fear',     weight: 2, txt: '밤마다 늑대 소리가 들려요. 지켜 주세요.', opts: [{ act: 'bless' }, { act: 'comfort' }] },
    { id: 'grief',     kind: 'complaint', event: 'grief',   txt: '왜 {name}을(를) 데려가셨나요…', opts: [{ act: 'comfort' }, { act: 'bless' }] },
    { id: 'smited',    kind: 'complaint', event: 'smited',  txt: '제가 뭘 잘못했나요? 벼락은 너무해요.', opts: [{ act: 'comfort' }, { act: 'bless' }, { act: 'scold', nm: '⚡ 한 번 더' }] },
    { id: 'offer_food', kind: 'offer', when: 'surplus', weight: 3, txt: '첫 수확을 신께 바칩니다. 받아 주소서.', gives: { food: 6 }, opts: [{ act: 'accept' }, { act: 'return' }] },
    { id: 'offer_hunt', kind: 'offer', when: 'hunter',  weight: 2, txt: '오늘 잡은 사슴을 신께 올립니다.', gives: { food: 10 }, opts: [{ act: 'accept' }, { act: 'return' }] },
    { id: 'offer_craft', kind: 'offer', when: 'metal',  weight: 2, txt: '처음 만든 그릇입니다. 신께 드리고 싶어요.', gives: { metal: 3 }, opts: [{ act: 'accept' }, { act: 'return' }] },
    { id: 'offer_flower', kind: 'offer', when: 'happy', weight: 1, txt: '들꽃을 꺾어 왔어요. 신께 드릴게요.', gives: {}, opts: [{ act: 'accept', nm: '🌼 받다' }, { act: 'return', nm: '🎁 축복으로 돌려주다' }] },
    { id: 'name_child', kind: 'wish', event: 'newborn', txt: '아이 {name}의 이름을 지어 주세요!', opts: [{ act: 'rename' }, { act: 'bless', nm: '✨ 축복만 하기' }] },
    { id: 'see_star',  kind: 'wish', when: 'night',   weight: 2, txt: '별똥별을 보고 싶어요.', opts: [{ act: 'star' }] },
    { id: 'want_job',  kind: 'wish', when: 'adult',   weight: 2, txt: '저는 {job}이(가) 되고 싶어요.', opts: [{ act: 'grantjob' }, { act: 'deny' }] },
    { id: 'rest',      kind: 'wish', when: 'tired',   weight: 2, txt: '하루만 쉬고 싶어요…', opts: [{ act: 'rest' }, { act: 'deny' }] },
    { id: 'remember',  kind: 'wish', when: 'any',     weight: 1, txt: '신이시여, 제 이름을 기억해 주시나요?', opts: [{ act: 'remember' }] },
    { id: 'q_value',   kind: 'question', when: 'question', weight: 2, txt: '우리는 무엇을 가장 소중히 여겨야 할까요?', opts: [{ act: 'value:wisdom' }, { act: 'value:strength' }, { act: 'value:harmony' }] },
    { id: 'q_enemy',   kind: 'question', when: 'enemyMet', weight: 2, txt: '회색 부족과는 어떻게 지내야 할까요?', opts: [{ act: 'value:strength', nm: '⚔️ 맞서라' }, { act: 'value:harmony', nm: '🕊️ 경계하되 평화를' }] },
    { id: 'q_child',   kind: 'question', when: 'kids',     weight: 2, txt: '아이들에게 무엇을 먼저 가르칠까요?', opts: [{ act: 'value:wisdom', nm: '📜 글' }, { act: 'value:strength', nm: '🏹 사냥' }, { act: 'value:harmony', nm: '🎵 노래' }] },
    { id: 'q_night',   kind: 'question', when: 'question', weight: 1, txt: '밤은 왜 이렇게 길까요? 신께서도 주무시나요?', opts: [{ act: 'value:wisdom', nm: '📜 별을 세어 보렴' }, { act: 'value:harmony', nm: '🤝 서로 곁에 있으렴' }] }
  ],
  // 마을의 가치 — 질문에 답할 때마다 쌓이고(최대 5까지 효과), 마을 패널에 보입니다
  VALUES: {
    wisdom:   { nm: '지혜', ic: '📜', desc: '지식 생산 +4%씩' },
    strength: { nm: '힘',   ic: '⚔️', desc: '전투력·체력 +4%씩' },
    harmony:  { nm: '화합', ic: '🤝', desc: '행복 +1.5, 믿음 +3%씩' }
  },

  // ---------- 오늘의 과제 ----------
  DAILY: [
    { id: 'wish', nm: '소원 들어주기', n: 3 },
    { id: 'voice', nm: '목소리에 답하기', n: 2 },
    { id: 'bless', nm: '축복하기', n: 1 },
    { id: 'gift', nm: '선물 내리기', n: 5 },
    { id: 'move', nm: '시민 옮기기', n: 5 }
  ],
  DAILY_FAITH: 30,

  // ---------- 업적 (조건: pop 인구 / era 시대 / tech 발견 수 / faith 누적 믿음 / wish 들어준 소원 / move 옮긴 횟수 / world 세계) ----------
  ACHIEVEMENTS: [
    { id: 'first_fire', nm: '첫 불꽃', ic: '🔥', type: 'tech', n: 1, faith: 10 },
    { id: 'pop10',  nm: '열 식구', ic: '👨‍👩‍👧‍👦', type: 'pop', n: 10, faith: 15 },
    { id: 'pop30',  nm: '작은 마을', ic: '🏘️', type: 'pop', n: 30, faith: 30 },
    { id: 'pop100', nm: '도시', ic: '🌆', type: 'pop', n: 100, faith: 80 },
    { id: 'era1',   nm: '청동의 빛', ic: '🥉', type: 'era', n: 1, faith: 20 },
    { id: 'era3',   nm: '성벽 너머', ic: '🏰', type: 'era', n: 3, faith: 40 },
    { id: 'era5',   nm: '굴뚝 연기', ic: '🏭', type: 'era', n: 5, faith: 60 },
    { id: 'era7',   nm: '별을 향해', ic: '🚀', type: 'era', n: 7, faith: 100 },
    { id: 'wish10', nm: '자비로운 신', ic: '💝', type: 'wish', n: 10, faith: 25 },
    { id: 'wish50', nm: '기도의 응답', ic: '🙏', type: 'wish', n: 50, faith: 80 },
    { id: 'move20', nm: '신의 손길', ic: '🖐️', type: 'move', n: 20, faith: 25 },
    { id: 'faith500', nm: '믿음의 탑', ic: '✨', type: 'faith', n: 500, faith: 50 },
    { id: 'world2', nm: '두 번째 세계', ic: '🌍', type: 'world', n: 2, faith: 0 },
    { id: 'marry1', nm: '첫 결혼', ic: '💕', type: 'marry', n: 1, faith: 10 },
    { id: 'settle2', nm: '두 번째 군락', ic: '🏕️', type: 'settle', n: 2, faith: 30 },
    { id: 'explore', nm: '세상 끝까지', ic: '🧭', type: 'explored', n: 25, faith: 40 },
    { id: 'explore50', nm: '온 세상', ic: '🌐', type: 'explored', n: 50, faith: 80 },
    { id: 'bandit3', nm: '산적 토벌', ic: '🏴‍☠️', type: 'bandit', n: 3, faith: 30 },
    { id: 'defend', nm: '마을을 지켰다', ic: '🛡️', type: 'defend', n: 1, faith: 25 },
    { id: 'conquer', nm: '정복자', ic: '👑', type: 'conquer', n: 1, faith: 100 },
    { id: 'voice20', nm: '귀 기울이는 신', ic: '👂', type: 'voice', n: 20, faith: 30 },
    { id: 'bless10', nm: '축복의 손', ic: '✨', type: 'bless', n: 10, faith: 25 },
    { id: 'offer5', nm: '제단의 향기', ic: '🎁', type: 'offer', n: 5, faith: 20 },
    { id: 'gen3', nm: '삼대', ic: '👴', type: 'gen', n: 3, faith: 40 },
    { id: 'hero', nm: '괴물 사냥꾼', ic: '🦸', type: 'hero', n: 1, faith: 50 },
    { id: 'titles5', nm: '이름난 이들', ic: '🏅', type: 'titles', n: 5, faith: 40 },
    { id: 'wonder3', nm: '대역사', ic: '🏛️', type: 'wonder', n: 3, faith: 60 },
    { id: 'conquer3', nm: '패왕', ic: '👑', type: 'conquer', n: 3, faith: 120 },
    { id: 'return', nm: '돌아온 탕자', ic: '🕊️', type: 'returned', n: 1, faith: 40 }
  ],

  // ---------- 자원 나무·바위 등 (지도에 놓이는 것) ----------
  NODES: {
    bush: { nm: '열매 덤불', res: 'food', max: 24, regrow: 0.12, count: 5 },
    tree: { nm: '나무',     res: 'wood', max: 30, regrow: 0.08, count: 8 },
    rock: { nm: '바위',     res: 'stone', max: 40, regrow: 0.05, count: 4 },
    ore:  { nm: '광맥',     res: 'metal', max: 40, regrow: 0.06, count: 3 },
    deer: { nm: '사슴',     res: 'food', max: 12, regrow: 0.1,  count: 3, moves: true },
    boar: { nm: '멧돼지',   res: 'food', max: 20, regrow: 0.08, count: 0, moves: true }
  },

  // ---------- 대사 ----------
  LINES: {
    idle: ['오늘도 열심히!', '배고프다…', '하늘이 예쁘다', '우리 마을 최고', '내일은 뭘 할까', '쉬고 싶다~', '신께서 보고 계셔', '저기 사슴이다!', '아이가 또 태어났대', '집이 좀 좁은데…'],
    gift: ['신의 선물이다!', '하늘에서 떨어졌어!', '감사합니다!', '우와!', '내 거야!'],
    held: ['으아아아!', '날고 있어!', '내려 줘요~', '신이시여!'],
    drop: ['휴, 땅이다', '여기서 일하라는 뜻이군', '알겠습니다!'],
    pray: ['신이시여…', '풍년을 주소서', '가족이 건강하길', '오늘도 감사합니다'],
    wolf: ['늑대다!', '도망쳐!', '살려 줘!'],
    tech: ['해냈다!', '이제 알겠어!', '유레카!'],
    era: ['새로운 시대다!', '세상이 바뀌었어!', '우리가 해냈어!'],
    born: ['아기가 태어났어요!', '축하해요!', '우리 가족이 늘었다'],
    oracle: ['신탁이 내렸다!', '신의 뜻대로!', '알겠습니다, 신이시여'],
    scold: ['죄송해요…', '다신 안 그럴게요', '으악, 벼락!'],
    marry: ['평생 함께할게', '행복하자!', '우리 집을 짓자'],
    child: ['엄마! 아빠!', '놀자~', '나도 커서 사냥할래', '별이 반짝여'],
    grow: ['이제 어른이야!', '내 몫은 내가 할게'],
    elder: ['좋은 세월이었다…', '아이들아, 잘 지내라', '별이 되어 지켜볼게'],
    explore: ['저 너머엔 뭐가 있을까', '새 땅이다!', '여기 처음 와 봐'],
    war: ['마을을 지켜라!', '덤벼라!', '신이 우리와 함께!', '물러서지 마!'],
    raid: ['적이다!', '숨어!', '전사들은 어디 있어!'],
    settle: ['여기에 새 마을을 세우자', '우리끼리 잘 살 수 있어', '새 출발이다'],
    loot: ['보물이다!', '옛사람의 지혜야', '이걸 마을로 가져가자'],
    thanks: ['고맙습니다!', '신께서 들어주셨어!', '역시 우리 신이야', '마음이 놓여요'],
    doubt: ['신은 정말 계신 걸까…', '기도해도 소용없어', '우리끼리 살아야지'],
    sleep: ['쿨쿨…', '내일은 좋은 날이길', '별이 많다…'],
    offer: ['신께 올립니다', '받아 주소서', '정성을 다했어요'],
    wed: ['오늘부터 가족이야', '우리 집을 꾸미자', '행복하게 살자'],
    fest: ['축하해!', '춤추자!', '오늘은 축제다!', '노래하자~'],
    drill: ['하나, 둘!', '대열을 맞춰라!', '방패 들어!', '오늘도 훈련이다'],
    march: ['진군!', '발 맞춰!', '신이 우리와 함께!'],
    title: ['이 이름에 부끄럽지 않게', '마을을 위해!', '드디어 인정받았어'],
    elderTalk: ['내가 젊었을 땐 말이야…', '서두르지 마라', '별을 봐라, 아이들아', '다 지나간다'],
    hero: ['그놈은 내가 잡았지', '두려움은 없다', '괴물 따위!'],
    schism: ['우린 떠난다', '신 없이도 살 수 있어', '다시는 안 돌아와'],
    returned: ['…돌아왔습니다', '용서해 주세요', '집이 그리웠어요'],
    wonder: ['우리 손으로 세웠다!', '후손들이 기억할 거야', '신께 바칩니다'],
    avatar: ['신이 내려오셨다!', '신이시여!', '빛이다!', '우리와 함께 싸우신다!'],
    meteor: ['하늘에서 돌이 떨어졌어!', '저게 뭐지?', '반짝이는 돌이다']
  },
  // ---------- RPG: 강림·장비·던전·이벤트·출석 (rpg.js 가 씁니다) ----------
  RPG: {
    // 화신 = 신이 고른 시민. 죽을 때까지 바꿀 수 없고, 죽으면 다른 시민을 고른다. 레벨·장비는 "화신의 자리"에 남아 다음 시민이 이어받는다
    avatarCost: 15,       // 시민을 화신으로 삼는 비용(믿음)
    deathFaith: 20,       // 조종 중 화신이 쓰러지면 잃는 믿음
    retreatPct: 0.25,     // 조종하지 않을 때(오프라인 포함) 체력이 이 비율 아래로 떨어지면 토템으로 귀환 — 절대 죽지 않음
    restSec: 30,          // 귀환 뒤 토템에서 쉬는 시간(초). 쉬는 동안 공격받지 않고 빠르게 회복
    base: { hp: 90, hpLv: 15, atk: 9, atkLv: 2, spd: 44, range: 16, atkCd: 0.5 },
    chase: 60,            // 조종 중 가만히 있으면 이 거리 안의 적·사냥감에게 알아서 다가감
    guard: 130,           // 조종을 끄면 마을 둘레 이 거리 안의 적과 싸우고
    hunt: 110,            //   이 거리 안의 사냥감을 알아서 사냥해 레벨업한다
    dash: { cd: 1.2, range: 60, radius: 20, mult: 1.6, knock: 10 },   // ⚔️ 베기: 돌진 + 광역 + 넉백
    xpBase: 40, xpPow: 1.4,   // 다음 레벨까지 = xpBase × lv^xpPow
    xp:    { enemy: 20, bandit: 20, wolf: 10, monster: 120, dmob: 15, boss: 80 },
    faith: { enemy: 2, bandit: 2, wolf: 1, monster: 20, dmob: 1, boss: 10 },
    offlineXpPerH: 25, offlineXpLv: 5,   // 오프라인 1시간마다 경험치 25 + 레벨×5 (알아서 사냥한 셈)
    morale: 1.2,          // 화신 곁(40px) 전사의 공격 배율
    // 사냥감: 칸마다 돌아다니는 동물. 먼저 건드리지 않으면 공격하지 않는다. weight 는 [마을 근처, 중간, 먼 곳] 등장 가중치
    BEASTS: [
      { id: 'rabbit', nm: '토끼',   hp: 8,   atk: 0, xp: 4,  food: 2,  spd: 14, weight: [6, 3, 1] },
      { id: 'deer',   nm: '사슴',   hp: 22,  atk: 1, xp: 9,  food: 6,  spd: 16, weight: [4, 4, 2] },
      { id: 'boar',   nm: '멧돼지', hp: 45,  atk: 4, xp: 16, food: 10, spd: 12, weight: [1, 3, 3] },
      { id: 'bear',   nm: '곰',     hp: 130, atk: 9, xp: 45, food: 20, spd: 9,  weight: [0, 1, 3], drop: [70, 25, 5, 0] }
    ],
    beastsPerCell: 3, beastsMax: 80, beastEvery: 60,   // 탐험한 칸마다 최대 3마리, 60초마다 빈자리를 채움
    // 탐험 이벤트 지점(❓): 안개 속 칸마다 1~2개. 화신이 밟거나 탐험가가 찾으면 하나가 일어난다. 20분마다 새 지점이 생긴다
    EVENTS: [
      { id: 'treasure', nm: '숨겨진 보물',  ic: '💎', weight: 16, item: [40, 45, 13, 2] },
      { id: 'cache',    nm: '버려진 창고',  ic: '📦', weight: 20, res: { wood: [30, 80], stone: [20, 60], metal: [5, 20] } },
      { id: 'refugees', nm: '떠도는 난민',  ic: '🏃', weight: 14, pop: [1, 3] },
      { id: 'mercs',    nm: '용병단',       ic: '⚔️', weight: 8,  warriors: [2, 3] },
      { id: 'altar',    nm: '옛 제단',      ic: '🛐', weight: 12, faith: [20, 40] },
      { id: 'herbs',    nm: '약초밭',       ic: '🌿', weight: 10, heal: true },
      { id: 'trap',     nm: '함정',         ic: '🕳️', weight: 7,  hurt: 0.3 },
      { id: 'ambush',   nm: '매복',         ic: '🏴‍☠️', weight: 7, bandits: [2, 3] },
      { id: 'child',    nm: '길 잃은 아이', ic: '🧒', weight: 5,  child: true },
      { id: 'sage',     nm: '떠돌이 현자',  ic: '📜', weight: 6,  know: [40, 90] }
    ],
    eventsPerCell: [1, 2], eventEvery: 20 * 60 * 1000,
    skills: [
      { id: 'bolt', nm: '번개 베기', ic: '⚡', cd: 8, mult: 2.5, radius: 26, desc: '주위 적 모두에게 공격력 2.5배' },
      { id: 'heal', nm: '치유 파동', ic: '💗', cd: 15, heal: 0.4, radius: 40, desc: '화신 체력 40% 회복, 근처 시민 전부 회복' }
    ],
    RARITY: [
      { id: 'common', nm: '일반', col: '#c8c8d0', opts: 1, mult: 1 },
      { id: 'rare',   nm: '희귀', col: '#6fb3ff', opts: 2, mult: 1.5 },
      { id: 'epic',   nm: '영웅', col: '#c58cff', opts: 3, mult: 2.2 },
      { id: 'legend', nm: '전설', col: '#ffd34f', opts: 4, mult: 3.2 }
    ],
    // primary: 기본 능력. base: [기본, 등급(tier)마다 추가]. tier 는 시대와 미궁 층에 따라 1~5
    SLOTS: {
      weapon: { nm: '무기', ic: '🗡️', primary: 'atk', base: [4, 3],  names: ['돌칼', '청동검', '철검', '빛의 검', '별의 검'] },
      armor:  { nm: '갑옷', ic: '🛡️', primary: 'hp',  base: [20, 12], names: ['가죽옷', '청동 갑옷', '철 갑옷', '별빛 갑옷', '신의 갑옷'] },
      charm:  { nm: '부적', ic: '📿', primary: 'faith', base: [5, 3], names: ['조개 부적', '뼈 부적', '옥 부적', '신의 눈', '별의 눈물'] }
    },
    OPTS: [
      { id: 'atk',   nm: '공격',      unit: '',  base: [2, 6] },
      { id: 'hp',    nm: '체력',      unit: '',  base: [10, 30] },
      { id: 'spd',   nm: '이동속도',  unit: '%', base: [5, 15] },
      { id: 'crit',  nm: '치명타',    unit: '%', base: [3, 10] },
      { id: 'faith', nm: '믿음 획득', unit: '%', base: [5, 15] },
      { id: 'xp',    nm: '경험치',    unit: '%', base: [5, 15] },
      { id: 'regen', nm: '초당 회복', unit: '',  base: [1, 3] }
    ],
    enhance: { costMetal: 10, rates: [1, 1, 1, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2], max: 10, step: 0.1 }, // +1마다 기본 능력 +10%, 비용 = costMetal × (현재 강화 + 1)
    dismantle: { faith: [3, 8, 20, 50], metal: [2, 5, 12, 30] },
    invMax: 20,
    // 드롭 등급 가중치 [일반, 희귀, 영웅, 전설]
    drops: { monster: [0, 60, 35, 5], camp: [70, 28, 2, 0], base: [30, 50, 18, 2], meteor: [30, 50, 18, 2], horde: [10, 50, 35, 5], boss: [0, 30, 55, 15], floor: [40, 45, 13, 2] },
    dungeon: { nm: '고대 미궁', ic: '🕳️', minDist: 5, mobsBase: 3, mobHp: 25, mobAtk: 4, hpPer: 0.25, atkPer: 0.15, bossEvery: 5, bossMult: 5, radius: 100, leaveDist: 110, faithPerFloor: 5 },
    events: {
      meteorEvery: 3 * 3600 * 1000, meteorLife: 3600 * 1000, meteorReward: { metal: 40, faith: 20 },
      hordeEvery: 6 * 3600 * 1000, hordeSize: 6, hordePerEra: 2, hordeFaith: 30
    },
    // 출석 7일 보상. item: 등급 번호(RARITY 순서)
    attend: [
      { ic: '✨', nm: '믿음 20', faith: 20 }, { ic: '⛏️', nm: '금속 30', metal: 30 }, { ic: '📦', nm: '일반 장비', item: 0 },
      { ic: '✨', nm: '믿음 40', faith: 40 }, { ic: '📦', nm: '희귀 장비', item: 1 }, { ic: '⚡', nm: '믿음 50 + 희귀 장비', item: 1, faith: 50 },
      { ic: '🎁', nm: '영웅 장비', item: 2 }
    ],
    offline: { dangerAfterH: 24, returnFaithPerH: 10, returnMax: 100 }
  },
  NAMES: ['우가', '마루', '두리', '보리', '나래', '가온', '하늘', '한결', '바위', '시내', '이슬', '별', '솔', '여울', '다솜', '누리', '푸름', '아름', '슬기', '으뜸', '온', '빛나', '새벽', '노을', '구름', '강', '샘', '들', '뫼', '미르', '라온', '초록', '하랑', '서리', '달'],
  HAIR: ['#2b2320', '#6b3f23', '#e8c060', '#d04a2a', '#e879b0', '#4f7fe0', '#4fb06a', '#9a5cf0', '#f0ede0', '#48b8b0'],
  SKIN: ['#f3d9b1', '#e3b88a', '#b07a4a']
};
