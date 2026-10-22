import {
  BUDGET_WARN_RATIO, BudgetLevel, BudgetStatusRow, CATEGORIES, CategoryBudget, CategorySpend,
  DateKey, Expense, ExpenseCategory, FixedExpense, FrequentExpense, IncomeEntry, MonthBudget,
  MonthKey, MonthPhase, Person, PersonSpend,
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

// ======================= 카테고리별 월 상한 =======================

/**
 * 상한이 걸린 카테고리마다 이 달에 얼마나 썼는지.
 *
 * expensesOfMonth 는 이미 그 달로 걸러진 지출(monthExpenses 결과)을 받는다 —
 * 어느 달인지는 호출자가 안다. 툼스톤은 여기서 한 번 더 거른다.
 * 상한이 없는(없거나 0·삭제된) 카테고리는 아예 빼서, 아무것도 안 정했으면 빈 배열이다.
 *
 * 정렬: 많이 쓴 비율이 높은 순 — 급한 게 위로. 같으면 카테고리 고정 순서.
 */
export function budgetStatus(
  expensesOfMonth: Expense[], budgets: CategoryBudget[],
): BudgetStatusRow[] {
  const spent = new Map<ExpenseCategory, number>();
  for (const e of expensesOfMonth) {
    if (!alive(e)) continue;
    spent.set(e.category, (spent.get(e.category) ?? 0) + num(e.amount));
  }

  const order = (c: ExpenseCategory) => {
    const i = CATEGORIES.indexOf(c);
    return i < 0 ? CATEGORIES.length : i;
  };

  return budgets
    .filter(b => alive(b) && num(b.monthlyLimit) > 0)
    .map(b => {
      const limit = num(b.monthlyLimit);
      const used = spent.get(b.category) ?? 0;
      return { category: b.category, spent: used, limit, ratio: used / limit };
    })
    .sort((a, b) => b.ratio - a.ratio || order(a.category) - order(b.category));
}

/**
 * 지출 하나를 저장한 뒤 상한 경고를 띄울지.
 *  · 'over' — 이번 저장으로 100% 를 넘었다
 *  · 'warn' — 이번 저장으로 80% 를 넘었다
 *  · null  — 선을 안 넘었거나, 이미 그 전에 넘어 있었다 (매번 잔소리하지 않는다)
 */
export function limitAlert(
  spentBefore: number, spentAfter: number, limit: number,
): 'over' | 'warn' | null {
  if (!(limit > 0)) return null;
  const before = spentBefore / limit;
  const after = spentAfter / limit;
  if (after >= 1 && before < 1) return 'over';
  if (after >= BUDGET_WARN_RATIO && before < BUDGET_WARN_RATIO) return 'warn';
  return null;
}

// ======================= 자주 쓰는 지출 =======================

/** 오늘 기준 n일 전 날짜 */
export function daysAgoKey(now: Date, days: number): DateKey {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return todayKey(d);
}

/**
 * 최근 90일 동안 (카테고리·내용·금액) 이 똑같이 반복된 지출 — 원탭 입력 후보.
 * 횟수 많은 순, 같으면 최근에 쓴 순. 내용 비교는 앞뒤 공백만 뗀다.
 */
export function frequentExpenses(
  expenses: Expense[], now: Date = new Date(), limit = 5,
): FrequentExpense[] {
  const since = daysAgoKey(now, 90);
  const until = todayKey(now);
  const bucket = new Map<string, FrequentExpense>();

  for (const e of expenses) {
    if (!alive(e)) continue;
    if (e.date < since || e.date > until) continue;
    const amount = num(e.amount);
    if (amount <= 0) continue;
    const content = (e.content ?? '').trim();
    const key = `${e.category}\u0000${content}\u0000${amount}`;
    const cur = bucket.get(key);
    if (!cur) {
      bucket.set(key, {
        category: e.category, content, amount, personId: e.personId,
        count: 1, lastDate: e.date,
      });
    } else {
      cur.count += 1;
      if (e.date > cur.lastDate) { cur.lastDate = e.date; cur.personId = e.personId; }
    }
  }

  return Array.from(bucket.values())
    .sort((a, b) =>
      b.count - a.count
      || b.lastDate.localeCompare(a.lastDate)
      || b.amount - a.amount)
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
