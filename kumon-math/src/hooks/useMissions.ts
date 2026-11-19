import { useCallback, useState } from 'react';
import { todayKey } from '../words/dailySet';
import {
  MissionId, MissionState, missionsForDate, addMissionProgress, missionsDoneCount,
  shouldReward, reachedGoal, markRewarded, markCelebrated,
} from '../words/missions';
import { DAILY_MINUTES, minutesOf } from '../words/log';
import { useTodayLog } from './useTodayLog';

const KEY = 'word_missions';

function load(): MissionState {
  let saved: MissionState | undefined;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {}
  return missionsForDate(saved, todayKey());
}

function persist(next: MissionState) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
}

/**
 * 오늘의 영어 30분 — 화면마다 따로 쓰지만 localStorage 를 같이 보므로
 * 놀이터·책장에서 올린 진행도 단어 화면으로 돌아오면 보인다.
 */
export function useMissions() {
  const [missions, setMissions] = useState<MissionState>(load);
  const minutes = minutesOf(useTodayLog());

  const apply = useCallback((fn: (prev: MissionState) => MissionState) => {
    setMissions(prev => {
      const next = fn(missionsForDate(prev, todayKey()));
      persist(next);
      return next;
    });
  }, []);

  /** 미션 하나를 n 만큼 진행 */
  const bump = useCallback((id: MissionId, n = 1) => {
    apply(prev => addMissionProgress(prev, id, todayKey(), n));
  }, [apply]);

  /** 보너스를 줬다고 표시 (별은 호출한 쪽에서 addPoints 로 준다) */
  const reward = useCallback(() => apply(markRewarded), [apply]);

  /** 축하 화면을 닫았다 — 오늘은 다시 안 띄운다 */
  const closeCelebration = useCallback(() => apply(markCelebrated), [apply]);

  return {
    missions, bump, reward, closeCelebration,
    minutes,
    /** 오늘 30분을 채웠는지 — "오늘 끝" */
    allDone: reachedGoal(minutes, DAILY_MINUTES),
    doneCount: missionsDoneCount(missions),
    needsReward: shouldReward(missions, minutes, DAILY_MINUTES),
  };
}
