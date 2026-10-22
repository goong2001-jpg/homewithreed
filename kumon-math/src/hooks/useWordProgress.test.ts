import { act, renderHook } from '@testing-library/react';
import { useWordProgress } from './useWordProgress';
import { todayKey } from '../words/dailySet';
import { addDays } from '../words/dates';

const KEY = 'word_progress';

beforeEach(() => { localStorage.clear(); });

describe('useWordProgress — 간격 반복', () => {
  it('단어 카드를 보면 1번 상자(내일 복습)에 들어간다', () => {
    const { result } = renderHook(() => useWordProgress());
    act(() => result.current.learnNext(10, 'cat'));
    expect(result.current.progress.srs.cat).toEqual({ box: 1, nextDue: addDays(todayKey(), 1), correct: 0, wrong: 0 });
    // 또 봐도 상자는 그대로
    act(() => result.current.learnNext(10, 'cat'));
    expect(result.current.progress.srs.cat.box).toBe(1);
  });

  it('문제를 맞히면 상자가 오르고, 틀리면 0번으로 떨어진다 (처음 푸는 답만)', () => {
    const { result } = renderHook(() => useWordProgress());
    act(() => result.current.learnNext(10, 'cat'));
    act(() => result.current.answer(true, 'cat', true));
    expect(result.current.progress.srs.cat.box).toBe(2);
    expect(result.current.progress.todayCorrect).toEqual(['cat']);
    act(() => result.current.answer(false, 'dog', true));
    expect(result.current.progress.srs.dog).toEqual({ box: 0, nextDue: addDays(todayKey(), 0), correct: 0, wrong: 1 });
    // 틀린 문제를 다시 맞힌 건 상자를 올리지 않는다
    act(() => result.current.answer(true, 'dog', false));
    expect(result.current.progress.srs.dog.box).toBe(0);
    // 다른 화면도 보도록 저장된다
    expect(JSON.parse(localStorage.getItem(KEY)!).srs.cat.box).toBe(2);
  });

  it('예전 저장 데이터는 seen/known/missed 로 상자를 만든다', () => {
    localStorage.setItem(KEY, JSON.stringify({
      date: todayKey(), seen: { cat: 2, dog: 1, sun: 1 }, known: { cat: 1 }, missed: { dog: todayKey() },
    }));
    const { result } = renderHook(() => useWordProgress());
    const { srs } = result.current.progress;
    expect(srs.cat.box).toBe(2);
    expect(srs.dog.box).toBe(0);
    expect(srs.sun.box).toBe(1);
  });

  it('날이 바뀌면 복습 단어·어제 기록을 정하고 상자는 그대로 둔다', () => {
    const yesterday = addDays(todayKey(), -1);
    // sun 은 1단계(s) 단어 — 2단계를 배우는 중이면 복습 후보가 된다
    localStorage.setItem(KEY, JSON.stringify({
      date: yesterday, totalLearned: 18, dayStartLearned: 10,
      seen: { sun: 1 }, known: {}, missed: { sun: yesterday },
      srs: { sun: { box: 0, nextDue: yesterday, correct: 0, wrong: 1 } },
      unit: 1, unitDays: 0,
    }));
    const { result } = renderHook(() => useWordProgress());
    const p = result.current.progress;
    expect(p.date).toBe(todayKey());
    expect(p.srs.sun.box).toBe(0);
    expect(p.yesterdayMissed).toEqual(['sun']);
    expect(p.yesterdayLearned).toBe(8);
    expect(p.dayStartLearned).toBe(18);
    expect(p.todayCorrect).toEqual([]);
    expect(p.todayReview).toEqual(['sun']);
  });
});
