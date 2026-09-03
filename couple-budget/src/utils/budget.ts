import {
  BudgetLevel, CategorySpend, DateKey, Expense, ExpenseCategory, FixedExpense,
  IncomeEntry, MonthBudget, MonthKey, MonthPhase, Person, PersonSpend,
} from '../types';

/**
 * 로컬 시간대 기준 오늘.
 * ⚠️ new Date().toISOString().slice(0,10) 은 쓰지 않는다 — UTC로 바뀌기 때문에
 *    한국(UTC+9)에서 새벽 0시~8시 59분 사이에 '어제' 날짜가 나온다.
 */
export function todayKey(now: Date = new Date()): DateKey {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function thisMonth(now: Date = new Date()): MonthKey {
  return todayKey(now).slice(0, 7);
}

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

/** 실제 달력 일수. new Date(y, m, 0) = m월의 마지막 날 (m은 1부터) */
export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return 30;   // 값이 깨졌을 때의 방어
  return new Date(y, m, 0).getDate();           // 2026-06 → 30, 2026-07 → 31, 2028-02 → 29
}

/** 'YYYY-MM' 에 개월 수를 더한다 (음수 가능) */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthPhase(month: MonthKey, now: Date = new Date()): MonthPhase {
  const cur = thisMonth(now);
  if (month === cur) return 'current';
  return month < cur ? 'past' : 'future';
}

/**
 * 경과일수 — 지금까지 며칠치 수입이 발생한 것으로 볼지.
 *  · 이번 달: 오늘의 '일' 숫자. 1일에도 하루치(예: 10만원)는 쓸 수 있어야 하므로 0이 아니라 1.
 *  · 지난 달: 그 달의 전체 일수. 끝난 달은 예산이 전액 발생하고 결과가 확정된 것으로 본다.
 *  · 다음 달: 0. 아직 아무것도 발생하지 않았다.
 *             (지출도 0이므로 저금통은 가득 찬 상태 = '아직 안 쓴 다음 달 예산'으로 읽힌다)
 */
export function elapsedDays(month: MonthKey, now: Date = new Date()): number {
  switch (monthPhase(month, now)) {
    case 'past':   return daysInMonth(month);
    case 'future': return 0;
    default:       return Math.min(now.getDate(), daysInMonth(month));
  }
}

/** 삭제 표시(툼스톤)가 없는 레코드만 통과 */
export const alive = <T extends { deleted?: boolean }>(r: T): boolean => r.deleted !== true;

/** 클라우드나 손상된 localStorage에서 뭐가 오든 숫자로 만든다 */
const num = (n: unknown): number => (typeof n === 'number' && isFinite(n) ? n : 0);

const clamp01 = (n: number): number => (isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export function monthIncome(incomes: IncomeEntry[], month: MonthKey): number {
  return incomes
    .filter(i => alive(i) && i.month === month)
    .reduce((s, i) => s + num(i.amount), 0);
}

/** 고정지출은 startMonth ~ endMonth(포함) 사이의 '매달' 계상된다 */
export function isFixedActive(f: FixedExpense, month: MonthKey): boolean {
  if (!alive(f)) return false;
  if (month < f.startMonth) return false;
  if (f.endMonth && month > f.endMonth) return false;
  return true;
}

export function activeFixed(fixed: FixedExpense[], month: MonthKey): FixedExpense[] {
  return fixed.filter(f => isFixedActive(f, month));
}

export function monthFixed(fixed: FixedExpense[], month: MonthKey): number {
  return activeFixed(fixed, month).reduce((s, f) => s + num(f.amount), 0);
}

export function monthExpenses(expenses: Expense[], month: MonthKey): Expense[] {
  return expenses.filter(e => alive(e) && e.month === month);
}

/**
 * 카테고리별 지출 집계. 금액이 큰 순서로 돌려준다.
 * personId 를 주면 그 사람이 쓴 것만 센다.
 * 지출이 하나도 없는 카테고리는 아예 빼서 화면이 비어 보이지 않게 한다.
 */
export function categoryTotals(
  expenses: Expense[], month: MonthKey, personId?: string,
): CategorySpend[] {
  const rows = monthExpenses(expenses, month)
    .filter(e => !personId || e.personId === personId);

  const total = rows.reduce((s, e) => s + num(e.amount), 0);
  const bucket = new Map<ExpenseCategory, { amount: number; count: number }>();

  for (const e of rows) {
    const cur = bucket.get(e.category) ?? { amount: 0, count: 0 };
    cur.amount += num(e.amount);
    cur.count += 1;
    bucket.set(e.category, cur);
  }

  return Array.from(bucket.entries())
    .map(([category, v]) => ({
      category,
      amount: v.amount,
      count: v.count,
      ratio: total > 0 ? v.amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

/**
 * 금액이 큰 지출부터 limit 건.
 * 같은 금액이면 최근에 쓴 것을 먼저 보여준다 (기억이 생생한 쪽이 위로).
 */
export function topExpenses(
  expenses: Expense[], month: MonthKey, limit = 5, personId?: string,
): Expense[] {
  return monthExpenses(expenses, month)
    .filter(e => !personId || e.personId === personId)
    .sort((a, b) =>
      num(b.amount) - num(a.amount)
      || b.date.localeCompare(a.date)
      || b.createdAt - a.createdAt)
    .slice(0, Math.max(0, limit));
}

/** ★ 하루 수입 = (월 총수입 − 월 고정지출) ÷ 그 달의 실제 일수 */
export function dailyBudgetOf(spendable: number, month: MonthKey): number {
  const days = daysInMonth(month);
  return days > 0 ? spendable / days : 0;
}

function levelOf(
  hasIncome: boolean, freeCash: number, dailyBudget: number, phase: MonthPhase,
): BudgetLevel {
  if (!hasIncome) return 'noIncome';
  if (freeCash < 0) return '초과';
  // 끝난 달에는 '주의'라는 개념이 없다 — 결과는 흑자 아니면 적자뿐
  if (phase === 'past') return '여유';
  return freeCash < dailyBudget ? '주의' : '여유';
}

export function computeMonthBudget(input: {
  month: MonthKey;
  incomes: IncomeEntry[];
  fixed: FixedExpense[];
  expenses: Expense[];
  persons: Person[];
  now?: Date;
}): MonthBudget {
  const { month, incomes, fixed, expenses, persons } = input;
  const now = input.now ?? new Date();

  const phase = monthPhase(month, now);
  const days = daysInMonth(month);
  const elapsed = elapsedDays(month, now);

  const totalIncome = monthIncome(incomes, month);
  const totalFixed = monthFixed(fixed, month);
  const spendable = totalIncome - totalFixed;      // 음수 가능 — 일부러 0으로 자르지 않는다
  const dailyBudget = dailyBudgetOf(spendable, month);

  const rows = monthExpenses(expenses, month);
  const variableSpent = rows.reduce((s, e) => s + num(e.amount), 0);

  const today = todayKey(now);
  const spentToday = phase === 'current'
    ? rows.filter(e => e.date === today).reduce((s, e) => s + num(e.amount), 0)
    : 0;

  const accrued = elapsed * dailyBudget;
  const freeCash = accrued - variableSpent;        // ★ 누적 모델의 핵심 수식
  const remainingBudget = spendable - variableSpent;

  const hasIncome = totalIncome > 0;

  // 저금통 채움 = 이달 남은 예산 ÷ 이달 쓸 수 있는 돈.
  //   1일에 가득 → 쓰는 즉시 줄어들고 → 예산대로 다 쓰면 말일에 0.
  //   "저금통이 한 달 동안 비어간다"는 물리적 직관과 정확히 맞는다.
  //   '지금 잘하고 있는지'는 색(level)과 목표선(paceRatio)이 담당한다.
  const fillRatio = spendable > 0 ? clamp01(remainingBudget / spendable) : 0;
  // 목표선 = 지금 저금통이 있어야 할 높이. 채움이 이 선보다 위면 앞서가는 중.
  const paceRatio = spendable > 0 ? clamp01((spendable - accrued) / spendable) : 0;

  const perPerson: PersonSpend[] = persons
    .filter(alive)
    .sort((a, b) => a.order - b.order)
    .map(p => {
      const expense = rows
        .filter(e => e.personId === p.id)
        .reduce((s, e) => s + num(e.amount), 0);
      return {
        personId: p.id,
        name: p.name,
        color: p.color,
        income: incomes
          .filter(i => alive(i) && i.month === month && i.personId === p.id)
          .reduce((s, i) => s + num(i.amount), 0),
        expense,
        ratio: variableSpent > 0 ? expense / variableSpent : 0,
      };
    });

  return {
    month, phase,
    daysInMonth: days,
    elapsedDays: elapsed,
    remainingDays: Math.max(0, days - elapsed),
    totalIncome, totalFixed, spendable, dailyBudget,
    variableSpent, spentToday,
    accrued, freeCash,
    overspend: Math.max(0, -freeCash),
    remainingBudget,
    fillRatio, paceRatio,
    level: levelOf(hasIncome, freeCash, dailyBudget, phase),
    hasIncome,
    fixedOverIncome: hasIncome && spendable < 0,
    perPerson,
  };
}

/** 저금통 · 금액 표시 색 */
export const LEVEL_COLOR: Record<BudgetLevel, string> = {
  noIncome: '#bdc3c7',
  여유: '#27ae60',
  주의: '#f39c12',
  초과: '#e74c3c',
};

export const LEVEL_LABEL: Record<BudgetLevel, string> = {
  noIncome: '수입을 입력해주세요',
  여유: '😄 여유 있어요',
  주의: '😬 거의 다 썼어요',
  초과: '😥 예산을 넘었어요',
};
