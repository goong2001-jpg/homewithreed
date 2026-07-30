import { Expense, FixedExpense, IncomeEntry, MonthBudget, MonthKey, Person } from '../types';
import { activeFixed, alive, monthExpenses } from './budget';

/**
 * xlsx는 400KB가 넘는다. 내보내기는 어쩌다 한 번 쓰는 기능이므로
 * 정적 import를 하지 않고 누를 때만 받아온다.
 */
export async function exportMonthToExcel(
  month: MonthKey,
  budget: MonthBudget,
  incomes: IncomeEntry[],
  fixed: FixedExpense[],
  expenses: Expense[],
  persons: Person[],
): Promise<void> {
  const XLSX = await import('xlsx');
  const nameOf = (id: string | null) =>
    (id ? persons.find(p => p.id === id)?.name : null) ?? '공동';

  const wb = XLSX.utils.book_new();

  // 1) 요약
  const summary = [
    { 항목: '월', 값: month },
    { 항목: '그 달의 일수', 값: budget.daysInMonth },
    { 항목: '월 총수입', 값: budget.totalIncome },
    { 항목: '월 고정지출', 값: budget.totalFixed },
    { 항목: '쓸 수 있는 돈', 값: budget.spendable },
    { 항목: '하루 수입', 값: Math.floor(budget.dailyBudget) },
    { 항목: '경과일수', 값: budget.elapsedDays },
    { 항목: '지금까지 들어온 돈', 값: Math.floor(budget.accrued) },
    { 항목: '이달 누적 지출', 값: budget.variableSpent },
    { 항목: '현재 여유돈', 값: Math.floor(budget.freeCash) },
    ...budget.perPerson.flatMap(p => [
      { 항목: `${p.name} 수입`, 값: p.income },
      { 항목: `${p.name} 지출`, 값: p.expense },
    ]),
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '요약');

  // 2) 변동지출
  const rows = monthExpenses(expenses, month)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .map(e => ({
      날짜: e.date,
      사람: nameOf(e.personId),
      카테고리: e.category,
      내용: e.content,
      금액: e.amount,
    }));
  const wsExpenses = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ 날짜: '', 사람: '', 카테고리: '', 내용: '내역 없음', 금액: 0 }],
  );
  wsExpenses['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsExpenses, '지출내역');

  // 3) 수입 + 고정지출
  const plan = [
    ...incomes
      .filter(i => alive(i) && i.month === month)
      .map(i => ({ 구분: '수입', 이름: i.memo || '수입', 사람: nameOf(i.personId), 금액: i.amount })),
    ...activeFixed(fixed, month)
      .map(f => ({ 구분: '고정지출', 이름: f.name, 사람: nameOf(f.personId), 금액: f.amount })),
  ];
  const wsPlan = XLSX.utils.json_to_sheet(
    plan.length ? plan : [{ 구분: '', 이름: '등록된 항목 없음', 사람: '', 금액: 0 }],
  );
  wsPlan['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsPlan, '수입·고정지출');

  XLSX.writeFile(wb, `가계부_${month}.xlsx`);
}
