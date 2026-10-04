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

/**
 * 오늘의 단어 10개.
 * 섞어둔 순서에서 하루에 10칸씩 옮겨가며 잘라 쓰므로
 * 어제 나온 단어가 오늘 또 나오는 일이 없고,
 * 끝까지 가면 처음으로 돌아와 다시 돈다(약 24일 주기).
 */
export function wordsForDay(d: Date = new Date()): Word[] {
  const day = dayNumber(d);
  const n = ORDER.length;
  const start = (((day * WORDS_PER_DAY) % n) + n) % n;
  const out: Word[] = [];
  for (let i = 0; i < WORDS_PER_DAY; i++) out.push(ORDER[(start + i) % n]);
  return out;
}

export interface Question {
  word: Word;
  choices: Word[];
}

/**
 * 오늘의 단어 중 3개를 문제로 낸다.
 * round를 바꾸면 다른 문제가 나와서 "한 번 더" 연습할 수 있다.
 */
export function questionsForDay(words: Word[], round = 0, d: Date = new Date()): Question[] {
  const seed = dayNumber(d) * 131 + round * 7717 + 3;
  const picked = shuffled(words, seed).slice(0, TEST_COUNT);
  return picked.map((word, i) => {
    const others = shuffled(words.filter(w => w.en !== word.en), seed + i * 31).slice(0, 3);
    return { word, choices: shuffled([word, ...others], seed + i * 97 + 5) };
  });
}
