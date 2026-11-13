import { toughWords } from './pool';
import { WORD_BANK } from './wordBank';
import { buildable } from '../components/games/SentenceGame';
import { gradQuestions, GRAD_QUESTIONS } from '../components/GradTest';
import { UNITS } from './units';

describe('특별 훈련 단어', () => {
  const e = (wrong: number, box = 0) => ({ wrong, box, correct: 0, nextDue: '' });

  it('두 번 넘게 틀린 단어가 충분하면 그 단어들만, 많이 틀린 순서로', () => {
    const srs = { cat: e(2), dog: e(5), sun: e(3), ant: e(1), six: e(0) };
    expect(toughWords(srs).map(w => w.en)).toEqual(['dog', 'sun', 'cat']);
  });

  it('모자라면 한 번 틀린 단어까지 넣는다', () => {
    const srs = { cat: e(2), ant: e(1), six: e(0) };
    expect(toughWords(srs).map(w => w.en)).toEqual(['cat', 'ant']);
  });

  it('틀린 단어가 없으면 비어 있다', () => {
    expect(toughWords({ six: e(0) })).toEqual([]);
  });
});

describe('문장 만들기', () => {
  it('고른 문장은 3~5낱말이고 그 단어가 들어 있다', () => {
    for (const w of WORD_BANK) {
      const it = buildable(w);
      if (!it) continue;
      expect(it.tokens.length).toBeGreaterThanOrEqual(3);
      expect(it.tokens.length).toBeLessThanOrEqual(5);
      expect(it.tokens.join(' ')).toBe(it.sentence.en);
    }
  });

  it('거의 모든 단어로 문장을 만들 수 있다', () => {
    const ok = WORD_BANK.filter(w => buildable(w)).length;
    expect(ok / WORD_BANK.length).toBeGreaterThan(0.95);
  });
});

describe('졸업 시험 문제', () => {
  it('모든 단계에서 5문제가 나오고 보기 4개의 그림이 겹치지 않는다', () => {
    UNITS.forEach((_, unit) => {
      const qs = gradQuestions(unit);
      expect(qs).toHaveLength(GRAD_QUESTIONS);
      for (const q of qs) {
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices.map(c => c.emoji)).size).toBe(4);
        expect(q.choices.some(c => c.en === q.word.en)).toBe(true);
      }
    });
  });
});
