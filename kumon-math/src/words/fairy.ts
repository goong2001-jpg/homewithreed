import { SrsMap, MAX_BOX } from './srs';
import { StreakState, STREAK_MILESTONES, isActiveToday } from './streak';

/**
 * 요정의 "기억".
 *
 * 요정이 아이의 기록을 보고 한마디 한다 — 어제 틀렸던 단어를 오늘 맞혔다든지,
 * 며칠 연속으로 공부했다든지. 같은 상황이면 늘 같은 말을 해서(무작위 없음)
 * 테스트할 수 있고, 말할 거리가 없으면 null 을 돌려줘 평소 말풍선을 쓴다.
 */
export interface FairyContext {
  /** 오늘 날짜 키 */
  today: string;
  /** 지금 카드에 나온 단어 (없을 수도 있다) */
  word?: string;
  /** 오늘 배우는 단어들 */
  todayWords: string[];
  srs: SrsMap;
  /** 어제 틀린 단어 */
  yesterdayMissed: string[];
  /** 전에 틀려서 오늘 다시 보는 단어 */
  todayMissed: string[];
  /** 오늘 한 번에 맞힌 단어 */
  todayCorrect: string[];
  streak: StreakState;
  /** 오늘 처음 열었고 아직 첫 단어를 보는 중인지 */
  firstVisit: boolean;
  /** 어제 본 단어 카드 수 */
  yesterdayLearned: number;
  /** 오늘 미션 3개를 다 했는지 */
  missionsDone: boolean;
}

const EMPTY: FairyContext = {
  today: '', todayWords: [], srs: {}, yesterdayMissed: [], todayMissed: [], todayCorrect: [],
  streak: { current: 0, best: 0, lastActiveDate: '', freezes: 0, lastFreezeGrant: '' },
  firstVisit: false, yesterdayLearned: 0, missionsDone: false,
};

/** 영어 단어 뒤에 붙는 은/는 — 영어는 받침을 따지기 어려워 '는'으로 통일 */
const topic = (w: string) => `${w}는`;

export function fairyLine(partial: Partial<FairyContext>): string | null {
  const ctx: FairyContext = { ...EMPTY, ...partial };
  const correct = new Set(ctx.todayCorrect);

  // 1. 오늘 할 일을 다 했다
  if (ctx.missionsDone) return '오늘 미션 다 했어! 최고야 🏆';

  // 2. 어제 틀린 단어를 오늘 맞혔다
  const fromYesterday = ctx.yesterdayMissed.find(w => correct.has(w));
  if (fromYesterday) return `어제 틀린 ${fromYesterday}, 오늘은 맞췄네! 👏`;

  // 3. 지난번에 틀린 단어를 오늘 맞혔다
  const fromBefore = ctx.todayMissed.find(w => correct.has(w));
  if (fromBefore) return `지난번에 틀린 ${fromBefore}, 이번엔 맞췄어! 👏`;

  // 4. 연속 학습 기념일
  if (isActiveToday(ctx.streak, ctx.today) && STREAK_MILESTONES.includes(ctx.streak.current)) {
    return `🔥 ${ctx.streak.current}일 연속 공부! 정말 대단해!`;
  }

  // 5. 완전히 익힌 단어 — 지금 카드가 먼저, 아니면 오늘 단어 중에서
  const mastered = (w?: string) => !!w && ctx.srs[w]?.box >= MAX_BOX;
  const master = mastered(ctx.word) ? ctx.word : ctx.todayWords.find(mastered);
  if (master) return `${topic(master)} 이제 완전 네 거야! 💎`;

  // 6. 오늘 첫 인사
  if (ctx.firstVisit) {
    return ctx.yesterdayLearned > 0
      ? `어제 ${ctx.yesterdayLearned}개 배웠지? 오늘도 가보자 💪`
      : '오늘도 만나서 반가워! 같이 해보자 🧚';
  }

  return null;
}
