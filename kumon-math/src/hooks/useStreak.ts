import { useCallback, useState } from 'react';
import { todayKey } from '../words/dailySet';
import { StreakState, updateStreak, isActiveToday } from '../words/streak';

const KEY = 'word_streak';

function persist(next: StreakState) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
}

function load(): StreakState {
  let saved: StreakState | undefined;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {}
  // 앱을 열 때 끊겼는지·새 주 프리즈를 먼저 정리해 둔다
  const next = updateStreak(saved, todayKey(), false);
  persist(next);
  return next;
}

/** 연속 학습 스트릭 — localStorage 에 두어 단어 화면과 놀이터가 같이 본다 */
export function useStreak() {
  const [streak, setStreak] = useState<StreakState>(load);

  /** 오늘 공부했다 (미션 진행·퀴즈 답) — 하루에 한 번만 스트릭이 오른다 */
  const markActive = useCallback(() => {
    setStreak(prev => {
      const next = updateStreak(prev, todayKey(), true);
      persist(next);
      return next;
    });
  }, []);

  return { streak, markActive, activeToday: isActiveToday(streak, todayKey()) };
}
