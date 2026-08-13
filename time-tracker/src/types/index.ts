// ============================== 공통 ==============================

/** 'YYYY-MM-DD' (지역시각 기준) */
export type DateKey = string;

/**
 * 모든 레코드의 공통 필드.
 * couple-budget · asset-tracker와 같은 모양을 쓴다.
 *
 * - deleted 툼스톤 → 실수로 지운 기록을 설정에서 되살릴 수 있다
 * - updatedAt      → 백업 파일을 다시 불러올 때 mergeById로 안전하게 합쳐진다
 */
export interface Syncable {
  id: string;
  updatedAt: number;   // Date.now(). 합칠 때 큰 쪽이 이긴다 (last-write-wins)
  deleted?: boolean;
}

// ============================== 분류 ==============================

/**
 * 목표를 어느 쪽으로 두고 있나.
 *
 * 운동은 '주 3시간 이상' 이 목표지만 딴짓은 '주 5시간 이하' 가 목표다.
 * 같은 숫자라도 넘겼을 때 칭찬할 일인지 경고할 일인지가 정반대다.
 */
export type GoalKind = '이상' | '이하';

export interface Category extends Syncable {
  /** '일', '육아', '콘텐츠' */
  name: string;
  color: string;
  emoji: string;
  order: number;
  /** 기본 분류는 지워도 목록에서 감추기만 한다 (되살리기 쉽게) */
  builtin: boolean;
  /** 주간 목표 시간(분). null이면 목표를 안 잡은 분류 */
  weeklyGoalMinutes: number | null;
  goalKind: GoalKind;
  createdAt: number;

  // ── 끊고 싶은 것을 위한 3단계 대본 ──────────────
  //
  // 중독은 의지의 문제가 아니라 설계의 문제라서, 충동이 온 순간에 생각해내려 하면 진다.
  // 미리 적어두고 그 순간에 그대로 꺼내 읽는 게 전부다.
  //
  // 아래 다섯 필드는 나중에 붙었다. 예전에 저장된 기록에는 아예 없으므로
  // 반드시 `?? ''`, `?? false` 로 읽어야 한다.

  /** 시작하기 전에 한 번 붙잡을까 — 줄이고 싶은 분류에만 켠다 */
  guard?: boolean;
  /** 멀리하기 — 물리적으로 손이 안 닿게 만드는 방법 (줄바꿈으로 여러 줄) */
  away?: string;
  /** 대체하기 — 대신 할 것 */
  swap?: string;
  /** 싫어하기 — 매력을 떨어뜨리는 방법 */
  dislike?: string;
  /** '대신 이걸 할래' 한 번에 시작할 분류. null이면 안 정함 */
  swapCategoryId?: string | null;
}

/** 마지막 보루 — 분류가 하나도 없어도 기록이 갈 곳은 있어야 한다 */
export const ETC_CATEGORY_ID = 'c_etc';

// updatedAt 0 = '아직 아무도 손대지 않은 기본값'.
// 사용자가 실제로 고치면 Date.now()가 들어가 항상 그쪽이 이긴다.
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'c_work',    name: '일',     color: '#3498db', emoji: '💼', order: 0, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'c_kids',    name: '육아',   color: '#e8748f', emoji: '👶', order: 1, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'c_content', name: '콘텐츠', color: '#e67e22', emoji: '🎬', order: 2, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'c_house',   name: '집안일', color: '#16a085', emoji: '🏠', order: 3, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'c_study',   name: '공부',   color: '#9b59b6', emoji: '📚', order: 4, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'c_health',  name: '운동',   color: '#27ae60', emoji: '🏃', order: 5, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'c_rest',    name: '쉼',     color: '#5dade2', emoji: '🛋', order: 6, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'c_phone',   name: '딴짓',   color: '#f39c12', emoji: '📱', order: 7, weeklyGoalMinutes: null, goalKind: '이하', builtin: true, createdAt: 0, updatedAt: 0, guard: true },
  { id: 'c_sleep',   name: '잠',     color: '#34495e', emoji: '😴', order: 8, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
  { id: ETC_CATEGORY_ID, name: '기타', color: '#95a5a6', emoji: '📌', order: 9, weeklyGoalMinutes: null, goalKind: '이상', builtin: true, createdAt: 0, updatedAt: 0 },
];

export const CATEGORY_COLORS = [
  '#3498db', '#16a085', '#e67e22', '#27ae60', '#9b59b6',
  '#e8748f', '#f39c12', '#34495e', '#5dade2', '#95a5a6',
];

export const CATEGORY_EMOJIS = [
  '💼', '👶', '🎬', '🏠', '📚', '🏃', '🛋', '📱', '😴', '📌',
  '🚙', '🍽', '☕️', '🎮', '🛒', '💬', '✍️', '🧘', '🐶', '🎵',
];

/** 지워진 분류의 기록을 그릴 때 쓰는 자리표시자 */
export const UNKNOWN_CATEGORY = {
  name: '지운 분류',
  color: '#b0bec5',
  emoji: '❔',
} as const;

// ============================ 타임블록 ============================

/**
 * 하루를 나누는 시간 블록.
 *
 * 하루를 통째로 보면 오후 두 시에 한 번 무너졌을 때 '오늘은 망했다'가 된다.
 * 여섯 조각으로 끊어두면 망한 건 조각 하나뿐이고, 남은 조각이 아직 넷이다.
 * 이 앱에서 블록이 하는 일은 그게 전부다 — **회복 지점을 만들어 주는 것.**
 *
 * 블록은 겹치지 않고 하루를 빈틈없이 덮는다. 그래서 시작 시각만 갖고
 * 끝은 '다음 블록의 시작'으로 정한다 (`blockRanges`).
 * 첫 블록의 시작은 00:00으로 고정이다 — 자정을 넘나드는 블록을 만들면
 * '오늘 저녁 블록'이 이틀에 걸쳐 계산이 전부 어긋난다.
 */
export interface TimeBlock extends Syncable {
  name: string;
  emoji: string;
  /** 자정부터 몇 분째에 시작하나 (0..1439) */
  startMinutes: number;
  order: number;
  createdAt: number;
}

export const DEFAULT_BLOCKS: TimeBlock[] = [
  { id: 'b_dawn',      name: '새벽', emoji: '🌙', startMinutes: 0,        order: 0, createdAt: 0, updatedAt: 0 },
  { id: 'b_morning',   name: '아침', emoji: '🌅', startMinutes: 6 * 60,   order: 1, createdAt: 0, updatedAt: 0 },
  { id: 'b_forenoon',  name: '오전', emoji: '☀️', startMinutes: 9 * 60,   order: 2, createdAt: 0, updatedAt: 0 },
  { id: 'b_afternoon', name: '오후', emoji: '🌤', startMinutes: 12 * 60,  order: 3, createdAt: 0, updatedAt: 0 },
  { id: 'b_evening',   name: '저녁', emoji: '🌆', startMinutes: 18 * 60,  order: 4, createdAt: 0, updatedAt: 0 },
  { id: 'b_night',     name: '밤',   emoji: '🌃', startMinutes: 21 * 60,  order: 5, createdAt: 0, updatedAt: 0 },
];

/**
 * 그 날 그 블록에 하기로 한 것.
 *
 * 하루치 계획이라 (day, blockId) 한 쌍에 하나씩만 있다.
 */
export interface BlockPlan extends Syncable {
  day: DateKey;
  blockId: string;
  categoryId: string;
  /** '보고서 끝내기', '야식 권하면 다이어트 중이라고 말하기' */
  memo: string;
  createdAt: number;
}

/**
 * 충동을 참은 순간.
 *
 * 참은 건 아무 기록도 안 남는다는 게 문제다 — 한 일만 쌓이고 안 한 일은 안 쌓이니
 * '오늘 잘 참았다'는 감각이 어디에도 안 남는다. 그래서 한 줄로 남긴다.
 */
export interface Resist extends Syncable {
  categoryId: string;
  at: number;
  createdAt: number;
}

/** 블록 하나의 상태 */
export type BlockState =
  /** 아직 안 온 블록 */
  | 'upcoming'
  /** 지금 이 블록 안에 있다 */
  | 'now'
  /** 계획한 걸 그 블록의 절반 이상 했다 */
  | 'kept'
  /** 계획은 세웠는데 못 지켰다 */
  | 'missed'
  /** 계획을 안 세운 채 지나갔다 */
  | 'unplanned';

/** 계획을 '지켰다'고 볼 최소 비율 — 블록의 절반 */
export const KEEP_RATIO = 0.5;

export interface BlockReport {
  blockId: string;
  name: string;
  emoji: string;
  startMinutes: number;
  endMinutes: number;
  /** 블록 길이(분) */
  minutes: number;
  /** 그 중 지금까지 지나간 시간(분) */
  elapsedMinutes: number;

  /** 이 블록에 적어둔 시간 합계 */
  totalMinutes: number;
  /** 분류별 (많이 쓴 순) */
  byCategory: { categoryId: string; minutes: number }[];
  /** 이 블록에서 가장 오래 한 분류 */
  topCategoryId: string | null;

  plannedCategoryId: string | null;
  planMemo: string;
  /** 계획한 분류로 쓴 시간 */
  plannedMinutes: number;
  /** plannedMinutes ÷ 지나간 블록 시간 (0..1) */
  keepRatio: number;

  state: BlockState;
}

/** 기간 전체를 블록별로 접은 것 — '어느 시간대에 무너지나' */
export interface BlockRollup {
  blockId: string;
  name: string;
  emoji: string;
  /** 계획을 세운 날 수 */
  plannedDays: number;
  /** 그 중 지킨 날 수 */
  keptDays: number;
  /** 계획한 날 중 지킨 비율. 계획이 없으면 null */
  keepRate: number | null;
  /** 이 시간대에 적어둔 시간 합계 */
  totalMinutes: number;
  /** 이 시간대에 '줄이려는 분류'로 쓴 시간 — 무너진 자리 */
  guardMinutes: number;
  topCategoryId: string | null;
}

// ============================== 기록 ==============================

/**
 * 시간 한 토막.
 *
 * ★ 이 앱의 유일한 핵심 규칙:
 *   `endedAt === null` 이면 **지금 돌아가고 있는 기록**이다.
 *
 * 타이머와 손으로 적은 기록을 굳이 나누지 않는다.
 * 타이머는 endedAt이 아직 안 채워진 Entry일 뿐이라,
 * 새로고침하든 폰을 껐다 켜든 localStorage에서 그대로 되살아난다.
 */
export interface Entry extends Syncable {
  categoryId: string;
  /** 시작 시각 (epoch ms) */
  startedAt: number;
  /** 끝난 시각 (epoch ms). null이면 진행 중 */
  endedAt: number | null;
  /** '보고서 정리', '둘째 목욕' — 비워도 된다 */
  memo: string;
  createdAt: number;
}

// ========================= 계산 결과 타입 =========================

/** 하루 안에 들어오도록 자정에서 잘라낸 조각 */
export interface Segment {
  entryId: string;
  categoryId: string;
  day: DateKey;
  /** 이 조각의 시작·끝 (epoch ms). 항상 같은 날 안에 있다 */
  start: number;
  end: number;
  minutes: number;
  /** 자정을 넘겨 잘린 조각인가 — 화면에 '이어짐'으로 표시한다 */
  clippedStart: boolean;
  clippedEnd: boolean;
  running: boolean;
}

/** 아직 아무것도 안 적힌 구간 — '어디로 샜나'의 정체 */
export interface Gap {
  day: DateKey;
  start: number;
  end: number;
  minutes: number;
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  color: string;
  emoji: string;
  minutes: number;
  /** minutes / 기록된 전체 시간 (0..1) */
  ratio: number;
  count: number;
  /** 주간 목표 대비 (기간이 1주가 아니면 그에 맞춰 늘린 값) */
  goal: GoalCheck | null;
}

export interface GoalCheck {
  kind: GoalKind;
  /** 이 기간에 맞춰 환산한 목표 시간(분) */
  targetMinutes: number;
  /** minutes / targetMinutes (0..) */
  rate: number;
  /** 목표를 지키고 있나 — '이상'은 채웠나, '이하'는 안 넘겼나 */
  ok: boolean;
}

export interface DaySlice {
  day: DateKey;
  minutes: number;
  /** categoryId → 분 */
  byCategory: Record<string, number>;
}

export interface PeriodSummary {
  from: DateKey;
  /** 마지막 날 (포함) */
  to: DateKey;
  days: number;

  /** 기록된 시간 합계(분) */
  totalMinutes: number;
  /** 이 기간에 실제로 흘러간 시간(분). 오늘이 끼면 '지금까지'만 센다 */
  elapsedMinutes: number;
  /** 흘러갔는데 아무것도 안 적힌 시간(분) */
  untrackedMinutes: number;
  /** 하루 평균 기록 시간(분) — 아직 안 온 날은 빼고 나눈다 */
  dailyAverageMinutes: number;

  byCategory: CategorySlice[];
  byDay: DaySlice[];
  /** 가장 많이 기록된 날 */
  busiestDay: DaySlice | null;
}

// ============================== 뷰 ==============================

export type View = 'today' | 'stats' | 'categories' | 'settings';

/** 통계 화면의 기간 단위 */
export type Span = 'week' | 'month';
