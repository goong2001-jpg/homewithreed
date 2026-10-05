import { WORD_BANK, Word } from './wordBank';

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

function shuffled<T>(items: T[], seed: number): T[] {
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

/** 단어장을 한 번 섞어둔 순서 — 이 순서대로 매일 10개씩 끊어서 쓴다 */
const ORDER = shuffled(WORD_BANK, 20260101);

/** 하루에 새로 배우는 단어 수 (나머지는 지난 며칠 단어를 복습한다) */
export const NEW_PER_DAY = 3;
/** 오답 노트에서 하루에 다시 꺼내 오는 단어 수 */
export const MAX_MISSED_PER_DAY = 3;
/** 복습으로 꼭 다시 나오는 날 수 */
export const REVIEW_DAYS = 2;

/** 그날 처음 배우는 단어 3개 */
function freshWords(day: number): Word[] {
  const n = ORDER.length;
  const start = (((day * NEW_PER_DAY) % n) + n) % n;
  const out: Word[] = [];
  for (let i = 0; i < NEW_PER_DAY; i++) out.push(ORDER[(start + i) % n]);
  return out;
}

/**
 * 오늘의 단어 10개
 *   = 새 단어 3개 + 어제 3개 + 그제 3개 + 사흘 전 1개.
 *
 * 한 단어를 사흘 내리 만나게 되므로 하루 만에 스쳐 지나가지 않는다.
 * 사흘 전 자리는 날마다 돌아가며 한 개씩 뽑아 네 번째 복습이 된다.
 */
export function wordsForDay(d: Date = new Date(), priority: Word[] = []): Word[] {
  const day = dayNumber(d);
  const fresh = freshWords(day);
  const review: Word[] = [];
  for (let back = 1; back <= REVIEW_DAYS; back++) review.push(...freshWords(day - back));
  // 사흘 전 단어 중 하나를 더 끼워 넣는다(자리는 날마다 이동)
  const older = freshWords(day - REVIEW_DAYS - 1);
  review.push(older[(((day % NEW_PER_DAY) + NEW_PER_DAY) % NEW_PER_DAY)]);

  // 전에 틀렸던 단어(오답 노트)는 복습 자리를 먼저 차지한다. 새 단어는 그대로 둔다.
  const taken = new Set(fresh.map(w => w.en));
  const extra = priority.filter(w => !taken.has(w.en)).slice(0, MAX_MISSED_PER_DAY);
  extra.forEach(w => taken.add(w.en));
  const rest = review.filter(w => !taken.has(w.en));
  const out = [...fresh, ...extra, ...rest].slice(0, WORDS_PER_DAY);
  // 새 단어와 복습 단어가 섞이도록 순서를 날마다 다르게 한다
  return shuffled(out, day * 977 + 31);
}

/**
 * "한 번 더" 할 때 쓰는 단어 10개.
 * 회차마다 아직 안 본 단어를 미리 보여줘서 늘 새롭고,
 * 이 단어들은 나중에 정식으로 배울 때 다시 만나게 된다.
 */
export function wordsForRound(round: number, d: Date = new Date(), priority: Word[] = []): Word[] {
  if (round <= 0) return wordsForDay(d, priority);
  const day = dayNumber(d);
  const n = ORDER.length;
  // 오늘 쓰는 구간(day-2 ~ day)에서 넉넉히 떨어뜨려 겹치지 않게 한다
  const start = ((((day * NEW_PER_DAY) + 40 + (round - 1) * WORDS_PER_DAY) % n) + n) % n;
  const out: Word[] = [];
  for (let i = 0; i < WORDS_PER_DAY; i++) out.push(ORDER[(start + i) % n]);
  return out;
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
    const wrong = shuffled(words.filter(w => w.en !== word.en), seed + i * 31).slice(0, 3);
    return {
      word,
      choices: shuffled([word, ...wrong], seed + i * 97 + 5),
      kind: i === 1 ? 'picture' : 'word',
    };
  });
}
