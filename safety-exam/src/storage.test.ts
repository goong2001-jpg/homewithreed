import { InProgressExam, STORAGE_KEYS } from './data/types';
import {
  clearInProgressExam,
  isInProgressExam,
  loadInProgressExam,
  saveInProgressExam,
} from './storage';

const good: InProgressExam = {
  mode: 'quick',
  questionIds: ['a', 'b'],
  choiceOrders: { a: [1, 0, 3, 2], b: [0, 1, 2, 3] },
  answers: { a: 2 },
  deadlineAt: 2_000_000,
  current: 1,
};

beforeEach(() => {
  localStorage.clear();
});

describe('풀다 만 시험 저장', () => {
  test('제대로 된 기록만 통과시킨다', () => {
    expect(isInProgressExam(good)).toBe(true);
    expect(isInProgressExam(null)).toBe(false);
    expect(isInProgressExam({ ...good, mode: 'x' })).toBe(false);
    expect(isInProgressExam({ ...good, questionIds: [] })).toBe(false);
    expect(isInProgressExam({ ...good, questionIds: [1] })).toBe(false);
    expect(isInProgressExam({ ...good, choiceOrders: { a: ['1'] } })).toBe(false);
    expect(isInProgressExam({ ...good, answers: { a: '2' } })).toBe(false);
    expect(isInProgressExam({ ...good, deadlineAt: '2000' })).toBe(false);
  });

  test('저장하고 다시 읽는다', () => {
    saveInProgressExam(good);
    expect(loadInProgressExam(1_000_000)).toEqual(good);
  });

  test('마감이 지난 시험은 버리고 지운다', () => {
    saveInProgressExam(good);
    expect(loadInProgressExam(2_000_000)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.inProgressExam)).toBeNull();
  });

  test('손상된 기록은 null', () => {
    localStorage.setItem(STORAGE_KEYS.inProgressExam, '{broken');
    expect(loadInProgressExam(0)).toBeNull();
    localStorage.setItem(STORAGE_KEYS.inProgressExam, JSON.stringify({ mode: 'full' }));
    expect(loadInProgressExam(0)).toBeNull();
  });

  test('지우면 없다', () => {
    saveInProgressExam(good);
    clearInProgressExam();
    expect(loadInProgressExam(0)).toBeNull();
  });
});
