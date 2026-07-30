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

export interface Person {
  id: string;      // 'p1' | 'p2' — 이름을 바꿔도 절대 바뀌지 않는다 (과거 내역 보존)
  name: string;    // '나' | '와이프'
  color: string;
  order: number;
}

export const DEFAULT_PERSONS: Person[] = [
  { id: 'p1', name: '나', color: '#3498db', order: 0 },
  { id: 'p2', name: '와이프', color: '#e8748f', order: 1 },
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

/** Firebase 콘솔에서 복사해 붙여넣는 웹 앱 설정 (비밀값이 아니다) */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface SyncSettings {
  enabled: boolean;
  roomCode: string;            // 우리집 코드 (12자 이상)
  firebaseConfigText: string;  // 붙여넣은 원문 — 파싱이 실패해도 보존해서 고칠 수 있게
}

export interface AppSettings {
  persons: Person[];
  /** ⚠️ 이 값은 절대 클라우드로 올리지 않는다. 방을 지키는 코드를 그 방 안에 두면 안 된다. */
  sync: SyncSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  persons: DEFAULT_PERSONS,
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

export type CollName = 'incomes' | 'fixedExpenses' | 'expenses';

export type RemoteBatch =
  | { coll: 'incomes'; records: IncomeEntry[] }
  | { coll: 'fixedExpenses'; records: FixedExpense[] }
  | { coll: 'expenses'; records: Expense[] };
