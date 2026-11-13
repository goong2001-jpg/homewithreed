import { WORD_BANK, Word } from './wordBank';
import { wordsOfSound } from './dailySet';
import { UNITS } from './units';

/**
 * 놀이터에서 쓸 단어 — 아이가 이미 배운 단어.
 * 아직 배운 단어가 적으면 지금까지 지난 소리 단계의 단어로 채운다.
 */
export function learnedPool(seen: Record<string, number>, unit: number, need = 12): Word[] {
  const out = WORD_BANK.filter(w => seen[w.en]);
  if (out.length >= need) return out;
  const have = new Set(out.map(w => w.en));
  for (let u = 0; u <= unit % UNITS.length && out.length < need; u++) {
    for (const s of UNITS[u]) for (const w of wordsOfSound(s)) {
      if (!have.has(w.en)) { out.push(w); have.add(w.en); }
    }
  }
  return out;
}

/** 무작위로 n 개 고르기 */
export function pickRandom<T>(items: T[], n: number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/** 집 안에서 실제로 찾아볼 수 있는 물건 */
export const FINDABLE = [
  'cup', 'spoon', 'fork', 'book', 'pencil', 'crayon', 'chair', 'door', 'window', 'bed',
  'lamp', 'clock', 'socks', 'shoes', 'hat', 'ball', 'doll', 'key', 'phone', 'box', 'bag',
  'apple', 'banana', 'egg', 'milk', 'water', 'robot', 'puzzle', 'balloon', 'umbrella',
  'glasses', 'scissors', 'ruler', 'pen', 'shirt', 'pants', 'television', 'computer',
];

/**
 * 자주 틀리는 단어 — 특별 훈련에 쓴다. 많이 틀린 순서대로.
 * 두 번 넘게 틀린 단어가 세 개가 안 되면 한 번 틀린 단어까지 넣는다.
 */
export function toughWords(srs: Record<string, { wrong: number; box: number }>, min = 3): Word[] {
  const byWrong = Object.entries(srs)
    .filter(([, e]) => e.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong || a[1].box - b[1].box);
  const often = byWrong.filter(([, e]) => e.wrong >= 2);
  const ids = (often.length >= min ? often : byWrong).map(([en]) => en);
  return ids.map(en => WORD_BANK.find(w => w.en === en)).filter((w): w is Word => !!w);
}
