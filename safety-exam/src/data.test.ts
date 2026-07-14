import { practicalQuestions } from './data/practicalQuestions';
import { SUBJECTS } from './data/types';
import { writtenQuestions } from './data/writtenQuestions';

describe('필기 문제 데이터 무결성', () => {
  test('과목당 20문제 이상 존재한다', () => {
    SUBJECTS.forEach((subject) => {
      const count = writtenQuestions.filter((q) => q.subject === subject).length;
      expect(count).toBeGreaterThanOrEqual(20);
    });
  });

  test('모든 문제는 4개의 선택지를 가진다', () => {
    writtenQuestions.forEach((q) => {
      expect(q.choices).toHaveLength(4);
    });
  });

  test('정답 인덱스가 선택지 범위 안에 있다', () => {
    writtenQuestions.forEach((q) => {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
    });
  });

  test('문제 id가 중복되지 않는다', () => {
    const ids = writtenQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('모든 문제에 해설이 있다', () => {
    writtenQuestions.forEach((q) => {
      expect(q.explanation.trim().length).toBeGreaterThan(0);
    });
  });
});

describe('실기 문제 데이터 무결성', () => {
  test('60문제 이상 존재한다', () => {
    expect(practicalQuestions.length).toBeGreaterThanOrEqual(60);
  });

  test('문제 id가 중복되지 않는다', () => {
    const ids = practicalQuestions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('모든 문제에 정답이 있다', () => {
    practicalQuestions.forEach((q) => {
      expect(q.answer.trim().length).toBeGreaterThan(0);
    });
  });
});
