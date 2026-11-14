/**
 * 저금통 화면의 '살펴볼 점' — 기록을 보고 어디를 줄이면 좋을지 숫자로 짚어준다 (v23).
 *
 * 서버·외부 API 없이 **이 폰 안의 기록만** 계산한다 (순수 함수).
 * 앱은 "낭비다"라고 판단하지 않는다 — 평소보다 늘었는지, 비중이 큰지, 이 속도면 어떻게 되는지만 보여준다.
 * 남들 평균(통계)과는 비교하지 않는다 — 집마다 사정이 다르고 수치가 낡는다.
 *
 * 네 가지 (사용자가 고른 것):
 *   ① pace     — 이 속도면 월말에 얼마 모자라는지/남는지
 *   ② category — 지난 석 달 같은 날짜까지의 평균보다 많이 쓴 카테고리
 *   ③ small    — 자잘하게 자주 쓴 것
 *   ④ fixed    — 고정지출이 수입에서 차지하는 비중
 */
import {
  Expense, ExpenseCategory, FixedExpense, MonthBudget, MonthKey,
} from '../types';
import { activeFixed, addMonths, alive, daysInMonth, isNoSpend } from './budget';
import { shortWon, won } from './format';

export interface Insight {
  /** 종류 + 대상 — 화면 key */
  key: string;
  kind: 'pace' | 'category' | 'small' | 'fixed' | 'needHistory';
  /** warn = 살펴볼 것, good = 잘하고 있음, info = 참고 */
  tone: 'warn' | 'good' | 'info';
  title: string;
  detail: string;
}

const num = (n: unknown): number => (typeof n === 'number' && isFinite(n) ? n : 0);
/** 짐작한 금액은 천 원 단위로 — '약 12.3만원' 처럼 읽히게 */
const approx = (n: number): string => shortWon(Math.round(n / 1000) * 1000);

/** 평소보다 이만큼(비율·금액) 넘게 썼을 때만 말한다 — 조금 넘은 걸로 잔소리하지 않는다 */
export const CATEGORY_OVER_RATIO = 1.2;
export const CATEGORY_OVER_AMOUNT = 20_000;
/** 같은 내용으로 이만큼 자주 쓰면 '자주 쓴 것' */
export const SMALL_REPEAT_COUNT = 5;
/** 이 금액 이하를 '자잘한 지출'로 본다 */
export const SMALL_AMOUNT = 10_000;
export const SMALL_MANY_COUNT = 10;
/** 고정지출이 수입의 이 비율을 넘으면 살펴볼 것으로 올린다 */
export const FIXED_WARN_RATIO = 0.5;

interface Input {
  /** computeMonthBudget 결과 — 보고 있는 달 */
  budget: MonthBudget;
  /** 지출 전체 (낸 경조사비를 포함한 App 의 spendRows) */
  expenses: Expense[];
  fixed: FixedExpense[];
}

const dayOf = (e: Expense): number => Number(e.date.slice(8, 10)) || 0;

function real(expenses: Expense[]): Expense[] {
  return expenses.filter(e => alive(e) && !isNoSpend(e) && num(e.amount) > 0);
}

// ① 이 속도면 월말에
function paceInsight(b: MonthBudget): Insight | null {
  if (b.phase !== 'current' || !b.hasIncome || b.spendable <= 0) return null;
  if (b.elapsedDays < 3 || b.variableSpent <= 0) return null;   // 며칠 안 지났으면 짐작이 너무 흔들린다

  if (b.remainingBudget < 0) {
    return {
      key: 'pace', kind: 'pace', tone: 'warn',
      title: `이번 달 쓸 돈을 이미 ${approx(-b.remainingBudget)} 넘었어요`,
      detail: `남은 ${b.remainingDays}일은 꼭 필요한 것만 쓰는 게 좋아요.`,
    };
  }
  const projected = (b.variableSpent / b.elapsedDays) * b.daysInMonth;
  const gap = projected - b.spendable;
  if (gap > 0 && b.remainingDays > 0) {
    const perDay = b.remainingBudget / b.remainingDays;
    return {
      key: 'pace', kind: 'pace', tone: 'warn',
      title: `지금처럼 쓰면 월말에 ${approx(gap)}쯤 모자라요`,
      detail: `남은 ${b.remainingDays}일 동안 하루 ${approx(perDay)} 안으로 쓰면 맞아요. `
        + `(지금까지는 하루 평균 ${approx(b.variableSpent / b.elapsedDays)})`,
    };
  }
  if (gap <= 0) {
    return {
      key: 'pace', kind: 'pace', tone: 'good',
      title: `지금처럼 쓰면 월말에 ${approx(-gap)}쯤 남아요`,
      detail: `지금까지 하루 평균 ${approx(b.variableSpent / b.elapsedDays)}씩 썼어요.`,
    };
  }
  return null;
}

// ② 평소보다 많이 쓴 카테고리
function categoryInsights(b: MonthBudget, rows: Expense[]): Insight[] {
  if (b.phase === 'future') return [];
  // 이번 달은 '오늘 날짜까지', 끝난 달은 그 달 전체와 견준다 — 15일에 한 달 치와 견주면 늘 적게 쓴 걸로 나온다
  const upTo = b.phase === 'current' ? b.elapsedDays : 31;
  const prevMonths = [1, 2, 3].map(i => addMonths(b.month, -i));

  const sumBy = (month: MonthKey) => {
    const m = new Map<ExpenseCategory, number>();
    let any = false;
    for (const e of rows) {
      if (e.month !== month) continue;
      any = true;                        // 그 달에 기록이 하나라도 있으면 '기록한 달'
      if (dayOf(e) > upTo) continue;
      m.set(e.category, (m.get(e.category) ?? 0) + num(e.amount));
    }
    return { m, any };
  };

  const cur = sumBy(b.month).m;
  const prev = prevMonths.map(sumBy).filter(p => p.any);
  if (prev.length < 2) {
    // 견줄 달이 모자라면 틀린 말을 하느니 안 한다 — 이번 달 기록이 있을 때만 한 줄 알린다
    return cur.size === 0 ? [] : [{
      key: 'needHistory', kind: 'needHistory', tone: 'info',
      title: '평소와 견주려면 기록이 더 필요해요',
      detail: '두 달 넘게 적으면 "평소보다 많이 쓴 곳"을 알려드려요.',
    }];
  }

  const out: (Insight & { diff: number })[] = [];
  cur.forEach((spent, category) => {
    const avg = prev.reduce((s, p) => s + (p.m.get(category) ?? 0), 0) / prev.length;
    const diff = spent - avg;
    if (diff < CATEGORY_OVER_AMOUNT || spent < avg * CATEGORY_OVER_RATIO) return;
    out.push({
      key: `category-${category}`, kind: 'category', tone: 'warn', diff,
      title: `${category}가 평소보다 ${approx(diff)} 많아요`,
      detail: avg > 0
        ? `지난 ${prev.length}달은 ${b.phase === 'current' ? '이맘때까지 ' : ''}평균 ${approx(avg)}, 이번 달은 ${approx(spent)}.`
        : `지난 ${prev.length}달에는 거의 없던 지출이에요. 이번 달 ${approx(spent)}.`,
    });
  });
  return out.sort((a, b2) => b2.diff - a.diff).slice(0, 2).map(({ diff, ...i }) => i);
}

// ③ 자잘하게 자주 쓴 것
function smallInsight(b: MonthBudget, rows: Expense[]): Insight | null {
  if (b.phase === 'future') return null;
  const month = rows.filter(e => e.month === b.month && !e.giftId);

  // 같은 내용으로 여러 번
  const byName = new Map<string, { count: number; total: number }>();
  for (const e of month) {
    const name = (e.content ?? '').trim();
    if (!name || name === e.category) continue;      // 내용을 안 적은 건 서로 다른 지출일 수 있다
    const cur = byName.get(name) ?? { count: 0, total: 0 };
    cur.count += 1; cur.total += num(e.amount);
    byName.set(name, cur);
  }
  let best: { label: string; count: number; total: number } | null = null;
  byName.forEach((v, name) => {
    if (v.count < SMALL_REPEAT_COUNT) return;
    if (!best || v.total > best.total) best = { label: `"${name}"에`, ...v };
  });

  // 카테고리 안에서 1만원 이하를 여러 번
  const byCat = new Map<ExpenseCategory, { count: number; total: number }>();
  for (const e of month) {
    if (num(e.amount) > SMALL_AMOUNT) continue;
    const cur = byCat.get(e.category) ?? { count: 0, total: 0 };
    cur.count += 1; cur.total += num(e.amount);
    byCat.set(e.category, cur);
  }
  byCat.forEach((v, category) => {
    if (v.count < SMALL_MANY_COUNT) return;
    if (!best || v.total > best.total) best = { label: `${category}에서 1만원 이하로`, ...v };
  });

  if (!best) return null;
  const hit = best as { label: string; count: number; total: number };
  return {
    key: 'small', kind: 'small', tone: 'info',
    title: `${hit.label} ${hit.count}번, 합쳐서 ${shortWon(hit.total)}`,
    // 작은 금액은 천 원 단위로 뭉개지 않는다 (4,500원이 5,000원이 되면 틀린 말이다)
    detail: `한 번은 평균 ${won(hit.total / hit.count)}인데 모이면 하루 쓸 돈 `
      + `${(hit.total / Math.max(1, b.dailyBudget)).toFixed(1)}일 치예요.`,
  };
}

// ④ 고정지출 비중
function fixedInsight(b: MonthBudget, fixed: FixedExpense[]): Insight | null {
  if (!b.hasIncome || b.totalFixed <= 0) return null;
  const ratio = b.totalFixed / b.totalIncome;
  const top = activeFixed(fixed, b.month)
    .slice()
    .sort((x, y) => num(y.amount) - num(x.amount))
    .slice(0, 3)
    .map(f => `${f.name} ${shortWon(num(f.amount))}`);
  const warn = ratio >= FIXED_WARN_RATIO;
  return {
    key: 'fixed', kind: 'fixed', tone: warn ? 'warn' : 'info',
    title: `고정지출이 수입의 ${Math.round(ratio * 100)}%예요`,
    detail: `${warn ? '절반을 넘어요. ' : ''}큰 순서: ${top.join(', ')}. `
      + `여기서 1만원을 줄이면 하루 쓸 돈이 ${won(10_000 / daysInMonth(b.month))}쯤 늘어요.`,
  };
}

/** 살펴볼 것(warn)이 위로, 그 안에서는 ①속도 ②카테고리 ③자잘한 지출 ④고정지출 순 */
export function computeInsights({ budget, expenses, fixed }: Input): Insight[] {
  const rows = real(expenses);
  const list = [
    paceInsight(budget),
    ...categoryInsights(budget, rows),
    smallInsight(budget, rows),
    fixedInsight(budget, fixed),
  ].filter((i): i is Insight => i !== null);
  const rank = (i: Insight) => (i.tone === 'warn' ? 0 : i.kind === 'needHistory' ? 2 : 1);
  return list
    .map((i, idx) => ({ i, idx }))
    .sort((a, b) => rank(a.i) - rank(b.i) || a.idx - b.idx)
    .map(x => x.i);
}
