import { LESSONS } from './data/lessons';
import { blankOut, buildExam, EXAM_SIZE, MIN_LEARNED, scoreExam, wrongSetIds } from './quiz';

/** 테스트가 매번 같은 시험지를 만들도록 하는 고정 난수 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('학습 데이터', () => {
  it('20세트가 있고 id가 겹치지 않는다', () => {
    expect(LESSONS).toHaveLength(20);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(20);
  });

  it('모든 회화에 그 세트의 단어가 들어 있어 빈칸 문제를 만들 수 있다', () => {
    LESSONS.forEach((l) => {
      expect(blankOut(l)).not.toBeNull();
      expect(blankOut(l)).toContain('＿＿');
    });
  });

  it('뜻과 한자가 세트마다 달라 보기가 겹치지 않는다', () => {
    expect(new Set(LESSONS.map((l) => l.word.hanzi)).size).toBe(20);
    expect(new Set(LESSONS.map((l) => l.word.meaning)).size).toBe(20);
    expect(new Set(LESSONS.map((l) => l.phrase.meaning)).size).toBe(20);
  });
});

describe('시험지 만들기', () => {
  it('학습한 세트가 4개보다 적으면 시험을 못 본다', () => {
    expect(buildExam(LESSONS.slice(0, MIN_LEARNED - 1))).toHaveLength(0);
  });

  it('10문제가 나오고, 보기는 4개이며 정답이 그 안에 있다', () => {
    const exam = buildExam(LESSONS, { rng: seeded(7) });
    expect(exam).toHaveLength(EXAM_SIZE);
    exam.forEach((q) => {
      expect(q.choices).toHaveLength(4);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(4);
      expect(new Set(q.choices.map((c) => c.label)).size).toBe(4);
    });
  });

  it('학습한 세트에서만 문제가 나온다', () => {
    const learned = LESSONS.slice(0, 6);
    const ids = learned.map((l) => l.id);
    buildExam(learned, { rng: seeded(3) }).forEach((q) => {
      expect(ids).toContain(q.setId);
    });
  });

  it('학습한 세트가 문제 수보다 적어도 10문제를 채운다', () => {
    const exam = buildExam(LESSONS.slice(0, 4), { rng: seeded(11) });
    expect(exam).toHaveLength(EXAM_SIZE);
    expect(new Set(exam.map((q) => q.id)).size).toBe(EXAM_SIZE); // 똑같은 문제가 두 번 나오지 않는다
  });

  it('소리를 못 내는 기기에서는 듣기 문제를 내지 않는다', () => {
    const exam = buildExam(LESSONS, { listening: false, rng: seeded(5) });
    expect(exam.some((q) => q.kind === 'listenWord')).toBe(false);
  });

  it('세트가 20개일 때는 같은 세트가 두 번 나오지 않는다', () => {
    const exam = buildExam(LESSONS, { rng: seeded(21) });
    expect(new Set(exam.map((q) => q.setId)).size).toBe(EXAM_SIZE);
  });
});

describe('채점', () => {
  const exam = buildExam(LESSONS, { rng: seeded(2) });

  it('다 맞으면 10점, 안 풀면 0점', () => {
    expect(scoreExam(exam, exam.map((q) => q.answerIndex))).toBe(EXAM_SIZE);
    expect(scoreExam(exam, exam.map(() => null))).toBe(0);
  });

  it('틀린 문제의 세트를 복습 목록으로 돌려준다', () => {
    const answers = exam.map((q, i) => (i < 3 ? (q.answerIndex + 1) % 4 : q.answerIndex));
    expect(scoreExam(exam, answers)).toBe(EXAM_SIZE - 3);
    expect(wrongSetIds(exam, answers).sort()).toEqual(
      Array.from(new Set(exam.slice(0, 3).map((q) => q.setId))).sort()
    );
  });
});
