import { STORAGE_KEYS } from './data/types';
import { addExam, isExamRecord, loadExams } from './storage';

beforeEach(() => {
  localStorage.clear();
});

describe('시험 기록 저장', () => {
  const good = { takenAt: '2026-01-01T00:00:00.000Z', total: 10, correct: 7, wrongSetIds: [1, 2] };

  it('제대로 된 기록만 통과시킨다', () => {
    expect(isExamRecord(good)).toBe(true);
    expect(isExamRecord(null)).toBe(false);
    expect(isExamRecord('x')).toBe(false);
    expect(isExamRecord({ ...good, wrongSetIds: undefined })).toBe(false);
    expect(isExamRecord({ ...good, wrongSetIds: ['a'] })).toBe(false);
    expect(isExamRecord({ ...good, correct: '7' })).toBe(false);
    expect(isExamRecord({ ...good, takenAt: 123 })).toBe(false);
  });

  it('손상된 기록은 버리고 나머지만 돌려준다', () => {
    localStorage.setItem(
      STORAGE_KEYS.exams,
      JSON.stringify([good, null, 5, { takenAt: 'x' }, { ...good, wrongSetIds: 'oops' }])
    );
    expect(loadExams()).toEqual([good]);
  });

  it('배열이 아니면 빈 목록', () => {
    localStorage.setItem(STORAGE_KEYS.exams, JSON.stringify({ a: 1 }));
    expect(loadExams()).toEqual([]);
    localStorage.setItem(STORAGE_KEYS.exams, '{not json');
    expect(loadExams()).toEqual([]);
  });

  it('새 기록이 앞에 쌓인다', () => {
    addExam(good);
    const second = { ...good, correct: 9 };
    expect(addExam(second)).toEqual([second, good]);
    expect(loadExams()).toEqual([second, good]);
  });
});
