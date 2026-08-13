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
  { id: 'c_phone',   name: '딴짓',   color: '#f39c12', emoji: '📱', order: 7, weeklyGoalMinutes: null, goalKind: '이하', builtin: true, createdAt: 0, updatedAt: 0 },
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
