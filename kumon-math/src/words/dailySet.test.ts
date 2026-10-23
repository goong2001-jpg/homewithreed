import { wordsForDay, reviewForDay, mainWords, wordsOfSound, WORDS_PER_DAY, REVIEW_SLOTS, todayKey } from './dailySet';
import { UNITS } from './units';
import { SrsMap } from './srs';
import { WORD_BANK } from './wordBank';

const D = new Date(2026, 2, 10); // 2026-03-10
const T = todayKey(D);

describe('오늘의 단어와 간격 반복', () => {
  it('복습 차례인 지난 단계 단어가 복습 자리에 먼저 들어간다', () => {
    const past = wordsOfSound(UNITS[0][0])[0].en; // 1단계 소리의 단어
    const srs: SrsMap = { [past]: { box: 0, nextDue: '2026-03-09', correct: 0, wrong: 1 } };
    const plan = { unit: 2, unitDay: 0 };
    const review = reviewForDay(srs, plan, D);
    expect(review).toEqual([past]);
    const words = wordsForDay(plan, D, [], review.map(en => WORD_BANK.find(w => w.en === en)!));
    expect(words).toHaveLength(WORDS_PER_DAY);
    expect(words.map(w => w.en)).toContain(past);
  });

  it('아직 복습일이 안 된 단어는 복습으로 꺼내지 않는다', () => {
    const past = wordsOfSound(UNITS[0][0])[0].en;
    const srs: SrsMap = { [past]: { box: 3, nextDue: '2026-03-20', correct: 3, wrong: 0 } };
    expect(reviewForDay(srs, { unit: 2, unitDay: 0 }, D)).toEqual([]);
  });

  it('아직 배우지 않은 단계의 단어는 복습 차례여도 꺼내지 않는다 (진도 순서 존중)', () => {
    const future = wordsOfSound(UNITS[5][0])[0].en; // 6단계 소리의 단어
    const srs: SrsMap = { [future]: { box: 0, nextDue: T, correct: 0, wrong: 1 } };
    expect(reviewForDay(srs, { unit: 1, unitDay: 0 }, D)).toEqual([]);
  });

  it('복습 자리 수만큼만, 낮은 상자부터 꺼낸다', () => {
    const [a, b] = UNITS[0];
    const ids = [...wordsOfSound(a), ...wordsOfSound(b)].map(w => w.en).slice(0, 4);
    const srs: SrsMap = {
      [ids[0]]: { box: 2, nextDue: T, correct: 2, wrong: 0 },
      [ids[1]]: { box: 0, nextDue: T, correct: 0, wrong: 1 },
      [ids[2]]: { box: 1, nextDue: '2026-03-01', correct: 1, wrong: 0 },
      [ids[3]]: { box: 1, nextDue: '2026-03-05', correct: 1, wrong: 0 },
    };
    const review = reviewForDay(srs, { unit: 3, unitDay: 0 }, D);
    expect(review).toHaveLength(REVIEW_SLOTS);
    expect(review).toEqual([ids[1], ids[2]]);
  });

  it('오늘 새로 배울 8개는 복습 후보에서 뺀다', () => {
    const plan = { unit: 0, unitDay: 0 };
    const main = mainWords(plan).map(w => w.en);
    expect(main).toHaveLength(8);
    const srs: SrsMap = Object.fromEntries(main.map(en => [en, { box: 0, nextDue: T, correct: 0, wrong: 1 }]));
    expect(reviewForDay(srs, plan, D)).toEqual([]);
    // 오늘 단어 10개 안에는 그 8개가 다 들어 있다
    const today = wordsForDay(plan, D).map(w => w.en);
    main.forEach(en => expect(today).toContain(en));
  });
});
