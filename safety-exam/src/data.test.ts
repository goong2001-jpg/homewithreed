import { practicalQuestions } from './data/practicalQuestions';
import { parseImportJson } from './data/questionBank';
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

describe('문제 업로드 JSON 파싱', () => {
  test('정상 JSON은 필기/실기 모두 파싱된다', () => {
    const result = parseImportJson(
      JSON.stringify({
        written: [
          {
            subject: SUBJECTS[0],
            question: '테스트 문제',
            choices: ['a', 'b', 'c', 'd'],
            answer: 2,
            explanation: '해설',
          },
        ],
        practical: [{ category: '기계안전', question: '실기 문제', answer: '정답' }],
      })
    );
    expect(result.errors).toHaveLength(0);
    expect(result.written).toHaveLength(1);
    expect(result.written[0].answer).toBe(2);
    expect(result.practical).toHaveLength(1);
    expect(result.written[0].id).toMatch(/^cw-/);
    expect(result.practical[0].id).toMatch(/^cp-/);
  });

  test('배열만 있으면 필기 문제로 간주한다', () => {
    const result = parseImportJson(
      JSON.stringify([
        { subject: SUBJECTS[1], question: 'q', choices: ['1', '2', '3', '4'], answer: 0 },
      ])
    );
    expect(result.errors).toHaveLength(0);
    expect(result.written).toHaveLength(1);
    expect(result.written[0].explanation).toBe('(해설 없음)');
  });

  test('잘못된 항목은 이유와 함께 거부된다', () => {
    const result = parseImportJson(
      JSON.stringify({
        written: [
          { subject: '없는 과목', question: 'q', choices: ['1', '2', '3', '4'], answer: 0 },
          { subject: SUBJECTS[0], question: 'q', choices: ['1', '2'], answer: 0 },
          { subject: SUBJECTS[0], question: 'q', choices: ['1', '2', '3', '4'], answer: 4 },
        ],
        practical: [{ category: 'c', question: '', answer: 'a' }],
      })
    );
    expect(result.written).toHaveLength(0);
    expect(result.practical).toHaveLength(0);
    expect(result.errors).toHaveLength(4);
  });

  test('JSON이 아니면 형식 오류를 반환한다', () => {
    const result = parseImportJson('이것은 JSON이 아님');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.written).toHaveLength(0);
  });
});
