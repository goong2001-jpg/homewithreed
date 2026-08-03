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
  amount: number;    // 그 달의 예상 수입 (세후 실수령)
  memo: string;      // '7월 급여', '상여' 등
  createdAt: number;
}

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

export type View = 'home' | 'add' | 'history' | 'settings';

export type SyncStatus = 'off' | 'connecting' | 'live' | 'error';

export type CollName = 'persons' | 'incomes' | 'fixedExpenses' | 'expenses';

export type RemoteBatch =
  | { coll: 'persons'; records: Person[] }
  | { coll: 'incomes'; records: IncomeEntry[] }
  | { coll: 'fixedExpenses'; records: FixedExpense[] }
  | { coll: 'expenses'; records: Expense[] };
