// ============================== 공통 ==============================

/** 'YYYY-MM-DD' */
export type DateKey = string;

/**
 * 모든 레코드의 공통 필드.
 *
 * 이 앱은 지금 한 기기에서만 쓰지만 구조는 couple-budget과 맞춰둔다.
 * - deleted 툼스톤 → 실수로 지운 항목을 설정에서 되살릴 수 있다
 * - updatedAt   → 백업 파일을 다시 불러올 때 mergeById로 안전하게 합쳐진다
 * 나중에 PC에서도 쓰고 싶어지면 sync 계층만 얹으면 된다.
 */
export interface Syncable {
  id: string;
  updatedAt: number;   // Date.now(). 합칠 때 큰 쪽이 이긴다 (last-write-wins)
  deleted?: boolean;
}

// ============================ 자산 분류 ============================

/**
 * 자산을 묶는 분류. 기본 5종을 주되 사용자가 추가·수정·삭제할 수 있다.
 *
 * couple-budget의 ExpenseCategory는 고정된 문자열 유니온이었지만,
 * 여기서는 "나중에 항목을 추가하거나 삭제"할 수 있어야 하므로 레코드로 만든다.
 */
export interface AssetKind extends Syncable {
  name: string;
  color: string;
  emoji: string;
  order: number;
  /** 기본 분류는 삭제해도 목록에서 감추기만 한다 (되살리기 쉽게) */
  builtin: boolean;
  createdAt: number;
}

/** 마지막 보루 — 분류가 하나도 없어도 자산이 갈 곳은 있어야 한다 */
export const ETC_KIND_ID = 'k_etc';

// updatedAt 0 = '아직 아무도 손대지 않은 기본값'.
// 사용자가 실제로 고치면 Date.now()가 들어가 항상 그쪽이 이긴다.
export const DEFAULT_KINDS: AssetKind[] = [
  { id: 'k_jeonse',  name: '전세보증금',  color: '#3498db', emoji: '🏠', order: 0, builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'k_deposit', name: '예적금·청약', color: '#16a085', emoji: '🏦', order: 1, builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'k_invest',  name: '투자',        color: '#e67e22', emoji: '📈', order: 2, builtin: true, createdAt: 0, updatedAt: 0 },
  { id: 'k_cash',    name: '현금',        color: '#27ae60', emoji: '💵', order: 3, builtin: true, createdAt: 0, updatedAt: 0 },
  { id: ETC_KIND_ID, name: '기타',        color: '#95a5a6', emoji: '📌', order: 4, builtin: true, createdAt: 0, updatedAt: 0 },
];

export const KIND_COLORS = [
  '#3498db', '#16a085', '#e67e22', '#27ae60', '#9b59b6',
  '#e8748f', '#f39c12', '#34495e', '#95a5a6',
];

export const KIND_EMOJIS = [
  '🏠', '🏦', '📈', '💵', '📌', '🪙', '🚗', '💎', '🎁', '📦',
];

// ============================== 자산 ==============================

/**
 * 얼마나 빨리 꺼내 쓸 수 있는 돈인가.
 *
 * 전세보증금 9,900만원과 통장 300만원을 똑같이 '자산'으로만 세면
 * "지금 당장 쓸 수 있는 돈이 얼마인가"에 답할 수 없다.
 */
export type Liquidity = '즉시' | '며칠' | '묶임';

export const LIQUIDITY_LEVELS: Liquidity[] = ['즉시', '며칠', '묶임'];

export const LIQUIDITY_META: Record<Liquidity, {
  label: string; emoji: string; color: string; hint: string;
}> = {
  즉시: {
    label: '지금 바로', emoji: '💵', color: '#27ae60',
    hint: '통장 잔고, 파킹통장, 현금',
  },
  며칠: {
    label: '며칠이면', emoji: '⏳', color: '#f39c12',
    hint: '주식·펀드(팔면 2~3일), 중도해지 가능한 예적금',
  },
  묶임: {
    label: '묶여 있음', emoji: '🔒', color: '#7b8794',
    hint: '전세보증금, 부동산, 청약, 퇴직연금',
  },
};

/**
 * 분류별 기본 유동성.
 * 새 자산을 만들 때와, liquidity를 안 적은 예전 기록을 읽을 때 쓴다.
 */
export const DEFAULT_LIQUIDITY: Record<string, Liquidity> = {
  k_cash: '즉시',
  k_deposit: '며칠',
  k_invest: '며칠',
  k_jeonse: '묶임',
  [ETC_KIND_ID]: '묶임',
};

/**
 * 모르는(사용자가 만든) 분류의 기본값.
 * 묶임으로 떨어뜨린다 — 가용자금을 부풀리는 쪽으로 틀리면 안 된다.
 */
export const FALLBACK_LIQUIDITY: Liquidity = '묶임';

export interface Asset extends Syncable {
  kindId: string;
  /** '수지 아파트 전세', '주택청약', '삼성전자' */
  name: string;
  /** 현재 평가액 (원) */
  value: number;
  /**
   * 원금 · 매수가. null이면 수익률을 계산하지 않는다.
   * 전세보증금처럼 원금 = 평가액인 자산은 굳이 넣지 않아도 된다.
   */
  principal: number | null;
  /** 만기일 · 계약 만료일. null이면 만기 개념이 없는 자산 */
  maturity: DateKey | null;
  /**
   * 얼마나 빨리 꺼내 쓸 수 있나.
   * null이면 분류 기본값(DEFAULT_LIQUIDITY)을 쓴다.
   * 예전 기록에는 이 필드가 아예 없으므로 `??` 로 자연스럽게 걸러진다.
   */
  liquidity: Liquidity | null;
  memo: string;
  order: number;
  createdAt: number;
}

// ============================== 부채 ==============================

export type RepayMethod = '원리금균등' | '원금균등' | '만기일시';

export const REPAY_METHODS: RepayMethod[] = ['원리금균등', '원금균등', '만기일시'];

/** 상환 방식별 한 줄 설명 — 입력 화면에서 고를 때 헷갈리지 않게 */
export const REPAY_METHOD_HINT: Record<RepayMethod, string> = {
  원리금균등: '매달 같은 금액을 낸다 (주택담보대출에 가장 흔함)',
  원금균등: '원금은 똑같이 갚고 이자는 갈수록 줄어든다',
  만기일시: '매달 이자만 내고 만기에 원금을 한 번에 갚는다 (전세자금대출)',
};

export interface Loan extends Syncable {
  /** '전세자금대출', '주택담보대출', '마이너스통장' */
  name: string;
  /** 최초 대출 실행 금액 */
  principal: number;
  /** 연이율 %. 3.5 = 연 3.5% */
  rate: number;
  method: RepayMethod;
  startDate: DateKey;
  /** 총 상환 기간(개월). 거치기간을 포함한 전체 기간 */
  termMonths: number;
  /** 거치기간(개월) — 이 기간에는 이자만 낸다. 전세자금대출에 흔하다 */
  graceMonths: number;
  /** 이 대출로 마련한 자산 (전세보증금 등). null이면 연결 없음 */
  linkedAssetId: string | null;

  /**
   * 중도상환·재약정 등으로 계산값과 실제가 달라졌을 때 직접 적는 값.
   *
   * 중도상환을 하면 원금·금리·기간으로 하는 계산이 더는 맞지 않는다.
   * 그렇다고 최초 원금을 낮추면 거기서 또 갚은 만큼 빠져서 오히려 더 틀어진다.
   * 그래서 계산을 버리지 않고 그 위에 덮어쓰는 방식을 쓴다.
   *
   * null이면 지금까지처럼 계산한다. 예전에 저장한 기록에는 이 필드가 아예 없으므로
   * 반드시 `!= null` 로 검사해서 undefined 도 같이 걸러야 한다.
   */
  manualRemaining: number | null;   // 남은 원금 (은행 앱에 찍힌 값)
  manualPayment: number | null;     // 월 상환액. null이면 남은 원금으로 계산한다
  manualAsOf: DateKey | null;       // 언제 기준으로 적었나 — 낡은 값인지 보이게

  memo: string;
  order: number;
  createdAt: number;
}

// ============================= 고정비 =============================

export interface Recurring extends Syncable {
  /** '보험료', '통신비', '관리비', '구독료' */
  name: string;
  amount: number;
  /** 결제일 1..31 */
  payDay: number;
  memo: string;
  order: number;
  createdAt: number;
}

// ========================= 계산 결과 타입 =========================

/** summary.ts 산출물 — 분류별 자산 집계 */
export interface KindSlice {
  kindId: string;
  name: string;
  color: string;
  emoji: string;
  amount: number;
  ratio: number;    // amount / 총자산 (0..1)
  count: number;
}

export type UpcomingKind = '자산만기' | '대출만기';

/** 다가오는 만기 하나 */
export interface Upcoming {
  id: string;
  label: string;
  date: DateKey;
  /** 남은 일수. 오늘이면 0 */
  dday: number;
  kind: UpcomingKind;
  amount: number;
  color: string;
}

/** 자산 하나에 걸린 대출과, 그걸 뺀 실제 내 몫 */
export interface AssetEquity {
  /** 이 자산에 연결된 대출의 남은 원금 합계 */
  debt: number;
  /** ★ 내 몫 = 평가액 − debt (음수면 0) */
  equity: number;
}

/** 유동성 단계별 집계 (내 몫 기준) */
export interface LiquiditySlice {
  level: Liquidity;
  amount: number;
  ratio: number;    // amount / 내 몫 총합 (0..1)
  count: number;
}

export interface Summary {
  totalAsset: number;
  totalDebt: number;
  /** ★ 순자산 = 총자산 − 총부채 */
  netWorth: number;

  /**
   * 자산별 걸린 대출과 내 몫. Loan.linkedAssetId 로 연결된 대출만 센다.
   * 전세보증금 9,900만원에 대출 6,600만원이 걸려 있으면 내 몫은 3,300만원.
   */
  equityByAsset: Record<string, AssetEquity>;

  byLiquidity: LiquiditySlice[];
  /** ★ 지금 쓸 수 있는 돈 = '즉시' 자산의 내 몫 합계 */
  availableNow: number;

  byKind: KindSlice[];

  /** 대출 월 상환액 합계 (이번 달 기준) */
  monthlyLoanPayment: number;
  /** 고정비 합계 */
  monthlyFixed: number;
  /** 매달 나가는 돈 = 위 둘의 합 */
  monthlyOutflow: number;

  /** 원금을 적어둔 자산에 한해서만 집계한다 (안 적은 자산이 수익률을 왜곡하지 않게) */
  totalPrincipal: number;
  totalValueOfPriced: number;
  totalProfit: number;
  profitRatio: number;   // totalProfit / totalPrincipal. 원금이 0이면 0

  /** 만기가 가까운 순. 이미 지난 건 제외 */
  upcoming: Upcoming[];
}

// ============================== 뷰 ==============================

export type View = 'home' | 'assets' | 'outflow' | 'settings';
