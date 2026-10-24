/* 신의 마을 — 게임 데이터 (여기 숫자와 표만 고쳐도 게임이 바뀝니다)
 * 로직은 app.js 에 있고, 이 파일은 "무엇이 있고 얼마인지"만 적습니다.
 * 새 시대·기술·건물·소원·업적을 추가하려면 README 의 "고치는 법"을 보세요. */
window.GV = {
  // ---------- 기본 수치 ----------
  CFG: {
    startPop: 3,          // 처음 시민 수
    startFaith: 12,       // 처음 믿음
    foodPerPop: 0.025,    // 시민 1명이 초당 먹는 식량
    growthFood: 15,       // 아이 한 명이 태어날 때 드는 식량
    growthEvery: 45,      // 인구가 늘어나는 간격(초). 시대가 오를수록 10%씩 짧아짐
    storageBase: 120,     // 창고 없을 때 자원 보관 한도
    storagePer: 150,      // 창고 하나당 늘어나는 한도
    gatherTime: 2.6,      // 한 번 채집에 걸리는 초
    gatherAmount: 3,      // 한 번에 가져오는 양
    prayTime: 3,          // 기도 한 번(초)
    prayFaith: 1,         // 기도 한 번에 쌓이는 믿음
    wishEvery: 70,        // 소원이 올라오는 간격(초)
    wishTime: 90,         // 소원 제한 시간(초)
    wishFaith: 8,         // 소원 들어주면 받는 믿음
    wolfEvery: 200,       // 늑대가 오는 간격(초), 중세 이후엔 안 옴
    wolfHp: 40,
    oracleTime: 120,      // 신탁 지속(초)
    offPct: 50,           // 오프라인 보상 비율(%)
    offHours: 24,         // 오프라인 최대 정산 시간
    dayLength: 150        // 낮밤 한 바퀴(초)
  },

  // ---------- 세계(지도) ----------
  // 가로 cols × 세로 rows 칸. 우리 마을은 home 칸(오른쪽 아래), 적 부족은 enemy 칸(왼쪽 위). 안 가 본 칸은 안개.
  WORLD: { cols: 3, rows: 4, cellW: 130, cellH: 150, home: { c: 2, r: 3 }, enemy: { c: 0, r: 0 } },
  // 가운데 칸들에 무작위로 놓이는 것들 (weight 가 클수록 자주)
  OBJECTS: [
    { id: 'hunt',     nm: '사냥터',     ic: '🦌', weight: 3, desc: '사슴과 멧돼지가 많다' },
    { id: 'grove',    nm: '열매 숲',    ic: '🍇', weight: 3, desc: '열매 덤불이 빽빽하다' },
    { id: 'quarry',   nm: '채석장',     ic: '⛰️', weight: 2, desc: '바위와 광맥' },
    { id: 'bandit',   nm: '산적 소굴',  ic: '🏴‍☠️', weight: 3, units: 3, loot: { faith: 15, food: 40, wood: 40 }, desc: '산적 셋이 지키고 있다. 전사로 물리치면 전리품' },
    { id: 'treasure', nm: '보물 상자',  ic: '💎', weight: 2, reward: { faith: 25 }, desc: '탐험가가 찾아오면 믿음 +25' },
    { id: 'ruins',    nm: '옛 유적',    ic: '🏛️', weight: 2, reward: { know: 80 }, desc: '탐험가가 찾아오면 지식 +80' }
  ],
  // 적 부족
  ENEMY: { nm: '회색 부족', units: 4, growEvery: 150, growMax: 14, raidEvery: 240, firstRaid: 420, raidSize: 3, raidTime: 45, lootPct: 0.15, unitHp: 30, unitAtk: 5, conquerFaith: 120 },
  // 전투 수치 (hp, atk). 우리 쪽은 시대마다 +20%, 무기 기술 효과 추가
  UNITS: { warrior: { hp: 44, atk: 7 }, hunter: { hp: 30, atk: 4 }, citizen: { hp: 16, atk: 1 }, child: { hp: 8, atk: 0 }, bandit: { hp: 30, atk: 5 }, enemy: { hp: 30, atk: 5 } },
  // 가족·세대·군락
  FAMILY: { adultAfter: 240, marryEvery: 50, birthEvery: 80, maxChildren: 3, lifeSec: 3000, settleAt: 12, settleGroup: 4, maxSettlements: 4, settleCost: { wood: 40, food: 30 } },
  SETTLE_NAMES: ['새벽골', '물가 마을', '바람 언덕', '돌밭 마을', '해 뜨는 터', '달빛 고을', '푸른 들'],

  // ---------- 시대 ----------
  // house: 그 시대 집 모양(app.js drawBuilding 의 style), cloth: 시민 옷 색 [몸, 어두운 부분], hat: 머리 장식 종류
  // key: 시대를 넘기려면 지어야 하는 건물. 그 시대 기술을 다 발견하고 key 건물이 있으면 다음 시대로.
  ERAS: [
    { id: 'stone',  nm: '석기 시대',   ic: '🪨', cloth: ['#8a6a4a', '#5a4030'], hat: 'none',   house: 'hut',     key: 'totem',    ground: '#2f4a2a', msg: '돌을 깎고 열매를 따며 살아간다.' },
    { id: 'bronze', nm: '청동기 시대', ic: '🥉', cloth: ['#c9a66b', '#8a6a3a'], hat: 'none',   house: 'thatch',  key: 'forge',    ground: '#2f4d2c', msg: '청동으로 도구를 만들고 밭을 간다.' },
    { id: 'iron',   nm: '철기 시대',   ic: '⚔️', cloth: ['#7a7f8a', '#4a4f5a'], hat: 'helmet', house: 'wood',    key: 'school',   ground: '#2d4a30', msg: '철로 무기와 쟁기를 만든다. 늑대가 두렵지 않다.' },
    { id: 'medieval', nm: '중세',      ic: '🏰', cloth: ['#4a5a9a', '#2a3a6a'], hat: 'helmet', house: 'stone',   key: 'market',   ground: '#2a4a2a', msg: '돌로 집과 성을 쌓고 시장이 선다.' },
    { id: 'renaissance', nm: '르네상스', ic: '🎨', cloth: ['#9a4a6a', '#6a2a4a'], hat: 'cap',  house: 'brick',   key: 'university', ground: '#2d4a2d', msg: '배움과 예술이 꽃핀다.' },
    { id: 'industrial', nm: '산업 시대', ic: '🏭', cloth: ['#3a3a3a', '#1a1a1a'], hat: 'cap',  house: 'rowhouse', key: 'factory',  ground: '#3a4a3a', msg: '증기와 기계가 세상을 바꾼다.' },
    { id: 'modern', nm: '현대',        ic: '🏙️', cloth: ['#2a6aaa', '#1a3a6a'], hat: 'none',   house: 'tower',   key: 'lab',      ground: '#3a4a40', msg: '전기와 정보의 시대.' },
    { id: 'space',  nm: '우주 시대',   ic: '🚀', cloth: ['#e0e8f0', '#8a9ab0'], hat: 'visor',  house: 'dome',    key: 'rocket',   ground: '#34484a', msg: '별을 향해 떠날 준비를 한다. 새 세계를 열 수 있다.' }
  ],

  // ---------- 기술(발견) ----------
  // cost: 필요한 지식(📜). 같은 시대 기술은 위에서부터 차례로 발견됩니다.
  // effect: 배율 (food/wood/stone/metal/know/faith/build/growth). unlock: 지을 수 있게 되는 건물.
  TECHS: [
    { id: 'fire',      era: 0, nm: '불',       ic: '🔥', cost: 20,  effect: { know: 1.3, food: 1.1 }, unlock: 'campfire', msg: '불을 발견했다! 밤이 따뜻해지고 모닥불 곁에서 생각이 깊어진다.' },
    { id: 'tools',     era: 0, nm: '돌도끼',   ic: '🪓', cost: 35,  effect: { wood: 1.4, stone: 1.3 }, msg: '돌도끼를 만들었다. 나무와 돌을 더 빨리 모은다.' },
    { id: 'hunting',   era: 0, nm: '사냥',     ic: '🏹', cost: 50,  effect: { food: 1.3 }, job: 'hunter', msg: '창으로 사슴을 사냥한다. 늑대와도 맞선다.' },
    { id: 'weapons',   era: 0, nm: '창과 방패', ic: '🛡️', cost: 70,  effect: { atk: 1.2 }, job: 'warrior', msg: '전사가 생겼다. 산적과 적 부족에 맞선다.' },
    { id: 'farming',   era: 1, nm: '농사',     ic: '🌾', cost: 60,  effect: { food: 1.3 }, unlock: 'farm', job: 'farmer', msg: '씨앗을 심었다. 밭에서 식량이 자란다.' },
    { id: 'bronze',    era: 1, nm: '청동',     ic: '🥉', cost: 90,  effect: { metal: 1.5, build: 1.2 }, unlock: 'forge', job: 'smith', msg: '구리와 주석을 녹여 청동을 만들었다.' },
    { id: 'writing',   era: 1, nm: '문자',     ic: '✍️', cost: 120, effect: { know: 1.5 }, msg: '문자를 만들었다. 지식이 쌓여 전해진다.' },
    { id: 'iron',      era: 2, nm: '철',       ic: '⚔️', cost: 180, effect: { metal: 1.5, wood: 1.2, stone: 1.3 }, msg: '철을 다룬다. 도구가 단단해졌다.' },
    { id: 'tactics',   era: 2, nm: '진법',     ic: '🏹', cost: 200, effect: { atk: 1.3, hp: 1.2 }, msg: '전사들이 대열을 이뤄 싸운다.' },
    { id: 'wheel',     era: 2, nm: '수레',     ic: '🛞', cost: 220, effect: { food: 1.2, wood: 1.2, stone: 1.2, build: 1.3 }, msg: '수레를 만들었다. 짐을 한 번에 많이 나른다.' },
    { id: 'school',    era: 2, nm: '학문',     ic: '📚', cost: 280, effect: { know: 1.5 }, unlock: 'school', msg: '학당을 세워 아이들을 가르친다.' },
    { id: 'masonry',   era: 3, nm: '석공술',   ic: '🧱', cost: 400, effect: { build: 1.4, stone: 1.3 }, unlock: 'castle', msg: '돌을 다듬어 튼튼한 집과 성을 쌓는다.' },
    { id: 'trade',     era: 3, nm: '교역',     ic: '⚖️', cost: 480, effect: { food: 1.2, faith: 1.2 }, unlock: 'market', msg: '시장이 열리고 물건이 오간다.' },
    { id: 'mill',      era: 3, nm: '물레방아', ic: '🌀', cost: 560, effect: { food: 1.4 }, msg: '물레방아가 곡식을 빻는다.' },
    { id: 'printing',  era: 4, nm: '인쇄술',   ic: '📖', cost: 800, effect: { know: 1.8 }, unlock: 'university', msg: '책을 찍어낸다. 지식이 널리 퍼진다.' },
    { id: 'art',       era: 4, nm: '예술',     ic: '🎭', cost: 900, effect: { faith: 1.3 }, unlock: 'theater', msg: '극장과 그림이 마음을 풍요롭게 한다.' },
    { id: 'science',   era: 4, nm: '과학',     ic: '🔭', cost: 1100, effect: { know: 1.5, build: 1.2 }, msg: '별을 관측하고 실험을 한다.' },
    { id: 'steam',     era: 5, nm: '증기기관', ic: '♨️', cost: 1600, effect: { metal: 1.8, build: 1.5 }, unlock: 'factory', msg: '증기기관이 돌아간다. 공장이 들어선다.' },
    { id: 'railway',   era: 5, nm: '철도',     ic: '🚂', cost: 2000, effect: { food: 1.4, wood: 1.4, stone: 1.4 }, msg: '철도가 놓였다. 자원이 쏟아져 들어온다.' },
    { id: 'electric',  era: 5, nm: '전기',     ic: '💡', cost: 2600, effect: { know: 1.6, faith: 1.2 }, unlock: 'powerplant', msg: '밤에도 불이 꺼지지 않는다.' },
    { id: 'computer',  era: 6, nm: '컴퓨터',   ic: '💻', cost: 4000, effect: { know: 2 }, unlock: 'lab', msg: '계산기가 사람보다 빠르게 생각한다.' },
    { id: 'medicine',  era: 6, nm: '의학',     ic: '💉', cost: 5000, effect: { growth: 1.5, faith: 1.2 }, unlock: 'park', msg: '병을 고친다. 아이들이 건강하게 자란다.' },
    { id: 'rocketry',  era: 6, nm: '로켓',     ic: '🚀', cost: 7000, effect: { build: 1.5 }, unlock: 'rocket', msg: '하늘 너머를 꿈꾼다.' },
    { id: 'fusion',    era: 7, nm: '핵융합',   ic: '☀️', cost: 12000, effect: { metal: 2, know: 1.5 }, msg: '작은 태양을 손에 넣었다.' },
    { id: 'warp',      era: 7, nm: '항성 항해', ic: '🌌', cost: 20000, effect: { faith: 2 }, msg: '별 사이를 건너는 법을 알아냈다. 새 세계가 기다린다.' }
  ],

  // ---------- 건물 ----------
  // cost: 짓는 데 드는 자원. work: 건축가가 일해야 하는 양(초). housing: 수용 인원.
  // role: research(지식) / faith(믿음) / storage(보관) / food(밭) / metal / happy(행복) / launch(새 세계)
  // auto: 시민이 알아서 짓는 조건 — 'house'(집 부족), 'one'(시대에 하나), 'storage'(창고 부족), 'farm'(인구 6명당 1), 'need'(지식 건물 없을 때)
  BUILDINGS: {
    hut:        { nm: '움막',     ic: '⛺', era: 0, cost: { wood: 12 }, work: 8, housing: 3, style: 'hut', auto: 'house' },
    totem:      { nm: '토템',     ic: '🗿', era: 0, cost: { wood: 8, stone: 6 }, work: 8, role: 'faith', research: true, style: 'totem', auto: 'one', msg: '토템을 세웠다. 시민들이 신에게 기도한다.' },
    storage:    { nm: '창고',     ic: '📦', era: 0, cost: { wood: 20, stone: 8 }, work: 12, role: 'storage', style: 'storage', auto: 'storage' },
    campfire:   { nm: '모닥불',   ic: '🔥', era: 0, cost: { wood: 10, stone: 4 }, work: 6, role: 'research', research: 1.5, style: 'campfire', auto: 'one', msg: '모닥불 곁에 모여 이야기를 나눈다.' },
    thatch:     { nm: '초가집',   ic: '🏠', era: 1, cost: { wood: 25, stone: 10 }, work: 14, housing: 5, style: 'thatch', auto: 'house' },
    farm:       { nm: '밭',       ic: '🌾', era: 1, cost: { wood: 15 }, work: 10, role: 'food', style: 'farm', auto: 'farm' },
    forge:      { nm: '대장간',   ic: '🔥', era: 1, cost: { wood: 30, stone: 25 }, work: 20, role: 'metal', style: 'forge', auto: 'one', msg: '대장간이 생겼다. 금속을 다룬다.' },
    wood:       { nm: '목조집',   ic: '🏡', era: 2, cost: { wood: 50, stone: 15, metal: 5 }, work: 20, housing: 8, style: 'wood', auto: 'house' },
    school:     { nm: '학당',     ic: '📚', era: 2, cost: { wood: 50, stone: 30, metal: 10 }, work: 28, role: 'research', research: 2.5, style: 'school', auto: 'one', msg: '학당에서 글을 배운다.' },
    stone:      { nm: '석조집',   ic: '🏘️', era: 3, cost: { stone: 70, wood: 30, metal: 10 }, work: 26, housing: 12, style: 'stone', auto: 'house' },
    market:     { nm: '시장',     ic: '🛒', era: 3, cost: { wood: 80, stone: 50, metal: 20 }, work: 30, role: 'happy', happy: 8, style: 'market', auto: 'one', msg: '시장이 열렸다. 마을이 활기차다.' },
    castle:     { nm: '성',       ic: '🏰', era: 3, cost: { stone: 200, metal: 40 }, work: 60, role: 'faith', faith: 2, style: 'castle', auto: 'one', msg: '성이 완성됐다. 늑대가 더는 오지 않는다.' },
    brick:      { nm: '벽돌집',   ic: '🏚️', era: 4, cost: { stone: 90, wood: 40, metal: 20 }, work: 30, housing: 16, style: 'brick', auto: 'house' },
    university: { nm: '대학',     ic: '🎓', era: 4, cost: { stone: 150, wood: 80, metal: 40 }, work: 50, role: 'research', research: 4, style: 'university', auto: 'one', msg: '대학이 문을 열었다.' },
    theater:    { nm: '극장',     ic: '🎭', era: 4, cost: { wood: 120, stone: 80 }, work: 40, role: 'happy', happy: 10, style: 'theater', auto: 'one', msg: '극장에서 연극을 본다.' },
    rowhouse:   { nm: '연립주택', ic: '🏢', era: 5, cost: { stone: 150, metal: 60, wood: 60 }, work: 36, housing: 24, style: 'rowhouse', auto: 'house' },
    factory:    { nm: '공장',     ic: '🏭', era: 5, cost: { metal: 150, stone: 150 }, work: 70, role: 'metal', metal: 3, style: 'factory', auto: 'one', msg: '공장 굴뚝에서 연기가 오른다.' },
    powerplant: { nm: '발전소',   ic: '⚡', era: 5, cost: { metal: 200, stone: 120 }, work: 70, role: 'research', research: 5, style: 'powerplant', auto: 'one', msg: '발전소가 돌아간다. 밤이 사라졌다.' },
    tower:      { nm: '고층빌딩', ic: '🏙️', era: 6, cost: { metal: 250, stone: 200 }, work: 60, housing: 48, style: 'tower', auto: 'house' },
    lab:        { nm: '연구소',   ic: '🔬', era: 6, cost: { metal: 300, stone: 150 }, work: 80, role: 'research', research: 8, style: 'lab', auto: 'one', msg: '연구소가 세워졌다.' },
    park:       { nm: '공원',     ic: '🌳', era: 6, cost: { wood: 150, stone: 80 }, work: 40, role: 'happy', happy: 12, style: 'park', auto: 'one', msg: '공원에서 쉰다.' },
    dome:       { nm: '돔 주거지', ic: '🛖', era: 7, cost: { metal: 500, stone: 300 }, work: 80, housing: 80, style: 'dome', auto: 'house' },
    rocket:     { nm: '우주선',   ic: '🚀', era: 7, cost: { metal: 1200, stone: 400 }, work: 200, role: 'launch', style: 'rocket', auto: 'one', msg: '우주선이 완성됐다! 새 세계를 열 수 있다.' }
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
    { id: 'idea',  nm: '영감',  ic: '💡', cost: 8,  amount: 25, hint: '지식 +25, 발견이 빨라집니다' },
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
    { id: 'insight', nm: '계시의 기적',   ic: '✨', cost: 45, miracle: 'insight', era: 2, hint: '지금 연구 중인 것을 바로 발견' }
  ],

  // ---------- 소원 (시민이 올리고, 들어주면 믿음) ----------
  // when: 이 조건일 때만 나옴. done: 이렇게 하면 들어준 것.
  WISHES: [
    { id: 'food',  txt: '배가 고파요…',          ic: '🍖', when: 'foodLow',  done: 'power:food', hint: '🍖 식량을 떨어뜨려 주세요' },
    { id: 'wood',  txt: '집 지을 나무가 없어요',  ic: '🪵', when: 'woodLow',  done: 'power:wood', hint: '🪵 나무를 떨어뜨려 주세요' },
    { id: 'stone', txt: '돌이 모자라요',          ic: '🪨', when: 'stoneLow', done: 'power:stone', hint: '🪨 돌을 떨어뜨려 주세요' },
    { id: 'idea',  txt: '좋은 생각이 안 나요',    ic: '💡', when: 'research', done: 'power:idea', hint: '💡 영감을 내려 주세요' },
    { id: 'rain',  txt: '밭이 말라요',            ic: '🌧️', when: 'farm',     done: 'power:rain', hint: '🌧️ 비를 내려 주세요' },
    { id: 'wolf',  txt: '늑대가 무서워요!',       ic: '🐺', when: 'wolf',     done: 'wolfDead', hint: '⚡ 번개로 늑대를 쫓아 주세요' },
    { id: 'move',  txt: '토템 곁에 가고 싶어요',  ic: '🗿', when: 'totem',    done: 'nearTotem', hint: '이 시민을 집어서 토템 옆에 내려 주세요' },
    { id: 'home',  txt: '잘 곳이 없어요',         ic: '🏠', when: 'homeless', done: 'housing', hint: '집이 지어지면 들어준 것. 신탁 "집을 지어라"가 빠릅니다' },
    { id: 'bandit', txt: '산적이 무서워요',       ic: '🏴‍☠️', when: 'bandit',   done: 'banditDead', hint: '🚩 집결로 전사를 보내거나 🔥 불벼락으로 소굴을 치세요' },
    { id: 'love',  txt: '짝을 만나고 싶어요',     ic: '💕', when: 'single',   done: 'married', hint: '결혼은 시민들이 알아서 합니다. 💗 치유를 내리면 마음이 열립니다' },
    { id: 'enemy', txt: '적이 쳐들어와요!',       ic: '⚔️', when: 'raid',     done: 'raidOver', hint: '🚩 집결·⚡ 번개·🔥 불벼락으로 막으세요' }
  ],

  // ---------- 오늘의 과제 ----------
  DAILY: [
    { id: 'wish', nm: '소원 들어주기', n: 3 },
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
    { id: 'explore', nm: '세상 끝까지', ic: '🧭', type: 'explored', n: 12, faith: 40 },
    { id: 'bandit3', nm: '산적 토벌', ic: '🏴‍☠️', type: 'bandit', n: 3, faith: 30 },
    { id: 'defend', nm: '마을을 지켰다', ic: '🛡️', type: 'defend', n: 1, faith: 25 },
    { id: 'conquer', nm: '정복자', ic: '👑', type: 'conquer', n: 1, faith: 100 }
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
    loot: ['보물이다!', '옛사람의 지혜야', '이걸 마을로 가져가자']
  },
  NAMES: ['우가', '마루', '두리', '보리', '나래', '가온', '하늘', '한결', '바위', '시내', '이슬', '별', '솔', '여울', '다솜', '누리', '푸름', '아름', '슬기', '으뜸', '온', '빛나', '새벽', '노을', '구름', '강', '샘', '들', '뫼', '미르', '라온', '초록', '하랑', '서리', '달'],
  HAIR: ['#2b2320', '#6b3f23', '#e8c060', '#d04a2a', '#e879b0', '#4f7fe0', '#4fb06a', '#9a5cf0', '#f0ede0', '#48b8b0'],
  SKIN: ['#f3d9b1', '#e3b88a', '#b07a4a']
};
