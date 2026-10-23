import { daysBetween, weekIndex } from './dates';

/**
 * 연속 학습 스트릭.
 *
 * 하루에 미션 진행이나 퀴즈 답이 하나라도 있으면 그날은 "한 날"이다.
 * 하루를 건너뛰어도 🧊 프리즈가 있으면 자동으로 써서 스트릭을 지킨다.
 * 프리즈는 한 주(월요일 시작)에 하나씩 받고, 최대 두 개까지 모을 수 있다.
 * 이틀 넘게 쉬면 스트릭은 0으로 돌아간다.
 */
export interface StreakState {
  /** 지금 며칠 연속인지 */
  current: number;
  /** 가장 길었던 기록 */
  best: number;
  /** 마지막으로 공부한 날 */
  lastActiveDate: string;
  /** 가진 프리즈 수 */
  freezes: number;
  /** 프리즈를 마지막으로 받은 날 */
  lastFreezeGrant: string;
}

export const MAX_FREEZES = 2;

export const EMPTY_STREAK: StreakState = {
  current: 0, best: 0, lastActiveDate: '', freezes: 0, lastFreezeGrant: '',
};

/** 새 주가 됐으면 프리즈를 하나 준다 (최대 MAX_FREEZES) */
function grantWeekly(s: StreakState, today: string): StreakState {
  const granted = s.lastFreezeGrant && weekIndex(s.lastFreezeGrant) === weekIndex(today);
  if (granted) return s;
  return { ...s, freezes: Math.min(s.freezes + 1, MAX_FREEZES), lastFreezeGrant: today };
}

function bump(s: StreakState, today: string): StreakState {
  const current = s.current + 1;
  return { ...s, current, best: Math.max(s.best, current), lastActiveDate: today };
}

function restart(s: StreakState, today: string): StreakState {
  return { ...s, current: 1, best: Math.max(s.best, 1), lastActiveDate: today };
}

/**
 * 오늘 상태를 계산한다.
 *   activeToday = true  : 오늘 공부를 했다 (처음 할 때만 스트릭이 오른다)
 *   activeToday = false : 앱을 열기만 했다 — 끊겼는지만 확인한다
 */
export function updateStreak(state: StreakState | undefined, today: string, activeToday: boolean): StreakState {
  const s = grantWeekly({ ...EMPTY_STREAK, ...state }, today);

  if (!s.lastActiveDate) return activeToday ? restart(s, today) : s;

  const gap = daysBetween(s.lastActiveDate, today);
  if (!(gap > 0)) return s;                               // 같은 날(또는 시계가 뒤로 감) — 이미 셌다
  if (gap === 1) return activeToday ? bump(s, today) : s; // 어제 했다 — 오늘 하면 이어진다

  if (gap === 2) {
    // 하루 건너뜀 — 프리즈가 있으면 오늘 공부할 때 하나 써서 이어 간다
    if (s.freezes > 0) return activeToday ? bump({ ...s, freezes: s.freezes - 1 }, today) : s;
    return activeToday ? restart(s, today) : { ...s, current: 0 };
  }

  // 이틀 넘게 쉬었다 — 처음부터
  return activeToday ? restart(s, today) : { ...s, current: 0 };
}

/** 오늘 이미 공부했는지 */
export function isActiveToday(s: StreakState, today: string): boolean {
  return !!s.lastActiveDate && daysBetween(s.lastActiveDate, today) === 0;
}

/** 요정이 축하해 주는 날수 */
export const STREAK_MILESTONES = [3, 5, 7, 10, 14, 21, 30, 50, 100];
