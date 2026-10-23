import {
  MISSIONS, freshMissions, missionsForDate, addMissionProgress, isMissionDone, allMissionsDone,
  missionsDoneCount, shouldReward, markRewarded, markCelebrated,
} from './missions';

const T = '2026-03-10';

describe('오늘 미션 3개', () => {
  it('미션은 세 개다', () => {
    expect(MISSIONS).toHaveLength(3);
    expect(MISSIONS.map(m => m.id)).toEqual(['cards', 'quiz', 'play']);
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

  it('세 개를 다 하면 완료 — 보너스는 한 번만', () => {
    let s = freshMissions(T);
    s = addMissionProgress(s, 'cards', T, 10);
    s = addMissionProgress(s, 'quiz', T, 3);
    s = addMissionProgress(s, 'play', T, 1);
    expect(allMissionsDone(s)).toBe(true);
    expect(shouldReward(s)).toBe(true);
    s = markRewarded(s);
    expect(shouldReward(s)).toBe(false);
    expect(s.celebrated).toBe(false);
    s = markCelebrated(s);
    expect(s.celebrated).toBe(true);
    // 더 해도 완료는 그대로, 보너스는 다시 안 준다
    s = addMissionProgress(s, 'cards', T, 5);
    expect(allMissionsDone(s)).toBe(true);
    expect(shouldReward(s)).toBe(false);
  });

  it('날이 바뀌면 처음부터 다시 센다', () => {
    let s = freshMissions(T);
    s = addMissionProgress(s, 'cards', T, 10);
    s = markRewarded(markCelebrated(s));
    const next = missionsForDate(s, '2026-03-11');
    expect(next.date).toBe('2026-03-11');
    expect(next.progress).toEqual({ cards: 0, quiz: 0, play: 0 });
    expect(next.rewarded).toBe(false);
    expect(next.celebrated).toBe(false);
    // 같은 날이면 그대로 (표기가 달라도)
    expect(missionsForDate(s, '2026-3-10').progress.cards).toBe(10);
    // 진행을 더할 때도 날짜를 확인한다
    expect(addMissionProgress(s, 'quiz', '2026-03-12').progress).toEqual({ cards: 0, quiz: 1, play: 0 });
  });

  it('저장 데이터가 없거나 모자라도 기본값으로 채운다', () => {
    expect(missionsForDate(undefined, T)).toEqual(freshMissions(T));
    const partial = { date: T, progress: { cards: 3 } } as any;
    expect(missionsForDate(partial, T).progress).toEqual({ cards: 3, quiz: 0, play: 0 });
  });
});
