import { WORD_BANK, Word } from './wordBank';
import { firstSound, firstLetters, isIrregular } from './phonics';
import { UNITS, SoundDef } from './units';

export const WORDS_PER_DAY = 10;
export const TEST_COUNT = 3;

/** 같은 입력이면 늘 같은 결과가 나오는 작은 난수기 */
function makeRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function shuffled<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  const rnd = makeRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 오늘이 1970-01-01로부터 며칠째인지 (기기 시간 기준) */
export function dayNumber(d: Date = new Date()): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** 오답 노트에서 하루에 다시 꺼내 오는 단어 수 */
export const MAX_MISSED_PER_DAY = 2;
/** 소리 하나에서 하루에 배우는 단어 수 (두 소리 × 4 = 8, 나머지 2개는 복습) */
const PER_SOUND = 4;

/** 이 단어가 해당 소리로 시작하는지 (불규칙한 단어는 제외) */
export function hasSound(w: Word, sound: SoundDef): boolean {
  return !isIrregular(w.en)
    && firstSound(w.en) === sound.key
    && sound.letters.includes(firstLetters(w.en));
}

/** 해당 소리로 시작하는 단어들 — 늘 같은 순서로 */
export function wordsOfSound(sound: SoundDef): Word[] {
  return shuffled(WORD_BANK.filter(w => hasSound(w, sound)), sound.key.length * 101 + sound.key.charCodeAt(0));
}

export interface DayPlan {
  /** 몇 번째 소리 단계인지 (0부터) */
  unit: number;
  /** 그 단계의 며칠째인지 (0부터) */
  unitDay: number;
}

/** 소리 하나에서 오늘 쓸 단어 — 단계의 이틀째에는 다른 단어부터 보여준다 */
function pickFromSound(sound: SoundDef, unitDay: number, count: number): Word[] {
  const list = wordsOfSound(sound);
  if (list.length <= count) return list;
  const start = (unitDay * count) % list.length;
  const out: Word[] = [];
  for (let i = 0; i < count; i++) out.push(list[(start + i) % list.length]);
  return out;
}

/** 지난 단계에서 배운 소리의 단어들 (복습용) */
function pastWords(unit: number): Word[] {
  const out: Word[] = [];
  for (let u = 0; u < unit; u++) for (const s of UNITS[u]) out.push(...wordsOfSound(s));
  return out;
}

/**
 * 오늘의 단어 10개
 *   = 오늘의 소리 A 4개 + 소리 B 4개 + 복습 2개.
 * 복습 자리는 오답 노트 단어가 먼저 차지하고, 남으면 지난 단계 소리의 단어로 채운다.
 * 첫 단계라 지난 소리가 없으면 오늘의 소리 단어를 더 넣는다.
 */
export function wordsForDay(plan: DayPlan, d: Date = new Date(), priority: Word[] = []): Word[] {
  const day = dayNumber(d);
  const [a, b] = UNITS[plan.unit % UNITS.length];
  const main = [...pickFromSound(a, plan.unitDay, PER_SOUND), ...pickFromSound(b, plan.unitDay, PER_SOUND)];
  const taken = new Set(main.map(w => w.en));
  const out = [...main];
  const add = (w: Word) => {
    if (out.length < WORDS_PER_DAY && !taken.has(w.en)) { out.push(w); taken.add(w.en); }
  };
  priority.slice(0, MAX_MISSED_PER_DAY).forEach(add);
  shuffled(pastWords(plan.unit % UNITS.length), day * 13 + 7).forEach(add);
  // 지난 소리가 없을 때(첫 단계): 오늘의 소리 단어를 더 꺼낸다
  [...wordsOfSound(a), ...wordsOfSound(b)].forEach(add);
  WORD_BANK.forEach(add);
  // 소리끼리 몰려 있지 않게 섞는다
  return shuffled(out, day * 977 + 31);
}

/**
 * word    = 그림과 뜻을 보고 영어 단어를 고른다
 * picture = 영어 단어를 듣고(보고) 알맞은 그림을 고른다
 */
export type QuestionKind = 'word' | 'picture';

export interface Question {
  word: Word;
  choices: Word[];
  kind: QuestionKind;
}

/**
 * 오늘의 단어 중 3개를 문제로 낸다.
 * round를 바꾸면 다른 문제가 나와서 "한 번 더" 연습할 수 있다.
 * priority(전에 틀린 단어)가 단어 목록에 있으면 그것부터 문제로 낸다.
 * 가운데 문제는 거꾸로(듣고 그림 고르기) 내서 듣기 연습도 섞는다.
 */
export function questionsForDay(
  words: Word[], round = 0, d: Date = new Date(), priority: string[] = [],
): Question[] {
  const seed = dayNumber(d) * 131 + round * 7717 + 3;
  const first = words.filter(w => priority.includes(w.en));
  const others = shuffled(words.filter(w => !priority.includes(w.en)), seed);
  const picked = shuffled([...first, ...others].slice(0, TEST_COUNT), seed + 11);
  return picked.map((word, i) => {
    // 뜻 고르기 문제는 첫소리가 다른 단어를 보기로 낸다 — 들은 소리로 가려낼 수 있게
    const kind: QuestionKind = i === 1 ? 'picture' : 'word';
    const others = shuffled(words.filter(w => w.en !== word.en), seed + i * 31);
    const differ = others.filter(w => firstSound(w.en) !== firstSound(word.en));
    const wrong = (kind === 'word' ? [...differ, ...others.filter(w => !differ.includes(w))] : others).slice(0, 3);
    return {
      word,
      choices: shuffled([word, ...wrong], seed + i * 97 + 5),
      kind,
    };
  });
}
