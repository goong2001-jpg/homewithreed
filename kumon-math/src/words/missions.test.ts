import {
  MISSIONS, freshMissions, missionsForDate, addMissionProgress, isMissionDone, allMissionsDone,
  missionsDoneCount, shouldReward, reachedGoal, markRewarded, markCelebrated,
} from './missions';

const T = '2026-03-10';

describe('오늘의 영어 30분', () => {
  it('추천 순서는 단어 카드 → 퀴즈 → 책 → 놀이', () => {
    expect(MISSIONS.map(m => m.id)).toEqual(['cards', 'quiz', 'book', 'play']);
  });

  it('진행을 더하면 목표에 닿을 때 끝난 것으로 본다', () => {
    let s = freshMissions(T);
    expect(isMissionDone(s, 'play')).toBe(false);
    s = addMissionProgress(s, 'play', T);
    expect(isMissionDone(s, 'play')).toBe(true);
    s = addMissionProgress(s, 'quiz', T, 2);
    expect(isMissionDone(s, 'quiz')).toBe(false);
    s = addMissionProgress(s, 'quiz', T);
    expect(isMissionDone(s, 'quiz')).toBe(true);
    expect(missionsDoneCount(s)).toBe(2);
    expect(allMissionsDone(s)).toBe(false);
  });

  it('네 가지를 다 하면 체크가 다 붙는다', () => {
    let s = freshMissions(T);
    s = addMissionProgress(s, 'cards', T, 10);
    s = addMissionProgress(s, 'quiz', T, 3);
    s = addMissionProgress(s, 'book', T, 1);
    expect(allMissionsDone(s)).toBe(false);
    s = addMissionProgress(s, 'play', T, 1);
    expect(allMissionsDone(s)).toBe(true);
  });

  it('"오늘 끝"과 보너스는 30분을 채웠을 때 — 한 번만', () => {
    let s = freshMissions(T);
    expect(reachedGoal(29, 30)).toBe(false);
    expect(shouldReward(s, 29, 30)).toBe(false);
    // 추천 순서를 다 안 해도 30분이면 끝
    expect(shouldReward(s, 30, 30)).toBe(true);
    s = markRewarded(s);
    expect(shouldReward(s, 45, 30)).toBe(false);
    expect(s.celebrated).toBe(false);
    s = markCelebrated(s);
    expect(s.celebrated).toBe(true);
  });

  it('날이 바뀌면 처음부터 다시 센다', () => {
    let s = freshMissions(T);
    s = addMissionProgress(s, 'cards', T, 10);
    s = markRewarded(markCelebrated(s));
    const next = missionsForDate(s, '2026-03-11');
    expect(next.date).toBe('2026-03-11');
    expect(next.progress).toEqual({ cards: 0, quiz: 0, book: 0, play: 0 });
    expect(next.rewarded).toBe(false);
    expect(next.celebrated).toBe(false);
    // 같은 날이면 그대로 (표기가 달라도)
    expect(missionsForDate(s, '2026-3-10').progress.cards).toBe(10);
    // 진행을 더할 때도 날짜를 확인한다
    expect(addMissionProgress(s, 'quiz', '2026-03-12').progress).toEqual({ cards: 0, quiz: 1, book: 0, play: 0 });
  });

  it('저장 데이터가 없거나 모자라도 기본값으로 채운다', () => {
    expect(missionsForDate(undefined, T)).toEqual(freshMissions(T));
    const partial = { date: T, progress: { cards: 3 } } as any;
    expect(missionsForDate(partial, T).progress).toEqual({ cards: 3, quiz: 0, book: 0, play: 0 });
  });
});
