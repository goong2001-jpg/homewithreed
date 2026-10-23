// ============================== 공통 ==============================

/** 'YYYY-MM' — 문자열 사전순 비교가 곧 시간순 비교라서 편하다 */
export type MonthKey = string;
/** 'YYYY-MM-DD' */
export type DateKey = string;

/**
 * 동기화되는 모든 레코드의 공통 필드.
 * deleted를 쓰는 이유: 클라우드 구독이 '이번 달'만 받아오기 때문에
 * "이 스냅샷에 없다"는 사실이 삭제인지 다른 달인지 구분되지 않는다.
 * 삭제도 하나의 '수정'으로 흘려보내야 로컬 사본과 안전하게 합쳐진다.
 */
export interface Syncable {
  id: string;
  updatedAt: number;   // Date.now(). 병합할 때 큰 쪽이 이긴다 (last-write-wins)
  deleted?: boolean;
}

// ============================== 사람 ==============================

/**
 * 가계부를 같이 쓰는 사람(부부 + 자녀 등).
 *
 * 다른 기록들과 같은 Syncable 이다 — 한쪽 폰에서 자녀를 추가하면
 * 상대 폰에도 넘어가야 그 아이 이름으로 쓴 지출의 주인이 표시된다.
 */
export interface Person extends Syncable {
  id: string;      // 'p1' | 'p2' — 이름을 바꿔도 절대 바뀌지 않는다 (과거 내역 보존)
  name: string;    // '나' | '와이프' | '하율'
  color: string;
  order: number;
  createdAt: number;
}

// updatedAt 0 = '아직 아무도 손대지 않은 기본값'.
// 양쪽 폰이 각자 기본값을 갖고 시작해도, 실제로 고친 쪽이 항상 이긴다.
export const DEFAULT_PERSONS: Person[] = [
  { id: 'p1', name: '나', color: '#3498db', order: 0, createdAt: 0, updatedAt: 0 },
  { id: 'p2', name: '와이프', color: '#e8748f', order: 1, createdAt: 0, updatedAt: 0 },
];

export const PERSON_COLORS = [
  '#3498db', '#e8748f', '#27ae60', '#f39c12', '#9b59b6', '#16a085',
];

// ======================= 수입 (월별 · 사람별) =======================

export interface IncomeEntry extends Syncable {
  month: MonthKey;
  personId: string;
  amount: number;    // 그 달에 들어온 돈 한 건 (세후 실수령)
  memo: string;      // '급여', '부업 일당', '상여' 등
  createdAt: number;
}

/**
 * 수입 메모 빠른 선택.
 * 부업 일당처럼 여러 번 들어오는 돈을 매번 손으로 적지 않게 한다.
 */
export const INCOME_MEMO_PRESETS = ['급여', '부업', '상여', '용돈', '기타'];

// ============ 고정지출 (매달 반복 · 하루수입에서 먼저 차감) ============

export interface FixedExpense extends Syncable {
  name: string;
  amount: number;
  startMonth: MonthKey;        // 이 달부터 매달 계상
  endMonth: MonthKey | null;   // null = 계속. 해지하면 마지막 달을 넣는다
  personId: string | null;     // 부담자 (null = 공동)
  createdAt: number;
}

// ============ 변동지출 (하루하루 쓰는 돈 · 저금통을 비운다) ============

export type ExpenseCategory =
  | '식비' | '생활' | '교통' | '육아' | '의료' | '쇼핑' | '여가' | '기타';

export const CATEGORIES: ExpenseCategory[] =
  ['식비', '생활', '교통', '육아', '의료', '쇼핑', '여가', '기타'];

export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  식비: '#e67e22', 생활: '#16a085', 교통: '#3498db', 육아: '#e8748f',
  의료: '#9b59b6', 쇼핑: '#f39c12', 여가: '#27ae60', 기타: '#95a5a6',
};

export const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  식비: '🍽️', 생활: '🏠', 교통: '🚌', 육아: '🧸',
  의료: '💊', 쇼핑: '🛍️', 여가: '🎮', 기타: '📌',
};

export interface Expense extends Syncable {
  date: DateKey;
  /**
   * date.slice(0,7) 을 비정규화해서 같이 저장한다.
   * Firestore에서 where('month','==',M) 을 자동 단일 필드 색인으로 돌리기 위한 것 —
   * 복합 색인을 따로 배포할 필요가 없어진다.
   */
  month: MonthKey;
  amount: number;
  category: ExpenseCategory;
  content: string;
  personId: string;
  createdAt: number;
}

// ================= 카테고리별 월 상한 (예산) =================

/**
 * 카테고리 하나의 한 달 쓸 수 있는 상한.
 *
 * id 는 `budget-식비` 처럼 **카테고리에서 결정**된다 — 두 폰이 각자 같은 카테고리에
 * 상한을 넣어도 문서가 하나로 합쳐지고(last-write-wins), 카테고리당 한 건만 남는다.
 * 상한을 지우면 툼스톤(deleted)으로 남긴다 — 다른 레코드와 같은 이유 (Syncable 주석).
 */
export interface CategoryBudget extends Syncable {
  category: ExpenseCategory;
  monthlyLimit: number;   // 원. 0 이하는 저장하지 않는다 (= 상한 없음)
}

export const budgetIdOf = (category: ExpenseCategory): string => `budget-${category}`;

/** 상한 경고가 켜지는 비율 — 80% 부터 주황, 100% 부터 빨강 */
export const BUDGET_WARN_RATIO = 0.8;

/** 카테고리별 상한 대비 사용 현황 (budget.ts budgetStatus 산출물) */
export interface BudgetStatusRow {
  category: ExpenseCategory;
  spent: number;
  limit: number;
  ratio: number;    // spent / limit (상한을 넘으면 1 보다 크다)
}

/** 자주 쓰는 지출 후보 (budget.ts frequentExpenses 산출물) */
export interface FrequentExpense {
  category: ExpenseCategory;
  content: string;
  amount: number;
  /** 가장 최근에 이 조합으로 쓴 사람 — 원탭 입력 때 기본값으로 쓴다 */
  personId: string;
  count: number;
  lastDate: DateKey;
}

// ================= 경조사 · 용돈 (오고 간 돈, 별도 장부) =================

/**
 * 축의금·부의금·아이들 용돈처럼 **집 밖 사람과 오고 간 돈**.
 *
 * ⚠️ 일부러 저금통(하루 수입) 계산에 넣지 않는다.
 * 축의금 30만원이 하루 예산에서 빠지면 그날 저금통이 빨갛게 되는데,
 * 그건 '생활비를 헤프게 썼다'는 뜻이 아니라서 신호를 망친다.
 * 아이가 받은 용돈도 우리가 쓸 돈이 아니다.
 * 그래서 '나중에 찾아보는 장부'로 따로 둔다.
 */
export type GiftDirection = 'in' | 'out';   // 받음 / 냄

export type GiftKind = '축의금' | '부의금' | '용돈' | '돌잔치' | '선물' | '기타';

export const GIFT_KINDS: GiftKind[] =
  ['축의금', '부의금', '용돈', '돌잔치', '선물', '기타'];

export const GIFT_KIND_EMOJI: Record<GiftKind, string> = {
  축의금: '💐', 부의금: '🕯️', 용돈: '🧧', 돌잔치: '🎂', 선물: '🎁', 기타: '📌',
};

/** 종류를 고르면 방향은 대개 정해져 있다 — 기본값으로만 쓰고 바꿀 수 있다 */
export const GIFT_KIND_DEFAULT_DIRECTION: Record<GiftKind, GiftDirection> = {
  축의금: 'out', 부의금: 'out', 용돈: 'in', 돌잔치: 'out', 선물: 'in', 기타: 'out',
};

export interface GiftEntry extends Syncable {
  date: DateKey;
  /** date.slice(0,7) 비정규화 — 지출과 같은 이유 */
  month: MonthKey;
  direction: GiftDirection;
  amount: number;
  kind: GiftKind;
  /** 상대방 — '김철수 결혼', '외할머니' */
  counterparty: string;
  /** 우리집 누구 몫인지 — 용돈 받은 아이, 축의금 낸 사람 */
  personId: string;
  memo: string;
  createdAt: number;
}

/** 상대별 집계 — '김철수한테 얼마 냈더라?' 에 답하기 위한 것 */
export interface CounterpartyTotal {
  name: string;
  received: number;
  given: number;
  net: number;       // received - given
  count: number;
  lastDate: DateKey;
}

export interface GiftSummary {
  received: number;
  given: number;
  net: number;
  count: number;
}

// ============================== 설정 ==============================

/**
 * Firebase 웹 설정 (비밀값이 아니다 — 카톡으로 배우자에게 보내도 된다).
 *
 * Firestore만 쓰므로 projectId + apiKey 두 개면 충분하다.
 * authDomain(Auth 전용)과 appId(Analytics 전용)는 있으면 넘기고 없어도 그만이라 선택 필드다.
 */
export interface FirebaseWebConfig {
  projectId: string;
  apiKey: string;
  authDomain?: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface SyncSettings {
  enabled: boolean;
  roomCode: string;            // 우리집 코드 (12자 이상)
  firebaseConfigText: string;  // 붙여넣은 원문 — 파싱이 실패해도 보존해서 고칠 수 있게
}

export interface AppSettings {
  /** ⚠️ 이 값은 절대 클라우드로 올리지 않는다. 방을 지키는 코드를 그 방 안에 두면 안 된다. */
  sync: SyncSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  sync: { enabled: false, roomCode: '', firebaseConfigText: '' },
};

// ==================== 계산 결과 (budget.ts 산출물) ====================

export type MonthPhase = 'past' | 'current' | 'future';
export type BudgetLevel = 'noIncome' | '여유' | '주의' | '초과';

/** 카테고리별 지출 집계 (budget.ts categoryTotals 산출물) */
export interface CategorySpend {
  category: ExpenseCategory;
  amount: number;
  count: number;
  ratio: number;    // amount / 전체 지출 (0..1)
}

export interface PersonSpend {
  personId: string;
  name: string;
  color: string;
  income: number;
  expense: number;
  ratio: number;    // expense / 전체 변동지출 (0..1)
}

export interface MonthBudget {
  month: MonthKey;
  phase: MonthPhase;

  daysInMonth: number;      // 실제 달력 일수 (6월 30, 7월 31, 윤년 2월 29)
  elapsedDays: number;      // 경과일수
  remainingDays: number;

  totalIncome: number;      // 월 총수입
  totalFixed: number;       // 월 고정지출 합계
  spendable: number;        // 이달 쓸 수 있는 돈 = totalIncome - totalFixed (음수 가능)
  dailyBudget: number;      // ★ 하루 수입 = spendable / daysInMonth

  variableSpent: number;    // 이달 누적 변동지출
  spentToday: number;

  accrued: number;          // 지금까지 발생한 예산 = elapsedDays * dailyBudget
  freeCash: number;         // ★ 현재 여유돈 = accrued - variableSpent (음수 = 초과)
  overspend: number;        // max(0, -freeCash)
  remainingBudget: number;  // 이달 남은 예산 = spendable - variableSpent

  fillRatio: number;        // 저금통 채움 비율 0..1 = remainingBudget / spendable
  paceRatio: number;        // 오늘까지의 목표선 위치 0..1
  level: BudgetLevel;
  hasIncome: boolean;
  fixedOverIncome: boolean; // 고정지출 > 수입

  perPerson: PersonSpend[];
}

// ========================== 뷰 / 동기화 ==========================

export type View = 'home' | 'add' | 'history' | 'top' | 'gifts' | 'settings';

/** 입력 화면이 지출을 받는지 수입을 받는지 */
export type AddMode = 'expense' | 'income';

export type SyncStatus = 'off' | 'connecting' | 'live' | 'error';

export type CollName =
  | 'persons' | 'incomes' | 'fixedExpenses' | 'expenses' | 'gifts' | 'budgets';

export type RemoteBatch =
  | { coll: 'persons'; records: Person[] }
  | { coll: 'incomes'; records: IncomeEntry[] }
  | { coll: 'fixedExpenses'; records: FixedExpense[] }
  | { coll: 'expenses'; records: Expense[] }
  | { coll: 'gifts'; records: GiftEntry[] }
  | { coll: 'budgets'; records: CategoryBudget[] };
