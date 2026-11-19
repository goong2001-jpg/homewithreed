import { UNITS } from './units';

/**
 * 구름이 책장 — 디코더블 리더 (파닉스로 읽을 수 있는 짧은 이야기책).
 *
 * 책마다 소리 단계가 정해져 있고, 그 단계까지 배운 소리와 몇 개의 "외워서 읽는 단어"만으로 썼다.
 * 그래서 아이가 배운 원리로 직접 소리 내어 읽을 수 있다 (books.test.ts 가 확인한다).
 * 1권은 첫 단계(s a)에서 바로 읽을 수 있게 다음 단계 소리(t p)까지 쓴다.
 *
 * 읽는 순서: ① 요정이 읽어 주는 걸 듣기 → ② 소리 내어 읽기(녹음) → ③ 내 목소리 다시 듣기
 */
export interface BookPage {
  /** 그림 (이모지) */
  pic: string;
  en: string;
  ko: string;
}

export interface Book {
  id: string;
  /** 이 소리 단계(0부터)가 되면 읽을 수 있다 */
  unit: number;
  title: string;
  titleKo: string;
  cover: string;
  pages: BookPage[];
}

/** 파닉스 규칙으로 읽기 어려워 통째로 외워서 읽는 단어 */
export const SIGHT_WORDS = new Set([
  'i', 'a', 'the', 'is', 'to', 'and', 'said', 'he', 'she', 'we', 'me', 'my', 'you', 'go', 'no',
  'see', 'like', 'has', 'was', 'of', 'are', 'for', 'do', 'so', 'they', 'here', 'come', 'put', 'all', 'be',
]);

const P = (pic: string, en: string, ko: string): BookPage => ({ pic, en, ko });

export const BOOKS: Book[] = [
  {
    id: 'spa', unit: 0, title: 'Pat at the Spa', titleKo: '스파에 간 팻', cover: '🛁',
    pages: [
      P('👧', 'Pat sat.', '팻이 앉았어요.'),
      P('🚰', 'Pat sat at a tap.', '팻이 수도꼭지 앞에 앉았어요.'),
      P('👆', 'Pat taps.', '팻이 톡톡 두드려요.'),
      P('💧', 'Tap, tap, tap!', '톡, 톡, 톡!'),
      P('🛁', 'Pat is at a spa!', '팻은 스파에 왔어요!'),
    ],
  },
  {
    id: 'spat', unit: 1, title: 'Pat and Tat', titleKo: '팻과 탯', cover: '👧',
    pages: [
      P('👧🧒', 'Pat and Tat.', '팻과 탯이에요.'),
      P('🪑', 'Pat sat. Tat sat.', '팻이 앉았어요. 탯도 앉았어요.'),
      P('👉', 'Tat taps Pat. Pat taps Tat.', '탯이 팻을 톡 쳐요. 팻도 탯을 톡 쳐요.'),
      P('💥', 'A spat!', '말다툼이 났어요!'),
      P('🤗', 'Pat pats Tat. Tat pats Pat.', '팻이 탯을 토닥여요. 탯도 팻을 토닥여요.'),
    ],
  },
  {
    id: 'nat', unit: 2, title: 'Nat Naps', titleKo: '낮잠 자는 냇', cover: '😴',
    pages: [
      P('👦', 'Nat sits.', '냇이 앉아요.'),
      P('🍳', 'Nat tips a pan.', '냇이 냄비를 기울여요.'),
      P('🥫', 'A tin is in the pan!', '냄비 안에 깡통이 있어요!'),
      P('📌', 'It is a pin in a tin.', '깡통 안에 핀이 있어요.'),
      P('😴', 'Nat naps.', '냇은 낮잠을 자요.'),
    ],
  },
  {
    id: 'map', unit: 3, title: 'Dad and the Map', titleKo: '아빠와 지도', cover: '🗺️',
    pages: [
      P('👨', 'Dad has a map.', '아빠는 지도가 있어요.'),
      P('👧', 'Mia and Dad sit.', '미아와 아빠가 앉아요.'),
      P('🗺️', 'Mia taps the map.', '미아가 지도를 톡 짚어요.'),
      P('🏊', 'Dad and Mia dip in.', '아빠와 미아가 물에 풍덩 들어가요.'),
      P('💦', 'Dip, dip, dip!', '첨벙, 첨벙, 첨벙!'),
    ],
  },
  {
    id: 'pond', unit: 4, title: 'The Dog and the Pig', titleKo: '강아지와 돼지', cover: '🐶',
    pages: [
      P('🐶', 'A dog sat on a mat.', '강아지가 물 위 매트에 앉았어요.'),
      P('🐷', 'A pig got on top!', '돼지도 위에 올라탔어요!'),
      P('🙃', 'Tip, tip, tip!', '기우뚱, 기우뚱, 기우뚱!'),
      P('💥', 'Pop! The mat dips.', '펑! 매트가 물에 잠겨요.'),
      P('💦', 'The dog and the pig dip in a pond.', '강아지와 돼지가 연못에 풍덩!'),
    ],
  },
  {
    id: 'kit', unit: 5, title: 'Ted and Kit', titleKo: '테드와 고양이 킷', cover: '🐱',
    pages: [
      P('👦', 'Ted has a pet.', '테드는 반려동물이 있어요.'),
      P('🐱', 'The cat is Kit.', '고양이 이름은 킷이에요.'),
      P('🧢', 'Kit naps in a cap.', '킷은 모자 안에서 낮잠을 자요.'),
      P('🍲', 'Kit gets in a pot.', '킷이 냄비 안에 들어가요.'),
      P('😸', 'Ted pets Kit. Kit is top cat!', '테드가 킷을 쓰다듬어요. 킷은 최고 고양이!'),
    ],
  },
  {
    id: 'pup', unit: 6, title: 'Run, Pup, Run!', titleKo: '달려라, 강아지야!', cover: '🐕',
    pages: [
      P('☀️', 'A pup in the sun.', '햇볕 아래 강아지 한 마리.'),
      P('🏃', 'Run, pup, run!', '달려라, 강아지야, 달려!'),
      P('🧦', 'The pup tugs a rag.', '강아지가 걸레를 잡아당겨요.'),
      P('🟤', 'Mud! The pup is a mess.', '진흙이다! 강아지가 엉망이 됐어요.'),
      P('🫧', 'Mom gets a pot. Dunk, dunk, dunk!', '엄마가 통을 가져와요. 풍덩, 풍덩, 풍덩!'),
    ],
  },
  {
    id: 'bug', unit: 7, title: 'Bob and the Bug', titleKo: '밥과 벌레', cover: '🐛',
    pages: [
      P('🐛', 'Bob has a bug.', '밥은 벌레가 있어요.'),
      P('🗑️', 'The bug is in a bin.', '벌레가 통 안에 있어요.'),
      P('⬆️', 'Hop! The bug hops up.', '폴짝! 벌레가 뛰어올라요.'),
      P('🎩', 'It hops on a hat. It hops on Bob!', '모자 위로 폴짝. 밥 위로 폴짝!'),
      P('😆', 'Ha, ha! Bob and the bug.', '하하! 밥과 벌레.'),
    ],
  },
  {
    id: 'sled', unit: 8, title: 'Fun on the Hill', titleKo: '언덕에서 신나게', cover: '🛷',
    pages: [
      P('⛰️', 'Lin and Fin go up a hill.', '린과 핀이 언덕에 올라가요.'),
      P('🛷', 'Fin has a sled.', '핀은 썰매가 있어요.'),
      P('👫', 'Lin and Fin sit on the sled.', '린과 핀이 썰매에 앉아요.'),
      P('💨', 'Fast, fast, fast!', '빨리, 빨리, 빨리!'),
      P('❄️', 'Flop! Lin and Fin fell flat.', '털썩! 린과 핀이 납작 넘어졌어요.'),
      P('😆', 'It is fun, fun, fun!', '정말 정말 재미있어요!'),
    ],
  },
  {
    id: 'jam', unit: 9, title: 'Jen and the Jam', titleKo: '젠과 잼', cover: '🍓',
    pages: [
      P('🍓', 'Jen has a jug of jam.', '젠은 잼 한 병이 있어요.'),
      P('🌬️', 'The wind is big!', '바람이 세게 불어요!'),
      P('💥', 'Wham! The jug tips.', '쾅! 병이 넘어져요.'),
      P('🕸️', 'Jam is on the web.', '거미줄에 잼이 묻었어요.'),
      P('🐞', 'The bug sips the jam.', '벌레가 잼을 홀짝 먹어요.'),
    ],
  },
  {
    id: 'van', unit: 10, title: 'Vic and the Van', titleKo: '빅과 승합차', cover: '🚐',
    pages: [
      P('🚐', 'Vic has a van.', '빅은 승합차가 있어요.'),
      P('👜', 'In the van is a big red bag.', '차 안에 커다란 빨간 가방이 있어요.'),
      P('🙋', 'Can I get in? Yes, yes, yes!', '나도 타도 돼요? 그럼, 그럼, 그럼!'),
      P('🦺', 'Vic gets a vest.', '빅이 조끼를 입어요.'),
      P('💨', 'The van will go. Yip, yip!', '차가 출발해요. 야호, 야호!'),
    ],
  },
  {
    id: 'quiz', unit: 11, title: 'Zak and the Quiz', titleKo: '잭과 퀴즈', cover: '❓',
    pages: [
      P('🐝', 'Buzz, buzz! A bug zips.', '윙윙! 벌레가 휙 날아가요.'),
      P('📝', 'Zak has a quiz.', '잭은 퀴즈를 봐요.'),
      P('🤔', 'Can Zak quit? No, Zak will not quit!', '잭이 포기할까요? 아니, 잭은 포기하지 않아요!'),
      P('⚡', 'Zip, zap, zip! Zak is quick.', '휙, 휙, 휙! 잭은 빨라요.'),
      P('🏆', 'Zak gets ten! Zak is the top.', '잭이 10점을 받았어요! 잭이 최고예요.'),
    ],
  },
  {
    id: 'fish', unit: 12, title: 'Fish and Chips', titleKo: '피시 앤 칩스', cover: '🐟',
    pages: [
      P('🚢', 'Chen is on a ship.', '첸이 배에 타고 있어요.'),
      P('🎣', 'Chen gets a fish.', '첸이 물고기를 잡아요.'),
      P('🐟', 'The fish is big. Splash!', '물고기가 커요. 첨벙!'),
      P('🍟', 'Chen has fish and chips.', '첸은 피시 앤 칩스를 먹어요.'),
      P('😋', 'Munch, munch! Shh, Chen is full.', '냠냠! 쉿, 첸은 배가 불러요.'),
    ],
  },
  {
    id: 'bath', unit: 13, title: 'Phil in the Bath', titleKo: '목욕하는 필', cover: '🛁',
    pages: [
      P('🛁', 'Phil has a big bath.', '필은 커다란 욕조가 있어요.'),
      P('👉', 'This is the bath. That is the tub.', '이건 목욕물이에요. 저건 욕조예요.'),
      P('🦆', 'Phil gets in with a duck.', '필이 오리 인형이랑 들어가요.'),
      P('💥', 'Thud! The duck fell.', '쿵! 오리가 떨어졌어요.'),
      P('😂', 'Phil and the duck. Thanks, duck!', '필과 오리. 고마워, 오리야!'),
    ],
  },
];

/** 단계 unit 까지 배운 글자 (1권은 첫 단계에서 읽을 수 있게 둘째 단계까지) */
export function lettersUpTo(unit: number): Set<string> {
  const out = new Set<string>();
  const last = Math.max(unit, 1);
  for (let u = 0; u <= last && u < UNITS.length; u++) {
    for (const s of UNITS[u]) for (const l of s.letters) for (const ch of l.replace(/\s/g, '')) out.add(ch);
  }
  return out;
}

/** 문장을 낱말로 나눈다 (문장부호는 떼어 낸다) — 화면에서 낱말마다 누를 수 있게 */
export function tokenize(sentence: string): { word: string; clean: string }[] {
  return sentence.split(/\s+/).filter(Boolean).map(word => ({
    word,
    clean: word.toLowerCase().replace(/[^a-z']/g, ''),
  }));
}

/** 이 낱말이 그 단계에서 소리로 읽을 수 있는지 (외워서 읽는 단어는 언제나 된다) */
export function isDecodable(clean: string, unit: number): boolean {
  if (!clean || SIGHT_WORDS.has(clean)) return true;
  const letters = lettersUpTo(unit);
  return clean.split('').every(ch => letters.has(ch));
}

/** 지금 읽을 수 있는 책 — 지금 배우는 단계까지 */
export function unlockedBooks(unit: number): Book[] {
  return BOOKS.filter(b => b.unit <= unit);
}

export function bookById(id: string): Book | undefined {
  return BOOKS.find(b => b.id === id);
}
