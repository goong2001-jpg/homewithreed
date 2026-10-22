import { sameDay } from './dates';

/**
 * 오늘 미션 3개.
 *
 * 하루에 할 일을 세 가지로 딱 정해 두면 아이가 "오늘은 끝"을 알 수 있다.
 * 세 개를 다 하면 축하 화면이 한 번 뜨고, 별 보너스를 준다.
 * 날이 바뀌면 처음부터 다시 센다.
 */
export type MissionId = 'cards' | 'quiz' | 'play';

export interface MissionDef {
  id: MissionId;
  emoji: string;
  label: string;
  /** 몇 번 해야 끝나는지 */
  goal: number;
}

export const MISSIONS: MissionDef[] = [
  { id: 'cards', emoji: '📖', label: '단어 카드 10개 보기', goal: 10 },
  { id: 'quiz',  emoji: '✅', label: '퀴즈 3개 맞히기',     goal: 3 },
  { id: 'play',  emoji: '🎮', label: '놀이터 게임 1판',     goal: 1 },
];

/** 세 개를 다 하면 주는 별 */
export const MISSION_BONUS = 10;

export interface MissionState {
  /** 어느 날의 기록인지 */
  date: string;
  progress: Record<MissionId, number>;
  /** 보너스 별을 받았는지 (하루 한 번) */
  rewarded: boolean;
  /** 축하 화면을 닫았는지 (하루 한 번만 보여준다) */
  celebrated: boolean;
}

export function freshMissions(today: string): MissionState {
  return { date: today, progress: { cards: 0, quiz: 0, play: 0 }, rewarded: false, celebrated: false };
}

/** 날이 바뀌었으면 새로 시작, 아니면 그대로 */
export function missionsForDate(state: MissionState | undefined, today: string): MissionState {
  if (!state || !sameDay(state.date, today)) return freshMissions(today);
  return { ...freshMissions(today), ...state, progress: { ...freshMissions(today).progress, ...state.progress } };
}

export function missionGoal(id: MissionId): number {
  return MISSIONS.find(m => m.id === id)?.goal ?? 1;
}

export function isMissionDone(state: MissionState, id: MissionId): boolean {
  return (state.progress[id] ?? 0) >= missionGoal(id);
}

export function allMissionsDone(state: MissionState): boolean {
  return MISSIONS.every(m => isMissionDone(state, m.id));
}

/** 끝낸 미션 수 */
export function missionsDoneCount(state: MissionState): number {
  return MISSIONS.filter(m => isMissionDone(state, m.id)).length;
}

/** 미션 하나를 n 만큼 진행한다 (날이 바뀌었으면 먼저 새로 시작한다) */
export function addMissionProgress(state: MissionState | undefined, id: MissionId, today: string, n = 1): MissionState {
  const cur = missionsForDate(state, today);
  return { ...cur, progress: { ...cur.progress, [id]: (cur.progress[id] ?? 0) + n } };
}

/** 보너스를 줘야 하는지 — 세 개를 다 했고 아직 안 받았을 때 한 번만 true */
export function shouldReward(state: MissionState): boolean {
  return allMissionsDone(state) && !state.rewarded;
}

export function markRewarded(state: MissionState): MissionState {
  return { ...state, rewarded: true };
}

export function markCelebrated(state: MissionState): MissionState {
  return { ...state, celebrated: true };
}
