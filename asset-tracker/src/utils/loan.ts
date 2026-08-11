import { DateKey, Loan } from '../types';
import { addMonths, monthsBetween, todayKey } from './date';

/**
 * 대출 상환 계산.
 *
 * couple-budget/src/utils/budget.ts 처럼 전부 순수 함수이고 '오늘'을 인자로 받는다.
 * 화면은 이 파일이 내놓은 숫자를 그리기만 한다.
 *
 * 용어
 *  - 거치기간(graceMonths): 원금은 그대로 두고 이자만 내는 기간. 전세자금대출에 흔하다.
 *  - 상환기간(n): termMonths − graceMonths. 실제로 원금을 나눠 갚는 개월 수.
 */

export interface LoanStatus {
  /** 이번 달에 낼 돈 */
  monthlyPayment: number;
  /** 그중 이자 */
  monthlyInterest: number;
  /** 그중 원금 */
  monthlyPrincipal: number;

  /** ★ 아직 갚지 않은 원금 */
  remainingPrincipal: number;
  /** 지금까지 갚은 원금 */
  paidPrincipal: number;

  elapsedMonths: number;
  remainingMonths: number;
  endDate: DateKey;

  /**
   * 만기까지 낼 이자 총액 (지금까지 낸 것 포함).
   * 단 isManual이면 뜻이 달라진다 — 중도상환하면 '만기까지 총 이자'가 성립하지 않으므로
   * 남은 원금 기준의 **앞으로 낼 이자 추정치**가 들어온다. 화면 라벨도 같이 바뀐다.
   */
  totalInterest: number;

  /** 원금 상환 진행률 0..1 */
  progress: number;
  /** 기간 경과율 0..1 — 만기일시처럼 원금이 안 줄어드는 대출에 쓴다 */
  timeProgress: number;

  /** 거치기간 중인가 (이자만 내는 중) */
  inGrace: boolean;
  /** 만기가 지났는가 */
  done: boolean;
  /** 남은 원금을 사용자가 직접 적었는가 (계산값이 아님) */
  isManual: boolean;
}

/** (1+i)^n. i가 0이어도 안전하다 */
function pow(i: number, n: number): number {
  return Math.pow(1 + i, n);
}

/** 원리금균등 월 상환액: A = P·i / (1 − (1+i)^−n) */
export function equalPayment(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  // 무이자면 위 공식이 0/0 이 된다. 원금을 개월 수로 나누면 그만이다.
  if (monthlyRate === 0) return principal / months;
  const f = pow(monthlyRate, months);
  return (principal * monthlyRate * f) / (f - 1);
}

/** 원리금균등에서 j회 갚은 뒤 남은 원금 */
export function equalPaymentBalance(
  principal: number, monthlyRate: number, months: number, paid: number,
): number {
  if (months <= 0) return 0;
  const j = clamp(paid, 0, months);
  if (monthlyRate === 0) return principal * (1 - j / months);
  const fn = pow(monthlyRate, months);
  const fj = pow(monthlyRate, j);
  return (principal * (fn - fj)) / (fn - 1);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 잔액 B를 매달 A씩 갚을 때 몇 달 걸리는가.
 *   B·i·(1+i)ⁿ / ((1+i)ⁿ − 1) = A  를 n에 대해 푼 것
 *
 * 중도상환한 대출에 쓴다. 원래 상환 기간은 더 이상 맞지 않고,
 * 지금 잔액과 지금 상환액만 믿을 수 있기 때문이다.
 * 상환액이 이자에도 못 미치면 영원히 안 끝나므로 null을 준다.
 */
export function payoffMonths(balance: number, monthlyRate: number, payment: number): number | null {
  if (balance <= 0) return 0;
  if (payment <= 0) return null;
  if (monthlyRate === 0) return balance / payment;

  const interest = balance * monthlyRate;
  if (payment <= interest) return null;     // 이자도 못 갚으니 잔액이 안 줄어든다

  return -Math.log(1 - (balance * monthlyRate) / payment) / Math.log(1 + monthlyRate);
}

export function loanStatus(loan: Loan, today: DateKey = todayKey()): LoanStatus {
  const P = Math.max(0, loan.principal);
  const i = Math.max(0, loan.rate) / 100 / 12;
  const term = Math.max(0, Math.round(loan.termMonths));
  const grace = clamp(Math.round(loan.graceMonths), 0, term);
  // 만기일시는 애초에 원금을 나눠 갚지 않으므로 거치기간 개념이 없다
  const n = loan.method === '만기일시' ? 0 : term - grace;

  const endDate = addMonths(loan.startDate, term);
  const elapsed = clamp(monthsBetween(loan.startDate, today), 0, term);
  const remainingMonths = term - elapsed;
  const done = term > 0 && elapsed >= term;
  const inGrace = !done && elapsed < grace && loan.method !== '만기일시';

  const empty = (): LoanStatus => ({
    monthlyPayment: 0, monthlyInterest: 0, monthlyPrincipal: 0,
    remainingPrincipal: 0, paidPrincipal: P,
    elapsedMonths: elapsed, remainingMonths, endDate,
    totalInterest: 0, progress: 1, timeProgress: 1,
    inGrace: false, done: true, isManual: false,
  });

  /**
   * 남은 원금을 직접 적었으면 계산을 통째로 건너뛴다.
   *
   * 중도상환을 하면 원금·금리·기간으로 하는 계산이 실제와 어긋난다.
   * 은행 앱에 찍힌 값을 그대로 쓰는 게 가장 정확하다.
   * 적은 값은 저절로 줄어들지 않는다 — 대신 언제 적었는지(manualAsOf)를 화면에 남겨
   * 낡은 값인지 사용자가 판단할 수 있게 한다.
   */
  if (loan.manualRemaining != null) {
    const remaining = Math.max(0, loan.manualRemaining);
    const paid = Math.max(0, P - remaining);
    const isDone = remaining <= 0;

    const monthlyInterest = isDone ? 0 : remaining * i;
    const payment = isDone
      ? 0
      : loan.manualPayment != null
        ? Math.max(0, loan.manualPayment)
        // 월 상환액을 안 적었으면 남은 원금을 남은 기간에 나눠 갚는 걸로 본다
        : equalPayment(remaining, i, Math.max(1, remainingMonths));

    // '만기까지 총 이자'는 중도상환하면 성립하지 않는다.
    // 지금 잔액을 지금 상환액으로 갚아나갈 때 앞으로 낼 이자로 바꾼다.
    // 계약 기간이 아니라 실제 상환 속도로 계산해야 맞는 숫자가 나온다.
    const left = payoffMonths(remaining, i, payment);
    const futureInterest = left === null ? 0 : Math.max(0, payment * left - remaining);

    return {
      monthlyPayment: payment,
      monthlyInterest,
      monthlyPrincipal: Math.max(0, payment - monthlyInterest),
      remainingPrincipal: remaining,
      paidPrincipal: paid,
      elapsedMonths: elapsed,
      remainingMonths,
      endDate,
      totalInterest: futureInterest,
      progress: P > 0 ? clamp(paid / P, 0, 1) : (isDone ? 1 : 0),
      timeProgress: term > 0 ? elapsed / term : 0,
      // 직접 적은 원금 앞에서는 거치기간이 의미가 없다
      inGrace: false,
      done: isDone,
      isManual: true,
    };
  }

  if (P === 0 || term === 0) {
    return { ...empty(), paidPrincipal: 0, progress: 0, timeProgress: 0, done: term === 0 };
  }

  let remaining: number;
  let monthlyPrincipal: number;
  let totalInterest: number;

  if (loan.method === '만기일시') {
    // 매달 이자만. 원금은 만기에 한 번에 갚는다.
    remaining = done ? 0 : P;
    monthlyPrincipal = 0;
    totalInterest = P * i * term;
  } else if (done) {
    remaining = 0;
    monthlyPrincipal = 0;
    totalInterest = graceInterest(P, i, grace) + amortInterest(loan.method, P, i, n);
  } else if (elapsed < grace) {
    // 거치기간 — 원금은 그대로다
    remaining = P;
    monthlyPrincipal = 0;
    totalInterest = graceInterest(P, i, grace) + amortInterest(loan.method, P, i, n);
  } else {
    const j = elapsed - grace;                     // 상환기간 안에서 몇 회 갚았나
    if (loan.method === '원리금균등') {
      remaining = equalPaymentBalance(P, i, n, j);
      monthlyPrincipal = equalPayment(P, i, n) - remaining * i;
    } else {
      // 원금균등 — 매달 P/n 씩 똑같이 갚는다
      const per = n > 0 ? P / n : 0;
      remaining = Math.max(0, P - per * j);
      monthlyPrincipal = Math.min(per, remaining);
    }
    totalInterest = graceInterest(P, i, grace) + amortInterest(loan.method, P, i, n);
  }

  const monthlyInterest = done ? 0 : remaining * i;
  const monthlyPayment = done ? 0 : monthlyInterest + monthlyPrincipal;
  const paidPrincipal = P - remaining;

  return {
    monthlyPayment,
    monthlyInterest,
    monthlyPrincipal,
    remainingPrincipal: remaining,
    paidPrincipal,
    elapsedMonths: elapsed,
    remainingMonths,
    endDate,
    totalInterest,
    progress: P > 0 ? paidPrincipal / P : 0,
    timeProgress: term > 0 ? elapsed / term : 0,
    inGrace,
    done,
    isManual: false,
  };
}

/** 거치기간 동안 내는 이자 — 원금이 안 줄어드니 매달 같다 */
function graceInterest(P: number, i: number, grace: number): number {
  return P * i * grace;
}

/** 원금을 나눠 갚는 구간에서 내는 이자 총액 */
function amortInterest(method: Loan['method'], P: number, i: number, n: number): number {
  if (n <= 0 || i === 0) return 0;
  if (method === '원리금균등') {
    return equalPayment(P, i, n) * n - P;
  }
  // 원금균등: 잔액이 P, P·(n−1)/n, … 로 줄어든다. 합치면 i·P·(n+1)/2
  return (i * P * (n + 1)) / 2;
}

/** 상환 스케줄 한 줄 */
export interface ScheduleRow {
  no: number;          // 회차 (1부터)
  date: DateKey;
  payment: number;
  interest: number;
  principal: number;
  balance: number;     // 그 회차를 낸 뒤 남은 원금
}

/**
 * 회차별 상환 스케줄.
 * 부동소수점 오차가 쌓여 마지막에 몇 원이 남는 걸 막으려고
 * 마지막 회차에서 잔액을 그대로 털어낸다 (실제 은행도 이렇게 한다).
 */
export function buildSchedule(loan: Loan): ScheduleRow[] {
  const P = Math.max(0, loan.principal);
  const i = Math.max(0, loan.rate) / 100 / 12;
  const term = Math.max(0, Math.round(loan.termMonths));
  const grace = clamp(Math.round(loan.graceMonths), 0, term);
  if (P === 0 || term === 0) return [];

  const rows: ScheduleRow[] = [];
  let balance = P;

  for (let no = 1; no <= term; no++) {
    const date = addMonths(loan.startDate, no);
    const interest = balance * i;
    const last = no === term;
    let principal: number;

    if (loan.method === '만기일시') {
      principal = last ? balance : 0;
    } else if (no <= grace) {
      principal = 0;
    } else if (loan.method === '원리금균등') {
      principal = equalPayment(P, i, term - grace) - interest;
    } else {
      principal = P / (term - grace);
    }

    if (last) principal = balance;               // 잔돈까지 마지막에 정리
    principal = clamp(principal, 0, balance);
    balance -= principal;

    rows.push({ no, date, payment: principal + interest, interest, principal, balance });
  }

  return rows;
}
