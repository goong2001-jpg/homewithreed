import { DateKey, Expense, ExpenseCategory, FixedExpense, IncomeEntry } from '../types';
import { alive, dailyBudgetOf, monthFixed, monthIncome, monthOf, todayKey } from './budget';
import { shortWon, won } from './format';

/**
 * 일요일 주간 리포트 — 월~일 한 주를 돌아본다.
 * 모두 순수 함수. 날짜는 밖에서 주입한다 (시스템 시계에 기대지 않는다).
 */

export interface WeeklyReport {
  weekStart: DateKey;        // 월요일
  weekEnd: DateKey;          // 일요일
  totalSpent: number;
  count: number;
  /** 이 주 일요일이 속한 달의 하루 수입 (budget.ts 와 같은 식). 홈 화면처럼 원 단위로 내림 */
  dailyIncome: number;
  hasIncome: boolean;
  weeklyBudget: number;      // dailyIncome × 7
  diff: number;              // weeklyBudget − totalSpent (음수 = 더 썼다)
  topCategories: { category: ExpenseCategory; amount: number }[];   // 최대 3
  topExpenses: Expense[];                                           // 최대 3
  prevTotal: number;         // 지난주 지출
  /** (이번주 − 지난주) ÷ 지난주. 지난주가 0이면 null (비율이 성립하지 않는다) */
  deltaRatio: number | null;
}

export interface WeeklyState {
  incomes: IncomeEntry[];
  fixed: FixedExpense[];
  expenses: Expense[];
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** 그 날짜가 들어 있는 월~일 주의 양 끝 */
export function weekBounds(date: Date): { start: DateKey; end: DateKey } {
  // getDay(): 일=0 … 토=6. 월요일까지 거슬러 올라갈 날수 = (day + 6) % 7
  const back = (date.getDay() + 6) % 7;
  const monday = shiftDays(date, -back);
  return { start: todayKey(monday), end: todayKey(shiftDays(monday, 6)) };
}

/**
 * 리포트를 보여줄 날인지 — 일요일(한 주를 마감) 과 월요일(주말을 넘긴 아침).
 * 월요일에는 '지난주' 리포트를 보여준다 (reportAnchor 참고).
 */
export function isReportDay(now: Date): boolean {
  const d = now.getDay();
  return d === 0 || d === 1;
}

/** 리포트가 가리킬 날: 월요일이면 어제(=지난주 일요일), 아니면 오늘 */
export function reportAnchor(now: Date): Date {
  return now.getDay() === 1 ? shiftDays(now, -1) : now;
}

const sum = (rows: Expense[]) => rows.reduce((s, e) => s + e.amount, 0);

function inRange(expenses: Expense[], start: DateKey, end: DateKey): Expense[] {
  return expenses.filter(e => alive(e) && e.date >= start && e.date <= end);
}

export function weeklyReport(state: WeeklyState, weekEndDate: Date): WeeklyReport {
  const { start, end } = weekBounds(weekEndDate);
  const rows = inRange(state.expenses, start, end);
  const totalSpent = sum(rows);

  // 하루 수입은 주가 끝나는 달 기준. 한 주가 두 달에 걸치는 경우는 한 달에 한 번뿐이고,
  // 그때도 '이 주에 얼마 쓸 수 있었나'의 답으로 충분히 가깝다.
  const month = monthOf(end);
  const income = monthIncome(state.incomes, month);
  // 홈의 '하루 쓸 수 있는 돈'과 같은 숫자가 보이도록 원 단위로 내린 뒤 7을 곱한다 —
  // 그래야 '하루 × 7 = 주' 가 글자 그대로 맞아떨어진다
  const dailyIncome = Math.floor(dailyBudgetOf(income - monthFixed(state.fixed, month), month));
  const weeklyBudget = dailyIncome * 7;

  const byCat = new Map<ExpenseCategory, number>();
  for (const e of rows) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const topCategories = Array.from(byCat.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
    .slice(0, 3);

  const topExpenses = [...rows]
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 3);

  const prev = weekBounds(shiftDays(weekEndDate, -7));
  const prevTotal = sum(inRange(state.expenses, prev.start, prev.end));

  return {
    weekStart: start, weekEnd: end,
    totalSpent, count: rows.length,
    dailyIncome, hasIncome: income > 0,
    weeklyBudget, diff: weeklyBudget - totalSpent,
    topCategories, topExpenses,
    prevTotal,
    deltaRatio: prevTotal > 0 ? (totalSpent - prevTotal) / prevTotal : null,
  };
}

/** '10/13' */
export function shortDate(date: DateKey): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}/${d}`;
}

/** '10월 13일 ~ 10월 19일' */
export function weekRangeLabel(r: Pick<WeeklyReport, 'weekStart' | 'weekEnd'>): string {
  const [, m1, d1] = r.weekStart.split('-').map(Number);
  const [, m2, d2] = r.weekEnd.split('-').map(Number);
  return `${m1}월 ${d1}일 ~ ${m2}월 ${d2}일`;
}

/** 지난주 대비 한 줄 */
export function deltaLabel(r: Pick<WeeklyReport, 'deltaRatio' | 'prevTotal' | 'totalSpent'>): string {
  if (r.deltaRatio === null) {
    return r.totalSpent > 0 ? '지난주엔 지출이 없었어요' : '지난주도 이번 주도 지출이 없어요';
  }
  const pct = Math.round(Math.abs(r.deltaRatio) * 100);
  if (pct === 0) return '지난주와 비슷하게 썼어요';
  return r.deltaRatio > 0 ? `지난주보다 ${pct}% 더 썼어요` : `지난주보다 ${pct}% 덜 썼어요`;
}

/** 예산 대비 한 줄 */
export function diffLabel(r: Pick<WeeklyReport, 'diff' | 'hasIncome'>): string {
  if (!r.hasIncome) return '수입이 없어 비교할 예산이 없어요';
  if (r.diff >= 0) return `${won(r.diff)} 남겼어요`;
  return `예산보다 ${won(-r.diff)} 더 썼어요`;
}

/**
 * 카톡 텍스트 공유용. 이미지를 못 보내는 환경에서 그대로 붙여 넣는다.
 */
export function weeklyReportText(r: WeeklyReport): string {
  const lines: string[] = [];
  lines.push(`📊 주간 리포트 (${weekRangeLabel(r)})`);
  lines.push(`이번 주 지출: ${won(r.totalSpent)} (${r.count}건)`);
  if (r.hasIncome) {
    lines.push(`쓸 수 있던 돈: 하루 ${won(r.dailyIncome)} × 7일 = ${won(r.weeklyBudget)}`);
  }
  lines.push(`→ ${diffLabel(r)}`);
  if (r.topCategories.length) {
    lines.push(`많이 쓴 곳: ${r.topCategories.map(c => `${c.category} ${shortWon(c.amount)}`).join(' · ')}`);
  }
  if (r.topExpenses.length) {
    lines.push('큰 지출:');
    for (const e of r.topExpenses) {
      lines.push(`  ${shortDate(e.date)} ${e.content} ${won(e.amount)}`);
    }
  }
  lines.push(deltaLabel(r));
  return lines.join('\n');
}
