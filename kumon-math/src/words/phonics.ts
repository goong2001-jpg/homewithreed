/**
 * 단어의 "첫소리" 힌트.
 *
 * 7살 아이는 철자만 보고는 고르기 어렵다.
 * moon 이면 "므, 므, 므" 하고 첫소리를 들려주면
 * 보기 중에서 m 으로 시작하는 것을 찾아낼 수 있다.
 *
 * 읽어주기(TTS)는 'm' 을 글자 이름인 "엠"으로 읽어버리므로,
 * 소리가 나도록 "muh" 같은 소리글자로 바꿔서 들려준다.
 */

/** 두 글자가 한 소리를 내는 것들 — 한 글자 규칙보다 먼저 본다 */
const DIGRAPHS: Record<string, string> = {
  ch: 'chuh', sh: 'shuh', th: 'thuh', wh: 'wuh', ph: 'fuh', qu: 'kwuh',
};

const LETTERS: Record<string, string> = {
  b: 'buh', c: 'kuh', d: 'duh', f: 'fuh', g: 'guh', h: 'huh', j: 'juh',
  k: 'kuh', l: 'luh', m: 'muh', n: 'nuh', p: 'puh', r: 'ruh', s: 'suh',
  t: 'tuh', v: 'vuh', w: 'wuh', x: 'ksuh', y: 'yuh', z: 'zuh',
  // 짧은 모음 (apple 애, egg 에, igloo 이, octopus 아, umbrella 어)
  a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh',
};

/** 규칙에서 벗어나는 단어들 (묵음·예외 발음) */
const EXCEPTIONS: Record<string, { sound: string; letters: string }> = {
  knife:       { sound: 'nuh', letters: 'kn' },  // k 는 소리가 나지 않는다
  write:       { sound: 'ruh', letters: 'wr' },  // w 는 소리가 나지 않는다
  one:         { sound: 'wuh', letters: 'o' },   // "원"
  giraffe:     { sound: 'juh', letters: 'g' },
  chef:        { sound: 'shuh', letters: 'ch' },
  school:      { sound: 'skuh', letters: 'sch' },
  scooter:     { sound: 'skuh', letters: 'sc' },
  squirrel:    { sound: 'skwuh', letters: 'squ' },
  eight:       { sound: 'ay', letters: 'ei' },
  eat:         { sound: 'ee', letters: 'ea' },
  ear:         { sound: 'ear', letters: 'ea' },
  earth:       { sound: 'er', letters: 'ea' },
  eye:         { sound: 'eye', letters: 'ey' },
  ice:         { sound: 'eye', letters: 'i' },
  island:      { sound: 'eye', letters: 'is' },
  owl:         { sound: 'ow', letters: 'ow' },
  arm:         { sound: 'ar', letters: 'ar' },
  onion:       { sound: 'uh', letters: 'o' },
  orange:      { sound: 'or', letters: 'or' },
  airplane:    { sound: 'air', letters: 'ai' },
};

function key(en: string): string {
  return en.trim().toLowerCase();
}

/**
 * 규칙대로 읽히지 않는 단어인지 (묵음, 긴 모음 등).
 * 소리를 처음 배울 때는 헷갈리므로 "오늘의 소리" 단어로는 쓰지 않는다.
 */
export function isIrregular(en: string): boolean {
  const w = key(en);
  return Boolean(EXCEPTIONS[w] ?? EXCEPTIONS[w.split(' ')[0]]);
}

/** 화면에 보여줄 첫 글자 (예: moon → "m", chair → "ch") */
export function firstLetters(en: string): string {
  const w = key(en);
  const ex = EXCEPTIONS[w] ?? EXCEPTIONS[w.split(' ')[0]];
  if (ex) return ex.letters;
  const two = w.slice(0, 2);
  if (DIGRAPHS[two]) return two;
  return w.slice(0, 1);
}

/** 한 번 들려줄 소리 (예: moon → "muh") */
export function firstSound(en: string): string {
  const w = key(en);
  const ex = EXCEPTIONS[w] ?? EXCEPTIONS[w.split(' ')[0]];
  if (ex) return ex.sound;
  const two = w.slice(0, 2);
  if (DIGRAPHS[two]) return DIGRAPHS[two];
  return LETTERS[w[0]] ?? w[0];
}

/**
 * 화면에 보여줄 한글 소리 (예: moon → "므", airplane → "에어").
 *
 * 영어 철자를 그대로 보여주면 아이가 소리를 듣지 않고
 * 글자만 눈으로 맞춰 버리므로, 소리를 한글로 적어 준다.
 */
const KO_SOUND: Record<string, string> = {
  // 자음
  buh: '브', kuh: '크', duh: '드', fuh: '프', guh: '그', huh: '흐',
  juh: '즈', luh: '르', muh: '므', nuh: '느', puh: '프', ruh: '르',
  suh: '스', tuh: '트', vuh: '브', wuh: '워', yuh: '유', zuh: '즈',
  ksuh: '크스',
  // 두 글자 소리
  chuh: '츄', shuh: '쉬', thuh: '쓰', kwuh: '쿠', skuh: '스크', skwuh: '스쿠',
  // 모음
  ah: '애', eh: '에', ih: '이', aw: '아', uh: '어', ar: '아',
  ay: '에이', ee: '이', eye: '아이', ow: '아우',
  or: '오', er: '어', air: '에어', ear: '이어',
};

export function firstSoundKo(en: string): string {
  const s = firstSound(en);
  return KO_SOUND[s] ?? s;
}

/** 읽어주기에 넘길 문장 — 세 번 반복해서 또렷하게 들린다 */
export function firstSoundPhrase(en: string): string {
  const s = firstSound(en);
  return `${s}, ${s}, ${s}`;
}
